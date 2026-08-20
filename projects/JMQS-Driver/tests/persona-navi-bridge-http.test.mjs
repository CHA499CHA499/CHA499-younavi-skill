import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);

async function startBridge(portOffset = 0) {
  const root = await mkdtemp(path.join(os.tmpdir(), "persona-bridge-http-"));
  const port = 18000 + (process.pid % 100) + portOffset;
  const child = spawn(process.execPath, ["scripts/persona-navi-bridge.mjs"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PERSONA_NAVI_BRIDGE_PORT: String(port),
      PERSONA_NAVI_RUN_ROOT: path.join(root, "runs"),
      PERSONA_NAVI_SKILLS_DIR: path.join(root, "skills"),
      PERSONA_NAVI_MATERIAL_ROOT: path.join(root, "materials"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const result = await Promise.race([
      once(child.stdout, "data").then(([chunk]) => ({ chunk: String(chunk) })),
      new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), remaining)),
    ]);
    if (result.timeout) break;
    output += result.chunk;
    if (output.includes("Persona Navi Bridge:")) return { child, root, port };
  }
  child.kill("SIGTERM");
  throw new Error(`Bridge did not start: ${output}`);
}

async function stopBridge(runtime) {
  runtime.child.kill("SIGTERM");
  await Promise.race([once(runtime.child, "exit"), new Promise((resolve) => setTimeout(resolve, 1000))]);
  await rm(runtime.root, { recursive: true, force: true });
}

function headers(origin, fetchSite, host) {
  return { Origin: origin, "Sec-Fetch-Site": fetchSite, Host: host };
}

test("allows only the explicit loopback alias pair for cross-site browser metadata", async (t) => {
  let runtime;
  try { runtime = await startBridge(0); } catch (error) { if (/Bridge did not start|EPERM|EACCES/.test(String(error))) return t.skip("local port binding unavailable in this sandbox"); throw error; }
  try {
    const url = `http://127.0.0.1:${runtime.port}/health`;
    const localhostAlias = await fetch(url, { headers: headers("http://localhost:3000", "cross-site", `127.0.0.1:${runtime.port}`) });
    assert.equal(localhostAlias.status, 200);
    assert.equal(localhostAlias.headers.get("cross-origin-resource-policy"), "cross-origin");

    const ipAlias = await fetch(url, { headers: headers("http://127.0.0.1:3000", "cross-site", `localhost:${runtime.port}`) });
    assert.equal(ipAlias.status, 200);

    const evil = await fetch(url, { headers: headers("https://evil.example", "cross-site", `127.0.0.1:${runtime.port}`) });
    assert.equal(evil.status, 403);
    assert.equal((await evil.json()).code, "INVALID_REQUEST_ORIGIN");

    const nonLoopbackHost = await fetch(url, { headers: headers("http://localhost:3000", "cross-site", `example.com:${runtime.port}`) });
    assert.equal(nonLoopbackHost.status, 403);
    assert.equal((await nonLoopbackHost.json()).code, "INVALID_LOCAL_HOST");
  } finally {
    await stopBridge(runtime);
  }
});

test("keeps the token gate on write routes even for loopback aliases", async (t) => {
  let runtime;
  try { runtime = await startBridge(100); } catch (error) { if (/Bridge did not start|EPERM|EACCES/.test(String(error))) return t.skip("local port binding unavailable in this sandbox"); throw error; }
  try {
    const response = await fetch(`http://127.0.0.1:${runtime.port}/runs`, {
      method: "POST",
      headers: {
        ...headers("http://localhost:3000", "cross-site", `127.0.0.1:${runtime.port}`),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "INVALID_REQUEST_TOKEN");

    const soulResponse = await fetch(`http://127.0.0.1:${runtime.port}/soul-runs`, {
      method: "POST",
      headers: {
        ...headers("http://localhost:3000", "cross-site", `127.0.0.1:${runtime.port}`),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(soulResponse.status, 403);
    assert.equal((await soulResponse.json()).code, "INVALID_REQUEST_TOKEN");
  } finally {
    await stopBridge(runtime);
  }
});
