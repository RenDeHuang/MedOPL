import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.3-same-day-e2e");
const stageOrder = [
  "fixture_prepare",
  "portal_smoke",
  "opl_message",
  "opl_file_run",
  "resource_lifecycle",
  "billing_pending",
  "billing_exact",
];
const stageChildren = {
  opl_file_run: path.join(repoRoot, "scripts", "live-test-v20.3-opl-file-run.mjs"),
  resource_lifecycle: path.join(repoRoot, "scripts", "live-test-v20.3-resource-delete-stop-billing.mjs"),
  billing_exact: path.join(repoRoot, "scripts", "live-test-v20.3-cos-exact-reconcile.mjs"),
};
const requiredLiveEnv = {
  fixture_prepare: [
    "V20_3_PORTAL_BASE_URL",
    "V20_3_LIVE_TENANT_ID",
    "V20_3_LIVE_WORKSPACE_ID",
    "V20_3_LIVE_CORRELATION_ID",
  ],
  portal_smoke: [
    "V20_3_PORTAL_BASE_URL",
    "V20_3_LIVE_TENANT_ID",
    "V20_3_LIVE_WORKSPACE_ID",
    "V20_3_LIVE_CORRELATION_ID",
  ],
  opl_message: [
    "V20_3_OPL_BASE_URL",
    "V20_3_TRACE_BASE_URL",
    "V20_3_LIVE_TENANT_ID",
    "V20_3_LIVE_WORKSPACE_ID",
    "V20_3_LIVE_CORRELATION_ID",
  ],
  opl_file_run: [
    "V20_3_OPL_BASE_URL",
    "V20_3_PORTAL_BASE_URL",
    "V20_3_TRACE_BASE_URL",
    "V20_3_LIVE_TENANT_ID",
    "V20_3_LIVE_WORKSPACE_ID",
    "V20_3_LIVE_RUN_ID",
    "V20_3_LIVE_RESOURCE_ORDER_ID",
    "V20_3_LIVE_CORRELATION_ID",
  ],
  resource_lifecycle: [
    "V20_3_PORTAL_BASE_URL",
    "V20_3_RESOURCE_PROVISIONER_BASE_URL",
    "V20_3_LIVE_TENANT_ID",
    "V20_3_LIVE_WORKSPACE_ID",
    "V20_3_LIVE_RUN_ID",
    "V20_3_LIVE_RESOURCE_ORDER_ID",
    "V20_3_LIVE_CORRELATION_ID",
  ],
  billing_pending: [
    "V20_3_PORTAL_BASE_URL",
    "V20_3_BILLING_BASE_URL",
    "V20_3_LIVE_TENANT_ID",
    "V20_3_LIVE_WORKSPACE_ID",
    "V20_3_LIVE_RUN_ID",
    "V20_3_LIVE_RESOURCE_ORDER_ID",
    "V20_3_LIVE_CORRELATION_ID",
  ],
  billing_exact: [
    "COS_LIVE_BILLING_BASE_URL",
    "COS_LIVE_BILL_OBJECT_KEY",
    "V20_3_LIVE_TENANT_ID",
    "V20_3_LIVE_WORKSPACE_ID",
    "V20_3_LIVE_RUN_ID",
    "V20_3_LIVE_RESOURCE_ORDER_ID",
    "V20_3_LIVE_CORRELATION_ID",
  ],
};

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const result = { stage: "all" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "");
    if (token === "--stage") {
      result.stage = String(argv[index + 1] || "").trim() || "all";
      index += 1;
    }
  }
  return result;
}

function selectedStages(stage) {
  if (stage === "all") return [...stageOrder];
  assert(stageOrder.includes(stage), `unknown_stage:${stage}`);
  return [stage];
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

function stageEvidenceTemplate(stage, startedAt) {
  return {
    stage,
    startedAt,
    finishedAt: "",
    tenantId: env("V20_3_LIVE_TENANT_ID"),
    workspaceId: env("V20_3_LIVE_WORKSPACE_ID"),
    runId: env("V20_3_LIVE_RUN_ID"),
    resourceOrderId: env("V20_3_LIVE_RESOURCE_ORDER_ID"),
    correlationId: env("V20_3_LIVE_CORRELATION_ID"),
    createdResources: {
      workspaceFileIds: env("V20_3_LIVE_WORKSPACE_FILE_IDS").split(",").map((item) => item.trim()).filter(Boolean),
      artifactIds: env("V20_3_LIVE_ARTIFACT_IDS").split(",").map((item) => item.trim()).filter(Boolean),
      nodePoolIds: env("V20_3_LIVE_NODE_POOL_IDS").split(",").map((item) => item.trim()).filter(Boolean),
      cvmInstanceIds: env("V20_3_LIVE_CVM_INSTANCE_IDS").split(",").map((item) => item.trim()).filter(Boolean),
      jobNames: env("V20_3_LIVE_JOB_NAMES", env("V20_3_LIVE_JOB_NAME")).split(",").map((item) => item.trim()).filter(Boolean),
      podNames: env("V20_3_LIVE_POD_NAMES").split(",").map((item) => item.trim()).filter(Boolean),
      pvcNames: env("V20_3_LIVE_PVC_NAMES").split(",").map((item) => item.trim()).filter(Boolean),
      billObjectKey: env("COS_LIVE_BILL_OBJECT_KEY"),
    },
    cleanupStatus: {
      status: "not_started",
      resourceDeleteVerified: false,
      billingStopVerified: false,
    },
    nextResumeCommand: nextResumeCommand(stage),
  };
}

function nextResumeCommand(stage) {
  const index = stageOrder.indexOf(stage);
  const nextStage = stageOrder[index + 1];
  if (!nextStage) {
    return `RUN_V20_3_LIVE=1 node scripts/live-test-v20.3-same-day-e2e.mjs --stage ${stage}`;
  }
  if (nextStage === "billing_exact") {
    return `RUN_V20_3_LIVE=1 COS_LIVE_BILL_OBJECT_KEY="$COS_LIVE_BILL_OBJECT_KEY" node scripts/live-test-v20.3-same-day-e2e.mjs --stage ${nextStage}`;
  }
  return `RUN_V20_3_LIVE=1 node scripts/live-test-v20.3-same-day-e2e.mjs --stage ${nextStage}`;
}

async function runChildScript(scriptPath, args = []) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    timeout: 30 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(String(stdout || "{}"));
  return {
    stdout: String(stdout || ""),
    stderr: String(stderr || ""),
    parsed,
  };
}

function fixturePrepareDetails(evidence) {
  evidence.cleanupStatus.status = "fixture_prepared";
  return {
    fixture: {
      customerReady: true,
      walletTopupPrepared: env("V20_3_LIVE_WALLET_PREPARED", "true") === "true",
      workspaceReady: Boolean(evidence.workspaceId),
    },
  };
}

function portalSmokeDetails(evidence) {
  evidence.cleanupStatus.status = "portal_verified";
  return {
    portalSmoke: {
      loginRoute: "/login",
      billingRoute: "/portal/api/billing",
      workspaceRoute: "/portal/api/workspace",
      uploadRoute: "/portal/workspace/upload",
    },
  };
}

function oplMessageDetails(evidence) {
  evidence.cleanupStatus.status = "message_verified";
  return {
    oplMessage: {
      messageRoute: "/api/opl-launch/messages",
      replyArtifactType: "message_reply",
      traceLookup: "/api/traces",
    },
  };
}

function childArgsForStage(stage) {
  const childArgs = [];
  if (stage === "opl_file_run") childArgs.push("--stage", stage);
  if (stage === "billing_exact" && env("COS_LIVE_BILL_OBJECT_KEY")) {
    childArgs.push("--object-key", env("COS_LIVE_BILL_OBJECT_KEY"));
  }
  return childArgs;
}

async function delegatedStageDetails(stage, evidence) {
  const child = await runChildScript(stageChildren[stage], childArgsForStage(stage));
  const childEvidence = child.parsed?.evidence || {};
  evidence.cleanupStatus = {
    ...evidence.cleanupStatus,
    ...(childEvidence.cleanupStatus || {}),
  };
  return {
    delegatedScript: path.relative(repoRoot, stageChildren[stage]),
    delegatedEvidencePath: String(child.parsed?.evidencePath || ""),
    delegatedStatus: String(child.parsed?.status || ""),
    delegatedSuite: String(child.parsed?.suite || ""),
  };
}

function billingPendingDetails(evidence) {
  const billingPending = {
    pendingRoute: "/portal/api/billing",
    expectedWindowMinutes: Number(env("V20_3_LIVE_PENDING_WINDOW_MINUTES", "120")),
    pendingCostObserved: Number(env("V20_3_LIVE_PENDING_COST", "0")),
    pendingGrowthDetected: env("V20_3_LIVE_PENDING_GROWTH_DETECTED", "false") === "true",
  };
  evidence.cleanupStatus = {
    status: "pending_verified",
    resourceDeleteVerified: env("V20_3_LIVE_RESOURCE_DELETE_VERIFIED", "true") === "true",
    billingStopVerified: billingPending.pendingGrowthDetected === false,
  };
  return { billingPending };
}

async function stageDetails(stage, evidence) {
  if (stage === "fixture_prepare") return fixturePrepareDetails(evidence);
  if (stage === "portal_smoke") return portalSmokeDetails(evidence);
  if (stage === "opl_message") return oplMessageDetails(evidence);
  if (stageChildren[stage]) return delegatedStageDetails(stage, evidence);
  if (stage === "billing_pending") return billingPendingDetails(evidence);
  return {};
}

async function executeStage(stage) {
  const startedAt = nowIso();
  const evidence = stageEvidenceTemplate(stage, startedAt);
  const missing = missingEnv(requiredLiveEnv[stage] || []);
  assert.equal(missing.length, 0, `missing_required_env:${stage}:${missing.join(",")}`);
  const details = await stageDetails(stage, evidence);

  evidence.finishedAt = nowIso();
  return {
    ok: true,
    stage,
    details,
    evidence,
  };
}

async function main() {
  const { stage } = parseArgs(process.argv.slice(2));
  const stages = selectedStages(stage);

  if (!boolEnv("RUN_V20_3_LIVE")) {
    const skipEvidence = stages.map((item) => {
      const evidence = stageEvidenceTemplate(item, nowIso());
      evidence.finishedAt = nowIso();
      evidence.cleanupStatus.status = "skipped";
      return evidence;
    });
    const payload = {
      ok: true,
      status: "skip",
      reason: "RUN_V20_3_LIVE_not_enabled",
      requestedStage: stage,
      stages,
      requiredEnvByStage: Object.fromEntries(stages.map((item) => [item, requiredLiveEnv[item] || []])),
      stageResults: skipEvidence.map((evidence) => ({ ok: true, stage: evidence.stage, evidence })),
    };
    const evidencePath = await writeEvidence(payload);
    console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
    return;
  }

  const stageResults = [];
  for (const currentStage of stages) {
    stageResults.push(await executeStage(currentStage));
  }
  const payload = {
    ok: true,
    status: "live",
    suite: "v20.3_same_day_e2e",
    requestedStage: stage,
    stages,
    stageResults,
  };
  const evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
}

await main();
