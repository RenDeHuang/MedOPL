import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.BILLING_TEST_PORT || 19321);
const suffix = String(Date.now());
const runtimeRoot = path.join(repoRoot, ".runtime");
const portalDbPath = path.join(runtimeRoot, "portal", "portal-db.json");
const tenantId = `tenant-smoke-${suffix}`;
const workspaceId = `ws-smoke-${suffix}`;
const runId = `run-smoke-exact-only-${suffix}`;
const runFilePath = path.join(runtimeRoot, "med-autoscience", "runs", `${runId}.json`);
const manifestPath = path.join(runtimeRoot, "med-autoscience", `${runId}.yaml`);
const workspaceDir = path.join(runtimeRoot, "med-autoscience", "workspaces", tenantId, workspaceId);
const workspaceFile = path.join(workspaceDir, "result.txt");

const portalDbBackup = existsSync(portalDbPath) ? readFileSync(portalDbPath, "utf8") : null;
const runFileBackup = existsSync(runFilePath) ? readFileSync(runFilePath, "utf8") : null;
const manifestBackup = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : null;
const workspaceBackup = existsSync(workspaceFile) ? readFileSync(workspaceFile, "utf8") : null;

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

mkdirSync(path.dirname(portalDbPath), { recursive: true });
mkdirSync(path.dirname(runFilePath), { recursive: true });
mkdirSync(workspaceDir, { recursive: true });

writeFileSync(manifestPath, [
  "apiVersion: batch/v1",
  "kind: Job",
  "spec:",
  "  template:",
  "    spec:",
  "      containers:",
  "        - name: runner",
  "          resources:",
  "            requests:",
  "              cpu: \"2\"",
].join("\n"), "utf8");
writeFileSync(workspaceFile, "billing smoke", "utf8");

const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const updatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
writeFileSync(runFilePath, JSON.stringify({
  runId,
  customerId: tenantId,
  userId: tenantId,
  workspaceId,
  manifestPath,
  createdAt,
  updatedAt,
  status: "succeeded",
  k8sStatus: {
    succeeded: true,
    conditions: [{ type: "Complete", status: "True", lastTransitionTime: updatedAt }],
  },
}, null, 2), "utf8");

writeFileSync(portalDbPath, JSON.stringify({
  wallets: [{ userId: tenantId, balance: 100, updatedAt: createdAt }],
  ledger: [],
}, null, 2), "utf8");

const service = spawnService();

try {
  await waitFor(`http://127.0.0.1:${port}/healthz`);

  const billingResponse = await fetch(`http://127.0.0.1:${port}/billing?customer_id=${tenantId}&workspace_id=${workspaceId}&window=7d`, {
    headers: { accept: "application/json" },
  });
  const billingPayload = await billingResponse.json();
  assert(billingResponse.ok, `billing failed: ${billingResponse.status} ${JSON.stringify(billingPayload)}`);
  assert(billingPayload.chargeBasis === "pending", `expected pending charge basis, got ${billingPayload.chargeBasis}`);
  assert(billingPayload.exactAvailable === false, "expected exactAvailable=false");
  assert(billingPayload.pending?.source === "metering_pending", `expected metering_pending, got ${billingPayload.pending?.source}`);
  assert((billingPayload.exact?.runs || []).length === 0, "exact summary should be empty without Tencent bill");

  const reconcileResponse = await fetch(`http://127.0.0.1:${port}/reconcile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customer_id: tenantId, workspace_id: workspaceId, window: "7d" }),
  });
  const reconcilePayload = await reconcileResponse.json();
  assert(reconcileResponse.ok, `reconcile failed: ${reconcileResponse.status} ${JSON.stringify(reconcilePayload)}`);
  assert(reconcilePayload.settlementMode === "exact_only", `unexpected settlementMode: ${reconcilePayload.settlementMode}`);
  assert(reconcilePayload.exactCount === 0, `exactCount should be 0, got ${reconcilePayload.exactCount}`);
  assert(reconcilePayload.adjustmentCount === 0, `adjustmentCount should be 0, got ${reconcilePayload.adjustmentCount}`);
  assert(reconcilePayload.estimatedCount >= 1, `estimatedCount should be at least 1, got ${reconcilePayload.estimatedCount}`);
  assert(reconcilePayload.results?.some?.((item) => item.runId === runId && item.action === "pending_exact_bill"), `missing pending_exact_bill for ${runId}: ${JSON.stringify(reconcilePayload.results)}`);

  const finalDb = JSON.parse(readFileSync(portalDbPath, "utf8"));
  assert(finalDb.wallets?.[0]?.balance === 100, `wallet balance changed unexpectedly: ${finalDb.wallets?.[0]?.balance}`);
  assert(!(finalDb.ledger || []).some((entry) => entry.type === "resource_charge" && entry.runId === runId), "resource_charge should not be written without exact bill");

  console.log(JSON.stringify({
    ok: true,
    chargeBasis: billingPayload.chargeBasis,
    pendingSource: billingPayload.pending?.source,
    reconcileAction: reconcilePayload.results?.find?.((item) => item.runId === runId)?.action,
    walletBalance: finalDb.wallets?.[0]?.balance,
  }, null, 2));
} finally {
  await stopService(service);
  restoreFile(portalDbPath, portalDbBackup);
  restoreFile(runFilePath, runFileBackup);
  restoreFile(manifestPath, manifestBackup);
  restoreFile(workspaceFile, workspaceBackup);
}
