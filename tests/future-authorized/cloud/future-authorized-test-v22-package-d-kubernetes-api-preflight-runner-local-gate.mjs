import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_KUBERNETES_API_PREFLIGHT_COMMAND,
  buildPackageDKubernetesApiPreflightPlan,
  runPackageDKubernetesApiPreflight,
} from "../../support/cloud-prework/package-d-kubernetes-api-preflight-runner.js";

const kubeEnvName = ["KUBE", "CONFIG"].join("");

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
    "kubectl delete",
    "kubectl patch",
    "kubectl scale",
    "docker build",
    "docker push",
    "CreateNodePool",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

function fakeKubectlExecutor(commandLog) {
  return async ({ args, env }) => {
    commandLog.push({ args, env: { kubeEnvPresent: env[kubeEnvName] ? "redacted" : "" } });
    const joined = args.join(" ");
    assert.equal(args[0], "kubectl", "runner_must_use_kubectl_only");
    assert.equal(joined.includes("delete"), false, "runner_must_not_delete");
    assert.equal(joined.includes("patch"), false, "runner_must_not_patch");
    assert.equal(joined.includes("scale"), false, "runner_must_not_scale");
    if (args.includes("apply")) {
      assert(args.includes("--server-side"), "apply_must_be_server_side");
      assert(args.includes("--dry-run=server"), "apply_must_be_server_dry_run");
    }
    if (args.includes("current-context")) {
      return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
    }
    if (args.includes("namespace")) {
      return { status: 0, stdout: JSON.stringify({ metadata: { name: "medopl-platform" } }), stderr: "" };
    }
    return { status: 0, stdout: "ok\n", stderr: "" };
  };
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-k8s-api-preflight-"));
try {
  const deployEnvPath = path.join(tmp, "package-d-deploy.env");
  const runtimeEnvPath = path.join(tmp, "portal-runtime.env");
  const kubeconfigPath = path.join(tmp, "kubeconfig-package-d-deploy");
  const evidenceDir = path.join(tmp, "evidence");

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    "PACKAGE_D_RUNNER_IMAGE_REF=uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-fake",
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
    PACKAGE_D_KUBERNETES_API_PREFLIGHT_COMMAND,
    "node tests/support/cloud-prework/package-d-kubernetes-api-preflight-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode server-side-dry-run",
    "runner_must_publish_single_cloud_command",
  );

  await assert.rejects(
    () => runPackageDKubernetesApiPreflight({
      deployEnvPath,
      runtimeEnvPath,
      kubeconfigPath: path.join(tmp, "missing-kubeconfig"),
      evidenceDir,
      kubectl: fakeKubectlExecutor([]),
    }),
    /package_d_kubeconfig_missing/,
    "missing_kubeconfig_must_fail_closed",
  );

  const plan = await buildPackageDKubernetesApiPreflightPlan({
    deployEnvPath,
    runtimeEnvPath,
    kubeconfigPath,
    evidenceDir,
  });
  assert.equal(plan.ok, true, "plan_ok");
  assert.equal(plan.target.clusterId, "cls-fi097sy4", "target_cluster_fixed");
  assert.equal(plan.target.namespace, "medopl-platform", "target_namespace_fixed");
  assert.equal(plan.target.platformNodePoolId, "np-cbk784r8", "target_platform_pool_fixed");
  assert.equal(plan.target.postgresEndpoint, "10.66.0.21:5432", "postgres_endpoint_fixed");
  assert.equal(plan.boundary.runTencentDeployExecution, "0", "deploy_gate_must_stay_zero");
  assert.equal(plan.boundary.realDeployAllowed, false, "real_deploy_must_be_forbidden");
  assert.equal(plan.boundary.buildPushAllowed, false, "build_push_must_be_forbidden");
  assert.equal(plan.boundary.tencentMutationAllowed, false, "tencent_mutation_must_be_forbidden");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "package_c_live_must_be_forbidden");
  assert.equal(plan.commands.every((command) => command.kind !== "mutation"), true, "command_plan_must_not_mark_real_mutation");
  assert.equal(plan.commands.some((command) => command.args.includes("nodes")), false, "runner_must_not_expand_to_node_read");
  assert.equal(plan.commands.filter((command) => command.args.includes("apply")).length, 1, "single_apply_dry_run_command");
  assert(plan.commands.find((command) => command.args.includes("apply")).args.includes("--dry-run=server"), "apply_command_must_be_server_dry_run");
  assert.equal(JSON.stringify(plan.manifests).includes("medopl-tenant-"), false, "manifests_must_not_reference_tenant_pool");
  assert.equal(JSON.stringify(plan.manifests).includes("\"kind\":\"Job\""), false, "server_side_dry_run_must_not_reapply_same_name_job");
  assert.equal(plan.jobLifecycle.kind, "run_scoped_job_lifecycle", "job_lifecycle_must_be_separate");
  assert.equal(plan.jobLifecycle.namePattern, "medopl-platform-runner-preflight-<runid>", "job_lifecycle_must_use_unique_run_scoped_name");
  assert.equal(plan.jobLifecycle.authorizationRequired, true, "job_lifecycle_must_remain_separately_authorized");
  assertNoSensitiveText(JSON.stringify(plan), "plan");

  const commandLog = [];
  const summary = await runPackageDKubernetesApiPreflight({
    deployEnvPath,
    runtimeEnvPath,
    kubeconfigPath,
    evidenceDir,
    kubectl: fakeKubectlExecutor(commandLog),
  });
  assert.equal(summary.ok, true, "summary_ok");
  assert.equal(summary.realExecutionReady, false, "real_execution_ready_must_remain_false");
  assert.equal(summary.kubernetesApiConnected, true, "fake_api_connected");
  assert.equal(summary.namespaceStatus, "present", "namespace_status_present");
  assert.equal(summary.schedulingTargetValidated, true, "scheduling_target_validated_from_manifest");
  assert.equal(summary.serverSideDryRun, "pass", "server_side_dry_run_pass");
  assert.equal(summary.evidencePath.endsWith("preflight-redacted.json"), true, "evidence_path");
  assert.equal(commandLog.some((entry) => entry.args.includes("apply")), true, "runner_must_execute_apply_dry_run_command");
  assert.equal(commandLog.every((entry) => entry.env.kubeEnvPresent === "redacted"), true, "kubeconfig_env_must_be_passed_but_not_exposed");
  assertNoSensitiveText(JSON.stringify(summary), "summary");

  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.ok, true, "evidence_ok");
  assert.equal(evidence.redactionAudit.tcrSecretExposed, false, "evidence_must_hide_tcr_secret");
  assert.equal(evidence.redactionAudit.portalAdminPasswordExposed, false, "evidence_must_hide_portal_password");
  assert.equal(evidence.redactionAudit.portalPostgresPasswordExposed, false, "evidence_must_hide_postgres_password");
  assert.equal(evidence.redactionAudit.kubeconfigSecretExposed, false, "evidence_must_hide_kubeconfig");
  assert.equal(evidence.commands.every((command) => command.command.includes("--dry-run=server") || !command.command.includes("apply")), true, "evidence_apply_must_be_dry_run");
  assertNoSensitiveText(JSON.stringify(evidence), "evidence");

  for (const forbiddenArg of ["--deploy", "--build", "--push", "--tencent-mutation", "--package-c-live", "--delete", "--patch", "--scale"]) {
    await assert.rejects(
      () => buildPackageDKubernetesApiPreflightPlan({
        deployEnvPath,
        runtimeEnvPath,
        kubeconfigPath,
        evidenceDir,
        argv: [forbiddenArg],
      }),
      /package_d_kubernetes_api_preflight_forbidden_arg/,
      `runner_must_reject:${forbiddenArg}`,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "package_d_kubernetes_api_server_side_dry_run_preflight_runner_local_gate",
    runnerCommand: PACKAGE_D_KUBERNETES_API_PREFLIGHT_COMMAND,
    evidence: ".runtime/package-d-kubernetes-api-server-side-dry-run-preflight/preflight-redacted.json",
    realExecutionReady: false,
  }, null, 2));
} finally {
  await rm(tmp, { recursive: true, force: true });
}
