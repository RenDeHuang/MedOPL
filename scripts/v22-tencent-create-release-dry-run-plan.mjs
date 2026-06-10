#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const FORBIDDEN_ARGS = new Set([
  "--secret-file",
  "--live",
  "--execute",
  "--apply",
  "--mutate",
  "--deploy",
  "--kubectl",
  "--build",
  "--push",
]);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    dryRun: false,
    confirmNoRealCloud: false,
    reportDir: path.join(".runtime", "v22-cloud-lifecycle"),
    operationId: "",
    accountId: "",
    workspaceId: "",
    resourceBindingId: "",
    billingAttributionId: "",
    serverPlanId: "",
    region: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (FORBIDDEN_ARGS.has(arg)) throw new Error(`package_c_dry_run_forbidden_arg:${arg}`);
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--confirm-no-real-cloud") {
      options.confirmNoRealCloud = true;
    } else if (arg === "--report-dir") {
      options.reportDir = argv[++index] || "";
    } else if (arg === "--operation-id") {
      options.operationId = argv[++index] || "";
    } else if (arg === "--account-id") {
      options.accountId = argv[++index] || "";
    } else if (arg === "--workspace-id") {
      options.workspaceId = argv[++index] || "";
    } else if (arg === "--resource-binding-id") {
      options.resourceBindingId = argv[++index] || "";
    } else if (arg === "--billing-attribution-id") {
      options.billingAttributionId = argv[++index] || "";
    } else if (arg === "--server-plan-id") {
      options.serverPlanId = argv[++index] || "";
    } else if (arg === "--region") {
      options.region = argv[++index] || "";
    } else {
      throw new Error(`package_c_dry_run_unknown_arg:${arg}`);
    }
  }
  return options;
}

function requireValue(options, key) {
  if (!String(options[key] || "").trim()) throw new Error(`package_c_dry_run_missing:${key}`);
}

function validate(options) {
  if (!options.dryRun || !options.confirmNoRealCloud) {
    throw new Error("package_c_dry_run_authorization_required");
  }
  for (const key of [
    "reportDir",
    "operationId",
    "accountId",
    "workspaceId",
    "resourceBindingId",
    "billingAttributionId",
    "serverPlanId",
    "region",
  ]) {
    requireValue(options, key);
  }
}

function planFor(options) {
  return {
    ok: true,
    package: "C",
    planMode: "dry_run",
    operationId: options.operationId,
    accountId: options.accountId,
    workspaceId: options.workspaceId,
    resourceBindingId: options.resourceBindingId,
    billingAttributionId: options.billingAttributionId,
    serverPlanId: options.serverPlanId,
    region: options.region,
    boundary: {
      realCloudCalls: false,
      mutationExecuted: false,
      readsMutationSecret: false,
      writesLedger: false,
      callsKubectl: false,
      buildsOrPushesImage: false,
      chargeApplied: false,
    },
    storagePlan: {
      resourceType: "workspace_file_space",
      action: "plan_create_or_expand",
      fileSpaceGb: options.serverPlanId === "pro" ? 100 : 10,
      storageScope: "workspace_managed_object_storage",
      retentionPolicy: {
        deleteProtectionDays: 7,
        computeReleaseDeletesFileSpace: false,
      },
    },
    computePlan: {
      resourceType: "workspace_compute_allocation",
      action: "plan_create_or_expand",
      clusterModel: "shared_cluster_layered_isolation",
      standardPlanUsesSharedPool: true,
      premiumDedicatedPoolSupported: true,
      kubernetesControls: [
        "namespace",
        "rbac",
        "resourcequota",
        "limitrange",
        "networkpolicy",
        "pod_security",
        "admission_policy",
      ],
      computeShape: options.serverPlanId === "pro"
        ? { cpuCores: 8, memoryGb: 16, taskConcurrency: 5 }
        : { cpuCores: 2, memoryGb: 4, taskConcurrency: 2 },
    },
    billingPlan: {
      chargeApplied: false,
      freezeOnly: true,
      reconciliation: "t_plus_1",
      stopBillingConfirmWithinMinutes: 120,
    },
    safetyChecks: [
      { check: "dry_run_only", status: "pass" },
      { check: "no_real_cloud", status: "pass" },
      { check: "no_mutation_secret", status: "pass" },
      { check: "no_ledger_write", status: "pass" },
      { check: "no_object_body_read", status: "pass" },
      { check: "ordinary_user_language_only", status: "pass" },
    ],
  };
}

async function main() {
  const options = parseArgs();
  validate(options);
  const report = planFor(options);
  await mkdir(options.reportDir, { recursive: true });
  const reportPath = path.join(options.reportDir, `${options.operationId}-dry-run.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    package: "C",
    planMode: "dry_run",
    operationId: options.operationId,
    reportPath,
    realCloudCalls: false,
    mutationExecuted: false,
    readsMutationSecret: false,
    callsKubectl: false,
    buildsOrPushesImage: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(String(error?.message || "package_c_dry_run_failed"));
  process.exitCode = 1;
});
