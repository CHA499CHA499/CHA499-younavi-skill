export const SOUL_CARD_WIZARD_SCHEMA = "persona-driver.soul-card-wizard/v1" as const;
export const SOUL_CARD_PROJECTION_SCHEMA = "persona-driver.soul-card-projection/v1" as const;
export const SOUL_BRIDGE_SCHEMA = "persona.soul-run/v1" as const;
export const SOUL_OUTPUT_ROOT = "outputs/persona-souls" as const;
export const SOUL_MIN_MATERIALS = 5;
export const SOUL_MIN_WORDS = 10_000;

export type SoulWizardMode = "manual" | "from-soul";
export type SoulTargetType = "self" | "other";
export type SoulSourceMode = "selected-materials" | "uploaded-files" | "younavi-context" | "public-research";
export type SoulMaterialType = "meeting" | "chat" | "note" | "file" | "public";
export type SoulTemplateId = "male" | "female";

export interface SoulPublicSource {
  id: string;
  label: string;
  url: string;
}

export interface SoulMaterialRef {
  id: string;
  label: string;
  sourceType: SoulMaterialType;
  path?: string;
  fixedMaterialId?: string;
  content?: string;
  size?: number;
  mimeType?: "text/plain" | "text/markdown";
  wordCount: number;
  /** Required for meetings/group chats so another speaker's view is not distilled. */
  speakerPurified?: boolean;
  sourceUrl?: string;
}

export interface SoulUploadedMaterial {
  id: string;
  name: string;
  content: string;
  size: number;
  mimeType: "text/plain" | "text/markdown";
  wordCount: number;
}

export interface SoulPrivacyScope {
  confirmed: boolean;
  /** Human-readable scope shown back to the user before a run starts. */
  scopeText: string;
  /** Explicitly excluded data/topics. */
  exclusionsText: string;
  speakerPurificationConfirmed: boolean;
  confirmedAt?: string;
}

export interface SoulCardWizardState {
  schema: typeof SOUL_CARD_WIZARD_SCHEMA;
  mode: SoulWizardMode;
  personName: string;
  oneLineDescription: string;
  targetType: SoulTargetType;
  sourceMode: SoulSourceMode;
  selectedMaterials: SoulMaterialRef[];
  publicSources: SoulPublicSource[];
  privacy: SoulPrivacyScope;
  outputSlug: string;
  outputDir: string;
  templateId: SoulTemplateId;
}

export interface SoulWizardValidation {
  valid: boolean;
  errors: Partial<Record<"personName" | "oneLineDescription" | "sourceMode" | "privacy" | "materials" | "publicSources" | "speakerPurification", string>>;
  coverageWarning: string | null;
  materialCount: number;
  totalWordCount: number;
  hasSpeakerMixedSources: boolean;
}

export interface SoulCreateRequest {
  schema: typeof SOUL_BRIDGE_SCHEMA;
  runId?: string;
  mode: "from-soul";
  personName: string;
  oneLineDescription: string;
  targetType: SoulTargetType;
  sourceMode: SoulSourceMode;
  exactMaterialPaths: string[];
  fixedMaterialIds: string[];
  uploadedMaterials: SoulUploadedMaterial[];
  publicSources: SoulPublicSource[];
  collectionScope: {
    confirmed: true;
    scopeText: string;
    exclusionsText: string;
    speakerPurificationRequired: boolean;
    speakerPurificationConfirmed: boolean;
  };
  outputDir: string;
  outputSlug: string;
  materialCount: number;
  totalWordCount: number;
}

export interface SoulProjectionInput {
  personName: string;
  oneLineDescription: string;
  role?: string;
  announcerName?: string;
  slug: string;
  soulPath: string;
  sourceCount: number;
  coverageWarning?: string | null;
  skillFrontmatter: {
    name: string;
    description: string;
  };
  installVerification: {
    verified: boolean;
    skillPath?: string;
    fileVerified?: boolean;
    indexStatus?: "verified" | "unconfirmed" | "failed";
    error?: string | null;
  };
  templateId?: SoulTemplateId;
}

export type SoulSkillMapping =
  | { status: "unmapped"; reason: "artifact-incomplete" | "awaiting-install-verification"; candidateSkillName: string }
  | {
    status: "mapped";
    skillName: string;
    skillPath: string;
    soulPath: string;
    verifiedAt?: string;
  };

export interface SoulCardProjection {
  schema: typeof SOUL_CARD_PROJECTION_SCHEMA;
  id: string;
  name: string;
  role: string;
  oneLineSummary: string;
  announcerName: string;
  skillName: string;
  sourceCount: number;
  coverageWarning: string | null;
  image: { kind: "template"; templateId: SoulTemplateId } | { kind: "user-upload"; path: string };
  skillMapping: SoulSkillMapping;
  soulPath: string;
}

export function createEmptySoulCardWizard(
  mode: SoulWizardMode = "manual",
  templateId: SoulTemplateId = "male",
): SoulCardWizardState {
  return {
    schema: SOUL_CARD_WIZARD_SCHEMA,
    mode,
    personName: "",
    oneLineDescription: "",
    targetType: "self",
    sourceMode: "selected-materials",
    selectedMaterials: [],
    publicSources: [],
    privacy: {
      confirmed: false,
      scopeText: "",
      exclusionsText: "",
      speakerPurificationConfirmed: false,
    },
    outputSlug: "soul-persona",
    outputDir: `${SOUL_OUTPUT_ROOT}/soul-persona-soul`,
    templateId,
  };
}

export function normalizeSoulSlug(value: string): string {
  const normalized = String(value ?? "").trim().normalize("NFKD");
  const ascii = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return ascii || `soul-${stableShortHash(normalized || "persona")}`;
}

function stableShortHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 8);
}

export function totalSoulWordCount(materials: readonly SoulMaterialRef[]): number {
  return materials.reduce((total, material) => total + Math.max(0, Number(material.wordCount) || 0), 0);
}

export function hasSpeakerMixedSources(materials: readonly SoulMaterialRef[]): boolean {
  return materials.some((material) => material.sourceType === "meeting" || material.sourceType === "chat");
}

export function assessSoulCoverage(materials: readonly SoulMaterialRef[]): { materialCount: number; totalWordCount: number; warning: string | null } {
  const materialCount = materials.length;
  const totalWordCount = totalSoulWordCount(materials);
  const enough = materialCount >= SOUL_MIN_MATERIALS || totalWordCount >= SOUL_MIN_WORDS;
  return {
    materialCount,
    totalWordCount,
    warning: enough ? null : `素材覆盖不足：建议至少 ${SOUL_MIN_MATERIALS} 个素材或累计 ${SOUL_MIN_WORDS.toLocaleString()} 字；当前允许生成基础版，但还原度会受限。`,
  };
}

export function validateSoulWizardState(state: SoulCardWizardState): SoulWizardValidation {
  const errors: SoulWizardValidation["errors"] = {};
  const personName = state.personName.trim();
  const description = state.oneLineDescription.trim();
  const materials = Array.isArray(state.selectedMaterials) ? state.selectedMaterials : [];
  const publicSources = Array.isArray(state.publicSources) ? state.publicSources : [];
  const mixedSources = hasSpeakerMixedSources(materials);
  const coverage = assessSoulCoverage(materials);

  if (!personName) errors.personName = "请填写人物姓名";
  else if (personName.length > 80) errors.personName = "人物姓名不能超过 80 个字符";
  if (!description) errors.oneLineDescription = "请写一句话描述这个人是谁、做什么";
  else if (description.length > 240) errors.oneLineDescription = "一句话描述不能超过 240 个字符";

  if (state.mode === "from-soul") {
    if (state.targetType === "other" && !["uploaded-files", "public-research"].includes(state.sourceMode)) {
      errors.sourceMode = "蒸馏别人只能使用用户明确提供的文件或公开来源";
    }
    if (state.targetType === "other" && materials.some((material) => Boolean(material.fixedMaterialId))) {
      errors.materials = "蒸馏别人不能使用工作区固定素材，只能使用公开来源或用户明确提供的文件";
    }
    if (state.sourceMode === "public-research") {
      if (publicSources.length === 0) errors.publicSources = "请至少添加一个公开来源 URL，或改用其他采集方式";
      else if (publicSources.some((source) => !/^https?:\/\//i.test(source.url.trim()))) errors.publicSources = "公开来源必须是 http(s) URL";
    } else if (materials.length === 0) {
      errors.materials = "请至少选择一份明确素材；不足门槛仍可继续，但不能没有输入";
    } else if (materials.some((material) => !material.path && !material.fixedMaterialId && typeof material.content !== "string")) {
      errors.materials = "所选素材缺少可读取路径、固定素材 ID 或用户明确提供的正文";
    }
    if (!state.privacy.confirmed || !state.privacy.scopeText.trim()) {
      errors.privacy = state.targetType === "self"
        ? "蒸馏自己前必须确认采集范围与隐私边界"
        : "请确认只使用公开来源或用户明确提供的文件";
    }
    if (mixedSources && (!state.privacy.speakerPurificationConfirmed || materials.some((material) => !material.speakerPurified))) {
      errors.speakerPurification = "会议/群聊素材必须完成发言人纯化，只保留目标人物发言或明确标注未确认段落";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    coverageWarning: coverage.warning,
    materialCount: coverage.materialCount,
    totalWordCount: coverage.totalWordCount,
    hasSpeakerMixedSources: mixedSources,
  };
}

export function buildSoulCreateRequest(state: SoulCardWizardState): SoulCreateRequest {
  const validation = validateSoulWizardState(state);
  if (!validation.valid) throw new Error(Object.values(validation.errors).filter(Boolean).join("；"));
  if (state.mode !== "from-soul") throw new Error("手动空卡不创建 create-soul 任务");
  const slug = normalizeSoulSlug(state.outputSlug && state.outputSlug !== "soul-persona" ? state.outputSlug : state.personName);
  const exactMaterialPaths = state.sourceMode === "public-research"
    ? []
    : state.selectedMaterials.map((material) => material.path).filter((value): value is string => Boolean(value?.trim()));
  const fixedMaterialIds = state.sourceMode === "public-research"
    ? []
    : state.selectedMaterials.map((material) => material.fixedMaterialId).filter((value): value is string => Boolean(value?.trim()));
  const uploadedMaterials = state.sourceMode === "public-research"
    ? []
    : state.selectedMaterials.flatMap((material) => typeof material.content === "string" ? [{
      id: material.id,
      name: material.label,
      content: material.content,
      size: material.size ?? new TextEncoder().encode(material.content).byteLength,
      mimeType: material.mimeType ?? "text/plain",
      wordCount: Math.max(0, material.wordCount),
    }] : []);
  return {
    schema: SOUL_BRIDGE_SCHEMA,
    mode: "from-soul",
    personName: state.personName.trim(),
    oneLineDescription: state.oneLineDescription.trim(),
    targetType: state.targetType,
    sourceMode: state.sourceMode,
    exactMaterialPaths,
    fixedMaterialIds,
    uploadedMaterials,
    publicSources: state.publicSources.map((source) => ({ ...source, url: source.url.trim() })),
    collectionScope: {
      confirmed: true,
      scopeText: state.privacy.scopeText.trim(),
      exclusionsText: state.privacy.exclusionsText.trim(),
      speakerPurificationRequired: validation.hasSpeakerMixedSources,
      speakerPurificationConfirmed: state.privacy.speakerPurificationConfirmed,
    },
    outputDir: `${SOUL_OUTPUT_ROOT}/${slug}-soul`,
    outputSlug: slug,
    materialCount: validation.materialCount,
    totalWordCount: validation.totalWordCount,
  };
}

export function projectSoulCard(input: SoulProjectionInput): SoulCardProjection {
  const skillName = `${normalizeSoulSlug(input.slug)}-chat`;
  const mapping: SoulSkillMapping = input.installVerification.verified
    && input.skillFrontmatter.name === skillName
    && Boolean(input.installVerification.skillPath)
    ? {
      status: "mapped",
      skillName,
      skillPath: input.installVerification.skillPath!,
      soulPath: input.soulPath,
    }
    : {
      status: "unmapped",
      reason: input.skillFrontmatter.name === skillName ? "awaiting-install-verification" : "artifact-incomplete",
      candidateSkillName: skillName,
    };
  return {
    schema: SOUL_CARD_PROJECTION_SCHEMA,
    id: `soul-${normalizeSoulSlug(input.slug)}`,
    name: input.personName.trim(),
    role: input.role?.trim() || "AI 人物分身",
    oneLineSummary: input.oneLineDescription.trim(),
    announcerName: input.announcerName?.trim() || input.personName.trim(),
    skillName,
    sourceCount: Math.max(0, Math.floor(input.sourceCount || 0)),
    coverageWarning: input.coverageWarning || null,
    image: { kind: "template", templateId: input.templateId || "male" },
    skillMapping: mapping,
    soulPath: input.soulPath,
  };
}
