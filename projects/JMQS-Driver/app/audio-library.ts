export type AudioBundleMode = "local-test" | "public-cleared";

export type DriverAudioEvent =
  | "card-select"
  | "pack-open"
  | "pack-reveal"
  | "card-deal"
  | "skill-rod-select"
  | "assembly"
  | "final-snap"
  | "persona-voice";

export type DriverAudioResource = {
  id: string;
  url: string;
  format: "m4a";
  layer: AudioBundleMode;
  sameOrigin: true;
  source: "user-provided-local-test" | "site-cleared";
};

export type DecadeCandidateResource = DriverAudioResource & {
  event: Exclude<DriverAudioEvent, "card-select" | "persona-voice">;
  sourceCandidate: number;
};

export type AnnouncerResource = DriverAudioResource & {
  kind: "persona" | "command";
  personaId?: string;
  commandId?: "action" | "decision" | "explain" | "review";
};

export type LocalTestAudioManifest = {
  version: number;
  layer: "local-test";
  decadeCandidates?: Array<Partial<DecadeCandidateResource> & Pick<DecadeCandidateResource, "id" | "url" | "event" | "sourceCandidate">>;
  announcers?: Array<Partial<AnnouncerResource> & Pick<AnnouncerResource, "id" | "url" | "kind">>;
};

export type LocalTestManifestStatus = {
  url: string;
  state: "seed" | "loading" | "loaded" | "failed";
  candidateCount: number;
  announcerCount: number;
  error?: string;
};

const LOCAL_TEST_AUDIO_ROOT = "/audio/local-test";
export const LOCAL_TEST_MANIFEST_URL = `${LOCAL_TEST_AUDIO_ROOT}/manifest.json`;

const LOCAL_TEST_CANDIDATE_EVENT_ORDER: Array<DecadeCandidateResource["event"]> = [
  "pack-open",
  "pack-open",
  "pack-open",
  "card-deal",
  "card-deal",
  "card-deal",
  "card-deal",
  "skill-rod-select",
  "skill-rod-select",
  "skill-rod-select",
  "assembly",
  "assembly",
  "assembly",
  "assembly",
  "final-snap",
  "final-snap",
];

export const LOCAL_TEST_DECADE_CANDIDATES: readonly DecadeCandidateResource[] =
  LOCAL_TEST_CANDIDATE_EVENT_ORDER.map((event, index) => {
    const candidateNumber = index + 1;
    const padded = String(candidateNumber).padStart(2, "0");
    return {
      id: `decade-candidate-${padded}`,
      url: `${LOCAL_TEST_AUDIO_ROOT}/decade/candidate-${padded}.m4a`,
      format: "m4a",
      layer: "local-test",
      sameOrigin: true,
      source: "user-provided-local-test",
      event,
      sourceCandidate: candidateNumber,
    };
  });

const localPersonaAnnouncer = (personaId: string, fileName: string): AnnouncerResource => ({
  id: `announcer-persona-${personaId}`,
  url: `${LOCAL_TEST_AUDIO_ROOT}/announcer/${fileName}`,
  format: "m4a",
  layer: "local-test",
  sameOrigin: true,
  source: "user-provided-local-test",
  kind: "persona",
  personaId,
});

const localCommandAnnouncer = (commandId: AnnouncerResource["commandId"], fileName: string): AnnouncerResource => ({
  id: `announcer-command-${commandId}`,
  url: `${LOCAL_TEST_AUDIO_ROOT}/announcer/${fileName}`,
  format: "m4a",
  layer: "local-test",
  sameOrigin: true,
  source: "user-provided-local-test",
  kind: "command",
  commandId,
});

export const LOCAL_TEST_ANNOUNCERS: readonly AnnouncerResource[] = [
  localPersonaAnnouncer("naval", "persona-naval-ravikant.m4a"),
  localPersonaAnnouncer("elon-musk", "persona-elon-musk.m4a"),
  localPersonaAnnouncer("steve-jobs", "persona-steve-jobs.m4a"),
  localPersonaAnnouncer("donald-trump", "persona-donald-john-trump.m4a"),
  localPersonaAnnouncer("paul-graham", "persona-paul-graham.m4a"),
  localCommandAnnouncer("action", "command-action.m4a"),
  localCommandAnnouncer("decision", "command-decide.m4a"),
  localCommandAnnouncer("explain", "command-explain.m4a"),
  localCommandAnnouncer("review", "command-review.m4a"),
];

export const PUBLIC_CLEARED_VOICE_RESOURCES: readonly DriverAudioResource[] = [
  {
    id: "persona-driver-announcer-v2-expressive",
    url: "/audio/persona-driver-announcer-v2-expressive.m4a",
    format: "m4a",
    layer: "public-cleared",
    sameOrigin: true,
    source: "site-cleared",
  },
];

export const LOCAL_TEST_SOURCE_RESOURCE: DriverAudioResource = {
  id: "decade-source-p1-heisei",
  url: `${LOCAL_TEST_AUDIO_ROOT}/decade/decade-source-p1-heisei.m4a`,
  format: "m4a",
  layer: "local-test",
  sameOrigin: true,
  source: "user-provided-local-test",
};

let localTestDecadeCandidates: DecadeCandidateResource[] = [...LOCAL_TEST_DECADE_CANDIDATES];
let localTestAnnouncers: AnnouncerResource[] = [...LOCAL_TEST_ANNOUNCERS];
let localTestManifestState: LocalTestManifestStatus = {
  url: LOCAL_TEST_MANIFEST_URL,
  state: "seed",
  candidateCount: localTestDecadeCandidates.length,
  announcerCount: localTestAnnouncers.length,
};
let localTestManifestPromise: Promise<void> | null = null;

export const DRIVER_AUDIO_EVENT_MAP: Readonly<Record<DriverAudioEvent, {
  kind: "web-audio" | "decade-candidate" | "announcer";
  fallback: "web-audio" | "tts" | "none";
}>> = {
  "card-select": { kind: "web-audio", fallback: "none" },
  "pack-open": { kind: "decade-candidate", fallback: "web-audio" },
  "pack-reveal": { kind: "decade-candidate", fallback: "web-audio" },
  "card-deal": { kind: "decade-candidate", fallback: "web-audio" },
  "skill-rod-select": { kind: "decade-candidate", fallback: "web-audio" },
  assembly: { kind: "decade-candidate", fallback: "web-audio" },
  "final-snap": { kind: "decade-candidate", fallback: "web-audio" },
  "persona-voice": { kind: "announcer", fallback: "tts" },
};

function readConfiguredBundleMode(): AudioBundleMode | null {
  if (typeof process !== "undefined") {
    const configured = process.env.NEXT_PUBLIC_PERSONA_DRIVER_AUDIO_MODE;
    if (configured === "local-test" || configured === "public-cleared") return configured;
  }
  return null;
}

export function getDriverAudioBundleMode(): AudioBundleMode {
  const configured = readConfiguredBundleMode();
  if (configured) return configured;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
    return "local-test";
  }
  return "public-cleared";
}

function isDecadeCandidateEvent(value: unknown): value is DecadeCandidateResource["event"] {
  return value === "pack-open"
    || value === "pack-reveal"
    || value === "card-deal"
    || value === "skill-rod-select"
    || value === "assembly"
    || value === "final-snap";
}

function normalizeDecadeCandidateEvent(event: DecadeCandidateResource["event"]) {
  return event === "pack-reveal" ? "card-deal" : event;
}

function mergeById<T extends { id: string }>(base: T[], additions: T[]) {
  const merged = new Map(base.map((item) => [item.id, item]));
  additions.forEach((item) => merged.set(item.id, item));
  return [...merged.values()];
}

function parseManifestCandidates(manifest: LocalTestAudioManifest) {
  const entries = Array.isArray(manifest.decadeCandidates) ? manifest.decadeCandidates : [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    if (typeof entry.id !== "string" || entry.id.length === 0) return [];
    if (typeof entry.url !== "string" || !entry.url.startsWith(`${LOCAL_TEST_AUDIO_ROOT}/`) || !entry.url.endsWith(".m4a")) return [];
    const sourceCandidate = entry.sourceCandidate;
    if (!isDecadeCandidateEvent(entry.event) || typeof sourceCandidate !== "number" || !Number.isSafeInteger(sourceCandidate) || sourceCandidate <= 0) return [];
    return [{
      id: entry.id,
      url: entry.url,
      format: "m4a" as const,
      layer: "local-test" as const,
      sameOrigin: true as const,
      source: "user-provided-local-test" as const,
      event: normalizeDecadeCandidateEvent(entry.event),
      sourceCandidate,
    }];
  });
}

function parseManifestAnnouncers(manifest: LocalTestAudioManifest) {
  const entries = Array.isArray(manifest.announcers) ? manifest.announcers : [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    if (typeof entry.id !== "string" || entry.id.length === 0) return [];
    if (typeof entry.url !== "string" || !entry.url.startsWith(`${LOCAL_TEST_AUDIO_ROOT}/`) || !entry.url.endsWith(".m4a")) return [];
    if (entry.kind !== "persona" && entry.kind !== "command") return [];
    if (entry.kind === "persona" && !entry.personaId) return [];
    if (entry.kind === "command" && !entry.commandId) return [];
    return [{
      id: entry.id,
      url: entry.url,
      format: "m4a" as const,
      layer: "local-test" as const,
      sameOrigin: true as const,
      source: "user-provided-local-test" as const,
      kind: entry.kind,
      personaId: entry.personaId,
      commandId: entry.commandId,
    }];
  });
}

export function getLocalTestManifestStatus() {
  return { ...localTestManifestState };
}

export async function refreshLocalTestManifest(force = false) {
  if (getDriverAudioBundleMode() !== "local-test" || typeof fetch === "undefined") return;
  if (localTestManifestPromise && !force) return localTestManifestPromise;
  localTestManifestState = { ...localTestManifestState, state: "loading", error: undefined };
  localTestManifestPromise = (async () => {
    const response = await fetch(LOCAL_TEST_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`manifest-http-${response.status}`);
    const manifest = await response.json() as LocalTestAudioManifest;
    if (manifest.layer !== "local-test" || typeof manifest.version !== "number") throw new Error("manifest-invalid-header");
    localTestDecadeCandidates = mergeById(localTestDecadeCandidates, parseManifestCandidates(manifest));
    localTestAnnouncers = mergeById(localTestAnnouncers, parseManifestAnnouncers(manifest));
    localTestManifestState = {
      url: LOCAL_TEST_MANIFEST_URL,
      state: "loaded",
      candidateCount: localTestDecadeCandidates.length,
      announcerCount: localTestAnnouncers.length,
    };
    resetDecadeCandidateRotation();
  })().catch((error: unknown) => {
    localTestManifestState = {
      ...localTestManifestState,
      state: "failed",
      error: error instanceof Error ? error.message : "manifest-load-failed",
    };
  });
  return localTestManifestPromise;
}

const remainingCandidatesByEvent = new Map<DecadeCandidateResource["event"], DecadeCandidateResource[]>();
const lastCandidateByEvent = new Map<DecadeCandidateResource["event"], string>();

function safeRandomValue(random: () => number) {
  let value = 0;
  try {
    value = random();
  } catch {
    return 0;
  }
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1 - Number.EPSILON;
  return value;
}

export function selectFromShuffleBag<T extends { id: string }>(
  candidates: readonly T[],
  stored: readonly T[] | null | undefined,
  lastId: string | null | undefined,
  random: () => number = Math.random,
) {
  const validCandidates = candidates.filter((candidate): candidate is T => (
    Boolean(candidate) && typeof candidate.id === "string" && candidate.id.length > 0
  ));
  if (validCandidates.length === 0) return { candidate: null, remaining: [] as T[], lastId: lastId ?? null };

  const validIds = new Set(validCandidates.map((candidate) => candidate.id));
  const validStored = Array.isArray(stored)
    ? stored.filter((candidate): candidate is T => Boolean(candidate) && validIds.has(candidate.id))
    : [];
  const remaining = validStored.length > 0 ? [...validStored] : [...validCandidates];
  const eligible = remaining.length > 1
    ? remaining.filter((candidate) => candidate.id !== lastId)
    : remaining;
  const pool = eligible.length > 0 ? eligible : remaining;
  if (pool.length === 0) return { candidate: null, remaining: [] as T[], lastId: lastId ?? null };

  const index = Math.floor(safeRandomValue(random) * pool.length);
  const candidate = pool[index];
  if (!candidate) return { candidate: null, remaining: [] as T[], lastId: lastId ?? null };
  return {
    candidate,
    remaining: remaining.filter((item) => item.id !== candidate.id),
    lastId: candidate.id,
  };
}

export function chooseNextDecadeCandidate(
  event: DecadeCandidateResource["event"],
  random = Math.random,
  mode = getDriverAudioBundleMode(),
) {
  if (mode !== "local-test") return null;
  const candidates = localTestDecadeCandidates.filter((candidate) => candidate.event === event);
  const selection = selectFromShuffleBag(
    candidates,
    remainingCandidatesByEvent.get(event),
    lastCandidateByEvent.get(event),
    random,
  );
  if (!selection.candidate) {
    remainingCandidatesByEvent.delete(event);
    return null;
  }
  remainingCandidatesByEvent.set(event, selection.remaining);
  lastCandidateByEvent.set(event, selection.lastId);
  return selection.candidate;
}

export function resetDecadeCandidateRotation() {
  remainingCandidatesByEvent.clear();
  lastCandidateByEvent.clear();
}

export function getLocalPersonaAnnouncer(personaId: string) {
  return localTestAnnouncers.find((resource) => resource.kind === "persona" && resource.personaId === personaId) ?? null;
}

export function getLocalCommandAnnouncer(commandId: string) {
  const normalized = commandId === "decide" ? "decision" : commandId;
  return localTestAnnouncers.find((resource) => resource.kind === "command" && resource.commandId === normalized) ?? null;
}

export function getDriverAudioResourceManifest(mode: AudioBundleMode = getDriverAudioBundleMode()) {
  return {
    mode,
    publicCleared: [...PUBLIC_CLEARED_VOICE_RESOURCES],
    localTest: {
      source: { ...LOCAL_TEST_SOURCE_RESOURCE },
      manifest: getLocalTestManifestStatus(),
      decadeCandidates: [...localTestDecadeCandidates],
      announcers: [...localTestAnnouncers],
    },
  };
}

if (typeof window !== "undefined") void refreshLocalTestManifest();
