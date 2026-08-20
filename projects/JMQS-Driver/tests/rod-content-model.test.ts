import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ROD_BRIDGE_SCHEMA,
  REMOVED_NORMAL_PROMPT_MESSAGE,
  SKILL_PROMPT_PRESETS,
  chargeRod,
  createEmptyRodState,
  buildPersonaNaviRodRequest,
  errorRod,
  fixedMaterialContent,
  migrateRodState,
  promptContentForPreset,
  setRodDraft,
  validateDocumentContent,
} from "../app/rod-content-model";

function chargedSkill() {
  return chargeRod(setRodDraft(createEmptyRodState("skill"), promptContentForPreset("review")));
}

test("fixed energy material follows the complete v1 call chain", () => {
  const energy = chargeRod(setRodDraft(createEmptyRodState("energy"), fixedMaterialContent("gates-ted")));
  assert.equal(energy.status, "charged");
  assert.equal(energy.sourceType, "fixed");

  const request = buildPersonaNaviRodRequest({
    runId: "prun-fixed-material-1234",
    personaId: "jobs",
    task: "整理访谈判断",
    energy,
    skill: chargedSkill(),
  });
  assert.equal(request.schema, "persona.navi-run/v1");
  assert.deepEqual(request.materials, ["gates-ted"]);
  assert.equal("document" in request, false);
});

test("custom document follows the v2 request path", () => {
  const content = "source text";
  const document = validateDocumentContent({
    name: "source.txt",
    mimeType: "text/plain",
    size: new TextEncoder().encode(content).byteLength,
    content,
  });
  const energy = chargeRod(setRodDraft(createEmptyRodState("energy"), document));
  const request = buildPersonaNaviRodRequest({
    runId: "prun-custom-document-1234",
    personaId: "jobs",
    task: "整理访谈判断",
    energy,
    skill: chargedSkill(),
  });
  assert.equal(energy.sourceType, "document");
  assert.equal(request.schema, ROD_BRIDGE_SCHEMA);
  assert.deepEqual(request.materials, []);
  assert.equal(request.document?.name, "source.txt");
});

test("energy rejects a Prompt and source switching clears old errors", () => {
  const promptDraft = setRodDraft(createEmptyRodState("energy"), promptContentForPreset("review"));
  assert.throws(() => chargeRod(promptDraft), /能量棒必须选择一个固定素材或导入一份自定义文档/);

  const errored = errorRod(promptDraft, "旧错误");
  const fixed = setRodDraft(errored, fixedMaterialContent("jobs-1990"));
  assert.equal(fixed.error, null);
  assert.equal(chargeRod(fixed).sourceType, "fixed");
});

test("legacy normal state migrates empty without silently selecting another preset", () => {
  const legacy = {
    ...createEmptyRodState("skill"),
    status: "charged",
    sourceType: "preset",
    charged: { kind: "prompt", presetId: "normal", code: "NORMAL", label: "普通问", prompt: "legacy", sections: [] },
  } as never;
  const migrated = migrateRodState(legacy);
  assert.equal(migrated.status, "empty");
  assert.equal(migrated.sourceType, null);
  assert.equal(migrated.draft, null);
  assert.equal(migrated.charged, null);
  assert.equal(migrated.error, REMOVED_NORMAL_PROMPT_MESSAGE);
});

test("skill panel exposes four fixed cards and only mounts an editor for custom", async () => {
  assert.equal(SKILL_PROMPT_PRESETS.length, 4);
  assert.deepEqual(SKILL_PROMPT_PRESETS.map((preset) => preset.id), ["review", "explain", "decision", "action"]);
  const panel = await readFile(new URL("../app/rod-injector-panel.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(panel, /normal|普通问/);
  assert.equal((panel.match(/<textarea/g) ?? []).length, 1);
  assert.match(panel, /activePrompt\?\.presetId === "custom"/);
  assert.match(panel, /使用「/);
});
