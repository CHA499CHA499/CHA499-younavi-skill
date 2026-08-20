import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("shows exactly one drop guide for the held item kind", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /holding-\$\{heldItem\.kind === "rod" \? heldItem\.id : "persona"\}/);
  assert.match(css, /\.driver-stage\.holding-persona \.driver-drop-guide\.persona/);
  assert.match(css, /\.driver-stage\.holding-energy \.driver-drop-guide\.energy/);
  assert.match(css, /\.driver-stage\.holding-skill \.driver-drop-guide\.skill/);
  assert.doesNotMatch(css, /\.holding-rod/);
  assert.doesNotMatch(css, /holding-energy \.driver-drop-guide\.skill|holding-skill \.driver-drop-guide\.energy/);
});

test("uses the real left-energy and right-skill slot bounds for guides and drops", async () => {
  const [page, css, closure, closureCss] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/driver-closure-layer.tsx", root), "utf8"),
    readFile(new URL("app/driver-closure-layer.module.css", root), "utf8"),
  ]);

  assert.match(page, /energy: \{ left: 0\.2417, right: 0\.3093, top: 0\.239, bottom: 0\.761 \}/);
  assert.match(page, /skill: \{ left: 0\.6907, right: 0\.7583, top: 0\.239, bottom: 0\.761 \}/);
  assert.match(page, /return x > bounds\.left && x < bounds\.right && y > bounds\.top && y < bounds\.bottom \? item\.id : null/);
  assert.match(css, /\.driver-drop-guide\.energy \{ left: 24\.17%; top: 23\.9%; width: 6\.76%; height: 52\.2%; \}/);
  assert.match(css, /\.driver-drop-guide\.skill \{ left: 69\.07%; top: 23\.9%; width: 6\.76%; height: 52\.2%; \}/);
  assert.match(closureCss, /--driver-slot-left: 27\.55%/);
  assert.match(closureCss, /--driver-slot-right: 72\.45%/);
  assert.match(closureCss, /--driver-slot-window-width: 6\.76%/);
  assert.match(closure, /side="left"[\s\S]*rodKind="energy"/);
  assert.match(closure, /side="right"[\s\S]*rodKind="skill"/);
  assert.match(closure, /data-rod-kind=\{rodKind\}/);
});

test("places belt handles in a normal-flow control band below the Driver visual zone", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  const visualIndex = page.indexOf('className="driver-visual-zone"');
  const bandIndex = page.indexOf('className="driver-handle-band"');
  const controlsIndex = page.indexOf('className="driver-controls"');
  assert.ok(visualIndex >= 0 && visualIndex < bandIndex && bandIndex < controlsIndex);
  assert.match(page, /data-driver-control-band="belt"/);
  const handlesBlock = css.match(/\.driver-belt-handles\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(handlesBlock, /position: relative/);
  assert.match(handlesBlock, /gap: 24px/);
  assert.doesNotMatch(handlesBlock, /top:|left: 50%|position: absolute|translate\(-50%/);
  assert.doesNotMatch(css, /\.driver-belt-handles[\s\S]{0,180}top: 57%/);
});
