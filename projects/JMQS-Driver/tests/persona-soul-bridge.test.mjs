import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createPersonaSoulRunService,
  inferSoulStage,
  readSoulArtifactForProjection,
  renderCreateSoulPrompt,
  validatePersonaSoulRequest,
} from "../scripts/persona-soul-bridge-lib.mjs";

const fixtureSoul = new URL("./fixtures/persona-soul-fixture/soul/", import.meta.url);

function request(overrides = {}) {
  return {
    schema: "persona.soul-run/v1",
    runId: "psoul-fixture-run-1234",
    mode: "from-soul",
    personName: "林默",
    oneLineDescription: "产品研究与组织观察者",
    targetType: "other",
    sourceMode: "uploaded-files",
    exactMaterialPaths: ["/tmp/lin-mo-source.md"],
    publicSources: [],
    collectionScope: {
      confirmed: true,
      scopeText: "只使用用户明确提供的文件",
      exclusionsText: "不读取其他目录或隐私内容",
      speakerPurificationRequired: false,
      speakerPurificationConfirmed: false,
    },
    outputSlug: "lin-mo",
    outputDir: "outputs/persona-souls/lin-mo-soul",
    materialCount: 1,
    totalWordCount: 500,
    ...overrides,
  };
}

test("request contract rejects expansion paths and renders the interactive create-soul first message", () => {
  assert.throws(() => validatePersonaSoulRequest(request({ exactMaterialPaths: ["/Users/zqnw/.."] })), /目录穿越|主目录/);
  const validated = validatePersonaSoulRequest(request());
  const prompt = renderCreateSoulPrompt(validated);
  assert.match(prompt, /^\/create-soul 林默/);
  assert.match(prompt, /Step 1–5/);
  assert.match(prompt, /Step 6 安装到 YouNavi 前必须停下/);
  assert.match(prompt, /outputs\/persona-souls\/lin-mo-soul/);
  assert.match(prompt, /\/tmp\/lin-mo-source\.md/);
  assert.match(prompt, /禁止 find、目录遍历/);
});

test("fixture run creates a receipt without invoking real distillation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "persona-soul-run-"));
  const calls = [];
  try {
    const sourcePath = path.join(root, "lin-mo-source.md");
    const skillsDir = path.join(root, "skills");
    await writeFile(sourcePath, "fixture source", "utf8");
    await mkdir(path.join(skillsDir, "create-soul"), { recursive: true });
    await writeFile(path.join(skillsDir, "create-soul", "SKILL.md"), "---\nname: create-soul\ndescription: fixture\n---\n", "utf8");
    const service = createPersonaSoulRunService({
      runRoot: path.join(root, "runs"),
      workspaceRoot: root,
      skillsDir,
      prepareRuntime: async () => "/fixture/agent-cli",
      runCli: async (_cli, args) => {
        calls.push(args);
        return { success: true, data: { task_id: "task-fixture-1", conversation_id: "conversation-fixture-1" } };
      },
    });
    const receipt = await service.createRun(request({ exactMaterialPaths: [sourcePath] }));
    assert.equal(receipt.stage, "collecting");
    assert.equal(receipt.taskId, "task-fixture-1");
    assert.equal(receipt.conversationId, "conversation-fixture-1");
    assert.equal(receipt.requiresUserConversation, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0][5], /^\/create-soul 林默/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("artifact fixture is complete, source count is visible, and install verification is separate", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "persona-soul-fixture-"));
  try {
    const soulPath = path.join(root, "lin-mo-soul");
    const skillsDir = path.join(root, "skills");
    await cp(fixtureSoul, soulPath, { recursive: true });
    await cp(soulPath, path.join(skillsDir, "lin-mo-soul"), { recursive: true });
    const input = await readSoulArtifactForProjection({ soulPath, skillsDir, slug: "lin-mo", personName: "林默", oneLineDescription: "产品研究与组织观察者" });
    assert.equal(input.sourceCount, 5);
    assert.match(input.role, /产品研究/);
    assert.equal(input.installVerification.fileVerified, true);
    assert.equal(input.installVerification.verified, false);
    assert.equal(input.installVerification.indexStatus, "unconfirmed");
    assert.match(input.installVerification.error, /动态 Skill 索引未确认/);
    assert.match(input.skillFrontmatter.name, /lin-mo-chat/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("stage inference stays within the documented state machine", () => {
  assert.equal(inferSoulStage({ status: "running", text: "[distilling] Pass 1" }), "distilling");
  assert.equal(inferSoulStage({ status: "completed", text: "waiting for user confirmation" }), "ready");
  assert.equal(inferSoulStage({ status: "failed", text: "" }), "error");
});
