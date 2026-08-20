"use client";

import { useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { normalizePersonaCardCollection, type PersonaCard, type PersonaCardDragItem } from "./persona-card-model";
import { toPersonaCardDragItem } from "./persona-card-model";
import { PersonaCardIcon } from "./persona-card-icons";
import { PersonaCardFace } from "./persona-card-face";
import styles from "./persona-card-shelf.module.css";

export interface PersonaCardShelfProps {
  cards: readonly PersonaCard[];
  selectedId?: string | null;
  onInspect: (cardId: string) => void;
  /** Empty-slot templates bypass details and open PersonaCardEditor in creating mode. */
  onCreateFromTemplate?: (template: PersonaCard) => void;
  /** Page-owned deep link to the cards section of PersonaManagementPage; this component never renders a management-page shell. */
  onManage?: () => void;
  /** Page owns the drag/drop transaction and inserts the card after a successful drop; Shelf never inserts or inspects on drag end. */
  onDragStart?: (item: PersonaCardDragItem, event: ReactPointerEvent<HTMLElement>) => void;
  /** Optional lifecycle notification; the pointerup event is allowed to bubble so the page can complete its drop. */
  onDragEnd?: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Changing this value remounts the cards and replays the entrance stagger. */
  entranceKey?: string | number;
  className?: string;
  /** Backward-compatible alias; prefer `onDragStart`. */
  onCardDragStart?: (item: PersonaCardDragItem, event: ReactPointerEvent<HTMLElement>) => void;
}

export function PersonaCardShelf({ cards, selectedId = null, onInspect, onCreateFromTemplate, onManage, onDragStart, onDragEnd, entranceKey = "default", className, onCardDragStart }: PersonaCardShelfProps) {
  const rootClassName = [styles.root, className].filter(Boolean).join(" ");
  const displayCards = normalizePersonaCardCollection(cards);
  const dragStart = onDragStart ?? onCardDragStart;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [popoverSuppressedId, setPopoverSuppressedId] = useState<string | null>(null);

  function beginDrag(event: ReactPointerEvent<HTMLElement>, card: PersonaCard) {
    event.stopPropagation();
    if (card.status !== "active") return;
    setDraggingId(card.id);
    setPopoverSuppressedId(card.id);
    dragStart?.(toPersonaCardDragItem(card), event);
  }

  function finishDrag(event: ReactPointerEvent<HTMLElement>, card: PersonaCard) {
    onDragEnd?.(event);
    setDraggingId(null);
    setPopoverSuppressedId(card.id);
  }

  return (
    <section className={rootClassName} aria-label="Persona Card 卡牌架">
      <div className={styles.header}>
        <div><span className={styles.eyebrow}>PERSONA CARD SHELF</span><strong>选择一张人物卡查看介绍</strong></div>
        {onManage ? <button className={styles.manageButton} type="button" onClick={onManage}>管理卡片</button> : <small>{displayCards.length} 个卡位</small>}
      </div>
      <div className={styles.cards} key={String(entranceKey)}>
        {displayCards.map((card, index) => {
          const isActive = card.status === "active";
          const isSelected = card.id === selectedId;
          const isTemplate = Boolean(card.templateId);
          const style = {
            "--card-color": card.color,
            "--card-index": index,
            "--card-tilt": `${((index % 3) - 1) * 1.4}deg`,
          } as CSSProperties;
          return (
            <article
              className={`${styles.card} ${isSelected ? styles.selected : ""}${draggingId === card.id || popoverSuppressedId === card.id ? ` ${styles.popoverSuppressed}` : ""}`}
              style={style}
              key={`${entranceKey}:${card.id}`}
              aria-label={`${card.name || "未命名人物"}${card.source === "builtin" ? "固定基线" : card.source === "soul" ? "Soul 投影" : "自建卡"}`}
              data-disabled={!isActive}
              onPointerLeave={() => {
                if (draggingId === card.id) setDraggingId(null);
                if (popoverSuppressedId === card.id) setPopoverSuppressedId(null);
              }}
            >
              {isTemplate ? <PersonaCardFace card={card}>
                <button
                  className={`${styles.inspectButton} ${styles.emptySlotButton}`}
                  type="button"
                  aria-label={`使用${card.name}创建人物卡`}
                  disabled={!onCreateFromTemplate}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreateFromTemplate?.(card);
                  }}
                >
                  <span className={styles.copy}>
                    <small>{card.code}</small>
                    <strong>{card.name}</strong>
                    <span>{card.role}</span>
                  </span>
                  <span className={styles.icon} aria-hidden="true"><PersonaCardIcon personaId={card.id} /></span>
                </button>
              </PersonaCardFace> : <>
              <div className={styles.quickPopover} aria-hidden="true">
                <strong>{card.name || "未命名人物"}</strong>
                <span>{card.role || "待填写角色"}</span>
                <p>{card.summary || "还没有人物简介。"}</p>
                <small>{card.skillMapping.status === "mapped" || card.skillBinding.status === "verified" ? "Skill 已映射" : "Skill 未映射"}</small>
              </div>
              <PersonaCardFace card={card}>
              <div
                className={styles.dragSurface}
                aria-label={`拖拽${card.name || "未命名人物"}人物卡`}
                onPointerDown={(event) => beginDrag(event, card)}
                onPointerUp={(event) => finishDrag(event, card)}
                onPointerCancel={(event) => finishDrag(event, card)}
              />
              <button
                className={styles.inspectButton}
                type="button"
                data-persona-card-inspect="true"
                disabled={!isActive}
                aria-pressed={isSelected}
                aria-label={`查看${card.name || "未命名人物"}人物介绍`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onInspect(card.id);
                }}
              >
                <span className={styles.copy}>
                  <small>{card.source === "builtin" ? card.code : "CUSTOM PERSONA"}</small>
                  <strong>{card.name || "未命名人物"}</strong>
                  <span>{card.role || "待填写角色"}</span>
                  {card.source === "custom" && <em>未映射 Skill</em>}
                </span>
                <span className={styles.icon} aria-hidden="true"><PersonaCardIcon personaId={card.id} /></span>
              </button>
              </PersonaCardFace>
              </>}
            </article>
          );
        })}
      </div>
      <p className={styles.hint}>上半区拖拽后由页面完成插卡；下半区 inspect 才打开人物介绍。</p>
    </section>
  );
}
