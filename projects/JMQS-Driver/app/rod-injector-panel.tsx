"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import styles from "./rod-injector.module.css";
import {
  MATERIAL_PRESETS,
  ROD_MAX_DOCUMENT_BYTES,
  SKILL_PROMPT_PRESETS,
  type RodContentState,
  type RodKind,
  type SkillPresetId,
  chargeRod,
  customPromptDraft,
  errorRod,
  fixedMaterialContent,
  promptContentForPreset,
  readDocumentFile,
  rodCardInfo,
  setRodDraft,
  validateCustomPrompt,
} from "./rod-content-model";

export interface RodInjectorPanelProps {
  kind: RodKind;
  state: RodContentState;
  onStateChange: (state: RodContentState) => void;
  onClose?: () => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? bytes + " B" : (bytes / 1024).toFixed(bytes >= 1024 * 100 ? 0 : 1) + " KB";
}

function messageForError(error: unknown): string {
  return error instanceof Error ? error.message : "内容读取失败，请重新选择";
}

export function RodInjectorPanel({ kind, state, onStateChange, onClose, disabled = false }: RodInjectorPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workingState, setWorkingState] = useState<RodContentState>(() => state);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const info = rodCardInfo(workingState);
  const activeContent = workingState.draft ?? workingState.charged;
  const activePrompt = activeContent?.kind === "prompt" ? activeContent : null;
  const activeDocument = activeContent?.kind === "document" ? activeContent : null;
  const activeFixed = activeContent?.kind === "fixed-material" ? activeContent : null;
  const selectedPreset: SkillPresetId | null = activePrompt?.presetId ?? null;
  const hasEnergySource = kind === "energy" && Boolean(activeDocument || activeFixed);
  const hasSkillPrompt = Boolean(activePrompt?.prompt.trim());
  const canConfirm = Boolean(kind === "energy" ? hasEnergySource : hasSkillPrompt) && !busy && !disabled && workingState.status !== "error";
  const skillConfirmLabel = activePrompt?.presetId === "custom"
    ? "保存自定义 Prompt 并充能"
    : activePrompt
      ? "使用「" + activePrompt.label + "」并充能"
      : "选择 Prompt";

  function updateError(error: unknown) {
    setWorkingState(errorRod(workingState, messageForError(error)));
  }

  function selectFixedMaterial(id: (typeof MATERIAL_PRESETS)[number]["id"]) {
    try {
      if (activeFixed?.id === id) {
        setWorkingState(setRodDraft(workingState, null));
        return;
      }
      setWorkingState(setRodDraft(workingState, fixedMaterialContent(id)));
    } catch (error) {
      updateError(error);
    }
  }

  async function acceptFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      setWorkingState(setRodDraft(workingState, await readDocumentFile(file)));
    } catch (error) {
      updateError(error);
    } finally {
      setBusy(false);
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    void acceptFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1) {
      updateError("一次只能注入一个 .md 或 .txt 文件");
      return;
    }
    void acceptFile(files[0]);
  }

  function selectPreset(id: SkillPresetId) {
    try {
      const customPrompt = id === "custom"
        ? customPromptDraft(activePrompt?.presetId === "custom" ? activePrompt.prompt : "")
        : promptContentForPreset(id);
      setWorkingState(setRodDraft(workingState, customPrompt));
    } catch (error) {
      updateError(error);
    }
  }

  function updateCustomPrompt(value: string) {
    try {
      const draft = customPromptDraft(value);
      if (!value.trim()) {
        setWorkingState(errorRod(setRodDraft(workingState, draft), "自定义 Prompt不能为空"));
        return;
      }
      setWorkingState(setRodDraft(workingState, promptContentForPreset("custom", validateCustomPrompt(value))));
    } catch (error) {
      updateError(error);
    }
  }

  function confirm() {
    try {
      if (workingState.status === "error") throw new Error("请先修正内容错误");
      const next = workingState.draft
        ? chargeRod(workingState)
        : workingState.charged
          ? { ...workingState, status: "charged" as const, equipped: false, error: null }
          : (() => { throw new Error("请先选择或导入内容"); })();
      onStateChange(next);
      onClose?.();
    } catch (error) {
      updateError(error);
    }
  }

  const title = kind === "energy" ? "注入上下文能量" : "注入提问形态";
  const eyebrow = kind === "energy" ? "ENERGY ROD · DOCUMENT" : "SKILL ROD · PROMPT";

  return (
    <section className={styles.backdrop} role="presentation" onPointerDown={onClose}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={kind + "-rod-title"} onPointerDown={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h2 id={kind + "-rod-title"}>{title}</h2>
            <p>{kind === "energy" ? "选择一份已验证的本地原文，或导入一份本轮自定义素材。" : "选择一个预设查看实际 Prompt，或切换到自定义并保存到本轮状态。"}</p>
          </div>
          {onClose && <button className={styles.close} type="button" aria-label="关闭注入面板" onClick={onClose}>×</button>}
        </header>

        {kind === "energy" ? (
          <div className={styles.energyBody}>
            <section className={styles.materialSection} aria-labelledby="energy-material-title">
              <div className={styles.sectionHeading}>
                <div>
                  <h3 id="energy-material-title">选择预设素材</h3>
                  <p>直接使用已验证的本地原文。</p>
                </div>
                <span>只读 · 预设</span>
              </div>
              <div className={styles.materialGrid}>
                {MATERIAL_PRESETS.map((material) => (
                  <button
                    key={material.id}
                    className={styles.materialOption + (activeFixed?.id === material.id ? " " + styles.selected : "")}
                    type="button"
                    aria-pressed={activeFixed?.id === material.id}
                    onClick={() => selectFixedMaterial(material.id)}
                  >
                    <span className={styles.materialMark} aria-hidden="true">▤</span>
                    <span className={styles.materialCopy}><strong>{material.name}</strong><small>{material.meta}</small></span>
                    <em>只读预设</em>
                  </button>
                ))}
              </div>
            </section>

            <div className={styles.divider}><span>或者导入自定义素材</span></div>

            <section className={styles.customSection} aria-labelledby="energy-custom-title">
              <div className={styles.sectionHeading}>
                <div>
                  <h3 id="energy-custom-title">自定义素材</h3>
                  <p>仅本地读取单个 Markdown 或纯文本文件；选择上方预设无需上传文件。</p>
                </div>
                <span>上限 {formatBytes(ROD_MAX_DOCUMENT_BYTES)}</span>
              </div>
              <div
                className={styles.dropzone + (dragging ? " " + styles.dragging : "")}
                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
                onDrop={handleDrop}
              >
                <span className={styles.dropMark} aria-hidden="true">⇩</span>
                <strong>{busy ? "正在读取…" : "拖入 .md / .txt 文件"}</strong>
                <small>UTF-8 · 单文件 · 不读取绝对路径</small>
                <button className={styles.browse} type="button" disabled={busy || disabled} onClick={() => fileInputRef.current?.click()}>选择文件</button>
                <input ref={fileInputRef} className={styles.hiddenInput} type="file" accept=".md,.txt,text/markdown,text/plain" onChange={handleFileInput} />
              </div>
              {activeDocument && (
                <article className={styles.documentCard}>
                  <div className={styles.cardHead}>
                    <div><strong>{activeDocument.name}</strong><small>{formatBytes(activeDocument.size)} · {activeDocument.mimeType}</small></div>
                    <button type="button" className={styles.remove} onClick={() => setWorkingState(setRodDraft(workingState, null))}>移除 / 重选</button>
                  </div>
                  <p>{activeDocument.summary || "（无可展示摘要）"}</p>
                  <pre>{activeDocument.content.slice(0, 1200)}{activeDocument.content.length > 1200 ? "\n…" : ""}</pre>
                </article>
              )}
            </section>
          </div>
        ) : (
          <div className={styles.skillBody}>
            <div className={styles.presetGrid} role="listbox" aria-label="技能 Prompt 预设">
              {SKILL_PROMPT_PRESETS.map((preset) => (
                <button key={preset.id} className={styles.preset + (selectedPreset === preset.id ? " " + styles.selected : "")} type="button" role="option" aria-selected={selectedPreset === preset.id} onClick={() => selectPreset(preset.id)}>
                  <small>{preset.code}</small><strong>{preset.label}</strong><span>{preset.description}</span>
                </button>
              ))}
              <button className={styles.preset + (selectedPreset === "custom" ? " " + styles.selected : "")} type="button" role="option" aria-selected={selectedPreset === "custom"} onClick={() => selectPreset("custom")}>
                <small>CUSTOM</small><strong>自定义</strong><span>编辑本轮要交给角色的 Prompt。</span>
              </button>
            </div>
            {activePrompt?.presetId === "custom" && (
              <label className={styles.promptField}>
                <span>自定义 Prompt</span>
                <textarea value={activePrompt.prompt} onChange={(event) => updateCustomPrompt(event.target.value)} maxLength={4000} rows={6} aria-describedby="custom-prompt-safety" />
                <small id="custom-prompt-safety">最多 4,000 字符；不能为空；仅作为本次请求的技能指令，不会改变人物或文件白名单。</small>
              </label>
            )}
          </div>
        )}

        {workingState.error && <p className={styles.error} role="alert">{workingState.error}</p>}
        <footer className={styles.footer}>
          <span>{workingState.status === "charged" ? (info.payloadLabel ?? "内容") + " · 已充能" : workingState.status === "error" ? "内容未通过校验" : "确认后才会注入本轮状态"}</span>
          <button className={styles.confirm} type="button" disabled={!canConfirm} onClick={confirm}>{kind === "energy" ? "确认并充能" : skillConfirmLabel}</button>
        </footer>
      </div>
    </section>
  );
}

export default RodInjectorPanel;
