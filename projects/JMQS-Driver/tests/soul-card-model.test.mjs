import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import * as ts from "typescript";

async function loadModel() {
  const source = await readFile(new URL("../app/soul-card-model.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  const directory = await mkdtemp(path.join(os.tmpdir(), "soul-card-model-"));
  const modulePath = path.join(directory, "soul-card-model.mjs");
  await writeFile(modulePath, output, "utf8");
  return { model: await import(`${pathToFileURL(modulePath).href}?test=${Date.now()}`), directory };
}

function material(id, sourceType = "note", wordCount = 2000, extra = {}) {
  return { id, label: id, sourceType, wordCount, path: `/tmp/${id}.md`, ...extra };
}

test("coverage warning is advisory and speaker purification is a blocking boundary", async () => {
  const { model, directory } = await loadModel();
  try {
    const state = model.createEmptySoulCardWizard("from-soul");
    state.personName = "林默";
    state.oneLineDescription = "产品研究与组织观察者";
    state.selectedMaterials = [material("meeting-1", "meeting", 900, { speakerPurified: false })];
    state.privacy = { confirmed: true, scopeText: "只采集我的工作会议发言", exclusionsText: "私人聊天与他人隐私", speakerPurificationConfirmed: false };
    let result = model.validateSoulWizardState(state);
    assert.equal(result.valid, false);
    assert.match(result.coverageWarning, /覆盖不足/);
    assert.match(result.errors.speakerPurification, /发言人纯化/);

    state.selectedMaterials[0].speakerPurified = true;
    state.privacy.speakerPurificationConfirmed = true;
    result = model.validateSoulWizardState(state);
    assert.equal(result.valid, true);
    assert.equal(result.hasSpeakerMixedSources, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("other target rejects private context and request fixes the output directory", async () => {
  const { model, directory } = await loadModel();
  try {
    const state = model.createEmptySoulCardWizard("from-soul");
    Object.assign(state, {
      personName: "Lin Mo",
      oneLineDescription: "公开访谈中的产品研究者",
      targetType: "other",
      sourceMode: "younavi-context",
      selectedMaterials: [material("context-1")],
      privacy: { confirmed: true, scopeText: "只使用用户明确提供的文件", exclusionsText: "不读取其他来源", speakerPurificationConfirmed: false },
    });
    assert.equal(model.validateSoulWizardState(state).valid, false);
    state.sourceMode = "uploaded-files";
    const request = model.buildSoulCreateRequest(state);
    assert.equal(request.schema, "persona.soul-run/v1");
    assert.equal(request.outputDir, "outputs/persona-souls/lin-mo-soul");
    assert.deepEqual(request.exactMaterialPaths, ["/tmp/context-1.md"]);
    assert.equal(request.collectionScope.speakerPurificationRequired, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Soul card mapping is gated by verified installed skill and never deletes the Soul path", async () => {
  const { model, directory } = await loadModel();
  try {
    const base = {
      personName: "林默",
      oneLineDescription: "产品研究与组织观察者",
      role: "产品研究与组织观察者",
      slug: "lin-mo",
      soulPath: "/workspace/outputs/persona-souls/lin-mo-soul",
      sourceCount: 5,
      skillFrontmatter: { name: "lin-mo-chat", description: "chat" },
    };
    const pending = model.projectSoulCard({ ...base, installVerification: { verified: false, skillPath: "/skills/lin-mo-soul/SKILL.md" } });
    assert.equal(pending.skillName, "lin-mo-chat");
    assert.equal(pending.skillMapping.status, "unmapped");
    const mapped = model.projectSoulCard({ ...base, installVerification: { verified: true, skillPath: "/skills/lin-mo-soul/SKILL.md" } });
    assert.equal(mapped.skillMapping.status, "mapped");
    assert.equal(mapped.skillMapping.soulPath, base.soulPath);
    assert.deepEqual(mapped.image, { kind: "template", templateId: "male" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
