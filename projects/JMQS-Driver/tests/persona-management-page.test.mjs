import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const read = (file) => readFile(path.join(root, file), "utf8");

test("Persona Management Page exposes the four independent sections and the integration contract", async () => {
  const source = await read("app/persona-management-page.tsx");
  for (const section of ["prompts", "cards", "diagnostics", "materials"]) assert.match(source, new RegExp(`['"]${section}['"]`));
  assert.match(source, /initialSection\?: PersonaManagementSection/);
  assert.match(source, /baselineCards: readonly PersonaCardBaseline\[\]/);
  assert.match(source, /onBack: \(\) => void/);
  assert.match(source, /PersonaCardEditor/);
  assert.match(source, /通用空白卡与“新建角色卡”进入同一创建流程/);
  assert.doesNotMatch(source, /男 \/ 女模板|男性角色|女性角色/);
  assert.match(source, /从 Soul 提炼/);
  assert.match(source, /SoulCardWizardComponent/);
  assert.match(source, /collecting.*distilling.*assembling.*validating.*ready.*coverage-warning.*index-warning.*error/s);
  assert.match(source, /initialMode="from-soul"/);
  assert.match(source, /availableMaterials={soulMaterials}/);
  assert.match(source, /bridgeRequest={soulBridgeRequest}/);
  assert.match(source, /onCardReady={handleSoulCardReady}/);
  assert.match(source, /只显示运行状态，不代表 Skill 已安装/);
  assert.match(source, /readDocumentFile/);
  assert.match(source, /\/health/);
  assert.match(source, /不会创建 YouNavi 对话/);
  assert.doesNotMatch(source, /fetchJson\([^)]*\/runs/);
  assert.doesNotMatch(source, /disabled=\{!SoulCardWizard\}/);
});

test("management model keeps prompt, card, and material storage contracts separate", async () => {
  const model = await read("app/persona-management-model.ts");
  const rod = await read("app/rod-content-model.ts");
  assert.match(model, /PERSONA_PROMPT_STORAGE_KEY = "persona-driver\.prompt-presets\.v1"/);
  assert.match(model, /PERSONA_MATERIAL_STORAGE_KEY = "persona-driver\.custom-materials\.v1"/);
  assert.match(model, /validateCustomPrompt/);
  assert.match(model, /validateDocumentContent/);
  assert.match(model, /ROD_MAX_DOCUMENT_NAME_CHARS/);
  assert.match(model, /ROD_MAX_PROMPT_CHARS/);
  assert.match(model, /source: "builtin"/);
  assert.match(model, /source: "custom"/);
  assert.match(model, /REMOVED_NORMAL_PROMPT_MESSAGE/);
  assert.match(model, /warnings\?: string\[\]/);
  assert.match(rod, /id: "review"/);
  assert.match(rod, /id: "explain"/);
  assert.match(rod, /id: "decision"/);
  assert.match(rod, /id: "action"/);
  assert.doesNotMatch(rod, /id: "normal"/);
});

test("management page does not take ownership of the workbench or bridge implementation", async () => {
  const source = await read("app/persona-management-page.tsx");
  const css = await read("app/persona-management-page.module.css");
  assert.doesNotMatch(source, /from ["']\.\/page["']/);
  assert.doesNotMatch(source, /persona-navi-bridge/);
  assert.doesNotMatch(source, /createRun|chat send/);
  assert.doesNotMatch(source, /skillBinding\s*:\s*\{\s*status:\s*["']verified/);
  assert.doesNotMatch(source, /normal/);
  assert.match(css, /--manage-bg:\s*#07090d/);
  assert.match(css, /--manage-signal:\s*#ef3048/);
  assert.match(css, /border-left-color:\s*var\(--manage-signal\)/);
  assert.match(css, /background:\s*rgba\(239, 48, 72/);
  assert.doesNotMatch(css, /background:\s*#fff|background:\s*#f7f7f5|background:\s*#ffffff/);
});

test("page injects the real Soul wizard, Bridge requester, and card merge callback", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /import \{ SoulCardWizard \} from "\.\/soul-card-wizard"/);
  assert.match(page, /soulCardWizard=\{SoulCardWizard\}/);
  assert.match(page, /soulBridgeRequest=\{naviRequest\}/);
  assert.match(page, /onSoulCardReady=\{handleSoulCardReady\}/);
  assert.match(page, /onPersonaCardsChange=\{mergePersonaCards\}/);
});
