import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildRunResultTitle, humanizeSourceDisplayName } from "../app/run-result-presentation.mjs";

test("result titles follow the real command and task semantics", () => {
  assert.equal(buildRunResultTitle({ commandId: "review", task: "评审假面骑事工作台首次使用路径" }), "评审《假面骑事工作台首次使用路径》");
  assert.equal(buildRunResultTitle({ commandId: "explain", task: "解释所选素材《个人电脑史》的背景、关键概念、因果链和历史逻辑。" }), "解释《个人电脑史》");
  assert.equal(buildRunResultTitle({ commandId: "decision", task: "基于所选素材《产品路线》比较方案、代价和不可逆风险并给出建议。" }), "决策《产品路线》");
  assert.equal(buildRunResultTitle({ commandId: "action", task: "基于所选素材《发布计划》提炼行动、负责人、验收标准与风险。" }), "制定《发布计划》行动方案");
  assert.equal(buildRunResultTitle({ commandId: "review", task: "", sourceDisplayName: "本次材料" }), "评审《本次材料》");
  assert.equal(buildRunResultTitle({ commandId: "explain" }), "解释《本次任务》");
  assert.equal(humanizeSourceDisplayName("比尔盖茨_TED_Interview_原转写.txt"), "比尔盖茨 TED 访谈 原文");
});

test("RunResultSheet is a safe structured Markdown reader", async () => {
  const [source, css, page, bridge] = await Promise.all([
    readFile(new URL("../app/run-result-sheet.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/run-result-sheet.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/persona-navi-bridge.mjs", import.meta.url), "utf8"),
  ]);
  for (const token of ["blockquote", "table", "code", "target=\"_blank\"", "noopener noreferrer"]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(css, /\.body h1/);
  assert.match(css, /\.body h2/);
  assert.match(source, /onClose/);
  assert.match(source, /阅读覆盖/);
  assert.match(source, /执行指令/);
  assert.match(source, /打开 YouNavi/);
  assert.match(source, /onOpenInYouNavi/);
  assert.match(page, /onOpenInYouNavi=.*openNaviRun/);
  assert.match(bridge, /openMatch[\s\S]*openYouNavi\(\)/);
  assert.match(source, /detailsOpen &&/);
  assert.match(source, /复制诊断信息/);
  const defaultMarkup = source.slice(source.indexOf("  return (\n    <div className"), source.indexOf("{hasDiagnostics"));
  assert.doesNotMatch(defaultMarkup, /taskId|conversationId|runId|skillName|sourceTechnicalName|sourcePath|sourceSha256/);
  assert.match(source, /Escape/);
  assert.match(source, /event\.key === "Tab"/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.match(source, /data-layout="center"/);
  assert.match(css, /place-items:\s*center/);
  assert.match(css, /width:\s*min\(1180px, calc\(100vw - 32px\)\)/);
  assert.match(css, /max-height:\s*88dvh/);
  assert.doesNotMatch(css, /justify-items:\s*end/);
  assert.doesNotMatch(css, /margin-right:\s*20px/);
  assert.match(css, /overflow: auto/);
  assert.match(css, /youNaviAction/);
  assert.match(css, /diagnostics/);
});
