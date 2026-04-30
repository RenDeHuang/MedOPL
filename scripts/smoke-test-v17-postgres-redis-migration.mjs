import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function redact(value = "") {
  const text = String(value || "");
  if (!text) return "";
  return text.replace(/:\/\/([^:@/]+):([^@/]+)@/g, "://$1:***@");
}

async function runNodeSnippet(env, source) {
  const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const [stdoutChunks, stderrChunks] = [[], []];
  child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
  child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
  const [code] = await once(child, "exit");
  return {
    code,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

async function expectProductionConfigFailure(env, expected) {
  const result = await runNodeSnippet(env, `
    import { validateProductionConfig } from "./services/portal/src/config/portal-config.mjs";
    validateProductionConfig();
  `);
  assert(result.code !== 0, `expected production config to fail for ${expected}`);
  assert(
    `${result.stderr}\n${result.stdout}`.includes(expected),
    `expected error ${expected}, got ${redact(result.stderr || result.stdout)}`,
  );
}

async function connectTencentDbIfRequested() {
  if (String(process.env.RUN_TENCENTDB_SMOKE || "") !== "1") {
    return { skipped: true, reason: "RUN_TENCENTDB_SMOKE not set" };
  }
  const postgresUrl = String(process.env.PORTAL_POSTGRES_URL || "").trim();
  const redisUrl = String(process.env.PORTAL_REDIS_URL || "").trim();
  assert(postgresUrl, "PORTAL_POSTGRES_URL is required when RUN_TENCENTDB_SMOKE=1");
  assert(redisUrl, "PORTAL_REDIS_URL is required when RUN_TENCENTDB_SMOKE=1");

  const { default: pg } = await import("pg");
  const { createClient } = await import("redis");
  const { Pool } = pg;
  const pool = new Pool({ connectionString: postgresUrl, connectionTimeoutMillis: 5000 });
  const redis = createClient({ url: redisUrl });
  redis.on("error", () => {});
  try {
    const pgResult = await pool.query("SELECT 1 AS ok");
    assert(Number(pgResult.rows[0]?.ok) === 1, "postgres health query failed");
    await redis.connect();
    const pong = await redis.ping();
    assert(String(pong || "").toUpperCase() === "PONG", "redis ping failed");
    return { skipped: false, postgres: "ok", redis: "ok" };
  } finally {
    await Promise.race([pool.end(), sleep(3000)]);
    if (redis.isOpen) await redis.quit().catch(() => {});
  }
}

await expectProductionConfigFailure({
  NODE_ENV: "production",
  PORTAL_STORAGE_MODE: "json",
  PORTAL_ADMIN_PASSWORD: "PortalAdmin-Production-Test",
  PORTAL_OIDC_ENABLED: "0",
}, "production_config_invalid:PORTAL_STORAGE_MODE_must_be_postgres_redis");

await expectProductionConfigFailure({
  NODE_ENV: "production",
  PORTAL_STORAGE_MODE: "postgres_redis",
  PORTAL_ADMIN_PASSWORD: "PortalAdmin-Production-Test",
  PORTAL_OIDC_ENABLED: "0",
  PORTAL_POSTGRES_URL: "postgres://postgres:postgres@127.0.0.1:5432/med_meta",
  PORTAL_REDIS_URL: "redis://127.0.0.1:6379",
}, "production_config_invalid:PORTAL_POSTGRES_URL");

const live = await connectTencentDbIfRequested();

console.log(JSON.stringify({
  ok: true,
  productionStorageModeGate: "pass",
  defaultConnectionGate: "pass",
  tencentDbConnectivity: live,
}, null, 2));
