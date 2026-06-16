import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE,
  materializePackageDInClusterRunnerPack,
  writePackageDRunnerBootstrapAuthorizationPack,
  writePackageDRunnerManifestPack,
} from "../../support/cloud-prework/package-d-in-cluster-platform-runner-shape.js";
import {
  PACKAGE_D_PRODUCTION_DEPLOY_COMMAND,
  buildPackageDProductionDeployPlan,
  writePackageDProductionDeployPlanEvidence,
} from "../../support/cloud-prework/package-d-production-deploy-runner.js";

const fixedImageTag = "v22-package-d-20260616-fake";
const serviceImages = Object.freeze({
  PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF: `uswccr.ccs.tencentyun.com/medopl/portal-frontend:${fixedImageTag}`,
  PACKAGE_D_GO_BACKEND_IMAGE_REF: `uswccr.ccs.tencentyun.com/medopl/medopl-go-backend:${fixedImageTag}`,
  PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF: `uswccr.ccs.tencentyun.com/medopl/opl-web-gateway:${fixedImageTag}`,
  PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF: `uswccr.ccs.tencentyun.com/medopl/opl-runtime-bridge:${fixedImageTag}`,
});

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
    "docker build",
    "docker push",
    "CreateNodePool",
    "medopl-tenant-",
    ...Object.values(serviceImages),
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

async function writeValidProductionDeployInputs({ deployEnvPath, runtimeEnvPath, kubeconfigPath }) {
  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=1",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    "PACKAGE_D_RUNNER_IMAGE_REF=uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001",
    ...Object.entries(serviceImages).map(([key, value]) => `${key}=${value}`),
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
}

async function assertProductionDeployRunnerLocalGate() {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-production-deploy-"));
  try {
    const deployEnvPath = path.join(tmp, "package-d-deploy.env");
    const runtimeEnvPath = path.join(tmp, "portal-runtime.env");
    const kubeconfigPath = path.join(tmp, "kubeconfig-package-d-deploy");
    const evidenceDir = path.join(tmp, "evidence");
    await writeValidProductionDeployInputs({ deployEnvPath, runtimeEnvPath, kubeconfigPath });

    assert.equal(
      PACKAGE_D_PRODUCTION_DEPLOY_COMMAND,
      "node tests/support/cloud-prework/package-d-production-deploy-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode production-deploy-plan --authorized 1",
      "runner_must_publish_single_cloud_command",
    );
    await assert.rejects(
      () => buildPackageDProductionDeployPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, authorized: false }),
      /package_d_production_deploy_not_authorized/,
      "missing_authorization_must_fail_closed",
    );
    await assert.rejects(
      () => buildPackageDProductionDeployPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath: path.join(tmp, "missing-kubeconfig"), evidenceDir, authorized: true }),
      /package_d_kubeconfig_missing/,
      "missing_kubeconfig_must_fail_closed",
    );

    const plan = await buildPackageDProductionDeployPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, authorized: true });
    assert.equal(plan.ok, true, "plan_ok");
    assert.equal(plan.contract, "package_d_production_deploy_runner_contract_local_gate");
    assert.equal(plan.mode, "production-deploy-plan", "mode_must_be_plan_only");
    assert.equal(plan.target.clusterId, "cls-fi097sy4", "target_cluster_fixed");
    assert.equal(plan.target.namespace, "medopl-platform", "target_namespace_fixed");
    assert.equal(plan.target.platformNodePoolId, "np-6l4nkdto", "target_platform_pool_fixed");
    assert.equal(plan.boundary.runTencentDeployExecution, "1", "deploy_gate_must_be_explicitly_authorized_for_future_deploy");
    assert.equal(plan.boundary.kubectlExecutedNow, false, "runner_must_not_execute_kubectl_now");
    assert.equal(plan.boundary.deployExecutedNow, false, "runner_must_not_deploy_now");
    assert.equal(plan.boundary.buildPushAllowed, false, "runner_must_not_build_push");
    assert.equal(plan.boundary.tencentMutationAllowed, false, "runner_must_not_mutate_tencent");
    assert.equal(plan.boundary.packageCLiveAllowed, false, "runner_must_not_enter_package_c_live");
    assert.deepEqual(plan.services.map((service) => service.name), [
      "portal-frontend",
      "medopl-go-backend",
      "opl-web-gateway",
      "opl-runtime-bridge",
    ], "deploy_must_cover_four_package_d_services");
    assert.equal(plan.services.every((service) => service.imageRef === "redacted"), true, "service_image_refs_must_be_redacted");
    assert.equal(plan.services.every((service) => service.imageTag === fixedImageTag), true, "service_images_must_use_fixed_non_latest_tag");
    assert.equal(plan.services.every((service) => service.secretRefs.includes("medopl-package-d-deploy-env")), true, "deploy_secret_ref_required");
    assert.equal(plan.services.every((service) => service.secretRefs.includes("medopl-portal-runtime-env")), true, "portal_runtime_secret_ref_required");
    assert.equal(plan.services.every((service) => service.imagePullSecrets.includes("medopl-tcr-pull-secret")), true, "image_pull_secret_required");

    assert.equal(plan.manifests.kind, "List", "deploy_manifest_pack_must_be_kubernetes_list");
    assert.equal(plan.manifests.items.filter((item) => item.kind === "Deployment").length, 4, "must_materialize_four_deployments");
    assert.equal(plan.manifests.items.filter((item) => item.kind === "Service").length, 4, "must_materialize_four_services");
    assert.equal(plan.manifests.items.filter((item) => item.kind === "ConfigMap").length, 4, "must_materialize_four_configmaps");
    assert.equal(plan.manifests.items.some((item) => item.kind === "Secret"), false, "production_deploy_manifest_must_not_inline_secret");
    assert.equal(plan.manifests.items.every((item) => item.metadata?.namespace === "medopl-platform"), true, "all_manifests_must_target_single_namespace");
    for (const deployment of plan.manifests.items.filter((item) => item.kind === "Deployment")) {
      const podSpec = deployment.spec.template.spec;
      assert.deepEqual(podSpec.nodeSelector, { "node.tke.cloud.tencent.com/machineset": "np-6l4nkdto" }, "deployment_must_target_new_runner_pool_selector");
      assert.notEqual(podSpec.nodeSelector["node.tke.cloud.tencent.com/machineset"], "np-cbk784r8", "deployment_must_not_target_legacy_platform_pool");
      assert.equal(Object.hasOwn(podSpec.nodeSelector, "medopl.io/nodepool-role"), false, "deployment_must_not_require_retired_selector");
      assert.deepEqual(podSpec.imagePullSecrets, [{ name: "medopl-tcr-pull-secret" }], "deployment_must_use_image_pull_secret");
      assert.deepEqual(podSpec.containers[0].envFrom, [
        { configMapRef: { name: `${deployment.metadata.name}-config` } },
        { secretRef: { name: "medopl-package-d-deploy-env" } },
        { secretRef: { name: "medopl-portal-runtime-env" } },
      ], "deployment_must_use_secret_refs_not_plain_secret_values");
      assert.equal(podSpec.containers[0].image.startsWith("REDACTED_"), true, "public_plan_manifest_must_redact_service_image_ref");
    }

    assert.deepEqual(plan.commands.map((command) => command.name), [
      "kubectl_client_available",
      "current_context",
      "namespace_read",
      "production_server_side_dry_run",
      "production_apply",
      "rollout_status_portal-frontend",
      "rollout_status_medopl-go-backend",
      "rollout_status_opl-web-gateway",
      "rollout_status_opl-runtime-bridge",
      "smoke_portal_frontend",
      "smoke_medopl_go_backend",
      "smoke_opl_web_gateway",
      "smoke_opl_runtime_bridge",
    ], "deploy_command_plan_must_be_allowlisted_and_ordered");
    assert.equal(plan.commands.some((command) => command.args.includes("delete")), false, "deploy_plan_must_not_delete");
    assert.equal(plan.commands.some((command) => command.args.includes("patch")), false, "deploy_plan_must_not_patch");
    assert.equal(plan.commands.some((command) => command.args.includes("scale")), false, "deploy_plan_must_not_scale");
    assert.equal(plan.commands.find((command) => command.name === "production_server_side_dry_run").args.includes("--dry-run=server"), true, "dry_run_command_must_be_server_side");
    assert.equal(plan.commands.find((command) => command.name === "production_apply").args.includes("--dry-run=server"), false, "apply_plan_must_be_real_apply_boundary_not_executed_now");
    assert.deepEqual(plan.rollback.commands.map((command) => command.name), [
      "rollback_portal-frontend",
      "rollback_medopl-go-backend",
      "rollback_opl-web-gateway",
      "rollback_opl-runtime-bridge",
    ], "rollback_command_plan_must_cover_all_services");
    assert.equal(plan.rollback.commands.every((command) => command.args.includes("rollout") && command.args.includes("undo")), true, "rollback_must_use_rollout_undo_only");
    assert.equal(plan.smokePlan.targets.includes("PostgreSQL 10.66.0.21:5432 connectivity from deployed service boundary"), true, "smoke_must_include_postgres_vpc_connectivity");
    assert.equal(plan.rolloutPlan.steps.includes("server-side dry-run generated Package D production manifests before apply"), true, "rollout_must_require_dry_run_before_apply");
    assert.equal(plan.stopConditions.includes("server-side dry-run fails"), true, "stop_conditions_must_include_dry_run_failure");
    assertNoSensitiveText(JSON.stringify(plan), "plan");

    const evidence = await writePackageDProductionDeployPlanEvidence({ plan });
    const evidencePayload = JSON.parse(await readFile(evidence.path, "utf8"));
    assert.equal(evidence.path.endsWith("deploy-plan-redacted.json"), true, "evidence_path");
    assert.equal(evidencePayload.redactionAudit.tcrSecretExposed, false, "evidence_must_hide_tcr_secret");
    assert.equal(evidencePayload.redactionAudit.portalAdminPasswordExposed, false, "evidence_must_hide_portal_password");
    assert.equal(evidencePayload.redactionAudit.portalPostgresPasswordExposed, false, "evidence_must_hide_postgres_password");
    assert.equal(evidencePayload.redactionAudit.kubeconfigSecretExposed, false, "evidence_must_hide_kubeconfig");
    assertNoSensitiveText(JSON.stringify(evidencePayload), "evidence");

    await writeFile(deployEnvPath, [
      "RUN_TENCENT_DEPLOY_EXECUTION=0",
      "TCR_ID=100047070895",
      "TCR_SECRET=tcr-secret-value",
      "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
      "TENCENT_TCR_NAMESPACE=medopl",
      "TENCENT_TCR_REGION=na-siliconvalley",
      "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
      `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
      "PACKAGE_D_RUNNER_IMAGE_REF=uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001",
      ...Object.entries(serviceImages).map(([key, value]) => `${key}=${value}`),
      "",
    ].join("\n"));
    await assert.rejects(
      () => buildPackageDProductionDeployPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, authorized: true }),
      /package_d_production_deploy_run_gate_not_authorized/,
      "run_gate_zero_must_fail_closed_for_production_deploy_plan",
    );

    await writeValidProductionDeployInputs({ deployEnvPath, runtimeEnvPath, kubeconfigPath });
    await writeFile(deployEnvPath, [
      "RUN_TENCENT_DEPLOY_EXECUTION=1",
      "TCR_ID=100047070895",
      "TCR_SECRET=tcr-secret-value",
      "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
      "TENCENT_TCR_NAMESPACE=medopl",
      "TENCENT_TCR_REGION=na-siliconvalley",
      "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
      `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
      "PACKAGE_D_RUNNER_IMAGE_REF=uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001",
      "PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF=uswccr.ccs.tencentyun.com/medopl/portal-frontend:latest",
      "PACKAGE_D_GO_BACKEND_IMAGE_REF=uswccr.ccs.tencentyun.com/medopl/medopl-go-backend:v22-package-d-20260616-fake",
      "PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF=uswccr.ccs.tencentyun.com/medopl/opl-web-gateway:v22-package-d-20260616-fake",
      "PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF=uswccr.ccs.tencentyun.com/medopl/opl-runtime-bridge:v22-package-d-20260616-fake",
      "",
    ].join("\n"));
    await assert.rejects(
      () => buildPackageDProductionDeployPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, authorized: true }),
      /package_d_production_image_latest_forbidden/,
      "latest_service_image_must_fail_closed",
    );
    for (const forbiddenArg of ["--build", "--push", "--tencent-mutation", "--package-c-live", "--delete", "--patch", "--scale", "--arbitrary-shell"]) {
      await assert.rejects(
        () => buildPackageDProductionDeployPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, authorized: true, argv: [forbiddenArg] }),
        /package_d_production_deploy_forbidden_arg/,
        `runner_must_reject:${forbiddenArg}`,
      );
    }
    return {
      ok: true,
      runnerCommand: PACKAGE_D_PRODUCTION_DEPLOY_COMMAND,
      evidence: ".runtime/package-d-production-deploy/deploy-plan-redacted.json",
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

const reportRoot = new URL("../../../.runtime/package-d-in-cluster-platform-runner-manifest-materialization/", import.meta.url);
const bootstrapReportRoot = new URL("../../../.runtime/package-d-in-cluster-platform-runner-bootstrap-authorization/", import.meta.url);
const pack = materializePackageDInClusterRunnerPack(PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE);

assert.equal(pack.ok, true, "manifest_pack_must_be_ok");
assert.equal(pack.contract, "package_d_in_cluster_platform_runner_manifest_materialization");
assert.equal(pack.executionBoundary.callsKubectlNow, false, "manifest_pack_must_not_call_kubectl");
assert.equal(pack.executionBoundary.connectsClusterNow, false, "manifest_pack_must_not_connect_cluster");
assert.equal(pack.executionBoundary.deploysNow, false, "manifest_pack_must_not_deploy");
assert.equal(pack.executionBoundary.buildsOrPushesNow, false, "manifest_pack_must_not_build_push");
assert.equal(pack.executionBoundary.executesTencentMutationNow, false, "manifest_pack_must_not_mutate_tencent");
assert.equal(pack.executionBoundary.readsKubeconfigNow, false, "manifest_pack_must_not_read_kubeconfig");
assert.equal(pack.executionBoundary.packageCLiveAllowed, false, "manifest_pack_must_not_allow_package_c_live");

assert.equal(pack.manifests.namespace.metadata.name, "medopl-platform", "namespace_must_be_medopl_platform");
assert.equal(pack.manifests.serviceAccount.metadata.name, "medopl-platform-runner", "service_account_must_be_fixed");
assert.equal(pack.jobLifecycle.kind, "run_scoped_job_lifecycle", "runner_workload_must_be_run_scoped_job_lifecycle");
assert.equal(pack.jobLifecycle.namePattern, "medopl-platform-runner-preflight-<runid>", "job_lifecycle_must_use_unique_run_scoped_name");
assert.equal(pack.jobLifecycle.includedInBootstrapApply, false, "job_lifecycle_must_not_be_in_bootstrap_apply");
assert.equal(pack.jobLifecycle.includedInServerSideDryRun, false, "job_lifecycle_must_not_be_in_server_side_dry_run");
assert.equal(pack.jobLifecycle.sameNameTemplateUpdateAllowed, false, "job_lifecycle_must_forbid_same_name_template_update");
assert.equal(pack.jobLifecycle.template.kind, "Job", "runner_workload_template_must_be_job");
assert.equal(pack.jobLifecycle.template.metadata.namespace, "medopl-platform", "job_namespace_must_be_fixed");
assert.equal(pack.jobLifecycle.template.spec.template.spec.serviceAccountName, "medopl-platform-runner", "job_service_account_must_be_fixed");
assert.equal(pack.jobLifecycle.template.spec.template.spec.restartPolicy, "Never", "job_restart_policy_must_be_never");
assert.deepEqual(
  pack.jobLifecycle.template.spec.template.spec.nodeSelector,
  { "node.tke.cloud.tencent.com/machineset": "np-6l4nkdto" },
  "job_must_target_tke_machineset_selector",
);
assert.notEqual(
  pack.jobLifecycle.template.spec.template.spec.nodeSelector["node.tke.cloud.tencent.com/machineset"],
  "np-cbk784r8",
  "job_must_not_schedule_to_legacy_platform_pool",
);
assert.equal(
  Object.hasOwn(pack.jobLifecycle.template.spec.template.spec.nodeSelector, "medopl.io/nodepool-role"),
  false,
  "job_must_not_require_custom_platform_service_label",
);
assert.equal(JSON.stringify(pack.jobLifecycle.template).includes("medopl-tenant-"), false, "job_manifest_must_not_reference_tenant_pool");
assert.equal(JSON.stringify(pack.jobLifecycle.template).includes("client-key-data"), false, "job_manifest_must_not_embed_kubeconfig");
assert.equal(JSON.stringify(pack.jobLifecycle.template).includes("postgresql://"), false, "job_manifest_must_not_embed_db_url");

assert.deepEqual(pack.jobLifecycle.template.spec.template.spec.imagePullSecrets, [{ name: "medopl-tcr-pull-secret" }], "job_must_use_image_pull_secret_ref");
assert.deepEqual(pack.jobLifecycle.template.spec.template.spec.containers[0].envFrom, [
  { configMapRef: { name: "medopl-package-d-runner-config" } },
  { secretRef: { name: "medopl-package-d-deploy-env" } },
  { secretRef: { name: "medopl-portal-runtime-env" } },
], "job_must_use_configmap_and_secret_refs");
assert.deepEqual(pack.jobLifecycle.template.spec.template.spec.containers[0].args, ["$(PACKAGE_D_RUNNER_COMMAND)"], "job_command_must_be_config_driven_allowlisted");

assert.equal(pack.manifests.configMap.metadata.name, "medopl-package-d-runner-config", "configmap_name_must_be_fixed");
assert.equal(pack.manifests.configMap.data.PACKAGE_D_RUNNER_COMMAND_ALLOWLIST, "preflight,deploy,smoke,rollback", "configmap_must_record_command_allowlist");
assert.equal(pack.manifests.configMap.data.RUN_TENCENT_DEPLOY_EXECUTION, "0", "configmap_must_keep_deploy_gate_zero");
assert.equal(pack.manifests.configMap.data.TARGET_CLUSTER_ID, "cls-fi097sy4", "configmap_must_record_target_cluster");
assert.equal(pack.manifests.configMap.data.TARGET_PLATFORM_NODE_POOL_ID, "np-6l4nkdto", "configmap_must_record_runner_pool");
assert.equal(pack.manifests.configMap.data.POSTGRES_ENDPOINT, "10.66.0.21:5432", "configmap_must_record_vpc_postgres_endpoint");

assert.deepEqual(Object.keys(pack.manifests.secretTemplates.deployEnvSecret.stringData).sort(), [
  "PACKAGE_D_RUNNER_IMAGE_REF",
  "PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF",
  "PACKAGE_D_GO_BACKEND_IMAGE_REF",
  "PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF",
  "PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF",
  "RUN_TENCENT_DEPLOY_EXECUTION",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_DEPLOY_CLUSTER_ID",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
  "TENCENT_TCR_NAMESPACE",
  "TENCENT_TCR_REGION",
  "TENCENT_TCR_REGISTRY",
].sort(), "deploy_secret_template_must_name_allowed_package_d_keys_only");
assert.deepEqual(Object.keys(pack.manifests.secretTemplates.portalRuntimeSecret.stringData).sort(), [
  "PORTAL_ADMIN_EMAIL",
  "PORTAL_ADMIN_NAME",
  "PORTAL_ADMIN_PASSWORD",
  "PORTAL_POSTGRES_PASSWORD",
  "PORTAL_POSTGRES_URL",
].sort(), "runtime_secret_template_must_name_allowed_portal_keys_only");
assert.equal(Object.values(pack.manifests.secretTemplates.deployEnvSecret.stringData).every((value) => value === "REDACTED_REQUIRED_AT_APPLY_TIME"), true, "deploy_secret_template_values_must_be_redacted");
assert.equal(Object.values(pack.manifests.secretTemplates.portalRuntimeSecret.stringData).every((value) => value === "REDACTED_REQUIRED_AT_APPLY_TIME"), true, "runtime_secret_template_values_must_be_redacted");
assert.deepEqual(pack.manifests.secretTemplates.imagePullSecret.stringData, {
  ".dockerconfigjson": "REDACTED_IMAGE_PULL_SECRET_REQUIRED_AT_APPLY_TIME",
}, "image_pull_secret_template_must_use_dockerconfigjson_key");

assert.equal(pack.rbac.serviceAccount, "medopl-platform-runner", "rbac_service_account_must_match");
assert.equal(pack.rbac.clusterAdminAllowed, false, "rbac_must_forbid_cluster_admin");
assert.equal(pack.rbac.broadWildcardAllowed, false, "rbac_must_forbid_wildcard");
assert.deepEqual(pack.manifests.clusterRole.rules, [{ apiGroups: [""], resources: ["nodes"], verbs: ["get", "list"] }], "cluster_role_must_be_nodes_readonly");
assert.equal(pack.manifests.role.rules.some((rule) => rule.resources.includes("secrets") && rule.verbs.length === 1 && rule.verbs[0] === "get"), true, "role_must_keep_secrets_get_only");

assert.deepEqual(pack.authorizationPack.requiredAuthorizations, [
  "read kubeconfig content",
  "connect Kubernetes API",
  "kubectl server-side dry-run",
  "kubectl apply Package D runner manifests",
  "run Package D preflight from platform runner",
], "authorization_pack_must_stop_before_real_execution");
assert.deepEqual(pack.authorizationPack.forbiddenUntilAuthorized, [
  "kubectl apply/delete/patch/scale",
  "deploy workload",
  "build/push image",
  "Tencent mutation",
  "Package C live",
  "tenant pool mutation",
], "authorization_pack_must_keep_forbidden_ops");

assert.equal(pack.bootstrapAuthorizationPack.status, "authorization_pack_only", "bootstrap_authorization_pack_must_be_plan_only");
assert.deepEqual(pack.bootstrapAuthorizationPack.recommendedExecutionEnvironments, [
  "Tencent CloudShell with target TKE API reachability",
  "Tencent Cloud Assistant session on a VPC-reachable host",
  "VPC internal runner with TKE API reachability",
], "bootstrap_authorization_pack_must_prefer_cloud_reachable_environment");
assert.deepEqual(pack.bootstrapAuthorizationPack.discouragedExecutionEnvironments, [
  "local WSL without TKE API reachability",
], "bootstrap_authorization_pack_must_discourage_local_wsl");
assert.deepEqual(pack.bootstrapAuthorizationPack.target, {
  clusterId: "cls-fi097sy4",
  namespace: "medopl-platform",
  platformNodePoolId: "np-6l4nkdto",
  schedulingClass: "platform_service_pool",
}, "bootstrap_authorization_pack_target_must_be_fixed");
assert.deepEqual(pack.bootstrapAuthorizationPack.resourceTypesToCreateOrValidate, [
  "Namespace",
  "ServiceAccount",
  "RBAC",
  "ConfigMap",
  "SecretRef",
  "imagePullSecret",
], "bootstrap_authorization_pack_resource_types_must_be_explicit");
assert.deepEqual(pack.bootstrapAuthorizationPack.jobLifecycleBoundary, {
  status: "separate_authorization_required",
  namePattern: "medopl-platform-runner-preflight-<runid>",
  reason: "Kubernetes Job spec.template is immutable; bootstrap apply must not reapply a same-name Job template.",
  allowedOnlyAfterBootstrapDryRunPasses: true,
}, "bootstrap_authorization_pack_must_split_job_lifecycle");
assert(pack.bootstrapAuthorizationPack.forbiddenScope.includes("medopl-tenant- tenant pool"), "bootstrap_authorization_pack_must_forbid_tenant_pool");
assert(pack.bootstrapAuthorizationPack.forbiddenScope.includes("Package C live"), "bootstrap_authorization_pack_must_forbid_package_c_live");
assert(pack.bootstrapAuthorizationPack.forbiddenScope.includes("build/push"), "bootstrap_authorization_pack_must_forbid_build_push");
assert(pack.bootstrapAuthorizationPack.forbiddenScope.includes("formal deploy"), "bootstrap_authorization_pack_must_forbid_formal_deploy");
assert(pack.bootstrapAuthorizationPack.rollbackPlan.some((item) => item.includes("np-cbk784r8")), "bootstrap_authorization_pack_must_protect_platform_pool_in_rollback");
assert(pack.bootstrapAuthorizationPack.stopConditions.includes("manifest references medopl-tenant-"), "bootstrap_authorization_pack_must_stop_on_tenant_reference");
assert(pack.bootstrapAuthorizationPack.stopConditions.includes("server-side dry-run is rejected"), "bootstrap_authorization_pack_must_stop_on_dry_run_rejection");
assert.equal(
  pack.bootstrapAuthorizationPack.redactedEvidencePath,
  ".runtime/package-d-in-cluster-platform-runner-bootstrap-authorization/authorization-pack-redacted.json",
  "bootstrap_authorization_pack_evidence_path_must_be_runtime_only",
);
assert(pack.bootstrapAuthorizationPack.nextAuthorizationPrompt.some((item) => item.includes("CloudShell")), "bootstrap_authorization_pack_must_prompt_cloudshell_or_reachable_runner");
assert(pack.bootstrapAuthorizationPack.nextAuthorizationPrompt.some((item) => item.includes("server-side dry-run")), "bootstrap_authorization_pack_must_prompt_dry_run_first");
assert(pack.bootstrapAuthorizationPack.nextAuthorizationPrompt.some((item) => item.includes("separate authorization")), "bootstrap_authorization_pack_must_require_separate_apply_authorization");

const evidence = writePackageDRunnerManifestPack({ reportRoot, pack });
assert.equal(evidence.path.endsWith("manifest-pack-redacted.json"), true, "manifest_pack_evidence_path");
assert.equal(evidence.report.ok, true, "manifest_pack_evidence_ok");
const bootstrapEvidence = writePackageDRunnerBootstrapAuthorizationPack({ reportRoot: bootstrapReportRoot, pack });
assert.equal(bootstrapEvidence.path.endsWith("authorization-pack-redacted.json"), true, "bootstrap_authorization_pack_evidence_path");
assert.equal(bootstrapEvidence.report.ok, true, "bootstrap_authorization_pack_evidence_ok");
assert.equal(bootstrapEvidence.report.contract, "package_d_in_cluster_platform_runner_bootstrap_authorization_pack", "bootstrap_authorization_pack_evidence_contract");
const evidenceText = JSON.stringify(evidence.report);
const bootstrapEvidenceText = JSON.stringify(bootstrapEvidence.report);
for (const forbidden of ["$TCR_SECRET", "$PORTAL_ADMIN_PASSWORD", "$PORTAL_POSTGRES_PASSWORD", "postgresql://", "client-key-data", "client-certificate-data", "current-context:", "clusters:"]) {
  assert.equal(evidenceText.includes(forbidden), false, `manifest_pack_evidence_must_not_expose:${forbidden}`);
  assert.equal(bootstrapEvidenceText.includes(forbidden), false, `bootstrap_authorization_pack_evidence_must_not_expose:${forbidden}`);
}
const productionDeployGate = await assertProductionDeployRunnerLocalGate();

console.log(JSON.stringify({
  ok: true,
  contract: "package_d_in_cluster_platform_runner_manifest_materialization_gate",
  namespace: pack.manifests.namespace.metadata.name,
  serviceAccount: pack.manifests.serviceAccount.metadata.name,
  workloadKind: pack.jobLifecycle.template.kind,
  jobLifecycle: pack.jobLifecycle.kind,
  bootstrapAuthorizationPack: pack.bootstrapAuthorizationPack.status,
  realExecutionReady: false,
  evidence: ".runtime/package-d-in-cluster-platform-runner-manifest-materialization/manifest-pack-redacted.json",
  bootstrapEvidence: ".runtime/package-d-in-cluster-platform-runner-bootstrap-authorization/authorization-pack-redacted.json",
  productionDeployRunner: {
    runnerCommand: productionDeployGate.runnerCommand,
    evidence: productionDeployGate.evidence,
    realExecutionReady: false,
  },
}, null, 2));
