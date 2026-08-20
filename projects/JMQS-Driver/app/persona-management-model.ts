import {
  ROD_MAX_DOCUMENT_NAME_CHARS,
  ROD_MAX_PROMPT_CHARS,
  REMOVED_NORMAL_PROMPT_MESSAGE,
  SKILL_PROMPT_PRESETS,
  validateCustomPrompt,
  validateDocumentContent,
  type DocumentContent,
  type SkillPresetId,
} from "./rod-content-model";

export type PersonaManagementSection = "prompts" | "cards" | "diagnostics" | "materials";
export type ManagedPromptSource = "builtin" | "custom";

export const PERSONA_PROMPT_STORAGE_KEY = "persona-driver.prompt-presets.v1";
export const PERSONA_PROMPT_STORAGE_SCHEMA = "persona-driver.prompt-presets/v1";
export const PERSONA_MATERIAL_STORAGE_KEY = "persona-driver.custom-materials.v1";
export const PERSONA_MATERIAL_STORAGE_SCHEMA = "persona-driver.custom-materials/v1";
export const PERSONA_ACTIVATION_HISTORY_KEY = "persona-driver.activation-history.v1";
export const PERSONA_MANAGEMENT_MAX_PROMPT_NAME_CHARS = 80;

export interface ManagedPrompt {
  id: string;
  source: ManagedPromptSource;
  presetId: SkillPresetId;
  code: string;
  label: string;
  description: string;
  prompt: string;
  sections: string[];
}

export interface CustomPromptStorageRecord {
  schema: typeof PERSONA_PROMPT_STORAGE_SCHEMA;
  version: 1;
  prompts: ManagedPrompt[];
  warnings?: string[];
}

export interface PersonaManagementMaterial {
  id: string;
  name: string;
  meta: string;
  source: "builtin" | "custom";
  size?: number;
  summary?: string;
  content?: string;
  extension?: DocumentContent["extension"];
  mimeType?: DocumentContent["mimeType"];
  lastUsedAt?: string | null;
}

export interface CustomMaterialStorageRecord {
  schema: typeof PERSONA_MATERIAL_STORAGE_SCHEMA;
  version: 1;
  materials: PersonaManagementMaterial[];
}

export const DEFAULT_FIXED_MATERIALS: readonly PersonaManagementMaterial[] = Object.freeze([
  { id: "jobs-gates-d5", name: "乔布斯盖茨 D5 大会对话", meta: "100 KB · 乔布斯 × 盖茨", source: "builtin" },
  { id: "jobs-1990", name: "乔布斯访谈 1990", meta: "59 KB · Steve Jobs", source: "builtin" },
  { id: "gates-ted", name: "比尔·盖茨 TED Interview", meta: "45 KB · Bill Gates", source: "builtin" },
  { id: "liang-alive", name: "梁文道《活着（二）》", meta: "28 KB · 梁文道", source: "builtin" },
]);

export const BUILTIN_MANAGED_PROMPTS: readonly ManagedPrompt[] = Object.freeze(
  SKILL_PROMPT_PRESETS.map((preset) => ({
    id: preset.id,
    source: "builtin" as const,
    presetId: preset.id,
    code: preset.code,
    label: preset.label,
    description: preset.description,
    prompt: preset.prompt,
    sections: [...preset.sections],
  })),
);

export function createCustomPromptId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `custom-prompt-${Date.now().toString(36)}-${random}`.toLowerCase();
}

export function validatePromptName(value: unknown): string {
  const name = String(value ?? "").replace(/\0/g, "").trim();
  if (!name) throw new Error("Prompt 名称不能为空");
  if (name.length > PERSONA_MANAGEMENT_MAX_PROMPT_NAME_CHARS) throw new Error(`Prompt 名称不能超过 ${PERSONA_MANAGEMENT_MAX_PROMPT_NAME_CHARS} 字符`);
  return name;
}

export function createCustomPrompt(input: { label: unknown; prompt: unknown; id?: string }): ManagedPrompt {
  const label = validatePromptName(input.label);
  const prompt = validateCustomPrompt(input.prompt);
  return {
    id: input.id ?? createCustomPromptId(),
    source: "custom",
    presetId: "custom",
    code: "CUSTOM",
    label,
    description: "本机自定义 Prompt",
    prompt,
    sections: ["自定义回答"],
  };
}

export function emptyCustomPromptStorage(): CustomPromptStorageRecord {
  return { schema: PERSONA_PROMPT_STORAGE_SCHEMA, version: 1, prompts: [], warnings: [] };
}

export function readCustomPromptStorage(storage: Storage | null | undefined): CustomPromptStorageRecord {
  if (!storage) return emptyCustomPromptStorage();
  try {
    const value: unknown = JSON.parse(storage.getItem(PERSONA_PROMPT_STORAGE_KEY) ?? "null");
    if (!isRecord(value) || value.schema !== PERSONA_PROMPT_STORAGE_SCHEMA || value.version !== 1 || !Array.isArray(value.prompts)) return emptyCustomPromptStorage();
    const removedNormal = value.prompts.some((entry) => isRecord(entry) && (entry.id === "normal" || entry.presetId === "normal"));
    const prompts = value.prompts.map((entry) => {
      if (!isRecord(entry)) return null;
      if (entry.id === "normal" || entry.presetId === "normal") return null;
      try {
        return createCustomPrompt({ id: stringValue(entry.id) || undefined, label: entry.label, prompt: entry.prompt });
      } catch {
        return null;
      }
    }).filter((entry): entry is ManagedPrompt => entry !== null);
    return { schema: PERSONA_PROMPT_STORAGE_SCHEMA, version: 1, prompts, warnings: removedNormal ? [REMOVED_NORMAL_PROMPT_MESSAGE] : [] };
  } catch {
    return emptyCustomPromptStorage();
  }
}

export function persistCustomPromptStorage(storage: Storage | null | undefined, record: CustomPromptStorageRecord): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PERSONA_PROMPT_STORAGE_KEY, JSON.stringify({
      schema: PERSONA_PROMPT_STORAGE_SCHEMA,
      version: 1,
      prompts: record.prompts.filter((prompt) => prompt.source === "custom").map((prompt) => createCustomPrompt(prompt)),
    } satisfies CustomPromptStorageRecord));
    return true;
  } catch {
    return false;
  }
}

export function createCustomMaterial(input: { id?: string; name: string; content: string; size: number; mimeType?: string; lastUsedAt?: string | null }): PersonaManagementMaterial {
  const mimeType = input.mimeType === "text/markdown" || input.mimeType === "text/plain" ? input.mimeType : undefined;
  const document = validateDocumentContent({
    name: input.name,
    content: input.content,
    size: input.size,
    mimeType,
  });
  return {
    id: input.id ?? createCustomMaterialId(),
    name: document.name,
    meta: `${formatBytes(document.size)} · 本机素材`,
    source: "custom",
    size: document.size,
    summary: document.summary,
    content: document.content,
    extension: document.extension,
    mimeType: document.mimeType,
    lastUsedAt: input.lastUsedAt ?? null,
  };
}

export function renameCustomMaterial(material: PersonaManagementMaterial, name: unknown): PersonaManagementMaterial {
  const content = material.content;
  const size = material.size;
  if (material.source !== "custom" || !content || size === undefined) throw new Error("固定素材不可重命名");
  return createCustomMaterial({ id: material.id, name: String(name), content, size, mimeType: material.mimeType, lastUsedAt: material.lastUsedAt });
}

export function createCustomMaterialId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `custom-material-${Date.now().toString(36)}-${random}`.toLowerCase();
}

export function emptyCustomMaterialStorage(): CustomMaterialStorageRecord {
  return { schema: PERSONA_MATERIAL_STORAGE_SCHEMA, version: 1, materials: [] };
}

export function readCustomMaterialStorage(storage: Storage | null | undefined): CustomMaterialStorageRecord {
  if (!storage) return emptyCustomMaterialStorage();
  try {
    const value: unknown = JSON.parse(storage.getItem(PERSONA_MATERIAL_STORAGE_KEY) ?? "null");
    if (!isRecord(value) || value.schema !== PERSONA_MATERIAL_STORAGE_SCHEMA || value.version !== 1 || !Array.isArray(value.materials)) return emptyCustomMaterialStorage();
    const materials = value.materials.map((entry) => {
      if (!isRecord(entry)) return null;
      try {
        return createCustomMaterial({
          id: stringValue(entry.id) || undefined,
          name: stringValue(entry.name),
          content: stringValue(entry.content),
          size: numberValue(entry.size),
          mimeType: stringValue(entry.mimeType),
          lastUsedAt: typeof entry.lastUsedAt === "string" ? entry.lastUsedAt : null,
        });
      } catch {
        return null;
      }
    }).filter((entry): entry is PersonaManagementMaterial => entry !== null);
    return { schema: PERSONA_MATERIAL_STORAGE_SCHEMA, version: 1, materials };
  } catch {
    return emptyCustomMaterialStorage();
  }
}

export function persistCustomMaterialStorage(storage: Storage | null | undefined, record: CustomMaterialStorageRecord): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PERSONA_MATERIAL_STORAGE_KEY, JSON.stringify({
      schema: PERSONA_MATERIAL_STORAGE_SCHEMA,
      version: 1,
      materials: record.materials.filter((material) => material.source === "custom"),
    } satisfies CustomMaterialStorageRecord));
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  return `${Math.ceil(size / 1024)} KB`;
}

export const MANAGEMENT_DOCUMENT_LIMITS = Object.freeze({
  maxBytes: 1024 * 1024,
  maxNameChars: ROD_MAX_DOCUMENT_NAME_CHARS,
  maxPromptChars: ROD_MAX_PROMPT_CHARS,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number.NaN;
}
