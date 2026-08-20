"use client";

import {
  chooseNextDecadeCandidate,
  DRIVER_AUDIO_EVENT_MAP,
  getDriverAudioBundleMode,
  getLocalTestManifestStatus,
  getLocalCommandAnnouncer,
  getLocalPersonaAnnouncer,
  getDriverAudioResourceManifest as getAudioResourceManifest,
  PUBLIC_CLEARED_VOICE_RESOURCES,
  refreshLocalTestManifest,
  type DriverAudioEvent,
} from "./audio-library";

let sharedContext: AudioContext | null = null;
let activeLocalClip: HTMLAudioElement | null = null;
let activeClipSettled = false;
type DealBeatRequest = { index: number; total: number; url?: string };
const dealBeatQueue: DealBeatRequest[] = [];
let dealBeatActive = false;
const LOCAL_CLIP_START_TIMEOUT_MS = 1400;
const REQUIRED_ANNOUNCER_URL = "/audio/persona-driver-announcer-v2-expressive.m4a";

export type DriverAudioDiagnostic = {
  event: DriverAudioEvent | "audio-context";
  status: "scheduled" | "started" | "completed" | "fallback" | "failed" | "interrupted" | "stopped";
  reason?: string;
  resourceUrl?: string;
  at: number;
};

let lastDiagnostic: DriverAudioDiagnostic | null = null;
const diagnosticListeners = new Set<(diagnostic: DriverAudioDiagnostic) => void>();

function reportAudio(diagnostic: Omit<DriverAudioDiagnostic, "at">) {
  lastDiagnostic = { ...diagnostic, at: Date.now() };
  diagnosticListeners.forEach((listener) => {
    try {
      listener(lastDiagnostic!);
    } catch {
      // Diagnostics must never become a new failure source for product flows.
    }
  });
}

function audioErrorReason(prefix: string, error: unknown) {
  const detail = error instanceof Error && error.message ? error.message : "unknown";
  return `${prefix}:${detail}`;
}

function safeAudioFallback(
  event: DriverAudioEvent,
  reason: string,
  fallback: () => boolean | void,
) {
  try {
    return fallback() !== false;
  } catch (error) {
    reportAudio({ event, status: "failed", reason: audioErrorReason(`${reason}-fallback-threw`, error) });
    return false;
  }
}

export function subscribeDriverAudioDiagnostics(listener: (diagnostic: DriverAudioDiagnostic) => void) {
  diagnosticListeners.add(listener);
  return () => diagnosticListeners.delete(listener);
}

export function getDriverAudioDiagnostics() {
  return lastDiagnostic;
}

export function getDriverAudioResourceManifest() {
  return getAudioResourceManifest();
}

export function refreshDriverAudioManifest(force = false) {
  return refreshLocalTestManifest(force);
}

export function getDriverAudioManifestStatus() {
  return getLocalTestManifestStatus();
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    sharedContext ??= new AudioContextClass();
    if (sharedContext.state === "suspended") {
      try {
        void sharedContext.resume().catch(() => {
          reportAudio({ event: "audio-context", status: "failed", reason: "resume-rejected" });
        });
      } catch (error) {
        reportAudio({ event: "audio-context", status: "failed", reason: audioErrorReason("resume-threw", error) });
      }
    }
    return sharedContext;
  } catch (error) {
    reportAudio({ event: "audio-context", status: "failed", reason: audioErrorReason("context-create-threw", error) });
    return null;
  }
}

function playWebAudioEvent(event: Exclude<DriverAudioEvent, "persona-voice">, render: (context: AudioContext) => void) {
  try {
    if (!DRIVER_AUDIO_EVENT_MAP[event]) {
      reportAudio({ event, status: "failed", reason: "event-not-mapped" });
      return false;
    }
    const context = getAudioContext();
    if (!context) {
      reportAudio({ event, status: "failed", reason: "audio-context-unavailable" });
      return false;
    }
    render(context);
    reportAudio({ event, status: "scheduled" });
    return true;
  } catch (error) {
    reportAudio({ event, status: "failed", reason: audioErrorReason("web-audio-threw", error) });
    return false;
  }
}

function tone(
  context: AudioContext,
  options: {
    start: number;
    duration: number;
    frequency: number;
    endFrequency?: number;
    gain: number;
    type?: OscillatorType;
  },
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startAt = context.currentTime + options.start;
  const endAt = startAt + options.duration;
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(options.frequency, startAt);
  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, endAt);
  }
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(options.gain, startAt + Math.min(0.025, options.duration / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);
}

function noiseBurst(context: AudioContext, start: number, duration: number, gainValue: number) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / samples.length, 2.5);
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const startAt = context.currentTime + start;
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1600, startAt);
  filter.frequency.exponentialRampToValueAtTime(240, startAt + duration);
  filter.Q.value = 1.2;
  gain.gain.setValueAtTime(gainValue, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(startAt);
  source.stop(startAt + duration);
}

export function playCardSelectSound() {
  playWebAudioEvent("card-select", (context) => {
    tone(context, { start: 0, duration: 0.08, frequency: 920, endFrequency: 650, gain: 0.075, type: "triangle" });
    tone(context, { start: 0.035, duration: 0.09, frequency: 1380, endFrequency: 1060, gain: 0.04, type: "sine" });
  });
}

export function playCardInsertSound() {
  return safeAudioAction("assembly", playAssemblySound, playAssemblyWebAudio);
}

function playPackOpenWebAudio() {
  return playWebAudioEvent("pack-open", (context) => {
    noiseBurst(context, 0, 0.26, 0.095);
    tone(context, { start: 0, duration: 0.26, frequency: 154, endFrequency: 64, gain: 0.085, type: "sawtooth" });
    tone(context, { start: 0.19, duration: 0.08, frequency: 680, endFrequency: 420, gain: 0.07, type: "square" });
  });
}

function playPackRevealWebAudio() {
  return playWebAudioEvent("card-deal", (context) => {
    [0, 0.08, 0.16].forEach((start, index) => {
      tone(context, { start, duration: 0.13, frequency: 560 + index * 180, endFrequency: 820 + index * 160, gain: 0.05, type: "triangle" });
    });
  });
}

function playCardDealWebAudio(index: number, total: number) {
  const normalizedIndex = Math.max(0, Math.min(total - 1, index));
  return playWebAudioEvent("card-deal", (context) => {
    const lift = normalizedIndex / Math.max(1, total - 1);
    tone(context, {
      start: 0,
      duration: 0.075,
      frequency: 520 + lift * 170,
      endFrequency: 370 + lift * 110,
      gain: 0.07,
      type: "triangle",
    });
    tone(context, {
      start: 0.025,
      duration: 0.06,
      frequency: 900 + lift * 240,
      endFrequency: 660 + lift * 120,
      gain: 0.035,
      type: "sine",
    });
  });
}

function playSkillRodSelectWebAudio() {
  return playWebAudioEvent("skill-rod-select", (context) => {
    tone(context, { start: 0, duration: 0.1, frequency: 1040, endFrequency: 780, gain: 0.08, type: "triangle" });
    tone(context, { start: 0.045, duration: 0.16, frequency: 1480, endFrequency: 1180, gain: 0.045, type: "sine" });
  });
}

function playAssemblyWebAudio() {
  return playWebAudioEvent("assembly", (context) => {
    noiseBurst(context, 0, 0.36, 0.08);
    tone(context, { start: 0, duration: 0.36, frequency: 190, endFrequency: 72, gain: 0.07, type: "sawtooth" });
    tone(context, { start: 0.32, duration: 0.07, frequency: 116, endFrequency: 78, gain: 0.16, type: "square" });
    tone(context, { start: 0.38, duration: 0.09, frequency: 840, endFrequency: 1040, gain: 0.055, type: "triangle" });
  });
}

function playFinalSnapWebAudio() {
  return playWebAudioEvent("final-snap", (context) => {
    tone(context, { start: 0, duration: 0.12, frequency: 132, endFrequency: 78, gain: 0.2, type: "square" });
    tone(context, { start: 0.015, duration: 0.06, frequency: 980, endFrequency: 720, gain: 0.07, type: "triangle" });
    noiseBurst(context, 0.02, 0.11, 0.07);
  });
}

export function playSynthesizedActivationEffect() {
  playWebAudioEvent("final-snap", (context) => {
    noiseBurst(context, 0, 0.16, 0.12);
    [0.08, 0.2, 0.32, 0.44].forEach((start, index) => {
      tone(context, {
        start,
        duration: 0.09,
        frequency: 520 + index * 150,
        endFrequency: 680 + index * 180,
        gain: 0.065,
        type: "square",
      });
    });
    tone(context, { start: 0.08, duration: 0.76, frequency: 92, endFrequency: 980, gain: 0.1, type: "sawtooth" });
    tone(context, { start: 0.7, duration: 0.62, frequency: 72, endFrequency: 34, gain: 0.21, type: "sine" });
    tone(context, { start: 0.78, duration: 0.5, frequency: 220, gain: 0.075, type: "sawtooth" });
    tone(context, { start: 0.78, duration: 0.5, frequency: 330, gain: 0.055, type: "triangle" });
    tone(context, { start: 0.78, duration: 0.5, frequency: 440, gain: 0.04, type: "triangle" });
    noiseBurst(context, 0.74, 0.34, 0.07);
  });
}

function stopActiveClip(reason: "replaced" | "stopped" = "stopped") {
  if (!activeLocalClip) return;
  activeClipSettled = true;
  try {
    activeLocalClip.pause();
    activeLocalClip.currentTime = 0;
  } catch (error) {
    reportAudio({ event: "persona-voice", status: "failed", reason: audioErrorReason("clip-stop-threw", error) });
  }
  activeLocalClip = null;
  reportAudio({ event: "persona-voice", status: reason === "stopped" ? "stopped" : "interrupted", reason });
}

function playAudioClip(
  url: string,
  event: DriverAudioEvent,
  onComplete: () => void,
  onFailure: () => void,
) {
  stopActiveClip("replaced");
  let clip: HTMLAudioElement;
  try {
    clip = new Audio(url);
  } catch (error) {
    const reason = audioErrorReason("audio-constructor-threw", error);
    reportAudio({ event, status: "failed", reason, resourceUrl: url });
    reportAudio({ event, status: "fallback", reason, resourceUrl: url });
    safeAudioFallback(event, reason, onFailure);
    return false;
  }
  activeClipSettled = false;
  let startTimer: number | null = null;
  const finish = (callback: () => void) => {
    if (activeClipSettled) return;
    activeClipSettled = true;
    if (startTimer !== null && typeof window !== "undefined") window.clearTimeout(startTimer);
    if (activeLocalClip === clip) activeLocalClip = null;
    safeAudioFallback(event, "audio-callback", callback);
  };
  const fail = (reason: string) => {
    if (activeClipSettled) return;
    reportAudio({ event, status: "failed", reason, resourceUrl: url });
    finish(() => {
      reportAudio({ event, status: "fallback", reason, resourceUrl: url });
      onFailure();
    });
  };
  try {
    clip.preload = "auto";
    clip.volume = 0.92;
    activeLocalClip = clip;
    clip.addEventListener("ended", () => {
      if (activeClipSettled) return;
      reportAudio({ event, status: "completed", resourceUrl: url });
      finish(onComplete);
    });
    clip.addEventListener("error", () => fail("resource-error"));
    clip.addEventListener("abort", () => fail("playback-aborted"));
    clip.addEventListener("stalled", () => fail("playback-stalled"));
    if (typeof window !== "undefined") {
      startTimer = window.setTimeout(() => fail("start-timeout"), LOCAL_CLIP_START_TIMEOUT_MS);
    }
    const playResult = clip.play();
    void Promise.resolve(playResult).catch(() => {
      fail("autoplay-rejected");
    }).then(() => {
      if (startTimer !== null && typeof window !== "undefined") window.clearTimeout(startTimer);
      if (!activeClipSettled) reportAudio({ event, status: "started", resourceUrl: url });
    });
    return true;
  } catch (error) {
    fail(audioErrorReason("audio-setup-threw", error));
    return false;
  }
}

function createRequiredAnnouncerFallback() {
  return new Audio(REQUIRED_ANNOUNCER_URL);
}

function safeAudioAction(
  event: DriverAudioEvent,
  action: () => boolean | void,
  fallback?: () => boolean | void,
) {
  try {
    return action() !== false;
  } catch (error) {
    const reason = audioErrorReason("audio-action-threw", error);
    reportAudio({ event, status: "failed", reason });
    if (!fallback) return false;
    reportAudio({ event, status: "fallback", reason });
    return safeAudioFallback(event, reason, fallback);
  }
}

function clearDealBeatQueue() {
  dealBeatQueue.length = 0;
  dealBeatActive = false;
}

function processDealBeatQueue() {
  if (dealBeatActive || dealBeatQueue.length === 0) return;
  const request = dealBeatQueue.shift();
  if (!request) return;
  dealBeatActive = true;
  const finish = () => {
    dealBeatActive = false;
    processDealBeatQueue();
  };
  const fallback = () => {
    playCardDealWebAudio(request.index, request.total);
    if (typeof window !== "undefined") window.setTimeout(finish, 120);
    else finish();
  };
  try {
    if (!request.url) {
      fallback();
      return;
    }
    playAudioClip(request.url, "card-deal", finish, fallback);
  } catch (error) {
    reportAudio({ event: "card-deal", status: "failed", reason: audioErrorReason("deal-queue-threw", error) });
    safeAudioFallback("card-deal", "deal-queue-threw", fallback);
  }
}

function playLocalCandidateEvent(
  event: Exclude<DriverAudioEvent, "card-select" | "persona-voice">,
  fallback: () => boolean,
) {
  try {
    if (getDriverAudioBundleMode() !== "local-test") return safeAudioFallback(event, "public-cleared-mode", fallback);
    // Arm the Web Audio fallback during the same user gesture that starts the
    // local clip, so a later 404 or stalled resource can still fall back.
    getAudioContext();
    void refreshLocalTestManifest().catch((error: unknown) => {
      reportAudio({ event, status: "failed", reason: audioErrorReason("manifest-refresh-rejected", error) });
    });
    const candidate = chooseNextDecadeCandidate(event);
    if (!candidate) {
      reportAudio({ event, status: "failed", reason: "local-candidate-unavailable" });
      reportAudio({ event, status: "fallback", reason: "local-candidate-unavailable" });
      return safeAudioFallback(event, "local-candidate-unavailable", fallback);
    }
    return playAudioClip(candidate.url, event, () => undefined, () => {
      safeAudioFallback(event, "local-candidate-playback", fallback);
    });
  } catch (error) {
    const reason = audioErrorReason("local-candidate-selection-threw", error);
    reportAudio({ event, status: "failed", reason });
    reportAudio({ event, status: "fallback", reason });
    return safeAudioFallback(event, reason, fallback);
  }
}

export function playPackOpenSound() {
  return safeAudioAction("pack-open", playStarterPackOpenSound, playPackOpenWebAudio);
}

export function playStarterPackOpenSound() {
  return safeAudioAction("pack-open", () => {
    clearDealBeatQueue();
    return playLocalCandidateEvent("pack-open", playPackOpenWebAudio);
  }, playPackOpenWebAudio);
}

export function playPackRevealSound() {
  return safeAudioAction("card-deal", () => playLocalCandidateEvent("card-deal", playPackRevealWebAudio), playPackRevealWebAudio);
}

export function playCardDealBeat(index: number, total: number) {
  return safeAudioAction("card-deal", () => {
    const normalizedTotal = Number.isFinite(total) ? Math.max(1, Math.floor(total)) : 1;
    const normalizedIndex = Number.isFinite(index)
      ? Math.max(0, Math.min(normalizedTotal - 1, Math.floor(index)))
      : 0;
    if (getDriverAudioBundleMode() === "local-test") {
      void refreshLocalTestManifest().catch((error: unknown) => {
        reportAudio({ event: "card-deal", status: "failed", reason: audioErrorReason("manifest-refresh-rejected", error) });
      });
      getAudioContext();
    }
    const candidate = getDriverAudioBundleMode() === "local-test"
      ? chooseNextDecadeCandidate("card-deal")
      : null;
    dealBeatQueue.push({ index: normalizedIndex, total: normalizedTotal, url: candidate?.url });
    processDealBeatQueue();
    return true;
  }, () => playCardDealWebAudio(0, 1));
}

export function playSkillRodSelectSound() {
  return safeAudioAction("skill-rod-select", () => playLocalCandidateEvent("skill-rod-select", playSkillRodSelectWebAudio), playSkillRodSelectWebAudio);
}

export function playAssemblySound() {
  return safeAudioAction("assembly", () => playLocalCandidateEvent("assembly", playAssemblyWebAudio), playAssemblyWebAudio);
}

export function playFinalSnapSound() {
  return safeAudioAction("final-snap", () => playLocalCandidateEvent("final-snap", playFinalSnapWebAudio), playFinalSnapWebAudio);
}

export function playRandomPersonaVoice(
  onComplete: () => void = () => undefined,
  onFailure: () => void = () => undefined,
) {
  return safeAudioAction("persona-voice", () => {
    const publicResource = PUBLIC_CLEARED_VOICE_RESOURCES[0];
    if (!publicResource) {
      try {
        createRequiredAnnouncerFallback().load();
      } catch (error) {
        reportAudio({ event: "persona-voice", status: "failed", reason: audioErrorReason("required-announcer-threw", error) });
      }
      safeAudioFallback("persona-voice", "public-resource-unavailable", onFailure);
      return false;
    }
    return playAudioClip(publicResource.url, "persona-voice", onComplete, onFailure);
  }, onFailure);
}

export function stopPackEntrancePreset() {
  stopActiveClip();
}

export function playPackEntrancePreset(personaId: string) {
  void personaId;
  playPackRevealSound();
  return true;
}

function speakActivationLabel(personaName: string, commandCode: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${personaName}. ${commandCode}.`);
    utterance.lang = "en-US";
    utterance.rate = 0.76;
    utterance.pitch = 0.62;
    utterance.volume = 0.96;
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    reportAudio({ event: "persona-voice", status: "failed", reason: audioErrorReason("tts-threw", error) });
  }
}

export function getDriverAudioStatus() {
  const manifest = getAudioResourceManifest(getDriverAudioBundleMode());
  if (typeof window === "undefined") {
    return {
      browserAudio: false,
      requiredAnnouncer: REQUIRED_ANNOUNCER_URL,
      bundleMode: manifest.mode,
      localTestCount: manifest.localTest.decadeCandidates.length + manifest.localTest.announcers.length,
      publicClearedCount: manifest.publicCleared.length,
      localTestManifest: getLocalTestManifestStatus(),
      lastDiagnostic,
    };
  }
  const browserAudio = Boolean(
    window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext,
  );
  return {
    browserAudio,
    requiredAnnouncer: REQUIRED_ANNOUNCER_URL,
    bundleMode: manifest.mode,
    localTestCount: manifest.localTest.decadeCandidates.length + manifest.localTest.announcers.length,
    publicClearedCount: manifest.publicCleared.length,
    localTestManifest: getLocalTestManifestStatus(),
    lastDiagnostic,
  };
}

export async function checkDriverAudioOutput() {
  const context = getAudioContext();
  if (!context) {
    reportAudio({ event: "audio-context", status: "failed", reason: "audio-context-unavailable" });
    return false;
  }
  try {
    await context.resume();
    tone(context, { start: 0, duration: 0.07, frequency: 720, endFrequency: 980, gain: 0.045, type: "triangle" });
    const running = context.state === "running";
    reportAudio({ event: "audio-context", status: running ? "started" : "failed", reason: running ? undefined : "context-not-running" });
    return running;
  } catch {
    reportAudio({ event: "audio-context", status: "failed", reason: "resume-rejected" });
    return false;
  }
}

function playActivationSequenceUnsafe(
  personaId: string,
  personaName: string,
  commandId: string,
  commandCode: string,
) {
  void personaId;
  void commandId;
  // The final snap is a distinct event. The voice clip is a separate resource
  // event; TTS is only a recovery path for asset failure.
  playFinalSnapSound();
  let fallbackUsed = false;
  const fallback = () => {
    if (fallbackUsed) return;
    fallbackUsed = true;
    speakActivationLabel(personaName, commandCode);
  };
  if (getDriverAudioBundleMode() === "local-test") {
    const personaResource = getLocalPersonaAnnouncer(personaId);
    const commandResource = getLocalCommandAnnouncer(commandId);
    if (!personaResource || !commandResource) {
      reportAudio({
        event: "persona-voice",
        status: "failed",
        reason: !personaResource ? `missing-persona-announcer:${personaId}` : `missing-command-announcer:${commandId}`,
      });
      reportAudio({ event: "persona-voice", status: "fallback", reason: "announcer-mapping-incomplete" });
      fallback();
      return;
    }
    playAudioClip(personaResource.url, "persona-voice", () => {
      playAudioClip(commandResource.url, "persona-voice", () => speakActivationLabel(personaName, commandCode), fallback);
    }, fallback);
    return;
  }
  const publicResource = PUBLIC_CLEARED_VOICE_RESOURCES[0];
  if (!publicResource) {
    fallback();
    return;
  }
  playAudioClip(publicResource.url, "persona-voice", () => speakActivationLabel(personaName, commandCode), fallback);
}

export function playActivationSequence(
  personaId: string,
  personaName: string,
  commandId: string,
  commandCode: string,
) {
  return safeAudioAction("persona-voice", () => {
    playActivationSequenceUnsafe(personaId, personaName, commandId, commandCode);
    return true;
  }, () => speakActivationLabel(personaName, commandCode));
}

export function stopDriverAudio() {
  clearDealBeatQueue();
  stopActiveClip();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
