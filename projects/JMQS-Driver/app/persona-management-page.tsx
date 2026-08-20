"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ComponentType, FormEvent, ReactNode, RefObject } from "react";
import { getDriverAudioStatus } from "./driver-audio";
import { PersonaCardEditor } from "./persona-card-editor";
import { PERSONA_CARD_TEMPLATE_CARDS, type PersonaCard, type PersonaCardBaseline } from "./persona-card-model";
import { readDocumentFile } from "./rod-content-model";
import type { SoulBridgeRequest, SoulCardRunStatus } from "./soul-card-runtime";
import type { SoulMaterialRef } from "./soul-card-model";
import type { SoulCardWizardProps } from "./soul-card-wizard";
import {
  BUILTIN_MANAGED_PROMPTS,
  DEFAULT_FIXED_MATERIALS,
  PERSONA_ACTIVATION_HISTORY_KEY,
  createCustomMaterial,
  createCustomPrompt,
  emptyCustomMaterialStorage,
  emptyCustomPromptStorage,
  persistCustomMaterialStorage,
  persistCustomPromptStorage,
  readCustomMaterialStorage,
  readCustomPromptStorage,
  renameCustomMaterial,
  type CustomMaterialStorageRecord,
  type CustomPromptStorageRecord,
  type ManagedPrompt,
  type PersonaManagementMaterial,
  type PersonaManagementSection,
} from "./persona-management-model";
import styles from "./persona-management-page.module.css";

type CheckStatus = "idle" | "checking" | "pass" | "warning" | "fail";
type DiagnosticId = "bridge" | "contract" | "audio" | "visual" | "storage" | "errors";
type HealthResponse = {
  ok?: boolean;
  cliAvailable?: boolean;
  error?: string;
  skills?: Record<string, { installed?: boolean }>;
  materials?: Record<string, { available?: boolean }>;
};

interface DiagnosticItem {
  id: DiagnosticId;
  label: string;
  status: CheckStatus;
  detail: string;
}

export type SoulCardWizardComponent = ComponentType<SoulCardWizardProps>;
export type { SoulCardRunStatus } from "./soul-card-runtime";

const SOUL_STATUS_LABELS: Record<SoulCardRunStatus["status"], string> = {
  collecting: "收集中",
  distilling: "蒸馏中",
  assembling: "组装中",
  validating: "验证中",
  ready: "已准备",
  "coverage-warning": "覆盖率提醒",
  "index-warning": "索引未确认",
  error: "失败",
};

const SECTIONS: readonly { id: PersonaManagementSection; label: string; description: string }[] = [
  { id: "prompts", label: "Prompt 预设", description: "管理提问形态与自定义指令" },
  { id: "cards", label: "人物卡", description: "查看基线、模板与自建卡" },
  { id: "diagnostics", label: "状态检测", description: "检查本机运行合同与资源" },
  { id: "materials", label: "素材", description: "管理固定素材与本机文档" },
];

const INITIAL_CHECKS: DiagnosticItem[] = [
  { id: "bridge", label: "Bridge 健康", status: "idle", detail: "尚未检测本机 Persona Navi Bridge。" },
  { id: "contract", label: "Skill / 素材合同", status: "idle", detail: "尚未检测固定 Skill 与素材清单。" },
  { id: "audio", label: "音频资源 / AudioContext", status: "idle", detail: "尚未检测音频资源与浏览器能力。" },
  { id: "visual", label: "视觉资产", status: "idle", detail: "尚未检测 Driver 贴图资源。" },
  { id: "storage", label: "localStorage", status: "idle", detail: "尚未检测本机存储可写性。" },
  { id: "errors", label: "最近错误", status: "idle", detail: "尚未读取最近一次运行记录。" },
];

export interface PersonaManagementPageProps {
  initialSection?: PersonaManagementSection;
  baselineCards: readonly PersonaCardBaseline[];
  fixedMaterials?: readonly PersonaManagementMaterial[];
  storage?: Storage | null;
  bridgeUrl?: string;
  recentErrors?: readonly string[];
  soulCardWizard: SoulCardWizardComponent;
  soulBridgeRequest: SoulBridgeRequest;
  onSoulCardReady?: (card: PersonaCard) => void;
  onPersonaCardsChange?: (cards: readonly PersonaCard[]) => void;
  onBack: () => void;
}

export function PersonaManagementPage({
  initialSection = "prompts",
  baselineCards,
  fixedMaterials = DEFAULT_FIXED_MATERIALS,
  storage,
  bridgeUrl = "http://127.0.0.1:8766",
  recentErrors,
  soulCardWizard: SoulCardWizard,
  soulBridgeRequest,
  onSoulCardReady,
  onPersonaCardsChange,
  onBack,
}: PersonaManagementPageProps) {
  const [section, setSection] = useState<PersonaManagementSection>(initialSection);
  const [promptStorage, setPromptStorage] = useState<CustomPromptStorageRecord>(emptyCustomPromptStorage);
  const [materialStorage, setMaterialStorage] = useState<CustomMaterialStorageRecord>(emptyCustomMaterialStorage);
  const [storageReady, setStorageReady] = useState(false);
  const [promptEditor, setPromptEditor] = useState<ManagedPrompt | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [checks, setChecks] = useState<DiagnosticItem[]>(INITIAL_CHECKS);
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [soulWizardOpen, setSoulWizardOpen] = useState(false);
  const [soulStatuses, setSoulStatuses] = useState<readonly SoulCardRunStatus[]>([]);
  const [cardStorageRevision, setCardStorageRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveStorage = storage === undefined ? getBrowserStorage() : storage;
  const customMaterials = materialStorage.materials;
  const soulMaterials = useMemo(() => [...fixedMaterials, ...customMaterials].map(toSoulMaterialRef), [customMaterials, fixedMaterials]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPromptStorage(readCustomPromptStorage(effectiveStorage));
      setMaterialStorage(readCustomMaterialStorage(effectiveStorage));
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [effectiveStorage]);

  function savePromptStorage(next: CustomPromptStorageRecord) {
    setPromptStorage(next);
    if (storageReady) persistCustomPromptStorage(effectiveStorage, next);
  }

  function saveMaterialStorage(next: CustomMaterialStorageRecord) {
    setMaterialStorage(next);
    if (storageReady) persistCustomMaterialStorage(effectiveStorage, next);
  }

  function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!promptEditor) return;
    try {
      const nextPrompt = createCustomPrompt(promptEditor);
      savePromptStorage({ ...promptStorage, prompts: [...promptStorage.prompts.filter((item) => item.id !== nextPrompt.id), nextPrompt] });
      setPromptEditor(null);
      setPromptError(null);
    } catch (error) {
      setPromptError(String(error instanceof Error ? error.message : error));
    }
  }

  function startPromptCopy(prompt: ManagedPrompt) {
    setPromptEditor(createCustomPrompt({ label: `${prompt.label} 副本`, prompt: prompt.prompt }));
    setPromptError(null);
  }

  function startPromptCreate() {
    setPromptEditor({ id: `draft-${Date.now()}`, source: "custom", presetId: "custom", code: "CUSTOM", label: "我的 Prompt", description: "本机自定义 Prompt", prompt: "", sections: ["自定义回答"] });
    setPromptError(null);
  }

  function startPromptEdit(prompt: ManagedPrompt) {
    setPromptEditor({ ...prompt });
    setPromptError(null);
  }

  function deletePrompt(id: string) {
    savePromptStorage({ ...promptStorage, prompts: promptStorage.prompts.filter((prompt) => prompt.id !== id) });
  }

  async function handleMaterialFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const document = await readDocumentFile(file);
      const material = createCustomMaterial(document);
      saveMaterialStorage({ ...materialStorage, materials: [...materialStorage.materials, material] });
      setMaterialError(null);
    } catch (error) {
      setMaterialError(String(error instanceof Error ? error.message : error));
    }
  }

  function commitMaterialRename(material: PersonaManagementMaterial, name: string) {
    try {
      const nextMaterial = renameCustomMaterial(material, name);
      saveMaterialStorage({ ...materialStorage, materials: materialStorage.materials.map((item) => item.id === material.id ? nextMaterial : item) });
      setRenameId(null);
      setMaterialError(null);
    } catch (error) {
      setMaterialError(String(error instanceof Error ? error.message : error));
    }
  }

  function deleteMaterial(id: string) {
    saveMaterialStorage({ ...materialStorage, materials: materialStorage.materials.filter((material) => material.id !== id) });
    setDeleteId(null);
  }

  function handleSoulStatusChange(next: SoulCardRunStatus) {
    setSoulStatuses((current) => [...current.filter((item) => item.id !== next.id), next]);
  }

  function handleSoulCardReady(card: PersonaCard) {
    setCardStorageRevision((value) => value + 1);
    onSoulCardReady?.(card);
  }

  async function runDiagnostics() {
    setChecking(true);
    setChecks(INITIAL_CHECKS.map((item) => ({ ...item, status: "checking", detail: "正在进行只读检查…" })));
    const result = await inspectDiagnostics({
      baselineCards,
      fixedMaterials,
      bridgeUrl,
      storage: effectiveStorage,
      recentErrors,
    });
    setChecks(result);
    setLastCheckedAt(new Date().toISOString());
    setChecking(false);
  }

  return (
    <main className={styles.page} aria-label="Persona Driver 管理中心">
      <header className={styles.topbar}>
        <button className={styles.backButton} type="button" onClick={onBack} aria-label="返回 Persona Driver 工作台">
          <span aria-hidden="true">←</span> 返回工作台
        </button>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>PERSONA DRIVER</span>
          <h1>管理中心</h1>
        </div>
      </header>

      <div className={styles.shell}>
        <nav className={styles.nav} aria-label="管理分类">
          <span className={styles.navLabel}>管理</span>
          {SECTIONS.map((item) => (
            <button
              className={section === item.id ? styles.navItemActive : styles.navItem}
              type="button"
              key={item.id}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </nav>

        <section className={styles.content} aria-live="polite">
          {section === "prompts" && (
            <PromptSection
              prompts={[...BUILTIN_MANAGED_PROMPTS, ...promptStorage.prompts]}
              warnings={promptStorage.warnings ?? []}
              editor={promptEditor}
              error={promptError}
              onCreate={startPromptCreate}
              onCopy={startPromptCopy}
              onEdit={startPromptEdit}
              onDelete={deletePrompt}
              onEditorChange={setPromptEditor}
              onSubmit={submitPrompt}
              onCancel={() => { setPromptEditor(null); setPromptError(null); }}
            />
          )}
          {section === "cards" && (
            <div className={styles.section}>
              <SectionHeading eyebrow="PERSONA CARDS" title="人物卡" description="固定五卡只读；通用空白卡与“新建角色卡”进入同一创建流程。自建卡不会因为填写了文字而变成已安装 Skill。" />
              <SoulStatusRail statuses={soulStatuses} />
              {soulWizardOpen && <div className={styles.soulWizardFrame}><SoulCardWizard initialMode="from-soul" availableMaterials={soulMaterials} bridgeRequest={soulBridgeRequest} storage={effectiveStorage} onStatusChange={handleSoulStatusChange} onCardReady={handleSoulCardReady} onClose={() => setSoulWizardOpen(false)} /></div>}
              <PersonaCardEditor
                key={`persona-card-editor-${cardStorageRevision}`}
                baselineCards={baselineCards}
                templateCards={PERSONA_CARD_TEMPLATE_CARDS}
                storage={storage}
                onCardsChange={onPersonaCardsChange}
                toolbarActions={<button className={styles.soulButton} type="button" aria-expanded={soulWizardOpen} onClick={() => setSoulWizardOpen(true)}>从 Soul 提炼</button>}
              />
            </div>
          )}
          {section === "diagnostics" && (
            <DiagnosticsSection checks={checks} checking={checking} lastCheckedAt={lastCheckedAt} onRun={() => void runDiagnostics()} />
          )}
          {section === "materials" && (
            <MaterialsSection
              fixedMaterials={fixedMaterials}
              customMaterials={customMaterials}
              error={materialError}
              renameId={renameId}
              deleteId={deleteId}
              fileInputRef={fileInputRef}
              onFileChange={handleMaterialFile}
              onRenameStart={setRenameId}
              onRenameCommit={commitMaterialRename}
              onDeleteStart={setDeleteId}
              onDelete={deleteMaterial}
              onDeleteCancel={() => setDeleteId(null)}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action}</div>;
}

function PromptSection({
  prompts,
  warnings,
  editor,
  error,
  onCreate,
  onCopy,
  onEdit,
  onDelete,
  onEditorChange,
  onSubmit,
  onCancel,
}: {
  prompts: readonly ManagedPrompt[];
  warnings: readonly string[];
  editor: ManagedPrompt | null;
  error: string | null;
  onCreate: () => void;
  onCopy: (prompt: ManagedPrompt) => void;
  onEdit: (prompt: ManagedPrompt) => void;
  onDelete: (id: string) => void;
  onEditorChange: (prompt: ManagedPrompt) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return <div className={styles.section}>
    <SectionHeading eyebrow="PROMPT PRESETS" title="Prompt 预设" description="固定预设来自 rod-content-model，展示真实内容但不直接改写。自定义预设只保存在本机。" action={<button className={styles.primaryButton} type="button" onClick={onCreate}>＋ 新建自定义</button>} />
    {warnings.map((warning) => <p className={styles.promptMigrationWarning} role="status" key={warning}>迁移提醒：{warning}。它不会作为当前预设显示。</p>)}
    {editor && <form className={styles.editorBar} onSubmit={onSubmit} aria-label="编辑自定义 Prompt">
      <div className={styles.formGrid}>
        <label>名称<input value={editor.label} maxLength={80} onChange={(event) => onEditorChange({ ...editor, label: event.target.value })} /></label>
        <label className={styles.promptField}>Prompt<textarea value={editor.prompt} maxLength={4000} rows={4} onChange={(event) => onEditorChange({ ...editor, prompt: event.target.value })} /></label>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.formActions}><button className={styles.ghostButton} type="button" onClick={onCancel}>取消</button><button className={styles.primaryButton} type="submit">保存 Prompt</button></div>
    </form>}
    <div className={styles.recordList}>
      {prompts.map((prompt) => <article className={styles.record} key={prompt.id}>
        <div className={styles.recordMain}><div className={styles.recordHeader}><span className={prompt.source === "builtin" ? styles.sourceFixed : styles.sourceCustom}>{prompt.source === "builtin" ? "固定预设" : "自定义"}</span><code>{prompt.code}</code><h3>{prompt.label}</h3></div><p className={styles.recordDescription}>{prompt.description}</p><p className={styles.promptText}>{prompt.prompt}</p><div className={styles.sectionTags}>{prompt.sections.map((item) => <span key={item}>{item}</span>)}</div></div>
        <div className={styles.recordActions}>{prompt.source === "builtin" ? <button className={styles.ghostButton} type="button" onClick={() => onCopy(prompt)}>复制后编辑</button> : <><button className={styles.ghostButton} type="button" onClick={() => onEdit(prompt)}>编辑</button><button className={styles.dangerTextButton} type="button" onClick={() => onDelete(prompt.id)}>删除</button></>}</div>
      </article>)}
    </div>
  </div>;
}

function SoulStatusRail({ statuses }: { statuses: readonly SoulCardRunStatus[] }) {
  return <section className={styles.soulRail} aria-label="Soul 提炼运行状态">
    <div className={styles.soulRailHeader}><div><span className={styles.eyebrow}>SOUL CARD DISTILLATION</span><h3>从 Soul 提炼</h3></div><span className={styles.soulContract}>只显示运行状态，不代表 Skill 已安装</span></div>
    {statuses.length === 0 && <p className={styles.soulRailEmpty}>尚未开始 Soul 提炼。</p>}
    {statuses.length > 0 && <div className={styles.soulStatusList}>{statuses.map((item) => <article className={styles.soulStatusItem} data-soul-status={item.status} key={item.id}><span className={`${styles.soulStatusBadge} ${styles[`soulStatus_${item.status.replace("-", "_")}`]}`}>{SOUL_STATUS_LABELS[item.status]}</span><div><strong>{item.label ?? "Soul 人物卡"}</strong><p>{item.detail ?? "等待向导更新状态。"}{item.coverage ? ` · 覆盖率：${item.coverage}` : ""}</p></div></article>)}</div>}
  </section>;
}

function DiagnosticsSection({ checks, checking, lastCheckedAt, onRun }: { checks: readonly DiagnosticItem[]; checking: boolean; lastCheckedAt: string | null; onRun: () => void }) {
  const summary = useMemo(() => {
    const pass = checks.filter((item) => item.status === "pass").length;
    const fail = checks.filter((item) => item.status === "fail").length;
    return fail > 0 ? `${fail} 项需要处理` : `${pass}/${checks.length} 项通过`;
  }, [checks]);
  return <div className={styles.section}>
    <SectionHeading eyebrow="READ-ONLY DIAGNOSTICS" title="状态检测" description="只读取 Bridge、资源、AudioContext、视觉资产与本机记录；不会创建 YouNavi 对话或修改工作台状态。" action={<button className={styles.primaryButton} type="button" disabled={checking} onClick={onRun}>{checking ? "检测中…" : "重新检测"}</button>} />
    <div className={styles.diagnosticSummary}>{summary} · 最后检查：{lastCheckedAt ? formatDateTime(lastCheckedAt) : "尚未检查"}</div>
    <div className={styles.diagnosticList}>{checks.map((item) => <article className={`${styles.diagnosticItem} ${styles[`status_${item.status}`]}`} key={item.id}><span className={styles.statusMark} aria-hidden="true">{item.status === "pass" ? "✓" : item.status === "warning" ? "!" : item.status === "fail" ? "×" : "·"}</span><div><h3>{item.label}</h3><p>{item.detail}</p></div></article>)}</div>
  </div>;
}

function MaterialsSection({
  fixedMaterials,
  customMaterials,
  error,
  renameId,
  deleteId,
  fileInputRef,
  onFileChange,
  onRenameStart,
  onRenameCommit,
  onDeleteStart,
  onDelete,
  onDeleteCancel,
}: {
  fixedMaterials: readonly PersonaManagementMaterial[];
  customMaterials: readonly PersonaManagementMaterial[];
  error: string | null;
  renameId: string | null;
  deleteId: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRenameStart: (id: string | null) => void;
  onRenameCommit: (material: PersonaManagementMaterial, name: string) => void;
  onDeleteStart: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteCancel: () => void;
}) {
  return <div className={styles.section}>
    <SectionHeading eyebrow="MATERIAL LIBRARY" title="素材" description="四份固定素材只读；本地自定义文档只接受 .md / .txt，最多 1 MiB。删除只移除素材记录，不影响历史任务快照。" action={<><input ref={fileInputRef} className={styles.visuallyHidden} type="file" accept=".md,.txt,text/markdown,text/plain" onChange={onFileChange} /><button className={styles.primaryButton} type="button" onClick={() => fileInputRef.current?.click()}>＋ 添加本地文档</button></>} />
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.materialGroup}><h3>固定素材 <small>只读</small></h3>{fixedMaterials.map((material) => <MaterialRow key={material.id} material={material} />)}</div>
    <div className={styles.materialGroup}><h3>自定义素材 <small>{customMaterials.length ? `${customMaterials.length} 份` : "暂无"}</small></h3>{customMaterials.length === 0 ? <div className={styles.emptyState}><strong>还没有本地素材</strong><p>添加一份文本文档后，它会只保存在当前浏览器。</p></div> : customMaterials.map((material) => <MaterialRow key={material.id} material={material} renameId={renameId} deleteId={deleteId} onRenameStart={onRenameStart} onRenameCommit={onRenameCommit} onDeleteStart={onDeleteStart} onDelete={onDelete} onDeleteCancel={onDeleteCancel} />)}</div>
  </div>;
}

function MaterialRow({ material, renameId, deleteId, onRenameStart, onRenameCommit, onDeleteStart, onDelete, onDeleteCancel }: { material: PersonaManagementMaterial; renameId?: string | null; deleteId?: string | null; onRenameStart?: (id: string | null) => void; onRenameCommit?: (material: PersonaManagementMaterial, name: string) => void; onDeleteStart?: (id: string) => void; onDelete?: (id: string) => void; onDeleteCancel?: () => void }) {
  const [name, setName] = useState(material.name);
  const isRenaming = renameId === material.id;
  return <article className={styles.materialRow}><div className={styles.materialInfo}><div className={styles.recordHeader}><span className={material.source === "builtin" ? styles.sourceFixed : styles.sourceCustom}>{material.source === "builtin" ? "固定" : "本机"}</span><h3>{isRenaming ? <input className={styles.inlineInput} value={name} maxLength={255} onChange={(event) => setName(event.target.value)} aria-label={`重命名 ${material.name}`} /> : material.name}</h3></div><p>{material.meta}{material.summary ? ` · ${material.summary}` : ""}</p>{material.lastUsedAt && <small>最近使用：{formatDate(material.lastUsedAt)}</small>}</div>{material.source === "custom" && <div className={styles.recordActions}>{isRenaming ? <><button className={styles.primaryButton} type="button" onClick={() => onRenameCommit?.(material, name)}>保存</button><button className={styles.ghostButton} type="button" onClick={() => onRenameStart?.(null)}>取消</button></> : deleteId === material.id ? <><button className={styles.dangerButton} type="button" onClick={() => onDelete?.(material.id)}>确认删除</button><button className={styles.ghostButton} type="button" onClick={onDeleteCancel}>取消</button></> : <><button className={styles.ghostButton} type="button" onClick={() => onRenameStart?.(material.id)}>重命名</button><button className={styles.dangerTextButton} type="button" onClick={() => onDeleteStart?.(material.id)}>删除</button></>}</div>}</article>;
}

async function inspectDiagnostics({ baselineCards, fixedMaterials, bridgeUrl, storage, recentErrors }: { baselineCards: readonly PersonaCardBaseline[]; fixedMaterials: readonly PersonaManagementMaterial[]; bridgeUrl: string; storage: Storage | null; recentErrors?: readonly string[] }): Promise<DiagnosticItem[]> {
  const health = await fetchJson(`${bridgeUrl}/health`);
  const bridge: DiagnosticItem = health?.ok ? { id: "bridge", label: "Bridge 健康", status: "pass", detail: health.cliAvailable ? "本机 Bridge 在线，agent-cli 可用。" : "Bridge 在线，但未找到 agent-cli。" } : { id: "bridge", label: "Bridge 健康", status: "fail", detail: health?.error ?? "未连接到本机 Persona Navi Bridge。" };
  const skillCount = health?.skills ? Object.values(health.skills).filter((item) => item?.installed).length : 0;
  const materialCount = health?.materials ? Object.values(health.materials).filter((item) => item?.available).length : 0;
  const expectedCardsReady = baselineCards.length === 5 && baselineCards.every((card) => Boolean(card.id && card.skillName));
  const expectedMaterialsReady = fixedMaterials.length === 4 && fixedMaterials.every((material) => Boolean(material.id && material.name));
  const contractReady = expectedCardsReady && expectedMaterialsReady && skillCount >= baselineCards.length && materialCount >= fixedMaterials.length;
  const contract: DiagnosticItem = { id: "contract", label: "Skill / 素材合同", status: contractReady ? "pass" : health?.ok ? "warning" : "fail", detail: contractReady ? `${skillCount} 个 Skill、${materialCount} 份固定素材符合合同。` : "固定清单或本机 Skill / 素材尚未全部就绪。" };
  const audio = await inspectAudio();
  const visual = await inspectVisualAssets();
  const storageCheck = inspectStorage(storage);
  const errors = inspectRecentErrors(recentErrors);
  return [bridge, contract, audio, visual, storageCheck, errors];
}

async function inspectAudio(): Promise<DiagnosticItem> {
  const status = getDriverAudioStatus();
  const resource = await fetchResource(status.requiredAnnouncer);
  const capable = status.browserAudio && resource;
  return { id: "audio", label: "音频资源 / AudioContext", status: capable ? "pass" : resource ? "warning" : "fail", detail: capable ? "AudioContext 可用，必需播报资源可读取。" : resource ? "播报资源可读取，但当前浏览器没有 AudioContext。" : "必需播报资源不可读取。" };
}

async function inspectVisualAssets(): Promise<DiagnosticItem> {
  const assets = ["/driver-textures/assembly/center-core-v2.png", "/driver-textures/assembly/left-chassis-v2.png", "/driver-textures/assembly/right-chassis-v2.png"];
  const results = await Promise.all(assets.map(fetchResource));
  return { id: "visual", label: "视觉资产", status: results.every(Boolean) ? "pass" : "fail", detail: results.every(Boolean) ? "Driver 核心与左右槽位贴图均可读取。" : "部分 Driver 贴图不可读取。" };
}

function inspectStorage(storage: Storage | null): DiagnosticItem {
  if (!storage) return { id: "storage", label: "localStorage", status: "warning", detail: "当前环境没有可用的 localStorage。" };
  const probe = `persona-driver.management-probe.${Date.now()}`;
  try {
    storage.setItem(probe, "ok");
    storage.removeItem(probe);
    return { id: "storage", label: "localStorage", status: "pass", detail: "本机存储可写。" };
  } catch {
    return { id: "storage", label: "localStorage", status: "fail", detail: "本机存储不可写，CRUD 只会保留在当前页面。" };
  }
}

function inspectRecentErrors(input?: readonly string[]): DiagnosticItem {
  const errors = input ?? readHistoryErrors();
  return errors.length === 0
    ? { id: "errors", label: "最近错误", status: "pass", detail: "没有发现最近的运行错误。" }
    : { id: "errors", label: "最近错误", status: "warning", detail: `${errors.length} 条最近错误仍保留在本机记录中。` };
}

function toSoulMaterialRef(material: PersonaManagementMaterial): SoulMaterialRef {
  const estimatedBytes = material.size ?? parseMaterialBytes(material.meta);
  const wordCount = material.content
    ? material.content.replace(/\s+/g, "").length
    : Math.max(0, Math.floor(estimatedBytes / 2));
  return {
    id: material.id,
    label: material.name,
    sourceType: "file",
    wordCount,
    ...(material.source === "builtin" ? { fixedMaterialId: material.id } : {
      content: material.content,
      size: material.size,
      mimeType: material.mimeType,
    }),
  };
}

function parseMaterialBytes(meta: string): number {
  const match = meta.match(/([\d.]+)\s*(KB|MB|B)/i);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value * (match[2].toUpperCase() === "MB" ? 1024 * 1024 : match[2].toUpperCase() === "KB" ? 1024 : 1));
}

function readHistoryErrors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PERSONA_ACTIVATION_HISTORY_KEY) ?? "[]");
    return Array.isArray(value) ? value.map((item) => item?.error).filter((error): error is string => typeof error === "string" && Boolean(error.trim())).slice(0, 3) : [];
  } catch {
    return [];
  }
}

async function fetchJson(url: string): Promise<HealthResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2600);
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    window.clearTimeout(timeout);
    const value: unknown = await response.json().catch(() => null);
    return response.ok && value && typeof value === "object" ? value as HealthResponse : { error: `HTTP ${response.status}` };
  } catch {
    return null;
  }
}

async function fetchResource(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
