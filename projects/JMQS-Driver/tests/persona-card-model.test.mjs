import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import * as ts from "typescript";

async function loadModel() {
  const source = await readFile(new URL("../app/persona-card-model.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const directory = await mkdtemp(path.join(os.tmpdir(), "persona-card-model-"));
  const modulePath = path.join(directory, "persona-card-model.mjs");
  await writeFile(modulePath, output, "utf8");
  const model = await import(`${pathToFileURL(modulePath).href}?test=${Date.now()}`);
  return { model, directory };
}

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function baseline() {
  return {
    id: "naval",
    name: "纳瓦尔",
    announcerName: "Naval Ravikant",
    skillName: "naval-perspective",
    role: "长期主义策略师",
    code: "LEVERAGE ARCHITECT",
    color: "#d8b25c",
    image: "/personas/naval.jpg",
    summary: "从长期复利出发。",
    tags: ["长期主义"],
  };
}

test("fixed baseline is read-only and copy starts as an unmapped custom draft", async () => {
  const { model, directory } = await loadModel();
  try {
    const fixed = model.toPersonaCard(baseline());
    assert.equal(fixed.source, "builtin");
    assert.equal(fixed.status, "active");
    assert.deepEqual(fixed.skillBinding, { status: "verified", skillName: "naval-perspective" });

    const copy = model.createCustomPersonaCard(fixed, { baseline: baseline(), copiedFromId: fixed.id });
    assert.equal(copy.source, "custom");
    assert.equal(copy.status, "draft");
    assert.equal(copy.copiedFromId, "naval");
    assert.deepEqual(copy.skillBinding, { status: "unmapped" });
    assert.equal(model.validatePersonaCardFields(copy).valid, true);
    assert.equal(model.toDriverPersona({ ...copy, code: "CUSTOM PERSONA", tags: [], status: "active" }).skillName, "");
    assert.deepEqual(model.toPersonaCardDragItem({ ...copy, code: "CUSTOM PERSONA", tags: [], status: "active" }).kind, "persona");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("validation only accepts local safe images and enforces the byte limit", async () => {
  const { model, directory } = await loadModel();
  try {
    const valid = model.createCustomPersonaCard({
      name: "本地人物",
      announcerName: "Local Persona",
      role: "测试角色",
      summary: "用于验证图片边界。",
      color: "#123456",
      image: "data:image/png;base64,AAAA",
    });
    assert.equal(model.validatePersonaCardFields(valid).valid, true);
    assert.equal(model.isAllowedPersonaImageSource("https://example.com/persona.png", "custom"), false);
    assert.equal(model.isAllowedPersonaImageSource("/personas/naval.jpg", "custom"), true);

    const oversized = { ...valid, image: `data:image/png;base64,${"A".repeat(model.PERSONA_CARD_MAX_IMAGE_BYTES * 2)}` };
    const result = model.validatePersonaCardFields(oversized);
    assert.equal(result.valid, false);
    assert.match(result.errors.image, /2 MB/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("storage persists custom cards, migrates the legacy key, and never owns activation history", async () => {
  const { model, directory } = await loadModel();
  try {
    const storage = new MemoryStorage();
    const card = {
      ...model.createCustomPersonaCard({
        name: "自建卡",
        announcerName: "Custom Persona",
        role: "问题诊断师",
        summary: "本机自建简介。",
        color: "#123456",
        image: "data:image/webp;base64,AAAA",
      }),
      code: "CUSTOM PERSONA",
      tags: [],
      status: "active",
    };
    const record = model.upsertPersonaCard(model.emptyPersonaCardStorage(), card);
    assert.equal(model.persistPersonaCardStorage(storage, record), true);
    const restored = model.readPersonaCardStorage(storage);
    assert.equal(restored.cards[0].name, "自建卡");
    assert.deepEqual(restored.cards[0].skillBinding, { status: "unmapped" });
    assert.equal(storage.getItem("persona-driver.activation-history.v1"), null);

    const soulCard = {
      ...card,
      id: "soul-card",
      source: "soul",
      soulPath: "/souls/naval",
      sourceCount: 4,
      coverageWarning: "部分来源覆盖不足",
      skillBinding: { status: "unmapped" },
      skillMapping: {
        status: "mapped",
        slug: "naval",
        skillName: "naval-perspective",
        createSoulArtifact: { status: "complete", path: "/souls/naval/create-soul.json" },
        installedSkill: { status: "verified", name: "naval-chat" },
      },
    };
    const soulRecord = model.upsertPersonaCard(model.emptyPersonaCardStorage(), soulCard);
    assert.equal(model.persistPersonaCardStorage(storage, soulRecord), true);
    const restoredSoul = model.readPersonaCardStorage(storage).cards[0];
    assert.equal(restoredSoul.source, "soul");
    assert.equal(restoredSoul.soulPath, "/souls/naval");
    assert.equal(restoredSoul.sourceCount, 4);
    assert.equal(restoredSoul.skillMapping.status, "mapped");
    assert.equal(model.toDriverPersona(restoredSoul).skillName, "naval-perspective");

    const invalidSoul = { ...soulCard, skillMapping: { ...soulCard.skillMapping, installedSkill: { status: "verified", name: "naval" } } };
    storage.setItem(model.PERSONA_CARD_STORAGE_KEY, JSON.stringify({ schema: model.PERSONA_CARD_SCHEMA, version: 1, cards: [invalidSoul] }));
    assert.equal(model.readPersonaCardStorage(storage).cards[0].skillMapping.status, "unmapped");

    const legacy = { ...card, id: "legacy-card", image: "data:image/jpeg;base64,AAAA" };
    const legacyStorage = new MemoryStorage();
    legacyStorage.setItem(model.PERSONA_CARD_LEGACY_STORAGE_KEYS[0], JSON.stringify([legacy]));
    const migrated = model.readPersonaCardStorage(legacyStorage);
    assert.equal(migrated.cards[0].id, "legacy-card");
    assert.equal(legacyStorage.getItem(model.PERSONA_CARD_STORAGE_KEY) !== null, true);

    const afterDelete = model.removePersonaCard(restored, card.id);
    assert.equal(afterDelete.cards.length, 0);
    assert.equal(storage.getItem("persona-driver.activation-history.v1"), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("random-pool art uses a persisted shuffle bag and never overrides fixed or uploaded art", async () => {
  const { model, directory } = await loadModel();
  try {
    const manifest = model.parsePersonaRandomPoolManifest({
      version: "masked-bust-v2",
      assets: [
        { id: "bust-a", path: "/personas/random-pool/masked-bust-v2/bust-a.jpg" },
        { id: "bust-b", path: "/personas/random-pool/masked-bust-v2/bust-b.jpg" },
        { id: "bust-c", path: "/personas/random-pool/masked-bust-v2/bust-c.jpg" },
      ],
    });
    assert.equal(manifest.assets.length, 3);
    const storage = new MemoryStorage();
    let state = model.emptyPersonaRandomPoolState();
    const seen = [];
    for (let index = 0; index < 3; index += 1) {
      const draw = model.drawPersonaRandomPoolAsset(manifest, state, () => 0);
      seen.push(draw.asset.id);
      state = draw.state;
      model.persistPersonaRandomPoolState(storage, state);
    }
    assert.equal(new Set(seen).size, 3);
    const next = model.drawPersonaRandomPoolAsset(manifest, model.readPersonaRandomPoolState(storage, manifest), () => 0);
    assert.equal(next.state.cycle, 1);
    assert.notEqual(next.asset.id, seen[seen.length - 1]);
    assert.equal(model.readPersonaRandomPoolState(storage, manifest).lastAssetId, seen[seen.length - 1]);

    const emptyCustom = { ...model.createCustomPersonaCard({ name: "随机角色", announcerName: "Random Persona", role: "测试角色", summary: "无图角色", color: "#123456" }), code: "CUSTOM PERSONA", tags: [], status: "active" };
    const assigned = model.assignRandomPoolArt(emptyCustom, manifest, storage, () => 0);
    assert.equal(assigned.card.artSource, "random-pool");
    assert.equal(assigned.card.artAssetId, assigned.draw.asset.id);
    assert.match(assigned.card.image, /masked-bust-v2/);

    const uploaded = { ...emptyCustom, image: "data:image/png;base64,AAAA", artSource: "uploaded" };
    const keptUploaded = model.assignRandomPoolArt(uploaded, manifest, storage, () => 0);
    assert.equal(keptUploaded.card.image, uploaded.image);
    assert.equal(keptUploaded.draw.asset, null);
    const keptUploadedOnForce = model.assignRandomPoolArt(uploaded, manifest, storage, () => 0, { force: true });
    assert.equal(keptUploadedOnForce.card.image, uploaded.image);
    assert.equal(keptUploadedOnForce.draw.asset, null);

    const template = model.PERSONA_CARD_TEMPLATE_CARDS[0];
    const keptTemplate = model.assignRandomPoolArt(template, manifest, storage, () => 0);
    assert.equal(keptTemplate.card.id, template.id);
    assert.equal(keptTemplate.draw.asset, null);

    const soul = { ...emptyCustom, id: "soul-random", source: "soul", image: "", artSource: undefined, skillBinding: { status: "unmapped" }, skillMapping: { status: "unmapped", reason: "awaiting-create-soul" } };
    const assignedSoul = model.assignRandomPoolArt(soul, manifest, storage, () => 0);
    assert.equal(assignedSoul.card.source, "soul");
    assert.equal(assignedSoul.card.artSource, "random-pool");
    assert.equal(model.getDefaultActionArtPath("naval"), "/personas/naval-action-masked-v3.jpg");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy male/female slots migrate to one generic empty slot without losing real custom cards", async () => {
  const { model, directory } = await loadModel();
  try {
    const storage = new MemoryStorage();
    const custom = {
      ...model.createCustomPersonaCard({ name: "保留人物", announcerName: "Kept Persona", role: "观察者", summary: "已有内容", color: "#445566", image: "data:image/png;base64,AAAA" }),
      code: "KEPT CODE",
      tags: ["保留标签"],
      status: "active",
    };
    const legacyCustom = { ...custom };
    delete legacyCustom.artSource;
    delete legacyCustom.artAssetId;
    const legacyMale = { ...custom, id: "custom-template-male-v1", templateId: "male", name: "男性空位卡" };
    const legacyFemale = { ...custom, id: "custom-template-female-v1", templateId: "female", name: "女性空位卡" };
    storage.setItem(model.PERSONA_CARD_STORAGE_KEY, JSON.stringify({ schema: model.PERSONA_CARD_SCHEMA, version: 1, cards: [legacyMale, legacyCustom, legacyFemale] }));
    const restored = model.readPersonaCardStorage(storage);
    assert.equal(restored.cards.length, 1);
    assert.equal(restored.cards[0].name, "保留人物");
    assert.equal(restored.cards[0].code, "KEPT CODE");
    assert.deepEqual(restored.cards[0].tags, ["保留标签"]);
    assert.equal(restored.cards[0].artSource, "uploaded");
    const five = Array.from({ length: 5 }, (_, index) => model.toPersonaCard({ ...baseline(), id: `fixed-${index}` }));
    const displayCards = model.normalizePersonaCardCollection([...five, legacyMale, legacyFemale]);
    assert.equal(displayCards.length, 6);
    assert.equal(displayCards.filter((card) => card.templateId).length, 1);
    assert.equal(displayCards.at(-1).id, "custom-template-empty-v1");
    assert.equal(model.PERSONA_CARD_TEMPLATE_CARDS.length, 1);
    assert.equal(model.PERSONA_CARD_TEMPLATE_CARDS[0].code, "EMPTY SLOT");
    assert.equal(model.PERSONA_CARD_TEMPLATE_CARDS[0].role, "空白角色位");
    assert.equal(model.PERSONA_CARD_TEMPLATE_CARDS[0].image, "");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("editor exposes the integration boundary without changing the driver or history modules", async () => {
  const source = await readFile(new URL("../app/persona-card-editor.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/persona-card-editor.module.css", import.meta.url), "utf8");
  assert.match(source, /baselineCards/);
  assert.match(source, /onCardInsert/);
  assert.match(source, /onAnnounce/);
  assert.match(source, /onCardDragStart/);
  assert.match(source, /loadPersonaRandomPoolManifest/);
  assert.match(source, /assignRandomPoolArt/);
  assert.match(source, /换一张/);
  assert.match(source, /card\.source === "custom" \|\| card\.source === "soul"/);
  assert.match(source, /toPersonaCardDragItem\(card\)/);
  assert.match(source, /createCustomPersonaCard\(\)/);
  assert.match(source, /initialTemplateId/);
  assert.match(source, /createTemplateDraft/);
  assert.match(source, /onCardSaved\?\.\(saved\)/);
  assert.match(source, /const isDraggable = isUsable && !card\.templateId/);
  assert.match(source, /复制后编辑/);
  assert.match(source, /删除只影响卡片存储，不删除历史唤起记录/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /grid-template-columns/);
});
