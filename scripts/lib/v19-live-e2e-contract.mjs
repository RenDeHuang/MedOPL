import { liveCloudTagValue } from "./v19-live-labels.mjs";

const VALID_PHASES = new Set(["same_day", "t1_bill"]);

function readEnv(env, name, fallback = "") {
  return String(env?.[name] ?? fallback).trim();
}

function requireNonEmpty(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name}_required`);
  return normalized;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export function parseLiveE2eConfig(env = process.env) {
  if (readEnv(env, "RUN_V19_LIVE_E2E") !== "1") {
    throw new Error("RUN_V19_LIVE_E2E_must_equal_1");
  }
  const phase = readEnv(env, "V19_LIVE_E2E_PHASE", "same_day");
  if (!VALID_PHASES.has(phase)) {
    throw new Error(`V19_LIVE_E2E_PHASE_invalid:${phase}`);
  }
  return {
    phase,
    fixtureFile: readEnv(env, "V19_LIVE_E2E_FIXTURE_FILE", readEnv(env, "PORTAL_RECOVERY_FIXTURE_FILE")),
    prepareFixture: readEnv(env, "V19_LIVE_E2E_PREPARE_FIXTURE", "0") === "1",
    runTkeGate: readEnv(env, "V19_LIVE_E2E_RUN_TKE_GATE", "0") === "1",
    runPortalDelete: readEnv(env, "V19_LIVE_E2E_RUN_PORTAL_DELETE", "0") === "1",
    runRecoveryBaseline: readEnv(env, "V19_LIVE_E2E_RUN_RECOVERY_BASELINE", "0") === "1",
    tkeGateMode: readEnv(env, "V19_LIVE_E2E_TKE_GATE_MODE", "resource_provisioner_via_kubectl"),
    resourceProvisionerDeployment: readEnv(env, "V19_LIVE_E2E_RESOURCE_PROVISIONER_DEPLOYMENT", "resource-provisioner-opl"),
    resourceProvisionerNamespace: readEnv(env, "V19_LIVE_E2E_RESOURCE_PROVISIONER_NAMESPACE", "default"),
    kubeconfig: readEnv(env, "V19_LIVE_E2E_KUBECONFIG", readEnv(env, "KUBECONFIG")),
    kubeServerOverride: readEnv(env, "V19_LIVE_E2E_KUBE_SERVER_OVERRIDE"),
    kubeInsecureSkipTlsVerify: readEnv(env, "V19_LIVE_E2E_KUBE_INSECURE_SKIP_TLS_VERIFY", "0") === "1",
    kubectlBin: readEnv(env, "V19_LIVE_E2E_KUBECTL_BIN", "kubectl"),
    instanceType: readEnv(env, "V19_LIVE_E2E_INSTANCE_TYPE", readEnv(env, "TKE_LIVE_INSTANCE_TYPE")),
    outputDir: readEnv(env, "V19_LIVE_E2E_OUTPUT_DIR", ".runtime/v19-live-e2e"),
  };
}

export function buildKubeAttributionLabels(target) {
  return {
    tenant_id: requireNonEmpty(target.tenantId, "tenantId"),
    workspace_id: requireNonEmpty(target.workspaceId, "workspaceId"),
    resource_order_id: requireNonEmpty(target.resourceOrderId, "resourceOrderId"),
    run_id: requireNonEmpty(target.runId, "runId"),
    server_plan_id: requireNonEmpty(target.serverPlanId, "serverPlanId"),
  };
}

export function validateSameDayFixture(fixture = {}) {
  const env = fixture.env || {};
  const attribution = fixture.attributionTarget || {};
  const prepared = fixture.prepared || {};
  const tenantId = firstNonEmpty(
    attribution.tenant_id,
    prepared.tenantId,
    prepared.userId,
  );
  const workspaceId = firstNonEmpty(attribution.workspace_id, env.PORTAL_RECOVERY_WORKSPACE_ID, prepared.workspaceId);
  const resourceOrderId = firstNonEmpty(attribution.resource_order_id, env.PORTAL_RECOVERY_RESOURCE_ORDER_ID, prepared.resourceOrderId);
  const runId = firstNonEmpty(attribution.run_id, env.PORTAL_RECOVERY_RUN_ID, prepared.runId);
  const serverPlanId = firstNonEmpty(attribution.server_plan_id, env.PORTAL_RECOVERY_SERVER_PLAN_ID, prepared.serverPlanId);
  const required = { tenantId, workspaceId, resourceOrderId, runId, serverPlanId };
  for (const [key, value] of Object.entries(required)) {
    if (!String(value || "").trim()) throw new Error(`fixture_missing:${key}`);
  }
  return {
    tenantId,
    workspaceId,
    resourceOrderId,
    runId,
    serverPlanId,
    portalBaseUrl: firstNonEmpty(env.PORTAL_BASE_URL, fixture.portalBaseUrl),
    loginMode: firstNonEmpty(env.PORTAL_TEST_LOGIN, fixture.loginMode),
    userEmail: firstNonEmpty(env.PORTAL_RECOVERY_USER_EMAIL, prepared.userEmail),
    passwordFile: firstNonEmpty(fixture.secretFiles?.PORTAL_RECOVERY_USER_PASSWORD, fixture.passwordFile),
    fixture,
  };
}

export function buildTkeEnvFromFixture(target, options = {}) {
  return {
    RUN_TKE_LIVE: "1",
    RESOURCE_PROVISIONING_ENABLED: "1",
    TKE_LIVE_TENANT_ID: requireNonEmpty(target.tenantId, "tenantId"),
    TKE_LIVE_WORKSPACE_ID: requireNonEmpty(target.workspaceId, "workspaceId"),
    TKE_LIVE_RESOURCE_ORDER_ID: requireNonEmpty(target.resourceOrderId, "resourceOrderId"),
    TKE_LIVE_RUN_ID: requireNonEmpty(target.runId, "runId"),
    TKE_LIVE_SERVER_PLAN_ID: requireNonEmpty(target.serverPlanId, "serverPlanId"),
    ...(options.instanceType ? { TKE_LIVE_INSTANCE_TYPE: options.instanceType } : {}),
    ...(options.kubectlBin ? { TKE_LIVE_KUBECTL_BIN: options.kubectlBin } : {}),
    ...(options.kubeconfig ? { TKE_LIVE_KUBECONFIG: options.kubeconfig } : {}),
    ...(options.kubeServerOverride ? { TKE_LIVE_KUBE_SERVER_OVERRIDE: options.kubeServerOverride } : {}),
  };
}

export function buildCosTargetFromFixture(target) {
  return {
    COS_LIVE_EXPECT_TENANT_ID: requireNonEmpty(target.tenantId, "tenantId"),
    COS_LIVE_EXPECT_WORKSPACE_ID: requireNonEmpty(target.workspaceId, "workspaceId"),
    COS_LIVE_EXPECT_RESOURCE_ORDER_ID: requireNonEmpty(target.resourceOrderId, "resourceOrderId"),
    COS_LIVE_EXPECT_RUN_ID: requireNonEmpty(target.runId, "runId"),
    COS_LIVE_EXPECT_SERVER_PLAN_ID: requireNonEmpty(target.serverPlanId, "serverPlanId"),
    COS_LIVE_EXPECT_TENANT_TAG_VALUE: liveCloudTagValue(requireNonEmpty(target.tenantId, "tenantId")),
    COS_LIVE_EXPECT_WORKSPACE_TAG_VALUE: liveCloudTagValue(requireNonEmpty(target.workspaceId, "workspaceId")),
    COS_LIVE_EXPECT_RESOURCE_ORDER_TAG_VALUE: liveCloudTagValue(requireNonEmpty(target.resourceOrderId, "resourceOrderId")),
    COS_LIVE_EXPECT_RUN_TAG_VALUE: liveCloudTagValue(requireNonEmpty(target.runId, "runId")),
    COS_LIVE_EXPECT_SERVER_PLAN_TAG_VALUE: liveCloudTagValue(requireNonEmpty(target.serverPlanId, "serverPlanId")),
  };
}

function valueCandidates(value) {
  const raw = requireNonEmpty(value, "targetValue");
  return new Set([raw, liveCloudTagValue(raw)]);
}

function targetValueSets(target) {
  return {
    tenantId: valueCandidates(target.tenantId),
    workspaceId: valueCandidates(target.workspaceId),
    resourceOrderId: valueCandidates(target.resourceOrderId),
    runId: valueCandidates(target.runId),
    serverPlanId: valueCandidates(target.serverPlanId),
  };
}

export function matchesCosTargetItem(item = {}, target = {}) {
  const expected = targetValueSets(target);
  return Object.entries(expected).every(([key, candidates]) => {
    const actual = String(item?.[key] || "").trim();
    return actual && candidates.has(actual);
  });
}
