import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  PersonaNaviError,
  execAgentCli,
  inspectSourceMaterials,
  prepareYouNaviRuntime,
  resolveAgentCli,
  validateUploadedDocument,
} from "./persona-navi-bridge-lib.mjs";

export const PERSONA_SOUL_SCHEMA = "persona.soul-run/v1";
export const PERSONA_SOUL_RECEIPT_SCHEMA = "persona.soul-receipt/v1";
export const PERSONA_SOUL_STAGES = Object.freeze([
  "collecting",
  "distilling",
  "assembling",
  "validating",
  "ready",
  "error",
]);
export const SOUL_REQUIRED_FILES = Object.freeze([
  "SKILL.md",
  "_persona/rules.md",
  "_persona/communication.md",
  "_persona/values.md",
  "_quotes/iconic.md",
  "_meta/sources.md",
]);
export const SOUL_MIN_KNOWLEDGE_FILES = 2;
export const SOUL_MIN_ICONIC_QUOTES = 20;

export class PersonaSoulError extends PersonaNaviError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "PersonaSoulError";
  }
}

function cleanText(value, { name, max, required = true } = {}) {
  const raw = String(value ?? "");
  if (raw.includes("\0")) throw new PersonaSoulError(`${name}包含非法控制字符`, { code: "INVALID_SOUL_REQUEST" });
  const text = raw.trim();
  if (required && !text) throw new PersonaSoulError(`${name}不能为空`, { code: "INVALID_SOUL_REQUEST" });
  if (text.length > max) throw new PersonaSoulError(`${name}不能超过 ${max} 字符`, { code: "INVALID_SOUL_REQUEST" });
  return text;
}

export function normalizeSoulSlug(value) {
  const normalized = String(value ?? "").trim().normalize("NFKD");
  const ascii = normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  if (ascii) return ascii;
  let hash = 2166136261;
  for (const character of normalized || "persona") {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `soul-${(hash >>> 0).toString(36).slice(0, 8)}`;
}

function assertExactMaterialPath(value, index) {
  const raw = cleanText(value, { name: `素材路径 ${index + 1}`, max: 1000 });
  if (!path.isAbsolute(raw) || raw.includes("*") || raw.includes("?") || raw.endsWith(path.sep)) {
    throw new PersonaSoulError(`素材路径 ${index + 1} 必须是单个明确的绝对文件路径`, { code: "INVALID_SOURCE_SCOPE" });
  }
  const resolved = path.resolve(raw);
  if (resolved !== raw || raw.split(path.sep).includes("..")) {
    throw new PersonaSoulError(`素材路径 ${index + 1} 不允许目录穿越`, { code: "INVALID_SOURCE_SCOPE" });
  }
  const segments = resolved.split(path.sep).filter(Boolean).map((segment) => segment.toLowerCase());
  if (segments.includes("vault") || resolved === "/" || resolved === "/Users" || (segments[0] === "users" && segments.length <= 2)) {
    throw new PersonaSoulError(`素材路径 ${index + 1} 不能指向 vault、主目录或目录范围`, { code: "INVALID_SOURCE_SCOPE" });
  }
  return resolved;
}

function assertPublicSource(source, index) {
  if (!source || typeof source !== "object") throw new PersonaSoulError(`公开来源 ${index + 1} 无效`, { code: "INVALID_SOURCE_SCOPE" });
  const label = cleanText(source.label || source.url, { name: `公开来源 ${index + 1} 名称`, max: 240 });
  const url = cleanText(source.url, { name: `公开来源 ${index + 1} URL`, max: 2000 });
  if (!/^https?:\/\//i.test(url)) throw new PersonaSoulError(`公开来源 ${index + 1} 必须是 http(s) URL`, { code: "INVALID_SOURCE_SCOPE" });
  return { id: cleanText(source.id || `public-${index + 1}`, { name: `公开来源 ${index + 1} ID`, max: 100 }), label, url };
}

function validateUploadedSoulMaterial(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PersonaSoulError(`上传素材 ${index + 1} 无效`, { code: "INVALID_SOURCE_SCOPE" });
  const document = validateUploadedDocument({
    name: value.name,
    content: value.content,
    size: value.size,
    mimeType: value.mimeType,
  });
  return {
    id: cleanText(value.id || `upload-${index + 1}`, { name: `上传素材 ${index + 1} ID`, max: 100 }),
    ...document,
    wordCount: Math.max(0, Number(value.wordCount) || 0),
  };
}

export function validatePersonaSoulRequest(payload) {
  if (!payload || payload.schema !== PERSONA_SOUL_SCHEMA || payload.mode !== "from-soul") {
    throw new PersonaSoulError("不支持的 Soul Bridge schema 或模式", { code: "INVALID_SOUL_REQUEST" });
  }
  const personName = cleanText(payload.personName, { name: "人物姓名", max: 80 });
  const oneLineDescription = cleanText(payload.oneLineDescription, { name: "一句话描述", max: 240 });
  const targetType = cleanText(payload.targetType, { name: "目标类型", max: 10 });
  const sourceMode = cleanText(payload.sourceMode, { name: "采集方式", max: 32 });
  if (!["self", "other"].includes(targetType)) throw new PersonaSoulError("目标类型只能是 self 或 other", { code: "INVALID_SOUL_REQUEST" });
  if (!["selected-materials", "uploaded-files", "younavi-context", "public-research"].includes(sourceMode)) throw new PersonaSoulError("采集方式不在白名单", { code: "INVALID_SOUL_REQUEST" });

  const exactMaterialPaths = Array.isArray(payload.exactMaterialPaths) ? payload.exactMaterialPaths.map(assertExactMaterialPath) : [];
  const fixedMaterialIds = Array.isArray(payload.fixedMaterialIds)
    ? payload.fixedMaterialIds.map((value, index) => cleanText(value, { name: `固定素材 ${index + 1} ID`, max: 100 }))
    : [];
  const uploadedMaterials = Array.isArray(payload.uploadedMaterials) ? payload.uploadedMaterials.map(validateUploadedSoulMaterial) : [];
  const publicSources = Array.isArray(payload.publicSources) ? payload.publicSources.map(assertPublicSource) : [];
  const scope = payload.collectionScope;
  if (!scope || scope.confirmed !== true || !cleanText(scope.scopeText, { name: "采集范围", max: 2000 })) {
    throw new PersonaSoulError("缺少用户确认的采集范围", { code: "PRIVACY_SCOPE_REQUIRED" });
  }
  if (typeof scope.exclusionsText !== "string" || scope.exclusionsText.length > 2000) throw new PersonaSoulError("隐私排除范围无效", { code: "PRIVACY_SCOPE_REQUIRED" });
  if (scope.speakerPurificationRequired && scope.speakerPurificationConfirmed !== true) {
    throw new PersonaSoulError("会议/群聊素材必须先完成发言人纯化确认", { code: "SPEAKER_PURIFICATION_REQUIRED" });
  }
  const localInputCount = exactMaterialPaths.length + fixedMaterialIds.length + uploadedMaterials.length;
  if (targetType === "self" && sourceMode !== "public-research" && localInputCount === 0) {
    throw new PersonaSoulError("自己模式必须选择明确素材，不能让任务自行搜索主目录", { code: "INVALID_SOURCE_SCOPE" });
  }
  if (targetType === "other" && !["uploaded-files", "public-research"].includes(sourceMode)) {
    throw new PersonaSoulError("other 模式只能使用用户明确提供的文件或公开来源", { code: "INVALID_SOURCE_SCOPE" });
  }
  if (targetType === "other" && fixedMaterialIds.length > 0) {
    throw new PersonaSoulError("other 模式不能读取工作区固定素材，只能使用用户明确提供的文件或公开 URL", { code: "INVALID_SOURCE_SCOPE" });
  }
  if (sourceMode === "public-research") {
    if (publicSources.length === 0) throw new PersonaSoulError("公开研究必须提供允许的公开来源 URL", { code: "INVALID_SOURCE_SCOPE" });
    if (localInputCount > 0) throw new PersonaSoulError("公开研究请求不能混入本地素材", { code: "INVALID_SOURCE_SCOPE" });
  } else if (localInputCount === 0) {
    throw new PersonaSoulError("非公开研究模式必须提供明确素材", { code: "INVALID_SOURCE_SCOPE" });
  }
  const outputSlug = normalizeSoulSlug(payload.outputSlug || personName);
  const outputDir = `outputs/persona-souls/${outputSlug}-soul`;
  if (payload.outputDir && payload.outputDir !== outputDir) throw new PersonaSoulError("输出目录必须固定在 outputs/persona-souls/{slug}-soul", { code: "INVALID_OUTPUT_SCOPE" });
  const runId = payload.runId ? cleanText(payload.runId, { name: "runId", max: 80 }) : `psoul-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  if (!/^psoul-[a-z0-9-]{12,72}$/i.test(runId)) throw new PersonaSoulError("runId 格式无效", { code: "INVALID_SOUL_REQUEST" });
  return {
    schema: PERSONA_SOUL_SCHEMA,
    runId,
    mode: "from-soul",
    personName,
    oneLineDescription,
    targetType,
    sourceMode,
    exactMaterialPaths,
    fixedMaterialIds: [...new Set(fixedMaterialIds)],
    uploadedMaterials,
    publicSources,
    collectionScope: {
      confirmed: true,
      scopeText: scope.scopeText.trim(),
      exclusionsText: scope.exclusionsText.trim(),
      speakerPurificationRequired: Boolean(scope.speakerPurificationRequired),
      speakerPurificationConfirmed: Boolean(scope.speakerPurificationConfirmed),
    },
    outputSlug,
    outputDir,
    materialCount: Math.max(0, Number(payload.materialCount) || localInputCount + publicSources.length),
    totalWordCount: Math.max(0, Number(payload.totalWordCount) || 0),
  };
}

export function renderCreateSoulPrompt(request) {
  const sourceLines = request.sourceMode === "public-research"
    ? request.publicSources.map((source, index) => `${index + 1}. ${source.label} — ${source.url}`)
    : request.exactMaterialPaths.map((source, index) => `${index + 1}. ${source}`);
  return [
    `/create-soul ${request.personName}`,
    "",
    "# Persona Driver · create-soul 接入合同",
    "",
    `- 目标人物：${request.personName}`,
    `- 目标类型：${request.targetType}`,
    `- 一句话描述：${request.oneLineDescription}`,
    `- 采集方式：${request.sourceMode}`,
    `- 输出目录：${request.outputDir}`,
    "",
    "## 允许读取的输入",
    "",
    "只读取以下精确列出的素材路径，或以下明确允许的公开 URL。禁止 find、目录遍历、扩展到 vault、用户主目录或其他未列出的路径。",
    ...sourceLines,
    "",
    "## 隐私与纯化",
    "",
    `- 用户确认的采集范围：${request.collectionScope.scopeText}`,
    `- 明确排除：${request.collectionScope.exclusionsText || "未填写；仍不得读取无关内容"}`,
    `- 会议/群聊发言人纯化：${request.collectionScope.speakerPurificationRequired ? "已要求，必须只保留目标人物发言或标注 speaker 未确认" : "无混合发言素材声明"}`,
    "",
    "## 必须执行的流程",
    "",
    "完成 create-soul Step 1–5：确认人物、采集素材、3-Pass 蒸馏、组装完整 Soul Skill、完整性与还原度验证。不要把单篇摘要当作 Soul。",
    "Step 6 安装到 YouNavi 前必须停下，向用户展示素材清单、来源溯源、覆盖率、隐私边界和验证 checklist；只有用户明确确认后才能执行安装。",
    "这是交互式 Skill；如需要用户回答，必须在当前 task 对应的 YouNavi conversation 中提问，不得后台假装完成。",
    "",
    "## 回执",
    "",
    "每次阶段更新都返回 runId、taskId、conversationId、outputDir 和阶段：collecting / distilling / assembling / validating / ready / error。",
  ].join("\n");
}

async function resolveSoulInputPaths(request, directory, materialRoot) {
  const paths = [];
  for (const sourcePath of request.exactMaterialPaths) {
    try {
      await access(sourcePath);
      paths.push(sourcePath);
    } catch {
      throw new PersonaSoulError(`所选素材不可读：${sourcePath}`, { code: "SOURCE_MISSING", status: 409 });
    }
  }
  if (request.fixedMaterialIds.length > 0) {
    if (!materialRoot) throw new PersonaSoulError("Bridge 未配置固定素材目录", { code: "INVALID_SOUL_CONFIG", status: 503 });
    const inspected = await inspectSourceMaterials(materialRoot);
    for (const materialId of request.fixedMaterialIds) {
      const material = inspected[materialId];
      if (!material?.available) throw new PersonaSoulError(`固定素材不可读：${materialId}`, { code: "SOURCE_MISSING", status: 409 });
      paths.push(material.path);
    }
  }
  if (request.uploadedMaterials.length > 0) {
    const uploadRoot = path.join(directory, "inputs");
    await mkdir(uploadRoot, { recursive: true });
    for (const [index, material] of request.uploadedMaterials.entries()) {
      const file = path.join(uploadRoot, `${String(index + 1).padStart(2, "0")}-${material.name}`);
      await writeFile(file, material.content, { encoding: "utf8", flag: "wx" }).catch(async (error) => {
        if (error?.code !== "EEXIST") throw error;
        const existing = await readFile(file, "utf8");
        if (existing !== material.content) throw new PersonaSoulError(`上传素材快照冲突：${material.name}`, { code: "SOUL_INPUT_CONFLICT", status: 409 });
      });
      paths.push(file);
    }
  }
  return [...new Set(paths)];
}

function redactUploadedMaterial(material) {
  return {
    id: material.id,
    name: material.name,
    size: material.size,
    mimeType: material.mimeType,
    sha256: material.sha256,
    wordCount: material.wordCount,
  };
}

function taskStatus(data) {
  const task = data?.task && typeof data.task === "object" ? data.task : data;
  return String(task?.status ?? data?.status ?? task?.state ?? data?.state ?? "running").toLowerCase();
}

export function inferSoulStage({ status = "running", text = "" } = {}) {
  const normalized = String(text).toLowerCase();
  for (const stage of ["error", "ready", "validating", "assembling", "distilling", "collecting"]) {
    if (normalized.includes(`[${stage}]`) || normalized.includes(stage)) return stage;
  }
  if (["error", "failed", "cancelled", "canceled"].includes(String(status).toLowerCase())) return "error";
  if (["success", "completed", "complete", "finished"].includes(String(status).toLowerCase())) return "ready";
  return "collecting";
}

function stageSummary(stage) {
  return Object.fromEntries(PERSONA_SOUL_STAGES.map((item) => [item, item === stage ? "active" : PERSONA_SOUL_STAGES.indexOf(item) < PERSONA_SOUL_STAGES.indexOf(stage) ? "complete" : "pending"]));
}

async function readJson(file, { required = true } = {}) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (!required && error?.code === "ENOENT") return null;
    throw new PersonaSoulError("Soul Run 本地记录缺失或损坏", { code: "INVALID_SOUL_RECORD", status: 409 });
  }
}

async function writeJsonAtomic(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

function cliData(result, operation) {
  if (!result?.success) throw new PersonaSoulError(result?.error || `${operation}失败`, { code: result?.code || "NAVI_CLI_ERROR", status: result?.code === "AUTH_REQUIRED" ? 401 : 502 });
  return result.data ?? {};
}

export function createPersonaSoulRunService({
  runRoot,
  workspaceRoot = process.cwd(),
  skillsDir,
  materialRoot,
  resolveCli = resolveAgentCli,
  runCli = execAgentCli,
  prepareRuntime = prepareYouNaviRuntime,
} = {}) {
  if (!runRoot) throw new PersonaSoulError("缺少 runRoot", { code: "INVALID_SOUL_CONFIG" });
  const inFlight = new Map();

  async function createRun(payload) {
    const request = validatePersonaSoulRequest(payload);
    if (inFlight.has(request.runId)) return inFlight.get(request.runId);
    const work = (async () => {
      const directory = path.join(runRoot, request.runId);
      const requestPath = path.join(directory, "request.json");
      const receiptPath = path.join(directory, "receipt.json");
      const existing = await readJson(receiptPath, { required: false });
      if (existing?.ok && existing.runId === request.runId) return { ...existing, idempotent: true };
      if (await readJson(requestPath, { required: false })) throw new PersonaSoulError("这次 Soul Run 已发送但缺少回执，为避免重复创建 conversation 不会重发", { code: "SOUL_CREATION_UNKNOWN", status: 409 });
      await mkdir(directory, { recursive: true });
      if (!skillsDir) throw new PersonaSoulError("Bridge 未配置 YouNavi Skill 目录", { code: "INVALID_SOUL_CONFIG", status: 503 });
      const createSoul = await inspectCreateSoulSkill(skillsDir);
      if (!createSoul.installed) throw new PersonaSoulError(`YouNavi 未安装 create-soul：${createSoul.error || createSoul.skillPath}`, { code: "CREATE_SOUL_SKILL_MISSING", status: 409 });
      const outputPath = path.resolve(workspaceRoot, request.outputDir);
      await mkdir(outputPath, { recursive: true });
      const exactMaterialPaths = await resolveSoulInputPaths(request, directory, materialRoot);
      const resolvedRequest = { ...request, exactMaterialPaths };
      const prompt = renderCreateSoulPrompt(resolvedRequest);
      const title = `CREATE SOUL · ${request.personName}`.slice(0, 100);
      const cli = await prepareRuntime({ resolveCli, runCli });
      await writeJsonAtomic(requestPath, {
        ...resolvedRequest,
        uploadedMaterials: request.uploadedMaterials.map(redactUploadedMaterial),
        prompt,
        title,
        outputPath,
        createdAt: new Date().toISOString(),
      });
      const data = cliData(await runCli(cli, ["--no-auto-start", "--format", "json", "chat", "send", prompt, "--task-type", "chat", "--source", "persona-driver-create-soul", "--title", title]), "创建 create-soul conversation");
      if (!data.task_id || !data.conversation_id) throw new PersonaSoulError("Navi 回执缺少 task_id / conversation_id", { code: "INVALID_SOUL_RECEIPT", status: 502 });
      const receipt = {
        ok: true,
        schema: PERSONA_SOUL_RECEIPT_SCHEMA,
        runId: request.runId,
        taskId: data.task_id,
        conversationId: data.conversation_id,
        stage: "collecting",
        stages: stageSummary("collecting"),
        outputDir: request.outputDir,
        outputSlug: request.outputSlug,
        personName: request.personName,
        interactive: true,
        requiresUserConversation: true,
        createdAt: new Date().toISOString(),
      };
      await writeJsonAtomic(receiptPath, receipt);
      return receipt;
    })();
    inFlight.set(request.runId, work);
    try { return await work; } finally { inFlight.delete(request.runId); }
  }

  async function readRun(runId) {
    const receipt = await readJson(path.join(runRoot, runId, "receipt.json"));
    if (!receipt?.ok || !receipt.taskId || !receipt.conversationId) throw new PersonaSoulError("Soul Run 回执不完整", { code: "INVALID_SOUL_RECORD", status: 409 });
    const cli = await resolveCli();
    const task = cliData(await runCli(cli, ["--no-auto-start", "--format", "json", "task", "show", receipt.taskId]), "查询 create-soul 任务");
    const status = taskStatus(task);
    if (["error", "failed", "cancelled", "canceled"].includes(status)) return { ...receipt, stage: "error", stages: stageSummary("error"), error: task?.error || task?.message || "create-soul 任务失败" };
    const conversation = cliData(await runCli(cli, ["--no-auto-start", "--format", "json", "convo", "show", receipt.conversationId, "--no-paged"]), "读取 create-soul conversation");
    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    const latestText = messages.filter((item) => typeof item?.content === "string").map((item) => item.content).at(-1) || "";
    const request = await readJson(path.join(runRoot, runId, "request.json"));
    try {
      const projection = await readSoulArtifactForProjection({
        soulPath: request.outputPath,
        skillsDir,
        slug: request.outputSlug,
        personName: request.personName,
        oneLineDescription: request.oneLineDescription,
      });
      return {
        ...receipt,
        stage: "ready",
        stages: stageSummary("ready"),
        readyForUserConfirmation: true,
        projection,
      };
    } catch (artifactError) {
      const inferred = inferSoulStage({ status, text: latestText });
      const asksForInput = /请|确认|选择|提供|回答|补充|是否|\?|？/u.test(latestText);
      const stage = inferred === "ready" ? (asksForInput ? "collecting" : "validating") : inferred;
      if (stage === "error") return { ...receipt, stage, stages: stageSummary(stage), error: latestText || String(artifactError?.message || "Soul 任务失败") };
      return {
        ...receipt,
        stage,
        stages: stageSummary(stage),
        artifactPending: true,
        needsUserInput: asksForInput,
        detail: asksForInput ? "请在对应 YouNavi conversation 中继续回答 create-soul 的交互问题。" : String(artifactError?.message || "等待 Soul 产物完成"),
      };
    }
  }

  return { createRun, readRun };
}

export function parseSkillFrontmatter(markdown) {
  const body = String(markdown || "");
  if (!body.startsWith("---\n") && !body.startsWith("---\r\n")) throw new PersonaSoulError("SKILL.md 缺少 YAML frontmatter", { code: "INVALID_SOUL_ARTIFACT" });
  const end = body.search(/\r?\n---\s*(?:\r?\n|$)/);
  if (end < 0) throw new PersonaSoulError("SKILL.md frontmatter 未闭合", { code: "INVALID_SOUL_ARTIFACT" });
  const frontmatter = body.slice(4, end);
  const get = (key) => {
    const line = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() || "";
    return line.replace(/^['"]|['"]$/g, "");
  };
  const name = get("name");
  const description = get("description");
  if (!name || !description) throw new PersonaSoulError("SKILL.md 必须包含 name 与 description", { code: "INVALID_SOUL_ARTIFACT" });
  return { name, description };
}

export function countSoulSources(markdown) {
  return (String(markdown || "").match(/^\s*(?:[-*]|\d+\.)\s+.+$/gm) || []).length;
}

function extractCoverageWarning(markdown) {
  const line = String(markdown || "").split(/\r?\n/).find((item) => /覆盖不足|coverage\s+warning/i.test(item));
  return line ? line.replace(/^\s*(?:[-*]|\d+\.)?\s*/, "").replace(/^[^：:]+[：:]\s*/, "").trim() || line.trim() : null;
}

function extractRole(markdown) {
  const line = String(markdown || "").match(/^\s*(?:[-*]\s*)?(?:角色|当前角色|现在做什么|身份信息)\s*[：:]\s*(.+)$/m)?.[1];
  return line?.trim() || "AI 人物分身";
}

export async function inspectInstalledSoulSkill({ skillsDir, slug }) {
  const skillName = `${normalizeSoulSlug(slug)}-chat`;
  const skillPath = path.join(skillsDir, `${normalizeSoulSlug(slug)}-soul`, "SKILL.md");
  try {
    const body = await readFile(skillPath, "utf8");
    const frontmatter = parseSkillFrontmatter(body);
    const fileVerified = frontmatter.name === skillName;
    return {
      verified: false,
      fileVerified,
      indexStatus: "unconfirmed",
      skillPath,
      skillName,
      sha256: createHash("sha256").update(body).digest("hex"),
      error: fileVerified
        ? "本地 Skill 文件与 frontmatter 已验证，但动态 Skill 索引未确认，当前保持未映射"
        : "Skill name 与 slug-chat 不一致",
    };
  } catch (error) {
    return { verified: false, fileVerified: false, indexStatus: "unconfirmed", skillPath, skillName, sha256: null, error: String(error?.message || "已安装 Skill 不可读") };
  }
}

export async function inspectCreateSoulSkill(skillsDir) {
  const skillPath = path.join(skillsDir, "create-soul", "SKILL.md");
  try {
    const body = await readFile(skillPath, "utf8");
    const frontmatter = parseSkillFrontmatter(body);
    return {
      installed: frontmatter.name === "create-soul",
      skillName: frontmatter.name,
      skillPath,
      sha256: createHash("sha256").update(body).digest("hex"),
      error: frontmatter.name === "create-soul" ? null : "SKILL.md name 不是 create-soul",
    };
  } catch (error) {
    return { installed: false, skillName: "create-soul", skillPath, sha256: null, error: String(error?.message || "create-soul 不可读") };
  }
}

export async function readSoulArtifactForProjection({ soulPath, skillsDir, slug, personName, oneLineDescription, templateId = "male", announcerName } = {}) {
  const root = path.resolve(soulPath);
  const files = Object.fromEntries(await Promise.all(SOUL_REQUIRED_FILES.map(async (relative) => [relative, await readFile(path.join(root, relative), "utf8").catch(() => null)])));
  const missing = SOUL_REQUIRED_FILES.filter((relative) => !files[relative]?.trim());
  if (missing.length) throw new PersonaSoulError(`Soul 产物不完整，缺少：${missing.join(", ")}`, { code: "SOUL_ARTIFACT_INCOMPLETE", status: 409 });
  const skillFrontmatter = parseSkillFrontmatter(files["SKILL.md"]);
  const normalizedSlug = normalizeSoulSlug(slug);
  const expectedSkillName = `${normalizedSlug}-chat`;
  if (skillFrontmatter.name !== expectedSkillName) throw new PersonaSoulError(`Soul SKILL.md name 必须是 ${expectedSkillName}`, { code: "SOUL_ARTIFACT_INCOMPLETE", status: 409 });
  const knowledgeFiles = await readdir(path.join(root, "_knowledge"), { withFileTypes: true }).catch(() => []);
  const knowledgeCount = knowledgeFiles.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).length;
  if (knowledgeCount < SOUL_MIN_KNOWLEDGE_FILES) throw new PersonaSoulError(`Soul 产物至少需要 ${SOUL_MIN_KNOWLEDGE_FILES} 个 _knowledge 主题文件`, { code: "SOUL_ARTIFACT_INCOMPLETE", status: 409 });
  const iconicQuoteCount = countSoulSources(files["_quotes/iconic.md"]);
  if (iconicQuoteCount < SOUL_MIN_ICONIC_QUOTES) throw new PersonaSoulError(`Soul 产物至少需要 ${SOUL_MIN_ICONIC_QUOTES} 条代表性引语`, { code: "SOUL_ARTIFACT_INCOMPLETE", status: 409 });
  const sourceCount = countSoulSources(files["_meta/sources.md"]);
  if (sourceCount === 0) throw new PersonaSoulError("Soul _meta/sources.md 没有可追溯来源", { code: "SOUL_ARTIFACT_INCOMPLETE", status: 409 });
  const installation = await inspectInstalledSoulSkill({ skillsDir, slug });
  return {
    personName: cleanText(personName, { name: "人物姓名", max: 80 }),
    oneLineDescription: cleanText(oneLineDescription, { name: "一句话描述", max: 240 }),
    role: extractRole(files["_persona/rules.md"]),
    announcerName: announcerName?.trim() || personName.trim(),
    slug: normalizedSlug,
    soulPath: root,
    sourceCount,
    coverageWarning: extractCoverageWarning(files["_meta/sources.md"])
      || (sourceCount < 5 ? `来源覆盖不足：当前 ${sourceCount} 个来源，建议至少 5 个来源或累计 1 万字。` : null),
    skillFrontmatter,
    installVerification: installation,
    templateId,
    artifactValidation: { complete: true, knowledgeCount, iconicQuoteCount },
  };
}
