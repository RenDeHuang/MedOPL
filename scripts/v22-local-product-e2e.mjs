#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const DEFAULT_BASE_URL = "http://127.0.0.1:8789";
const RUNTIME_DIR = ".runtime/local-product-e2e";
const rawProviderKey = "local-rc-provider-key-material-that-must-stay-private";

const STEP_DEFINITIONS = Object.freeze([
  { id: "backend-health", method: "GET", path: "/healthz" },
  { id: "bind-provider-key", method: "POST", path: "/api/v22/provider-key" },
  { id: "managed-environment-readiness", method: "POST", path: "/api/v22/managed-environment/readiness" },
  { id: "open-runtime", method: "POST", path: "/api/v22/managed-environment/open" },
  { id: "runtime-gate", method: "POST", path: "/api/opl/runtime-gate" },
  { id: "upload-file", method: "POST", path: "/api/opl/files" },
  { id: "run-task", method: "POST", path: "/api/opl/runs" },
  { id: "fetch-artifact", method: "GET", path: "/api/opl/artifacts/{artifactRef}" },
  { id: "billing-summary", method: "GET", path: "/api/billing/summary" },
  { id: "resource-projection", method: "GET", path: "/api/platform-provisioned-resources" },
  { id: "release-runtime", method: "POST", path: "/api/v22/managed-environment/release" },
  { id: "destroy-storage", method: "POST", path: "/api/v22/storage/destroy" },
]);

const SINGLE_FLOW_EVIDENCE_DEFINITIONS = Object.freeze([
  {
    id: "runtime_open",
    stepId: "open-runtime",
    requiredFields: ["launchId", "resourceBindingId"],
  },
  {
    id: "storage_ready",
    stepId: "runtime-gate",
    requiredFields: ["storageBindingId", "storageState"],
  },
  {
    id: "file_upload",
    stepId: "upload-file",
    requiredFields: ["fileRef"],
  },
  {
    id: "run_task",
    stepId: "run-task",
    requiredFields: ["artifactRef"],
  },
  {
    id: "artifact_projection",
    stepId: "fetch-artifact",
    requiredFields: ["artifactRef"],
  },
  {
    id: "billing_audit_projection",
    stepId: "billing-summary",
    requiredFields: ["runCount", "ledgerCount"],
  },
  {
    id: "release_runtime_stop_billing",
    stepId: "release-runtime",
    requiredFields: ["billingStopped", "auditEventId"],
  },
  {
    id: "storage_destroy_intent",
    stepId: "destroy-storage",
    requiredFields: ["storageDestroyed", "storageState"],
  },
]);

function parseArgs(argv) {
  const options = { json: false, execute: false, dryRun: false, baseUrl: DEFAULT_BASE_URL, timeoutMs: 2500 };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--json") options.json = true;
    else if (item === "--execute") options.execute = true;
    else if (item === "--dry-run") options.dryRun = true;
    else if (item === "--base-url") {
      options.baseUrl = argv[index + 1] || options.baseUrl;
      index += 1;
    } else if (item === "--timeout-ms") {
      options.timeoutMs = Number(argv[index + 1] || options.timeoutMs);
      index += 1;
    }
  }
  return options;
}

function evidenceRef(runId) {
  return `${RUNTIME_DIR}/${runId}/report.json`;
}

function runtimePath(runId) {
  return path.join(repoRoot, RUNTIME_DIR, runId);
}

function plannedSteps() {
  return STEP_DEFINITIONS.map((step) => ({
    id: step.id,
    method: step.method,
    path: step.path,
    status: "planned",
  }));
}

function plannedSingleFlowEvidence(evidenceRef) {
  return {
    kind: "v22_local_product_single_flow_evidence",
    owner: "services/medopl-go-backend",
    evidenceCompleteness: "planned",
    evidenceRef,
    requiredEvidence: SINGLE_FLOW_EVIDENCE_DEFINITIONS.map((item) => ({
      id: item.id,
      stepId: item.stepId,
      status: "planned",
      requiredFields: item.requiredFields,
    })),
  };
}

function basePayload(options, runId) {
  const execute = Boolean(options.execute && !options.dryRun);
  const ref = evidenceRef(runId);
  return {
    ok: true,
    kind: "v22_local_product_e2e_runner",
    coverageMode: "go_backend_local_product_api",
    executionMode: execute ? "execute" : "dry-run",
    failClosed: true,
    baseUrl: options.baseUrl,
    runId,
    evidenceRef: ref,
    executesRequests: execute,
    ownerBoundary: {
      directOwner: "services/medopl-go-backend",
      requiredRunningServices: ["go-backend"],
      topologyServicesNotProbed: [
        "portal-frontend",
        "opl-web-gateway",
        "runtime-bridge",
        "clean-opl-webui",
      ],
    },
    canClaim: execute ? "Go backend local product API execution evidence" : "Go backend local product API plan only",
    cannotClaim: [
      "production deploy",
      "real cloud execution",
      "production complete",
      "raw provider key persistence",
      "Portal browser E2E coverage",
      "Gateway direct route coverage",
      "Runtime Bridge direct route coverage",
      "clean OPL WebUI availability",
    ],
    steps: plannedSteps(),
    singleFlowEvidence: plannedSingleFlowEvidence(ref),
  };
}

function redacted(value) {
  const text = JSON.stringify(value);
  return JSON.parse(text.replaceAll(rawProviderKey, "[redacted-provider-key]"));
}

function assertPublicPayload(value, stepId) {
  if (JSON.stringify(value).includes(rawProviderKey)) {
    throw new Error(`raw_provider_key_leaked:${stepId}`);
  }
}

async function requestJson({ baseUrl, stepId, method, path: requestPath, body, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${requestPath}`, {
      method,
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      redirect: "manual",
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    assertPublicPayload(payload, stepId);
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        httpStatus: response.status,
        payload: redacted(payload),
      };
    }
    return {
      ok: true,
      status: "passed",
      httpStatus: response.status,
      payload: redacted(payload),
    };
  } catch (error) {
    return {
      ok: false,
      status: "blocked",
      error: error?.name === "AbortError" ? "timeout" : String(error.message || error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function stepById(payload, id) {
  return payload.steps.find((step) => step.id === id);
}

function mark(payload, id, result, extra = {}) {
  Object.assign(stepById(payload, id), {
    status: result.status,
    ok: result.ok,
    httpStatus: result.httpStatus,
    error: result.error,
    ...extra,
  });
  return result;
}

function evidenceById(payload, id) {
  return payload.singleFlowEvidence.requiredEvidence.find((item) => item.id === id);
}

function evidenceFieldPresent(value) {
  return value !== undefined && value !== null && value !== "";
}

function completeEvidence(payload, id, fields) {
  const item = evidenceById(payload, id);
  for (const field of item.requiredFields) {
    if (!evidenceFieldPresent(fields[field])) {
      throw new Error(`local_product_e2e_missing_evidence_field:${id}:${field}`);
    }
  }
  Object.assign(item, {
    status: "passed",
    fields: redacted(fields),
  });
}

function blockPendingEvidence(payload) {
  for (const item of payload.singleFlowEvidence.requiredEvidence) {
    if (item.status === "planned") item.status = "blocked";
  }
  payload.singleFlowEvidence.evidenceCompleteness = "blocked";
}

function failWithBlocker(payload, blocker) {
  payload.ok = false;
  blockPendingEvidence(payload);
  payload.blocker = blocker;
  return payload;
}

function completeSingleFlowEvidence(payload) {
  const allPassed = payload.singleFlowEvidence.requiredEvidence.every((item) => item.status === "passed");
  payload.singleFlowEvidence.evidenceCompleteness = allPassed ? "complete" : "blocked";
}

function requireField(result, field, stepId) {
  const value = result.payload?.[field];
  if (!value) throw new Error(`local_product_e2e_missing_field:${stepId}:${field}`);
  return value;
}

async function executeFlow(payload, options) {
  const common = { baseUrl: options.baseUrl.replace(/\/+$/u, ""), timeoutMs: options.timeoutMs };
  let result = await requestJson({ ...common, stepId: "backend-health", method: "GET", path: "/healthz" });
  mark(payload, "backend-health", result);
  if (!result.ok) {
    return failWithBlocker(payload, {
      type: "local_service_unreachable",
      step: "backend-health",
      detail: result.error || `http_${result.httpStatus}`,
    });
  }

  const workspaceId = "workspace-v22";
  result = await requestJson({
    ...common,
    stepId: "bind-provider-key",
    method: "POST",
    path: "/api/v22/provider-key",
    body: {
      tenantId: "tenant-v22",
      portalUserId: "user-v22",
      workspaceId,
      apiKey: rawProviderKey,
      idempotencyKey: `local-product-e2e-bind-${payload.runId}`,
    },
  });
  mark(payload, "bind-provider-key", result, { providerKeyRef: result.payload?.providerKeyRef || "" });
  if (!result.ok) return failAt(payload, "bind-provider-key", result);

  result = await requestJson({
    ...common,
    stepId: "managed-environment-readiness",
    method: "POST",
    path: "/api/v22/managed-environment/readiness",
    body: { workspaceId },
  });
  mark(payload, "managed-environment-readiness", result);
  if (!result.ok) return failAt(payload, "managed-environment-readiness", result);

  result = await requestJson({
    ...common,
    stepId: "open-runtime",
    method: "POST",
    path: "/api/v22/managed-environment/open",
    body: {
      tenantId: "tenant-v22",
      portalUserId: "user-v22",
      workspaceId,
      idempotencyKey: `local-product-e2e-open-${payload.runId}`,
    },
  });
  const launchId = requireField(result, "launchId", "open-runtime");
  const resourceBindingId = requireField(result, "resourceBindingId", "open-runtime");
  mark(payload, "open-runtime", result, { launchId, resourceBindingId });
  if (!result.ok) return failAt(payload, "open-runtime", result);
  completeEvidence(payload, "runtime_open", { launchId, resourceBindingId });

  result = await requestJson({
    ...common,
    stepId: "runtime-gate",
    method: "POST",
    path: "/api/opl/runtime-gate",
    body: {
      workspaceId,
      invocationMode: "runtime_required",
      runtimePlanId: "starter_2c4g_10gb",
      storagePlanId: "workspace_10gb",
    },
  });
  const storageBindingId = result.payload?.storageBindingId || "";
  mark(payload, "runtime-gate", result, { storageBindingId });
  if (!result.ok) return failAt(payload, "runtime-gate", result);
  completeEvidence(payload, "storage_ready", {
    storageBindingId,
    storageState: result.payload?.storageState || "",
    runtimeState: result.payload?.runtimeState || "",
  });

  result = await requestJson({
    ...common,
    stepId: "upload-file",
    method: "POST",
    path: `/api/opl/files?launchId=${encodeURIComponent(launchId)}`,
    body: {
      fileName: "measurements.csv",
      relativePath: "inputs/measurements.csv",
      contentType: "text/csv",
      sizeBytes: 128,
    },
  });
  const fileRef = requireField(result, "fileRef", "upload-file");
  mark(payload, "upload-file", result, { fileRef });
  if (!result.ok) return failAt(payload, "upload-file", result);
  completeEvidence(payload, "file_upload", {
    fileRef,
    workspaceId: result.payload?.workspaceId || "",
    providerKeyRef: result.payload?.providerKeyRef || "",
    relativePath: result.payload?.file?.relativePath || "",
    fileStatus: result.payload?.file?.status || "",
  });

  result = await requestJson({
    ...common,
    stepId: "run-task",
    method: "POST",
    path: `/api/opl/runs?launchId=${encodeURIComponent(launchId)}`,
    body: {
      message: "analyze file",
      fileRefs: [fileRef],
      toolName: "opl-workbench",
      requestId: `local-product-e2e-run-${payload.runId}`,
    },
  });
  const artifactRef = result.payload?.artifacts?.[0]?.artifactRef || "";
  if (!artifactRef) throw new Error("local_product_e2e_missing_field:run-task:artifactRef");
  mark(payload, "run-task", result, { artifactRef });
  if (!result.ok) return failAt(payload, "run-task", result);
  completeEvidence(payload, "run_task", {
    artifactRef,
    runRef: result.payload?.run?.runRef || "",
    status: result.payload?.status || "",
    artifactKind: result.payload?.artifacts?.[0]?.kind || "",
    workspaceId: result.payload?.artifacts?.[0]?.workspaceId || "",
    providerKeyRef: result.payload?.artifacts?.[0]?.providerKeyRef || "",
  });

  result = await requestJson({
    ...common,
    stepId: "fetch-artifact",
    method: "GET",
    path: `/api/opl/artifacts/${encodeURIComponent(artifactRef)}?launchId=${encodeURIComponent(launchId)}`,
  });
  mark(payload, "fetch-artifact", result, { artifactRef });
  if (!result.ok) return failAt(payload, "fetch-artifact", result);
  completeEvidence(payload, "artifact_projection", {
    artifactRef,
    workspaceId: result.payload?.artifact?.workspaceId || "",
    providerKeyRef: result.payload?.artifact?.providerKeyRef || "",
    kind: result.payload?.artifact?.kind || "",
    relativePath: result.payload?.artifact?.relativePath || "",
    contentType: result.payload?.artifact?.contentType || "",
  });

  result = await requestJson({
    ...common,
    stepId: "billing-summary",
    method: "GET",
    path: `/api/billing/summary?workspaceId=${encodeURIComponent(workspaceId)}`,
  });
  mark(payload, "billing-summary", result);
  if (!result.ok) return failAt(payload, "billing-summary", result);
  completeEvidence(payload, "billing_audit_projection", {
    runCount: result.payload?.summary?.runCount,
    ledgerCount: result.payload?.ledger?.length || 0,
    source: result.payload?.source || "",
  });

  result = await requestJson({
    ...common,
    stepId: "resource-projection",
    method: "GET",
    path: `/api/platform-provisioned-resources?workspaceId=${encodeURIComponent(workspaceId)}`,
  });
  mark(payload, "resource-projection", result);
  if (!result.ok) return failAt(payload, "resource-projection", result);

  result = await requestJson({
    ...common,
    stepId: "release-runtime",
    method: "POST",
    path: "/api/v22/managed-environment/release",
    body: {
      workspaceId,
      resourceBindingId,
      stopBilling: true,
      idempotencyKey: `local-product-e2e-release-${payload.runId}`,
    },
  });
  mark(payload, "release-runtime", result);
  if (!result.ok) return failAt(payload, "release-runtime", result);
  completeEvidence(payload, "release_runtime_stop_billing", {
    billingStopped: result.payload?.billingStopped,
    auditEventId: result.payload?.auditEvent?.id || "",
    auditEventKind: result.payload?.auditEvent?.kind || "",
    status: result.payload?.status || "",
    runtimeStopped: result.payload?.receipts?.runtimeStopped || "",
    billingSettlement: result.payload?.receipts?.billingSettlement || "",
    storageDestroyReceipt: result.payload?.receipts?.storageDestroyReceipt || "",
  });

  result = await requestJson({
    ...common,
    stepId: "destroy-storage",
    method: "POST",
    path: "/api/v22/storage/destroy",
    body: {
      workspaceId,
      resourceBindingId,
      storageBindingId,
      idempotencyKey: `local-product-e2e-destroy-${payload.runId}`,
    },
  });
  mark(payload, "destroy-storage", result);
  if (!result.ok) return failAt(payload, "destroy-storage", result);
  completeEvidence(payload, "storage_destroy_intent", {
    storageDestroyed: result.payload?.storageDestroyed,
    storageState: result.payload?.storageState || "",
    auditEventId: result.payload?.auditEvent?.id || "",
    auditEventKind: result.payload?.auditEvent?.kind || "",
    storageDestroyReceipt: result.payload?.releaseReceipts?.storageDestroyReceipt || "",
    billingSettlement: result.payload?.releaseReceipts?.billingSettlement || "",
  });

  completeSingleFlowEvidence(payload);
  payload.completion = {
    status: "local_product_e2e_passed",
    receiptLevel: "local_rc",
  };
  return payload;
}

function failAt(payload, step, result) {
  return failWithBlocker(payload, {
    type: "local_product_e2e_step_failed",
    step,
    detail: result.error || `http_${result.httpStatus}`,
  });
}

function writeEvidence(payload) {
  const dir = runtimePath(payload.runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "report.json"), `${JSON.stringify(payload, null, 2)}\n`);
}

function renderHuman(payload) {
  const lines = [
    `local product e2e: ${payload.ok ? "ok" : "blocked"}`,
    `mode: ${payload.executionMode}`,
    `baseUrl: ${payload.baseUrl}`,
  ];
  for (const step of payload.steps) lines.push(`- ${step.id}: ${step.status}`);
  if (payload.blocker) lines.push(`blocker: ${payload.blocker.type}:${payload.blocker.step || ""}`);
  return `${lines.join("\n")}\n`;
}

const options = parseArgs(process.argv.slice(2));
const runId = `local-product-e2e-${Date.now()}`;
const payload = basePayload(options, runId);

try {
  if (payload.executesRequests) await executeFlow(payload, options);
  writeEvidence(payload);
  process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
  if (!payload.ok) process.exitCode = 1;
} catch (error) {
  failWithBlocker(payload, {
    type: "local_product_e2e_exception",
    detail: String(error.message || error),
  });
  writeEvidence(payload);
  process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
  process.exitCode = 1;
}
