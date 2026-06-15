import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_RUN_SCOPED_JOB_COMMAND,
  buildPackageDRunScopedJobPlan,
  runPackageDRunScopedJobPreflight,
} from "../../support/cloud-prework/package-d-run-scoped-job-runner.js";

const kubeEnvName = ["KUBE", "CONFIG"].join("");
const runnerImageRef = "uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-fake";

function assertNoSensitiveText(text = "", label = "text") {
  for (const forbidden of [
    "tcr-secret-value",
    "portal-admin-password",
    "postgres-password",
    "postgresql://",
    "client-certificate-data",
    "client-key-data",
    "certificate-authority-data",
    "token:",
    "raw-kubeconfig",
    "kubectl apply",
    "kubectl patch",
    "kubectl scale",
    "docker build",
    "docker push",
    "CreateNodePool",
    "medopl-tenant-",
    runnerImageRef,
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

function fakeKubectlExecutor(commandLog) {
  return async ({ args, env, stdin }) => {
    let stdinImage = "";
    if (stdin) {
      const parsed = JSON.parse(stdin);
      stdinImage = parsed.spec.template.spec.containers[0].image;
    }
    commandLog.push({
      args,
      env: { kubeEnvPresent: env[kubeEnvName] ? "redacted" : "" },
      stdinClass: stdin ? "present_redacted" : "empty",
      stdinImage,
    });
    const joined = args.join(" ");
    assert.equal(args[0], "kubectl", "runner_must_use_kubectl_only");
    assert.equal(joined.includes(" apply "), false, "runner_must_not_apply");
    assert.equal(joined.includes(" patch "), false, "runner_must_not_patch");
    assert.equal(joined.includes(" scale "), false, "runner_must_not_scale");
    assert.equal(joined.includes(" rollout "), false, "runner_must_not_rollout");
    if (args.includes("delete")) {
      assert.deepEqual(args, [
        "kubectl",
        "delete",
        "job",
        "medopl-platform-runner-preflight-20260615a",
        "-n",
        "medopl-platform",
        "--wait=false",
      ], "runner_must_delete_only_the_unique_run_scoped_job");
    }
    if (args.includes("create")) {
      assert.equal(args[args.indexOf("-f") + 1], "-", "job_create_must_use_stdin_manifest");
      assert.notEqual(stdin, "", "job_create_must_receive_manifest_stdin");
      assert.equal(stdinImage, runnerImageRef, "job_create_live_manifest_must_use_real_runner_image_ref");
      assert.equal(stdinImage.startsWith("REDACTED_"), false, "job_create_live_manifest_must_not_use_redacted_image_ref");
    }
    if (args.includes("current-context")) return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
    if (args.includes("namespace")) {
      return { status: 0, stdout: JSON.stringify({ metadata: { name: "medopl-platform" }, status: { phase: "Active" } }), stderr: "" };
    }
    if (args.includes("wait")) return { status: 0, stdout: "job.batch/medopl-platform-runner-preflight-20260615a condition met\n", stderr: "" };
    if (args.includes("logs")) return { status: 0, stdout: "preflight completed\n", stderr: "" };
    if (args.includes("job") && args.includes("-o")) {
      return {
        status: 0,
        stdout: JSON.stringify({
          metadata: { name: "medopl-platform-runner-preflight-20260615a", namespace: "medopl-platform" },
          status: { succeeded: 1, conditions: [{ type: "Complete", status: "True" }] },
        }),
        stderr: "",
      };
    }
    return { status: 0, stdout: "ok\n", stderr: "" };
  };
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-run-scoped-job-"));
try {
  const deployEnvPath = path.join(tmp, "package-d-deploy.env");
  const runtimeEnvPath = path.join(tmp, "portal-runtime.env");
  const kubeconfigPath = path.join(tmp, "kubeconfig-package-d-deploy");
  const evidenceDir = path.join(tmp, "evidence");
  const runId = "20260615a";

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    `PACKAGE_D_RUNNER_IMAGE_REF=${runnerImageRef}`,
    "",
  ].join("\n"));
  await writeFile(runtimeEnvPath, [
    "PORTAL_ADMIN_EMAIL=admin@example.invalid",
    "PORTAL_ADMIN_NAME=MedOPL Admin",
    "PORTAL_ADMIN_PASSWORD=portal-admin-password",
    "PORTAL_POSTGRES_URL=postgresql://medopl:postgres-password@10.66.0.21:5432/medopl",
    "PORTAL_POSTGRES_PASSWORD=postgres-password",
    "",
  ].join("\n"));
  await writeFile(kubeconfigPath, [
    "apiVersion: v1",
    "kind: Config",
    "current-context: cls-fi097sy4-context",
    "clusters:",
    "- name: cls-fi097sy4",
    "  cluster:",
    "    server: https://redacted-kubernetes-api.example.invalid",
    "contexts:",
    "- name: cls-fi097sy4-context",
    "  context:",
    "    cluster: cls-fi097sy4",
    "    user: redacted-user",
    "users:",
    "- name: redacted-user",
    "  user:",
    "    username: redacted-user",
    "",
  ].join("\n"));

  assert.equal(
    PACKAGE_D_RUN_SCOPED_JOB_COMMAND,
    "node tests/support/cloud-prework/package-d-run-scoped-job-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --mode preflight-job",
    "runner_must_publish_single_cloud_command",
  );

  await assert.rejects(
    () => buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir }),
    /package_d_run_scoped_job_runid_required/,
    "missing_runid_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, runId: "bad/runid" }),
    /package_d_run_scoped_job_runid_invalid/,
    "invalid_runid_must_fail_closed",
  );
  await assert.rejects(
    () => runPackageDRunScopedJobPreflight({
      deployEnvPath,
      runtimeEnvPath,
      kubeconfigPath: path.join(tmp, "missing-kubeconfig"),
      evidenceDir,
      runId,
      kubectl: fakeKubectlExecutor([]),
    }),
    /package_d_kubeconfig_missing/,
    "missing_kubeconfig_must_fail_closed",
  );

  const plan = await buildPackageDRunScopedJobPlan({
    deployEnvPath,
    runtimeEnvPath,
    kubeconfigPath,
    evidenceDir,
    runId,
  });
  assert.equal(plan.ok, true, "plan_ok");
  assert.equal(plan.mode, "preflight-job", "mode_must_be_preflight_job");
  assert.equal(plan.jobName, "medopl-platform-runner-preflight-20260615a", "job_name_must_be_run_scoped");
  assert.equal(plan.target.clusterId, "cls-fi097sy4", "target_cluster_fixed");
  assert.equal(plan.target.namespace, "medopl-platform", "target_namespace_fixed");
  assert.equal(plan.target.platformNodePoolId, "np-6l4nkdto", "target_platform_runner_pool_fixed");
  assert.equal(plan.boundary.runTencentDeployExecution, "0", "deploy_gate_must_stay_zero");
  assert.equal(plan.boundary.realDeployAllowed, false, "real_deploy_must_be_forbidden");
  assert.equal(plan.boundary.buildPushAllowed, false, "build_push_must_be_forbidden");
  assert.equal(plan.boundary.tencentMutationAllowed, false, "tencent_mutation_must_be_forbidden");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "package_c_live_must_be_forbidden");
  assert.equal(plan.boundary.platformPoolModificationAllowed, false, "platform_pool_modification_must_be_forbidden");
  assert.equal(plan.cleanupPolicy, "delete-on-success-retain-on-failure", "cleanup_policy_must_be_fixed_default");

  assert.equal(plan.jobManifest.kind, "Job", "manifest_must_be_job");
  assert.equal(plan.jobManifest.metadata.name, plan.jobName, "manifest_name_must_match_unique_job_name");
  assert.equal(plan.jobManifest.metadata.namespace, "medopl-platform", "manifest_namespace_must_be_fixed");
  assert.equal(plan.jobManifest.spec.template.spec.serviceAccountName, "medopl-platform-runner", "service_account_must_be_fixed");
  assert.deepEqual(
    plan.jobManifest.spec.template.spec.nodeSelector,
    { "node.tke.cloud.tencent.com/machineset": "np-6l4nkdto" },
    "job_must_target_tke_machineset_selector",
  );
  assert.notEqual(
    plan.jobManifest.spec.template.spec.nodeSelector["node.tke.cloud.tencent.com/machineset"],
    "np-cbk784r8",
    "job_must_not_schedule_to_legacy_platform_pool",
  );
  assert.equal(
    Object.hasOwn(plan.jobManifest.spec.template.spec.nodeSelector, "medopl.io/nodepool-role"),
    false,
    "job_must_not_require_custom_platform_service_label",
  );
  assert.deepEqual(plan.jobManifest.spec.template.spec.containers[0].args, ["preflight"], "job_command_must_be_preflight_only");
  assert.equal(
    plan.jobManifest.spec.template.spec.containers[0].image,
    "REDACTED_PACKAGE_D_RUNNER_IMAGE_REF",
    "public_plan_manifest_must_redact_runner_image_ref",
  );
  assert.deepEqual(plan.jobManifest.spec.template.spec.containers[0].envFrom, [
    { configMapRef: { name: "medopl-package-d-runner-config" } },
    { secretRef: { name: "medopl-package-d-deploy-env" } },
    { secretRef: { name: "medopl-portal-runtime-env" } },
  ], "job_must_use_configmap_and_secret_refs");
  const env = Object.fromEntries(plan.jobManifest.spec.template.spec.containers[0].env.map((item) => [item.name, item.value]));
  assert.equal(env.RUN_SCOPED_JOB_ID, runId, "job_must_record_runid");
  assert.equal(env.EXPECTED_NAMESPACE, "medopl-platform", "job_must_record_expected_namespace");
  assert.equal(env.EXPECTED_SERVICE_ACCOUNT, "medopl-platform-runner", "job_must_record_expected_service_account");
  assert.equal(env.TARGET_PLATFORM_NODE_POOL_ID, "np-6l4nkdto", "job_must_record_runner_pool");
  assert.equal(env.POSTGRES_ENDPOINT, "10.66.0.21:5432", "job_must_record_vpc_postgres_endpoint");
  assert.equal(env.PACKAGE_D_RUNNER_COMMAND, "preflight", "job_must_force_preflight_command");
  assertNoSensitiveText(JSON.stringify(plan), "plan");

  assert.deepEqual(plan.preflightChecks, [
    "in_cluster_identity_namespace_service_account_sanity",
    "postgres_10_66_0_21_5432_connectivity_smoke",
    "package_d_secretref_env_availability_smoke",
    "tcr_imagepullsecret_image_pull_readiness_shape",
    "evidence_redaction_audit",
  ], "preflight_check_list_must_match_contract");
  assert.equal(plan.commands.filter((command) => command.kind === "job_create").length, 1, "single_job_create_command");
  assert.equal(plan.commands.some((command) => command.args.includes("apply")), false, "runner_must_not_apply_job");
  assert.equal(plan.commands.some((command) => command.args.includes("patch")), false, "runner_must_not_patch_job");
  assert.equal(plan.commands.some((command) => command.args.includes("scale")), false, "runner_must_not_scale_job");
  assert.equal(plan.commands.find((command) => command.kind === "job_cleanup").args.includes(plan.jobName), true, "cleanup_must_target_unique_job");

  const commandLog = [];
  const summary = await runPackageDRunScopedJobPreflight({
    deployEnvPath,
    runtimeEnvPath,
    kubeconfigPath,
    evidenceDir,
    runId,
    kubectl: fakeKubectlExecutor(commandLog),
  });
  assert.equal(summary.ok, true, "summary_ok");
  assert.equal(summary.realExecutionReady, false, "real_execution_ready_must_remain_false");
  assert.equal(summary.jobName, plan.jobName, "summary_job_name");
  assert.equal(summary.jobCreate, "created", "job_create_must_run");
  assert.equal(summary.jobObserved, "complete", "job_must_be_observed_complete");
  assert.equal(summary.cleanup, "deleted_on_success", "successful_job_must_be_cleaned_by_default_policy");
  assert.equal(summary.evidencePath.endsWith("preflight-job-redacted.json"), true, "evidence_path");
  assert.equal(commandLog.some((entry) => entry.args.includes("create")), true, "runner_must_create_unique_job");
  assert.equal(commandLog.some((entry) => entry.args.includes("wait")), true, "runner_must_observe_job");
  assert.equal(commandLog.some((entry) => entry.args.includes("logs")), true, "runner_must_collect_redacted_logs_class");
  assert.equal(commandLog.some((entry) => entry.args.includes("delete")), true, "runner_must_cleanup_unique_successful_job");
  assert.equal(commandLog.every((entry) => entry.env.kubeEnvPresent === "redacted"), true, "kubeconfig_env_must_be_passed_but_not_exposed");
  assert.equal(commandLog.every((entry) => entry.stdinClass !== "present_redacted" || entry.args.includes("create")), true, "stdin_must_only_feed_create");
  assert.equal(
    commandLog.find((entry) => entry.args.includes("create")).stdinImage,
    runnerImageRef,
    "live_create_stdin_must_use_real_runner_image_ref",
  );
  assertNoSensitiveText(JSON.stringify(summary), "summary");

  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.ok, true, "evidence_ok");
  assert.equal(evidence.redactionAudit.tcrSecretExposed, false, "evidence_must_hide_tcr_secret");
  assert.equal(evidence.redactionAudit.portalAdminPasswordExposed, false, "evidence_must_hide_portal_password");
  assert.equal(evidence.redactionAudit.portalPostgresPasswordExposed, false, "evidence_must_hide_postgres_password");
  assert.equal(evidence.redactionAudit.kubeconfigSecretExposed, false, "evidence_must_hide_kubeconfig");
  assert.equal(evidence.commands.some((command) => command.command.includes("delete job medopl-platform-runner-preflight-20260615a")), true, "evidence_must_show_scoped_cleanup");
  assertNoSensitiveText(JSON.stringify(evidence), "evidence");

  const manifest = JSON.parse(await readFile(summary.redactedManifestPath, "utf8"));
  assert.equal(manifest.metadata.name, plan.jobName, "redacted_manifest_job_name");
  assert.equal(manifest.spec.template.spec.containers[0].image, "REDACTED_PACKAGE_D_RUNNER_IMAGE_REF", "redacted_manifest_must_hide_runner_image_ref");
  assertNoSensitiveText(JSON.stringify(manifest), "redacted_manifest");

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    "",
  ].join("\n"));
  await assert.rejects(
    () => buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, runId }),
    /package_d_env_missing:PACKAGE_D_RUNNER_IMAGE_REF|package_d_runner_image_ref_missing/,
    "missing_runner_image_ref_must_fail_closed",
  );

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    "PACKAGE_D_RUNNER_IMAGE_REF=REDACTED_PACKAGE_D_RUNNER_IMAGE_REF",
    "",
  ].join("\n"));
  await assert.rejects(
    () => buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, runId }),
    /package_d_runner_image_ref_redacted_value_forbidden|package_d_runner_image_ref_malformed/,
    "redacted_runner_image_ref_must_fail_closed",
  );

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    "PACKAGE_D_RUNNER_IMAGE_REF=bad image",
    "",
  ].join("\n"));
  await assert.rejects(
    () => buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, runId }),
    /package_d_runner_image_ref_malformed/,
    "malformed_runner_image_ref_must_fail_closed",
  );

  for (const forbiddenArg of ["--deploy", "--build", "--push", "--tencent-mutation", "--package-c-live", "--patch", "--scale", "--apply"]) {
    await assert.rejects(
      () => buildPackageDRunScopedJobPlan({
        deployEnvPath,
        runtimeEnvPath,
        kubeconfigPath,
        evidenceDir,
        runId,
        argv: [forbiddenArg],
      }),
      /package_d_run_scoped_job_forbidden_arg/,
      `runner_must_reject:${forbiddenArg}`,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "package_d_run_scoped_job_runner_local_gate",
    runnerCommand: PACKAGE_D_RUN_SCOPED_JOB_COMMAND,
    evidence: ".runtime/package-d-run-scoped-job-preflight/<runid>/preflight-job-redacted.json",
    cleanupPolicy: "delete-on-success-retain-on-failure",
    realExecutionReady: false,
  }, null, 2));
} finally {
  await rm(tmp, { recursive: true, force: true });
}
