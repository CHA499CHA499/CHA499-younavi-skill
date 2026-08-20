import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps Persona Driver rods inside the vertical cavities", async () => {
  const [scene, closure, styles] = await Promise.all([
    readFile(new URL("app/driver-texture-scene.tsx", root), "utf8"),
    readFile(new URL("app/driver-closure-layer.tsx", root), "utf8"),
    readFile(new URL("app/driver-closure-layer.module.css", root), "utf8"),
  ]);

  assert.match(scene, /DriverClosureLayer/);
  assert.match(closure, /data-layer="center-core"/);
  assert.match(closure, /SideChassisAssembly/);
  assert.match(closure, /data-layer=\{`\$\{side\}-side-assembly`\}/);
  assert.match(closure, /data-slot-window=\{side\}/);
  assert.match(closure, /data-rod-viewport=\{side\}/);
  assert.match(closure, /\{equipped && \(/);
  assert.match(closure, /data-payload-state="charged"/);
  assert.doesNotMatch(closure, /payloadsVisible|rodAssets\.energy\.empty|rodAssets\.skill\.empty/);
  assert.doesNotMatch(closure, /phase === "locked" \|\| phase === "activated"/);
  assert.match(closure, /rodAssets\.skill\.charged/);
  assert.match(styles, /--driver-slot-left: 27\.55%/);
  assert.match(styles, /--driver-slot-right: 72\.45%/);
  assert.match(styles, /--driver-slot-window-width: 6\.76%/);
  assert.match(styles, /--driver-slot-window-height: 52\.2%/);
  assert.match(styles, /One transform owner per side/);
  assert.match(styles, /\.rodSprite \{/);
  assert.match(styles, /height: var\(--driver-rod-fill\)/);
  assert.match(styles, /width: 100%/);
  assert.match(styles, /\.rodViewport \{/);
  assert.match(styles, /overflow: hidden/);
  assert.match(styles, /transform: translateY\(-100%\)/);
  assert.match(styles, /transform: translateY\(0\)/);
  assert.doesNotMatch(styles, /\.rodSprite[\s\S]*aspect-ratio/);
  assert.match(styles, /@keyframes side-rod-insert/);
  assert.doesNotMatch(styles, /opacity: \.05/);
  assert.doesNotMatch(styles, /payload-insert|leftPayloadMotion|rightPayloadMotion|leftFrontMask|rightFrontMask/);
  assert.match(styles, /texture-driver-foreground/);
  assert.match(closure, /left-slot-foreground-v2\.png/);
  assert.match(closure, /right-slot-foreground-v2\.png/);
});

test("uses the charged energy rod only after equipped and keeps loose states distinct", async () => {
  const [scene, page, css, empty, charged] = await Promise.all([
    readFile(new URL("app/driver-texture-scene.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("public/driver-textures/energy-rod-empty-v1.png", root)),
    readFile(new URL("public/driver-textures/energy-rod-charged-v1.png", root)),
  ]);

  assert.match(scene, /charged: "\/driver-textures\/energy-rod-charged-tight-v1\.png"/);
  assert.match(page, /energy-rod-charged-v1\.png/);
  assert.match(css, /\.driver-rod-card\.energy:not\(\.is-charged\) \.driver-rod-visual i/);
  assert.ok(empty.byteLength > 1_000_000, "empty energy rod asset is unexpectedly small");
  assert.ok(charged.byteLength > 1_000_000, "charged energy rod asset is unexpectedly small");
});

test("enforces the canonical rod canvas and alpha bbox contract", async () => {
  const paths = [
    "public/driver-textures/energy-rod-canonical-v1.png",
    "public/driver-textures/energy-rod-empty-canonical-v1.png",
    "public/driver-textures/energy-rod-charged-canonical-v1.png",
    "public/driver-textures/skill-rod-canonical-v1.png",
    "public/driver-textures/skill-rod-charged-canonical-v1.png",
    "public/driver-textures/energy-rod-tight-v1.png",
    "public/driver-textures/energy-rod-empty-tight-v1.png",
    "public/driver-textures/energy-rod-charged-tight-v1.png",
    "public/driver-textures/skill-rod-tight-v1.png",
    "public/driver-textures/skill-rod-charged-tight-v1.png",
    "public/driver-textures/energy-rod-tight-v1.png",
    "public/driver-textures/energy-rod-empty-tight-v1.png",
    "public/driver-textures/energy-rod-charged-tight-v1.png",
    "public/driver-textures/skill-rod-tight-v1.png",
    "public/driver-textures/skill-rod-charged-tight-v1.png",
  ];
  for (const path of paths) {
    const { data, info } = await sharp(await readFile(new URL(path, root))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const isTight = path.includes("-tight-");
    assert.deepEqual([info.width, info.height], isTight ? [256, 1500] : [1024, 1536], `${path} canvas drifted`);
    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    assert.deepEqual([minX, minY, maxX + 1, maxY + 1], isTight ? [0, 0, 256, 1500] : [384, 18, 640, 1518], `${path} alpha bbox drifted`);
  }
});

test("moves complete side chassis modules while keeping the core/card fixed", async () => {
  const [scene, closure, styles] = await Promise.all([
    readFile(new URL("app/driver-texture-scene.tsx", root), "utf8"),
    readFile(new URL("app/driver-closure-layer.tsx", root), "utf8"),
    readFile(new URL("app/driver-closure-layer.module.css", root), "utf8"),
  ]);

  assert.match(scene, /data-closure-state=\{closureState\}/);
  assert.match(styles, /--chassis-shift: 10\.5%/);
  assert.match(closure, /data-layer=\{`\$\{side\}-payload`\}/);
  assert.match(styles, /\.leftSideAssembly[\s\S]*translateX\(calc\(var\(--driver-close\) \* var\(--chassis-shift\)\)/);
  assert.match(styles, /\.rightSideAssembly[\s\S]*translateX\(calc\(var\(--driver-close\) \* var\(--chassis-shift\) \* -1\)/);
  assert.match(styles, /@keyframes side-assembly-left-snap/);
  assert.match(styles, /@keyframes side-assembly-right-snap/);
  assert.match(styles, /@keyframes snap-lock/);
  assert.match(styles, /@keyframes snap-flash/);
  assert.match(styles, /\.sideAssembly \{/);
  assert.match(styles, /\.slotWindow \{/);
  assert.match(styles, /\.slotForegroundMask \{/);
  assert.doesNotMatch(closure, /payloadMotion|frontMaskMotion|leftPayloadMotion|rightPayloadMotion|leftFrontMask|rightFrontMask/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(styles, /clampArm|lockStop|energyClamp|skillClamp/);
  assert.doesNotMatch(styles, /:global\(\.driver-assembly\)[^{]*\{[^}]*transform/);
  assert.match(styles, /translate\(-50%, -50%\)/);
});

test("ships the four v2 assembly layers and four QA state renders", async () => {
  const assets = [
    "public/driver-textures/assembly/center-core-v2.png",
    "public/driver-textures/assembly/left-chassis-v2.png",
    "public/driver-textures/assembly/right-chassis-v2.png",
    "public/driver-textures/assembly/foreground-masks-v2.png",
    "public/driver-textures/assembly/left-slot-foreground-v2.png",
    "public/driver-textures/assembly/right-slot-foreground-v2.png",
    "public/driver-textures/energy-rod-canonical-v1.png",
    "public/driver-textures/energy-rod-empty-canonical-v1.png",
    "public/driver-textures/energy-rod-charged-canonical-v1.png",
    "public/driver-textures/skill-rod-canonical-v1.png",
    "public/driver-textures/skill-rod-charged-canonical-v1.png",
    "public/driver-textures/qa/driver-open.png",
    "public/driver-textures/qa/driver-mid.png",
    "public/driver-textures/qa/driver-snap.png",
    "public/driver-textures/qa/driver-final.png",
    "public/driver-textures/qa/driver-locked-empty.png",
    "public/driver-textures/qa/driver-energy-equipped.png",
    "public/driver-textures/qa/driver-skill-equipped.png",
    "public/driver-textures/qa/driver-both-closing.png",
    "public/driver-textures/qa/driver-both-final.png",
    "public/driver-textures/qa/driver-equipped-state-comparison.png",
    "public/driver-textures/qa/browser-timeline/metrics.json",
    "public/driver-textures/qa/browser-timeline/single-energy/contact-sheet.png",
    "public/driver-textures/qa/browser-timeline/single-energy-tight/contact-sheet.png",
    "public/driver-textures/qa/browser-timeline/single-energy-tight/metrics.json",
    "public/driver-textures/qa/browser-timeline/double-activated/contact-sheet.png",
    "public/driver-textures/qa/audit-1440/all-guides.png",
    "public/driver-textures/qa/audit-1440/all-clean.png",
    "public/driver-textures/qa/audit-1920/all-guides.png",
    "public/driver-textures/qa/audit-1920/all-clean.png",
  ];
  const files = await Promise.all(assets.map((asset) => readFile(new URL(asset, root))));
  for (const file of files) assert.ok(file.byteLength > 1_000, "assembly or QA asset is unexpectedly empty");
});

test("records real browser timeline evidence for single and double rod states", async () => {
  const metrics = JSON.parse(await readFile(new URL("public/driver-textures/qa/browser-timeline/metrics.json", root), "utf8"));
  assert.equal(metrics.singleEnergy.length, 8);
  assert.equal(metrics.handleProgress.length, 6);
  assert.equal(metrics.activated.length, 6);
  assert.ok(metrics.singleEnergy.every((sample) => sample.exists && sample.display === "block" && sample.visibility === "visible" && Number(sample.opacity) >= 0.99));
  assert.ok(metrics.singleEnergy[0].intersectionArea < metrics.singleEnergy.at(-1).intersectionArea);
  assert.ok(metrics.singleEnergy.at(-1).intersectionArea >= metrics.singleEnergy.at(-2).intersectionArea);
  assert.ok(metrics.singleEnergy.every((sample) => sample.rodHeightRatio >= 0.92 && sample.rodHeightRatio <= 0.96));
  assert.ok(metrics.handleProgress.some((sample) => Number(sample.progress) > 0));
  assert.ok(metrics.activated.every((sample) => sample.phase === "ACTIVATED" && sample.rods.every((rod) => rod.exists && rod.display === "block" && rod.visibility === "visible" && Number(rod.opacity) >= 0.99)));
  assert.equal(metrics.finalVerification.phase, "ACTIVATED");
  assert.ok(metrics.finalVerification.rods.every((rod) => rod.exists && rod.display === "block" && rod.visibility === "visible" && Number(rod.opacity) >= 0.99));
});
