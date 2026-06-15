import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE,
  writePackageDRunnerShapeReport,
} from "../../support/cloud-prework/package-d-in-cluster-platform-runner-shape.js";

const FIXED_DEPLOY_CLUSTER_ID = "cls-fi097sy4";
const FIXED_PLATFORM_NODE_POOL_ID = "np-6l4nkdto";
const LEGACY_PROTECTED_PLATFORM_NODE_POOL_ID = "np-cbk784r8";
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

const DEPLOY_RUNNER_PLACEMENT_PLAN = Object.freeze({
  status: "placement_plan_only",
  preferredExecutionLocation: "tke_in_cluster_platform_runner",
  preferredRunnerName: "medopl-platform-runner",
  clusterId: FIXED_DEPLOY_CLUSTER_ID,
  namespace: FIXED_DEPLOY_NAMESPACE,
  platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
  legacyProtectedPlatformNodePoolId: LEGACY_PROTECTED_PLATFORM_NODE_POOL_ID,
  runnerMachineId: "np-6l4nkdto-2cdtm",
  runnerNodeIp: "10.66.0.42",
  schedulingTarget: "platform_service_pool",
  purpose: Object.freeze([
    "deploy/smoke inside TKE platform pool",
    "DB connectivity smoke inside VPC",
    "rollback",
  ]),
  buildPushPlan: Object.freeze({
    executionLocation: "github_actions_workflow_dispatch",
    separatedFromDeploySmoke: true,
    imageTargets: Object.freeze([
      "portal-frontend",
      "medopl-go-backend",
      "opl-web-gateway",
      "opl-runtime-bridge",
    ]),
    allowedMethods: Object.freeze([
      "GitHub Actions workflow_dispatch",
      "future Kaniko/BuildKit",
    ]),
    executesNow: false,
  }),
  deploySmokePlan: Object.freeze({
    executionLocation: "tke_in_cluster_platform_runner",
    clusterId: FIXED_DEPLOY_CLUSTER_ID,
    namespace: FIXED_DEPLOY_NAMESPACE,
    platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
    legacyProtectedPlatformNodePoolId: LEGACY_PROTECTED_PLATFORM_NODE_POOL_ID,
    schedulingTarget: "platform_service_pool",
    allowedActionsAfterAuthorization: Object.freeze([
      "Kubernetes API connectivity preflight",
      "PostgreSQL ledger canary",
      "Package D combined preflight",
      "deploy/smoke",
      "rollback",
    ]),
    executesNow: false,
  }),
  inClusterPlatformRunnerShape: PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE,
  requiredRuntimeTools: Object.freeze([
    "kubectl",
    "PostgreSQL client or ledger canary runner",
  ]),
  secretPaths: Object.freeze([
    "/home/dev/.secrets/medopl/v22/package-d-deploy.env",
    "/home/dev/.secrets/medopl/v22/portal-runtime.env",
    "/home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy",
  ]),
  safetyBoundary: Object.freeze({
    postgresPublicAccess: false,
    tkeApiPublicAccess: false,
    defaultExtraCvmRunner: false,
    runnerStateCommittedToGit: false,
    tenantPoolSchedulingAllowed: false,
  }),
  preflightOrder: Object.freeze([
    "GitHub Actions workflow_dispatch publishes the fixed Package D runner image tag",
    "Kubernetes API connectivity preflight from TKE platform runner",
    "PostgreSQL ledger canary from TKE platform runner",
    "Package D combined preflight from TKE platform runner",
  ]),
  vpcCvmRunnerFallback: Object.freeze({
    status: "fallback_only_not_default",
    cvm: Object.freeze({
      name: "medopl-v22-deploy-runner",
      region: "na-siliconvalley",
      vpc: "medopl-vpc",
      subnet: "medopl-private-a",
      os: "Ubuntu LTS or TencentOS",
      size: "2C4G",
      disk: "50GB",
      publicIp: "disabled_by_default_temporary_operator_ip_only_for_ssh",
    }),
    securityGroup: Object.freeze({
      inbound: "minimal",
      sshIngress: "operator_ip_only_when_temporarily_enabled",
      outbound: Object.freeze([
        "TCR",
        "TKE API private endpoint",
        "PostgreSQL 10.66.0.21:5432",
      ]),
    }),
    installTools: Object.freeze([
      "git",
      "node/npm",
      "go",
      "docker",
      "kubectl",
    ]),
    secretPaths: Object.freeze([
      "/home/dev/.secrets/medopl/v22/package-d-deploy.env",
      "/home/dev/.secrets/medopl/v22/portal-runtime.env",
      "/home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy",
    ]),
    validationOrder: Object.freeze([
      "docker version",
      "kubectl version --client",
      "fallback TCR login preflight",
      "fallback Kubernetes API connectivity preflight",
      "fallback PostgreSQL ledger canary",
      "fallback Package D combined preflight",
    ]),
    forbiddenNow: Object.freeze([
      "CVM create",
      "Tencent mutation",
      "deploy",
      "build/push",
      "kubectl",
    ]),
  }),
  realExecutionReady: false,
});
const currentGoal = JSON.parse(readFileSync(new URL("../../fixtures/v22/goal-current.json", import.meta.url), "utf8"));

const PACKAGE_D_SECRET_KEY_LIST = Object.freeze([
  "RUN_TENCENT_DEPLOY_EXECUTION",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_TCR_REGISTRY",
  "TENCENT_TCR_NAMESPACE",
  "TENCENT_TCR_REGION",
  "TENCENT_DEPLOY_CLUSTER_ID",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
  "PACKAGE_D_RUNNER_IMAGE_REF",
]);

const PORTAL_RUNTIME_SECRET_KEY_LIST = Object.freeze([
  "PORTAL_ADMIN_EMAIL",
  "PORTAL_ADMIN_NAME",
  "PORTAL_ADMIN_PASSWORD",
  "PORTAL_POSTGRES_URL",
  "PORTAL_POSTGRES_PASSWORD",
]);

const PACKAGE_D_SECRET_KEYS = new Set(PACKAGE_D_SECRET_KEY_LIST);
const PORTAL_RUNTIME_SECRET_KEYS = new Set(PORTAL_RUNTIME_SECRET_KEY_LIST);

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
        "node.tke.cloud.tencent.com/machineset": FIXED_PLATFORM_NODE_POOL_ID,
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
      kubeconfigRef: "redacted",
      platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
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
      adminEmail: "redacted",
      adminName: "redacted",
      adminPassword: "redacted",
      postgresEndpoint: FIXED_POSTGRES_ENDPOINT,
      postgresUrl: "redacted",
      postgresPassword: "redacted",
      postgresCanaryTiming: "after_service_deployed_inside_vpc",
    },
  };
}

function checkManifestPlan(plan = {}) {
  if (text(plan.clusterId) !== FIXED_DEPLOY_CLUSTER_ID) {
    return { ok: false, blockedReason: "manifest_cluster_id_mismatch" };
  }
  if (text(plan.namespace) !== FIXED_DEPLOY_NAMESPACE) {
    return { ok: false, blockedReason: "manifest_namespace_required" };
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
      namespace: FIXED_DEPLOY_NAMESPACE,
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
      namespace: FIXED_DEPLOY_NAMESPACE,
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

function checkExecutionPreflightGate({ deployEnv, portalRuntimeEnv, manifestPlan, releasePlan }) {
  const failed = [deployEnv, portalRuntimeEnv, manifestPlan, releasePlan].find((item) => !item?.ok);
  if (failed) return { ok: false, blockedReason: failed.blockedReason || "package_d_execution_preflight_gate_failed" };
  return {
    ok: true,
    blockedReason: "",
    summary: {
      executionPreflightGateReady: true,
      releasePlanReady: releasePlan.summary.releasePlanReady,
      realExecutionReady: false,
      packageDExecutionReady: false,
      runTencentDeployExecution: "0",
      deployClusterId: FIXED_DEPLOY_CLUSTER_ID,
      namespace: FIXED_DEPLOY_NAMESPACE,
      platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
      postgresEndpoint: FIXED_POSTGRES_ENDPOINT,
      imageTargets: releasePlan.summary.imageTargets,
      callsDockerNow: false,
      callsKubectlNow: false,
      readsKubeconfigNow: false,
      deploysNow: false,
      buildsOrPushesNow: false,
      executesTencentMutationNow: false,
      redactedEvidence: {
        deployEnv: {
          runTencentDeployExecution: "0",
          tcrId: "redacted",
          tcrSecret: "redacted",
          registry: "redacted",
          namespace: "redacted",
          region: "na-siliconvalley",
          clusterId: FIXED_DEPLOY_CLUSTER_ID,
          kubeconfigRef: "redacted",
        },
        portalRuntimeEnv: {
          adminEmail: "redacted",
          adminName: "redacted",
          adminPassword: "redacted",
          postgresEndpoint: FIXED_POSTGRES_ENDPOINT,
          postgresUrl: "redacted",
          postgresPassword: "redacted",
        },
        manifest: {
          namespace: FIXED_DEPLOY_NAMESPACE,
          schedulingTarget: "platform_service_pool",
          platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
          tenantPoolSchedulingAllowed: false,
        },
      },
      redactionAudit: {
        tcrSecretExposed: false,
        portalAdminPasswordExposed: false,
        portalPostgresPasswordExposed: false,
        fullDbUrlExposed: false,
        kubeconfigExposed: false,
      },
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
      "PACKAGE_D_RUNNER_IMAGE_REF=registry-proof.example.tencentcloudcr.com/namespace-proof/medopl-platform-runner:v22-package-d-proof",
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
      "PACKAGE_D_RUNNER_IMAGE_REF=registry-proof.example.tencentcloudcr.com/namespace-proof/medopl-platform-runner:v22-package-d-proof",
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
      "PACKAGE_D_RUNNER_IMAGE_REF=registry-proof.example.tencentcloudcr.com/namespace-proof/medopl-platform-runner:v22-package-d-proof",
    ].join("\n")),
  },
  {
    file: "package-d-deploy-with-runtime-secret.env",
    result: checkConfig([
      "RUN_TENCENT_DEPLOY_EXECUTION=0",
      "TCR_ID=deploy-id-proof",
      "TCR_SECRET=$TCR_SECRET",
      "TENCENT_TCR_REGISTRY=registry-proof.example.tencentcloudcr.com",
      "TENCENT_TCR_NAMESPACE=namespace-proof",
      "TENCENT_TCR_REGION=na-siliconvalley",
      "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
      "TENCENT_DEPLOY_KUBECONFIG_REF=kubeconfig-ref-proof",
      "PACKAGE_D_RUNNER_IMAGE_REF=registry-proof.example.tencentcloudcr.com/namespace-proof/medopl-platform-runner:v22-package-d-proof",
      "PORTAL_POSTGRES_URL=postgresql://medopl:$PORTAL_POSTGRES_PASSWORD@10.66.0.21:5432/medopl",
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
const portalRuntimeEnv = checkPortalRuntimeEnv([
  "PORTAL_ADMIN_EMAIL=admin@example.invalid",
  "PORTAL_ADMIN_NAME=MedOPL Admin",
  "PORTAL_ADMIN_PASSWORD=$PORTAL_ADMIN_PASSWORD",
  "PORTAL_POSTGRES_URL=postgresql://medopl:$PORTAL_POSTGRES_PASSWORD@10.66.0.21:5432/medopl",
  "PORTAL_POSTGRES_PASSWORD=$PORTAL_POSTGRES_PASSWORD",
].join("\n"));
const localShapeGate = checkLocalShapeGate({
  deployEnv: checked.find((item) => item.file === "package-d-deploy.env").result,
  portalRuntimeEnv,
  manifestPlan: checkManifestPlan({
    clusterId: "cls-fi097sy4",
    namespace: "medopl-platform",
    schedulingTarget: {
      class: "platform_service_pool",
      nodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
      nodeSelector: {
        "node.tke.cloud.tencent.com/machineset": FIXED_PLATFORM_NODE_POOL_ID,
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
const portalRuntimeMissingAdmin = checkPortalRuntimeEnv([
  "PORTAL_POSTGRES_URL=postgresql://medopl:$PORTAL_POSTGRES_PASSWORD@10.66.0.21:5432/medopl",
  "PORTAL_POSTGRES_PASSWORD=$PORTAL_POSTGRES_PASSWORD",
].join("\n"));
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
const executionPreflightGate = checkExecutionPreflightGate({
  deployEnv: checked.find((item) => item.file === "package-d-deploy.env").result,
  portalRuntimeEnv,
  manifestPlan: checkManifestPlan({
    clusterId: "cls-fi097sy4",
    namespace: "medopl-platform",
    schedulingTarget: {
      class: "platform_service_pool",
      nodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
      nodeSelector: {
        "node.tke.cloud.tencent.com/machineset": FIXED_PLATFORM_NODE_POOL_ID,
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
  releasePlan,
});

assert(localShapeGate.ok, "package_d_local_shape_gate_must_accept_default_disabled_non_executing_shape");
assert(releasePlan.ok, "package_d_release_plan_must_be_reviewable_without_real_execution");
assert(executionPreflightGate.ok, "package_d_execution_preflight_gate_must_accept_redacted_non_executing_boundary");
assert(accepted, "deploy_config_gate_must_accept_package_d_allowlist");
assert.deepEqual([...PACKAGE_D_SECRET_KEYS], PACKAGE_D_SECRET_KEY_LIST, "package_d_deploy_env_allowlist_must_be_exact");
assert.deepEqual([...PORTAL_RUNTIME_SECRET_KEYS], PORTAL_RUNTIME_SECRET_KEY_LIST, "portal_runtime_env_allowlist_must_be_exact");
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
assert.equal(checked.find((item) => item.file === "package-d-deploy-with-runtime-secret.env").result.blockedReason, "tencent_deploy_non_allowlist_secret_key_rejected:PORTAL_POSTGRES_URL", "deploy_env_must_not_accept_portal_runtime_keys");
assert.equal(portalRuntimeMissingAdmin.blockedReason, "portal_runtime_env_allowlist_incomplete", "portal_runtime_env_must_require_admin_keys");
assert.equal(JSON.stringify(checked).includes("$TCR_SECRET"), false, "config_gate_output_must_be_redacted");
assert.equal(JSON.stringify(executionPreflightGate).includes("$TCR_SECRET"), false, "execution_preflight_evidence_must_not_expose_tcr_secret");
assert.equal(JSON.stringify(executionPreflightGate).includes("$PORTAL_ADMIN_PASSWORD"), false, "execution_preflight_evidence_must_not_expose_admin_password");
assert.equal(JSON.stringify(checked).includes("$PORTAL_POSTGRES_PASSWORD"), false, "config_gate_output_must_not_expose_postgres_password");
assert.equal(JSON.stringify(executionPreflightGate).includes("$PORTAL_POSTGRES_PASSWORD"), false, "execution_preflight_evidence_must_not_expose_postgres_password");
assert.equal(JSON.stringify(checked).includes("postgresql://"), false, "config_gate_output_must_not_expose_postgres_url");
assert.equal(JSON.stringify(executionPreflightGate).includes("postgresql://"), false, "execution_preflight_evidence_must_not_expose_postgres_url");
assert.equal(JSON.stringify(checked).includes("kubeconfig-ref-proof"), false, "config_gate_output_must_not_expose_kubeconfig_ref");
assert.equal(JSON.stringify(executionPreflightGate).includes("kubeconfig-ref-proof"), false, "execution_preflight_evidence_must_not_expose_kubeconfig_ref");
assert.equal(localShapeGate.summary.runTencentDeployExecution, "0", "local_shape_gate_must_require_deploy_execution_zero");
assert.equal(localShapeGate.summary.namespace, "medopl-platform", "local_shape_gate_namespace_must_be_fixed");
assert.equal(localShapeGate.summary.manifestSchedulingTarget, "platform_service_pool", "manifest_must_target_platform_service_pool");
assert.equal(localShapeGate.summary.tenantSchedulingAllowed, false, "manifest_must_not_target_tenant_pool");
assert.equal(localShapeGate.summary.rollbackPlanPresent, true, "rollback_plan_must_exist");
assert.equal(releasePlan.summary.releasePlanReady, true, "release_plan_ready_must_be_true_after_reviewable_plan_shape");
assert.equal(releasePlan.summary.realExecutionReady, false, "release_plan_must_not_authorize_real_execution");
assert.deepEqual(releasePlan.summary.imageTargets, ["portal-frontend", "medopl-go-backend", "opl-web-gateway", "opl-runtime-bridge"], "release_plan_must_list_image_targets");
assert.equal(releasePlan.summary.dbPasswordInManifestPlaintext, false, "release_plan_must_not_put_db_password_in_manifest_plaintext");
assert.equal(accepted.result.summary.deployClusterId, "cls-fi097sy4", "deploy_readiness_cluster_must_be_fixed");
assert.equal(accepted.result.summary.platformNodePoolId, FIXED_PLATFORM_NODE_POOL_ID, "deploy_readiness_platform_runner_pool_must_be_fixed");
assert.equal(portalRuntimeEnv.summary.postgresEndpoint, "10.66.0.21:5432", "portal_runtime_postgres_must_use_vpc_endpoint");
assert.equal(portalRuntimeEnv.summary.postgresCanaryTiming, "after_service_deployed_inside_vpc", "deploy_readiness_db_canary_must_wait_for_vpc_runtime");
assert.deepEqual(accepted.result.summary.readinessGaps, [
  "image build",
  "TCR push",
  "Kubernetes manifests",
  "platform pool scheduling",
  "DB connectivity smoke",
  "rollback plan",
], "deploy_readiness_gap_list_must_be_explicit");
assert.equal(accepted.result.summary.runTencentDeployExecutionDefault, "0", "deploy_readiness_run_gate_default_must_stay_zero");
assert.equal(executionPreflightGate.summary.executionPreflightGateReady, true, "execution_preflight_gate_must_be_ready_to_judge_allowlisted_inputs");
assert.equal(executionPreflightGate.summary.realExecutionReady, false, "execution_preflight_gate_must_not_mark_real_execution_ready");
assert.equal(executionPreflightGate.summary.packageDExecutionReady, false, "execution_preflight_gate_must_not_enter_package_d_execution");
assert.equal(executionPreflightGate.summary.redactionAudit.tcrSecretExposed, false, "redaction_audit_must_hide_tcr_secret");
assert.equal(executionPreflightGate.summary.redactionAudit.portalAdminPasswordExposed, false, "redaction_audit_must_hide_admin_password");
assert.equal(executionPreflightGate.summary.redactionAudit.portalPostgresPasswordExposed, false, "redaction_audit_must_hide_postgres_password");
assert.equal(executionPreflightGate.summary.redactionAudit.fullDbUrlExposed, false, "redaction_audit_must_hide_full_db_url");
assert.equal(executionPreflightGate.summary.redactionAudit.kubeconfigExposed, false, "redaction_audit_must_hide_kubeconfig");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.status, "placement_plan_only", "deploy_runner_placement_must_stay_plan_only");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.preferredExecutionLocation, "tke_in_cluster_platform_runner", "deploy_runner_preferred_location_must_be_tke_in_cluster");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.preferredRunnerName, "medopl-platform-runner", "deploy_runner_preferred_runner_name_must_be_platform_runner");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.clusterId, "cls-fi097sy4", "deploy_runner_preferred_cluster_must_be_fixed");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.namespace, "medopl-platform", "deploy_runner_preferred_namespace_must_be_fixed");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.platformNodePoolId, FIXED_PLATFORM_NODE_POOL_ID, "deploy_runner_preferred_platform_runner_pool_must_be_fixed");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.schedulingTarget, "platform_service_pool", "deploy_runner_preferred_scheduling_must_target_platform_pool");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.purpose, [
  "deploy/smoke inside TKE platform pool",
  "DB connectivity smoke inside VPC",
  "rollback",
], "deploy_runner_preferred_purpose_must_cover_deploy_smoke_loop");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.buildPushPlan.executionLocation, "github_actions_workflow_dispatch", "build_push_must_be_separate_from_in_cluster_deploy_smoke");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.buildPushPlan.separatedFromDeploySmoke, true, "build_push_and_deploy_smoke_must_be_separate");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.buildPushPlan.imageTargets, [
  "portal-frontend",
  "medopl-go-backend",
  "opl-web-gateway",
  "opl-runtime-bridge",
], "build_push_plan_must_keep_image_targets");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.buildPushPlan.allowedMethods, [
  "GitHub Actions workflow_dispatch",
  "future Kaniko/BuildKit",
], "build_push_plan_must_allow_github_actions_or_future_in_cluster_builder");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.buildPushPlan.executesNow, false, "build_push_plan_must_not_execute_now");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.deploySmokePlan, {
  executionLocation: "tke_in_cluster_platform_runner",
  clusterId: "cls-fi097sy4",
  namespace: "medopl-platform",
  platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
  legacyProtectedPlatformNodePoolId: LEGACY_PROTECTED_PLATFORM_NODE_POOL_ID,
  schedulingTarget: "platform_service_pool",
  allowedActionsAfterAuthorization: [
    "Kubernetes API connectivity preflight",
    "PostgreSQL ledger canary",
    "Package D combined preflight",
    "deploy/smoke",
    "rollback",
  ],
  executesNow: false,
}, "deploy_smoke_plan_must_run_inside_platform_pool_after_authorization");
const runnerShape = DEPLOY_RUNNER_PLACEMENT_PLAN.inClusterPlatformRunnerShape;
assert.equal(runnerShape.status, "shape_gate_only", "in_cluster_platform_runner_shape_must_be_shape_gate_only");
assert.equal(runnerShape.workloadKind, "Job", "in_cluster_platform_runner_shape_must_be_job");
assert.equal(runnerShape.namespace, "medopl-platform", "in_cluster_platform_runner_namespace_must_be_fixed");
assert.equal(runnerShape.serviceAccountName, "medopl-platform-runner", "in_cluster_platform_runner_service_account_must_be_fixed");
assert.equal(runnerShape.scheduling.nodePoolId, FIXED_PLATFORM_NODE_POOL_ID, "in_cluster_platform_runner_must_target_runner_pool");
assert.deepEqual(runnerShape.scheduling.nodeSelector, { "node.tke.cloud.tencent.com/machineset": FIXED_PLATFORM_NODE_POOL_ID }, "in_cluster_platform_runner_must_target_tke_machineset_label");
assert.notEqual(runnerShape.scheduling.nodePoolId, LEGACY_PROTECTED_PLATFORM_NODE_POOL_ID, "in_cluster_platform_runner_must_not_target_legacy_platform_pool");
assert.deepEqual(runnerShape.scheduling.legacyProtectedNodePoolIds, [LEGACY_PROTECTED_PLATFORM_NODE_POOL_ID], "legacy_platform_pool_must_remain_protected");
assert.equal(Object.hasOwn(runnerShape.scheduling.nodeSelector, "medopl.io/nodepool-role"), false, "in_cluster_platform_runner_must_not_require_custom_platform_service_label");
assert.equal(runnerShape.scheduling.tenantPoolAllowed, false, "in_cluster_platform_runner_must_forbid_tenant_pool");
assert.equal(runnerShape.scheduling.forbiddenNodePoolPrefix, "medopl-tenant-", "in_cluster_platform_runner_must_forbid_tenant_prefix");
assert.equal(runnerShape.podTemplate.plainSecretValuesAllowed, false, "in_cluster_platform_runner_must_forbid_plaintext_secret");
assert.equal(runnerShape.podTemplate.rawKubeconfigAllowed, false, "in_cluster_platform_runner_must_forbid_raw_kubeconfig");
assert.deepEqual(runnerShape.commandAllowlist.allowed, ["preflight", "deploy", "smoke", "rollback"], "in_cluster_platform_runner_commands_must_be_allowlisted");
assert.deepEqual(runnerShape.commandAllowlist.forbidden, ["arbitrary shell", "package-c live", "Tencent mutation", "tenant pool mutation"], "in_cluster_platform_runner_commands_must_reject_forbidden_ops");
assert.equal(runnerShape.rbac.clusterAdminAllowed, false, "in_cluster_platform_runner_must_forbid_cluster_admin");
assert.equal(runnerShape.rbac.broadWildcardAllowed, false, "in_cluster_platform_runner_must_forbid_broad_wildcard");
assert.deepEqual(runnerShape.rbac.clusterRules, [{ apiGroups: [""], resources: ["nodes"], verbs: ["get", "list"] }], "in_cluster_platform_runner_cluster_scope_must_be_nodes_readonly");
assert.equal(runnerShape.runtimeEnv.portalPostgresUrlSource, "secretRef", "in_cluster_platform_runner_postgres_url_must_use_secret_ref");
assert.equal(runnerShape.runtimeEnv.tcrSecretSource, "imagePullSecret_or_secretRef", "in_cluster_platform_runner_tcr_secret_must_use_ref");
assert.equal(runnerShape.runtimeEnv.plaintextSecretsAllowed, false, "in_cluster_platform_runner_runtime_env_must_forbid_plaintext");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.requiredRuntimeTools, ["kubectl", "PostgreSQL client or ledger canary runner"], "deploy_runner_runtime_tools_must_be_minimal_for_platform_runner");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.secretPaths, [
  "/home/dev/.secrets/medopl/v22/package-d-deploy.env",
  "/home/dev/.secrets/medopl/v22/portal-runtime.env",
  "/home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy",
], "deploy_runner_secret_paths_must_be_exact");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.safetyBoundary.postgresPublicAccess, false, "deploy_runner_must_not_open_postgres_public_access");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.safetyBoundary.tkeApiPublicAccess, false, "deploy_runner_must_not_open_tke_api_public_access");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.safetyBoundary.defaultExtraCvmRunner, false, "deploy_runner_must_not_default_to_extra_cvm");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.safetyBoundary.runnerStateCommittedToGit, false, "deploy_runner_state_must_not_enter_git");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.safetyBoundary.tenantPoolSchedulingAllowed, false, "deploy_runner_must_not_schedule_to_tenant_pool");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.preflightOrder, [
  "GitHub Actions workflow_dispatch publishes the fixed Package D runner image tag",
  "Kubernetes API connectivity preflight from TKE platform runner",
  "PostgreSQL ledger canary from TKE platform runner",
  "Package D combined preflight from TKE platform runner",
], "deploy_runner_preflight_order_must_prefer_platform_runner");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.vpcCvmRunnerFallback.status, "fallback_only_not_default", "vpc_cvm_runner_must_be_fallback_only");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.vpcCvmRunnerFallback.cvm, {
  name: "medopl-v22-deploy-runner",
  region: "na-siliconvalley",
  vpc: "medopl-vpc",
  subnet: "medopl-private-a",
  os: "Ubuntu LTS or TencentOS",
  size: "2C4G",
  disk: "50GB",
  publicIp: "disabled_by_default_temporary_operator_ip_only_for_ssh",
}, "vpc_cvm_runner_fallback_checklist_must_remain_exact");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.vpcCvmRunnerFallback.securityGroup, {
  inbound: "minimal",
  sshIngress: "operator_ip_only_when_temporarily_enabled",
  outbound: [
    "TCR",
    "TKE API private endpoint",
    "PostgreSQL 10.66.0.21:5432",
  ],
}, "vpc_cvm_runner_fallback_security_group_checklist_must_be_exact");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.vpcCvmRunnerFallback.installTools, [
  "git",
  "node/npm",
  "go",
  "docker",
  "kubectl",
], "vpc_cvm_runner_fallback_install_tools_must_remain_explicit");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.vpcCvmRunnerFallback.secretPaths, DEPLOY_RUNNER_PLACEMENT_PLAN.secretPaths, "vpc_cvm_runner_fallback_secret_paths_must_match_plan");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.vpcCvmRunnerFallback.validationOrder, [
  "docker version",
  "kubectl version --client",
  "fallback TCR login preflight",
  "fallback Kubernetes API connectivity preflight",
  "fallback PostgreSQL ledger canary",
  "fallback Package D combined preflight",
], "vpc_cvm_runner_fallback_validation_order_must_be_exact");
assert.deepEqual(DEPLOY_RUNNER_PLACEMENT_PLAN.vpcCvmRunnerFallback.forbiddenNow, [
  "CVM create",
  "Tencent mutation",
  "deploy",
  "build/push",
  "kubectl",
], "vpc_cvm_runner_fallback_must_remain_non_executing");
assert.equal(DEPLOY_RUNNER_PLACEMENT_PLAN.realExecutionReady, false, "deploy_runner_placement_plan_must_not_mark_real_execution_ready");
for (const [label, plan] of [
  ["top_level", currentGoal.package_d_deploy_readiness_plan],
  ["current_leaf", currentGoal.current_leaf?.package_d_deploy_readiness_plan],
]) {
  assert.equal(plan?.executionEnvironment, "tke_in_cluster_platform_runner_preferred", `deploy_runner_execution_environment_mismatch:${label}`);
  assert.deepEqual(plan?.deployRunnerPlacementPlan, DEPLOY_RUNNER_PLACEMENT_PLAN, `deploy_runner_goal_placement_plan_mismatch:${label}`);
  assert.equal(plan?.deployRunnerPlacementPlan?.realExecutionReady, false, `deploy_runner_goal_real_execution_must_stay_false:${label}`);
}

const runnerShapeEvidenceRoot = new URL("../../../.runtime/package-d-in-cluster-platform-runner-shape-gate/", import.meta.url);
const runnerShapeReport = writePackageDRunnerShapeReport({
  reportRoot: runnerShapeEvidenceRoot,
  shape: DEPLOY_RUNNER_PLACEMENT_PLAN.inClusterPlatformRunnerShape,
});
const runnerShapeReportText = JSON.stringify(runnerShapeReport);
for (const forbidden of ["$TCR_SECRET", "$PORTAL_ADMIN_PASSWORD", "$PORTAL_POSTGRES_PASSWORD", "postgresql://", "client-key-data", "client-certificate-data", "kubeconfig-ref-proof"]) {
  assert.equal(runnerShapeReportText.includes(forbidden), false, `runner_shape_report_must_not_expose:${forbidden}`);
}
assert.equal(runnerShapeReport.shape.evidence.sink, ".runtime", "runner_shape_report_must_target_runtime_evidence");
assert.equal(runnerShapeReport.shape.evidence.commitRuntimeEvidence, false, "runner_shape_report_must_not_be_committed");
assert.equal(runnerShapeReport.shape.executionBoundary.callsKubectlNow, false, "runner_shape_report_must_not_call_kubectl");
assert.equal(runnerShapeReport.shape.executionBoundary.deploysNow, false, "runner_shape_report_must_not_deploy");
assert.equal(runnerShapeReport.shape.executionBoundary.buildsOrPushesNow, false, "runner_shape_report_must_not_build_push");
assert.equal(runnerShapeReport.shape.executionBoundary.executesTencentMutationNow, false, "runner_shape_report_must_not_execute_tencent_mutation");
assert.equal(runnerShapeReport.shape.executionBoundary.packageCLiveAllowed, false, "runner_shape_report_must_not_allow_package_c_live");

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
  executionPreflightGateReady: executionPreflightGate.summary.executionPreflightGateReady,
  deployRunnerPlacementPlanReady: true,
  realExecutionReady: false,
  imageTargets: releasePlan.summary.imageTargets,
  deployRunner: {
    preferredExecutionLocation: DEPLOY_RUNNER_PLACEMENT_PLAN.preferredExecutionLocation,
    preferredRunnerName: DEPLOY_RUNNER_PLACEMENT_PLAN.preferredRunnerName,
    clusterId: DEPLOY_RUNNER_PLACEMENT_PLAN.clusterId,
    namespace: DEPLOY_RUNNER_PLACEMENT_PLAN.namespace,
    platformNodePoolId: DEPLOY_RUNNER_PLACEMENT_PLAN.platformNodePoolId,
    fallback: DEPLOY_RUNNER_PLACEMENT_PLAN.vpcCvmRunnerFallback.status,
    realExecutionReady: DEPLOY_RUNNER_PLACEMENT_PLAN.realExecutionReady,
  },
  inClusterRunnerShapeGateReady: true,
  shapeEvidenceSink: ".runtime/package-d-in-cluster-platform-runner-shape-gate/shape-report-redacted.json",
  requiresKubeApiserverConnectivity: true,
  acceptedSecretFile: accepted.file,
  blockedReason: "needs_reviewed_real_release_plan_kube_apiserver_connectivity_dry_run_acceptance_and_explicit_authorization",
}, null, 2));
