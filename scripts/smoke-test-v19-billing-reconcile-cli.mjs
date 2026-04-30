import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyExactChargeForOrder,
  applySettlementAdjustmentForOrder,
} from "../adapters/billing-aggregator/src/ledger-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(repoRoot, ".runtime");
const portalDbPath = path.join(runtimeRoot, "portal", "portal-db.json");
const suffix = String(Date.now());
const tenantId = `tenant-reconcile-cli-${suffix}`;
const workspaceId = `ws-reconcile-cli-${suffix}`;
const runId = `run-reconcile-cli-${suffix}`;
const runFilePath = path.join(runtimeRoot, "med-autoscience", "runs", `${runId}.json`);
const manifestPath = path.join(runtimeRoot, "med-autoscience", `${runId}.yaml`);
const workspaceDir = path.join(runtimeRoot, "med-autoscience", "workspaces", tenantId, workspaceId);
const workspaceFile = path.join(workspaceDir, "result.txt");

const portalDbBackup = existsSync(portalDbPath) ? readFileSync(portalDbPath, "utf8") : null;
const runFileBackup = existsSync(runFilePath) ? readFileSync(runFilePath, "utf8") : null;
const manifestBackup = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : null;
const workspaceBackup = existsSync(workspaceFile) ? readFileSync(workspaceFile, "utf8") : null;

function restoreFile(filePath, backup) {
  if (backup === null) {
    rmSync(filePath, { force: true });
    return;
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, backup, "utf8");
}

function parseJsonOutput(text) {
  const trimmed = String(text || "").trim();
  assert(trimmed, "missing reconcile stdout");
  return JSON.parse(trimmed);
}

function runReconcileProcess({ args = [], env = {} }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["src/server.mjs", ...args], {
      cwd: path.join(repoRoot, "adapters", "billing-aggregator"),
      env: {
        ...process.env,
        PORT: "0",
        AUTO_RECONCILE_ENABLED: "0",
        PORTAL_STORAGE_MODE: "json",
        TENCENT_BILLING_ENABLED: "0",
        TENCENT_BILLING_REQUIRED: "0",
        OPENCOST_BASE_URL: "",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function assertBillingLedgerContract() {
  const db = { wallets: [{ userId: "user-ledger-contract", balance: 100, updatedAt: createdAt }], ledger: [] };
  const user = { id: "user-ledger-contract" };
  const order = {
    id: "ro-ledger-contract",
    tenantId: "tenant-ledger-contract",
    userId: user.id,
    workspaceId: "ws-ledger-contract",
    runId: "run-ledger-contract",
    billingAccountId: user.id,
    currency: "CNY",
  };

  const charge = applyExactChargeForOrder(db, { user, order, exactCost: 30, sourceId: "cos-daily-ledger-contract" });
  assert.equal(charge.created, true);
  assert.equal(db.wallets[0].balance, 70);
  assert.equal(db.ledger.length, 1);
  assert.equal(db.ledger[0].type, "exact_resource_charge");

  const duplicateCharge = applyExactChargeForOrder(db, { user, order, exactCost: 30, sourceId: "cos-daily-ledger-contract" });
  assert.equal(duplicateCharge.created, false);
  assert.equal(db.wallets[0].balance, 70);
  assert.equal(db.ledger.length, 1);

  const makeup = applySettlementAdjustmentForOrder(db, { user, order, type: "makeup_charge", amount: 5, sourceId: "cos-daily-ledger-contract:35.00" });
  assert.equal(makeup.created, true);
  assert.equal(db.wallets[0].balance, 65);

  const duplicateMakeup = applySettlementAdjustmentForOrder(db, { user, order, type: "makeup_charge", amount: 5, sourceId: "cos-daily-ledger-contract:35.00" });
  assert.equal(duplicateMakeup.created, false);
  assert.equal(db.wallets[0].balance, 65);

  const refund = applySettlementAdjustmentForOrder(db, { user, order, type: "refund", amount: 3, sourceId: "cos-daily-ledger-contract:32.00" });
  assert.equal(refund.created, true);
  assert.equal(db.wallets[0].balance, 68);
  assert.deepEqual(db.ledger.map((entry) => entry.type), ["exact_resource_charge", "makeup_charge", "refund"]);
}

mkdirSync(path.dirname(portalDbPath), { recursive: true });
mkdirSync(path.dirname(runFilePath), { recursive: true });
mkdirSync(workspaceDir, { recursive: true });

const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const updatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();

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
writeFileSync(workspaceFile, "billing reconcile cli smoke", "utf8");

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
  wallets: [{ userId: tenantId, balance: 88, updatedAt: createdAt }],
  ledger: [],
  resourceOrders: [],
}, null, 2), "utf8");

try {
  assertBillingLedgerContract();

  const cliRun = await runReconcileProcess({
    args: ["reconcile", "--customer-id", tenantId, "--workspace-id", workspaceId, "--window", "7d"],
  });
  assert.equal(cliRun.code, 0, `cli reconcile exit=${cliRun.code} stderr=${cliRun.stderr}`);
  assert.equal(cliRun.stderr.trim(), "", `cli reconcile stderr should be empty: ${cliRun.stderr}`);
  assert.equal(cliRun.stdout.includes("billing-aggregator listening on"), false, `cli reconcile must not start HTTP server: ${cliRun.stdout}`);
  const cliPayload = parseJsonOutput(cliRun.stdout);
  assert.equal(cliPayload.settlementMode, "exact_only");
  assert.equal(cliPayload.results.some((item) => item.runId === runId && item.action === "pending_exact_bill"), true, `missing pending_exact_bill from CLI payload: ${cliRun.stdout}`);

  const onceRun = await runReconcileProcess({
    env: {
      BILLING_RECONCILE_ONCE: "1",
      BILLING_RECONCILE_CUSTOMER_ID: tenantId,
      BILLING_RECONCILE_WORKSPACE_ID: workspaceId,
      BILLING_RECONCILE_WINDOW: "7d",
    },
  });
  assert.equal(onceRun.code, 0, `once reconcile exit=${onceRun.code} stderr=${onceRun.stderr}`);
  assert.equal(onceRun.stderr.trim(), "", `once reconcile stderr should be empty: ${onceRun.stderr}`);
  assert.equal(onceRun.stdout.includes("billing-aggregator listening on"), false, `BILLING_RECONCILE_ONCE must not start HTTP server: ${onceRun.stdout}`);
  const oncePayload = parseJsonOutput(onceRun.stdout);
  assert.equal(oncePayload.results.some((item) => item.runId === runId && item.action === "pending_exact_bill"), true, `missing pending_exact_bill from once payload: ${onceRun.stdout}`);

  const finalDb = JSON.parse(readFileSync(portalDbPath, "utf8"));
  assert.equal(finalDb.wallets?.[0]?.balance, 88, `wallet balance changed unexpectedly: ${finalDb.wallets?.[0]?.balance}`);
  assert.equal((finalDb.ledger || []).length, 0, `ledger should stay empty without exact bill: ${JSON.stringify(finalDb.ledger || [])}`);

  console.log(JSON.stringify({
    ok: true,
    ledgerContractTypes: ["exact_resource_charge", "makeup_charge", "refund"],
    cliAction: cliPayload.results.find((item) => item.runId === runId)?.action,
    onceAction: oncePayload.results.find((item) => item.runId === runId)?.action,
    walletBalance: finalDb.wallets?.[0]?.balance,
  }, null, 2));
} finally {
  restoreFile(portalDbPath, portalDbBackup);
  restoreFile(runFilePath, runFileBackup);
  restoreFile(manifestPath, manifestBackup);
  restoreFile(workspaceFile, workspaceBackup);
}
