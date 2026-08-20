import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("maps the five Persona motions to the approved resources", async (t) => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const approved = [
    "/personas-motion/naval.mp4",
    "/personas-motion/elon-musk.mp4",
    "/personas-motion-v3-intense/steve-jobs-action-masked-intense-v3.mp4",
    "/personas-motion-v3-intense/donald-trump-action-masked-intense-v3.mp4",
    "/personas-motion-v3-intense/paul-graham-action-masked-intense-v3.mp4",
  ];
  for (const asset of approved) assert.ok(page.includes(`motion: "${asset}"`), `missing motion mapping: ${asset}`);
  assert.doesNotMatch(page, /personas-motion-v3-intense\/(naval|elon-musk)-action-masked-intense-v3\.mp4/);
  let files;
  try {
    files = await Promise.all(approved.map((asset) => readFile(new URL(`public${asset}`, root))));
  } catch {
    return t.skip("视频素材按项目打包策略暂不随仓库提交");
  }
  for (const file of files) assert.ok(file.byteLength > 1_000_000);
});

test("reveals any selected pack card through real video with static fallbacks", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /function revealPackCard\(personaId: string\)/);
  assert.doesNotMatch(page, /nextPackPersona|isNext|等待前一张/);
  assert.match(page, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(page, /finishPackReveal\(personaId\)/);
  assert.match(page, /setRevealedPackIds/);
  assert.match(page, /setViewedEntranceIds/);
  assert.match(page, /className="pack-entrance-video"/);
  assert.match(page, /autoPlay muted playsInline preload="auto"/);
  assert.match(page, /onEnded=\{\(\) => finishPackReveal/);
  assert.match(page, /onError=\{\(\) => finishPackReveal/);
  assert.match(page, />跳过动画<\/button>/);
  assert.match(page, /if \(progress\.packOpened\) setScreen\("deal-cards"\)/);
  assert.doesNotMatch(page, /setRevealedPackIds\(PERSONAS\.map/);
  assert.match(page, /aria-label=\{revealed \? `重播\$\{persona\.name\}角色动画` : `翻开\$\{persona\.name\}`\}/);
  assert.doesNotMatch(page, /disabled=\{revealed|disabled=\{.*packEntrancePersonaId/);
});

test("skips all remaining pack animations and persists the completed five-card state", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /function revealAllPackCards\(\)/);
  assert.match(page, /packEntranceVideoRef\.current/);
  assert.match(page, /video\.pause\(\)/);
  assert.match(page, /video\.currentTime = 0/);
  assert.match(page, /stopPackEntrancePreset\(\)/);
  assert.match(page, /const allPersonaIds = PERSONAS\.map\(\(persona\) => persona\.id\)/);
  assert.match(page, /setRevealedPackIds\(allPersonaIds\)/);
  assert.match(page, /setViewedEntranceIds\(allPersonaIds\)/);
  assert.match(page, /className="pack-skip-all"/);
  assert.match(page, /className="pack-entrance-skip" type="button" onClick=\{revealAllPackCards\}/);
  assert.match(page, /if \(progress\.packOpened\) setScreen\("deal-cards"\)/);
});

test("keeps the pack heading and helper copy single-line without an eyebrow", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.doesNotMatch(page, /DEALING PERSONA CARDS/);
  assert.match(page, /点击任意卡牌翻开/);
  assert.match(page, /任选卡牌观看角色动画/);
  assert.match(css, /\.pack-reveal-copy h1[\s\S]*white-space: nowrap/);
  assert.match(css, /\.pack-reveal-copy p[\s\S]*white-space: nowrap/);
  assert.match(css, /\.pack-skip-all[\s\S]*position: absolute[\s\S]*right: 0[\s\S]*bottom: 26px/);
});

test("mounts and plays the selected Persona motion from activateDriver", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(page, /function activateDriver\(\)[\s\S]*setPhase\("activated"\)[\s\S]*triggerActivationMotion\(selectedPersona\)[\s\S]*startNaviConversation/);
  assert.match(page, /activationStartedRef\.current/);
  assert.match(page, /ref=\{activationVideoRef\}/);
  assert.match(page, /onLoadedData=\{\(\) => void playActivationMotionVideo\(\)\}/);
  assert.match(page, /await video\.play\(\)/);
  assert.match(page, /onEnded=\{\(\) => finishActivationMotion\("ended"\)\}/);
  assert.match(page, /onError=\{\(\) => finishActivationMotion\("error"/);
  assert.match(page, /setActivationMotionStatus\("skipped"\)/);
  assert.match(page, /driver-activation-motion-diagnostic/);
  assert.match(css, /\.driver-activation-motion[\s\S]*position: absolute/);
  assert.match(css, /\.driver-activation-video[\s\S]*object-fit: contain/);
});
