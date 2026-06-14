import assert from "node:assert/strict";

import {
  PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE,
  materializePackageDInClusterRunnerPack,
  writePackageDRunnerManifestPack,
} from "../../support/cloud-prework/package-d-in-cluster-platform-runner-shape.js";

const reportRoot = new URL("../../../.runtime/package-d-in-cluster-platform-runner-manifest-materialization/", import.meta.url);
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
assert.equal(pack.manifests.job.kind, "Job", "runner_workload_must_be_job");
assert.equal(pack.manifests.job.metadata.namespace, "medopl-platform", "job_namespace_must_be_fixed");
assert.equal(pack.manifests.job.spec.template.spec.serviceAccountName, "medopl-platform-runner", "job_service_account_must_be_fixed");
assert.equal(pack.manifests.job.spec.template.spec.restartPolicy, "Never", "job_restart_policy_must_be_never");
assert.equal(pack.manifests.job.spec.template.spec.nodeSelector["medopl.io/nodepool-role"], "platform-service", "job_must_target_platform_service_selector");
assert.equal(JSON.stringify(pack.manifests.job).includes("medopl-tenant-"), false, "job_manifest_must_not_reference_tenant_pool");
assert.equal(JSON.stringify(pack.manifests.job).includes("client-key-data"), false, "job_manifest_must_not_embed_kubeconfig");
assert.equal(JSON.stringify(pack.manifests.job).includes("postgresql://"), false, "job_manifest_must_not_embed_db_url");

assert.deepEqual(pack.manifests.job.spec.template.spec.imagePullSecrets, [{ name: "medopl-tcr-pull-secret" }], "job_must_use_image_pull_secret_ref");
assert.deepEqual(pack.manifests.job.spec.template.spec.containers[0].envFrom, [
  { configMapRef: { name: "medopl-package-d-runner-config" } },
  { secretRef: { name: "medopl-package-d-deploy-env" } },
  { secretRef: { name: "medopl-portal-runtime-env" } },
], "job_must_use_configmap_and_secret_refs");
assert.deepEqual(pack.manifests.job.spec.template.spec.containers[0].args, ["$(PACKAGE_D_RUNNER_COMMAND)"], "job_command_must_be_config_driven_allowlisted");

assert.equal(pack.manifests.configMap.metadata.name, "medopl-package-d-runner-config", "configmap_name_must_be_fixed");
assert.equal(pack.manifests.configMap.data.PACKAGE_D_RUNNER_COMMAND_ALLOWLIST, "preflight,deploy,smoke,rollback", "configmap_must_record_command_allowlist");
assert.equal(pack.manifests.configMap.data.RUN_TENCENT_DEPLOY_EXECUTION, "0", "configmap_must_keep_deploy_gate_zero");
assert.equal(pack.manifests.configMap.data.TARGET_CLUSTER_ID, "cls-fi097sy4", "configmap_must_record_target_cluster");
assert.equal(pack.manifests.configMap.data.TARGET_PLATFORM_NODE_POOL_ID, "np-cbk784r8", "configmap_must_record_platform_pool");
assert.equal(pack.manifests.configMap.data.POSTGRES_ENDPOINT, "10.66.0.21:5432", "configmap_must_record_vpc_postgres_endpoint");

assert.deepEqual(Object.keys(pack.manifests.secretTemplates.deployEnvSecret.stringData).sort(), [
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

const evidence = writePackageDRunnerManifestPack({ reportRoot, pack });
assert.equal(evidence.path.endsWith("manifest-pack-redacted.json"), true, "manifest_pack_evidence_path");
assert.equal(evidence.report.ok, true, "manifest_pack_evidence_ok");
const evidenceText = JSON.stringify(evidence.report);
for (const forbidden of ["$TCR_SECRET", "$PORTAL_ADMIN_PASSWORD", "$PORTAL_POSTGRES_PASSWORD", "postgresql://", "client-key-data", "client-certificate-data", "current-context:", "clusters:"]) {
  assert.equal(evidenceText.includes(forbidden), false, `manifest_pack_evidence_must_not_expose:${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "package_d_in_cluster_platform_runner_manifest_materialization_gate",
  namespace: pack.manifests.namespace.metadata.name,
  serviceAccount: pack.manifests.serviceAccount.metadata.name,
  workloadKind: pack.manifests.job.kind,
  realExecutionReady: false,
  evidence: ".runtime/package-d-in-cluster-platform-runner-manifest-materialization/manifest-pack-redacted.json",
}, null, 2));
