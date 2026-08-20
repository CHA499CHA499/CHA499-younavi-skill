"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { PersonaCard } from "./persona-card-model";
import styles from "./persona-detail-sheet.module.css";

export interface PersonaDetailSheetProps {
  card: PersonaCard | null;
  /** Open state is page-owned; closing never mutates the card or Driver result. */
  open: boolean;
  onClose: () => void;
  title?: string;
}

type PreviewMode = "motion" | "art" | null;
const FOCUSABLE_SELECTOR = "button:not([disabled]), video[controls], [tabindex]:not([tabindex=\"-1\"])";

export function PersonaDetailSheet({ card, open, onClose, title = "人物详情" }: PersonaDetailSheetProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previewModeRef = useRef<PreviewMode>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { previewModeRef.current = previewMode; }, [previewMode]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (previewModeRef.current) {
          setPreviewMode(null);
          window.requestAnimationFrame(() => previewTriggerRef.current?.focus());
        } else {
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const container = previewModeRef.current ? lightboxRef.current : panelRef.current;
      const focusable = container ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!previewMode) return;
    const frame = window.requestAnimationFrame(() => lightboxCloseRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [previewMode]);

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setPreviewMode(null), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open || !card) return null;

  function closeSheet() {
    setPreviewMode(null);
    onClose();
  }

  function openPreview(mode: Exclude<PreviewMode, null>, event: ReactMouseEvent<HTMLButtonElement>) {
    previewTriggerRef.current = event.currentTarget;
    setPreviewMode(mode);
  }

  function closePreview() {
    setPreviewMode(null);
    window.requestAnimationFrame(() => previewTriggerRef.current?.focus());
  }

  return (
    <div className={styles.root} data-open="true">
      <button className={styles.backdrop} type="button" aria-label="关闭人物详情" onClick={closeSheet} />
      <aside ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="persona-detail-sheet-title">
        <header className={styles.header}>
          <div><span>PERSONA</span><h2 id="persona-detail-sheet-title">{card.name || title}</h2></div>
          <button ref={closeButtonRef} className={styles.closeButton} type="button" aria-label="关闭人物详情" onClick={closeSheet}>×</button>
        </header>
        <div className={styles.cover}>
          {card.image ? <img src={card.image} alt={`${card.name}人物立绘`} draggable={false} /> : <span aria-hidden="true">人</span>}
        </div>
        <div className={styles.actions} aria-label="人物详情操作">
          <button type="button" disabled={!card.motion} onClick={(event) => openPreview("motion", event)}>播放人物动画</button>
          <button type="button" disabled={!card.image} onClick={(event) => openPreview("art", event)}>放大查看立绘</button>
        </div>
      </aside>

      {previewMode && <div ref={lightboxRef} className={styles.lightbox} role="dialog" aria-modal="true" aria-label={previewMode === "motion" ? `${card.name}人物动画` : `${card.name}立绘放大`}>
        <button className={styles.lightboxBackdrop} type="button" aria-label="关闭预览" onClick={closePreview} />
        <div className={styles.lightboxContent}>
          <button ref={lightboxCloseRef} className={styles.lightboxClose} type="button" aria-label="关闭预览" onClick={closePreview}>×</button>
          {previewMode === "motion" && card.motion
            ? <video src={card.motion} poster={card.image || undefined} controls autoPlay muted playsInline><track kind="captions" srcLang="zh-CN" label="无对白动画" /></video>
            : card.image && <img src={card.image} alt={`${card.name}立绘放大`} draggable={false} />}
        </div>
      </div>}
    </div>
  );
}
