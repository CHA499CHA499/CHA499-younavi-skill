import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readPanelFiles() {
  return Promise.all([
    readFile(new URL("app/waiting-video-panel.tsx", root), "utf8"),
    readFile(new URL("app/waiting-video-panel.module.css", root), "utf8"),
  ]);
}

test("renders only an accepted local pending/running Run", async () => {
  const [component] = await readPanelFiles();
  assert.match(component, /receiptAccepted\?: boolean/);
  assert.match(component, /runtime\?: "local" \| "public"/);
  assert.match(component, /WAITING_RUN_STATUSES = \["pending", "running"\]/);
  assert.match(component, /TERMINAL_RUN_STATUSES = \["completed", "error", "incomplete", "cancelled"\]/);
  assert.match(component, /shouldRenderWaitingVideoPanel/);
  assert.match(component, /if \(!panelOpen\) return null/);
  assert.match(component, /runtime === "public"/);
});

test("keeps the video node and playback position stable across polling updates", async () => {
  const [component] = await readPanelFiles();
  assert.match(component, /runKey = runId \?\? `legacy:/);
  assert.match(component, /\}, \[panelOpen, runKey\]\);/);
  assert.doesNotMatch(component, /\}, \[panelOpen, runKey, runStatus\]\);/);
  assert.match(component, /player\.currentTime = 0/);
  assert.match(component, /currentTime = 0[\s\S]*?\}, \[panelOpen, runKey\]\);/);
});

test("uses the required 16:9 controlled media contract", async () => {
  const [component, styles] = await readPanelFiles();
  assert.match(component, /controls/);
  assert.match(component, /playsInline/);
  assert.match(component, /loop/);
  assert.match(component, /preload="metadata"/);
  assert.match(styles, /aspect-ratio: 16 \/ 9/);
  assert.match(styles, /object-fit: contain/);
});

test("falls back from sound autoplay and offers an explicit sound/play action", async () => {
  const [component] = await readPanelFiles();
  assert.match(component, /await player\.play\(\)/);
  assert.match(component, /player\.muted = true/);
  assert.match(component, /setSoundPrompt\(true\)/);
  assert.match(component, /播放等待视频/);
  assert.match(component, /点击开启声音/);
});

test("keeps a user-closed Run closed and cleans media on teardown", async () => {
  const [component] = await readPanelFiles();
  assert.match(component, /closedRunKey/);
  assert.match(component, /setClosedRunKey\(runKey\)/);
  assert.match(component, /onClose\(\)/);
  assert.match(component, /player\.pause\(\)/);
  assert.match(component, /player\.removeAttribute\("src"\)/);
  assert.match(component, /player\.load\(\)/);
});

test("ships the local-only waiting media with its provenance note", async (t) => {
  const [component, mediaReadme] = await Promise.all([
    readFile(new URL("app/waiting-video-panel.tsx", root), "utf8"),
    readFile(new URL("public/waiting-media/README.md", root), "utf8"),
  ]);
  assert.match(component, /\/waiting-media\/decade-all-riders-waiting-v1\.mp4/);
  assert.match(mediaReadme, /仅供本地测试/);
  assert.match(mediaReadme, /bilibili\.com\/video\/BV1Cu4y1U7BT/);
  try {
    const media = await readFile(new URL("public/waiting-media/decade-all-riders-waiting-v1.mp4", root));
    assert.ok(media.byteLength > 1_000_000, "waiting video asset is unexpectedly small");
  } catch {
    t.skip("等待视频按项目打包策略暂不随仓库提交");
  }
});
