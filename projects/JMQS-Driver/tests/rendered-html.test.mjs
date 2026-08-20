import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the cover-first persona entry shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>假面骑事 \| Persona Driver 工作台<\/title>/);
  assert.match(html, /PERSONA DRIVER · PUBLIC TEST/);
  assert.match(html, /准备变身/);
  assert.match(html, /领取新手卡包，解锁你的第一组 Persona Card/);
  assert.doesNotMatch(html, /选择卡包|经典五人卡组|打开选中的卡包/);
  assert.doesNotMatch(html, /public-demo-frame/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview/);
});

test("includes the layered texture driver and original audio layer", async () => {
  const [driver, closure, driverAudio, page, packageJson, styles] = await Promise.all([
    readFile(new URL("../app/driver-texture-scene.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-closure-layer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-audio.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(packageJson, /"three"/);
  assert.doesNotMatch(driver, /WebGLRenderer|GLTFLoader|getContext\("webgl2"\)/);
  assert.match(driver, /handleProgress/);
  assert.match(driver, /DriverClosureLayer/);
  assert.match(closure, /driver-textures\/belt-v1\.png/);
  assert.match(closure, /data-source="\/driver-textures\/belt-v1\.png"/);
  assert.match(driver, /DEFAULT_DRIVER_ROD_ASSETS/);
  assert.match(driver, /texture-persona-card/);
  assert.match(driver, /texture-driver-rod/);
  assert.match(driver, /texture-driver-foreground/);
  assert.doesNotMatch(driver, /driver-human-backdrop/);
  assert.match(driver, /data-layer="middle"/);
  assert.match(driver, /data-layer="foreground"/);
  assert.doesNotMatch(driver, /position:\s*fixed/);
  assert.match(driverAudio, /SpeechSynthesisUtterance/);
  assert.match(driverAudio, /speechSynthesis/);
  assert.match(driverAudio, /createOscillator/);
  assert.match(driverAudio, /createBuffer/);
  assert.match(driverAudio, /playPackEntrancePreset|stopPackEntrancePreset/);
  assert.match(driverAudio, /REQUIRED_ANNOUNCER_URL/);
  assert.match(driverAudio, /persona-driver-announcer-v2-expressive\.m4a/);
  assert.match(driverAudio, /new Audio\(REQUIRED_ANNOUNCER_URL\)/);
  assert.match(driverAudio, /LOCAL_CLIP_START_TIMEOUT_MS/);
  assert.match(driverAudio, /playSynthesizedActivationEffect\(\)/);
  assert.match(driverAudio, /checkDriverAudioOutput/);
  assert.match(styles, /\.driver-assembly[\s\S]*aspect-ratio: 1672 \/ 941/);
  assert.match(styles, /\.driver-assembly[\s\S]*calc\(100vw - 32px\)/);
  assert.match(styles, /\.interaction-drag-layer[\s\S]*position: fixed/);
  assert.match(styles, /\.texture-persona-card[\s\S]*transform: translate\(-50%, -50%\)/);
  assert.match(styles, /\.texture-driver-foreground[\s\S]*inset: 0/);
  assert.doesNotMatch(styles, /belt-nudge|driver-human-backdrop/);
  assert.doesNotMatch(styles, /\.texture-driver-held/);
  assert.doesNotMatch(styles, /\.interaction-hands|\.driver-layer-scene|\.driver-sprite-scene/);
  assert.match(page, /playActivationSequence/);
  assert.match(page, /className="activate-button"/);
  assert.match(page, />启动 Persona Driver<\/button>/);
  assert.match(page, /driver-side-handle/);
  assert.match(page, /beginItemGrab/);
  assert.match(page, /querySelector<HTMLElement>\("\.driver-assembly"\)/);
  assert.match(page, /getBoundingClientRect/);
  assert.match(page, /driver-drop-guides/);
  assert.match(page, /DriverTextureScene/);
  assert.match(page, /InteractionDragLayer/);
  assert.match(page, /ACTIVATION_HISTORY_KEY/);
  assert.match(page, /PACK_PROGRESS_KEY/);
  assert.match(page, /readPackProgress/);
  assert.match(page, /viewedEntranceIds/);
  assert.match(page, /localStorage/);
  assert.match(page, /activation-history-panel/);
  assert.match(page, /http:\/\/127\.0\.0\.1:8766/);
  assert.match(page, /runSystemCheck/);
  assert.match(page, /system-check-panel/);
  assert.match(page, /前期资料/);
  assert.match(page, /中间流程/);
  assert.match(page, /最终接入/);
  assert.doesNotMatch(page, /InteractionHands/);
  assert.doesNotMatch(page, /driver-human-backdrop/);
  assert.doesNotMatch(page, /driver-rod-id/);
  assert.doesNotMatch(page, /onDragOver|onDrop/);
  assert.match(page, /onDragStart=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(page, /拖入能量棒与技能棒/);
  assert.match(page, /energyRodEquipped=/);
  assert.match(page, /skillRodEquipped=/);
  assert.match(page, /announcerName: "Donald John Trump"/);
  assert.match(page, /skillName: "trump-perspective"/);
  assert.match(page, /buildPersonaNaviRodRequest/);
  assert.match(page, /RunResultSheet/);
  assert.doesNotMatch(page, /<pre>\{naviRun\.contentMarkdown\}/);
  assert.match(page, /乔布斯盖茨 D5 大会对话/);
  assert.match(page, /梁文道《活着（二）》/);
  assert.match(page, /payload\.code === "INVALID_REQUEST_TOKEN"/);
  assert.match(page, /BRIDGE_OFFLINE/);
  assert.doesNotMatch(page, /评审假面骑事工作台的首次使用路径/);
  assert.match(page, /PersonaCardShelf/);
  assert.doesNotMatch(page, /entranceKey=\{screen\}|workbench-empty-shelf/);
  assert.match(page, /personas\/naval-action-masked-v3\.jpg/);
  assert.match(page, /personas\/elon-musk-action-masked-v3\.jpg/);
  assert.match(page, /personas\/steve-jobs-action-masked-v3\.jpg/);
  assert.match(page, /personas\/donald-trump-action-masked-v3\.jpg/);
  assert.match(page, /personas\/paul-graham-action-masked-v3\.jpg/);
  assert.match(page, /brand\/persona-gate-logo-v1-(32|64)\.png/);
  assert.match(page, /className="sealed-pack-logo" src="\/brand\/persona-gate-logo-v1-256\.png"/);
  assert.doesNotMatch(page, /className="sealed-pack"[^\n]*PersonaCardBack/);
  assert.match(page, /pack-reveal-back"><PersonaCardBack \/>/);
  assert.doesNotMatch(page, /sealed-pack-back|sealed-pack[\s\S]*persona-card-back-base/);
  assert.doesNotMatch(page, /pack-option-mark|pack-reveal-back.*<i/);
  assert.doesNotMatch(page, /material-tray|command-card|mission-field/);
  assert.match(page, /openStarterPack|tearStarterPack|deal-cards/);
  assert.match(page, /已获得新手卡包|撕开卡包|收下卡牌，进入工作台/);
  assert.match(page, /dealRunRef/);
  assert.match(page, /prefers-reduced-motion/);
  assert.doesNotMatch(page, /选择卡包|经典五人卡组|打开选中的卡包/);
  assert.doesNotMatch(page, /pack-choice/);
  assert.match(page, /personas-motion\/naval\.mp4/);
  assert.match(page, /personas-motion\/elon-musk\.mp4/);
  assert.match(page, /personas-motion-v3-intense\/steve-jobs-action-masked-intense-v3\.mp4/);
  assert.match(page, /personas-motion-v3-intense\/donald-trump-action-masked-intense-v3\.mp4/);
  assert.match(page, /personas-motion-v3-intense\/paul-graham-action-masked-intense-v3\.mp4/);
  assert.match(page, /pack-entrance-video|finishPackReveal|revealPackCard/);
  assert.doesNotMatch(page, /personas-motion-v3-intense\/(naval|elon-musk)-action-masked-intense-v3\.mp4/);
  assert.match(page, /function restartExperience\(\)/);
  assert.match(page, /重新开始当前体验，不清除唤起记录/);
  assert.match(page, /localStorage\.removeItem\(PACK_PROGRESS_KEY\)/);
  assert.match(page, /setDragPointer\(\{ x: 0, y: 0 \}\)/);
  assert.match(page, /suppressInspectRef\.current = null/);
  assert.match(page, /handleDragRef\.current = null/);
  assert.match(page, /handleMovedRef\.current = false/);
  assert.match(page, /suppressHandleClickRef\.current = false/);
  assert.doesNotMatch(page, /restartPackExperience/);
  assert.match(page, /id: "decision", label: "决策", code: "DECISION"/);
  assert.doesNotMatch(page, /id: "decide"/);
  assert.match(page, /const selectedMaterialIds = selectedMaterial \? \[selectedMaterial\.id\] : \[\]/);
  assert.match(page, /PersonaCardEditor/);
  assert.match(page, /RodInjectorPanel/);
  assert.match(page, /卡片可编辑\/展示，但需映射 Skill 后才能唤起 YouNavi/);
  assert.match(styles, /\.pack-reveal-grid[\s\S]*width: 100%/);
  assert.match(styles, /\.pack-entrance[\s\S]*position: fixed/);
  assert.match(styles, /\.pack-entrance-video[\s\S]*object-fit: contain/);
  assert.match(styles, /\.pack-entrance-copy\.is-visible/);
});

test("ships five action-masked-v3 baseline persona illustrations", async () => {
  const assets = await Promise.all([
    readFile(new URL("../public/personas/naval-action-masked-v3.jpg", import.meta.url)),
    readFile(new URL("../public/personas/elon-musk-action-masked-v3.jpg", import.meta.url)),
    readFile(new URL("../public/personas/steve-jobs-action-masked-v3.jpg", import.meta.url)),
    readFile(new URL("../public/personas/donald-trump-action-masked-v3.jpg", import.meta.url)),
    readFile(new URL("../public/personas/paul-graham-action-masked-v3.jpg", import.meta.url)),
  ]);
  for (const asset of assets) assert.ok(asset.byteLength > 100_000);
});

test("ships the sealed-pack logo and keeps the reveal back as the only card back", async () => {
  const logo = await readFile(new URL("../public/brand/persona-gate-logo-v1-256.png", import.meta.url));
  assert.ok(logo.byteLength > 1000);
});

test("ships the original brushed-gunmetal material texture", async () => {
  const texture = await readFile(new URL("../public/models/persona-driver/textures/brushed-gunmetal-v1.png", import.meta.url));
  assert.ok(texture.byteLength > 100_000);
});

test("ships the required same-origin driver announcer", async () => {
  const audio = await readFile(new URL("../public/audio/persona-driver-announcer-v2-expressive.m4a", import.meta.url));
  assert.ok(audio.byteLength > 100_000);
});

test("uses one generic empty Persona Card slot", async () => {
  const model = await readFile(new URL("../app/persona-card-model.ts", import.meta.url), "utf8");
  assert.match(model, /id: "custom-template-empty-v1"/);
  assert.equal((model.match(/templateId: "empty"/g) ?? []).length, 1);
});

test("keeps the original modular models as offline sprite sources", async () => {
  const assets = await Promise.all([
    readFile(new URL("../public/models/persona-driver/belt.glb", import.meta.url)),
    readFile(new URL("../public/models/persona-driver/persona-card.glb", import.meta.url)),
    readFile(new URL("../public/models/persona-driver/energy-rod.glb", import.meta.url)),
    readFile(new URL("../public/models/persona-driver/skill-rod.glb", import.meta.url)),
  ]);
  for (const asset of assets) assert.ok(asset.byteLength > 100_000);
});

test("keeps the layered texture driver independent from the audio layer", async () => {
  const [driver, closure, driverAudio, page, packageJson] = await Promise.all([
    readFile(new URL("../app/driver-texture-scene.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-closure-layer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-audio.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(packageJson, /"three"/);
  assert.doesNotMatch(driver, /WebGLRenderer|GLTFLoader|getContext\("webgl2"\)/);
  assert.match(closure, /texture-driver-belt/);
  assert.match(driver, /texture-driver-glow/);
  assert.match(driverAudio, /SpeechSynthesisUtterance/);
  assert.match(driverAudio, /speechSynthesis/);
  assert.match(driverAudio, /createOscillator/);
  assert.match(driverAudio, /createBuffer/);
  assert.match(page, /playActivationSequence/);
});

test("keeps the latest Persona Driver interaction state machine in page wiring", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(progress\.packOpened\) setScreen\("deal-cards"\)/);
  assert.match(page, /setScreen\("deal-cards"\)/);
  assert.match(page, /packProgressResetRef\.current = true/);
  assert.match(page, /className=\{rodsRevealed \? "workbench-grid has-rods" : "workbench-grid workbench-empty"\}/);
  assert.match(page, /\{rodsRevealed && <aside className="rod-tray">/);
  assert.match(page, /const rodsRevealed = phase === "locked" \|\| phase === "activated"/);
  assert.match(page, /PersonaCardShelf/);
  assert.match(page, /PersonaDetailSheet/);
  assert.doesNotMatch(page, /<PersonaDetailSheet[\s\S]*?onInsert=/);
  assert.match(page, /onCreateFromTemplate=\{openTemplateCardEditor\}/);
  assert.match(page, /initialTemplateId=\{cardEditorTemplateId\}/);
  assert.match(page, /onCardSaved=\{handleCardSaved\}/);
  assert.match(page, /setCardDetailOpen\(false\);\s+setPhase\("inserting"\)/);
  assert.doesNotMatch(page, /workbench-card|persona-cards|card-case/);
  assert.match(page, /run-status-card/);
  assert.match(page, /RUN_STATUS_CARD_LABELS/);
  assert.match(page, /onClick=\{openResultSheet\}/);
  assert.match(page, /onClick=\{retryNaviRun\}/);
  assert.match(page, /resultSheetOpen/);
  assert.doesNotMatch(page, /selectedPersona && manifested/);
  assert.match(page, /PERSONA_CARD_TEMPLATE_CARDS/);
  assert.match(page, /templateCards=\{PERSONA_CARD_TEMPLATE_CARDS\}/);
  assert.match(page, /onDragStart=\{\(item, event\) => beginItemGrab/);
  assert.match(page, /PersonaManagementPage/);
  assert.match(page, /initialSection=\{managementSection\}/);
  assert.match(page, /aria-label="打开管理中心"/);
  assert.match(page, /openManagement\("cards"\)/);
  assert.doesNotMatch(page, /card-management/);
  assert.match(page, /if \(equipped\) return null/);
  assert.match(page, /setInjector\(rod\.id\)/);
  assert.match(page, /if \(item\.kind === "rod" && target === item\.id\)/);
});
