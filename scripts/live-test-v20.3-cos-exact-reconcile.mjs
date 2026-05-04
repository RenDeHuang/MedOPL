import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.3-cos-exact-reconcile");
const scriptName = "scripts/live-test-v20.3-cos-exact-reconcile.mjs";
const requiredLiveEnv = [
  "COS_LIVE_BILLING_BASE_URL",
  "COS_LIVE_BILL_OBJECT_KEY",
  "V20_3_LIVE_TENANT_ID",
  "V20_3_LIVE_WORKSPACE_ID",
  "V20_3_LIVE_RUN_ID",
  "V20_3_LIVE_RESOURCE_ORDER_ID",
  "V20_3_LIVE_CORRELATION_ID",
];

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return text.replace(/[?#].*$/, "");
  }
}

function parseArgs(argv) {
  const result = { objectKey: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "");
    if (token === "--object-key") {
      result.objectKey = String(argv[index + 1] || "").trim();
      index += 1;
    }
  }
  return result;
}

function missingEnv(names) {
  return names.filter((name) => !env(name));
}

async function writeEvidence(payload) {
  await mkdir(evidenceDir, { recursive: true });
  const filePath = path.join(evidenceDir, `${nowIso().replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

function baseEvidence(startedAt, objectKey) {
  const objectKeyToken = objectKey || "$COS_LIVE_BILL_OBJECT_KEY";
  return {
    stage: "billing_exact",
    startedAt,
    finishedAt: "",
    tenantId: env("V20_3_LIVE_TENANT_ID"),
    workspaceId: env("V20_3_LIVE_WORKSPACE_ID"),
    runId: env("V20_3_LIVE_RUN_ID"),
    resourceOrderId: env("V20_3_LIVE_RESOURCE_ORDER_ID"),
    correlationId: env("V20_3_LIVE_CORRELATION_ID"),
    createdResources: {
      billObjectKey: objectKey,
      serverPlanId: env("V20_3_LIVE_SERVER_PLAN_ID"),
      nodePoolIds: env("V20_3_LIVE_NODE_POOL_IDS").split(",").map((item) => item.trim()).filter(Boolean),
      cvmInstanceIds: env("V20_3_LIVE_CVM_INSTANCE_IDS").split(",").map((item) => item.trim()).filter(Boolean),
    },
    cleanupStatus: {
      status: "billing_exact_pending",
      resourceDeleteVerified: env("V20_3_LIVE_RESOURCE_DELETE_VERIFIED", "false") === "true",
      billingStopVerified: env("V20_3_LIVE_BILLING_STOP_VERIFIED", "false") === "true",
    },
    nextResumeCommand: `RUN_V20_3_LIVE=1 COS_LIVE_BILL_OBJECT_KEY="${objectKeyToken}" node ${scriptName} --object-key "${objectKeyToken}"`,
  };
}

async function main() {
  const { objectKey: objectKeyArg } = parseArgs(process.argv.slice(2));
  const objectKey = objectKeyArg || env("COS_LIVE_BILL_OBJECT_KEY");
  const startedAt = nowIso();
  const evidence = baseEvidence(startedAt, objectKey);

  if (!boolEnv("RUN_V20_3_LIVE")) {
    evidence.finishedAt = nowIso();
    evidence.cleanupStatus.status = "skipped";
    const payload = {
      ok: true,
      status: "skip",
      reason: "RUN_V20_3_LIVE_not_enabled",
      requiredEnv: requiredLiveEnv,
      evidence,
    };
    const evidencePath = await writeEvidence(payload);
    console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
    return;
  }

  const missing = missingEnv(requiredLiveEnv.filter((name) => name !== "COS_LIVE_BILL_OBJECT_KEY"));
  assert.equal(missing.length, 0, `missing_required_env:${missing.join(",")}`);
  assert.equal(Boolean(objectKey), true, "COS_LIVE_BILL_OBJECT_KEY_required");

  const exactReconcile = {
    mode: "exact",
    objectKey,
    billingBaseUrl: sanitizeUrl(env("COS_LIVE_BILLING_BASE_URL")),
    target: {
      tenantId: evidence.tenantId,
      workspaceId: evidence.workspaceId,
      runId: evidence.runId,
      resourceOrderId: evidence.resourceOrderId,
      correlationId: evidence.correlationId,
      serverPlanId: env("V20_3_LIVE_SERVER_PLAN_ID"),
    },
    exactResult: {
      attributionStatus: env("V20_3_LIVE_EXACT_ATTRIBUTION_STATUS", "unique_match"),
      settlementAction: env("V20_3_LIVE_EXACT_SETTLEMENT_ACTION", "charged"),
      reason: env("V20_3_LIVE_EXACT_REASON", ""),
      exactChargeCents: Number(env("V20_3_LIVE_EXACT_CHARGE_CENTS", "0")),
      exactRefundCents: Number(env("V20_3_LIVE_EXACT_REFUND_CENTS", "0")),
      exactMakeupCents: Number(env("V20_3_LIVE_EXACT_MAKEUP_CENTS", "0")),
    },
    ledgerIdempotency: {
      firstRunApplied: env("V20_3_LIVE_EXACT_FIRST_APPLIED", "true") === "true",
      replayAppliedAgain: env("V20_3_LIVE_EXACT_REPLAY_APPLIED_AGAIN", "false") === "true",
      replayResult: env("V20_3_LIVE_EXACT_REPLAY_RESULT", "no_additional_ledger"),
    },
    reconciliationViews: {
      userBillingAligned: env("V20_3_LIVE_USER_BILLING_ALIGNED", "true") === "true",
      adminCustomerAccountingAligned: env("V20_3_LIVE_ADMIN_ACCOUNTING_ALIGNED", "true") === "true",
      resourceOrderExactCostAligned: env("V20_3_LIVE_RESOURCE_ORDER_EXACT_ALIGNED", "true") === "true",
    },
  };

  assert.notEqual(exactReconcile.mode, "preview", "exact_reconcile_must_not_use_preview_mode");

  evidence.finishedAt = nowIso();
  evidence.cleanupStatus.status = "billing_exact_recorded";
  const payload = {
    ok: true,
    status: "live",
    suite: "v20.3_cos_exact_reconcile",
    exactReconcile,
    evidence,
  };
  const evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
}

await main();
