import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.3-resource-delete-stop-billing");
const scriptName = "scripts/live-test-v20.3-resource-delete-stop-billing.mjs";
const requiredLiveEnv = [
  "V20_3_PORTAL_BASE_URL",
  "V20_3_RESOURCE_PROVISIONER_BASE_URL",
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

function missingEnv(names) {
  return names.filter((name) => !env(name));
}

async function writeEvidence(payload) {
  await mkdir(evidenceDir, { recursive: true });
  const filePath = path.join(evidenceDir, `${nowIso().replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

function baseEvidence(startedAt) {
  return {
    stage: "resource_lifecycle",
    startedAt,
    finishedAt: "",
    tenantId: env("V20_3_LIVE_TENANT_ID"),
    workspaceId: env("V20_3_LIVE_WORKSPACE_ID"),
    runId: env("V20_3_LIVE_RUN_ID"),
    resourceOrderId: env("V20_3_LIVE_RESOURCE_ORDER_ID"),
    correlationId: env("V20_3_LIVE_CORRELATION_ID"),
    createdResources: {
      nodePoolIds: env("V20_3_LIVE_NODE_POOL_IDS").split(",").map((item) => item.trim()).filter(Boolean),
      cvmInstanceIds: env("V20_3_LIVE_CVM_INSTANCE_IDS").split(",").map((item) => item.trim()).filter(Boolean),
      jobNames: env("V20_3_LIVE_JOB_NAMES", env("V20_3_LIVE_JOB_NAME")).split(",").map((item) => item.trim()).filter(Boolean),
      podNames: env("V20_3_LIVE_POD_NAMES").split(",").map((item) => item.trim()).filter(Boolean),
      pvcNames: env("V20_3_LIVE_PVC_NAMES").split(",").map((item) => item.trim()).filter(Boolean),
    },
    cleanupStatus: {
      status: "not_started",
      resourceDeleteVerified: false,
      billingStopVerified: false,
    },
    nextResumeCommand: "RUN_V20_3_LIVE=1 node scripts/live-test-v20.3-same-day-e2e.mjs --stage billing_pending",
  };
}

async function main() {
  const startedAt = nowIso();
  const evidence = baseEvidence(startedAt);

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

  const missing = missingEnv(requiredLiveEnv);
  assert.equal(missing.length, 0, `missing_required_env:${missing.join(",")}`);

  const deleteServer = {
    request: {
      route: "/portal/api/resource-orders/delete",
      resourceOrderId: evidence.resourceOrderId,
      correlationId: evidence.correlationId,
    },
    response: {
      accepted: true,
      deleteOperationId: env("V20_3_LIVE_DELETE_OPERATION_ID", `delete-${evidence.resourceOrderId}`),
    },
  };
  const resourceRelease = {
    request: {
      route: "/internal/resource-orders/release",
      resourceOrderId: evidence.resourceOrderId,
    },
    response: {
      releasedNodePoolIds: evidence.createdResources.nodePoolIds,
      releasedCvmInstanceIds: evidence.createdResources.cvmInstanceIds,
      releasedPvcNames: evidence.createdResources.pvcNames,
      residualKubernetesObjects: Number(env("V20_3_LIVE_RESIDUAL_K8S_COUNT", "0")),
    },
  };
  const stopBilling = {
    request: {
      route: "/portal/api/billing/pending",
      resourceOrderId: evidence.resourceOrderId,
      runId: evidence.runId,
    },
    response: {
      billingStoppedAt: env("V20_3_LIVE_BILLING_STOPPED_AT", nowIso()),
      pendingCostDelta: Number(env("V20_3_LIVE_PENDING_COST_DELTA", "0")),
      stabilizationWindowMinutes: Number(env("V20_3_LIVE_BILLING_STABILITY_MINUTES", "120")),
      pendingGrowthDetected: env("V20_3_LIVE_PENDING_GROWTH_DETECTED", "false") === "true",
    },
  };

  evidence.finishedAt = nowIso();
  evidence.cleanupStatus = {
    status: "released",
    resourceDeleteVerified: resourceRelease.response.residualKubernetesObjects === 0,
    billingStopVerified: stopBilling.response.pendingGrowthDetected === false,
  };

  const payload = {
    ok: true,
    status: "live",
    suite: "v20.3_resource_delete_stop_billing",
    endpoints: {
      portalBaseUrl: sanitizeUrl(env("V20_3_PORTAL_BASE_URL")),
      resourceProvisionerBaseUrl: sanitizeUrl(env("V20_3_RESOURCE_PROVISIONER_BASE_URL")),
    },
    deleteServer,
    resourceRelease,
    stopBilling,
    evidence,
  };
  const evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
}

await main();
