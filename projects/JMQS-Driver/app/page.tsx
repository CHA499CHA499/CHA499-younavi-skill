"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  checkDriverAudioOutput,
  playActivationSequence,
  playCardInsertSound,
  playCardSelectSound,
  playPackEntrancePreset,
  stopDriverAudio,
  stopPackEntrancePreset,
} from "./driver-audio";
import type { DriverPhase } from "./driver-scene";
import { DriverTextureScene } from "./driver-texture-scene";
import { InteractionDragLayer } from "./interaction-drag-layer";
import { PersonaCardEditor } from "./persona-card-editor";
import { PersonaCardShelf } from "./persona-card-shelf";
import { PersonaCardBack } from "./persona-card-back";
import { PersonaDetailSheet } from "./persona-detail-sheet";
import { PersonaManagementPage } from "./persona-management-page";
import { SoulCardWizard } from "./soul-card-wizard";
import { RunResultSheet } from "./run-result-sheet";
import { humanizeSourceDisplayName } from "./run-result-presentation.mjs";
import type { PersonaManagementSection } from "./persona-management-model";
import {
  toDriverPersona,
  toPersonaCard,
  normalizePersonaCardCollection,
  PERSONA_CARD_TEMPLATE_CARDS,
  type PersonaCard,
  type PersonaCardBaseline,
} from "./persona-card-model";
import RodInjectorPanel from "./rod-injector-panel";
import {
  buildPersonaNaviRodRequest,
  createEmptyRodState,
  migrateRodState,
  type RodContentState,
  type SkillPresetId,
} from "./rod-content-model";

interface Persona {
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

const PERSONAS: Persona[] = [
  {
    id: "naval",
    name: "纳瓦尔",
    announcerName: "Naval Ravikant",
    skillName: "naval-perspective",
    role: "长期主义策略师",
    code: "LEVERAGE ARCHITECT",
    color: "#d8b25c",
    image: "/personas/naval-action-masked-v3.jpg",
    motion: "/personas-motion/naval.mp4",
    motionPoster: "/personas-motion/naval.jpg",
    summary: "从长期复利、杠杆和独立判断出发，检查任务是否值得持续投入。",
    tags: ["长期主义", "杠杆", "判断"],
  },
  {
    id: "musk",
    name: "埃隆·马斯克",
    announcerName: "Elon Musk",
    skillName: "elon-musk-perspective",
    role: "第一性原理工程师",
    code: "FIRST PRINCIPLE",
    color: "#ef3048",
    image: "/personas/elon-musk-action-masked-v3.jpg",
    motion: "/personas-motion/elon-musk.mp4",
    motionPoster: "/personas-motion/elon-musk.jpg",
    summary: "把复杂问题拆回物理约束、成本边界和可执行工程步骤。",
    tags: ["第一性原理", "工程", "速度"],
  },
  {
    id: "jobs",
    name: "史蒂夫·乔布斯",
    announcerName: "Steve Jobs",
    skillName: "steve-jobs-perspective",
    role: "产品体验主理人",
    code: "FOCUS EDITOR",
    color: "#d7dde5",
    image: "/personas/steve-jobs-action-masked-v3.jpg",
    motion: "/personas-motion-v3-intense/steve-jobs-action-masked-intense-v3.mp4",
    summary: "聚焦用户真正感知的价值，删掉多余功能，强化产品叙事与整体体验。",
    tags: ["产品", "审美", "聚焦"],
  },
  {
    id: "trump",
    name: "唐纳德·特朗普",
    announcerName: "Donald John Trump",
    skillName: "trump-perspective",
    role: "注意力谈判者",
    code: "DEAL MAKER",
    color: "#e86836",
    image: "/personas/donald-trump-action-masked-v3.jpg",
    motion: "/personas-motion-v3-intense/donald-trump-action-masked-intense-v3.mp4",
    summary: "从筹码、声量和谈判位置出发，判断如何获得更主动的局面。",
    tags: ["谈判", "传播", "筹码"],
  },
  {
    id: "pg",
    name: "Paul Graham",
    announcerName: "Paul Graham",
    skillName: "paul-graham-perspective",
    role: "创业问题诊断师",
    code: "FOUNDER SIGNAL",
    color: "#7ba6d9",
    image: "/personas/paul-graham-action-masked-v3.jpg",
    motion: "/personas-motion-v3-intense/paul-graham-action-masked-intense-v3.mp4",
    summary: "识别真正的问题和用户信号，避免用复杂方案掩盖尚未成立的需求。",
    tags: ["创业", "写作", "用户"],
  },
];

const MATERIALS = [
  { id: "jobs-gates-d5", name: "乔布斯盖茨 D5 大会对话", displayName: "乔布斯与比尔·盖茨 D5 大会访谈原文", technicalName: "FuVenture_乔布斯盖茨D5大会对话_转写文本.txt", meta: "100 KB · 乔布斯 × 盖茨" },
  { id: "jobs-1990", name: "乔布斯访谈 1990", displayName: "史蒂夫·乔布斯 1990 访谈原文", technicalName: "乔布斯访谈1990_转写文本.txt", meta: "59 KB · Steve Jobs" },
  { id: "gates-ted", name: "比尔·盖茨 TED Interview", displayName: "比尔·盖茨 TED 访谈原文", technicalName: "比尔盖茨_TED_Interview_原转写.txt", meta: "45 KB · Bill Gates" },
  { id: "liang-alive", name: "梁文道《活着（二）》", displayName: "梁文道《一千零一夜：活着（二）》转写原文", technicalName: "梁文道_一千零一夜_活着二_转写文本.txt", meta: "28 KB · 梁文道" },
];

const COMMANDS = [
  { id: "explain", label: "解释", code: "EXPLAIN", description: "补齐背景和历史逻辑" },
  { id: "review", label: "评审", code: "REVIEW", description: "检查方案与明显风险" },
  { id: "decision", label: "决策", code: "DECISION", description: "比较选项和代价" },
  { id: "action", label: "行动", code: "ACTION", description: "整理下一步与责任" },
  { id: "custom", label: "自定义", code: "CUSTOM", description: "编辑本轮要交给角色的 Prompt" },
];

const DRIVER_RODS = [
  { id: "energy", code: "ENERGY ROD", label: "能量棒", description: "装载能量与强化等级" },
  { id: "skill", code: "SKILL ROD", label: "技能棒", description: "装载招式与执行指令" },
] as const;

type DriverRodId = (typeof DRIVER_RODS)[number]["id"];
type DriverDropTarget = "persona" | "energy" | "skill" | null;
type HeldWorkbenchItem = { kind: "persona" | "rod"; id: string; label: string; detail: string; image?: string; color?: string };

const DRIVER_ROD_DROP_BOUNDS: Record<DriverRodId, { left: number; right: number; top: number; bottom: number }> = {
  energy: { left: 0.2417, right: 0.3093, top: 0.239, bottom: 0.761 },
  skill: { left: 0.6907, right: 0.7583, top: 0.239, bottom: 0.761 },
};

interface RodState {
  content: RodContentState;
  /** Compatibility bridge for the original fixed material/preset path. */
  fixedMaterialId: string | null;
  fixedPresetId: SkillPresetId | null;
}

function emptyRodState(kind: "energy" | "skill"): RodState {
  return { content: createEmptyRodState(kind), fixedMaterialId: null, fixedPresetId: null };
}

function buildPersonaTask(command: { id: string }, sourceName: string, customPrompt?: string): string {
  if (command.id === "custom") return customPrompt?.trim() || "基于所选素材完成本次分析。";
  const tasks: Record<string, string> = {
    review: `评审所选素材《${sourceName}》中的观点、成立条件、风险和需补证部分。`,
    explain: `解释所选素材《${sourceName}》的背景、关键概念、因果链和历史逻辑。`,
    decision: `基于所选素材《${sourceName}》比较方案、代价和不可逆风险并给出建议。`,
    action: `基于所选素材《${sourceName}》提炼行动、负责人、验收标准与风险。`,
  };
  return tasks[command.id] ?? `基于所选素材《${sourceName}》完成本次分析。`;
}

const NAVI_BRIDGE_URL = "http://127.0.0.1:8766";
const ACTIVATION_HISTORY_KEY = "persona-driver.activation-history.v1";
const ACTIVATION_HISTORY_LIMIT = 50;
const PACK_PROGRESS_KEY = "persona-driver.pack-progress.v1";

type NaviRunStatus = "idle" | "creating" | "pending" | "running" | "completed" | "incomplete" | "error" | "demo";
type AppScreen = "cover" | "starter-pack" | "deal-cards" | "workbench" | "management";
type SystemCheckStatus = "idle" | "checking" | "pass" | "warning" | "fail";
type ActivationMotionStatus = "idle" | "loading" | "playing" | "ended" | "error" | "skipped";

const NAVI_RUN_LABELS: Record<NaviRunStatus, string> = {
  idle: "待机",
  creating: "正在创建",
  pending: "已入队",
  running: "执行中",
  completed: "已完成",
  incomplete: "读取不完整",
  error: "需要处理",
  demo: "演示模式",
};

const RUN_STATUS_CARD_LABELS: Record<NaviRunStatus, string> = {
  idle: "未发送",
  creating: "创建中",
  pending: "生成中",
  running: "生成中",
  completed: "已完成",
  incomplete: "读取不完整",
  error: "失败",
  demo: "演示模式",
};

interface NaviRunState {
  status: NaviRunStatus;
  runId?: string;
  taskId?: string;
  conversationId?: string;
  contentMarkdown?: string;
  task?: string;
  commandId?: string;
  coverage?: Array<{ mode: string; sourceName: string; technicalName?: string; path?: string; bytes?: number; readLines?: number | null; totalLines?: number | null; sha256?: string }>;
  metadata?: {
    title?: string;
    task?: string;
    persona?: { id?: string | null; displayName?: string | null; skillName?: string | null };
    command?: { id?: string | null; code?: string | null; label?: string | null; instruction?: string | null };
    source?: { displayName?: string; technicalName?: string | null; path?: string | null; sha256?: string | null };
  };
  error?: string;
  errorCode?: string;
  openError?: string;
}

interface ActivationHistoryRecord {
  id: string;
  createdAt: string;
  personaId: string;
  personaName: string;
  commandId: string;
  commandCode: string;
  status: NaviRunStatus;
  runId?: string;
  taskId?: string;
  conversationId?: string;
  error?: string;
  errorCode?: string;
  openError?: string;
}

interface PackProgressRecord {
  version: 1;
  selectedPackId: "classic-five" | "starter" | null;
  packOpened: boolean;
  revealedPackIds: string[];
  viewedEntranceIds: string[];
}

interface SystemCheckItem {
  id: "sources" | "flow" | "handoff";
  label: string;
  status: SystemCheckStatus;
  detail: string;
}

const INITIAL_SYSTEM_CHECKS: SystemCheckItem[] = [
  { id: "sources", label: "前期资料", status: "idle", detail: "尚未检查固定人物卡与原始转写说明。" },
  { id: "flow", label: "中间流程", status: "idle", detail: "尚未检查卡片、腰带、双棒和音频反馈。" },
  { id: "handoff", label: "最终接入", status: "idle", detail: "尚未检查本机 Navi Bridge。" },
];


function createPersonaRunId(): string {
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `prun-${value.toLowerCase()}`;
}

function isLocalPersonaRuntime(): boolean {
  return typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function readActivationHistory(): ActivationHistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(ACTIVATION_HISTORY_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is ActivationHistoryRecord => Boolean(entry && typeof entry.id === "string" && typeof entry.createdAt === "string" && typeof entry.personaName === "string" && typeof entry.commandCode === "string" && typeof entry.status === "string")).slice(0, ACTIVATION_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function readPackProgress(): PackProgressRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(PACK_PROGRESS_KEY) ?? "null");
    if (value?.version !== 1 || typeof value.packOpened !== "boolean" || !Array.isArray(value.revealedPackIds) || !Array.isArray(value.viewedEntranceIds)) return null;
    return {
      version: 1,
      selectedPackId: value.selectedPackId === "classic-five" || value.selectedPackId === "starter" ? value.selectedPackId : null,
      packOpened: value.packOpened,
      revealedPackIds: value.revealedPackIds.filter((id: unknown): id is string => typeof id === "string"),
      viewedEntranceIds: value.viewedEntranceIds.filter((id: unknown): id is string => typeof id === "string"),
    };
  } catch {
    return null;
  }
}

function formatActivationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function Home() {
  const [energyRod, setEnergyRod] = useState<RodState>(() => emptyRodState("energy"));
  const [skillRod, setSkillRod] = useState<RodState>(() => emptyRodState("skill"));
  const [injector, setInjector] = useState<"energy" | "skill" | null>(null);
  const [cardEditorOpen, setCardEditorOpen] = useState(false);
  const [cardEditorTemplateId, setCardEditorTemplateId] = useState<string | null>(null);
  const [cardDetailOpen, setCardDetailOpen] = useState(false);
  const [personaCards, setPersonaCards] = useState<readonly PersonaCard[]>(() => normalizePersonaCardCollection(PERSONAS.map((persona) => toPersonaCard(persona))));
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [screen, setScreen] = useState<AppScreen>("cover");
  const [managementSection, setManagementSection] = useState<PersonaManagementSection>("prompts");
  const [selectedPackId, setSelectedPackId] = useState<PackProgressRecord["selectedPackId"]>(null);
  const [packOpened, setPackOpened] = useState(false);
  const [revealedPackIds, setRevealedPackIds] = useState<string[]>([]);
  const [viewedEntranceIds, setViewedEntranceIds] = useState<string[]>([]);
  const [packEntrancePersonaId, setPackEntrancePersonaId] = useState<string | null>(null);
  const [entranceCopyVisible, setEntranceCopyVisible] = useState(false);
  const [activationMotionPersonaId, setActivationMotionPersonaId] = useState<string | null>(null);
  const [activationMotionStatus, setActivationMotionStatus] = useState<ActivationMotionStatus>("idle");
  const [activationMotionDiagnostic, setActivationMotionDiagnostic] = useState<string | null>(null);
  const [packProgressReady, setPackProgressReady] = useState(false);
  const dealRunRef = useRef(false);
  const revealedPackIdsRef = useRef<string[]>([]);
  const soundEnabledRef = useRef(true);
  const packEntranceVideoRef = useRef<HTMLVideoElement | null>(null);
  const activationVideoRef = useRef<HTMLVideoElement | null>(null);
  const [phase, setPhase] = useState<DriverPhase>("idle");
  const [resultSheetOpen, setResultSheetOpen] = useState(false);
  const autoOpenedResultRunIdRef = useRef<string | null>(null);
  const pendingAutoOpenRunIdRef = useRef<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [handleProgress, setHandleProgress] = useState(0);
  const [equippedRods, setEquippedRods] = useState<Record<DriverRodId, boolean>>({ energy: false, skill: false });
  const [naviRun, setNaviRun] = useState<NaviRunState>({ status: "idle" });
  const [activationHistory, setActivationHistory] = useState<ActivationHistoryRecord[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [systemChecks, setSystemChecks] = useState<SystemCheckItem[]>(INITIAL_SYSTEM_CHECKS);
  const [systemCheckOpen, setSystemCheckOpen] = useState(false);
  const [systemChecking, setSystemChecking] = useState(false);
  const [heldItem, setHeldItem] = useState<HeldWorkbenchItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DriverDropTarget>(null);
  const [dragPointer, setDragPointer] = useState({ x: 0, y: 0 });
  const handleProgressRef = useRef(0);
  const packProgressResetRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const activationStartedRef = useRef(false);
  const naviTokenRef = useRef<string | null>(null);
  const handleDragRef = useRef<{ side: "left" | "right"; startX: number; startProgress: number } | null>(null);
  const handleMovedRef = useRef(false);
  const suppressHandleClickRef = useRef(false);
  const driverStageRef = useRef<HTMLElement>(null);
  const heldItemRef = useRef<HeldWorkbenchItem | null>(null);
  const grabRef = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const dropTargetRef = useRef<DriverDropTarget>(null);
  const suppressInspectRef = useRef<string | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const systemCheckButtonRef = useRef<HTMLButtonElement>(null);

  const availablePersonas = personaCards.map((card) => toDriverPersona(card));
  const selectedPersona = availablePersonas.find((persona) => persona.id === selectedPersonaId) ?? null;
  const selectedPersonaCard = personaCards.find((card) => card.id === selectedPersonaId) ?? null;
  const selectedMaterial = energyRod.content.charged?.kind === "fixed-material"
    ? energyRod.content.charged
    : MATERIALS.find((material) => material.id === energyRod.fixedMaterialId) ?? null;
  const selectedMaterialDefinition = selectedMaterial ? MATERIALS.find((material) => material.id === selectedMaterial.id) : null;
  const selectedDocument = energyRod.content.charged?.kind === "document" ? energyRod.content.charged : null;
  const selectedSourceDisplayName = selectedDocument
    ? humanizeSourceDisplayName(selectedDocument.name)
    : selectedMaterialDefinition?.displayName ?? selectedMaterial?.name ?? "本次材料";
  const selectedSourceTechnicalName = selectedDocument?.name
    ?? selectedMaterialDefinition?.technicalName
    ?? selectedMaterial?.name
    ?? "";
  const selectedPrompt = skillRod.content.charged?.kind === "prompt"
    ? skillRod.content.charged
    : null;
  const selectedCommand = COMMANDS.find((command) => command.id === (selectedPrompt?.presetId ?? skillRod.fixedPresetId)) ?? null;
  const selectedMaterialIds = selectedMaterial ? [selectedMaterial.id] : [];
  const energyCharged = Boolean(energyRod.content.charged?.kind === "document" || energyRod.content.charged?.kind === "fixed-material" || selectedMaterial);
  const skillCharged = Boolean(skillRod.content.charged?.kind === "prompt");
  const rodsReady = equippedRods.energy && equippedRods.skill;
  const rodsRevealed = phase === "locked" || phase === "activated";
  const equippedRodCount = Number(equippedRods.energy) + Number(equippedRods.skill);
  const packComplete = revealedPackIds.length === PERSONAS.length;
  const packEntrancePersona = PERSONAS.find((persona) => persona.id === packEntrancePersonaId) ?? null;
  const activationMotionPersona = PERSONAS.find((persona) => persona.id === activationMotionPersonaId) ?? null;

  function updateHandleProgress(value: number) {
    handleProgressRef.current = value;
    setHandleProgress(value);
  }

  function itemKey(item: HeldWorkbenchItem) {
    return `${item.kind}:${item.id}`;
  }

  function updateHeldItem(item: HeldWorkbenchItem | null) {
    heldItemRef.current = item;
    setHeldItem(item);
  }

  function updateDropTarget(target: DriverDropTarget) {
    if (dropTargetRef.current === target) return;
    dropTargetRef.current = target;
    setDropTarget(target);
  }

  function addActivationHistory(record: ActivationHistoryRecord) {
    setActivationHistory((current) => [record, ...current.filter((entry) => entry.id !== record.id)].slice(0, ACTIVATION_HISTORY_LIMIT));
  }

  function updateActivationHistory(id: string, patch: Partial<ActivationHistoryRecord>) {
    setActivationHistory((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function getDropTarget(clientX: number, clientY: number, item: HeldWorkbenchItem): DriverDropTarget {
    const stage = driverStageRef.current;
    if (!stage) return null;
    const assembly = stage.querySelector<HTMLElement>(".driver-assembly");
    const rect = assembly?.getBoundingClientRect() ?? stage.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    if (item.kind === "persona") return x > 0.42 && x < 0.58 && y > 0.17 && y < 0.83 ? "persona" : null;
    if (item.kind === "rod" && phase === "locked") {
      if (item.id !== "energy" && item.id !== "skill") return null;
      const bounds = DRIVER_ROD_DROP_BOUNDS[item.id];
      return x > bounds.left && x < bounds.right && y > bounds.top && y < bounds.bottom ? item.id : null;
    }
    return null;
  }

  function beginItemGrab(event: ReactPointerEvent<HTMLElement>, item: HeldWorkbenchItem) {
    if (event.button !== 0) return;
    if (item.kind === "persona") setCardDetailOpen(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    grabRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    setDragPointer({ x: event.clientX, y: event.clientY });
    updateHeldItem(item);
    updateDropTarget(getDropTarget(event.clientX, event.clientY, item));
  }

  function moveItemGrab(event: ReactPointerEvent<HTMLElement>) {
    const grab = grabRef.current;
    const item = heldItemRef.current;
    if (!grab || !item || grab.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - grab.startX, event.clientY - grab.startY) > 6) grab.moved = true;
    setDragPointer({ x: event.clientX, y: event.clientY });
    updateDropTarget(getDropTarget(event.clientX, event.clientY, item));
  }

  function applyItemDrop(item: HeldWorkbenchItem, target: DriverDropTarget) {
    if (item.kind === "persona" && target === "persona") {
      insertPersona(item.id);
      return;
    }
    if (item.kind === "rod" && target === item.id) {
      equipRod(item.id);
      return;
    }
  }

  function endItemGrab(event: ReactPointerEvent<HTMLElement>) {
    const grab = grabRef.current;
    const item = heldItemRef.current;
    if (!grab || !item || grab.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (grab.moved) {
      suppressInspectRef.current = itemKey(item);
      event.preventDefault();
      event.stopPropagation();
    }
    if (item.kind === "persona") setCardDetailOpen(false);
    if (dropTargetRef.current) applyItemDrop(item, dropTargetRef.current);
    grabRef.current = null;
    updateHeldItem(null);
    setDragPointer({ x: 0, y: 0 });
    updateDropTarget(null);
  }

  function consumeSuppressedItemClick(kind: HeldWorkbenchItem["kind"], id: string) {
    const key = `${kind}:${id}`;
    if (suppressInspectRef.current !== key) return false;
    suppressInspectRef.current = null;
    return true;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActivationHistory(readActivationHistory());
      setHistoryReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const progress = readPackProgress();
      if (progress) {
        setSelectedPackId(progress.selectedPackId);
        setRevealedPackIds(progress.revealedPackIds.filter((id) => PERSONAS.some((persona) => persona.id === id)));
        setViewedEntranceIds(progress.viewedEntranceIds.filter((id) => PERSONAS.some((persona) => persona.id === id)));
        setPackOpened(progress.packOpened);
        if (progress.packOpened) setScreen("deal-cards");
        else if (progress.selectedPackId) setScreen("starter-pack");
      }
      setPackProgressReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    revealedPackIdsRef.current = revealedPackIds;
  }, [revealedPackIds]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (screen !== "deal-cards" || !packOpened || packComplete || dealRunRef.current) return;
    dealRunRef.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const missing = PERSONAS.filter((persona) => !revealedPackIdsRef.current.includes(persona.id));
    const timers = missing.map((persona, index) => window.setTimeout(() => {
      if (soundEnabledRef.current) {
        try { playCardInsertSound(); } catch { /* Audio feedback is optional. */ }
      }
    }, index * 180));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [packOpened, packComplete, screen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setEntranceCopyVisible(Boolean(packEntrancePersonaId)), packEntrancePersonaId ? 240 : 0);
    return () => window.clearTimeout(timer);
  }, [packEntrancePersonaId]);

  useEffect(() => {
    if (!packEntrancePersonaId) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishPackReveal(packEntrancePersonaId);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [packEntrancePersonaId]);

  useEffect(() => {
    const video = activationVideoRef.current;
    return () => { if (video) video.pause(); };
  }, [activationMotionPersonaId]);

  useEffect(() => {
    const video = packEntranceVideoRef.current;
    return () => { if (video) video.pause(); };
  }, [packEntrancePersonaId]);

  useEffect(() => {
    if (!historyReady || typeof window === "undefined") return;
    window.localStorage.setItem(ACTIVATION_HISTORY_KEY, JSON.stringify(activationHistory.slice(0, ACTIVATION_HISTORY_LIMIT)));
  }, [activationHistory, historyReady]);

  useEffect(() => {
    if (!packProgressReady || packProgressResetRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(PACK_PROGRESS_KEY, JSON.stringify({
      version: 1,
      selectedPackId,
      packOpened,
      revealedPackIds,
      viewedEntranceIds,
    } satisfies PackProgressRecord));
  }, [packOpened, packProgressReady, revealedPackIds, selectedPackId, viewedEntranceIds]);

  useEffect(() => {
    if (!historyOpen && !systemCheckOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (systemCheckOpen) {
        setSystemCheckOpen(false);
        systemCheckButtonRef.current?.focus();
        return;
      }
      setHistoryOpen(false);
      historyButtonRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [historyOpen, systemCheckOpen]);

  useEffect(() => {
    if (!resultSheetOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setResultSheetOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [resultSheetOpen]);

  useEffect(() => {
    if (naviRun.status !== "completed" || !naviRun.contentMarkdown || !naviRun.runId) return;
    if (autoOpenedResultRunIdRef.current === naviRun.runId) return;
    const hasModal = cardDetailOpen || cardEditorOpen || Boolean(injector) || screen === "management" || Boolean(heldItem);
    if (hasModal || screen !== "workbench") {
      pendingAutoOpenRunIdRef.current = naviRun.runId;
      return;
    }
    autoOpenedResultRunIdRef.current = naviRun.runId;
    pendingAutoOpenRunIdRef.current = null;
    const timer = window.setTimeout(() => setResultSheetOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [cardDetailOpen, cardEditorOpen, heldItem, injector, naviRun.contentMarkdown, naviRun.runId, naviRun.status, screen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      stopPackEntrancePreset();
      stopDriverAudio();
    };
  }, []);

  function choosePersona(personaId: string, { openDetail = true }: { openDetail?: boolean } = {}) {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setSelectedPersonaId(personaId);
    setPhase("ready");
    setNaviRun({ status: "idle" });
    setResultSheetOpen(false);
    autoOpenedResultRunIdRef.current = null;
    pendingAutoOpenRunIdRef.current = null;
    activationStartedRef.current = false;
    setEquippedRods({ energy: false, skill: false });
    updateHandleProgress(0);
    setCardDetailOpen(openDetail);
    if (soundEnabled) playCardSelectSound();
  }

  function restartExperience() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    resetDriver();
    setEnergyRod(emptyRodState("energy"));
    setSkillRod(emptyRodState("skill"));
    setInjector(null);
    setCardEditorOpen(false);
    setCardEditorTemplateId(null);
    setCardDetailOpen(false);
    setSelectedPackId(null);
    setPackOpened(false);
    setRevealedPackIds([]);
    setViewedEntranceIds([]);
    setPackEntrancePersonaId(null);
    setEntranceCopyVisible(false);
    dealRunRef.current = false;
    setHistoryOpen(false);
    setSystemCheckOpen(false);
    setSystemChecking(false);
    setSystemChecks(INITIAL_SYSTEM_CHECKS);
    if (typeof window !== "undefined") window.localStorage.removeItem(PACK_PROGRESS_KEY);
    packProgressResetRef.current = true;
    setScreen("cover");
  }

  function finishPackReveal(personaId: string) {
    if (!PERSONAS.some((persona) => persona.id === personaId)) return;
    stopPackEntrancePreset();
    setRevealedPackIds((current) => current.includes(personaId) ? current : [...current, personaId]);
    setViewedEntranceIds((current) => current.includes(personaId) ? current : [...current, personaId]);
    setPackEntrancePersonaId(null);
    setEntranceCopyVisible(false);
    if (soundEnabledRef.current) {
      try { playCardInsertSound(); } catch { /* Static reveal remains usable without audio. */ }
    }
  }

  function revealPackCard(personaId: string) {
    if (packEntrancePersonaId) return;
    const persona = PERSONAS.find((item) => item.id === personaId);
    if (!persona) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !persona.motion) {
      finishPackReveal(personaId);
      return;
    }
    setEntranceCopyVisible(false);
    setPackEntrancePersonaId(personaId);
    if (soundEnabledRef.current) playPackEntrancePreset(personaId);
  }

  function revealAllPackCards() {
    const video = packEntranceVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    stopPackEntrancePreset();
    const allPersonaIds = PERSONAS.map((persona) => persona.id);
    setPackEntrancePersonaId(null);
    setEntranceCopyVisible(false);
    setRevealedPackIds(allPersonaIds);
    setViewedEntranceIds(allPersonaIds);
    dealRunRef.current = true;
  }

  function finishActivationMotion(status: Extract<ActivationMotionStatus, "ended" | "error">, diagnostic?: string) {
    const video = activationVideoRef.current;
    if (video) video.pause();
    setActivationMotionStatus(status);
    setActivationMotionDiagnostic(diagnostic ?? null);
    setActivationMotionPersonaId(null);
  }

  async function playActivationMotionVideo() {
    const video = activationVideoRef.current;
    if (!video) return;
    try {
      video.currentTime = 0;
      await video.play();
      setActivationMotionStatus("playing");
    } catch {
      finishActivationMotion("error", `角色动画无法自动播放，已降级为静态合体：${video.currentSrc || activationMotionPersona?.motion || "资源未知"}`);
    }
  }

  function triggerActivationMotion(persona: Persona) {
    setActivationMotionDiagnostic(null);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActivationMotionPersonaId(null);
      setActivationMotionStatus("skipped");
      return;
    }
    if (!persona.motion) {
      setActivationMotionPersonaId(null);
      setActivationMotionStatus("error");
      setActivationMotionDiagnostic(`未配置 ${persona.name} 的角色动画，已降级为静态合体。`);
      return;
    }
    setActivationMotionStatus("loading");
    setActivationMotionPersonaId(persona.id);
  }

  function openStarterPack() {
    packProgressResetRef.current = false;
    if (revealedPackIds.length === PERSONAS.length) {
      setScreen("deal-cards");
      return;
    }
    dealRunRef.current = false;
    setSelectedPackId("starter");
    setScreen(packOpened ? "deal-cards" : "starter-pack");
  }

  function tearStarterPack() {
    if (packOpened) return;
    packProgressResetRef.current = false;
    setPackOpened(true);
    setSelectedPackId("starter");
    dealRunRef.current = false;
    setScreen("deal-cards");
    if (soundEnabled) playCardInsertSound();
  }

  function enterWorkbench(personaId?: string) {
    setScreen("workbench");
    if (personaId) choosePersona(personaId);
  }

  function openTemplateCardEditor(template: PersonaCard) {
    if (!template.templateId) return;
    setCardDetailOpen(false);
    setCardEditorTemplateId(template.id);
    setCardEditorOpen(true);
  }

  function handleCardSaved(card: PersonaCard) {
    setPersonaCards((current) => normalizePersonaCardCollection([...current.filter((item) => item.id !== card.id), card]));
    setCardEditorOpen(false);
    setCardEditorTemplateId(null);
    choosePersona(card.id, { openDetail: false });
  }

  function handleSoulCardReady(card: PersonaCard) {
    setPersonaCards((current) => normalizePersonaCardCollection([...current.filter((item) => item.id !== card.id), card]));
    setSelectedPersonaId(card.id);
    setCardDetailOpen(false);
  }

  function inspectPersona(personaId: string) {
    const card = personaCards.find((item) => item.id === personaId);
    if (card?.templateId) {
      openTemplateCardEditor(card);
      return;
    }
    if (consumeSuppressedItemClick("persona", personaId)) return;
    choosePersona(personaId);
  }

  function mergePersonaCards(cards: readonly PersonaCard[]) {
    setPersonaCards(normalizePersonaCardCollection(cards));
  }

  function openManagement(section: PersonaManagementSection = "prompts") {
    stopDriverAudio();
    setCardDetailOpen(false);
    setResultSheetOpen(false);
    setManagementSection(section);
    setScreen("management");
  }

  function returnFromManagement() {
    setScreen("workbench");
  }

  function insertPersona(personaId = selectedPersonaId) {
    if (!personaId) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setSelectedPersonaId(personaId);
    setNaviRun({ status: "idle" });
    setResultSheetOpen(false);
    activationStartedRef.current = false;
    setEquippedRods({ energy: false, skill: false });
    updateHandleProgress(0);
    setCardDetailOpen(false);
    setPhase("inserting");
    if (soundEnabled) playCardInsertSound();
    timerRef.current = window.setTimeout(() => setPhase("locked"), 920);
  }

  async function naviRequest(path: string, options: RequestInit = {}) {
    const send = (token: string | null) => fetch(`${NAVI_BRIDGE_URL}${path}`, {
        ...options,
        cache: "no-store",
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { "X-Persona-Navi-Token": token } : {}),
          ...(options.headers ?? {}),
        },
      });
    let response = await send(naviTokenRef.current);
    let payload = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
    if (path !== "/health" && response.status === 403 && payload.code === "INVALID_REQUEST_TOKEN") {
      const healthResponse = await fetch(`${NAVI_BRIDGE_URL}/health`, { cache: "no-store" });
      const health = await healthResponse.json().catch(() => ({ ok: false }));
      if (healthResponse.ok && health.ok && health.token) {
        naviTokenRef.current = health.token;
        response = await send(health.token);
        payload = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
      }
    }
    if (!response.ok || !payload.ok) {
      const detail = payload.error || `Bridge 请求失败（HTTP ${response.status}）`;
      throw new Error(payload.code ? `${detail} [${payload.code}]` : detail);
    }
    return payload;
  }

  function classifyNaviError(error: unknown): { message: string; code?: string } {
    const message = String((error as Error)?.message || error);
    if (/Failed to fetch|fetch failed|NetworkError|ECONNREFUSED/i.test(message)) {
      return { message: "Bridge 未启动；请运行 pnpm dev:persona 后点击重新创建。", code: "BRIDGE_OFFLINE" };
    }
    const code = message.match(/\[([A-Z][A-Z0-9_]+)\]$/)?.[1];
    return { message, code };
  }

  async function ensureNaviBridge(persona: Persona, materialIds: string[]) {
    if (!persona.skillName) throw new Error("这张自建卡尚未映射可执行 Skill；卡片可编辑/展示，但需映射 Skill 后才能唤起 YouNavi。");
    const health = await naviRequest("/health");
    if (!health.cliAvailable) throw new Error("未找到可用的 YouNavi agent-cli");
    if (!health.skills?.[persona.id]?.installed) throw new Error(`YouNavi 未安装 ${persona.skillName}`);
    const missingMaterial = materialIds.find((materialId) => !health.materials?.[materialId]?.available);
    if (missingMaterial) throw new Error(`原始素材不可读：${missingMaterial}`);
    naviTokenRef.current = health.token;
  }

  async function openNaviRun(runId: string, rethrow = false) {
    try {
      await naviRequest(`/runs/${encodeURIComponent(runId)}/open`, { method: "POST" });
      setNaviRun((current) => ({ ...current, openError: undefined }));
    } catch (error) {
      const classified = classifyNaviError(error);
      const openError = classified.code ? `${classified.message} [${classified.code}]` : classified.message;
      setNaviRun((current) => ({ ...current, openError }));
      updateActivationHistory(runId, { openError });
      if (rethrow) throw error;
    }
  }

  async function startNaviConversation(persona: Persona, command: (typeof COMMANDS)[number]) {
    const startedAt = new Date().toISOString();
    if (!isLocalPersonaRuntime()) {
      setNaviRun({ status: "demo" });
      setPhase("activated");
      addActivationHistory({ id: createPersonaRunId(), createdAt: startedAt, personaId: persona.id, personaName: persona.name, commandId: command.id, commandCode: command.code, status: "demo" });
      return;
    }
    const runId = createPersonaRunId();
    const materialIds = MATERIALS.filter((material) => selectedMaterialIds.includes(material.id)).map((material) => material.id);
    const sourceName = selectedSourceDisplayName;
    const customPrompt = skillRod.content.charged?.kind === "prompt" && skillRod.content.charged.presetId === "custom"
      ? skillRod.content.charged.prompt
      : undefined;
    const task = buildPersonaTask(command, sourceName, customPrompt);
    setNaviRun({ status: "creating", runId, task, commandId: command.id });
    setResultSheetOpen(false);
    autoOpenedResultRunIdRef.current = null;
    pendingAutoOpenRunIdRef.current = null;
    addActivationHistory({ id: runId, createdAt: startedAt, personaId: persona.id, personaName: persona.name, commandId: command.id, commandCode: command.code, status: "creating", runId });
    try {
      await ensureNaviBridge(persona, materialIds);
      const payload = buildPersonaNaviRodRequest({ runId, personaId: persona.id, task, energy: energyRod.content, skill: skillRod.content });
      const receipt = await naviRequest("/runs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPhase("activated");
      if (soundEnabled) {
        playActivationSequence(persona.id, persona.announcerName, command.id, command.code);
      }
      setNaviRun({
        status: receipt.status === "running" ? "running" : "pending",
        runId,
        taskId: receipt.taskId,
        conversationId: receipt.conversationId,
        task,
        commandId: command.id,
      });
      updateActivationHistory(runId, { status: receipt.status === "running" ? "running" : "pending", taskId: receipt.taskId, conversationId: receipt.conversationId });
      await openNaviRun(runId);
    } catch (error) {
      const classified = classifyNaviError(error);
      const errorMessage = classified.code ? `${classified.message} [${classified.code}]` : classified.message;
      setNaviRun({ status: "error", runId, error: errorMessage, errorCode: classified.code });
      updateHandleProgress(0);
      activationStartedRef.current = false;
      updateActivationHistory(runId, { status: "error", error: errorMessage, errorCode: classified.code });
    }
  }

  async function checkNaviRun() {
    if (!naviRun.runId) return;
    try {
      const result = await naviRequest(`/runs/${encodeURIComponent(naviRun.runId)}`);
      setNaviRun((current) => ({
        ...current,
        status: result.status,
        taskId: result.taskId,
        conversationId: result.conversationId,
        contentMarkdown: result.contentMarkdown,
        coverage: result.coverage,
        metadata: result.metadata,
        error: ["error", "incomplete"].includes(result.status) ? (result.error || "Navi 任务未通过语义审计") : undefined,
        errorCode: result.errorCode,
      }));
      updateActivationHistory(naviRun.runId, { status: result.status, taskId: result.taskId, conversationId: result.conversationId, error: ["error", "incomplete"].includes(result.status) ? (result.error || "Navi 任务未通过语义审计") : undefined, errorCode: result.errorCode });
    } catch (error) {
      const classified = classifyNaviError(error);
      const errorMessage = classified.code ? `${classified.message} [${classified.code}]` : classified.message;
      setNaviRun((current) => ({ ...current, status: "error", error: errorMessage, errorCode: classified.code }));
      updateActivationHistory(naviRun.runId, { status: "error", error: errorMessage, errorCode: classified.code });
    }
  }

  useEffect(() => {
    if (!naviRun.runId || !["pending", "running"].includes(naviRun.status)) return;
    const timer = window.setInterval(() => { void checkNaviRun(); }, 2200);
    return () => window.clearInterval(timer);
    // The polling callback is intentionally recreated per run identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naviRun.runId, naviRun.status]);

  async function runSystemCheck() {
    setSystemCheckOpen(true);
    setHistoryOpen(false);
    setSystemChecking(true);
    setSystemChecks(INITIAL_SYSTEM_CHECKS.map((item) => ({ ...item, status: "checking", detail: "正在进行最短检查…" })));

    const sourcesReady = PERSONAS.length === 5
      && MATERIALS.length === 4
      && PERSONAS.every((persona) => Boolean(persona.skillName && persona.image))
      && MATERIALS.every((material) => Boolean(material.name && material.meta));
    const audioReady = await checkDriverAudioOutput();
    const flowReady = Boolean(
      document.querySelector('[aria-label="Persona Card 卡牌架"]')
      && document.querySelector(".driver-assembly")
      && document.querySelectorAll(".driver-rod-card").length === DRIVER_RODS.length,
    );

    let handoff: SystemCheckItem;
    if (!isLocalPersonaRuntime()) {
      handoff = { id: "handoff", label: "最终接入", status: "warning", detail: "公开演示环境不连接本机 Navi；页面会以演示模式结束。" };
    } else {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2400);
      try {
        const response = await fetch(`${NAVI_BRIDGE_URL}/health`, { cache: "no-store", signal: controller.signal });
        const health = await response.json().catch(() => null);
        const skillsReady = PERSONAS.every((persona) => health?.skills?.[persona.id]?.installed);
        const materialsReady = MATERIALS.every((material) => health?.materials?.[material.id]?.available);
        handoff = response.ok && health?.ok && health?.cliAvailable && skillsReady && materialsReady
          ? { id: "handoff", label: "最终接入", status: "pass", detail: "Navi Bridge、五个 Skill 和四份原始转写均可用。" }
          : { id: "handoff", label: "最终接入", status: "fail", detail: "Bridge、Skill 或原始转写未就绪；启动不会创建真实对话。" };
      } catch {
        handoff = { id: "handoff", label: "最终接入", status: "fail", detail: "未连接到本机 Navi Bridge（localhost:8766）。" };
      } finally {
        window.clearTimeout(timeout);
      }
    }

    setSystemChecks([
      { id: "sources", label: "前期资料", status: sourcesReady ? "pass" : "fail", detail: sourcesReady ? "五张人物卡与四份原始转写说明已就绪。" : "人物卡或原始转写说明缺失。" },
      {
        id: "flow",
        label: "中间流程",
        status: flowReady && audioReady && soundEnabled && energyCharged && skillCharged ? "pass" : "warning",
        detail: flowReady
          ? audioReady && soundEnabled
            ? energyCharged && skillCharged
              ? "卡片、腰带、双棒、已注入内容与浏览器音频反馈正常。"
              : "结构与音频正常；仍需给能量棒注入原文、给技能棒注入提问形态。"
            : "卡片与腰带正常；请开启音效或检查浏览器音频权限。"
          : "工作台组件未完整挂载。",
      },
      handoff,
    ]);
    setSystemChecking(false);
  }

  function openResultSheet() {
    if (naviRun.status !== "completed" || !naviRun.contentMarkdown) return;
    setResultSheetOpen(true);
  }

  function retryNaviRun() {
    if (!selectedPersona || !selectedCommand) return;
    setResultSheetOpen(false);
    void startNaviConversation(selectedPersona, selectedCommand);
  }

  function activateDriver() {
    if (!selectedPersona || !selectedCommand || !selectedPersona.skillName || phase !== "locked" || !rodsReady || activationStartedRef.current) return;
    activationStartedRef.current = true;
    setResultSheetOpen(false);
    updateHandleProgress(1);
    setPhase("activated");
    triggerActivationMotion(selectedPersona);
    void startNaviConversation(selectedPersona, selectedCommand);
  }

  function resetDriver() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setSelectedPersonaId(null);
    setPhase("idle");
    setResultSheetOpen(false);
    setNaviRun({ status: "idle" });
    const activationVideo = activationVideoRef.current;
    if (activationVideo) activationVideo.pause();
    setActivationMotionPersonaId(null);
    setActivationMotionStatus("idle");
    setActivationMotionDiagnostic(null);
    activationStartedRef.current = false;
    autoOpenedResultRunIdRef.current = null;
    pendingAutoOpenRunIdRef.current = null;
    setEquippedRods({ energy: false, skill: false });
    naviTokenRef.current = null;
    grabRef.current = null;
    updateHeldItem(null);
    updateDropTarget(null);
    setDragPointer({ x: 0, y: 0 });
    suppressInspectRef.current = null;
    handleDragRef.current = null;
    handleMovedRef.current = false;
    suppressHandleClickRef.current = false;
    updateHandleProgress(0);
    stopDriverAudio();
  }

  function beginHandleDrag(event: ReactPointerEvent<HTMLButtonElement>, side: "left" | "right") {
    if (phase !== "locked" || !rodsReady) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    handleDragRef.current = { side, startX: event.clientX, startProgress: handleProgressRef.current };
    handleMovedRef.current = false;
    suppressHandleClickRef.current = false;
  }

  function moveHandleDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = handleDragRef.current;
    if (!drag || phase !== "locked" || !rodsReady) return;
    const signedDistance = drag.side === "left" ? event.clientX - drag.startX : drag.startX - event.clientX;
    if (Math.abs(signedDistance) > 4) handleMovedRef.current = true;
    updateHandleProgress(Math.max(0, Math.min(1, drag.startProgress + signedDistance / 92)));
  }

  function endHandleDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!handleDragRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    handleDragRef.current = null;
    if (!handleMovedRef.current) return;
    suppressHandleClickRef.current = true;
    if (handleProgressRef.current >= 0.72) activateDriver();
    else updateHandleProgress(0);
  }

  function handleHandleClick() {
    if (suppressHandleClickRef.current) {
      suppressHandleClickRef.current = false;
      return;
    }
    activateDriver();
  }

  function equipRod(rodId: string) {
    if (phase !== "locked" || (rodId !== "energy" && rodId !== "skill")) return;
    const validRodId = rodId as DriverRodId;
    if (equippedRods[validRodId]) return;
    setEquippedRods((current) => ({ ...current, [validRodId]: true }));
    if (soundEnabled) playCardInsertSound();
  }

  function updateEnergyRod(content: RodContentState) {
    const charged = content.charged?.kind === "fixed-material" ? content.charged : null;
    setEnergyRod({ content: migrateRodState(content), fixedMaterialId: charged?.id ?? null, fixedPresetId: null });
  }

  function updateSkillRod(content: RodContentState) {
    const migrated = migrateRodState(content);
    const charged = migrated.charged?.kind === "prompt" && migrated.charged.presetId !== "custom" ? migrated.charged : null;
    setSkillRod({ content: migrated, fixedMaterialId: null, fixedPresetId: charged?.presetId ?? null });
  }

  function renderRodCase() {
    return (
      <>
        <div className="rod-case" aria-label="变身棒收纳架">
        {DRIVER_RODS.map((rod) => {
          const equipped = equippedRods[rod.id];
          if (equipped) return null;
          const charged = rod.id === "energy" ? energyCharged : skillCharged;
          const payloadLabel = rod.id === "energy" ? selectedMaterial?.name : selectedCommand?.label;
          const available = phase === "locked" && charged && !equipped;
          return (
            <button
              className={`driver-rod-card ${rod.id}${equipped ? " equipped" : ""}${charged ? " is-charged" : ""}${heldItem?.kind === "rod" && heldItem.id === rod.id ? " is-lifted" : ""}`}
              type="button"
              key={rod.id}
              disabled={equipped}
              aria-pressed={equipped}
              aria-label={equipped ? `${rod.label}已装配` : charged ? `${rod.label}已充能，点击调整或拖入腰带` : `点击为${rod.label}注入内容`}
              onPointerDown={(event) => {
                if (available) beginItemGrab(event, { kind: "rod", id: rod.id, label: rod.label, detail: payloadLabel ?? rod.code, image: rod.id === "energy" ? "/driver-textures/energy-rod-charged-v1.png" : "/driver-textures/skill-rod-v1.png" });
              }}
              onClick={() => {
                if (consumeSuppressedItemClick("rod", rod.id)) return;
                setInjector(rod.id);
              }}
            >
              <span className="driver-rod-visual" aria-hidden="true"><i /></span>
              <small>{equipped ? "LOADED" : charged ? "CHARGED" : "EMPTY"}</small>
              <strong>{rod.label}</strong>
              <span>{equipped ? "已装配" : charged ? payloadLabel : "点击注入"}</span>
            </button>
          );
        })}
        </div>
      </>
    );
  }

  if (screen === "cover") {
    return (
      <main className="persona-cover">
        <div className="persona-cover-copy">
          <span className="persona-cover-kicker">PERSONA DRIVER · PUBLIC TEST</span>
          <h1>假面骑事</h1>
          <p>领取新手卡包，解锁你的第一组 Persona Card。</p>
          <button className="cover-primary" type="button" onClick={openStarterPack}>准备变身</button>
          <small>本地测试版 · 不读取真实飞书数据</small>
        </div>
        <div className="persona-cover-signal" aria-hidden="true"><span>PERSONA RIDE</span><i /></div>
      </main>
    );
  }

  if (screen === "starter-pack") {
    return (
      <main className="pack-opening-screen">
        <header className="pack-screen-header"><button className="pack-back" type="button" onClick={() => setScreen("cover")}>返回封面</button><div><span>STARTER PACK</span><strong>新手卡包</strong></div></header>
        <section className="pack-opening-content">
          <div className="pack-opening-copy"><span>STARTER PACK ACQUIRED</span><h1>已获得新手卡包</h1><p>五张 Persona Card 将按顺序落位，准备好后一次收下。</p></div>
          <button className="sealed-pack" type="button" aria-label="撕开新手卡包" onClick={tearStarterPack}><img className="sealed-pack-logo" src="/brand/persona-gate-logo-v1-256.png" alt="假面骑事" draggable={false} /><strong>撕开卡包</strong><small>STARTER PACK · 5 CARDS</small></button>
        </section>
      </main>
    );
  }

  if (screen === "deal-cards") {
    return (
      <main className="pack-opening-screen">
        <header className="pack-screen-header"><div><span>DEAL CARDS</span><strong>新手卡包</strong></div></header>
        <section className={`pack-opening-content is-opened${packComplete ? " is-complete" : ""}`}>
          <div className="pack-opening-copy pack-reveal-copy"><h1>{packComplete ? "五张卡牌已就位" : "点击任意卡牌翻开"}</h1><p>{packComplete ? "可重播角色动画，或进入工作台。" : `任选卡牌观看角色动画 · ${revealedPackIds.length}/5`}</p></div>
          <div className="pack-reveal-grid" aria-label="新手 Persona Card">
            {PERSONAS.map((persona, index) => {
              const revealed = revealedPackIds.includes(persona.id);
              return <button className={`pack-reveal-card${revealed ? " revealed" : ""}`} style={{ "--pack-delay": `${index * 140}ms` } as CSSProperties} key={persona.id} type="button" aria-pressed={revealed} aria-label={revealed ? `重播${persona.name}角色动画` : `翻开${persona.name}`} onClick={() => revealPackCard(persona.id)}>
                {revealed ? <span className="pack-reveal-face pack-reveal-front"><img src={persona.image} alt="" draggable={false} /><span><small>{persona.code}</small><strong>{persona.name}</strong><em>{persona.role}</em></span></span> : <span className="pack-reveal-face pack-reveal-back"><PersonaCardBack /><small>点击翻开</small></span>}
              </button>;
            })}
          </div>
          {!packComplete && <button className="pack-skip-all" type="button" onClick={revealAllPackCards}>跳过动画</button>}
          {packComplete && <button className="pack-to-workbench" type="button" onClick={() => enterWorkbench()}>收下卡牌，进入工作台</button>}
        </section>
        {packEntrancePersona && (
          <div className="pack-entrance" role="dialog" aria-modal="true" aria-label={`${packEntrancePersona.name}角色动画`}>
            <video ref={packEntranceVideoRef} className="pack-entrance-video" src={packEntrancePersona.motion} poster={packEntrancePersona.motionPoster ?? packEntrancePersona.image} autoPlay muted playsInline preload="auto" onEnded={() => finishPackReveal(packEntrancePersona.id)} onError={() => finishPackReveal(packEntrancePersona.id)} />
            <div className={`pack-entrance-copy${entranceCopyVisible ? " is-visible" : ""}`}><span>{packEntrancePersona.code}</span><strong>{packEntrancePersona.name}</strong><small>{packEntrancePersona.role}</small></div>
            <button className="pack-entrance-skip" type="button" onClick={revealAllPackCards}>跳过动画</button>
          </div>
        )}
      </main>
    );
  }

  if (screen === "management") {
    return (
      <PersonaManagementPage
        initialSection={managementSection}
        baselineCards={PERSONAS satisfies readonly PersonaCardBaseline[]}
        bridgeUrl={NAVI_BRIDGE_URL}
        recentErrors={naviRun.error ? [naviRun.error] : []}
        soulCardWizard={SoulCardWizard}
        soulBridgeRequest={naviRequest}
        onSoulCardReady={handleSoulCardReady}
        onPersonaCardsChange={mergePersonaCards}
        onBack={returnFromManagement}
      />
    );
  }

  return (
    <main
      className="driver-workbench"
      onPointerMove={moveItemGrab}
      onPointerUp={endItemGrab}
      onPointerCancel={endItemGrab}
      onDragStart={(event) => event.preventDefault()}
    >
      <header className="workbench-header">
        <div className="workbench-brand">
          <img className="workbench-mark" src="/brand/persona-gate-logo-v1-32.png" alt="假面骑事" />
          <div><strong>假面骑事</strong><small>PERSONA DRIVER WORKBENCH</small></div>
        </div>
        <div className="header-actions">
          <button className="management-toggle" type="button" aria-label="打开管理中心" onClick={() => openManagement("prompts")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 13.5 5.8l2.7.6.6 2.7L19 10.5l-1.5 2.3 1.5 2.3-2.2 1.4-.6 2.7-2.7.6L12 22l-1.5-2.2-2.7-.6-.6-2.7L5 15.1l1.5-2.3L5 10.5l2.2-1.4.6-2.7 2.7-.6L12 3.5Z" /><circle cx="12" cy="12.8" r="2.7" /></svg>
          </button>
          <button className="history-toggle" type="button" aria-label="重新开始当前体验，不清除唤起记录" onClick={restartExperience}>重新开始</button>
          <button ref={systemCheckButtonRef} className={systemCheckOpen ? "system-check-toggle active" : "system-check-toggle"} type="button" aria-expanded={systemCheckOpen} aria-controls="system-check-panel" onClick={() => void runSystemCheck()}>
            {systemChecking ? "检查中…" : "检查状态"}
          </button>
          <button ref={historyButtonRef} className={historyOpen ? "history-toggle active" : "history-toggle"} type="button" aria-expanded={historyOpen} aria-controls="activation-history-panel" onClick={() => setHistoryOpen((value) => !value)}>
            唤起记录{activationHistory.length > 0 ? ` · ${activationHistory.length}` : ""}
          </button>
          <button
          className={soundEnabled ? "sound-toggle enabled" : "sound-toggle"}
          type="button"
          aria-pressed={soundEnabled}
          onClick={() => {
            if (soundEnabled) stopDriverAudio();
            setSoundEnabled((value) => !value);
          }}
        >
          {soundEnabled ? "音效开启" : "音效关闭"}
          </button>
        </div>
      </header>

      {systemCheckOpen && (
        <aside id="system-check-panel" className="system-check-panel" role="dialog" aria-label="启动流程状态检查">
          <div className="system-check-head"><div><strong>启动流程检查</strong><small>不创建真实对话 · 只读检查</small></div><button type="button" className="history-close" aria-label="关闭状态检查" onClick={() => { setSystemCheckOpen(false); systemCheckButtonRef.current?.focus(); }}>×</button></div>
          <div className="system-check-list">
            {systemChecks.map((item) => <article className={`system-check-item status-${item.status}`} key={item.id}><span className="system-check-mark" aria-hidden="true">{item.status === "pass" ? "✓" : item.status === "warning" ? "!" : item.status === "fail" ? "×" : "·"}</span><div><strong>{item.label}</strong><p>{item.detail}</p></div></article>)}
          </div>
          <button className="system-check-rerun" type="button" disabled={systemChecking} onClick={() => void runSystemCheck()}>{systemChecking ? "正在检查…" : "重新检查"}</button>
        </aside>
      )}

      {historyOpen && (
        <aside id="activation-history-panel" className="activation-history-panel" role="dialog" aria-label="Persona 唤起记录">
          <div className="activation-history-head"><div><strong>唤起记录</strong><small>仅保存在当前浏览器</small></div><button type="button" className="history-close" aria-label="关闭唤起记录" onClick={() => { setHistoryOpen(false); historyButtonRef.current?.focus(); }}>×</button></div>
          {activationHistory.length === 0 ? <div className="activation-history-empty"><strong>还没有唤起记录</strong><p>完成一次 Persona Driver 启动后，记录会出现在这里。</p></div> : <><div className="activation-history-list">{activationHistory.map((entry) => <article className="activation-history-item" key={entry.id}><div className="activation-history-item-head"><strong>{entry.personaName}</strong><span className={`history-status status-${entry.status}`}>{NAVI_RUN_LABELS[entry.status] ?? entry.status}</span></div><div className="activation-history-meta"><span>{entry.commandCode}</span><time dateTime={entry.createdAt}>{formatActivationTime(entry.createdAt)}</time></div>{entry.conversationId && <code title={entry.conversationId}>conversation · {entry.conversationId.slice(0, 12)}</code>}{entry.error && <p className="history-error">{entry.error}</p>}{entry.openError && <p className="history-warning">未自动打开：{entry.openError}</p>}{entry.runId && entry.conversationId && <button className="history-open-run" type="button" onClick={() => void openNaviRun(entry.runId!)}>打开 YouNavi</button>}</article>)}</div><button className="history-clear" type="button" onClick={() => setActivationHistory([])}>清空全部记录</button></>}
        </aside>
      )}

      {injector === "energy" && <RodInjectorPanel kind="energy" state={energyRod.content} onStateChange={updateEnergyRod} onClose={() => setInjector(null)} />}
      {injector === "skill" && <RodInjectorPanel kind="skill" state={skillRod.content} onStateChange={updateSkillRod} onClose={() => setInjector(null)} />}

      <div className={rodsRevealed ? "workbench-grid has-rods" : "workbench-grid workbench-empty"}>
        {rodsRevealed && <aside className="rod-tray">
          <div className="panel-title"><span>01</span><div><strong>变身组件</strong><small>先注入，锁定后可拖入</small></div></div>
          {renderRodCase()}
          <p className="rod-tray-note">点击棒注入内容；充能后再拖入腰带左右槽位。</p>
        </aside>}
        <section
          className={`driver-stage phase-${phase}${heldItem ? ` is-grabbing holding-${heldItem.kind === "rod" ? heldItem.id : "persona"}` : ""}${dropTarget ? ` drop-${dropTarget}` : ""}`}
          ref={driverStageRef}
        >
          <div className="driver-stage-head">
            <span className="stage-status">{phase.toUpperCase()}</span>
            <span>{heldItem ? `手持 ${heldItem.label}` : selectedPersona ? selectedPersona.code : "请选择并拿起人物卡"}</span>
          </div>
          {selectedPersona && naviRun.status !== "idle" && (
            <section className={`run-status-card status-${naviRun.status}`} aria-live="polite" aria-label="Persona Run 状态">
              <div className="run-status-identity">
                <span className="run-status-avatar" style={{ "--card-color": selectedPersona.color } as CSSProperties}>{selectedPersona.name.slice(0, 1)}</span>
                <div><strong>{selectedPersona.name}</strong><small>{selectedCommand?.code ?? "未选择指令"}</small></div>
              </div>
              <div className="run-status-state"><span>任务状态</span><strong>{RUN_STATUS_CARD_LABELS[naviRun.status]}</strong></div>
              {naviRun.error && <p className="run-status-error">{naviRun.errorCode ? `${naviRun.errorCode} · ` : ""}{naviRun.error.slice(0, 120)}</p>}
              <div className="run-status-actions">
                <button type="button" disabled={naviRun.status !== "completed"} onClick={openResultSheet}>查看结果</button>
                <button type="button" onClick={retryNaviRun}>重新创建</button>
              </div>
            </section>
          )}
          <div className="driver-visual-zone">
            <div className="driver-drop-guides" aria-hidden="true">
              <span className="driver-drop-guide persona"><b>人物卡槽</b></span>
              <span className="driver-drop-guide energy"><b>能量棒槽</b></span>
              <span className="driver-drop-guide skill"><b>技能棒槽</b></span>
            </div>
            <DriverTextureScene
              phase={phase}
              cardColor={selectedPersona?.color ?? "#ef3048"}
              personaImage={selectedPersona?.image}
              personaName={selectedPersona?.name}
              personaRole={selectedPersona?.role}
              handleProgress={handleProgress}
              energyRodEquipped={equippedRods.energy}
              skillRodEquipped={equippedRods.skill}
            />
            {phase === "activated" && activationMotionPersona && (
              <div className="driver-activation-motion" data-motion-status={activationMotionStatus} aria-label={`${activationMotionPersona.name}合体动画`}>
                <video
                  ref={activationVideoRef}
                  className="driver-activation-video"
                  src={activationMotionPersona.motion}
                  poster={activationMotionPersona.motionPoster ?? activationMotionPersona.image}
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  onLoadedData={() => void playActivationMotionVideo()}
                  onPlay={() => setActivationMotionStatus("playing")}
                  onEnded={() => finishActivationMotion("ended")}
                  onError={() => finishActivationMotion("error", `角色动画资源加载失败，已降级为静态合体：${activationMotionPersona.motion}`)}
                />
                <button className="driver-activation-motion-skip" type="button" onClick={() => finishActivationMotion("ended")}>跳过动画</button>
              </div>
            )}
            {activationMotionDiagnostic && <p className="driver-activation-motion-diagnostic" role="status">{activationMotionDiagnostic}</p>}
          </div>
          {phase === "locked" && rodsReady && (
            <div className="driver-handle-band" data-driver-control-band="belt">
              <div className="driver-belt-handles" style={{ "--handle-progress": handleProgress } as CSSProperties}>
                <button
                  className="driver-side-handle belt left"
                  type="button"
                  aria-label="用左手向内合拢腰带把手"
                  onPointerDown={(event) => beginHandleDrag(event, "left")}
                  onPointerMove={moveHandleDrag}
                  onPointerUp={endHandleDrag}
                  onPointerCancel={endHandleDrag}
                  onClick={handleHandleClick}
                >›</button>
                <button
                  className="driver-side-handle belt right"
                  type="button"
                  aria-label="用右手向内合拢腰带把手"
                  onPointerDown={(event) => beginHandleDrag(event, "right")}
                  onPointerMove={moveHandleDrag}
                  onPointerUp={endHandleDrag}
                  onPointerCancel={endHandleDrag}
                  onClick={handleHandleClick}
                >‹</button>
              </div>
            </div>
          )}
          <div className="driver-controls">
            {!selectedPersona && <p>从下方卡盒选择一张人物卡</p>}
            {selectedPersona && phase === "ready" && <p>请在人物详情半窗确认“插入卡片”。</p>}
            {phase === "inserting" && <p>正在读取人物能力数据</p>}
            {phase === "locked" && !rodsReady && (
              <div className="rod-install-status" aria-live="polite">
                <strong>{equippedRodCount}/2</strong>
                <span>拖入能量棒与技能棒</span>
              </div>
            )}
            {phase === "locked" && rodsReady && (
              <div className="driver-handle-control is-compact" style={{ "--handle-progress": handleProgress } as CSSProperties}>
                <button className="activate-button" type="button" disabled={!selectedPersona?.skillName} onClick={activateDriver}>启动 Persona Driver</button>
                <small>{selectedPersona?.skillName ? "拖动腰带两侧把手，或直接点击启动" : "卡片可编辑/展示，但需映射 Skill 后才能唤起 YouNavi"}</small>
              </div>
            )}
            {phase === "activated" && <p className="activation-caption">PERSONA RIDE · {selectedPersona?.role} · {selectedPersona?.name}</p>}
            {selectedPersona && phase !== "inserting" && (
              <button className="reset-driver" type="button" onClick={resetDriver}>退出当前卡片</button>
            )}
          </div>
        </section>

        {selectedPersona && <RunResultSheet
          open={resultSheetOpen}
          markdown={naviRun.status === "completed" ? naviRun.contentMarkdown : undefined}
          resultTitle={naviRun.metadata?.title}
          task={naviRun.metadata?.task ?? naviRun.task}
          personaName={selectedPersona.name}
          skillName={naviRun.metadata?.persona?.skillName ?? selectedPersona.skillName}
          commandId={naviRun.metadata?.command?.id ?? naviRun.commandId ?? selectedCommand?.id}
          promptCode={naviRun.metadata?.command?.code ?? selectedCommand?.code ?? "—"}
          promptLabel={naviRun.metadata?.command?.label ?? selectedCommand?.label ?? "分析"}
          instruction={naviRun.metadata?.command?.instruction ?? selectedPrompt?.prompt}
          sourceDisplayName={naviRun.metadata?.source?.displayName ?? selectedSourceDisplayName}
          sourceTechnicalName={naviRun.metadata?.source?.technicalName ?? selectedSourceTechnicalName}
          sourcePath={naviRun.metadata?.source?.path ?? naviRun.coverage?.[0]?.path}
          sourceSha256={naviRun.metadata?.source?.sha256 ?? naviRun.coverage?.[0]?.sha256}
          runId={naviRun.runId}
          taskId={naviRun.taskId}
          conversationId={naviRun.conversationId}
          coverage={naviRun.coverage?.map((item) => item.mode === "inline"
            ? `${item.bytes ?? "?"} 字节已注入`
            : `${item.readLines ?? "?"}/${item.totalLines ?? "?"} 行`).join("；")}
          onOpenInYouNavi={naviRun.runId ? () => openNaviRun(naviRun.runId!, true) : undefined}
          onClose={() => setResultSheetOpen(false)}
        />}
      </div>

      <PersonaCardShelf
        cards={personaCards}
        selectedId={selectedPersonaId}
        onInspect={inspectPersona}
        onCreateFromTemplate={openTemplateCardEditor}
        onManage={() => openManagement("cards")}
        onDragEnd={endItemGrab}
        onDragStart={(item, event) => beginItemGrab(event, { ...item, kind: "persona" })}
      />
      <PersonaDetailSheet
        card={selectedPersonaCard}
        open={cardDetailOpen}
        onClose={() => setCardDetailOpen(false)}
      />
      {cardEditorOpen && (
        <section className="persona-editor-backdrop" role="presentation" onPointerDown={() => { setCardEditorOpen(false); setCardEditorTemplateId(null); }}>
          <div className="persona-editor-modal" role="dialog" aria-modal="true" aria-label="建立或编辑人物卡" onPointerDown={(event) => event.stopPropagation()}>
            <button className="persona-editor-close" type="button" aria-label="关闭人物卡编辑器" onClick={() => { setCardEditorOpen(false); setCardEditorTemplateId(null); }}>×</button>
            <PersonaCardEditor
              baselineCards={PERSONAS satisfies readonly PersonaCardBaseline[]}
              templateCards={PERSONA_CARD_TEMPLATE_CARDS}
              initialCardId={selectedPersonaId}
              initialTemplateId={cardEditorTemplateId}
              onCardsChange={mergePersonaCards}
              onCardSaved={handleCardSaved}
              onCardDragStart={(item, event) => beginItemGrab(event, { ...item, kind: "persona" })}
            />
          </div>
        </section>
      )}
      <InteractionDragLayer item={heldItem} pointer={dragPointer} />
    </main>
  );
}
