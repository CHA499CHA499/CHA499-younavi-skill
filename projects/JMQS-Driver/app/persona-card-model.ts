export const PERSONA_CARD_STORAGE_KEY = "persona-driver.persona-cards.v1";
export const PERSONA_CARD_SCHEMA = "persona-driver.persona-cards/v1";
export const PERSONA_CARD_STORAGE_VERSION = 1 as const;
export const PERSONA_CARD_LEGACY_STORAGE_KEYS = ["persona-driver.custom-personas.v0"] as const;
export const PERSONA_RANDOM_POOL_MANIFEST_PATH = "/personas/random-pool/masked-bust-v2/manifest.json";
export const PERSONA_RANDOM_POOL_STORAGE_KEY = "persona-driver.persona-random-pool.v1";
export const PERSONA_RANDOM_POOL_STORAGE_VERSION = 1 as const;
export const PERSONA_ACTION_ART_VERSION = "action-masked-v3" as const;
export const LEGACY_PERSONA_CARD_TEMPLATE_IDS = ["custom-template-male-v1", "custom-template-female-v1"] as const;

export const PERSONA_CARD_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PERSONA_CARD_IMAGE_ACCEPT = PERSONA_CARD_IMAGE_TYPES.join(",");
export const PERSONA_CARD_MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type PersonaCardArtSource = "fixed" | "template" | "uploaded" | "random-pool";

export const PERSONA_CARD_FIELD_LIMITS = {
  name: 80,
  announcerName: 120,
  role: 80,
  summary: 500,
} as const;

export type PersonaCardImageType = (typeof PERSONA_CARD_IMAGE_TYPES)[number];
export type PersonaCardSource = "builtin" | "custom" | "soul";
export type PersonaCardStatus = "active" | "draft" | "invalid";
export type PersonaCardEditorMode = "view" | "creating" | "editing" | "validating" | "cancelled";

/**
 * A Skill binding is intentionally separate from the editable card copy.
 * Free text never becomes `skillName`; only a verified integration may set
 * the `verified` variant and make a card eligible for the Bridge.
 */
export type PersonaSkillBinding =
  | { status: "unmapped"; candidateName?: never }
  | { status: "verified"; skillName: string; verifiedAt?: string };

export type PersonaSkillMapping =
  | { status: "unmapped"; reason: "not-soul" | "awaiting-create-soul" | "awaiting-install-verification" | "free-text-not-allowed" }
  | {
    status: "mapped";
    slug: string;
    skillName: string;
    createSoulArtifact: { status: "complete"; path: string };
    installedSkill: { status: "verified"; name: string };
    verifiedAt?: string;
  };

export interface PersonaRandomPoolAsset {
  id: string;
  path: string;
}

export interface PersonaRandomPoolManifest {
  schema?: string;
  version?: string | number;
  assets: PersonaRandomPoolAsset[];
}

export interface PersonaRandomPoolState {
  version: typeof PERSONA_RANDOM_POOL_STORAGE_VERSION;
  cycle: number;
  remainingAssetIds: string[];
  lastAssetId?: string;
}

export interface PersonaRandomPoolDraw {
  asset: PersonaRandomPoolAsset | null;
  state: PersonaRandomPoolState;
}

export interface PersonaCardBaseline {
  id: string;
  name: string;
  announcerName: string;
  skillName: string;
  role: string;
  code: string;
  color: string;
  image: string;
  motion?: string;
  motionPoster?: string;
  summary: string;
  tags: readonly string[];
}

export interface PersonaCard {
  id: string;
  name: string;
  announcerName: string;
  /** Optional for custom cards until an installed Skill is explicitly verified. */
  skillName?: string;
  role: string;
  code: string;
  color: string;
  image: string;
  motion?: string;
  motionPoster?: string;
  summary: string;
  tags: string[];
  source: PersonaCardSource;
  status: PersonaCardStatus;
  /** The fixed card copied to make this custom card, if any. */
  copiedFromId?: string;
  /** Built-in empty-card slot, intentionally not an installed Skill. */
  templateId?: "empty";
  /** Soul projection metadata; this module never creates or deletes the Soul directory. */
  soulPath?: string;
  sourceCount?: number;
  coverageWarning?: string;
  skillBinding: PersonaSkillBinding;
  /** Art provenance is independent from Skill provenance. */
  artSource: PersonaCardArtSource;
  artAssetId: string;
  /** Canonical Soul-to-Skill mapping gate; `mapped` is never inferred from free text. */
  skillMapping: PersonaSkillMapping;
}

export const PERSONA_CARD_TEMPLATE_CARDS: readonly PersonaCard[] = [
  {
    id: "custom-template-empty-v1",
    name: "新建角色卡",
    announcerName: "New Persona",
    role: "空白角色位",
    code: "EMPTY SLOT",
    color: "#7d8795",
    image: "",
    summary: "通用空位仅用于创建，不能插入 Persona Driver。",
    tags: [],
    source: "custom",
    status: "active",
    templateId: "empty",
    artSource: "template",
    artAssetId: "template-empty",
    skillBinding: { status: "unmapped" },
    skillMapping: { status: "unmapped", reason: "awaiting-create-soul" },
  },
];

export type PersonaCardEditableFields = Pick<PersonaCard, "name" | "announcerName" | "role" | "summary" | "color" | "image">;

export interface PersonaCardDraft extends PersonaCardEditableFields {
  id: string;
  source: "custom";
  status: "draft" | "invalid";
  copiedFromId?: string;
  skillBinding: { status: "unmapped" };
  skillMapping: { status: "unmapped"; reason: "free-text-not-allowed" };
  artSource: PersonaCardArtSource;
  artAssetId: string;
}

export interface PersonaCardStorageRecord {
  schema: typeof PERSONA_CARD_SCHEMA;
  version: typeof PERSONA_CARD_STORAGE_VERSION;
  /** Only custom cards are persisted. Fixed baselines always come from code. */
  cards: PersonaCard[];
}

export interface PersonaCardDragItem {
  kind: "persona";
  id: string;
  label: string;
  detail: string;
  image: string;
  color: string;
}

export interface PersonaCardValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof PersonaCardEditableFields, string>>;
}

export function toPersonaCard(baseline: PersonaCardBaseline): PersonaCard {
  return {
    ...baseline,
    tags: [...baseline.tags],
    source: "builtin",
    status: "active",
    skillBinding: { status: "verified", skillName: baseline.skillName },
    skillMapping: { status: "unmapped", reason: "not-soul" },
    artSource: "fixed",
    artAssetId: baseline.id,
  };
}

export function isPersonaCardTemplate(card: Pick<PersonaCard, "id" | "templateId">): boolean {
  return Boolean(card.templateId) || (LEGACY_PERSONA_CARD_TEMPLATE_IDS as readonly string[]).includes(card.id);
}

export function isLegacyPersonaCardTemplateId(value: string | null | undefined): boolean {
  return Boolean(value && (LEGACY_PERSONA_CARD_TEMPLATE_IDS as readonly string[]).includes(value));
}

export function normalizePersonaCardCollection(cards: readonly PersonaCard[]): PersonaCard[] {
  return [
    ...cards.filter((card) => !isPersonaCardTemplate(card)),
    ...PERSONA_CARD_TEMPLATE_CARDS,
  ];
}

export function createCustomPersonaCard(
  fields: Partial<PersonaCardEditableFields> = {},
  options: { id?: string; copiedFromId?: string; baseline?: PersonaCardBaseline; artSource?: PersonaCardArtSource; artAssetId?: string } = {},
): PersonaCardDraft {
  const baseline = options.baseline;
  const id = options.id ?? createCustomPersonaCardId();
  const image = fields.image ?? baseline?.image ?? "";
  return {
    id,
    name: fields.name ?? baseline?.name ?? "",
    announcerName: fields.announcerName ?? baseline?.announcerName ?? "",
    role: fields.role ?? baseline?.role ?? "",
    summary: fields.summary ?? baseline?.summary ?? "",
    color: fields.color ?? baseline?.color ?? "#ef3048",
    image,
    artSource: options.artSource ?? (image ? (image.startsWith("data:") ? "uploaded" : "fixed") : "random-pool"),
    artAssetId: options.artAssetId ?? (image ? `uploaded:${id}` : ""),
    source: "custom",
    status: "draft",
    copiedFromId: options.copiedFromId,
    skillBinding: { status: "unmapped" },
    skillMapping: { status: "unmapped", reason: "free-text-not-allowed" },
  };
}

/** Compatibility adapter for the editor; callers without a manifest get no draw. */
export function assignRandomPersonaCardArt(card: PersonaCard, manifest: PersonaRandomPoolManifest = { assets: [] }, storage?: Storage | null): PersonaCard {
  return assignRandomPoolArt(card, manifest, storage, Math.random, { force: true }).card;
}

export function createCustomPersonaCardId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `custom-${Date.now().toString(36)}-${random}`.toLowerCase();
}

export function parsePersonaRandomPoolManifest(value: unknown): PersonaRandomPoolManifest {
  const record = isRecord(value) ? value : {};
  const rawAssets = Array.isArray(record.assets) ? record.assets : Array.isArray(record.images) ? record.images : Array.isArray(record.entries) ? record.entries : [];
  const assets: PersonaRandomPoolAsset[] = [];
  const seen = new Set<string>();
  for (const raw of rawAssets) {
    const asset = typeof raw === "string"
      ? { id: raw, path: normalizePersonaAssetPath(raw) }
      : isRecord(raw)
        ? { id: stringValue(raw.id) || stringValue(raw.assetId) || stringValue(raw.path) || stringValue(raw.src), path: normalizePersonaAssetPath(stringValue(raw.path) || stringValue(raw.src)) }
        : null;
    if (!asset || !asset.id || !asset.path || seen.has(asset.id)) continue;
    seen.add(asset.id);
    assets.push(asset);
  }
  return {
    schema: typeof record.schema === "string" ? record.schema : undefined,
    version: typeof record.version === "string" || typeof record.version === "number" ? record.version : undefined,
    assets,
  };
}

export async function loadPersonaRandomPoolManifest(fetcher: typeof fetch = fetch): Promise<PersonaRandomPoolManifest> {
  const response = await fetcher(PERSONA_RANDOM_POOL_MANIFEST_PATH, { cache: "no-store" });
  if (!response.ok) throw new Error(`随机立绘池 manifest 不可用（HTTP ${response.status}）`);
  return parsePersonaRandomPoolManifest(await response.json());
}

export function emptyPersonaRandomPoolState(): PersonaRandomPoolState {
  return { version: PERSONA_RANDOM_POOL_STORAGE_VERSION, cycle: 0, remainingAssetIds: [] };
}

export function readPersonaRandomPoolState(storage: Storage | null | undefined, manifest: PersonaRandomPoolManifest): PersonaRandomPoolState {
  if (!storage) return emptyPersonaRandomPoolState();
  try {
    const value: unknown = JSON.parse(storage.getItem(PERSONA_RANDOM_POOL_STORAGE_KEY) ?? "null");
    if (!isRecord(value) || value.version !== PERSONA_RANDOM_POOL_STORAGE_VERSION) return emptyPersonaRandomPoolState();
    const ids = new Set(manifest.assets.map((asset) => asset.id));
    return {
      version: PERSONA_RANDOM_POOL_STORAGE_VERSION,
      cycle: Number.isInteger(value.cycle) && Number(value.cycle) >= 0 ? Number(value.cycle) : 0,
      remainingAssetIds: Array.isArray(value.remainingAssetIds)
        ? value.remainingAssetIds.filter((id: unknown, index: number, all: unknown[]): id is string => typeof id === "string" && ids.has(id) && all.indexOf(id) === index)
        : [],
      lastAssetId: typeof value.lastAssetId === "string" && ids.has(value.lastAssetId) ? value.lastAssetId : undefined,
    };
  } catch {
    return emptyPersonaRandomPoolState();
  }
}

export function persistPersonaRandomPoolState(storage: Storage | null | undefined, state: PersonaRandomPoolState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PERSONA_RANDOM_POOL_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function drawPersonaRandomPoolAsset(manifest: PersonaRandomPoolManifest, state: PersonaRandomPoolState = emptyPersonaRandomPoolState(), random: () => number = Math.random): PersonaRandomPoolDraw {
  const assets = manifest.assets.filter((asset) => asset.id && asset.path);
  if (assets.length === 0) return { asset: null, state: { ...state, remainingAssetIds: [] } };

  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  let remaining = state.remainingAssetIds.filter((id) => assetById.has(id));
  let cycle = Number.isInteger(state.cycle) && state.cycle >= 0 ? state.cycle : 0;
  const isNewCycle = remaining.length === 0;
  if (isNewCycle) {
    remaining = assets.map((asset) => asset.id);
    if (state.lastAssetId) cycle += 1;
  }

  let index = Math.floor(Math.max(0, Math.min(0.999999, random())) * remaining.length);
  if (isNewCycle && remaining.length > 1 && remaining[index] === state.lastAssetId) index = (index + 1) % remaining.length;
  const [assetId] = remaining.splice(index, 1);
  const asset = assetById.get(assetId) ?? null;
  return {
    asset,
    state: { version: PERSONA_RANDOM_POOL_STORAGE_VERSION, cycle, remainingAssetIds: remaining, lastAssetId: assetId },
  };
}

export function assignRandomPoolArt(card: PersonaCard, manifest: PersonaRandomPoolManifest, storage: Storage | null | undefined, random: () => number = Math.random, options: { force?: boolean } = {}): { card: PersonaCard; draw: PersonaRandomPoolDraw } {
  const state = readPersonaRandomPoolState(storage, manifest);
  const hasUploadedArt = card.artSource === "uploaded" || card.image.startsWith("data:");
  const eligible = (card.source === "custom" || card.source === "soul") && !card.templateId && !hasUploadedArt && (options.force || !card.image);
  if (!eligible) return { card, draw: { asset: null, state } };
  const draw = drawPersonaRandomPoolAsset(manifest, state, random);
  if (draw.asset) persistPersonaRandomPoolState(storage, draw.state);
  return draw.asset
    ? { card: { ...card, image: draw.asset.path, artSource: "random-pool", artAssetId: draw.asset.id }, draw }
    : { card, draw };
}

/** Reserved mapping for the future v3 action assets; not used until those files exist. */
export function getDefaultActionArtPath(cardId: string): string {
  return `/personas/${cardId}-${PERSONA_ACTION_ART_VERSION}.jpg`;
}

export function validatePersonaCardFields(fields: PersonaCardEditableFields): PersonaCardValidationResult {
  const errors: PersonaCardValidationResult["errors"] = {};
  validateText(fields.name, PERSONA_CARD_FIELD_LIMITS.name, "请输入人物名称", "人物名称过长", errors, "name");
  validateText(fields.announcerName, PERSONA_CARD_FIELD_LIMITS.announcerName, "请输入英文播报名", "英文播报名过长", errors, "announcerName");
  validateText(fields.role, PERSONA_CARD_FIELD_LIMITS.role, "请输入角色", "角色过长", errors, "role");
  validateText(fields.summary, PERSONA_CARD_FIELD_LIMITS.summary, "请输入人物简介", "人物简介过长", errors, "summary");

  if (!/^#[0-9a-f]{6}$/i.test(fields.color)) errors.color = "主色必须是六位十六进制颜色";
  if (fields.image && !isAllowedPersonaImageSource(fields.image, "custom")) errors.image = "请选择 JPEG、PNG 或 WebP 本地图片";
  else if (fields.image.startsWith("data:") && getDataUrlByteSize(fields.image) > PERSONA_CARD_MAX_IMAGE_BYTES) errors.image = "图片不能超过 2 MB";

  return { valid: Object.keys(errors).length === 0, errors };
}

function normalizePersonaAssetPath(value: string): string {
  if (value.startsWith("/")) return value;
  return `/personas/${value.replace(/^\/+/, "")}`;
}

function validateText<T extends keyof PersonaCardEditableFields>(
  value: string,
  limit: number,
  emptyMessage: string,
  longMessage: string,
  errors: PersonaCardValidationResult["errors"],
  field: T,
) {
  const trimmed = value.trim();
  if (!trimmed) errors[field] = emptyMessage;
  else if (trimmed.length > limit) errors[field] = longMessage;
}

export function isAllowedPersonaImageMimeType(value: string): value is PersonaCardImageType {
  return (PERSONA_CARD_IMAGE_TYPES as readonly string[]).includes(value);
}

export function isAllowedPersonaImageSource(image: string, source: PersonaCardSource): boolean {
  if (source === "builtin") return image.startsWith("/") && !image.startsWith("//");
  return (image.startsWith("/") && !image.startsWith("//"))
    || new RegExp(`^data:(${PERSONA_CARD_IMAGE_TYPES.join("|")});base64,[A-Za-z0-9+/=]+$`).test(image);
}

export function toPersonaCardDragItem(card: PersonaCard): PersonaCardDragItem {
  return {
    kind: "persona",
    id: card.id,
    label: card.name,
    detail: card.role,
    image: card.image,
    color: card.color,
  };
}

/**
 * Adapter for `DriverTextureScene`, `InteractionDragLayer`, and the announcer
 * boundary. `skillName` is empty for custom cards unless a verified binding
 * has been supplied by an integration; this prevents free text from posing as
 * an installed Skill.
 */
export function toDriverPersona(card: PersonaCard): PersonaCardBaseline {
  return {
    id: card.id,
    name: card.name,
    announcerName: card.announcerName,
    skillName: card.skillMapping.status === "mapped"
      ? card.skillMapping.skillName
      : card.skillBinding.status === "verified"
        ? card.skillBinding.skillName
        : "",
    role: card.role,
    code: card.code,
    color: card.color,
    image: card.image,
    motion: card.motion,
    motionPoster: card.motionPoster,
    summary: card.summary,
    tags: [...card.tags],
  };
}

export function readPersonaCardStorage(storage: Storage | null | undefined): PersonaCardStorageRecord {
  const fallback = emptyPersonaCardStorage();
  if (!storage) return fallback;

  const current = parsePersonaCardStorage(storage.getItem(PERSONA_CARD_STORAGE_KEY));
  if (current) return current;

  for (const key of PERSONA_CARD_LEGACY_STORAGE_KEYS) {
    const migrated = migrateLegacyPersonaCards(storage.getItem(key));
    if (migrated.cards.length > 0) {
      try {
        storage.setItem(PERSONA_CARD_STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        // A read-only or quota-limited storage still gets an in-memory result.
      }
      return migrated;
    }
  }

  // Baselines are deliberately read only and are not copied into localStorage.
  return fallback;
}

export function persistPersonaCardStorage(storage: Storage | null | undefined, record: PersonaCardStorageRecord): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PERSONA_CARD_STORAGE_KEY, JSON.stringify(sanitizeStorageRecord(record)));
    return true;
  } catch {
    return false;
  }
}

export function upsertPersonaCard(record: PersonaCardStorageRecord, card: PersonaCard): PersonaCardStorageRecord {
  if ((card.source !== "custom" && card.source !== "soul") || card.status === "invalid" || isPersonaCardTemplate(card)) return record;
  return {
    ...record,
    cards: [...record.cards.filter((entry) => entry.id !== card.id), { ...card, tags: [...card.tags] }],
  };
}

export function removePersonaCard(record: PersonaCardStorageRecord, cardId: string): PersonaCardStorageRecord {
  return { ...record, cards: record.cards.filter((card) => card.id !== cardId) };
}

export function emptyPersonaCardStorage(): PersonaCardStorageRecord {
  return { schema: PERSONA_CARD_SCHEMA, version: PERSONA_CARD_STORAGE_VERSION, cards: [] };
}

function parsePersonaCardStorage(raw: string | null): PersonaCardStorageRecord | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.schema !== PERSONA_CARD_SCHEMA || value.version !== PERSONA_CARD_STORAGE_VERSION || !Array.isArray(value.cards)) return null;
    const cards = value.cards.map((entry) => sanitizeStoredCard(entry)).filter((card): card is PersonaCard => card !== null);
    return { schema: PERSONA_CARD_SCHEMA, version: PERSONA_CARD_STORAGE_VERSION, cards };
  } catch {
    return null;
  }
}

function migrateLegacyPersonaCards(raw: string | null): PersonaCardStorageRecord {
  if (!raw) return emptyPersonaCardStorage();
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return emptyPersonaCardStorage();
    const cards: PersonaCard[] = [];
    for (const entry of value) {
      if (!isRecord(entry)) continue;
      if (isLegacyStoredTemplate(entry)) continue;
      const draft = createCustomPersonaCard({
        name: stringValue(entry.name),
        announcerName: stringValue(entry.announcerName),
        role: stringValue(entry.role),
        summary: stringValue(entry.summary),
        color: stringValue(entry.color) || "#ef3048",
        image: stringValue(entry.image),
      }, { id: stringValue(entry.id) || undefined });
      const validation = validatePersonaCardFields(draft);
      if (validation.valid) {
    cards.push({ ...draft, code: "CUSTOM PERSONA", tags: [] as string[], status: "active" });
      }
    }
    return { schema: PERSONA_CARD_SCHEMA, version: PERSONA_CARD_STORAGE_VERSION, cards };
  } catch {
    return emptyPersonaCardStorage();
  }
}

function sanitizeStorageRecord(record: PersonaCardStorageRecord): PersonaCardStorageRecord {
  return {
    schema: PERSONA_CARD_SCHEMA,
    version: PERSONA_CARD_STORAGE_VERSION,
    cards: record.cards.filter((card) => !isPersonaCardTemplate(card)).map((card) => ({
      ...card,
      source: card.source === "soul" ? "soul" as const : "custom" as const,
      tags: [...card.tags],
      artSource: sanitizeArtSource(card.artSource, card.source),
      artAssetId: card.artAssetId,
      skillBinding: sanitizeSkillBinding(card.skillBinding),
      skillMapping: sanitizeSkillMapping(card.skillMapping, card.source === "soul" ? "awaiting-create-soul" : "free-text-not-allowed"),
      ...(card.source === "soul" ? {
        soulPath: card.soulPath,
        sourceCount: card.sourceCount,
        coverageWarning: card.coverageWarning,
      } : {}),
    })),
  };
}

function sanitizeStoredCard(value: unknown): PersonaCard | null {
  if (!isRecord(value)) return null;
  if (isLegacyStoredTemplate(value)) return null;
  const card = createCustomPersonaCard({
    name: stringValue(value.name),
    announcerName: stringValue(value.announcerName),
    role: stringValue(value.role),
    summary: stringValue(value.summary),
    color: stringValue(value.color),
    image: stringValue(value.image),
  }, { id: stringValue(value.id) || undefined, copiedFromId: stringValue(value.copiedFromId) || undefined });
  const validation = validatePersonaCardFields(card);
  if (!validation.valid) return null;
  const source = value.source === "soul" ? "soul" as const : "custom" as const;
  const artSource = value.artSource === undefined && card.image
    ? "uploaded" as const
    : sanitizeArtSource(value.artSource, source);
  const artAssetId = stringValue(value.artAssetId) || `${artSource}:${card.id}`;
  return {
    ...card,
    image: card.image,
    code: stringValue(value.code) || "CUSTOM PERSONA",
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : [],
    motion: stringValue(value.motion) || undefined,
    motionPoster: stringValue(value.motionPoster) || undefined,
    source,
    status: value.status === "draft" ? "draft" : "active",
    soulPath: source === "soul" ? stringValue(value.soulPath) || undefined : undefined,
    sourceCount: source === "soul" && Number.isInteger(value.sourceCount) && Number(value.sourceCount) >= 0 ? Number(value.sourceCount) : undefined,
    coverageWarning: source === "soul" ? stringValue(value.coverageWarning) || undefined : undefined,
    skillBinding: sanitizeSkillBinding(value.skillBinding),
    skillMapping: sanitizeSkillMapping(value.skillMapping, source === "soul" ? "awaiting-create-soul" : "free-text-not-allowed"),
    artSource,
    artAssetId,
  };
}

function isLegacyStoredTemplate(value: Record<string, unknown>): boolean {
  return value.templateId === "male"
    || value.templateId === "female"
    || value.templateId === "empty"
    || (typeof value.id === "string" && (LEGACY_PERSONA_CARD_TEMPLATE_IDS as readonly string[]).includes(value.id))
    || value.id === PERSONA_CARD_TEMPLATE_CARDS[0].id;
}

function sanitizeSkillBinding(value: unknown): PersonaSkillBinding {
  if (isRecord(value) && value.status === "verified" && typeof value.skillName === "string" && value.skillName.trim()) {
    return { status: "verified", skillName: value.skillName.trim(), verifiedAt: typeof value.verifiedAt === "string" ? value.verifiedAt : undefined };
  }
  return { status: "unmapped" };
}

function sanitizeArtSource(value: unknown, source: PersonaCardSource): PersonaCardArtSource {
  if (value === "template" && source === "custom") return "template";
  if (value === "random-pool" && (source === "custom" || source === "soul")) return "random-pool";
  if (value === "uploaded" && (source === "custom" || source === "soul")) return "uploaded";
  if (value === "fixed" || source === "builtin") return "fixed";
  return source === "soul" || source === "custom" ? "random-pool" : "fixed";
}

function sanitizeSkillMapping(value: unknown, fallbackReason: "not-soul" | "awaiting-create-soul" | "awaiting-install-verification" | "free-text-not-allowed"): PersonaSkillMapping {
  if (isRecord(value) && value.status === "mapped" && typeof value.slug === "string" && value.slug.trim() && typeof value.skillName === "string" && value.skillName.trim() && isRecord(value.createSoulArtifact) && value.createSoulArtifact.status === "complete" && typeof value.createSoulArtifact.path === "string" && value.createSoulArtifact.path.trim() && isRecord(value.installedSkill) && value.installedSkill.status === "verified" && value.installedSkill.name === `${value.slug.trim()}-chat`) {
    return {
      status: "mapped",
      slug: value.slug.trim(),
      skillName: value.skillName.trim(),
      createSoulArtifact: { status: "complete", path: value.createSoulArtifact.path.trim() },
      installedSkill: { status: "verified", name: value.installedSkill.name },
      verifiedAt: typeof value.verifiedAt === "string" ? value.verifiedAt : undefined,
    };
  }
  return { status: "unmapped", reason: fallbackReason };
}

function getDataUrlByteSize(value: string): number {
  const encoded = value.slice(value.indexOf(",") + 1);
  return Math.floor((encoded.length * 3) / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
