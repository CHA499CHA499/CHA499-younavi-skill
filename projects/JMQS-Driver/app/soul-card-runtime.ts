import {
  assignRandomPoolArt,
  createCustomPersonaCard,
  persistPersonaCardStorage,
  readPersonaCardStorage,
  upsertPersonaCard,
  type PersonaCard,
  type PersonaRandomPoolManifest,
} from "./persona-card-model";
import {
  projectSoulCard,
  type SoulCardWizardState,
  type SoulCreateRequest,
  type SoulProjectionInput,
} from "./soul-card-model";

export type SoulCardRunStage = "collecting" | "distilling" | "assembling" | "validating" | "ready" | "coverage-warning" | "index-warning" | "error";

export interface SoulCardRunStatus {
  id: string;
  status: SoulCardRunStage;
  label?: string;
  detail?: string;
  coverage?: string;
  taskId?: string;
  conversationId?: string;
}

export type SoulBridgeRequest = (path: string, options?: RequestInit) => Promise<Record<string, unknown>>;

export interface SoulBridgeRunResult {
  card: PersonaCard;
  runId: string;
  taskId: string;
  conversationId: string;
}

export function createSoulClientRunId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 24)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  return `psoul-${random}`.toLowerCase();
}

export function createManualPersonaCard(
  state: SoulCardWizardState,
  storage: Storage | null,
  manifest?: PersonaRandomPoolManifest | null,
): PersonaCard {
  const draft = createCustomPersonaCard({
    name: state.personName.trim(),
    announcerName: state.personName.trim(),
    role: state.oneLineDescription.trim() || "自建角色",
    summary: state.oneLineDescription.trim() || "手动创建的人物卡。",
    color: state.templateId === "female" ? "#c37fa1" : "#6e92bd",
    image: "",
  });
  let card: PersonaCard = {
    ...draft,
    code: "CUSTOM PERSONA",
    tags: [],
    status: "active",
  };
  if (manifest) card = assignRandomPoolArt(card, manifest, storage).card;
  persistPersonaCardOrThrow(storage, card);
  return card;
}

export function createPersonaCardFromSoulProjection(
  input: SoulProjectionInput & { artifactValidation?: { complete?: boolean } },
  storage: Storage | null,
  manifest?: PersonaRandomPoolManifest | null,
): PersonaCard {
  if (!input.artifactValidation?.complete || !input.soulPath || !input.skillFrontmatter?.name || input.sourceCount < 1) {
    throw new Error("Soul 产物尚未通过完整性验证，不能生成完成卡");
  }
  const projection = projectSoulCard(input);
  const mapped = projection.skillMapping.status === "mapped";
  const verifiedAt = mapped ? new Date().toISOString() : undefined;
  const templateId = projection.image.kind === "template" ? projection.image.templateId : "male";
  const projectedImage = projection.image.kind === "user-upload" ? projection.image.path : "";
  let card: PersonaCard = {
    id: projection.id,
    name: projection.name,
    announcerName: projection.announcerName,
    skillName: mapped ? projection.skillName : undefined,
    role: projection.role,
    code: "SOUL PERSONA",
    color: templateId === "female" ? "#c37fa1" : "#6e92bd",
    image: projectedImage,
    summary: projection.oneLineSummary,
    tags: ["Soul"],
    source: "soul",
    status: "active",
    soulPath: projection.soulPath,
    sourceCount: projection.sourceCount,
    coverageWarning: projection.coverageWarning || undefined,
    skillBinding: mapped ? { status: "verified", skillName: projection.skillName, verifiedAt } : { status: "unmapped" },
    skillMapping: mapped ? {
      status: "mapped",
      slug: input.slug,
      skillName: projection.skillName,
      createSoulArtifact: { status: "complete", path: projection.soulPath },
      installedSkill: { status: "verified", name: projection.skillName },
      verifiedAt,
    } : { status: "unmapped", reason: "awaiting-install-verification" },
    artSource: projectedImage ? "uploaded" : "random-pool",
    artAssetId: projectedImage ? `uploaded:${projection.id}` : "",
  };
  if (manifest) card = assignRandomPoolArt(card, manifest, storage).card;
  persistPersonaCardOrThrow(storage, card);
  return card;
}

function persistPersonaCardOrThrow(storage: Storage | null, card: PersonaCard) {
  if (!storage) throw new Error("本机卡片存储不可用，Soul 卡未保存");
  const next = upsertPersonaCard(readPersonaCardStorage(storage), card);
  if (!persistPersonaCardStorage(storage, next)) throw new Error("Soul 卡写入本机卡库失败");
}

export async function executeSoulBridgeRun({
  request,
  bridgeRequest,
  storage,
  manifest,
  onStatus,
  wait = defaultWait,
  pollIntervalMs = 1500,
  maxPolls = 600,
  cancelled = () => false,
}: {
  request: SoulCreateRequest;
  bridgeRequest: SoulBridgeRequest;
  storage: Storage | null;
  manifest?: PersonaRandomPoolManifest | null;
  onStatus?: (status: SoulCardRunStatus) => void;
  wait?: (milliseconds: number) => Promise<void>;
  pollIntervalMs?: number;
  maxPolls?: number;
  cancelled?: () => boolean;
}): Promise<SoulBridgeRunResult> {
  const runId = request.runId || createSoulClientRunId();
  const payload = { ...request, runId };
  if (request.materialCount < 5 && request.totalWordCount < 10_000) {
    onStatus?.({ id: `${runId}-coverage`, status: "coverage-warning", label: request.personName, detail: "素材不足仍可生成基础版，但覆盖率有限。", coverage: `${request.materialCount} 份 / ${request.totalWordCount.toLocaleString()} 字` });
  }
  onStatus?.({ id: runId, status: "collecting", label: request.personName, detail: "正在创建真实 create-soul task 与 conversation。" });
  const receipt = await bridgeRequest("/soul-runs", { method: "POST", body: JSON.stringify(payload) });
  const taskId = requiredString(receipt.taskId, "Bridge 回执缺少 taskId");
  const conversationId = requiredString(receipt.conversationId, "Bridge 回执缺少 conversationId");
  onStatus?.({ id: runId, status: "collecting", label: request.personName, detail: "create-soul conversation 已创建；交互问题会在 YouNavi 中继续。", taskId, conversationId });
  try {
    await bridgeRequest(`/soul-runs/${encodeURIComponent(runId)}/open`, { method: "POST" });
  } catch (error) {
    onStatus?.({ id: runId, status: "collecting", label: request.personName, detail: `任务已创建，但未能自动打开 YouNavi：${String(error instanceof Error ? error.message : error)}`, taskId, conversationId });
  }
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (cancelled()) throw new Error("Soul 向导已关闭；任务仍可在 YouNavi conversation 中继续");
    const result = await bridgeRequest(`/soul-runs/${encodeURIComponent(runId)}`);
    const stage = normalizeStage(result.stage);
    if (stage === "error") throw new Error(requiredString(result.error, "create-soul 任务失败"));
    const projection = result.projection;
    if (projection && typeof projection === "object" && !Array.isArray(projection)) {
      const projectionInput = projection as unknown as SoulProjectionInput & { artifactValidation?: { complete?: boolean } };
      const card = createPersonaCardFromSoulProjection(projectionInput, storage, manifest);
      if (card.coverageWarning) onStatus?.({ id: `${runId}-coverage`, status: "coverage-warning", label: card.name, detail: card.coverageWarning, coverage: `${card.sourceCount ?? 0} 个来源` });
      if (!projectionInput.installVerification.verified) onStatus?.({ id: `${runId}-index`, status: "index-warning", label: card.name, detail: projectionInput.installVerification.error || "动态 Skill 索引未确认，当前保持未映射。", taskId, conversationId });
      onStatus?.({ id: runId, status: "ready", label: card.name, detail: card.skillMapping.status === "mapped" ? "Soul 卡已写入卡库，Skill 安装验证通过。" : "Soul 卡已写入卡库；Skill 尚未通过安装验证，保持未映射。", taskId, conversationId });
      return { card, runId, taskId, conversationId };
    }
    onStatus?.({
      id: runId,
      status: stage,
      label: request.personName,
      detail: typeof result.detail === "string" ? result.detail : "等待 Soul 产物与投影完成。",
      taskId,
      conversationId,
    });
    await wait(pollIntervalMs);
  }
  throw new Error("Soul 提炼等待超时；任务仍可在 YouNavi conversation 中继续");
}

function normalizeStage(value: unknown): Exclude<SoulCardRunStage, "coverage-warning" | "index-warning"> {
  return ["collecting", "distilling", "assembling", "validating", "ready", "error"].includes(String(value))
    ? String(value) as Exclude<SoulCardRunStage, "coverage-warning" | "index-warning">
    : "collecting";
}

function requiredString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(fallback);
}

function defaultWait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
