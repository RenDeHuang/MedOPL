import { spawn, execFileSync } from "node:child_process";
import { rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const shouldRun = String(process.env.RUN_K8S_SMOKE || "").trim() === "1";
const runnerPort = Number(process.env.MED_RUNNER_TEST_PORT || 18891);
const runnerUrl = `http://127.0.0.1:${runnerPort}`;
const namespace = String(process.env.K8S_NAMESPACE || "med-agent-demo").trim();
const portalDbPath = ".runtime/portal/portal-db.json";

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

function skip(reason, detail = "") {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason,
    detail,
  }, null, 2));
  process.exit(0);
}

function canRunKubectl(args) {
  try {
    return {
      ok: true,
      stdout: execFileSync("kubectl", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    };
  } catch (error) {
    return {
      ok: false,
      detail: String(error.stderr || error.stdout || error.message || error),
    };
  }
}

function ensureSmokePortalUser() {
  const fallbackUser = {
    id: "runner-k8s-smoke-user",
    email: "runner-k8s-smoke@example.local",
    name: "runner-k8s-smoke-user",
    role: "user",
    status: "active",
    currentTaskSlug: "default",
    preferences: { theme: "light" },
    passwordHash: "smoke",
    createdAt: new Date().toISOString(),
    groupId: "",
  };

  if (!existsSync(portalDbPath)) {
    mkdirSync(".runtime/portal", { recursive: true });
    const db = {
      users: [fallbackUser],
      sessions: [],
      wallets: [{ userId: fallbackUser.id, balance: 100, updatedAt: new Date().toISOString() }],
      ledger: [],
      taskSpaces: [],
      workspaceSessions: [],
      userSandboxes: [],
      groups: [],
      settings: { allowRegistration: true, announcements: [] },
    };
    writeFileSync(portalDbPath, `${JSON.stringify(db, null, 2)}\n`);
    return fallbackUser.id;
  }

  const db = JSON.parse(readFileSync(portalDbPath, "utf8"));
  const fundedWallet = Array.isArray(db.wallets)
    ? db.wallets.find((item) => Number(item?.balance || 0) > 0 && item?.userId)
    : null;
  if (fundedWallet?.userId) {
    return String(fundedWallet.userId);
  }

  db.users = Array.isArray(db.users) ? db.users : [];
  db.wallets = Array.isArray(db.wallets) ? db.wallets : [];
  db.users.push(fallbackUser);
  db.wallets.push({ userId: fallbackUser.id, balance: 100, updatedAt: new Date().toISOString() });
  writeFileSync(portalDbPath, `${JSON.stringify(db, null, 2)}\n`);
  return fallbackUser.id;
}

if (!shouldRun) {
  skip("RUN_K8S_SMOKE!=1");
}

const kubectlClientVersion = canRunKubectl(["version", "--client=true"]);
if (!kubectlClientVersion.ok) {
  skip("kubectl_unavailable", kubectlClientVersion.detail);
}

const kubectlClusterInfo = canRunKubectl(["cluster-info"]);
if (!kubectlClusterInfo.ok) {
  skip("kubectl_cluster_unavailable", kubectlClusterInfo.detail);
}

rmSync(".runtime/med-autoscience", { recursive: true, force: true });
const customerId = ensureSmokePortalUser();

const runner = spawnService("med-runner", "node", ["src/server.mjs"], {
  cwd: "adapters/med-autoscience-runner",
  env: {
    ...process.env,
    MED_AUTOSCIENCE_RUNNER_PORT: String(runnerPort),
  },
});

try {
  await waitFor(`${runnerUrl}/healthz`, "med-autoscience runner");

  await json("/api/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customerId,
      userId: customerId,
      workspaceId: "default",
    }),
  });

  const runPayload = await json("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      portalUserId: customerId,
      customerId,
      userId: customerId,
      workspaceId: "default",
      workspaceSessionId: "ws-session-smoke",
      runtimeSessionId: "rt-session-smoke",
      runId: "run-smoke-k8s",
      agentId: "mas",
      toolName: "med-autoscience",
      billingScope: "run",
      costCenter: "research-foundry",
    }),
  });

  const run = runPayload.run;
  assert(run?.jobName, "runner did not return jobName");
  assert(run?.status === "submitted", `unexpected run status: ${run?.status}`);

  const statusPayload = await json(`/api/runs/${run.runId}/status`);
  assert(["submitted", "running", "succeeded", "failed"].includes(String(statusPayload.run?.status || "")), "status mapping invalid");

  const labels = execFileSync("kubectl", ["get", "job", run.jobName, "-n", namespace, "--show-labels"], {
    encoding: "utf8",
  });
  for (const key of [
    "portal_user_id",
    "user_id",
    "workspace_id",
    "workspace_session_id",
    "runtime_session_id",
    "run_id",
    "agent_id",
    "tool_name",
    "billing_scope",
    "cost_center",
  ]) {
    assert(labels.includes(`${key}=`), `missing kubernetes label ${key}`);
  }

  console.log(JSON.stringify({
    ok: true,
    skipped: false,
    namespace,
    runId: run.runId,
    jobName: run.jobName,
    status: statusPayload.run.status,
  }, null, 2));
} finally {
  runner.kill();
}
