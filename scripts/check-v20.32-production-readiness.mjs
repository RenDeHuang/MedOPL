import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sensitivePattern = /cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token/i;
const tagKeys = ["resourceorderid", "runid", "serverplanid", "tenantid", "workspaceid"];
const requiredFullLoopStages = [
  "admin_user_create",
  "wallet_topup",
  "portal_login",
  "storage_order",
  "workspace_upload",
  "resource_quote",
  "resource_freeze",
  "resource_provision",
  "user_resources",
  "opl_message",
  "opl_file_run",
  "workspace_download",
  "billing_trace",
  "delete_node_pool",
  "post_delete_resource_binding",
  "billing_stop_observe",
  "t0_120min_checkpoint",
];

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function sanitizeText(value = "") {
  return String(value || "")
    .replace(/\b(cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token)\b[^,\n]*/gi, "$1=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[redacted]");
}

function sanitizeEvidence(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeEvidence(item));
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? sanitizeText(value) : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    sensitivePattern.test(key) ? "[redacted]" : sanitizeEvidence(item),
  ]));
}

async function getJson(url) {
  const response = await fetch(url, { redirect: "manual" });
  const bodyText = await response.text();
  let json = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {}
  return {
    ok: response.status >= 200 && response.status < 500,
    status: response.status,
    json,
    bodyText: sanitizeText(bodyText).slice(0, 300),
  };
}

function stageMap(evidence) {
  return new Map((Array.isArray(evidence?.stages) ? evidence.stages : []).map((stage) => [stage.stage, stage]));
}

function requireStage(stages, name) {
  const stage = stages.get(name);
  assert(stage, `full_loop_stage_missing:${name}`);
  return stage;
}

function requireStageTiming(stage, name) {
  assert(String(stage.startedAt || "").trim(), `stage_startedAt_missing:${name}`);
  assert(String(stage.endedAt || "").trim(), `stage_endedAt_missing:${name}`);
  assert(Number(stage.latencyMs) >= 0, `stage_latencyMs_missing:${name}`);
  assert.equal(stage.ok !== false, true, `stage_must_be_ok:${name}`);
}

export function validateFullLoopEvidence(payload, expectedBuildTag = "opl-v20.32") {
  const evidence = payload?.evidence || payload;
  assert.equal(payload?.ok, true, "full_loop_evidence_must_be_ok");
  assert.equal(evidence?.status, "done", "full_loop_evidence_status_must_be_done");
  const stages = stageMap(evidence);
  for (const stage of requiredFullLoopStages) {
    requireStageTiming(requireStage(stages, stage), stage);
  }

  const resourceStage = requireStage(stages, "user_resources");
  for (const key of tagKeys) {
    assert(String(resourceStage?.billingTags?.[key] || "").trim(), `billing_tag_missing:${key}`);
  }
  assert(String(resourceStage.resourceOrderId || "").trim(), "resource_order_id_missing");
  assert(Number(resourceStage.cvmCount || 0) >= 0, "cvm_count_must_be_numeric");

  const messageStage = requireStage(stages, "opl_message");
  assert(Number(messageStage.firstReplyLatencyMs || messageStage.latencyMs || 0) > 0, "opl_first_reply_latency_missing");
  assert(Number(messageStage.completeReplyLatencyMs || messageStage.latencyMs || 0) >= Number(messageStage.firstReplyLatencyMs || messageStage.latencyMs || 0), "opl_complete_reply_latency_invalid");

  const fileRunStage = requireStage(stages, "opl_file_run");
  assert(Number(fileRunStage.artifactCount || 0) > 0, "artifactCount_missing");

  const downloadStage = requireStage(stages, "workspace_download");
  assert(Number(downloadStage.sizeBytes || 0) > 0, "download_sizeBytes_missing");

  const traceStage = requireStage(stages, "billing_trace");
  assert(Number(traceStage.traceCount || 0) > 0, "traceCount_missing");

  const postDeleteStage = requireStage(stages, "post_delete_resource_binding");
  assert(String(postDeleteStage.storageBillingStoppedAt || "").trim(), "storageBillingStoppedAt_missing");
  assert(String(postDeleteStage.retentionCleanupAfterAt || "").trim(), "retentionCleanupAfterAt_missing");

  const t0Stage = requireStage(stages, "t0_120min_checkpoint");
  assert(Number(t0Stage.expected120minMinutes || 0) === 120, "t0_120min_checkpoint_must_be_120");

  return {
    ok: true,
    expectedBuildTag,
    fixture: evidence.fixture || {},
    stageCount: evidence.stages.length,
    resourceOrderId: resourceStage.resourceOrderId,
    t_plus_1_cos_exact_attribution_deferred: true,
    note: "T+1 COS exact attribution deferred",
  };
}

async function checkPortalBuildTag(expectedBuildTag) {
  const portal = await getJson("https://portal.medopl.cn/healthz");
  const buildTag = String(portal?.json?.build?.sha || portal?.json?.buildTag || portal?.json?.version || "").trim();
  return {
    ok: portal.ok && portal.status < 500 && buildTag === expectedBuildTag,
    host: "portal.medopl.cn",
    path: "/healthz",
    status: portal.status,
    buildTag,
    expectedBuildTag,
  };
}

export async function checkProductionHosts(expectedBuildTag = "opl-v20.32") {
  const portal = await checkPortalBuildTag(expectedBuildTag);
  const opl = await getJson("https://opl.medopl.cn/healthz").catch((error) => ({
    ok: false,
    host: "opl.medopl.cn",
    path: "/healthz",
    error: sanitizeText(error instanceof Error ? error.message : String(error)),
  }));
  const trace = await getJson("https://trace.medopl.cn/api/public/health").catch((error) => ({
    ok: false,
    host: "trace.medopl.cn",
    path: "/api/public/health",
    error: sanitizeText(error instanceof Error ? error.message : String(error)),
  }));
  return {
    ok: portal.ok && (opl.ok || Number(opl.status || 0) < 500) && (trace.ok || Number(trace.status || 0) < 500),
    portal,
    opl: { ...opl, host: "opl.medopl.cn", path: "/healthz" },
    trace: { ...trace, host: "trace.medopl.cn", path: "/api/public/health" },
  };
}

if (env("RUN_V20_32_PRODUCTION_READINESS") !== "1") {
  console.log(JSON.stringify({
    ok: true,
    status: "skip",
    reason: "RUN_V20_32_PRODUCTION_READINESS_not_enabled",
    requiredEnv: [
      "RUN_V20_32_PRODUCTION_READINESS",
      "V20_32_FULL_LOOP_EVIDENCE_FILE",
      "V20_32_PRODUCTION_HOSTS_CONFIRMED",
      "V20_32_ROLLBACK_PLAN_CONFIRMED",
      "V20_32_EXPECTED_BUILD_TAG",
    ],
  }, null, 2));
  process.exit(0);
}

try {
  assert.equal(boolEnv("V20_32_PRODUCTION_HOSTS_CONFIRMED"), true, "V20_32_PRODUCTION_HOSTS_CONFIRMED_must_be_true");
  assert.equal(boolEnv("V20_32_ROLLBACK_PLAN_CONFIRMED"), true, "V20_32_ROLLBACK_PLAN_CONFIRMED_must_be_true");
  const expectedBuildTag = env("V20_32_EXPECTED_BUILD_TAG", "opl-v20.32");
  const evidenceFile = env("V20_32_FULL_LOOP_EVIDENCE_FILE");
  assert(evidenceFile, "V20_32_FULL_LOOP_EVIDENCE_FILE_required");
  const fullLoopPayload = JSON.parse(await readFile(evidenceFile, "utf8"));
  const fullLoop = validateFullLoopEvidence(fullLoopPayload, expectedBuildTag);
  const hosts = await checkProductionHosts(expectedBuildTag);
  const payload = {
    ok: fullLoop.ok && hosts.ok,
    status: fullLoop.ok && hosts.ok ? "ready" : "failed",
    contract: "v20.32_production_readiness",
    exactAttribution: "T+1 COS exact attribution deferred",
    t_plus_1_cos_exact_attribution_deferred: true,
    fullLoop,
    hosts,
  };
  console.log(JSON.stringify(sanitizeEvidence(payload), null, 2));
  if (!payload.ok) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify(sanitizeEvidence({
    ok: false,
    status: "failed",
    contract: "v20.32_production_readiness",
    exactAttribution: "T+1 COS exact attribution deferred",
    t_plus_1_cos_exact_attribution_deferred: true,
    error: error instanceof Error ? error.message : String(error),
  }), null, 2));
  process.exitCode = 1;
}
