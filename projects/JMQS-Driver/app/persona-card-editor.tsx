"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  createCustomPersonaCard,
  assignRandomPoolArt,
  emptyPersonaCardStorage,
  PERSONA_CARD_IMAGE_ACCEPT,
  PERSONA_CARD_MAX_IMAGE_BYTES,
  persistPersonaCardStorage,
  readPersonaCardStorage,
  removePersonaCard,
  toDriverPersona,
  toPersonaCard,
  toPersonaCardDragItem,
  type PersonaCard,
  type PersonaCardBaseline,
  type PersonaCardDragItem,
  type PersonaCardEditableFields,
  type PersonaCardEditorMode,
  type PersonaCardStorageRecord,
  validatePersonaCardFields,
  isAllowedPersonaImageMimeType,
  loadPersonaRandomPoolManifest,
  isLegacyPersonaCardTemplateId,
  isPersonaCardTemplate,
  normalizePersonaCardCollection,
  type PersonaRandomPoolManifest,
} from "./persona-card-model";
import styles from "./persona-card-editor.module.css";

export interface PersonaCardEditorProps {
  /** Pass the existing five `PERSONAS` entries here; they remain read-only baselines. */
  baselineCards: readonly PersonaCardBaseline[];
  /** Compatibility input; male/female templates are normalized to the single generic empty slot. */
  templateCards?: readonly PersonaCard[];
  initialCardId?: string | null;
  initialTemplateId?: string | null;
  storage?: Storage | null;
  className?: string;
  /** Optional management action rendered beside the manual-create action. */
  toolbarActions?: ReactNode;
  onCardsChange?: (cards: readonly PersonaCard[]) => void;
  onCardSelect?: (card: PersonaCard) => void;
  onCardInsert?: (card: PersonaCard) => void;
  onAnnounce?: (card: PersonaCard) => void;
  onCardSaved?: (card: PersonaCard) => void;
  /** Forward this to the page's existing `InteractionDragLayer` controller. */
  onCardDragStart?: (item: PersonaCardDragItem, event: ReactPointerEvent<HTMLButtonElement>) => void;
}

export function PersonaCardEditor({
  baselineCards,
  templateCards = [],
  initialCardId,
  initialTemplateId,
  storage,
  className,
  toolbarActions,
  onCardsChange,
  onCardSelect,
  onCardInsert,
  onAnnounce,
  onCardSaved,
  onCardDragStart,
}: PersonaCardEditorProps) {
  const fixedCards = useMemo(() => baselineCards.map(toPersonaCard), [baselineCards]);
  const normalizedTemplateCards = useMemo(
    () => normalizePersonaCardCollection(templateCards).filter(isPersonaCardTemplate),
    [templateCards],
  );
  const initialTemplate = initialTemplateId
    ? normalizedTemplateCards.find((card) => card.id === initialTemplateId)
      ?? (isLegacyPersonaCardTemplateId(initialTemplateId) ? normalizedTemplateCards[0] : undefined)
    : undefined;
  const [stored, setStored] = useState<PersonaCardStorageRecord>(emptyPersonaCardStorage);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplate?.id ?? initialCardId ?? fixedCards[0]?.id ?? null);
  const [draft, setDraft] = useState<ReturnType<typeof createCustomPersonaCard> | null>(() => initialTemplate ? createTemplateDraft(initialTemplate) : null);
  const [mode, setMode] = useState<PersonaCardEditorMode>(initialTemplate ? "creating" : "view");
  const [validationErrors, setValidationErrors] = useState<ReturnType<typeof validatePersonaCardFields>["errors"]>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [randomPoolManifest, setRandomPoolManifest] = useState<PersonaRandomPoolManifest | null>(null);

  const cards = useMemo(() => {
    const merged = new Map<string, PersonaCard>();
    for (const card of [...fixedCards, ...normalizePersonaCardCollection([...normalizedTemplateCards, ...stored.cards])]) merged.set(card.id, card);
    return [...merged.values()];
  }, [fixedCards, normalizedTemplateCards, stored.cards]);
  const visibleSelectedId = selectedId && cards.some((card) => card.id === selectedId) ? selectedId : cards[0]?.id ?? null;
  const selectedCard = cards.find((card) => card.id === visibleSelectedId) ?? null;
  const effectiveStorage = storage === undefined ? getBrowserStorage() : storage;

  useEffect(() => {
    let active = true;
    void loadPersonaRandomPoolManifest().then((manifest) => {
      if (active) setRandomPoolManifest(manifest);
    }).catch(() => {
      if (active) setRandomPoolManifest(null);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const next = readPersonaCardStorage(effectiveStorage);
    const timer = window.setTimeout(() => {
      setStored(next);
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [effectiveStorage]);

  useEffect(() => {
    if (!storageReady) return;
    const didPersist = persistPersonaCardStorage(effectiveStorage, stored);
    const timer = window.setTimeout(() => {
      setPersistenceWarning(didPersist || !effectiveStorage ? null : "本机存储空间不足，本次卡片只保留在当前页面。");
    }, 0);
    onCardsChange?.(cards);
    return () => window.clearTimeout(timer);
  }, [cards, effectiveStorage, onCardsChange, storageReady, stored]);

  useEffect(() => {
    if (!storageReady || !randomPoolManifest) return;
    const missingArt = stored.cards.filter((card) => (card.source === "custom" || card.source === "soul") && !card.templateId && !card.image);
    if (missingArt.length === 0) return;
    let next = stored;
    for (const card of missingArt) next = { ...next, cards: next.cards.map((item) => item.id === card.id ? assignRandomPoolArt(item, randomPoolManifest, effectiveStorage).card : item) };
    const timer = window.setTimeout(() => setStored(next), 0);
    return () => window.clearTimeout(timer);
  }, [effectiveStorage, randomPoolManifest, storageReady, stored]);

  function selectCard(card: PersonaCard) {
    if (mode !== "view") return;
    setSelectedId(card.id);
    setDeleteConfirmId(null);
    onCardSelect?.(card);
  }

  function beginEditing(card: PersonaCard) {
    if (card.templateId) {
      beginCreating(card);
      return;
    }
    const baseline = card.source === "builtin" ? baselineCards.find((entry) => entry.id === card.id) : undefined;
    const nextDraft = card.source === "builtin"
        ? createCustomPersonaCard({ ...card, image: "" }, { baseline, copiedFromId: card.id })
      : createCustomPersonaCard(card, { id: card.id, copiedFromId: card.copiedFromId, artSource: card.artSource, artAssetId: card.artAssetId });
    setSelectedId(nextDraft.id);
    setDraft(nextDraft);
    setValidationErrors({});
    setImageError(null);
    setDeleteConfirmId(null);
    setMode(card.source === "builtin" ? "creating" : "editing");
  }

  function beginCreating(template?: PersonaCard) {
    const emptyTemplate = template ?? normalizedTemplateCards[0];
    setSelectedId(emptyTemplate?.id ?? null);
    setDraft(emptyTemplate ? createTemplateDraft(emptyTemplate) : createCustomPersonaCard());
    setValidationErrors({});
    setImageError(null);
    setDeleteConfirmId(null);
    setMode("creating");
  }

  function cancelEditing() {
    setDraft(null);
    setValidationErrors({});
    setImageError(null);
    setMode("cancelled");
    setSelectedId(selectedCard?.source === "builtin" ? selectedCard.id : fixedCards[0]?.id ?? null);
  }

  function updateDraft(field: keyof PersonaCardEditableFields, value: string) {
    setDraft((current) => current ? {
      ...current,
      [field]: value,
      ...(field === "image" ? { artSource: "uploaded" as const, artAssetId: `uploaded:${current.id}` } : {}),
    } : current);
    setValidationErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateDraft() {
    if (!draft) return false;
    setMode("validating");
    const result = validatePersonaCardFields(draft);
    setValidationErrors(result.errors);
    if (!result.valid) {
      setMode(draft.copiedFromId ? "editing" : "creating");
      return false;
    }
    setMode(draft.copiedFromId ? "editing" : "creating");
    return true;
  }

  function saveDraft() {
    if (!draft) return;
    let readyDraft = draft;
    if (!readyDraft.image && randomPoolManifest) {
      const candidate: PersonaCard = { ...readyDraft, code: "CUSTOM PERSONA", tags: [], status: "active" };
      const assigned = assignRandomPoolArt(candidate, randomPoolManifest, effectiveStorage).card;
      readyDraft = { ...readyDraft, image: assigned.image, artSource: assigned.artSource, artAssetId: assigned.artAssetId };
      setDraft(readyDraft);
    }
    const validation = validatePersonaCardFields(readyDraft);
    setValidationErrors(validation.errors);
    if (!validation.valid) return;
    const saved: PersonaCard = {
      ...readyDraft,
      name: readyDraft.name.trim(),
      announcerName: readyDraft.announcerName.trim(),
      role: readyDraft.role.trim(),
      summary: readyDraft.summary.trim(),
      code: "CUSTOM PERSONA",
      tags: [],
      status: "active",
      skillBinding: { status: "unmapped" },
      skillMapping: { status: "unmapped", reason: "free-text-not-allowed" },
    };
    const nextStorage = { ...stored, cards: [...stored.cards.filter((card) => card.id !== saved.id), saved] };
    setStored(nextStorage);
    persistPersonaCardStorage(effectiveStorage, nextStorage);
    onCardsChange?.([...fixedCards, ...normalizePersonaCardCollection(nextStorage.cards)]);
    setDraft(null);
    setMode("view");
    setSelectedId(saved.id);
    onCardSelect?.(saved);
    onCardSaved?.(saved);
  }

  function requestDelete(card: PersonaCard) {
    if (card.source !== "custom" && card.source !== "soul") return;
    if (card.templateId) return;
    if (deleteConfirmId !== card.id) {
      setDeleteConfirmId(card.id);
      return;
    }
    setStored((current) => removePersonaCard(current, card.id));
    setDeleteConfirmId(null);
    setSelectedId(fixedCards[0]?.id ?? null);
    setMode("view");
    // Deliberately do not touch persona-driver.activation-history.v1.
  }

  function swapRandomArt(card: PersonaCard) {
    if (!randomPoolManifest || card.source === "builtin" || card.templateId || card.artSource === "uploaded") return;
    const next = assignRandomPoolArt(card, randomPoolManifest, effectiveStorage, Math.random, { force: true }).card;
    setStored((current) => ({ ...current, cards: current.cards.map((item) => item.id === card.id ? next : item) }));
    setDraft((current) => current?.id === card.id ? { ...current, image: next.image, artSource: next.artSource, artAssetId: next.artAssetId } : current);
  }

  function handleImageChange(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    if (!isAllowedPersonaImageMimeType(file.type)) {
      setImageError("仅支持 JPEG、PNG 或 WebP 图片。");
      return;
    }
    if (file.size > PERSONA_CARD_MAX_IMAGE_BYTES) {
      setImageError(`图片不能超过 ${Math.floor(PERSONA_CARD_MAX_IMAGE_BYTES / (1024 * 1024))} MB。`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setImageError("图片读取失败，请重试。");
        return;
      }
      updateDraft("image", reader.result);
    };
    reader.onerror = () => setImageError("图片读取失败，请重试。");
    reader.readAsDataURL(file);
  }

  const rootClassName = [styles.root, className].filter(Boolean).join(" ");

  return (
    <section className={rootClassName} aria-label="Persona Card 编辑器">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PERSONA CARD SYSTEM</span>
          <h2>人物卡盒</h2>
          <p>固定五张卡是基线；自建卡只进入本机卡盒，不会自动变成已安装 Skill。</p>
        </div>
        <div className={styles.headerActions}>{toolbarActions}<button className={styles.createButton} type="button" onClick={() => beginCreating()}>＋ 新建角色卡</button></div>
      </div>

      <div className={styles.layout}>
        <div className={styles.cardCase} aria-label="人物卡盒">
          <div className={styles.caseHeading}><span>CARDS</span><small>{fixedCards.length} 张固定基线 · {stored.cards.length} 张本机卡</small></div>
          <div className={styles.cardGrid}>
            {cards.map((card, index) => {
              const isSelected = selectedId === card.id;
              const isUsable = card.status === "active";
              const isDraggable = isUsable && !card.templateId;
              const isRandomArt = (card.source === "custom" || card.source === "soul") && card.artSource === "random-pool";
              return (
                <div className={styles.cardWrap} key={card.id}>
                  <button
                    className={`${styles.card} ${isSelected ? styles.cardSelected : ""} ${card.source === "builtin" ? styles.fixedCard : styles.customCard}`}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${card.name}${card.source === "builtin" ? "固定基线" : card.source === "soul" ? "Soul 卡" : "自建卡"}`}
                    disabled={!isUsable}
                    onPointerDown={(event) => {
                      if (isDraggable) onCardDragStart?.(toPersonaCardDragItem(card), event);
                    }}
                    onClick={() => card.templateId ? beginCreating(card) : selectCard(card)}
                  >
                    <span className={styles.cardIndex}>{card.source === "builtin" ? String(index + 1).padStart(2, "0") : card.source === "soul" ? "SOUL" : "自建"}</span>
                    <span className={styles.cardArt} style={{ "--card-color": card.color } as CSSProperties}>
                      {card.image ? <img src={card.image} alt="" draggable={false} /> : <span aria-hidden="true">人</span>}
                    </span>
                    <small>{card.source === "builtin" ? card.code : "CUSTOM PERSONA"}</small>
                    <strong>{card.name || "未命名人物"}</strong>
                    <span>{card.role || "待填写角色"}</span>
                    {card.source === "soul" ? <em>Soul · {card.skillMapping.status === "mapped" ? "Skill 已验证" : "Skill 未映射"}</em> : card.source === "custom" && <em>自建 · 未映射 Skill</em>}
                  </button>
                  {isRandomArt && <button className={styles.artSwapButton} type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); swapRandomArt(card); }}>换一张</button>}
                </div>
              );
            })}
          </div>
          <p className={styles.cardHint}>上半区 drag surface 交给统一 DragLayer；成功 drop 后由页面完成插卡，下半区 inspect 才打开详情。</p>
        </div>

        <aside className={styles.detailPanel} aria-live="polite">
          {draft ? (
            <EditorForm
              draft={draft}
              mode={mode}
              errors={validationErrors}
              imageError={imageError}
              onChange={updateDraft}
              onImageChange={handleImageChange}
              onCancel={cancelEditing}
              onValidate={validateDraft}
              onSave={saveDraft}
            />
          ) : selectedCard ? (
            <CardIntroduction
              card={selectedCard}
              deleteConfirm={deleteConfirmId === selectedCard.id}
              onEdit={() => beginEditing(selectedCard)}
              onInsert={() => onCardInsert?.(selectedCard)}
              onAnnounce={() => onAnnounce?.(selectedCard)}
              onDelete={() => requestDelete(selectedCard)}
              onCancelDelete={() => setDeleteConfirmId(null)}
            />
          ) : (
            <div className={styles.emptyState}><strong>还没有选择人物卡</strong><p>从左侧选择固定卡，或创建一张角色卡。</p><button type="button" onClick={() => beginCreating()}>新建角色卡</button></div>
          )}
          {persistenceWarning && <p className={styles.persistenceWarning} role="status">{persistenceWarning}</p>}
        </aside>
      </div>
    </section>
  );
}

interface EditorFormProps {
  draft: ReturnType<typeof createCustomPersonaCard>;
  mode: PersonaCardEditorMode;
  errors: ReturnType<typeof validatePersonaCardFields>["errors"];
  imageError: string | null;
  onChange: (field: keyof PersonaCardEditableFields, value: string) => void;
  onImageChange: (file: File | undefined) => void;
  onCancel: () => void;
  onValidate: () => boolean;
  onSave: () => void;
}

function createTemplateDraft(template: PersonaCard) {
  return createCustomPersonaCard({
    name: "",
    announcerName: "",
    role: template.role,
    summary: "",
    color: template.color,
    image: "",
  }, { copiedFromId: template.id });
}

function EditorForm({ draft, mode, errors, imageError, onChange, onImageChange, onCancel, onValidate, onSave }: EditorFormProps) {
  const isValidating = mode === "validating";
  return (
    <div className={styles.editorForm}>
      <div className={styles.detailHeading}><span className={styles.eyebrow}>{mode === "creating" ? "NEW PERSONA CARD" : "EDIT PERSONA CARD"}</span><h3>{draft.copiedFromId ? "复制固定卡后编辑" : "创建自建人物卡"}</h3><p>保存前会校验内容；取消不会写入本机卡片存储。</p></div>
      <Field label="名称" error={errors.name}><input value={draft.name} maxLength={80} onChange={(event) => onChange("name", event.target.value)} aria-invalid={Boolean(errors.name)} /></Field>
      <Field label="英文播报名" error={errors.announcerName}><input value={draft.announcerName} maxLength={120} placeholder="例如 Ada Lovelace" onChange={(event) => onChange("announcerName", event.target.value)} aria-invalid={Boolean(errors.announcerName)} /></Field>
      <Field label="角色" error={errors.role}><input value={draft.role} maxLength={80} onChange={(event) => onChange("role", event.target.value)} aria-invalid={Boolean(errors.role)} /></Field>
      <Field label="简介" error={errors.summary}><textarea value={draft.summary} maxLength={500} rows={5} onChange={(event) => onChange("summary", event.target.value)} aria-invalid={Boolean(errors.summary)} /></Field>
      <div className={styles.fieldRow}>
        <Field label="主色" error={errors.color}><div className={styles.colorField}><input type="color" value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : "#ef3048"} onChange={(event) => onChange("color", event.target.value)} /><input value={draft.color} onChange={(event) => onChange("color", event.target.value)} aria-label="主色十六进制值" aria-invalid={Boolean(errors.color)} /></div></Field>
        <Field label="图片" error={errors.image ?? imageError ?? undefined}><input type="file" accept={PERSONA_CARD_IMAGE_ACCEPT} onChange={(event) => onImageChange(event.target.files?.[0])} aria-invalid={Boolean(errors.image || imageError)} /><small className={styles.fieldNote}>本地 JPEG / PNG / WebP，最大 2 MB</small></Field>
      </div>
      {draft.image && <div className={styles.preview}><img src={draft.image} alt="人物卡预览" draggable={false} /><span>图片只会以安全 data URL 或同源本地资源写入本机存储。</span></div>}
      <div className={styles.skillNotice}><strong>Skill 映射</strong><span>当前为“未映射”。英文播报名只用于播报，不会伪装成已安装 Skill。</span></div>
      <div className={styles.formActions}>
        <button type="button" className={styles.ghostButton} onClick={onCancel}>取消</button>
        <button type="button" className={styles.secondaryButton} disabled={isValidating} onClick={onValidate}>校验</button>
        <button type="button" className={styles.primaryButton} disabled={isValidating} onClick={onSave}>保存人物卡</button>
      </div>
    </div>
  );
}

interface CardIntroductionProps {
  card: PersonaCard;
  deleteConfirm: boolean;
  onEdit: () => void;
  onInsert: () => void;
  onAnnounce: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
}

function CardIntroduction({ card, deleteConfirm, onEdit, onInsert, onAnnounce, onDelete, onCancelDelete }: CardIntroductionProps) {
  const isCustom = card.source === "custom";
  const isSoul = card.source === "soul";
  const isLocal = isCustom || isSoul;
  const driverPersona = toDriverPersona(card);
  return (
    <div className={styles.introduction}>
      <div className={styles.detailHeading}><span className={styles.eyebrow}>{isSoul ? "SOUL PERSONA" : isCustom ? "CUSTOM PERSONA" : "FIXED BASELINE"}</span><h3>{card.name}</h3><p>{card.role}</p></div>
      <div className={styles.identityLine}><span className={styles.identityMark} style={{ "--card-color": card.color } as CSSProperties}>{card.name.slice(0, 1) || "人"}</span><div><strong>{card.announcerName || "未设置播报名"}</strong><small>英文播报名</small></div></div>
      <p className={styles.summary}>{card.summary || "还没有人物简介。"}</p>
      <div className={styles.statusLine}><span className={isLocal ? styles.statusCustom : styles.statusFixed}>{isSoul ? "Soul 卡" : isCustom ? "自建卡" : "固定基线"}</span><span>{driverPersona.skillName ? "Skill 已验证" : "Skill 未映射"}</span></div>
      <div className={styles.introActions}>
        <button className={styles.primaryButton} type="button" onClick={onInsert} disabled={card.status !== "active"}>插入中央 Driver</button>
        <button className={styles.secondaryButton} type="button" onClick={onAnnounce}>播报英文名</button>
      </div>
      <div className={styles.editActions}>
        {!isSoul && <button type="button" className={styles.ghostButton} onClick={onEdit}>{isCustom ? "编辑人物卡" : "复制后编辑"}</button>}
        {isLocal && (deleteConfirm ? <span className={styles.deleteConfirm}><button type="button" className={styles.dangerButton} onClick={onDelete}>确认删除</button><button type="button" className={styles.ghostButton} onClick={onCancelDelete}>取消</button></span> : <button type="button" className={styles.deleteButton} onClick={onDelete}>{isSoul ? "仅删除卡片" : "删除自建卡"}</button>)}
      </div>
      <p className={styles.integrationNote}>删除只影响卡片存储，不删除历史唤起记录，也不删除 Soul Skill 或原始素材。</p>
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  children: ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return <label className={styles.field}><span>{label}</span>{children}{error && <small className={styles.error} role="alert">{error}</small>}</label>;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
