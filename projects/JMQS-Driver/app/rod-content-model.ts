export const ROD_MAX_DOCUMENT_BYTES = 1024 * 1024;
export const ROD_MAX_PROMPT_CHARS = 4000;
export const ROD_MAX_DOCUMENT_NAME_CHARS = 255;
export const ROD_BRIDGE_SCHEMA = "persona.navi-run/v2" as const;
export const REMOVED_NORMAL_PROMPT_MESSAGE = "该预设已移除，请重新选择";

export type RodKind = "energy" | "skill";
export type RodStatus = "empty" | "draft" | "charged" | "equipped" | "error";
export type SkillPresetId = "review" | "explain" | "decision" | "action" | "custom";
export type EnergySourceType = "fixed" | "document";
export type SkillSourceType = "preset" | "custom";
export type RodSourceType = EnergySourceType | SkillSourceType;

export type FixedMaterialId = "jobs-gates-d5" | "jobs-1990" | "gates-ted" | "liang-alive";

export interface FixedMaterialContent {
  kind: "fixed-material";
  sourceType: "fixed";
  id: FixedMaterialId;
  name: string;
  meta: string;
}

export const MATERIAL_PRESETS: readonly FixedMaterialContent[] = Object.freeze([
  { kind: "fixed-material", sourceType: "fixed", id: "jobs-gates-d5", name: "乔布斯盖茨 D5 大会对话", meta: "100 KB · 乔布斯 × 盖茨" },
  { kind: "fixed-material", sourceType: "fixed", id: "jobs-1990", name: "乔布斯访谈 1990", meta: "59 KB · Steve Jobs" },
  { kind: "fixed-material", sourceType: "fixed", id: "gates-ted", name: "比尔·盖茨 TED Interview", meta: "45 KB · Bill Gates" },
  { kind: "fixed-material", sourceType: "fixed", id: "liang-alive", name: "梁文道《活着（二）》", meta: "28 KB · 梁文道" },
]);

export interface SkillPromptPreset {
  id: SkillPresetId;
  code: string;
  label: string;
  description: string;
  prompt: string;
  sections: string[];
}

export const SKILL_PROMPT_PRESETS: readonly SkillPromptPreset[] = Object.freeze([
  {
    id: "review",
    code: "REVIEW",
    label: "评审",
    description: "检查方案是否成立、风险在哪里。",
    prompt: "评审当前方案，指出成立条件、明显风险和需要补证的部分。",
    sections: ["结论", "成立条件", "风险", "证据与未知"],
  },
  {
    id: "explain",
    code: "EXPLAIN",
    label: "解释",
    description: "补齐背景、关键概念与因果链。",
    prompt: "补齐背景、关键概念、因果链和历史逻辑。",
    sections: ["重新定义", "背景与逻辑", "关键判断", "证据与未知"],
  },
  {
    id: "decision",
    code: "DECISION",
    label: "决策",
    description: "比较方案、代价与不可逆风险。",
    prompt: "比较可选方案、代价和不可逆风险，并给出明确建议。",
    sections: ["建议", "方案比较", "代价", "下一判断点"],
  },
  {
    id: "action",
    code: "ACTION",
    label: "行动",
    description: "把判断整理成下一步和验收标准。",
    prompt: "整理可执行的下一步、负责人、验收标准与风险。",
    sections: ["判断", "行动", "风险", "证据"],
  },
]);

export interface DocumentContent {
  kind: "document";
  sourceType: "document";
  name: string;
  extension: ".md" | ".txt";
  mimeType: "text/markdown" | "text/plain";
  size: number;
  content: string;
  summary: string;
}

export interface PromptContent {
  kind: "prompt";
  presetId: SkillPresetId;
  label: string;
  code: string;
  prompt: string;
  sections: string[];
}

export type RodContent = FixedMaterialContent | DocumentContent | PromptContent;

export interface RodContentState {
  kind: RodKind;
  status: RodStatus;
  sourceType: RodSourceType | null;
  draft: RodContent | null;
  charged: RodContent | null;
  equipped: boolean;
  error: string | null;
}

export interface RodCardInfo {
  kind: RodKind;
  status: RodStatus;
  code: string;
  label: string;
  description: string;
  payloadLabel: string | null;
  payloadMeta: string | null;
  error: string | null;
  canEquip: boolean;
}

export interface PersonaNaviRodRequest {
  schema: "persona.navi-run/v1" | typeof ROD_BRIDGE_SCHEMA;
  runId: string;
  personaId: string;
  task: string;
  commandId: SkillPresetId;
  customPrompt?: string;
  materials: FixedMaterialId[];
  document?: {
    name: string;
    mimeType: DocumentContent["mimeType"];
    size: number;
    content: string;
    summary: string;
  };
}

export class RodContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RodContentError";
  }
}

function cleanText(value: unknown, name: string, max: number): string {
  const text = String(value ?? "").replace(/\0/g, "").trim();
  if (!text) throw new RodContentError(`${name}不能为空`);
  if (text.length > max) throw new RodContentError(`${name}不能超过 ${max} 字符`);
  return text;
}

function extensionFor(name: string): DocumentContent["extension"] {
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (extension !== ".md" && extension !== ".txt") {
    throw new RodContentError("能量棒只接受 .md 或 .txt 文件");
  }
  return extension;
}

function mimeTypeFor(extension: DocumentContent["extension"], value: string): DocumentContent["mimeType"] {
  const mimeType = value.trim().toLowerCase().split(";", 1)[0];
  if (mimeType && mimeType !== "text/plain" && mimeType !== "text/markdown") {
    throw new RodContentError("文件 MIME 类型必须是 text/plain 或 text/markdown");
  }
  return extension === ".md" ? "text/markdown" : "text/plain";
}

export function summarizeDocument(content: string, maxChars = 160): string {
  const normalized = content.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean).join(" ");
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars - 1)}…` : normalized;
}

export function validateCustomPrompt(value: unknown): string {
  return cleanText(value, "自定义 Prompt", ROD_MAX_PROMPT_CHARS);
}

export function validateDocumentContent(document: Partial<DocumentContent>): DocumentContent {
  const name = cleanText(document.name, "文件名", ROD_MAX_DOCUMENT_NAME_CHARS);
  if (name.includes("/") || name.includes("\\") || name === "." || name === "..") {
    throw new RodContentError("文件名不能包含路径或目录穿越字符");
  }
  const extension = extensionFor(name);
  const mimeType = mimeTypeFor(extension, String(document.mimeType ?? ""));
  if (typeof document.content !== "string") throw new RodContentError("文档内容必须是文本");
  const rawContent = document.content;
  if (rawContent.includes("\0")) throw new RodContentError("文档内容包含非法控制字符");
  if (!rawContent.trim()) throw new RodContentError("文档内容不能为空");
  if (rawContent.length > ROD_MAX_DOCUMENT_BYTES) throw new RodContentError("文档不能超过 1 MiB");
  const size = Number(document.size);
  const actualSize = new TextEncoder().encode(rawContent).byteLength;
  if (!Number.isSafeInteger(size) || size !== actualSize) {
    throw new RodContentError("文件大小与文档内容不一致");
  }
  if (actualSize > ROD_MAX_DOCUMENT_BYTES) throw new RodContentError("文件不能超过 1 MiB");
  return { kind: "document", sourceType: "document", name, extension, mimeType, size: actualSize, content: rawContent, summary: summarizeDocument(rawContent) };
}

export async function readDocumentFile(file: Pick<File, "name" | "size" | "type" | "arrayBuffer">): Promise<DocumentContent> {
  if (file.size > ROD_MAX_DOCUMENT_BYTES) throw new RodContentError("文件不能超过 1 MiB");
  const extension = extensionFor(file.name);
  const mimeType = mimeTypeFor(extension, file.type);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size) throw new RodContentError("无法确认文件大小");
  if (bytes.byteLength > ROD_MAX_DOCUMENT_BYTES) throw new RodContentError("文件不能超过 1 MiB");
  const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return validateDocumentContent({ name: file.name, mimeType, size: bytes.byteLength, content });
}

export function createEmptyRodState(kind: RodKind): RodContentState {
  return { kind, status: "empty", sourceType: null, draft: null, charged: null, equipped: false, error: null };
}

export function setRodDraft(state: RodContentState, draft: RodContent | null): RodContentState {
  return { ...state, status: draft ? "draft" : "empty", sourceType: draft ? sourceTypeForContent(draft) : null, draft, charged: null, equipped: false, error: null };
}

export function chargeRod(state: RodContentState): RodContentState {
  if (!state.draft) throw new RodContentError("请先准备内容");
  if (state.kind === "energy" && state.draft.kind !== "fixed-material" && state.draft.kind !== "document") {
    throw new RodContentError("能量棒必须选择一个固定素材或导入一份自定义文档");
  }
  if (state.kind === "skill" && state.draft.kind !== "prompt") throw new RodContentError("技能棒必须装载 Prompt");
  return { ...state, status: "charged", sourceType: sourceTypeForContent(state.draft), charged: state.draft, equipped: false, error: null };
}

export function equipRod(state: RodContentState): RodContentState {
  if (state.status !== "charged" || !state.charged) throw new RodContentError("只有充能完成的棒可以装配");
  return { ...state, status: "equipped", equipped: true, error: null };
}

export function errorRod(state: RodContentState, error: unknown): RodContentState {
  return { ...state, status: "error", error: String(error instanceof Error ? error.message : error || "内容无效") };
}

export function migrateRodState(state: RodContentState): RodContentState {
  const hasRemovedNormal = [state.draft, state.charged].some((content) => (
    content?.kind === "prompt" && (content as { presetId?: string }).presetId === "normal"
  ));
  if (!hasRemovedNormal) return state;
  return { ...createEmptyRodState(state.kind), error: REMOVED_NORMAL_PROMPT_MESSAGE };
}

export function promptContentForPreset(id: SkillPresetId, customPrompt = ""): PromptContent {
  if (id === "custom") {
    return { kind: "prompt", presetId: id, code: "CUSTOM", label: "自定义", prompt: validateCustomPrompt(customPrompt), sections: ["自定义回答"] };
  }
  const preset = SKILL_PROMPT_PRESETS.find((item) => item.id === id);
  if (!preset) throw new RodContentError("技能 Prompt 不在白名单");
  return { kind: "prompt", presetId: preset.id, code: preset.code, label: preset.label, prompt: preset.prompt, sections: [...preset.sections] };
}

export function customPromptDraft(prompt = ""): PromptContent {
  const value = String(prompt).replace(/\0/g, "").slice(0, ROD_MAX_PROMPT_CHARS);
  return { kind: "prompt", presetId: "custom", code: "CUSTOM", label: "自定义", prompt: value, sections: ["自定义回答"] };
}

export function fixedMaterialContent(id: FixedMaterialId): FixedMaterialContent {
  const material = MATERIAL_PRESETS.find((item) => item.id === id);
  if (!material) throw new RodContentError("固定素材不在白名单");
  return { ...material };
}

function sourceTypeForContent(content: RodContent): RodSourceType {
  if (content.kind === "fixed-material" || content.kind === "document") return content.sourceType;
  return content.presetId === "custom" ? "custom" : "preset";
}

function requiredContent(state: RodContentState, kind: RodKind): RodContent {
  if (state.kind !== kind || !state.charged || !["charged", "equipped"].includes(state.status)) {
    throw new RodContentError(`${kind === "energy" ? "能量棒" : "技能棒"}尚未充能`);
  }
  return state.charged;
}

export function buildPersonaNaviRodRequest(input: {
  runId: string;
  personaId: string;
  task: string;
  energy: RodContentState;
  skill: RodContentState;
}): PersonaNaviRodRequest {
  const energyContent = requiredContent(input.energy, "energy");
  const prompt = requiredContent(input.skill, "skill");
  if ((energyContent.kind !== "fixed-material" && energyContent.kind !== "document") || prompt.kind !== "prompt") throw new RodContentError("棒内容类型不匹配");
  const safePrompt = promptContentForPreset(prompt.presetId, prompt.presetId === "custom" ? prompt.prompt : "");
  const task = cleanText(input.task, "当前任务", 4000);
  const base = {
    runId: cleanText(input.runId, "runId", 80),
    personaId: cleanText(input.personaId, "人物卡", 32),
    task,
    commandId: safePrompt.presetId,
  };
  const request: PersonaNaviRodRequest = energyContent.kind === "fixed-material"
    ? { schema: "persona.navi-run/v1", ...base, materials: [energyContent.id] }
    : (() => {
        const safeDocument = validateDocumentContent(energyContent);
        return {
          schema: ROD_BRIDGE_SCHEMA,
          ...base,
          materials: [],
          document: { name: safeDocument.name, mimeType: safeDocument.mimeType, size: safeDocument.size, content: safeDocument.content, summary: safeDocument.summary },
        };
      })();
  if (safePrompt.presetId === "custom") request.customPrompt = validateCustomPrompt(safePrompt.prompt);
  return request;
}

export function rodCardInfo(state: RodContentState): RodCardInfo {
  const content = state.charged ?? state.draft;
  const energy = state.kind === "energy";
  const prompt = content?.kind === "prompt" ? content : null;
  const document = content?.kind === "document" ? content : null;
  const fixed = content?.kind === "fixed-material" ? content : null;
  return {
    kind: state.kind,
    status: state.status,
    code: energy ? "ENERGY ROD" : prompt?.code ?? "SKILL ROD",
    label: energy ? "能量棒" : prompt?.label ?? "技能棒",
    description: energy ? "注入一份只读原文" : prompt?.prompt ?? "注入一个提问形态",
    payloadLabel: fixed?.name ?? document?.name ?? prompt?.label ?? null,
    payloadMeta: fixed?.meta ?? (document ? Math.ceil(document.size / 1024) + " KB · " + document.extension : prompt ? prompt.prompt : null),
    error: state.error,
    canEquip: state.status === "charged" && Boolean(state.charged),
  };
}
