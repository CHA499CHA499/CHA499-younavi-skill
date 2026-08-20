"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadPersonaRandomPoolManifest } from "./persona-card-model";
import {
  createManualPersonaCard,
  createSoulClientRunId,
  executeSoulBridgeRun,
  type SoulBridgeRequest,
  type SoulCardRunStatus,
} from "./soul-card-runtime";
import {
  buildSoulCreateRequest,
  createEmptySoulCardWizard,
  normalizeSoulSlug,
  validateSoulWizardState,
  type SoulCardWizardState,
  type SoulMaterialRef,
  type SoulSourceMode,
  type SoulTargetType,
  type SoulTemplateId,
  type SoulWizardMode,
} from "./soul-card-model";
import styles from "./soul-card-wizard.module.css";

export interface SoulCardWizardProps {
  initialMode?: SoulWizardMode;
  initialState?: Partial<SoulCardWizardState>;
  availableMaterials?: readonly SoulMaterialRef[];
  templateId?: SoulTemplateId;
  className?: string;
  bridgeRequest?: SoulBridgeRequest;
  storage?: Storage | null;
  pollIntervalMs?: number;
  onStatusChange?: (status: SoulCardRunStatus) => void;
  onCardReady?: (card: import("./persona-card-model").PersonaCard) => void;
  onClose?: () => void;
  onCancel?: () => void;
  /** Manual mode stays a local empty card and never calls the Soul Bridge. */
  onManualCreate?: (state: SoulCardWizardState) => void;
  /** The parent/connection group sends this validated request to the Node Bridge. */
  onStartSoul?: (request: ReturnType<typeof buildSoulCreateRequest>, state: SoulCardWizardState) => void;
}

const sourceModeLabels: Record<SoulSourceMode, string> = {
  "selected-materials": "已选素材",
  "uploaded-files": "用户提供的文件",
  "younavi-context": "YouNavi 上下文",
  "public-research": "公开研究",
};

function mergeState(props: SoulCardWizardProps): SoulCardWizardState {
  const base = createEmptySoulCardWizard(props.initialMode || "manual", props.templateId || "male");
  const merged = { ...base, ...props.initialState };
  const slug = normalizeSoulSlug(merged.outputSlug || merged.personName);
  return { ...merged, outputSlug: slug, outputDir: `outputs/persona-souls/${slug}-soul` };
}

export function SoulCardWizard({
  initialMode = "manual",
  initialState,
  availableMaterials = [],
  templateId = "male",
  className,
  bridgeRequest,
  storage,
  pollIntervalMs,
  onStatusChange,
  onCardReady,
  onClose,
  onCancel,
  onManualCreate,
  onStartSoul,
}: SoulCardWizardProps) {
  const [state, setState] = useState<SoulCardWizardState>(() => mergeState({ initialMode, initialState, templateId }));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<SoulCardRunStatus | null>(null);
  const cancelledRef = useRef(false);
  const validation = useMemo(() => validateSoulWizardState(state), [state]);
  const selectedIds = new Set(state.selectedMaterials.map((material) => material.id));
  const effectiveStorage = storage === undefined ? getBrowserStorage() : storage;

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  const reportStatus = (status: SoulCardRunStatus) => {
    setRuntimeStatus(status);
    onStatusChange?.(status);
  };
  const update = <K extends keyof SoulCardWizardState>(key: K, value: SoulCardWizardState[K]) => {
    setState((current) => {
      if (key === "personName" && (current.outputSlug === "soul-persona" || !current.outputSlug)) {
        const slug = normalizeSoulSlug(String(value));
        return { ...current, [key]: value, outputSlug: slug, outputDir: `outputs/persona-souls/${slug}-soul` };
      }
      if (key === "outputSlug") {
        const slug = normalizeSoulSlug(String(value));
        return { ...current, outputSlug: slug, outputDir: `outputs/persona-souls/${slug}-soul` };
      }
      return { ...current, [key]: value };
    });
    setSubmitError(null);
  };
  const updatePrivacy = (value: Partial<SoulCardWizardState["privacy"]>) => {
    setState((current) => ({ ...current, privacy: { ...current.privacy, ...value } }));
    setSubmitError(null);
  };
  const toggleMaterial = (material: SoulMaterialRef) => {
    setState((current) => ({
      ...current,
      selectedMaterials: current.selectedMaterials.some((entry) => entry.id === material.id)
        ? current.selectedMaterials.filter((entry) => entry.id !== material.id)
        : [...current.selectedMaterials, material],
    }));
    setSubmitError(null);
  };

  async function submit() {
    if (running) return;
    try {
      setSubmitError(null);
      if (state.mode === "manual") {
        if (!state.personName.trim()) throw new Error("请先填写人物姓名");
        onManualCreate?.(state);
        const manifest = await loadPersonaRandomPoolManifest().catch(() => null);
        const card = createManualPersonaCard(state, effectiveStorage, manifest);
        onCardReady?.(card);
        onClose?.();
        return;
      }
      if (!bridgeRequest) throw new Error("本地 Persona Soul Bridge 尚未接入，无法创建真实 create-soul 任务");
      const request = { ...buildSoulCreateRequest(state), runId: createSoulClientRunId() };
      onStartSoul?.(request, state);
      setRunning(true);
      const manifest = await loadPersonaRandomPoolManifest().catch(() => null);
      const result = await executeSoulBridgeRun({
        request,
        bridgeRequest,
        storage: effectiveStorage,
        manifest,
        onStatus: reportStatus,
        pollIntervalMs,
        cancelled: () => cancelledRef.current,
      });
      onCardReady?.(result.card);
      onClose?.();
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      setSubmitError(message);
      reportStatus({ id: runtimeStatus?.id || "soul-run-error", status: "error", label: state.personName || "Soul 人物卡", detail: message });
    } finally {
      setRunning(false);
    }
  }

  const close = () => {
    cancelledRef.current = true;
    onCancel?.();
    onClose?.();
  };

  return (
    <section className={[styles.root, className].filter(Boolean).join(" ")} aria-label="新建角色卡">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>NEW PERSONA CARD</span>
          <h2>新建角色卡</h2>
          <p>先选一种来源：手动空卡立即保存，或从 Soul 经过交互式采集与 3-Pass 蒸馏。</p>
        </div>
        {(onCancel || onClose) && <button className={styles.textButton} type="button" onClick={close}>{running ? "关闭并在 YouNavi 继续" : "取消"}</button>}
      </header>

      <div className={styles.modeSwitch} role="tablist" aria-label="角色卡来源模式">
        <button type="button" role="tab" aria-selected={state.mode === "manual"} className={state.mode === "manual" ? styles.activeTab : ""} onClick={() => update("mode", "manual")}>A · 手动空卡</button>
        <button type="button" role="tab" aria-selected={state.mode === "from-soul"} className={state.mode === "from-soul" ? styles.activeTab : ""} onClick={() => update("mode", "from-soul")}>B · 从 Soul 提炼</button>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>人物姓名</span>
          <input value={state.personName} maxLength={80} placeholder="例如：林默" onChange={(event) => update("personName", event.target.value)} />
          {validation.errors.personName && <small className={styles.error}>{validation.errors.personName}</small>}
        </label>
        <label className={styles.field}>
          <span>一句话描述</span>
          <input value={state.oneLineDescription} maxLength={240} placeholder="TA 是谁、做什么" onChange={(event) => update("oneLineDescription", event.target.value)} />
          {validation.errors.oneLineDescription && <small className={styles.error}>{validation.errors.oneLineDescription}</small>}
        </label>
      </div>

      {state.mode === "from-soul" ? (
        <div className={styles.soulPanel}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>蒸馏对象</span>
              <select value={state.targetType} onChange={(event) => update("targetType", event.target.value as SoulTargetType)}>
                <option value="self">我自己</option>
                <option value="other">其他人</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>采集方式</span>
              <select value={state.sourceMode} onChange={(event) => update("sourceMode", event.target.value as SoulSourceMode)}>
                {Object.entries(sourceModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          {availableMaterials.length > 0 && state.sourceMode !== "public-research" && (
            <fieldset className={styles.materials}>
              <legend>明确选择素材（不自动扩展读取范围）</legend>
              {availableMaterials.map((material) => (
                <div className={styles.material} key={material.id}>
                  <input id={`soul-material-${material.id}`} type="checkbox" checked={selectedIds.has(material.id)} onChange={() => toggleMaterial(material)} />
                  <label htmlFor={`soul-material-${material.id}`}><strong>{material.label}</strong><small>{material.sourceType} · {material.wordCount.toLocaleString()} 字{material.path ? ` · ${material.path}` : ""}</small></label>
                </div>
              ))}
            </fieldset>
          )}

          {state.sourceMode === "public-research" && (
            <label className={styles.field}>
              <span>允许的公开来源 URL（每行一个）</span>
              <textarea value={state.publicSources.map((source) => source.url).join("\n")} rows={3} placeholder="https://example.com/interview" onChange={(event) => update("publicSources", event.target.value.split(/\n+/).map((url, index) => ({ id: `public-${index + 1}`, label: url.trim(), url: url.trim() })).filter((source) => source.url))} />
            </label>
          )}

          <div className={styles.metrics} aria-live="polite">
            <span>{validation.materialCount} 个素材</span><span>{validation.totalWordCount.toLocaleString()} 字</span>
            {validation.coverageWarning ? <strong>{validation.coverageWarning}</strong> : <em>已达到建议覆盖门槛</em>}
          </div>

          {runtimeStatus && <div className={styles.runtimeStatus} data-soul-status={runtimeStatus.status} role="status"><strong>{runtimeStatus.status}</strong><span>{runtimeStatus.detail}</span>{runtimeStatus.conversationId && <code>conversation · {runtimeStatus.conversationId.slice(0, 12)}</code>}</div>}

          <fieldset className={styles.privacy}>
            <legend>隐私与采集范围确认（必选）</legend>
            <label className={styles.checkRow}><input type="checkbox" checked={state.privacy.confirmed} onChange={(event) => updatePrivacy({ confirmed: event.target.checked, confirmedAt: event.target.checked ? new Date().toISOString() : undefined })} /><span>{state.targetType === "self" ? "我确认只采集下方范围内、与人物画像相关的内容，不读取无关他人隐私。" : "我确认只使用公开来源或我明确提供的文件，不扩大到其他来源。"}</span></label>
            <label className={styles.field}><span>允许采集范围</span><textarea rows={2} value={state.privacy.scopeText} placeholder={state.targetType === "self" ? "例如：近一年产品与招聘会议中的我的发言、我的工作笔记" : "例如：列出的公开访谈 URL，或本次上传的 3 个文件"} onChange={(event) => updatePrivacy({ scopeText: event.target.value })} /></label>
            <label className={styles.field}><span>明确排除</span><textarea rows={2} value={state.privacy.exclusionsText} placeholder="例如：私人聊天、未授权的他人发言、财务与健康信息" onChange={(event) => updatePrivacy({ exclusionsText: event.target.value })} /></label>
          </fieldset>

          {validation.hasSpeakerMixedSources && <label className={styles.checkRow}><input type="checkbox" checked={state.privacy.speakerPurificationConfirmed} onChange={(event) => updatePrivacy({ speakerPurificationConfirmed: event.target.checked })} /><span>我确认会议/群聊已完成发言人纯化；无法确认的段落会标注为 speaker 未确认。</span></label>}
          {(validation.errors.sourceMode || validation.errors.materials || validation.errors.publicSources || validation.errors.privacy || validation.errors.speakerPurification) && <p className={styles.error} role="alert">{Object.values(validation.errors).filter(Boolean).join("；")}</p>}
        </div>
      ) : (
        <p className={styles.manualNotice}>这是本机手动空卡：不会创建 YouNavi 任务，也不会生成或映射 Skill。完整 Soul 资产仍需走 B 模式。</p>
      )}

      <div className={styles.outputRow}>
        <label className={styles.field}><span>Slug 预览</span><input value={state.outputSlug} disabled={running} onChange={(event) => update("outputSlug", event.target.value)} /><small>输出目录：{state.outputDir}</small></label>
        <div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={close}>{running ? "后台继续" : "取消"}</button><button className={styles.primaryButton} type="button" disabled={running} onClick={() => void submit()}>{running ? "Soul 提炼中…" : submitError ? "重试" : state.mode === "manual" ? "创建空卡" : "开始 Soul 向导"}</button></div>
      </div>
      {submitError && <p className={styles.error} role="alert">{submitError}</p>}
    </section>
  );
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}
