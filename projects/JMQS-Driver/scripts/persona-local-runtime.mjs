import { appendFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN_ROOT = path.resolve(process.env.PERSONA_NAVI_RUN_ROOT || path.join(PROJECT_DIR, ".persona-runs"));
const LOG_FILE = path.join(RUN_ROOT, "bridge-events.ndjson");
const BRIDGE_PORT = Number(process.env.PERSONA_NAVI_BRIDGE_PORT || 8766);
const WEB_PORT = Number(process.env.PORT || 3000);
const MAX_RESTARTS = 3;

async function logEvent(event, extra = {}) {
  await mkdir(RUN_ROOT, { recursive: true });
  await appendFile(LOG_FILE, `${JSON.stringify({ ts: new Date().toISOString(), pid: process.pid, event, ...extra })}\n`);
}

function probe(port, host = "127.0.0.1", timeout = 300) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const finish = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(timeout, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function spawnChild(label, command, args) {
  const child = spawn(command, args, { cwd: PROJECT_DIR, env: process.env, stdio: ["inherit", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

const children = new Map();
let bridgeRestarts = 0;
let shuttingDown = false;

async function ensureBridge() {
  if (await probe(BRIDGE_PORT)) {
    await logEvent("startup", { code: "BRIDGE_ALREADY_LISTENING", port: BRIDGE_PORT });
    return;
  }
  const child = spawnChild("bridge", process.execPath, ["scripts/persona-navi-bridge.mjs"]);
  children.set("bridge", child);
  await logEvent("startup", { code: "BRIDGE_START", childPid: child.pid, port: BRIDGE_PORT });
  child.once("exit", async (code, signal) => {
    children.delete("bridge");
    await logEvent(shuttingDown ? "shutdown" : "restart", { code: "BRIDGE_EXIT", childPid: child.pid, exitCode: code, signal });
    if (!shuttingDown && bridgeRestarts < MAX_RESTARTS) {
      const delay = 250 * (2 ** bridgeRestarts);
      bridgeRestarts += 1;
      setTimeout(() => void ensureBridge(), delay);
    }
  });
}

async function ensureWeb() {
  if (await probe(WEB_PORT)) {
    await logEvent("startup", { code: "WEB_ALREADY_LISTENING", port: WEB_PORT });
    return;
  }
  const child = spawnChild("web", "pnpm", ["dev"]);
  children.set("web", child);
  await logEvent("startup", { code: "WEB_START", childPid: child.pid, port: WEB_PORT });
  child.once("exit", async (code, signal) => {
    children.delete("web");
    await logEvent("shutdown", { code: "WEB_EXIT", childPid: child.pid, exitCode: code, signal });
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  await logEvent("shutdown", { code: "SUPERVISOR_STOP", signal });
  for (const child of children.values()) child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 300);
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void shutdown(signal));

await logEvent("startup", { code: "SUPERVISOR_START", webPort: WEB_PORT, bridgePort: BRIDGE_PORT });
await Promise.all([ensureBridge(), ensureWeb()]);
process.stdout.write(`Persona local runtime: web :${WEB_PORT}, bridge :${BRIDGE_PORT}\n`);
