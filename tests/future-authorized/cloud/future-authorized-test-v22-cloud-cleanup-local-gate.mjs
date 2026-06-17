import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PRODUCTION_LAUNCH_WORKSPACE_LIFECYCLE_COMMAND,
  buildProductionLaunchWorkspaceLifecycleContract,
  runProductionLaunchWorkspaceLifecycleContract,
} from "../../support/cloud-prework/production-launch-workspace-lifecycle-runner.js";
import {
  PRODUCTION_LAUNCH_CANARY_COMMAND,
  buildProductionLaunchCanaryContract,
  runProductionLaunchCanaryContract,
} from "../../support/cloud-prework/production-launch-canary-runner.js";
import {
  PACKAGE_D_EXTERNAL_ACCESS_STRATEGY_COMMAND,
  PACKAGE_D_QCLOUD_TLS_READINESS_COMMAND,
  buildPackageDExternalAccessStrategyContract,
  buildPackageDQcloudTlsReadinessContract,
  runPackageDExternalAccessStrategyContract,
  runPackageDQcloudTlsReadinessContract,
} from "../../support/cloud-prework/package-d-external-access-strategy-runner.js";

export function evaluateCloudCleanupLocalGate({
  baseline = {},
  after = {},
  operations = [],
  cleanupPlan = {},
} = {}) {
  const platformBefore = baseline.platformServicePool ?? {};
  const platformAfter = after.platformServicePool ?? {};
  const baselineDesired = Number(platformBefore.desiredCapacity);
  const baselineCurrent = Number(platformBefore.currentCapacity);
  const afterDesired = Number(platformAfter.desiredCapacity);
  const afterCurrent = Number(platformAfter.currentCapacity);
  const beforeTenantPools = Array.isArray(baseline.tenantNodePools) ? baseline.tenantNodePools : [];
  const afterTenantPools = Array.isArray(after.tenantNodePools) ? after.tenantNodePools : [];
  if (!platformBefore.nodePoolRef) return { ok: false, error: "platform_service_pool_baseline_required" };
  if (!Number.isFinite(baselineDesired)) return { ok: false, error: "platform_service_pool_desired_required" };
  if (baselineDesired < 1) return { ok: false, error: "platform_service_pool_must_not_be_zero" };
  if (!Number.isFinite(baselineCurrent)) return { ok: false, error: "platform_service_pool_current_required" };
  if (baselineCurrent < 1) return { ok: false, error: "platform_service_pool_current_must_not_be_zero" };
  if (platformAfter.nodePoolRef !== platformBefore.nodePoolRef) return { ok: false, error: "platform_service_pool_ref_changed" };
  if (afterDesired !== baselineDesired) return { ok: false, error: "platform_service_pool_desired_changed" };
  if (afterCurrent !== baselineCurrent) return { ok: false, error: "platform_service_pool_current_changed" };
  if (!cleanupPlan.cleanupRequired) return { ok: false, error: "cleanup_plan_required" };
  if (!cleanupPlan.cleanupOperationId) return { ok: false, error: "cleanup_operation_id_required" };
  if (!cleanupPlan.baselineSnapshotRef) return { ok: false, error: "cleanup_baseline_snapshot_ref_required" };
  if (!cleanupPlan.postCleanupSnapshotRef) return { ok: false, error: "cleanup_post_snapshot_ref_required" };
  if (!beforeTenantPools.every((pool) => String(pool.nodePoolRef || "").trim())) return { ok: false, error: "tenant_node_pool_baseline_ref_required" };
  const leakedTenantPool = afterTenantPools.find((pool) => !["released", "deleted", "not_present"].includes(String(pool.status || "")));
  if (leakedTenantPool) return { ok: false, error: "tenant_node_pool_not_released", nodePoolRef: leakedTenantPool.nodePoolRef || leakedTenantPool.id };
  const leaked = operations.find((operation) => ["queued", "running"].includes(String(operation.status || "")));
  if (leaked) return { ok: false, error: "active_operation_after_cleanup", operationId: leaked.operationId || leaked.id };
  const unreleasedCompute = operations.find((operation) => operation.resourceKind === "compute" && !["released", "failed"].includes(String(operation.status || "")) && operation.operationType !== "release_compute");
  if (unreleasedCompute) return { ok: false, error: "compute_not_released", operationId: unreleasedCompute.operationId || unreleasedCompute.id };
  const orphanBinding = operations.find((operation) => operation.resourceKind === "compute" && operation.status === "released" && !String(operation.tenantNodePoolRef || "").trim());
  if (orphanBinding) return { ok: false, error: "released_compute_missing_tenant_node_pool_ref", operationId: orphanBinding.operationId || orphanBinding.id };
  return { ok: true };
}

const pass = evaluateCloudCleanupLocalGate({
  baseline: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 1, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "active" }],
  },
  after: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 1, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "released" }],
  },
  cleanupPlan: {
    cleanupRequired: true,
    cleanupOperationId: "cleanup-v22-smoke",
    baselineSnapshotRef: ".runtime/v22-cloud-cleanup/baseline.json",
    postCleanupSnapshotRef: ".runtime/v22-cloud-cleanup/post.json",
  },
  operations: [
    { operationId: "op-create", resourceKind: "compute", operationType: "release_compute", status: "released", tenantNodePoolRef: "np-tenant-proof" },
    { operationId: "op-storage", resourceKind: "storage", operationType: "delete_storage", status: "retention_protected" },
  ],
});
assert.equal(pass.ok, true, "cleanup_gate_pass");

const fail = evaluateCloudCleanupLocalGate({
  baseline: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 1, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "active" }],
  },
  after: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 2, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "released" }],
  },
  cleanupPlan: {
    cleanupRequired: true,
    cleanupOperationId: "cleanup-v22-smoke",
    baselineSnapshotRef: ".runtime/v22-cloud-cleanup/baseline.json",
    postCleanupSnapshotRef: ".runtime/v22-cloud-cleanup/post.json",
  },
  operations: [],
});
assert.equal(fail.ok, false, "cleanup_gate_must_fail_when_capacity_not_back_to_baseline");
assert.equal(fail.error, "platform_service_pool_desired_changed", "cleanup_gate_error");

const missingRef = evaluateCloudCleanupLocalGate({
  baseline: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 1, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "active" }],
  },
  after: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 1, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "released" }],
  },
  cleanupPlan: { cleanupRequired: true, cleanupOperationId: "cleanup-v22-smoke" },
  operations: [],
});
assert.equal(missingRef.ok, false, "cleanup_gate_must_require_snapshot_refs");
assert.equal(missingRef.error, "cleanup_baseline_snapshot_ref_required", "cleanup_gate_snapshot_ref_error");

function assertNoLifecycleSensitiveText(text = "", label = "text") {
  for (const forbidden of [
    "gflabtoken-raw-provider-key-material-that-must-not-leak",
    "postgres-password-that-must-not-leak",
    "bearer-token-that-must-not-leak",
    "rawProviderKey",
    "\"providerApiKey\":",
    "\"providerSecret\":",
    "DATABASE_URL",
    "launchToken",
    "runtimeToken",
    "bearerToken",
    "localStorage.setItem",
    "sessionStorage.setItem",
    "kubectl",
    "docker build",
    "docker push",
    "CreateNodePool",
    "medopl-tenant-",
    "TENCENT_SECRET_ID",
    "TENCENT_SECRET_KEY",
    "SecretId",
    "SecretKey",
    "\"kind\":\"Ingress\"",
    "\"type\":\"LoadBalancer\"",
    "kubeconfig-must-not-leak",
    "portal-admin-password-that-must-not-leak",
    "tencent-secret-id-that-must-not-leak",
    "tencent-secret-key-that-must-not-leak",
    "\"providerApiKey\":",
    "\"providerSecret\":",
    "CreateLoadBalancer",
    "CreateRecord",
    "CreateCertificate",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

function assertNoExternalAccessSensitiveText(text = "", label = "text") {
  for (const forbidden of [
    "gflabtoken-raw-provider-key-material-that-must-not-leak",
    "postgres-password-that-must-not-leak",
    "bearer-token-that-must-not-leak",
    "portal-admin-password-that-must-not-leak",
    "tencent-secret-id-that-must-not-leak",
    "tencent-secret-key-that-must-not-leak",
    "rawProviderKey",
    "\"providerApiKey\":",
    "\"providerSecret\":",
    "DATABASE_URL",
    "launchToken",
    "runtimeToken",
    "bearerToken",
    "localStorage.setItem",
    "sessionStorage.setItem",
    "-----BEGIN CERTIFICATE-----",
    "-----BEGIN PRIVATE KEY-----",
    "tls-cert-that-must-not-leak",
    "tls-private-key-that-must-not-leak",
    "\"tlsCertificatePem\":",
    "\"tlsPrivateKeyPem\":",
    "kubectl apply",
    "kubectl delete",
    "CreateLoadBalancer",
    "CreateRecord",
    "CreateCertificate",
    "medopl-tenant-",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const workspaceLifecycleEvidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-production-launch-workspace-lifecycle-"));
try {
  const evidenceDir = path.join(workspaceLifecycleEvidenceRoot, "evidence");
  const runId = "plw-20260617-001";
  assert.equal(
    PRODUCTION_LAUNCH_WORKSPACE_LIFECYCLE_COMMAND,
    "node tests/support/cloud-prework/production-launch-workspace-lifecycle-runner.js --mode contract-local-gate --run-id <runid> --authorized 1",
    "workspace_lifecycle_runner_must_publish_single_repo_native_command",
  );
  await assert.rejects(
    () => buildProductionLaunchWorkspaceLifecycleContract({ runId, evidenceDir, authorized: false }),
    /production_launch_workspace_lifecycle_not_authorized/,
    "workspace_lifecycle_missing_authorization_must_fail_closed",
  );
  await assert.rejects(
    () => buildProductionLaunchWorkspaceLifecycleContract({ runId: "", evidenceDir, authorized: true }),
    /production_launch_workspace_lifecycle_run_id_required/,
    "workspace_lifecycle_missing_run_id_must_fail_closed",
  );

  const lifecycle = {
    tenantId: "tenant-production-alpha",
    accountId: "account-production-alpha",
    workspaceId: "workspace-production-alpha",
    resourceBindingId: "rb-production-alpha",
    cloudOperationId: "op:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:workspace-ledger-alpha-once",
    billingAttributionId: "bill-production-alpha",
    serverPlanId: "starter_2c4g_10gb",
    providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
    idempotencyKey: "workspace-lifecycle-alpha-once",
    rawProviderKey: "gflabtoken-raw-provider-key-material-that-must-not-leak",
    runtime: { dbPassword: "postgres-password-that-must-not-leak" },
    tokens: { bearerToken: "bearer-token-that-must-not-leak" },
    tencent: {
      SecretId: "TENCENT_SECRET_ID_that_must_not_leak",
      SecretKey: "TENCENT_SECRET_KEY_that_must_not_leak",
    },
  };
  const plan = await buildProductionLaunchWorkspaceLifecycleContract({ runId, evidenceDir, authorized: true, lifecycle });
  assert.equal(plan.contract, "production_launch_gap_05_workspace_lifecycle_contract_local_gate", "workspace_lifecycle_contract_name");
  assert.equal(plan.boundary.contractOnly, true, "workspace_lifecycle_contract_only");
  assert.equal(plan.boundary.externalAccessBlocked, true, "workspace_lifecycle_external_access_blocked");
  assert.equal(plan.boundary.kubernetesAccessAllowed, false, "workspace_lifecycle_no_kubernetes");
  assert.equal(plan.boundary.productionPostgresWriteAllowedNow, false, "workspace_lifecycle_no_postgres_write");
  assert.deepEqual(plan.portalWorkspaceLifecycleApiTrace.map((entry) => entry.methodPath), [
    "POST /api/v22/production/workspace-lifecycle/plan",
    "POST /api/v22/production/workspace-lifecycle/commit",
  ], "workspace_lifecycle_api_trace");
  assert.deepEqual(Object.keys(plan.requests.suspend).sort(), [
    "accountId",
    "billingAttributionId",
    "cloudOperationId",
    "idempotencyKey",
    "providerKeyRef",
    "resourceBindingId",
    "serverPlanId",
    "tenantId",
    "workspaceId",
  ], "workspace_lifecycle_request_shape");
  assert.deepEqual(plan.resourceBindingLifecycle.statesByAction.suspend, ["ready", "suspendRequested", "suspended"], "workspace_lifecycle_suspend_states");
  assert.deepEqual(plan.resourceBindingLifecycle.statesByAction.resume, ["suspended", "resumeRequested", "ready"], "workspace_lifecycle_resume_states");
  assert.deepEqual(plan.resourceBindingLifecycle.statesByAction.delete, ["ready", "releaseRequested", "deleting", "released"], "workspace_lifecycle_delete_states");
  assert.deepEqual(plan.billingLifecycle.actions, ["stop_on_suspend", "resume_on_resume", "finalize_on_delete"], "workspace_lifecycle_billing_actions");
  assert.deepEqual(plan.auditLifecycle.actions, ["workspace_suspend_requested", "workspace_resume_requested", "workspace_delete_requested"], "workspace_lifecycle_audit_actions");
  assert.deepEqual(plan.quotaLifecycle.actions, ["release_on_suspend", "restore_on_resume", "final_release_on_delete"], "workspace_lifecycle_quota_actions");
  assert.equal(plan.idempotency.operationId, "lifecycle:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:workspace-lifecycle-alpha-once", "workspace_lifecycle_operation_id");
  assert.equal(plan.rollbackCleanupEvidence.rollbackPlan.required, true, "workspace_lifecycle_rollback_required");
  assert.equal(plan.rollbackCleanupEvidence.cleanupPlan.required, true, "workspace_lifecycle_cleanup_required");
  assertNoLifecycleSensitiveText(JSON.stringify(plan), "workspace_lifecycle_plan");

  const summary = await runProductionLaunchWorkspaceLifecycleContract({ runId, evidenceDir, authorized: true });
  assert.equal(summary.realExecutionReady, false, "workspace_lifecycle_real_execution_ready_false");
  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.nextGap.id, "production-launch-gap-06-production-canary-rollback-evidence-contract", "workspace_lifecycle_next_gap");
  assert.equal(evidence.redactionAudit.rawSecretMaterialExposed, false, "workspace_lifecycle_hides_raw_provider_key");
  assert.equal(evidence.redactionAudit.dbPasswordExposed, false, "workspace_lifecycle_hides_db_password");
  assert.equal(evidence.redactionAudit.tokenExposed, false, "workspace_lifecycle_hides_token");
  assert.equal(evidence.redactionAudit.tencentSecretExposed, false, "workspace_lifecycle_hides_tencent_secret");
  assertNoLifecycleSensitiveText(JSON.stringify(evidence), "workspace_lifecycle_evidence");
} finally {
  await rm(workspaceLifecycleEvidenceRoot, { recursive: true, force: true });
}

const canaryEvidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-production-launch-canary-"));
try {
  const evidenceDir = path.join(canaryEvidenceRoot, "evidence");
  const runId = "plcny-20260617-001";
  const canary = {
    tenantId: "tenant-production-alpha",
    accountId: "account-production-alpha",
    workspaceId: "workspace-production-alpha",
    resourceBindingId: "rb-production-alpha",
    cloudOperationId: "op:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:workspace-ledger-alpha-once",
    billingAttributionId: "bill-production-alpha",
    serverPlanId: "starter_2c4g_10gb",
    providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
    idempotencyKey: "production-canary-alpha-once",
    rawProviderKey: "gflabtoken-raw-provider-key-material-that-must-not-leak",
    runtime: { dbPassword: "postgres-password-that-must-not-leak" },
    tokens: { bearerToken: "bearer-token-that-must-not-leak" },
    tencent: {
      SecretId: "TENCENT_SECRET_ID_that_must_not_leak",
      SecretKey: "TENCENT_SECRET_KEY_that_must_not_leak",
    },
  };
  assert.equal(
    PRODUCTION_LAUNCH_CANARY_COMMAND,
    "node tests/support/cloud-prework/production-launch-canary-runner.js --mode contract-local-gate --run-id <runid> --authorized 1",
    "canary_runner_must_publish_single_repo_native_command",
  );
  await assert.rejects(
    () => buildProductionLaunchCanaryContract({ runId, evidenceDir, authorized: false }),
    /production_launch_canary_not_authorized/,
    "canary_missing_authorization_must_fail_closed",
  );
  await assert.rejects(
    () => buildProductionLaunchCanaryContract({ runId: "", evidenceDir, authorized: true }),
    /production_launch_canary_run_id_required/,
    "canary_missing_run_id_must_fail_closed",
  );

  const plan = await buildProductionLaunchCanaryContract({ runId, evidenceDir, authorized: true, canary });
  assert.equal(plan.contract, "production_launch_gap_06_canary_rollback_cleanup_contract_local_gate", "canary_contract_name");
  assert.equal(plan.boundary.contractOnly, true, "canary_contract_only");
  assert.equal(plan.boundary.kubernetesAccessAllowed, false, "canary_no_kubernetes");
  assert.equal(plan.boundary.productionPostgresConnectAllowedNow, false, "canary_no_postgres");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "canary_no_package_c_live");
  assert.equal(plan.boundary.externalAccessBlocked, true, "canary_external_access_blocked");
  assert.deepEqual(plan.productionCanaryShape.stages, [
    "admin_identity_smoke",
    "tenant_smoke",
    "workspace_smoke",
    "portal_backend_package_c_dry_run_boundary",
    "resourcebinding_cloudoperation_ledger_linkage",
    "commercial_ledger_linkage",
    "workspace_lifecycle_linkage",
    "rollback_evidence",
    "cleanup_evidence",
    "redaction_observability_evidence",
  ], "canary_stage_shape");
  assert.deepEqual(plan.smokeShape.admin.requiredFields, ["adminIdentityRef", "tenantId", "auditEventId"], "admin_smoke_shape");
  assert.deepEqual(plan.smokeShape.tenant.requiredFields, ["tenantId", "accountId", "billingAttributionId", "quotaScopeId"], "tenant_smoke_shape");
  assert.deepEqual(plan.smokeShape.workspace.requiredFields, ["workspaceId", "resourceBindingId", "cloudOperationId", "providerKeyRef"], "workspace_smoke_shape");
  assert.equal(plan.portalBackendPackageCDryRunBoundary.liveExecutionAllowedNow, false, "canary_package_c_dry_run_only");
  assert.equal(plan.resourceBindingCloudOperationLinkage.resourceBindingId, canary.resourceBindingId, "canary_resource_binding_linked");
  assert.equal(plan.commercialLedgerLinkage.billingAttributionId, canary.billingAttributionId, "canary_billing_linked");
  assert.deepEqual(plan.workspaceLifecycleLinkage.actions, ["suspend", "resume", "delete"], "canary_lifecycle_linked");
  assert.equal(plan.rollbackEvidence.commandPlan.allowlistedOnly, true, "canary_rollback_allowlisted");
  assert.equal(plan.cleanupEvidence.commandPlan.allowlistedOnly, true, "canary_cleanup_allowlisted");
  assert.equal(plan.idempotency.operationId, "canary:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:production-canary-alpha-once", "canary_operation_id");
  assert.equal(plan.providerBoundary.rawSecretAcceptedByRunner, false, "canary_raw_provider_key_rejected");
  assertNoLifecycleSensitiveText(JSON.stringify(plan), "canary_plan");

  const summary = await runProductionLaunchCanaryContract({ runId, evidenceDir, authorized: true });
  assert.equal(summary.realExecutionReady, false, "canary_real_execution_ready_false");
  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.redactionAudit.rawSecretMaterialExposed, false, "canary_hides_raw_provider_key");
  assert.equal(evidence.redactionAudit.dbPasswordExposed, false, "canary_hides_db_password");
  assert.equal(evidence.redactionAudit.tokenExposed, false, "canary_hides_token");
  assert.equal(evidence.redactionAudit.tencentSecretExposed, false, "canary_hides_tencent_secret");
  assert.equal(evidence.nextGap.id, "production-launch-gap-07-external-access-strategy-after-minimum-saas-closure", "canary_next_gap");
  assertNoLifecycleSensitiveText(JSON.stringify(evidence), "canary_evidence");
} finally {
  await rm(canaryEvidenceRoot, { recursive: true, force: true });
}

const externalAccessEvidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-external-access-strategy-"));
try {
  const evidenceDir = path.join(externalAccessEvidenceRoot, "evidence");
  const runId = "peas-20260617-001";
  const strategyInput = {
    portalHost: "portal.medopl.example.com",
    ingressClass: "nginx",
    tlsSecretName: "medopl-portal-tls",
    certificateManagement: "precreated-tls-secret",
    allowedAnnotations: [
      "kubernetes.io/ingress.class",
      "nginx.ingress.kubernetes.io/proxy-body-size",
      "nginx.ingress.kubernetes.io/proxy-read-timeout",
      "nginx.ingress.kubernetes.io/proxy-send-timeout",
      "cert-manager.io/cluster-issuer",
    ],
    forbiddenAnnotations: [
      "nginx.ingress.kubernetes.io/server-snippet",
      "nginx.ingress.kubernetes.io/configuration-snippet",
      "nginx.ingress.kubernetes.io/auth-snippet",
      "nginx.ingress.kubernetes.io/whitelist-source-range",
    ],
    externalSmokeUrl: "https://portal.medopl.example.com/health",
    providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
    rawProviderKey: "gflabtoken-raw-provider-key-material-that-must-not-leak",
    runtime: { dbPassword: "postgres-password-that-must-not-leak" },
    tokens: { bearerToken: "bearer-token-that-must-not-leak" },
    portalAdminPassword: "portal-admin-password-that-must-not-leak",
    tencent: {
      SecretId: "tencent-secret-id-that-must-not-leak",
      SecretKey: "tencent-secret-key-that-must-not-leak",
    },
  };

  assert.equal(
    PACKAGE_D_EXTERNAL_ACCESS_STRATEGY_COMMAND,
    "node tests/support/cloud-prework/package-d-external-access-strategy-runner.js --mode strategy-contract-local-gate --run-id <runid> --authorized 1",
    "external_access_strategy_runner_must_publish_single_repo_native_command",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessStrategyContract({ runId, evidenceDir, authorized: false, strategyInput }),
    /package_d_external_access_strategy_not_authorized/,
    "external_access_strategy_missing_authorization_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessStrategyContract({ runId: "", evidenceDir, authorized: true, strategyInput }),
    /package_d_external_access_strategy_run_id_required/,
    "external_access_strategy_missing_run_id_must_fail_closed",
  );

  const plan = await buildPackageDExternalAccessStrategyContract({ runId, evidenceDir, authorized: true, strategyInput });
  assert.equal(plan.contract, "production_launch_gap_07_external_access_strategy_contract_local_gate", "external_access_strategy_contract_name");
  assert.equal(plan.boundary.contractOnly, true, "external_access_strategy_contract_only");
  assert.equal(plan.boundary.kubernetesAccessAllowed, false, "external_access_strategy_no_kubernetes");
  assert.equal(plan.boundary.ingressMutationAllowedNow, false, "external_access_strategy_no_ingress_mutation");
  assert.equal(plan.boundary.loadBalancerMutationAllowedNow, false, "external_access_strategy_no_loadbalancer_mutation");
  assert.equal(plan.boundary.dnsTlsMutationAllowedNow, false, "external_access_strategy_no_dns_tls_mutation");
  assert.equal(plan.boundary.publicAccessClaimAllowedNow, false, "external_access_strategy_no_public_access_claim");
  assert.equal(plan.recommendedNextOption.id, "ingress_https_domain_formal_candidate", "external_access_strategy_formal_candidate");
  assert.equal(plan.recommendedNextOption.executionNow, false, "external_access_strategy_recommendation_is_not_execution");
  assert.equal(plan.adminOnlyPortForward.formalLaunchCompletionStandard, false, "port_forward_not_formal_launch_standard");
  assert.deepEqual(plan.strategyComparison.map((option) => option.id), [
    "admin_only_port_forward",
    "internal_gateway",
    "kubernetes_ingress",
    "loadbalancer_service",
    "https_domain",
  ], "external_access_strategy_must_compare_all_options");
  assert.deepEqual(plan.productionEntryParameters.requiredKeys, [
    "PORTAL_HOST_DOMAIN",
    "INGRESS_CLASS",
    "TLS_SECRET_NAME_OR_CERT_MANAGER_ISSUER",
    "ALLOWED_INGRESS_ANNOTATIONS",
    "FORBIDDEN_INGRESS_ANNOTATIONS",
    "EXTERNAL_SMOKE_URL",
    "ROLLBACK_DELETE_INGRESS_PLAN",
  ], "external_access_strategy_required_env_keys");
  assert.equal(plan.productionEntryParameters.portalHost, "portal.medopl.example.com", "external_access_strategy_portal_host");
  assert.equal(plan.productionEntryParameters.ingressClass, "nginx", "external_access_strategy_ingress_class");
  assert.equal(plan.productionEntryParameters.tlsSecretName, "medopl-portal-tls", "external_access_strategy_tls_secret");
  assert.equal(plan.productionEntryParameters.externalSmokeUrl, "https://portal.medopl.example.com/health", "external_access_strategy_external_smoke_url");
  assert.deepEqual(plan.allowedOperations, [
    "local strategy contract generation",
    "redacted authorization pack generation",
    "future server-side dry-run planning for allowlisted Ingress/TLS shapes",
  ], "external_access_strategy_allowed_operations");
  assert(plan.forbiddenOperations.includes("kubectl"), "external_access_strategy_forbids_kubectl");
  assert(plan.forbiddenOperations.includes("Ingress/LoadBalancer/DNS/TLS mutation"), "external_access_strategy_forbids_mutation");
  assert.equal(plan.securityBoundary.providerKeyRefOnly, true, "external_access_strategy_provider_key_ref_only");
  assert.equal(plan.controlPlaneContractLinkage.portalTypedApi, "services/portal/frontend/src/api/portal/external-access-strategy.ts", "external_access_strategy_portal_api");
  assert.deepEqual(plan.controlPlaneContractLinkage.goBackendRoutes, [
    "POST /api/v22/production/external-access-strategy/plan",
    "POST /api/v22/production/external-access-strategy/commit",
  ], "external_access_strategy_go_routes");
  assert.equal(plan.rollbackCleanupPlan.rollbackDeleteIngressPlan.required, true, "external_access_strategy_rollback_delete_ingress_required");
  assert.deepEqual(plan.smokePlan.external, ["GET https://portal.medopl.example.com/health", "Portal login page shape", "redaction audit"], "external_access_strategy_smoke_plan");
  assert.equal(plan.redactionEvidence.required, true, "external_access_strategy_redaction_required");
  assertNoExternalAccessSensitiveText(JSON.stringify(plan), "external_access_strategy_plan");

  const summary = await runPackageDExternalAccessStrategyContract({ runId, evidenceDir, authorized: true, strategyInput });
  assert.equal(summary.realExecutionReady, false, "external_access_strategy_real_execution_ready_false");
  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.redactionAudit.dbPasswordExposed, false, "external_access_strategy_evidence_hides_db_password");
  assert.equal(evidence.redactionAudit.tokenExposed, false, "external_access_strategy_evidence_hides_token");
  assert.equal(evidence.redactionAudit.providerSecretExposed, false, "external_access_strategy_evidence_hides_provider_secret");
  assert.equal(evidence.redactionAudit.tencentSecretExposed, false, "external_access_strategy_evidence_hides_tencent_secret");
  assert.equal(evidence.nextGap.id, "production-launch-gap-08-external-access-dry-run-authorization", "external_access_strategy_next_gap");
  assertNoExternalAccessSensitiveText(JSON.stringify(evidence), "external_access_strategy_evidence");

  const readinessInput = {
    discoveryEvidencePath: ".runtime/package-d-external-access-strategy/gap08a-prereq-discovery-001/prereq-discovery-redacted.json",
    portalHost: "portal.medopl.cn",
    ingressClass: "qcloud",
    ingressController: "cloud.tencent.com/ingress-controller",
    namespace: "medopl-platform",
    serviceName: "portal-frontend",
    serviceClusterIP: "172.21.5.91",
    servicePort: 8080,
    tlsSecretName: "medopl-portal-tls",
    certManagerAvailable: false,
    kubernetesTlsSecretPresent: false,
    portalTlsSecretPresent: false,
    externalSmokeUrl: "https://portal.medopl.cn/",
    providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
    tlsCertificatePem: "-----BEGIN CERTIFICATE----- tls-cert-that-must-not-leak -----END CERTIFICATE-----",
    tlsPrivateKeyPem: "-----BEGIN PRIVATE KEY----- tls-private-key-that-must-not-leak -----END PRIVATE KEY-----",
    kubeconfig: "kubeconfig-must-not-leak",
    dbPassword: "postgres-password-that-must-not-leak",
    tencent: {
      SecretId: "tencent-secret-id-that-must-not-leak",
      SecretKey: "tencent-secret-key-that-must-not-leak",
    },
  };

  assert.equal(
    PACKAGE_D_QCLOUD_TLS_READINESS_COMMAND,
    "node tests/support/cloud-prework/package-d-external-access-strategy-runner.js --mode qcloud-tls-readiness-contract-local-gate --run-id <runid> --authorized 1",
    "qcloud_tls_readiness_runner_must_publish_single_repo_native_command",
  );
  await assert.rejects(
    () => buildPackageDQcloudTlsReadinessContract({ runId, evidenceDir, authorized: false, readinessInput }),
    /package_d_qcloud_tls_readiness_not_authorized/,
    "qcloud_tls_readiness_missing_authorization_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDQcloudTlsReadinessContract({
      runId,
      evidenceDir,
      authorized: true,
      readinessInput: { ...readinessInput, ingressClass: "nginx" },
    }),
    /package_d_qcloud_tls_readiness_ingress_class_must_be_qcloud/,
    "qcloud_tls_readiness_non_qcloud_must_fail_closed",
  );

  const readiness = await buildPackageDQcloudTlsReadinessContract({ runId, evidenceDir, authorized: true, readinessInput });
  assert.equal(readiness.contract, "production_launch_gap_08b_qcloud_tls_readiness_contract_local_gate", "qcloud_tls_readiness_contract_name");
  assert.equal(readiness.mode, "qcloud-tls-readiness-contract-local-gate", "qcloud_tls_readiness_mode");
  assert.equal(readiness.target.portalHost, "portal.medopl.cn", "qcloud_tls_portal_host");
  assert.equal(readiness.target.ingressClass, "qcloud", "qcloud_tls_ingress_class");
  assert.equal(readiness.target.tlsSecretName, "medopl-portal-tls", "qcloud_tls_secret_name");
  assert.equal(readiness.target.externalSmokeUrl, "https://portal.medopl.cn/", "qcloud_tls_smoke_url");
  assert.equal(readiness.discovery.ingressClassController, "cloud.tencent.com/ingress-controller", "qcloud_tls_controller");
  assert.equal(readiness.qcloudIngressStrategy.recommended, true, "qcloud_tls_qcloud_recommended");
  assert.equal(readiness.tlsSecretReadiness.certManagerRecommendedNow, false, "qcloud_tls_cert_manager_not_recommended");
  assert.equal(readiness.tlsSecretReadiness.recommendedTlsPath, "tencent_ssl_or_manual_certificate_material_to_authorized_kubernetes_tls_secret", "qcloud_tls_recommended_path");
  assert.equal(readiness.tlsMaterialBoundary.rawTlsMaterialAllowedInGit, false, "qcloud_tls_no_git_material");
  assert.equal(readiness.tlsMaterialBoundary.rawTlsMaterialAllowedInEvidence, false, "qcloud_tls_no_evidence_material");
  assert.equal(readiness.ingressManifestPlan.kind, "Ingress", "qcloud_tls_ingress_manifest_kind");
  assert.equal(readiness.ingressManifestPlan.serverSideDryRunOnlyNext, true, "qcloud_tls_ingress_dry_run_only");
  assert.equal(readiness.dnsReadiness.requiredHost, "portal.medopl.cn", "qcloud_tls_dns_host");
  assert.equal(readiness.rollbackCleanupPlan.deleteIngressPlan.required, true, "qcloud_tls_delete_ingress_required");
  assert.deepEqual(readiness.nextGap.sequence, [
    "TLS Secret creation server-side dry-run or manifest validation",
    "Ingress server-side dry-run",
    "no real mutation",
  ], "qcloud_tls_next_gap_sequence");
  assert.equal(readiness.boundary.kubernetesAccessAllowed, false, "qcloud_tls_no_kubernetes_access");
  assert.equal(readiness.boundary.tlsSecretMutationAllowedNow, false, "qcloud_tls_no_secret_mutation");
  assert.equal(readiness.boundary.ingressMutationAllowedNow, false, "qcloud_tls_no_ingress_mutation");
  assert.equal(readiness.boundary.publicAccessClaimAllowedNow, false, "qcloud_tls_no_public_access_claim");
  assertNoExternalAccessSensitiveText(JSON.stringify(readiness), "qcloud_tls_readiness_plan");

  const readinessSummary = await runPackageDQcloudTlsReadinessContract({ runId, evidenceDir, authorized: true, readinessInput });
  assert.equal(readinessSummary.realExecutionReady, false, "qcloud_tls_real_execution_ready_false");
  assert.equal(readinessSummary.evidencePath.endsWith("qcloud-tls-readiness-contract-redacted.json"), true, "qcloud_tls_evidence_file");
  const readinessEvidence = JSON.parse(await readFile(readinessSummary.evidencePath, "utf8"));
  assert.equal(readinessEvidence.redactionAudit.tlsCertificateMaterialExposed, false, "qcloud_tls_evidence_hides_cert_material");
  assert.equal(readinessEvidence.redactionAudit.tlsPrivateKeyMaterialExposed, false, "qcloud_tls_evidence_hides_key_material");
  assert.equal(readinessEvidence.nextGap.id, "production-launch-gap-08c-qcloud-ingress-tls-server-side-dry-run", "qcloud_tls_next_gap_id");
  assertNoExternalAccessSensitiveText(JSON.stringify(readinessEvidence), "qcloud_tls_readiness_evidence");
} finally {
  await rm(externalAccessEvidenceRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_cleanup_local_gate",
  protectedPlatformServicePool: true,
  tenantNodePoolReleased: true,
  productionWorkspaceLifecycleContract: true,
  productionCanaryRollbackCleanupContract: true,
  packageDExternalAccessStrategyContract: true,
  packageDQcloudTlsReadinessContract: true,
}, null, 2));
