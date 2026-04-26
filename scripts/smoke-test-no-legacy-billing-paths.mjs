import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.BILLING_TEST_PORT || 19322);
const suffix = String(Date.now());
const runtimeRoot = path.join(repoRoot, ".runtime");
const portalDbPath = path.join(runtimeRoot, "portal", "portal-db.json");
const tenantId = `tenant-smoke-${suffix}`;
const workspaceId = `ws-smoke-${suffix}`;
const runId = `run-smoke-no-legacy-${suffix}`;
const runFilePath = path.join(runtimeRoot, "med-autoscience", "runs", `${runId}.json`);
const manifestPath = path.join(runtimeRoot, "med-autoscience", `${runId}.yaml`);

const portalDbBackup = existsSync(portalDbPath) ? readFileSync(portalDbPath, "utf8") : null;
const runFileBackup = existsSync(runFilePath) ? readFileSync(runFilePath, "utf8") : null;
const manifestBackup = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function spawnService() {
  const child = spawn("node", ["src/server.mjs"], {
    cwd: path.join(repoRoot, "adapters", "billing-aggregator"),
    env: {
      ...process.env,
      PORT: String(port),
      AUTO_RECONCILE_ENABLED: "0",
      PORTAL_STORAGE_MODE: "json",
      TENCENT_BILLING_ENABLED: "0",
      TENCENT_BILLING_REQUIRED: "0",
      OPENCOST_BASE_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`service did not become ready: ${url}`);
}

async function stopService(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  try {
    await Promise.race([
      once(child, "exit"),
      sleep(3000).then(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }),
    ]);
  } catch {}
}

function restoreFile(filePath, backup) {
  if (backup === null) {
    rmSync(filePath, { force: true });
    return;
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, backup, "utf8");
}

const sourceFile = readFileSync(path.join(repoRoot, "adapters", "billing-aggregator", "src", "server.mjs"), "utf8");
assert(!sourceFile.includes("K8s requested resources exact"), "legacy exact string still present");
assert(!sourceFile.includes("pricingSourcePriority"), "legacy pricingSourcePriority still present");

mkdirSync(path.dirname(portalDbPath), { recursive: true });
mkdirSync(path.dirname(runFilePath), { recursive: true });

writeFileSync(portalDbPath, JSON.stringify({
  wallets: [{ userId: tenantId, balance: 50, updatedAt: new Date().toISOString() }],
  ledger: [],
}, null, 2), "utf8");

const createdAt = new Date(Date.now() - 90 * 60 * 1000).toISOString();
writeFileSync(manifestPath, [
  "spec:",
  "  template:",
  "    spec:",
  "      containers:",
  "        - name: runner",
  "          resources:",
  "            requests:",
  "              cpu: \"1\"",
].join("\n"), "utf8");
writeFileSync(runFilePath, JSON.stringify({
  runId,
  customerId: tenantId,
  userId: tenantId,
  workspaceId,
  manifestPath,
  createdAt,
  updatedAt: createdAt,
  status: "completed",
  k8sStatus: {
    succeeded: true,
    conditions: [{ type: "Complete", status: "True", lastTransitionTime: createdAt }],
  },
}, null, 2), "utf8");

const service = spawnService();

try {
  await waitFor(`http://127.0.0.1:${port}/healthz`);

  const statusResponse = await fetch(`http://127.0.0.1:${port}/status`);
  const statusPayload = await statusResponse.json();
  assert(statusResponse.ok, `status failed: ${statusResponse.status}`);
  assert(Array.isArray(statusPayload.exactSources), "exactSources missing");
  assert(Array.isArray(statusPayload.pendingSources), "pendingSources missing");
  assert(!("pricingSourcePriority" in statusPayload), "legacy pricingSourcePriority still exposed");

  const billingResponse = await fetch(`http://127.0.0.1:${port}/billing?customer_id=${tenantId}&workspace_id=${workspaceId}&window=7d`, {
    headers: { accept: "application/json" },
  });
  const billingPayload = await billingResponse.json();
  assert(billingResponse.ok, `billing failed: ${billingResponse.status} ${JSON.stringify(billingPayload)}`);
  assert("exact" in billingPayload, "exact section missing");
  assert("pending" in billingPayload, "pending section missing");
  assert("unattributed" in billingPayload, "unattributed section missing");
  assert(billingPayload.settlement?.mode === "exact_only", `unexpected settlement mode: ${billingPayload.settlement?.mode}`);
  assert(billingPayload.pending?.source === "metering_pending", `unexpected pending source: ${billingPayload.pending?.source}`);
  assert(billingPayload.exact?.source === "exact_unavailable", `unexpected exact source: ${billingPayload.exact?.source}`);

  console.log(JSON.stringify({
    ok: true,
    exactSources: statusPayload.exactSources,
    pendingSources: statusPayload.pendingSources,
    chargeBasis: billingPayload.chargeBasis,
    exactSource: billingPayload.exact?.source,
    pendingSource: billingPayload.pending?.source,
  }, null, 2));
} finally {
  await stopService(service);
  restoreFile(portalDbPath, portalDbBackup);
  restoreFile(runFilePath, runFileBackup);
  restoreFile(manifestPath, manifestBackup);
}
