import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PersonaNaviError,
  createPersonaRunService,
  inspectInstalledSkills,
  inspectSourceMaterials,
  openYouNavi,
  resolveAgentCli,
  MAX_REQUEST_BODY_BYTES,
} from "./persona-navi-bridge-lib.mjs";
import {
  createPersonaSoulRunService,
  inspectCreateSoulSkill,
} from "./persona-soul-bridge-lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");
const PORT = Number.parseInt(process.env.PERSONA_NAVI_BRIDGE_PORT || "8766", 10);
const HOST = "127.0.0.1";
const RUN_ROOT = path.resolve(process.env.PERSONA_NAVI_RUN_ROOT || path.join(PROJECT_DIR, ".persona-runs"));
const SKILLS_DIR = path.resolve(process.env.PERSONA_NAVI_SKILLS_DIR || "/Users/zqnw/navi-ai/CHA499/skills");
const MATERIAL_ROOT = path.resolve(
  process.env.PERSONA_NAVI_MATERIAL_ROOT
    || process.env.PERSONA_NAVI_PRESET_ROOT
    || "/Users/zqnw/navi/CHA499/transcripts/classic-interviews-2026-08-19",
);
const REQUEST_TOKEN = randomBytes(24).toString("base64url");
const TOKEN_HEADER = "x-persona-navi-token";
const EVENT_LOG_FILE = path.join(RUN_ROOT, "bridge-events.ndjson");
const SOUL_RUN_ROOT = path.join(RUN_ROOT, "soul");
const SOUL_WORKSPACE_ROOT = path.resolve(process.env.PERSONA_NAVI_SOUL_WORKSPACE_ROOT || "/Users/zqnw/navi-ai/CHA499");
// A 1 MiB UTF-8 document can expand when JSON escapes quotes/control chars or
// carries multibyte characters. Keep a finite envelope for JSON overhead.
export const REQUEST_BODY_LIMIT_BYTES = MAX_REQUEST_BODY_BYTES;
const ALLOWED_ORIGINS = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
const service = createPersonaRunService({ runRoot: RUN_ROOT, skillsDir: SKILLS_DIR, materialRoot: MATERIAL_ROOT });
const soulService = createPersonaSoulRunService({ runRoot: SOUL_RUN_ROOT, workspaceRoot: SOUL_WORKSPACE_ROOT, skillsDir: SKILLS_DIR, materialRoot: MATERIAL_ROOT });

async function logBridgeEvent(event, extra = {}) {
  try {
    await mkdir(RUN_ROOT, { recursive: true });
    await appendFile(EVENT_LOG_FILE, `${JSON.stringify({ ts: new Date().toISOString(), pid: process.pid, event, ...extra })}\n`);
  } catch { /* Observability must not block the Bridge response. */ }
}

function requestOrigin(req) {
  return String(req.headers.origin || "").trim().toLowerCase();
}

function allowedHost(req) {
  const host = String(req.headers.host || "").trim().toLowerCase();
  return new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`]).has(host);
}

function tokenMatches(actual) {
  const left = Buffer.from(String(actual || ""), "utf8");
  const right = Buffer.from(REQUEST_TOKEN, "utf8");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function assertBrowserRequest(req, { token = true } = {}) {
  if (!allowedHost(req)) throw new PersonaNaviError("请求 Host 不是本机 Bridge", { code: "INVALID_LOCAL_HOST", status: 403 });
  const origin = requestOrigin(req);
  const originAllowed = ALLOWED_ORIGINS.has(origin);
  if (origin && !originAllowed) {
    throw new PersonaNaviError("页面来源不在 Bridge 白名单", { code: "INVALID_REQUEST_ORIGIN", status: 403 });
  }
  const fetchSite = String(req.headers["sec-fetch-site"] || "").trim().toLowerCase();
  const loopbackAliasPair = fetchSite === "cross-site" && originAllowed && allowedHost(req);
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite) && !loopbackAliasPair) {
    throw new PersonaNaviError("拒绝跨站调用本机 Bridge", { code: "CROSS_SITE_REQUEST", status: 403 });
  }
  if (token && !tokenMatches(req.headers[TOKEN_HEADER])) {
    throw new PersonaNaviError("Bridge 会话令牌无效", { code: "INVALID_REQUEST_TOKEN", status: 403 });
  }
}

function corsHeaders(req) {
  const origin = requestOrigin(req);
  return ALLOWED_ORIGINS.has(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": `content-type,${TOKEN_HEADER}`,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        Vary: "Origin",
      }
    : {};
}

function sendJson(req, res, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  res.writeHead(status, {
    ...corsHeaders(req),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    // localhost:3000 ↔ 127.0.0.1:8766 is a deliberate CORS alias pair.
    // Never send cross-origin CORP to an unapproved Origin.
    "Cross-Origin-Resource-Policy": ALLOWED_ORIGINS.has(requestOrigin(req)) ? "cross-origin" : "same-site",
  });
  res.end(body);
}

async function readJsonBody(req, limit = REQUEST_BODY_LIMIT_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new PersonaNaviError("请求体超过 4.125 MiB", { code: "REQUEST_TOO_LARGE", status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PersonaNaviError("请求体不是有效 JSON", { code: "INVALID_JSON" });
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      assertBrowserRequest(req, { token: false });
      res.writeHead(204, corsHeaders(req));
      res.end();
      return;
    }
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    if (url.pathname === "/health" && req.method === "GET") {
      assertBrowserRequest(req, { token: false });
      const [skills, materials, createSoul, cli] = await Promise.all([
        inspectInstalledSkills(SKILLS_DIR),
        inspectSourceMaterials(MATERIAL_ROOT),
        inspectCreateSoulSkill(SKILLS_DIR),
        resolveAgentCli().then(() => true).catch(() => false),
      ]);
      sendJson(req, res, 200, {
        ok: true,
        service: "persona-navi-bridge",
        token: REQUEST_TOKEN,
        cliAvailable: cli,
        skills,
        materials,
        soul: { createSoul },
      });
      return;
    }
    if (url.pathname === "/soul-runs" && req.method === "POST") {
      assertBrowserRequest(req);
      const body = await readJsonBody(req);
      await logBridgeEvent("soul-request-created", { code: "SOUL_RUN_REQUEST", runId: typeof body?.runId === "string" ? body.runId : undefined });
      sendJson(req, res, 200, await soulService.createRun(body));
      return;
    }
    const soulRunMatch = url.pathname.match(/^\/soul-runs\/(psoul-[a-z0-9-]{12,72})$/i);
    if (soulRunMatch && req.method === "GET") {
      assertBrowserRequest(req);
      sendJson(req, res, 200, await soulService.readRun(soulRunMatch[1]));
      return;
    }
    const soulOpenMatch = url.pathname.match(/^\/soul-runs\/(psoul-[a-z0-9-]{12,72})\/open$/i);
    if (soulOpenMatch && req.method === "POST") {
      assertBrowserRequest(req);
      sendJson(req, res, 200, await openYouNavi());
      return;
    }
    if (url.pathname === "/runs" && req.method === "POST") {
      assertBrowserRequest(req);
      const body = await readJsonBody(req);
      await logBridgeEvent("request-created", { code: "RUN_REQUEST", runId: typeof body?.runId === "string" ? body.runId : undefined });
      sendJson(req, res, 200, await service.createRun(body));
      return;
    }
    const runMatch = url.pathname.match(/^\/runs\/(prun-[a-z0-9-]{12,72})$/i);
    if (runMatch && req.method === "GET") {
      assertBrowserRequest(req);
      sendJson(req, res, 200, await service.readRun(runMatch[1]));
      return;
    }
    const openMatch = url.pathname.match(/^\/runs\/(prun-[a-z0-9-]{12,72})\/open$/i);
    if (openMatch && req.method === "POST") {
      assertBrowserRequest(req);
      sendJson(req, res, 200, await openYouNavi());
      return;
    }
    sendJson(req, res, 404, { ok: false, code: "NOT_FOUND", error: "Route not found" });
  } catch (error) {
    const known = error instanceof PersonaNaviError;
    await logBridgeEvent(known && error.status === 403 ? "auth-denied" : "error", { code: known ? error.code : "PERSONA_NAVI_INTERNAL" });
    sendJson(req, res, known ? error.status : 500, {
      ok: false,
      code: known ? error.code : "PERSONA_NAVI_INTERNAL",
      error: String(error?.message || "Persona Navi Bridge 失败").slice(0, 1200),
    });
  }
});

server.listen(PORT, HOST, () => {
  void logBridgeEvent("listening", { code: "BRIDGE_LISTENING", port: PORT });
  process.stdout.write(`Persona Navi Bridge: http://${HOST}:${PORT}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { void logBridgeEvent("shutdown", { code: "BRIDGE_SHUTDOWN", signal }).finally(() => server.close(() => process.exit(0))); });
}
