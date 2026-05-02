import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const child = spawn(process.execPath, ["services/portal/src/app/portal-runtime.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: "0",
    PORTAL_STORAGE_MODE: "json",
    PORTAL_RUNTIME_ROOT: ".runtime/portal-entrypoint-smoke",
    PORTAL_PUBLIC_URL: "http://127.0.0.1",
    PORTAL_ADMIN_PASSWORD: "entrypoint-smoke-password",
    JWT_REFRESH_SECRET: "entrypoint-smoke-refresh-secret",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
let settled = false;

function finish(error = null) {
  if (settled) return;
  settled = true;
  child.kill("SIGTERM");
  if (error) {
    console.error(JSON.stringify({ stdout, stderr }, null, 2));
    throw error;
  }
  console.log(JSON.stringify({
    ok: true,
    contract: "portal_runtime_entrypoint",
  }, null, 2));
}

child.stdout.on("data", (chunk) => {
  stdout += String(chunk);
  if (/portal listening on :0/.test(stdout)) {
    finish();
  }
});

child.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

child.on("exit", (code, signal) => {
  if (settled) return;
  assert.fail(`portal_runtime_exited_before_listen:${code}:${signal}:${stderr}`);
});

setTimeout(() => {
  finish(new Error(`portal_runtime_listen_timeout:${stderr}`));
}, 8_000).unref();
