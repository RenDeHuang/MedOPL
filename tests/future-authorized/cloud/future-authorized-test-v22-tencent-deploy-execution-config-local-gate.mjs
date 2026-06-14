import assert from "node:assert/strict";

const FIXED_DEPLOY_CLUSTER_ID = "cls-fi097sy4";
const FIXED_PLATFORM_NODE_POOL_ID = "np-cbk784r8";
const FIXED_POSTGRES_ENDPOINT = "10.66.0.21:5432";
const FIXED_DEPLOY_NAMESPACE = "medopl-platform";
const READINESS_GAPS = Object.freeze([
  "image build",
  "TCR push",
  "Kubernetes manifests",
  "platform pool scheduling",
  "DB connectivity smoke",
  "rollback plan",
]);

const PACKAGE_D_SECRET_KEYS = new Set([
  "RUN_TENCENT_DEPLOY_EXECUTION",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_TCR_REGISTRY",
  "TENCENT_TCR_NAMESPACE",
  "TENCENT_TCR_REGION",
  "TENCENT_DEPLOY_CLUSTER_ID",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
  "PORTAL_POSTGRES_URL",
  "PORTAL_POSTGRES_PASSWORD",
]);

const PORTAL_RUNTIME_SECRET_KEYS = new Set([
  "PORTAL_POSTGRES_URL",
  "PORTAL_POSTGRES_PASSWORD",
]);

const FORBIDDEN_SECRET_KEYS = new Set([
  "RUN_TENCENT_READONLY_INVENTORY",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "LANGFUSE_SECRET_KEY",
  "DATABASE_URL",
  "SSH_PRIVATE_KEY",
  "GITHUB_TOKEN",
]);

function text(value = "") {
  return String(value ?? "").trim();
}

function postgresEndpoint(value = "") {
  try {
    const parsed = new URL(text(value));
    return `${parsed.hostname}:${parsed.port || "5432"}`;
  } catch {
    return "";
  }
}

function parseDeployEnv(content = "") {
  const env = {};
  for (const line of String(content).split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) throw new Error("tencent_deploy_secret_line_invalid");
    const key = normalized.slice(0, equalsIndex).trim();
    const value = normalized.slice(equalsIndex + 1).trim();
    if (FORBIDDEN_SECRET_KEYS.has(key)) throw new Error(`tencent_deploy_forbidden_secret_key:${key}`);
    if (!PACKAGE_D_SECRET_KEYS.has(key)) throw new Error(`tencent_deploy_non_allowlist_secret_key_rejected:${key}`);
    env[key] = value;
  }
  return env;
}

function parseAllowlistedEnv(content = "", allowedKeys = new Set()) {
  const env = {};
  for (const line of String(content).split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) throw new Error("env_line_invalid");
    const key = normalized.slice(0, equalsIndex).trim();
    const value = normalized.slice(equalsIndex + 1).trim();
    if (FORBIDDEN_SECRET_KEYS.has(key)) throw new Error(`forbidden_secret_key:${key}`);
    if (!allowedKeys.has(key)) throw new Error(`non_allowlist_secret_key_rejected:${key}`);
    env[key] = value;
  }
  return env;
}

function looksLikeRawKubeconfig(value = "") {
  const normalized = text(value).toLowerCase();
  return [
    "apiversion:",
    "clusters:",
    "contexts:",
    "current-context:",
    "kind: config",
    "client-certificate-data:",
    "client-key-data:",
  ].some((needle) => normalized.includes(needle));
}

function containsTenantPoolReference(value) {
  return JSON.stringify(value ?? {}).includes("medopl-tenant-");
}

function releaseTarget({ component, repository = component, sourceRoot }) {
  return {
    component,
    targetClass: "platform_service_target",
    repository,
    imageTargetRef: `tcr://${repository}:v22-package-d-20260614-review`,
    sourceRoot,
    namespace: FIXED_DEPLOY_NAMESPACE,
    workload: component,
    container: component,
    ownerRef: "medopl-platform",
    operationId: "op-package-d-release-plan-review",
    expectedVersionMarker: "v22-package-d-20260614-review",
    imageBuildPlan: {
      buildNow: false,
      pushNow: false,
      tagRule: "v22-package-d-YYYYMMDD-runid-gitsha",
      tcrRegistryShape: "registryRef/namespaceRef/region",
      digestReadbackRequiredBeforeDeploy: true,
    },
    manifestPlan: {
      deployment: true,
      service: true,
      config: true,
      secretRef: true,
      plainSecretValuesAllowed: false,
    },
    scheduling: {
      class: "platform_service_pool",
      nodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
      tenantPoolAllowed: false,
      nodeSelector: {
        "medopl.io/nodepool-role": "platform-service",
      },
    },
  };
}

function checkReleasePlan(plan = {}) {
  if (text(plan.runId) !== "pkg-d-release-plan-review-20260614") {
    return { ok: false, blockedReason: "release_plan_run_id_required" };
  }
  if (!/^v22-package-d-[0-9]{8}-[a-z0-9-]+$/u.test(text(plan.versionTag))) {
    return { ok: false, blockedReason: "release_plan_version_tag_rule_required" };
  }
  if (text(plan.versionTag).toLowerCase() === "latest") {
    return { ok: false, blockedReason: "release_plan_forbids_latest_tag" };
  }
  if (text(plan.registry?.region) !== "na-siliconvalley") {
    return { ok: false, blockedReason: "release_plan_tcr_region_required" };
  }
  if (!text(plan.registry?.registryRef) || !text(plan.registry?.namespaceRef)) {
    return { ok: false, blockedReason: "release_plan_tcr_registry_namespace_shape_required" };
  }
  if (text(plan.namespace) !== FIXED_DEPLOY_NAMESPACE) {
    return { ok: false, blockedReason: "release_plan_namespace_required" };
  }
  const targets = Array.isArray(plan.targets) ? plan.targets : [];
  const requiredComponents = new Set(["portal-frontend", "medopl-go-backend", "opl-web-gateway", "opl-runtime-bridge"]);
  if (targets.length < requiredComponents.size) {
    return { ok: false, blockedReason: "release_plan_image_targets_incomplete" };
  }
  for (const component of requiredComponents) {
    if (!targets.some((target) => target.component === component)) {
      return { ok: false, blockedReason: `release_plan_missing_component:${component}` };
    }
  }
  for (const target of targets) {
    if (target.targetClass !== "platform_service_target") {
      return { ok: false, blockedReason: "release_plan_platform_targets_required" };
    }
    if (target.namespace !== FIXED_DEPLOY_NAMESPACE) {
      return { ok: false, blockedReason: "release_plan_single_namespace_required" };
    }
    for (const field of ["repository", "imageTargetRef", "sourceRoot", "workload", "container", "ownerRef", "operationId", "expectedVersionMarker"]) {
      if (!text(target[field])) return { ok: false, blockedReason: `release_plan_target_field_required:${field}` };
    }
    if (!target.imageBuildPlan || target.imageBuildPlan.buildNow !== false || target.imageBuildPlan.pushNow !== false) {
      return { ok: false, blockedReason: "release_plan_image_build_push_must_be_non_executing" };
    }
    if (target.imageBuildPlan.tagRule !== "v22-package-d-YYYYMMDD-runid-gitsha") {
      return { ok: false, blockedReason: "release_plan_image_tag_rule_required" };
    }
    if (!target.manifestPlan || target.manifestPlan.deployment !== true || target.manifestPlan.service !== true || target.manifestPlan.config !== true || target.manifestPlan.secretRef !== true) {
      return { ok: false, blockedReason: "release_plan_manifest_shape_required" };
    }
    if (target.scheduling?.nodePoolId !== FIXED_PLATFORM_NODE_POOL_ID || target.scheduling?.tenantPoolAllowed !== false) {
      return { ok: false, blockedReason: "release_plan_platform_pool_scheduling_required" };
    }
    if (containsTenantPoolReference(target)) {
      return { ok: false, blockedReason: "release_plan_must_not_reference_tenant_pool" };
    }
  }
  const runtimeEnv = plan.runtimeEnv || {};
  if (runtimeEnv.postgresEndpoint !== FIXED_POSTGRES_ENDPOINT || runtimeEnv.portalPostgresUrlFromSecretRef !== true || runtimeEnv.dbPasswordInManifestPlaintext !== false) {
    return { ok: false, blockedReason: "release_plan_runtime_env_postgres_secret_boundary_required" };
  }
  const smoke = plan.dbConnectivitySmoke || {};
  if (smoke.timing !== "after_service_deployed_inside_tke_vpc" || smoke.target !== "postgres_ledger_sink" || smoke.executesNow !== false) {
    return { ok: false, blockedReason: "release_plan_db_connectivity_smoke_required" };
  }
  const rollback = plan.rollbackPlan || {};
  if (rollback.imageRollback !== true || rollback.kubernetesRolloutUndo !== true || rollback.configRollback !== true || rollback.dbMigrationPolicy !== "forward_only_or_explicit_rollback_authorization") {
    return { ok: false, blockedReason: "release_plan_rollback_policy_required" };
  }
  const evidence = plan.releaseEvidence || {};
  for (const key of ["buildEvidence", "pushEvidence", "deployEvidence", "smokeEvidence", "rollbackEvidence"]) {
    if (evidence[key] !== "required_redacted_runtime_evidence") {
      return { ok: false, blockedReason: `release_plan_evidence_required:${key}` };
    }
  }
  return {
    ok: true,
    blockedReason: "",
    summary: {
      releasePlanReady: true,
      realExecutionReady: false,
      imageTargets: targets.map((target) => target.component),
      namespace: FIXED_DEPLOY_NAMESPACE,
      platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
      postgresEndpoint: FIXED_POSTGRES_ENDPOINT,
      dbPasswordInManifestPlaintext: false,
      evidenceRequired: Object.keys(evidence).length,
      callsDockerNow: false,
      callsKubectlNow: false,
      readsKubeconfigNow: false,
      deploysNow: false,
      buildsOrPushesNow: false,
    },
  };
}

function checkConfig(content = "") {
  let env = {};
  try {
    env = parseDeployEnv(content);
  } catch (error) {
    return { ok: false, blockedReason: String(error?.message || "deploy_config_parse_failed") };
  }
  const missing = [...PACKAGE_D_SECRET_KEYS].filter((key) => !text(env[key]));
  if (missing.length) return { ok: false, blockedReason: "deploy_secret_allowlist_incomplete" };
  if (text(env.TENCENT_DEPLOY_CLUSTER_ID) !== FIXED_DEPLOY_CLUSTER_ID) {
    return { ok: false, blockedReason: "deploy_cluster_id_mismatch" };
  }
  if (postgresEndpoint(env.PORTAL_POSTGRES_URL) !== FIXED_POSTGRES_ENDPOINT) {
    return { ok: false, blockedReason: "deploy_postgres_vpc_endpoint_required" };
  }
  if (text(env.RUN_TENCENT_DEPLOY_EXECUTION) !== "0") {
    return { ok: false, blockedReason: "deploy_run_gate_must_remain_zero_for_local_shape" };
  }
  if (looksLikeRawKubeconfig(env.TENCENT_DEPLOY_KUBECONFIG_REF)) {
    return { ok: false, blockedReason: "deploy_kubeconfig_ref_must_not_embed_yaml" };
  }
  return {
    ok: true,
    blockedReason: "",
    summary: {
      registry: "redacted",
      namespace: "redacted",
      region: text(env.TENCENT_TCR_REGION),
      deployClusterId: text(env.TENCENT_DEPLOY_CLUSTER_ID),
      platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
      postgresEndpoint: FIXED_POSTGRES_ENDPOINT,
      postgresUrl: "redacted",
      postgresPassword: "redacted",
      postgresCanaryTiming: "after_service_deployed_inside_vpc",
      readinessGaps: READINESS_GAPS,
      runTencentDeployExecutionDefault: "0",
      callsDockerNow: false,
      callsKubectlNow: false,
      readsKubeconfigNow: false,
      deploysNow: false,
      buildsOrPushesNow: false,
      realPackageDExecution: false,
    },
  };
}

function checkPortalRuntimeEnv(content = "") {
  let env = {};
  try {
    env = parseAllowlistedEnv(content, PORTAL_RUNTIME_SECRET_KEYS);
  } catch (error) {
    return { ok: false, blockedReason: String(error?.message || "portal_runtime_env_parse_failed") };
  }
  const missing = [...PORTAL_RUNTIME_SECRET_KEYS].filter((key) => !text(env[key]));
  if (missing.length) return { ok: false, blockedReason: "portal_runtime_env_allowlist_incomplete" };
  if (postgresEndpoint(env.PORTAL_POSTGRES_URL) !== FIXED_POSTGRES_ENDPOINT) {
    return { ok: false, blockedReason: "portal_runtime_postgres_vpc_endpoint_required" };
  }
  return {
    ok: true,
    blockedReason: "",
    summary: {
      postgresEndpoint: FIXED_POSTGRES_ENDPOINT,
      postgresUrl: "redacted",
      postgresPassword: "redacted",
    },
  };
}

function checkManifestPlan(plan = {}) {
  if (text(plan.clusterId) !== FIXED_DEPLOY_CLUSTER_ID) {
    return { ok: false, blockedReason: "manifest_cluster_id_mismatch" };
  }
  if (plan?.schedulingTarget?.class !== "platform_service_pool") {
    return { ok: false, blockedReason: "manifest_must_target_platform_service_pool" };
  }
  if (text(plan?.schedulingTarget?.nodePoolId) !== FIXED_PLATFORM_NODE_POOL_ID) {
    return { ok: false, blockedReason: "manifest_platform_pool_id_mismatch" };
  }
  if (containsTenantPoolReference(plan.schedulingTarget)) {
    return { ok: false, blockedReason: "manifest_must_not_target_tenant_pool" };
  }
  if (text(plan?.dbTarget?.endpoint) !== FIXED_POSTGRES_ENDPOINT) {
    return { ok: false, blockedReason: "manifest_postgres_vpc_endpoint_required" };
  }
  if (!plan.rollbackPlan || !text(plan.rollbackPlan.owner) || !text(plan.rollbackPlan.strategy)) {
    return { ok: false, blockedReason: "manifest_rollback_plan_required" };
  }
  if (containsTenantPoolReference(plan.rollbackPlan)) {
    return { ok: false, blockedReason: "rollback_plan_must_not_target_tenant_pool" };
  }
  return {
    ok: true,
    blockedReason: "",
    summary: {
      deployClusterId: FIXED_DEPLOY_CLUSTER_ID,
      manifestSchedulingTarget: "platform_service_pool",
      platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
      tenantSchedulingAllowed: false,
      postgresEndpoint: FIXED_POSTGRES_ENDPOINT,
      rollbackPlanPresent: true,
    },
  };
}

function checkLocalShapeGate({ deployEnv, portalRuntimeEnv, manifestPlan }) {
  const failed = [deployEnv, portalRuntimeEnv, manifestPlan].find((item) => !item?.ok);
  if (failed) return { ok: false, blockedReason: failed.blockedReason || "package_d_local_shape_gate_failed" };
  return {
    ok: true,
    blockedReason: "",
    summary: {
      runTencentDeployExecution: "0",
      deployClusterId: FIXED_DEPLOY_CLUSTER_ID,
      platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
      postgresEndpoint: FIXED_POSTGRES_ENDPOINT,
      manifestSchedulingTarget: manifestPlan.summary.manifestSchedulingTarget,
      tenantSchedulingAllowed: false,
      rollbackPlanPresent: true,
      callsDockerNow: false,
      callsKubectlNow: false,
      readsKubeconfigNow: false,
      deploysNow: false,
      buildsOrPushesNow: false,
      realPackageDExecution: false,
    },
  };
}

const checked = [
  {
    file: "package-d-deploy.env",
    result: checkConfig([
      "RUN_TENCENT_DEPLOY_EXECUTION=0",
      "TCR_ID=deploy-id-proof",
      "TCR_SECRET=$TCR_SECRET",
      "TENCENT_TCR_REGISTRY=registry-proof.example.tencentcloudcr.com",
      "TENCENT_TCR_NAMESPACE=namespace-proof",
      "TENCENT_TCR_REGION=na-siliconvalley",
      "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
      "TENCENT_DEPLOY_KUBECONFIG_REF=kubeconfig-ref-proof",
      "PORTAL_POSTGRES_URL=postgresql://medopl:$PORTAL_POSTGRES_PASSWORD@10.66.0.21:5432/medopl",
      "PORTAL_POSTGRES_PASSWORD=$PORTAL_POSTGRES_PASSWORD",
    ].join("\n")),
  },
  {
    file: "package-d-deploy-execution-enabled.env",
    result: checkConfig([
      "RUN_TENCENT_DEPLOY_EXECUTION=1",
      "TCR_ID=deploy-id-proof",
      "TCR_SECRET=$TCR_SECRET",
      "TENCENT_TCR_REGISTRY=registry-proof.example.tencentcloudcr.com",
      "TENCENT_TCR_NAMESPACE=namespace-proof",
      "TENCENT_TCR_REGION=na-siliconvalley",
      "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
      "TENCENT_DEPLOY_KUBECONFIG_REF=kubeconfig-ref-proof",
      "PORTAL_POSTGRES_URL=postgresql://medopl:$PORTAL_POSTGRES_PASSWORD@10.66.0.21:5432/medopl",
      "PORTAL_POSTGRES_PASSWORD=$PORTAL_POSTGRES_PASSWORD",
    ].join("\n")),
  },
  {
    file: "package-d-deploy-raw-kubeconfig.env",
    result: checkConfig([
      "RUN_TENCENT_DEPLOY_EXECUTION=0",
      "TCR_ID=deploy-id-proof",
      "TCR_SECRET=$TCR_SECRET",
      "TENCENT_TCR_REGISTRY=registry-proof.example.tencentcloudcr.com",
      "TENCENT_TCR_NAMESPACE=namespace-proof",
      "TENCENT_TCR_REGION=na-siliconvalley",
      "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
      "TENCENT_DEPLOY_KUBECONFIG_REF=apiVersion: v1\\nkind: Config\\nclusters: []",
      "PORTAL_POSTGRES_URL=postgresql://medopl:$PORTAL_POSTGRES_PASSWORD@10.66.0.21:5432/medopl",
      "PORTAL_POSTGRES_PASSWORD=$PORTAL_POSTGRES_PASSWORD",
    ].join("\n")),
  },
  {
    file: "package-c-mutation.env",
    result: checkConfig([
      "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
      "TENCENT_MUTATION_SECRET_ID=$TENCENT_MUTATION_SECRET_ID",
    ].join("\n")),
  },
  {
    file: "readonly.env",
    result: checkConfig([
      "RUN_TENCENT_READONLY_INVENTORY=1",
      "TENCENT_READONLY_SECRET_ID=$TENCENT_READONLY_SECRET_ID",
    ].join("\n")),
  },
];

const accepted = checked.find((item) => item.result.ok);
const localShapeGate = checkLocalShapeGate({
  deployEnv: checked.find((item) => item.file === "package-d-deploy.env").result,
  portalRuntimeEnv: checkPortalRuntimeEnv([
    "PORTAL_POSTGRES_URL=postgresql://medopl:$PORTAL_POSTGRES_PASSWORD@10.66.0.21:5432/medopl",
    "PORTAL_POSTGRES_PASSWORD=$PORTAL_POSTGRES_PASSWORD",
  ].join("\n")),
  manifestPlan: checkManifestPlan({
    clusterId: "cls-fi097sy4",
    schedulingTarget: {
      class: "platform_service_pool",
      nodePoolId: "np-cbk784r8",
      nodeSelector: {
        "medopl.io/nodepool-role": "platform-service",
      },
    },
    dbTarget: {
      endpoint: "10.66.0.21:5432",
    },
    rollbackPlan: {
      owner: "MedOPL Operations",
      strategy: "roll_back_to_previous_image_ref",
      previousImageRefRequired: true,
    },
  }),
});
const releasePlan = checkReleasePlan({
  runId: "pkg-d-release-plan-review-20260614",
  versionTag: "v22-package-d-20260614-review",
  registry: {
    registryRef: "tcr-registry-ref",
    namespaceRef: "tcr-namespace-ref",
    region: "na-siliconvalley",
  },
  namespace: "medopl-platform",
  targets: [
    releaseTarget({
      component: "portal-frontend",
      sourceRoot: "services/portal/frontend",
    }),
    releaseTarget({
      component: "medopl-go-backend",
      sourceRoot: "services/medopl-go-backend",
    }),
    releaseTarget({
      component: "opl-web-gateway",
      sourceRoot: "services/opl-web-gateway",
    }),
    releaseTarget({
      component: "opl-runtime-bridge",
      sourceRoot: "services/opl-runtime-bridge",
    }),
  ],
  runtimeEnv: {
    postgresEndpoint: "10.66.0.21:5432",
    portalPostgresUrlFromSecretRef: true,
    dbPasswordInManifestPlaintext: false,
    secretCommittedToGit: false,
  },
  dbConnectivitySmoke: {
    timing: "after_service_deployed_inside_tke_vpc",
    target: "postgres_ledger_sink",
    executesNow: false,
    verifies: [
      "DB reachable",
      "schema/table/write permission",
      "canary resource binding write/read/cleanup",
    ],
  },
  rollbackPlan: {
    imageRollback: true,
    kubernetesRolloutUndo: true,
    configRollback: true,
    dbMigrationPolicy: "forward_only_or_explicit_rollback_authorization",
  },
  releaseEvidence: {
    buildEvidence: "required_redacted_runtime_evidence",
    pushEvidence: "required_redacted_runtime_evidence",
    deployEvidence: "required_redacted_runtime_evidence",
    smokeEvidence: "required_redacted_runtime_evidence",
    rollbackEvidence: "required_redacted_runtime_evidence",
  },
});

assert(localShapeGate.ok, "package_d_local_shape_gate_must_accept_default_disabled_non_executing_shape");
assert(releasePlan.ok, "package_d_release_plan_must_be_reviewable_without_real_execution");
assert(accepted, "deploy_config_gate_must_accept_package_d_allowlist");
assert.equal(accepted.result.summary.callsDockerNow, false, "config_gate_must_not_call_docker");
assert.equal(accepted.result.summary.callsKubectlNow, false, "config_gate_must_not_call_kubectl");
assert.equal(accepted.result.summary.readsKubeconfigNow, false, "config_gate_must_not_read_kubeconfig");
assert.equal(accepted.result.summary.deploysNow, false, "config_gate_must_not_deploy");
assert.equal(accepted.result.summary.buildsOrPushesNow, false, "config_gate_must_not_build_or_push");
assert.equal(accepted.result.summary.realPackageDExecution, false, "local_shape_gate_must_not_enter_package_d_execution");
assert.equal(checked.find((item) => item.file === "package-c-mutation.env").result.blockedReason.startsWith("tencent_deploy_forbidden_secret_key:"), true, "package_c_secret_must_be_rejected");
assert.equal(checked.find((item) => item.file === "readonly.env").result.blockedReason.startsWith("tencent_deploy_forbidden_secret_key:"), true, "readonly_secret_must_be_rejected");
assert.equal(checked.find((item) => item.file === "package-d-deploy-execution-enabled.env").result.blockedReason, "deploy_run_gate_must_remain_zero_for_local_shape", "deploy_execution_enabled_gate_must_be_rejected_by_local_shape");
assert.equal(checked.find((item) => item.file === "package-d-deploy-raw-kubeconfig.env").result.blockedReason, "deploy_kubeconfig_ref_must_not_embed_yaml", "raw_kubeconfig_yaml_must_be_rejected");
assert.equal(JSON.stringify(checked).includes("$TCR_SECRET"), false, "config_gate_output_must_be_redacted");
assert.equal(JSON.stringify(checked).includes("$PORTAL_POSTGRES_PASSWORD"), false, "config_gate_output_must_not_expose_postgres_password");
assert.equal(JSON.stringify(checked).includes("postgresql://"), false, "config_gate_output_must_not_expose_postgres_url");
assert.equal(JSON.stringify(checked).includes("kubeconfig-ref-proof"), false, "config_gate_output_must_not_expose_kubeconfig_ref");
assert.equal(localShapeGate.summary.runTencentDeployExecution, "0", "local_shape_gate_must_require_deploy_execution_zero");
assert.equal(localShapeGate.summary.manifestSchedulingTarget, "platform_service_pool", "manifest_must_target_platform_service_pool");
assert.equal(localShapeGate.summary.tenantSchedulingAllowed, false, "manifest_must_not_target_tenant_pool");
assert.equal(localShapeGate.summary.rollbackPlanPresent, true, "rollback_plan_must_exist");
assert.equal(releasePlan.summary.releasePlanReady, true, "release_plan_ready_must_be_true_after_reviewable_plan_shape");
assert.equal(releasePlan.summary.realExecutionReady, false, "release_plan_must_not_authorize_real_execution");
assert.deepEqual(releasePlan.summary.imageTargets, ["portal-frontend", "medopl-go-backend", "opl-web-gateway", "opl-runtime-bridge"], "release_plan_must_list_image_targets");
assert.equal(releasePlan.summary.dbPasswordInManifestPlaintext, false, "release_plan_must_not_put_db_password_in_manifest_plaintext");
assert.equal(accepted.result.summary.deployClusterId, "cls-fi097sy4", "deploy_readiness_cluster_must_be_fixed");
assert.equal(accepted.result.summary.platformNodePoolId, "np-cbk784r8", "deploy_readiness_platform_pool_must_be_fixed");
assert.equal(accepted.result.summary.postgresEndpoint, "10.66.0.21:5432", "deploy_readiness_postgres_must_use_vpc_endpoint");
assert.equal(accepted.result.summary.postgresCanaryTiming, "after_service_deployed_inside_vpc", "deploy_readiness_db_canary_must_wait_for_vpc_runtime");
assert.deepEqual(accepted.result.summary.readinessGaps, [
  "image build",
  "TCR push",
  "Kubernetes manifests",
  "platform pool scheduling",
  "DB connectivity smoke",
  "rollback plan",
], "deploy_readiness_gap_list_must_be_explicit");
assert.equal(accepted.result.summary.runTencentDeployExecutionDefault, "0", "deploy_readiness_run_gate_default_must_stay_zero");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_deploy_execution_config_local_gate",
  checked: checked.map((item) => ({
    file: item.file,
    ok: item.result.ok,
    blockedReason: item.result.blockedReason,
  })),
  configGateReady: true,
  liveReady: false,
  localShapeGateReady: localShapeGate.ok,
  manifestShapeReady: true,
  rollbackPlanReady: true,
  releasePlanReady: releasePlan.summary.releasePlanReady,
  realExecutionReady: false,
  imageTargets: releasePlan.summary.imageTargets,
  requiresKubeApiserverConnectivity: true,
  acceptedSecretFile: accepted.file,
  blockedReason: "needs_reviewed_real_release_plan_kube_apiserver_connectivity_dry_run_acceptance_and_explicit_authorization",
}, null, 2));
