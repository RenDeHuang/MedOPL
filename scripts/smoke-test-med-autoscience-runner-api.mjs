import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import pg from "../services/portal/node_modules/pg/esm/index.mjs";

const runnerPort = Number(process.env.MED_RUNNER_TEST_PORT || 18890);
const runnerUrl = `http://127.0.0.1:${runnerPort}`;
const portalDbPath = path.join(".runtime", "portal", "portal-db.json");
const portalPostgresUrl = String(process.env.PORTAL_POSTGRES_URL || "postgres://postgres:postgres@127.0.0.1:5432/med_meta").trim();
const portalDbNamespace = String(process.env.PORTAL_DB_NAMESPACE || "portal").trim() || "portal";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function spawnService(label, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label} did not become ready`);
}

async function json(path, options = {}) {
  const response = await fetch(`${runnerUrl}${path}`, options);
  const payload = await response.json();
  assert(response.ok, `${path} failed: ${JSON.stringify(payload)}`);
  return payload;
}

function ensureSmokePortalUser() {
  const user = {
    id: "portal-user-smoke",
    email: "portal-user-smoke@example.local",
    name: "portal-user-smoke",
    role: "user",
    status: "active",
    currentTaskSlug: "default",
    preferences: { theme: "light" },
    passwordHash: "smoke",
    createdAt: new Date().toISOString(),
    groupId: "",
  };

  if (!existsSync(portalDbPath)) {
    mkdirSync(path.dirname(portalDbPath), { recursive: true });
    writeFileSync(portalDbPath, `${JSON.stringify({
      users: [user],
      sessions: [],
      wallets: [{ userId: user.id, balance: 100, updatedAt: new Date().toISOString() }],
      ledger: [],
      taskSpaces: [],
      workspaceSessions: [],
      userSandboxes: [],
      groups: [],
      settings: { allowRegistration: true, announcements: [] },
    }, null, 2)}\n`);
    return;
  }

  const db = JSON.parse(readFileSync(portalDbPath, "utf8"));
  db.users = Array.isArray(db.users) ? db.users : [];
  db.wallets = Array.isArray(db.wallets) ? db.wallets : [];
  if (!db.users.some((item) => item.id === user.id)) {
    db.users.push(user);
  }
  const wallet = db.wallets.find((item) => item.userId === user.id);
  if (wallet) {
    wallet.balance = Math.max(Number(wallet.balance || 0), 100);
    wallet.updatedAt = new Date().toISOString();
  } else {
    db.wallets.push({ userId: user.id, balance: 100, updatedAt: new Date().toISOString() });
  }
  writeFileSync(portalDbPath, `${JSON.stringify(db, null, 2)}\n`);
}

async function ensureSmokePortalUserInPostgres() {
  const { Pool } = pg;
  const pool = new Pool({ connectionString: portalPostgresUrl });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${portalDbNamespace}_users" (
        id text PRIMARY KEY,
        email text NOT NULL,
        name text NOT NULL,
        role text NOT NULL,
        status text NOT NULL,
        password_hash text NOT NULL,
        current_task_slug text NOT NULL,
        group_id text NOT NULL,
        preferences_json jsonb NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS "${portalDbNamespace}_wallets" (
        user_id text PRIMARY KEY,
        balance numeric NOT NULL,
        updated_at timestamptz NOT NULL
      );
    `);
    await pool.query(
      `INSERT INTO "${portalDbNamespace}_users"
        (id,email,name,role,status,password_hash,current_task_slug,group_id,preferences_json,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        current_task_slug = EXCLUDED.current_task_slug,
        preferences_json = EXCLUDED.preferences_json`,
      [
        "portal-user-smoke",
        "portal-user-smoke@example.local",
        "portal-user-smoke",
        "user",
        "active",
        "smoke",
        "default",
        "",
        JSON.stringify({ theme: "light" }),
        new Date().toISOString(),
      ],
    );
    await pool.query(
      `INSERT INTO "${portalDbNamespace}_wallets" (user_id,balance,updated_at)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET
        balance = GREATEST("${portalDbNamespace}_wallets".balance, EXCLUDED.balance),
        updated_at = EXCLUDED.updated_at`,
      ["portal-user-smoke", 100, new Date().toISOString()],
    );
  } finally {
    await pool.end();
  }
}

rmSync(".runtime/med-autoscience", { recursive: true, force: true });
ensureSmokePortalUser();
await ensureSmokePortalUserInPostgres();

const runner = spawnService("med-runner", "node", ["src/server.mjs"], {
  cwd: "adapters/med-autoscience-runner",
  env: {
    ...process.env,
    MED_AUTOSCIENCE_RUNNER_PORT: String(runnerPort),
  },
});

try {
  await waitFor(`${runnerUrl}/healthz`, "med-autoscience runner");
  const health = await json("/healthz");
  assert(health.mode === "internal-runner", "runner is not using internal api mode");

  const workspace = await json("/api/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      portalUserId: "portal-user-smoke",
      customerId: "portal-user-smoke",
      userId: "portal-user-smoke",
      workspaceId: "default",
      workspaceSessionId: "ws-session-smoke",
      runtimeSessionId: "rt-session-smoke",
    }),
  });
  assert(workspace.workspace?.workspaceId === "default", "workspace was not created");
  assert(workspace.workspace?.portalUserId === "portal-user-smoke", "workspace portalUserId missing");

  const outputDir = path.join(".runtime", "med-autoscience", "workspaces", "portal-user-smoke", "default", "outputs");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, "result.json"), JSON.stringify({ ok: true }, null, 2));

  const runPayload = await json("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      portalUserId: "portal-user-smoke",
      customerId: "portal-user-smoke",
      userId: "portal-user-smoke",
      workspaceId: "default",
      workspaceSessionId: "ws-session-smoke",
      runtimeSessionId: "rt-session-smoke",
      runId: "runner-api-smoke",
      agentId: "mas",
      toolName: "med-autoscience",
      billingScope: "run",
      costCenter: "research-foundry",
    }),
  });
  assert(runPayload.run?.runId === "runner-api-smoke", "runId was not preserved");
  assert(runPayload.run?.runtimeSessionId === "rt-session-smoke", "runtimeSessionId missing on run");
  assert(runPayload.run?.status === "submitted", "run was not submitted");

  const status = await json("/api/runs/runner-api-smoke/status");
  assert(["submitted", "running", "succeeded", "failed"].includes(String(status.run?.status || "")), "runner status mapping invalid");

  const files = await json("/api/workspaces/portal-user-smoke/default/files");
  assert(Array.isArray(files.files?.inputs), "workspace inputs are not listed");
  assert(Array.isArray(files.files?.outputs), "workspace outputs are not listed");
  assert(files.files.outputs.some((item) => item.name === "result.json"), "workspace outputs did not include result.json");
  assert(files.files.outputs.every((item) => item.path && Number.isFinite(item.sizeBytes)), "workspace outputs are not structured");

  const outputs = await json("/api/workspaces/portal-user-smoke/default/outputs");
  assert(Array.isArray(outputs.outputs), "outputs api did not return an array");
  assert(outputs.outputs.some((item) => item.objectKey && item.contentType), "outputs api did not expose object metadata");

  console.log(JSON.stringify({
    ok: true,
    mode: health.mode,
    workspaceId: workspace.workspace.workspaceId,
    runId: runPayload.run.runId,
    runStatus: status.run.status,
    inputCount: files.files.inputs.length,
    outputCount: files.files.outputs.length,
    outputExample: files.files.outputs[0] || null,
  }, null, 2));
} finally {
  runner.kill();
}
