import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const audioFile = new URL("../app/driver-audio.ts", import.meta.url);
const libraryFile = new URL("../app/audio-library.ts", import.meta.url);

test("declares separate, non-mixed Driver audio events", async () => {
  const [driverAudio, library] = await Promise.all([
    readFile(audioFile, "utf8"),
    readFile(libraryFile, "utf8"),
  ]);

  for (const event of ["pack-open", "pack-reveal", "card-deal", "skill-rod-select", "assembly", "final-snap"]) {
    assert.match(library, new RegExp(`"${event}"`), `${event} is not in the event map`);
  }
  for (const exportName of [
    "playPackOpenSound",
    "playStarterPackOpenSound",
    "playPackRevealSound",
    "playCardDealBeat",
    "playSkillRodSelectSound",
    "playAssemblySound",
    "playFinalSnapSound",
  ]) {
    assert.match(driverAudio, new RegExp(`export function ${exportName}`));
  }
  assert.match(driverAudio, /playFinalSnapSound\(\)/);
  assert.match(library, /"pack-open": \{ kind: "decade-candidate", fallback: "web-audio" \}/);
  assert.match(library, /"pack-reveal": \{ kind: "decade-candidate", fallback: "web-audio" \}/);
  assert.match(library, /"card-deal": \{ kind: "decade-candidate", fallback: "web-audio" \}/);
  assert.match(library, /assembly: \{ kind: "decade-candidate", fallback: "web-audio" \}/);
});

test("keeps voice playback same-origin and rotates through a no-repeat pool", async () => {
  const [driverAudio, library] = await Promise.all([
    readFile(audioFile, "utf8"),
    readFile(libraryFile, "utf8"),
  ]);

  assert.match(library, /sameOrigin: true/);
  assert.match(library, /source: "site-cleared"/);
  assert.match(library, /chooseNextDecadeCandidate/);
  assert.match(library, /lastCandidateByEvent/);
  assert.match(library, /getDriverAudioBundleMode/);
  assert.match(driverAudio, /playRandomPersonaVoice/);
  assert.match(driverAudio, /playLocalCandidateEvent/);
  assert.match(driverAudio, /dealBeatQueue/);
  assert.match(driverAudio, /dealBeatActive/);
  assert.match(driverAudio, /playAudioClip\(request\.url, "card-deal", finish, fallback\)/);
  assert.match(driverAudio, /clearDealBeatQueue/);
  assert.match(driverAudio, /refreshDriverAudioManifest/);
  assert.match(driverAudio, /getDriverAudioManifestStatus/);
  assert.match(driverAudio, /local-candidate-unavailable/);
  assert.match(driverAudio, /autoplay-rejected/);
  assert.match(driverAudio, /resource-error/);
  assert.match(driverAudio, /playback-stalled/);
  assert.match(driverAudio, /start-timeout/);
  assert.match(driverAudio, /status: "fallback"/);
  assert.match(driverAudio, /getDriverAudioDiagnostics/);
  assert.match(driverAudio, /subscribeDriverAudioDiagnostics/);
});

test("ships the single currently authorized voice resource with a stable public URL", async () => {
  const [library, asset, publicFiles] = await Promise.all([
    readFile(libraryFile, "utf8"),
    stat(new URL("../public/audio/persona-driver-announcer-v2-expressive.m4a", import.meta.url)),
    readdir(new URL("../public/audio", import.meta.url)),
  ]);

  assert.match(library, /PUBLIC_CLEARED_VOICE_RESOURCES/);
  assert.match(library, /layer: "public-cleared"/);
  assert.equal(publicFiles.filter((file) => file.endsWith(".m4a")).length, 1);
  assert.ok(asset.size > 100_000);
});

test("ships the complete local-test Decade layer and keeps it out of the public-cleared count", async () => {
  const [library, manifestSource, decadeFiles, announcerFiles, sourceAsset] = await Promise.all([
    readFile(libraryFile, "utf8"),
    readFile(new URL("../public/audio/local-test/manifest.json", import.meta.url), "utf8"),
    readdir(new URL("../public/audio/local-test/decade", import.meta.url)),
    readdir(new URL("../public/audio/local-test/announcer", import.meta.url)),
    stat(new URL("../public/audio/local-test/decade/decade-source-p1-heisei.m4a", import.meta.url)),
  ]);

  assert.match(library, /LOCAL_TEST_DECADE_CANDIDATES/);
  assert.match(library, /LOCAL_TEST_ANNOUNCERS/);
  assert.match(library, /LOCAL_TEST_MANIFEST_URL/);
  assert.match(library, /refreshLocalTestManifest/);
  assert.match(library, /mergeById/);
  assert.match(library, /localTestManifestState/);
  assert.match(library, /layer: "local-test"/);
  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.layer, "local-test");
  assert.ok(manifest.decadeCandidates.length >= 16);
  assert.equal(manifest.announcers.length, 9);
  assert.ok(decadeFiles.filter((file) => /^candidate-\d+\.m4a$/.test(file)).length >= 16);
  assert.equal(announcerFiles.filter((file) => file.endsWith(".m4a")).length, 9);
  assert.ok(sourceAsset.size > 100_000);
});

test("keeps announcer mapping exact and reports missing normal/custom fallback", async () => {
  const [library, driverAudio] = await Promise.all([
    readFile(libraryFile, "utf8"),
    readFile(audioFile, "utf8"),
  ]);
  assert.match(library, /persona-donald-john-trump\.m4a/);
  assert.match(library, /command-decide\.m4a/);
  assert.match(library, /commandId === "decide"/);
  assert.match(driverAudio, /missing-command-announcer/);
  assert.match(driverAudio, /announcer-mapping-incomplete/);
  assert.doesNotMatch(library, /command-normal\.m4a/);
  assert.doesNotMatch(library, /command-custom\.m4a/);
});

test("does not mix the separate meme-soundboard collection into the Decade manifest", async () => {
  const library = await readFile(libraryFile, "utf8");
  assert.doesNotMatch(library, /meme-soundboard/);
  assert.doesNotMatch(library, /outputs\//);
  assert.doesNotMatch(library, /vault\//);
});

test("shuffle bag refills after exhaustion for one candidate and N plus one draws", async () => {
  const { chooseNextDecadeCandidate, resetDecadeCandidateRotation, selectFromShuffleBag } = await import(libraryFile.href);
  const single = [{ id: "only" }];
  let singleStored;
  let singleLast = null;
  for (let draw = 0; draw < 2; draw += 1) {
    const selection = selectFromShuffleBag(single, singleStored, singleLast, () => 0);
    assert.equal(selection.candidate?.id, "only");
    singleStored = selection.remaining;
    singleLast = selection.lastId;
  }

  const candidates = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const output = [];
  let stored;
  let last = null;
  for (let draw = 0; draw < candidates.length + 1; draw += 1) {
    const selection = selectFromShuffleBag(candidates, stored, last, () => 0);
    assert.ok(selection.candidate);
    output.push(selection.candidate.id);
    stored = selection.remaining;
    last = selection.lastId;
  }
  assert.deepEqual(output, ["a", "b", "c", "a"]);
  assert.notEqual(output[2], output[3]);

  resetDecadeCandidateRotation();
  const assemblyDraws = Array.from({ length: 5 }, () => chooseNextDecadeCandidate("assembly", () => 0, "local-test"));
  assert.ok(assemblyDraws.every(Boolean));
  for (let index = 1; index < assemblyDraws.length; index += 1) {
    assert.notEqual(assemblyDraws[index]?.id, assemblyDraws[index - 1]?.id);
  }
});

test("shuffle bag normalizes random edge cases and guards empty pools", async () => {
  const { chooseNextDecadeCandidate, selectFromShuffleBag } = await import(libraryFile.href);
  const candidates = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(selectFromShuffleBag(candidates, null, null, () => 1).candidate?.id, "c");
  assert.equal(selectFromShuffleBag(candidates, null, null, () => Number.NaN).candidate?.id, "a");
  assert.equal(selectFromShuffleBag(candidates, null, null, () => -9).candidate?.id, "a");
  assert.equal(selectFromShuffleBag(candidates, null, null, () => { throw new Error("random failed"); }).candidate?.id, "a");
  assert.equal(selectFromShuffleBag([], [], null, () => 0).candidate, null);
  assert.equal(chooseNextDecadeCandidate("missing-event", () => 0, "local-test"), null);
});

test("malformed manifest candidates are filtered without replacing the seed pool", async () => {
  const previousMode = process.env.NEXT_PUBLIC_PERSONA_DRIVER_AUDIO_MODE;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_PERSONA_DRIVER_AUDIO_MODE = "local-test";
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      version: 2,
      layer: "local-test",
      decadeCandidates: [
        null,
        {},
        { id: "bad-url", url: "https://example.com/bad.m4a", event: "assembly", sourceCandidate: 17 },
        { id: "bad-event", url: "/audio/local-test/decade/bad-event.m4a", event: "unknown", sourceCandidate: 18 },
        { id: "bad-number", url: "/audio/local-test/decade/bad-number.m4a", event: "assembly", sourceCandidate: -1 },
      ],
      announcers: [null],
    }),
  });
  try {
    const library = await import(libraryFile.href);
    const before = library.getDriverAudioResourceManifest("local-test").localTest.decadeCandidates.length;
    await library.refreshLocalTestManifest(true);
    const after = library.getDriverAudioResourceManifest("local-test").localTest.decadeCandidates.length;
    assert.equal(after, before);
    assert.equal(library.getLocalTestManifestStatus().state, "loaded");
  } finally {
    if (previousMode === undefined) delete process.env.NEXT_PUBLIC_PERSONA_DRIVER_AUDIO_MODE;
    else process.env.NEXT_PUBLIC_PERSONA_DRIVER_AUDIO_MODE = previousMode;
    globalThis.fetch = previousFetch;
  }
});

test("playCardInsertSound never throws into the insertion business flow", async () => {
  const previousMode = process.env.NEXT_PUBLIC_PERSONA_DRIVER_AUDIO_MODE;
  const previousAudio = globalThis.Audio;
  const { createServer } = await import("vite");
  const server = await createServer({
    root: new URL("..", import.meta.url).pathname,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  process.env.NEXT_PUBLIC_PERSONA_DRIVER_AUDIO_MODE = "local-test";
  globalThis.Audio = class ThrowingAudio {
    constructor() {
      throw new Error("audio construction failed");
    }
  };
  try {
    const driverAudio = await server.ssrLoadModule("/app/driver-audio.ts");
    assert.doesNotThrow(() => driverAudio.playCardInsertSound());
    assert.ok(driverAudio.getDriverAudioDiagnostics());
  } finally {
    await server.close();
    if (previousMode === undefined) delete process.env.NEXT_PUBLIC_PERSONA_DRIVER_AUDIO_MODE;
    else process.env.NEXT_PUBLIC_PERSONA_DRIVER_AUDIO_MODE = previousMode;
    if (previousAudio === undefined) delete globalThis.Audio;
    else globalThis.Audio = previousAudio;
  }
});
