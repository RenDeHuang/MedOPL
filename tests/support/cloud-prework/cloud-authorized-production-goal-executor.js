import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import readonlyExecutor from "./cloud-authorized-readonly-executor.js";

const OPERATION_SCRIPTS = Object.freeze({
  readonly_inventory: "cloud:goal:readonly-inventory",
  dry_run_plan: "cloud:goal:dry-run-plan",
  tenant_runtime_provisioning: "cloud:goal:tenant-runtime-provisioning",
  storage_lifecycle: "cloud:goal:storage-lifecycle",
  billing_audit_writeback: "cloud:goal:billing-audit-writeback",
  build_push: "cloud:goal:build-push",
  kubectl: "cloud:goal:kubectl",
  deploy: "cloud:goal:deploy",
  live_test: "cloud:goal:live-test",
});

const OPERATION_REQUIRED_ENV = Object.freeze({
  tenant_runtime_provisioning: Object.freeze([
    "V22_TENCENT_MUTATION_SECRET_FILE",
    "V22_TENCENT_RUNTIME_PLAN_FILE",
  ]),
  storage_lifecycle: Object.freeze([
    "V22_TENCENT_MUTATION_SECRET_FILE",
    "V22_TENCENT_STORAGE_PLAN_FILE",
  ]),
  billing_audit_writeback: Object.freeze([
    "V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE",
    "DATABASE_URL",
  ]),
  build_push: Object.freeze([
    "V22_CONTAINER_BUILD_CONTEXT",
    "V22_CONTAINER_IMAGE_REF",
    "TCR_ID",
    "TCR_SECRET",
  ]),
  kubectl: Object.freeze([
    "TENCENT_DEPLOY_KUBECONFIG_REF",
    "V22_KUBERNETES_MANIFEST_DIR",
  ]),
  deploy: Object.freeze([
    "TENCENT_DEPLOY_KUBECONFIG_REF",
    "V22_MEDOPL_DEPLOY_PLAN_FILE",
  ]),
  live_test: Object.freeze([
    "V22_OPL_WEBUI_CONSUMER_CANARY_URL",
    "V22_MEDOPL_PUBLIC_BASE_URL",
  ]),
});

const OPERATION_EXTERNAL_RUNNER_ENV = Object.freeze({
  tenant_runtime_provisioning: "V22_TENCENT_RUNTIME_PROVISIONING_RUNNER",
  storage_lifecycle: "V22_TENCENT_STORAGE_LIFECYCLE_RUNNER",
  billing_audit_writeback: "V22_MEDOPL_BILLING_AUDIT_WRITEBACK_RUNNER",
  build_push: "V22_CONTAINER_BUILD_PUSH_RUNNER",
  kubectl: "V22_KUBERNETES_APPLY_RUNNER",
  deploy: "V22_MEDOPL_DEPLOY_RUNNER",
  live_test: "V22_OPL_WEBUI_CONSUMER_CANARY_RUNNER",
});

function expectedCommand(operationClass = "") {
  const script = OPERATION_SCRIPTS[operationClass];
  return script ? `npm run ${script}` : "";
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeSummary(value = {}) {
  const json = JSON.stringify(value || {});
  const envSecrets = [
    "V22_TENCENT_MUTATION_SECRET_FILE",
    "TENCENT_MUTATION_SECRET_ID",
    "TENCENT_MUTATION_SECRET_KEY",
    "DATABASE_URL",
    "TCR_ID",
    "TCR_SECRET",
    "TENCENT_DEPLOY_KUBECONFIG_REF",
  ]
    .map((key) => String(process.env[key] || "").trim())
    .filter((item) => item.length >= 4);
  let redacted = json
    .replace(/SecretId/gu, "SecretRef")
    .replace(/SecretKey/gu, "SecretRef")
    .replace(/token/giu, "redacted_token_ref")
    .replace(/kubeconfig/giu, "kubeconfig_ref")
    .replace(/DATABASE_URL/gu, "DATABASE_URL_REF")
    .replace(/rawResponse/gu, "redacted_raw_response")
    .replace(/provider_response/gu, "provider_summary");
  for (const secret of envSecrets) {
    redacted = redacted.split(secret).join("redacted_secret_ref");
  }
  return JSON.parse(redacted);
}

function commandMustMatch(command, operationClass) {
  const expected = expectedCommand(operationClass);
  if (!expected || command !== expected) {
    return {
      command,
      ok: false,
      status: 64,
      summary: {
        blocker: "production_goal_command_mismatch",
        operationClass,
        expectedCommand: expected,
      },
    };
  }
  return null;
}

function runNode(repoRoot, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: process.env,
  });
  let parsed = {};
  try {
    parsed = JSON.parse(result.stdout || "{}");
  } catch {
    parsed = {};
  }
  return { result, parsed };
}

function reportDir(context = {}) {
  return path.dirname(path.join(context.repoRoot || process.cwd(), context.evidenceRef || ".runtime/v22-cloud-authorization/run-v22-001/dry_run_plan.json"));
}

function runDryRunPlan(command, context = {}) {
  const repoRoot = context.repoRoot || process.cwd();
  const outputDir = reportDir(context);
  const createReleaseOperation = `${context.authorization?.runId || "run-v22"}-create-release`;
  const bootstrapOperation = `${context.authorization?.runId || "run-v22"}-bootstrap`;
  const createRelease = runNode(repoRoot, [
    "tests/support/cloud-prework/v22-tencent-create-release-dry-run-plan.js",
    "--dry-run",
    "--confirm-no-real-cloud",
    "--report-dir",
    outputDir,
    "--operation-id",
    createReleaseOperation,
    "--account-id",
    "acct-production-goal",
    "--workspace-id",
    "workspace-production-goal",
    "--resource-binding-id",
    "resource-binding-production-goal",
    "--billing-attribution-id",
    "billing-attribution-production-goal",
    "--server-plan-id",
    "starter",
    "--region",
    "na-siliconvalley",
  ]);
  if (createRelease.result.status !== 0 || createRelease.parsed.ok !== true) {
    return {
      command,
      ok: false,
      status: createRelease.result.status ?? 1,
      summary: sanitizeSummary({
        blocker: "production_goal_create_release_dry_run_failed",
      }),
    };
  }

  const bootstrap = runNode(repoRoot, [
    "tests/support/cloud-prework/v22-tke-bootstrap-preflight-plan.js",
    "--dry-run",
    "--confirm-no-real-cloud",
    "--report-dir",
    outputDir,
    "--operation-id",
    bootstrapOperation,
    "--region",
    "na-siliconvalley",
    "--vpc-id",
    "vpc-production-goal-placeholder",
    "--platform-node-pool-name",
    "medopl-platform-services",
    "--tenant-node-pool-name-prefix",
    "medopl-tenant-",
  ]);
  if (bootstrap.result.status !== 0 || bootstrap.parsed.ok !== true) {
    return {
      command,
      ok: false,
      status: bootstrap.result.status ?? 1,
      summary: sanitizeSummary({
        blocker: "production_goal_tke_bootstrap_preflight_failed",
      }),
    };
  }

  return {
    command,
    ok: true,
    status: 0,
    summary: sanitizeSummary({
      operationClass: context.operationClass,
      runnerId: context.runnerId,
      realCloudCalls: false,
      mutationExecuted: false,
      reportPaths: [
        createRelease.parsed.reportPath,
        bootstrap.parsed.reportPath,
      ],
      cannotClaim: [
        "runtime provisioned",
        "storage provisioned",
        "production deployed",
      ],
    }),
  };
}

function failClosedMissingEnv(command, context = {}) {
  const requiredEnv = OPERATION_REQUIRED_ENV[context.operationClass] || [];
  const missing = requiredEnv.filter((key) => !String(process.env[key] || "").trim());
  if (missing.length === 0) {
    return {
      command,
      ok: true,
      status: 0,
      summary: sanitizeSummary({
        operationClass: context.operationClass,
        runnerId: context.runnerId,
        requiredEnvSatisfied: true,
        receiptTypes: context.receiptTypes || [],
      }),
    };
  }
  return {
    command,
    ok: false,
    status: 65,
    summary: sanitizeSummary({
      blocker: "production_goal_required_env_missing",
      operationClass: context.operationClass,
      runnerId: context.runnerId,
      missingEnv: missing,
      receiptTypes: context.receiptTypes || [],
      writesReceipt: false,
      productionComplete: false,
    }),
  };
}

function failClosedExternalRunner(command, context = {}) {
  const runnerEnvKey = OPERATION_EXTERNAL_RUNNER_ENV[context.operationClass] || "";
  const runnerPath = String(process.env[runnerEnvKey] || "").trim();
  if (!runnerEnvKey || !runnerPath) {
    return {
      command,
      ok: false,
      status: 66,
      summary: sanitizeSummary({
        blocker: "production_goal_live_runner_missing",
        operationClass: context.operationClass,
        runnerId: context.runnerId,
        requiredRunnerEnv: runnerEnvKey,
        requiredEnvSatisfied: true,
        receiptTypes: context.receiptTypes || [],
        productionComplete: false,
      }),
    };
  }
  const repoRoot = context.repoRoot || process.cwd();
  const resolvedPath = path.isAbsolute(runnerPath) ? runnerPath : path.join(repoRoot, runnerPath);
  if (!existsSync(resolvedPath)) {
    return {
      command,
      ok: false,
      status: 66,
      summary: sanitizeSummary({
        blocker: "production_goal_live_runner_file_missing",
        operationClass: context.operationClass,
        runnerId: context.runnerId,
        requiredRunnerEnv: runnerEnvKey,
        productionComplete: false,
      }),
    };
  }
  return null;
}

function runExternalRunner(command, context = {}) {
  const runnerPath = String(process.env[OPERATION_EXTERNAL_RUNNER_ENV[context.operationClass]] || "").trim();
  const repoRoot = context.repoRoot || process.cwd();
  const resolvedPath = path.isAbsolute(runnerPath) ? runnerPath : path.join(repoRoot, runnerPath);
  const receiptTypes = Array.isArray(context.receiptTypes) ? context.receiptTypes.map(String) : [];
  const result = spawnSync(process.execPath, [resolvedPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      V22_GOAL_COMMAND: command,
      V22_GOAL_OPERATION_CLASS: String(context.operationClass || ""),
      V22_GOAL_RUNNER_ID: String(context.runnerId || ""),
      V22_GOAL_RECEIPT_TYPES: JSON.stringify(receiptTypes),
      V22_GOAL_EVIDENCE_REF: String(context.evidenceRef || ""),
      V22_GOAL_AUTHORIZATION: JSON.stringify(context.authorization || {}),
    },
  });
  let parsed = {};
  try {
    parsed = JSON.parse(result.stdout || "{}");
  } catch {
    parsed = {};
  }
  if (result.status !== 0 || parsed.ok !== true) {
    return {
      command,
      ok: false,
      status: result.status ?? 1,
      summary: sanitizeSummary({
        blocker: "production_goal_external_runner_failed",
        operationClass: context.operationClass,
        runnerId: context.runnerId,
        exitStatus: result.status ?? 1,
      }),
    };
  }
  const receipts = Array.isArray(parsed.receipts) ? parsed.receipts : [];
  const receiptWrites = [];
  for (const receipt of receipts) {
    if (!isObject(receipt) || !receiptTypes.includes(String(receipt.type || ""))) {
      return {
        command,
        ok: false,
        status: 67,
        summary: sanitizeSummary({
          blocker: "production_goal_external_runner_receipt_not_allowed",
          operationClass: context.operationClass,
          runnerId: context.runnerId,
          receiptType: receipt?.type || "",
        }),
      };
    }
    const pointer = context.writeReceipt(receipt.type, {
      owner: receipt.owner,
      status: receipt.status,
      issued_at: receipt.issued_at,
      summary: receipt.summary,
      authorization_ref: receipt.authorization_ref,
      operationClass: context.operationClass,
      runnerId: context.runnerId,
    });
    receiptWrites.push(pointer.type);
  }
  const missingReceipts = receiptTypes.filter((type) => !receiptWrites.includes(type));
  if (missingReceipts.length > 0) {
    return {
      command,
      ok: false,
      status: 68,
      summary: sanitizeSummary({
        blocker: "production_goal_external_runner_missing_required_receipts",
        operationClass: context.operationClass,
        runnerId: context.runnerId,
        missingReceipts,
      }),
    };
  }
  return {
    command,
    ok: true,
    status: 0,
    summary: sanitizeSummary({
      ...(isObject(parsed.summary) ? parsed.summary : {}),
      operationClass: context.operationClass,
      runnerId: context.runnerId,
      externalRunner: true,
      receiptsWritten: receiptWrites,
      evidenceRef: context.evidenceRef || "",
      productionComplete: false,
    }),
  };
}

export default async function runCommand(command, context = {}) {
  const mismatch = commandMustMatch(command, context.operationClass);
  if (mismatch) return mismatch;

  if (context.operationClass === "readonly_inventory") {
    return readonlyExecutor(command, context);
  }
  if (context.operationClass === "dry_run_plan") {
    return runDryRunPlan(command, context);
  }
  const envBlocker = failClosedMissingEnv(command, context);
  if (!envBlocker.ok) return envBlocker;
  const runnerBlocker = failClosedExternalRunner(command, context);
  if (runnerBlocker) return runnerBlocker;
  return runExternalRunner(command, context);
}
