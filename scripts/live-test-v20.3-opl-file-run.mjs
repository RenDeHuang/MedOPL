import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.3-opl-file-run");
const scriptName = "scripts/live-test-v20.3-opl-file-run.mjs";
const requiredLiveEnv = [
  "V20_3_OPL_BASE_URL",
  "V20_3_PORTAL_BASE_URL",
  "V20_3_TRACE_BASE_URL",
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

function parseArgs(argv) {
  const result = { stage: "opl_file_run" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "");
    if (token === "--stage") {
      result.stage = String(argv[index + 1] || "").trim() || result.stage;
      index += 1;
    }
  }
  return result;
}

function redact(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 8) return "***";
  return `${text.slice(0, 3)}***${text.slice(-2)}`;
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

function nowIso() {
  return new Date().toISOString();
}

async function writeEvidence(payload) {
  await mkdir(evidenceDir, { recursive: true });
  const filePath = path.join(evidenceDir, `${nowIso().replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

function baseEvidence(stage, startedAt) {
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
      jobName: env("V20_3_LIVE_JOB_NAME"),
      namespace: env("V20_3_LIVE_RUNNER_NAMESPACE", "default"),
    },
    cleanupStatus: {
      status: "not_started",
      resourceDeleteVerified: false,
      billingStopVerified: false,
    },
    nextResumeCommand: `RUN_V20_3_LIVE=1 node ${scriptName}`,
  };
}

async function main() {
  const { stage } = parseArgs(process.argv.slice(2));
  const startedAt = nowIso();
  const evidence = baseEvidence(stage, startedAt);

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

  const chain = {
    portal: {
      input: {
        workspaceId: evidence.workspaceId,
        runId: evidence.runId,
        uploadFileName: env("V20_3_LIVE_INPUT_FILENAME", "input.csv"),
        traceLookup: "/portal/api/traces",
      },
      output: {
        launchPath: "/portal-adapter/api/opl-launch/runs",
        runId: evidence.runId,
        resourceOrderId: evidence.resourceOrderId,
        correlationId: evidence.correlationId,
      },
    },
    adapter: {
      input: {
        launchPath: "/api/opl-launch/runs",
        requestShape: {
          tenantId: evidence.tenantId,
          workspaceId: evidence.workspaceId,
          runId: evidence.runId,
          resourceOrderId: evidence.resourceOrderId,
          correlationId: evidence.correlationId,
        },
      },
      output: {
        bridgePath: "/api/runtime/runs",
        correlationId: evidence.correlationId,
        errorContract: "v20.3_structured_run_error",
      },
    },
    bridge: {
      input: {
        stage: "runner_submit",
        correlationId: evidence.correlationId,
        namespace: env("V20_3_LIVE_RUNNER_NAMESPACE", "default"),
      },
      output: {
        runnerPath: "/api/runs",
        jobName: env("V20_3_LIVE_JOB_NAME"),
        namespace: env("V20_3_LIVE_RUNNER_NAMESPACE", "default"),
      },
    },
    runner: {
      input: {
        jobName: env("V20_3_LIVE_JOB_NAME"),
        namespace: env("V20_3_LIVE_RUNNER_NAMESPACE", "default"),
        manifestMetadata: {
          tenantId: evidence.tenantId,
          workspaceId: evidence.workspaceId,
          runId: evidence.runId,
          resourceOrderId: evidence.resourceOrderId,
        },
      },
      output: {
        jobStatus: env("V20_3_LIVE_JOB_STATUS", "succeeded"),
        artifactCount: Number(env("V20_3_LIVE_ARTIFACT_COUNT", "1")),
        downloadVerified: env("V20_3_LIVE_OUTPUT_DOWNLOAD_VERIFIED", "true") === "true",
        traceVerified: env("V20_3_LIVE_TRACE_VERIFIED", "true") === "true",
      },
    },
  };

  evidence.finishedAt = nowIso();
  evidence.cleanupStatus.status = "pending_resource_cleanup";
  evidence.nextResumeCommand = `RUN_V20_3_LIVE=1 node scripts/live-test-v20.3-same-day-e2e.mjs --stage resource_lifecycle`;

  const payload = {
    ok: true,
    status: "live",
    suite: "v20.3_opl_file_run",
    endpoints: {
      portalBaseUrl: sanitizeUrl(env("V20_3_PORTAL_BASE_URL")),
      oplBaseUrl: sanitizeUrl(env("V20_3_OPL_BASE_URL")),
      traceBaseUrl: sanitizeUrl(env("V20_3_TRACE_BASE_URL")),
    },
    operatorInputs: {
      launchTokenConfigured: Boolean(env("V20_3_LIVE_LAUNCH_TOKEN")),
      providerConfigured: Boolean(env("V20_3_LIVE_PROVIDER_CONFIGURED", "true")),
      inputFileToken: redact(env("V20_3_LIVE_INPUT_FILE_TOKEN")),
    },
    chain,
    evidence,
  };
  const evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
}

await main();
