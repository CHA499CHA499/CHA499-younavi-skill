import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import * as ts from "typescript";

async function loadRuntime() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "soul-card-runtime-"));
  for (const name of ["persona-card-model", "soul-card-model", "soul-card-runtime"]) {
    const source = await readFile(new URL(`../app/${name}.ts`, import.meta.url), "utf8");
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
      .replaceAll('"./persona-card-model"', '"./persona-card-model.mjs"')
      .replaceAll('"./soul-card-model"', '"./soul-card-model.mjs"');
    await writeFile(path.join(directory, `${name}.mjs`), output, "utf8");
  }
  return { runtime: await import(`${pathToFileURL(path.join(directory, "soul-card-runtime.mjs")).href}?test=${Date.now()}`), directory };
}

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function request() {
  return {
    schema: "persona.soul-run/v1",
    runId: "psoul-runtime-fixture-1234",
    mode: "from-soul",
    personName: "林默",
    oneLineDescription: "产品研究与组织观察者",
    targetType: "self",
    sourceMode: "selected-materials",
    exactMaterialPaths: ["/tmp/source.md"],
    fixedMaterialIds: [],
    uploadedMaterials: [],
    publicSources: [],
    collectionScope: { confirmed: true, scopeText: "fixture", exclusionsText: "private", speakerPurificationRequired: false, speakerPurificationConfirmed: false },
    outputDir: "outputs/persona-souls/lin-mo-soul",
    outputSlug: "lin-mo",
    materialCount: 5,
    totalWordCount: 12000,
  };
}

function projection() {
  return {
    personName: "林默",
    oneLineDescription: "产品研究与组织观察者",
    role: "产品研究者",
    announcerName: "Lin Mo",
    slug: "lin-mo",
    soulPath: "/workspace/outputs/persona-souls/lin-mo-soul",
    sourceCount: 5,
    coverageWarning: null,
    skillFrontmatter: { name: "lin-mo-chat", description: "Chat with Lin Mo" },
    installVerification: { verified: false, fileVerified: true, indexStatus: "unconfirmed", skillPath: "/skills/lin-mo-soul/SKILL.md", error: "动态 Skill 索引未确认" },
    templateId: "male",
    artifactValidation: { complete: true, knowledgeCount: 2, iconicQuoteCount: 20 },
  };
}

test("one-click flow sends the real Bridge request, persists the completed Soul card, and keeps an unverified Skill unmapped", async () => {
  const { runtime, directory } = await loadRuntime();
  const storage = new MemoryStorage();
  const calls = [];
  const statuses = [];
  try {
    const result = await runtime.executeSoulBridgeRun({
      request: request(),
      storage,
      manifest: { assets: [{ id: "fixture-art", path: "/personas/random-pool/fixture.png" }] },
      onStatus: (status) => statuses.push(status),
      wait: async () => {},
      bridgeRequest: async (url, options = {}) => {
        calls.push({ url, options });
        if (url === "/soul-runs") return { ok: true, runId: request().runId, taskId: "task-1", conversationId: "conversation-1", stage: "collecting" };
        if (url.endsWith("/open")) return { ok: true };
        return { ok: true, runId: request().runId, taskId: "task-1", conversationId: "conversation-1", stage: "ready", projection: projection() };
      },
    });
    assert.equal(calls[0].url, "/soul-runs");
    assert.equal(calls[0].options.method, "POST");
    assert.match(calls[0].options.body, /persona\.soul-run\/v1/);
    assert.equal(result.card.source, "soul");
    assert.equal(result.card.status, "active");
    assert.equal(result.card.skillMapping.status, "unmapped");
    assert.equal(result.card.image, "/personas/random-pool/fixture.png");
    const saved = JSON.parse(storage.getItem("persona-driver.persona-cards.v1"));
    assert.equal(saved.cards[0].id, "soul-lin-mo");
    assert.equal(statuses.some((item) => item.status === "index-warning" && /索引未确认/.test(item.detail)), true);
    assert.equal(statuses.at(-1).status, "ready");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Bridge failure is explicit and an incomplete projection never becomes a completed card", async () => {
  const { runtime, directory } = await loadRuntime();
  try {
    const storage = new MemoryStorage();
    await assert.rejects(runtime.executeSoulBridgeRun({
      request: request(),
      storage,
      bridgeRequest: async () => { throw new Error("Bridge offline"); },
      wait: async () => {},
    }), /Bridge offline/);
    assert.equal(storage.getItem("persona-driver.persona-cards.v1"), null);

    assert.throws(() => runtime.createPersonaCardFromSoulProjection({ ...projection(), artifactValidation: { complete: false } }, storage), /尚未通过完整性验证/);
    assert.equal(storage.getItem("persona-driver.persona-cards.v1"), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
