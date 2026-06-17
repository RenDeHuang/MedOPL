import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import {
  PACKAGE_D_EXTERNAL_ACCESS_APPLY_COMMAND,
  PACKAGE_D_EXTERNAL_ACCESS_DRY_RUN_COMMAND,
  assertPackageDExternalAccessManifestBoundary,
  buildPackageDExternalAccessPlan,
  runPackageDExternalAccessExecution,
  writePackageDExternalAccessPlanEvidence,
} from "../../support/cloud-prework/package-d-external-access-runner.js";

const pemPrivateKeyHeader = ["-----BEGIN", `${["PRIVATE", "KEY"].join(" ")}-----`].join(" ");
const pemPrivateKeyFooter = ["-----END", `${["PRIVATE", "KEY"].join(" ")}-----`].join(" ");

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
    pemPrivateKeyHeader,
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

function assertNoQcloudApplySensitiveText(text = "", label = "text") {
  for (const forbidden of [
    "qcloud-cert-id-must-not-leak",
    "kubernetes.io/tls",
    "tls.crt",
    "tls.key",
    "-----BEGIN CERTIFICATE-----",
    pemPrivateKeyHeader,
    "DATABASE_URL",
    "PORTAL_POSTGRES_PASSWORD",
    "PORTAL_ADMIN_PASSWORD",
    "TCR_SECRET",
    "SecretId",
    "SecretKey",
    "client-key-data",
    "client-certificate-data",
    "medopl-tenant-",
    "kubectl delete namespace",
    "type: LoadBalancer",
    "CreateLoadBalancer",
    "CreateRecord",
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
    tlsPrivateKeyPem: `${pemPrivateKeyHeader} tls-private-key-that-must-not-leak ${pemPrivateKeyFooter}`,
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
  assert.equal(readiness.tlsSecretReadiness.secretType, "Opaque", "qcloud_tls_secret_type_opaque");
  assert.equal(readiness.tlsSecretReadiness.secretKey, "qcloud_cert_id", "qcloud_tls_secret_key_qcloud_cert_id");
  assert.equal(readiness.tlsSecretReadiness.recommendedTlsPath, "authorized_tencent_ssl_cert_id_to_qcloud_opaque_secret", "qcloud_tls_recommended_path");
  assert.equal(readiness.tlsMaterialBoundary.tlsCertKeyMayBeReadInQcloudPath, false, "qcloud_tls_no_cert_key_read_for_qcloud_path");
  assert.equal(readiness.tlsMaterialBoundary.tencentSslCertIdMayBeReadFromAuthorizedEnv, true, "qcloud_tls_cert_id_env_ref_allowed");
  assert.equal(readiness.tlsMaterialBoundary.rawTlsMaterialAllowedInGit, false, "qcloud_tls_no_git_material");
  assert.equal(readiness.tlsMaterialBoundary.rawTlsMaterialAllowedInEvidence, false, "qcloud_tls_no_evidence_material");
  assert.equal(readiness.ingressManifestPlan.kind, "Ingress", "qcloud_tls_ingress_manifest_kind");
  assert.equal(readiness.ingressManifestPlan.tlsSecretType, "Opaque", "qcloud_tls_ingress_secret_type");
  assert.equal(readiness.ingressManifestPlan.tlsSecretKey, "qcloud_cert_id", "qcloud_tls_ingress_secret_key");
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

  const requiredExternalAccessBusinessEnv = Object.freeze({
    PORTAL_HOST_DOMAIN: "portal.medopl.cn",
    INGRESS_CLASS: "qcloud",
    TLS_SECRET_NAME: "medopl-portal-tls",
    TENCENT_SSL_CERT_ID: "qcloud-cert-id-must-not-leak",
    EXTERNAL_SMOKE_URL: "https://portal.medopl.cn/",
  });
  const applyRunGateEnv = Object.freeze({ RUN_TENCENT_DEPLOY_EXECUTION: "external-access" });
  const dryRunGateEnv = Object.freeze({ RUN_TENCENT_DEPLOY_EXECUTION: "0" });
  assert.equal(
    PACKAGE_D_EXTERNAL_ACCESS_DRY_RUN_COMMAND,
    "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-ingress-dry-run --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1",
    "external_access_dry_run_command",
  );
  assert.equal(
    PACKAGE_D_EXTERNAL_ACCESS_APPLY_COMMAND,
    "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-ingress-apply --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1",
    "external_access_apply_command",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: false,
      mode: "qcloud-ingress-apply",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: applyRunGateEnv,
    }),
    /package_d_external_access_not_authorized/,
    "external_access_apply_unauthorized_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-ingress-apply",
      externalAccessEnv: { ...requiredExternalAccessBusinessEnv, PORTAL_HOST_DOMAIN: "" },
      runGateEnv: applyRunGateEnv,
    }),
    /package_d_external_access_env_missing:PORTAL_HOST_DOMAIN/,
    "external_access_missing_host_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-ingress-apply",
      externalAccessEnv: { ...requiredExternalAccessBusinessEnv, RUN_TENCENT_DEPLOY_EXECUTION: "external-access" },
    }),
    /package_d_external_access_env_non_allowlist_key:RUN_TENCENT_DEPLOY_EXECUTION/,
    "external_access_env_must_not_include_run_gate",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-ingress-apply",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: { RUN_TENCENT_DEPLOY_EXECUTION: "1" },
    }),
    /package_d_external_access_apply_gate_not_authorized/,
    "external_access_apply_generic_deploy_gate_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-ingress-apply",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: {},
    }),
    /package_d_external_access_apply_gate_not_authorized/,
    "external_access_apply_missing_run_gate_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-ingress-dry-run",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: applyRunGateEnv,
    }),
    /package_d_external_access_dry_run_gate_must_remain_zero/,
    "external_access_dry_run_must_not_use_apply_gate",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-ingress-dry-run",
      externalAccessEnvContent: [
        "RUN_TENCENT_DEPLOY_EXECUTION=0",
        "PORTAL_HOST_DOMAIN=portal.medopl.cn",
        "INGRESS_CLASS=qcloud",
        "TLS_SECRET_NAME=medopl-portal-tls",
        "TENCENT_SSL_CERT_ID=qcloud-cert-id-must-not-leak",
        "EXTERNAL_SMOKE_URL=https://portal.medopl.cn/",
      ].join("\n"),
      runGateEnv: dryRunGateEnv,
    }),
    /package_d_external_access_env_non_allowlist_key:RUN_TENCENT_DEPLOY_EXECUTION/,
    "external_access_env_content_must_not_include_run_gate",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-ingress-dry-run",
      externalAccessEnvContent: [
        "PORTAL_HOST_DOMAIN=portal.medopl.cn",
        "INGRESS_CLASS=qcloud",
        "TLS_SECRET_NAME=medopl-portal-tls",
        "TENCENT_SSL_CERT_ID=qcloud-cert-id-must-not-leak",
        "EXTERNAL_SMOKE_URL=https://portal.medopl.cn/",
        "TCR_SECRET=tcr-secret-that-must-not-be-read",
      ].join("\n"),
      runGateEnv: dryRunGateEnv,
    }),
    /package_d_external_access_env_non_allowlist_key:TCR_SECRET/,
    "external_access_env_allowlist_must_reject_tcr_secret",
  );

  const dryRunPlan = await buildPackageDExternalAccessPlan({
    runId,
    evidenceDir,
    authorized: true,
    mode: "qcloud-ingress-dry-run",
    externalAccessEnv: requiredExternalAccessBusinessEnv,
    runGateEnv: dryRunGateEnv,
  });
  assert.equal(dryRunPlan.boundary.realMutationAllowedNow, false, "external_access_dry_run_no_real_mutation");
  assert.equal(dryRunPlan.manifests.secret.type, "Opaque", "external_access_secret_type_opaque");
  assert.deepEqual(Object.keys(dryRunPlan.manifests.secret.stringData), ["qcloud_cert_id"], "external_access_secret_key_qcloud_cert_id");
  assert.equal(dryRunPlan.manifests.secret.stringData.qcloud_cert_id, "<redacted-env:TENCENT_SSL_CERT_ID>", "external_access_secret_cert_id_redacted");
  assert.equal(dryRunPlan.manifests.ingress.spec.ingressClassName, "qcloud", "external_access_ingress_class");
  assert.equal(dryRunPlan.manifests.ingress.spec.tls[0].secretName, "medopl-portal-tls", "external_access_ingress_tls_secret");
  assert.equal(dryRunPlan.manifests.ingress.spec.rules[0].host, "portal.medopl.cn", "external_access_ingress_host");
  assert.equal(dryRunPlan.manifests.ingress.spec.rules[0].http.paths[0].backend.service.name, "portal-frontend", "external_access_ingress_backend_service");
  assert.equal(dryRunPlan.manifests.ingress.spec.rules[0].http.paths[0].backend.service.port.number, 8080, "external_access_ingress_backend_port");
  assert.deepEqual(dryRunPlan.env.allowedKeys, [
    "PORTAL_HOST_DOMAIN",
    "INGRESS_CLASS",
    "TLS_SECRET_NAME",
    "TENCENT_SSL_CERT_ID",
    "EXTERNAL_SMOKE_URL",
  ], "external_access_env_allowlist");
  assert.deepEqual(dryRunPlan.allowedOperations.mutations, [
    "server-side dry-run Secret/medopl-portal-tls in medopl-platform, type Opaque, stringData.qcloud_cert_id",
    "server-side dry-run Ingress/portal-frontend in medopl-platform for portal.medopl.cn -> portal-frontend:8080",
  ], "external_access_dry_run_mutation_boundary");
  assertNoQcloudApplySensitiveText(JSON.stringify(dryRunPlan), "external_access_dry_run_plan");

  const applyPlan = await buildPackageDExternalAccessPlan({
    runId,
    evidenceDir,
    authorized: true,
    mode: "qcloud-ingress-apply",
    externalAccessEnv: requiredExternalAccessBusinessEnv,
    runGateEnv: applyRunGateEnv,
  });
  assert.equal(applyPlan.boundary.realMutationAllowedNow, true, "external_access_apply_real_mutation_boundary");
  assert.deepEqual(applyPlan.allowedOperations.mutations, [
    "apply Secret/medopl-portal-tls in medopl-platform, type Opaque, stringData.qcloud_cert_id",
    "apply Ingress/portal-frontend in medopl-platform for portal.medopl.cn -> portal-frontend:8080",
  ], "external_access_apply_mutation_allowlist");
  assert(applyPlan.commands.every((command) => !command.command.includes("kubectl delete")), "external_access_commands_must_not_delete");
  assert(applyPlan.commands.some((command) => command.name === "apply_qcloud_cert_secret"), "external_access_apply_secret_command");
  assert(applyPlan.commands.some((command) => command.name === "apply_portal_ingress"), "external_access_apply_ingress_command");
  assert.equal(applyPlan.rollbackCleanupPlan.rollbackRequiresSeparateAuthorization, true, "external_access_rollback_separate_auth");
  assertNoQcloudApplySensitiveText(JSON.stringify(applyPlan), "external_access_apply_plan");
  assert.throws(
    () => assertPackageDExternalAccessManifestBoundary({
      secret: {
        apiVersion: "v1",
        kind: "Secret",
        metadata: { name: "medopl-portal-tls", namespace: "medopl-platform" },
        type: "kubernetes.io/tls",
        stringData: { "tls.crt": "cert", "tls.key": "key" },
      },
      ingress: applyPlan.manifests.ingress,
    }),
    /package_d_external_access_tls_secret_type_mismatch/,
    "external_access_kubernetes_tls_path_must_fail_closed",
  );
  const applyEvidence = await writePackageDExternalAccessPlanEvidence({ plan: applyPlan });
  assert.equal(applyEvidence.path.endsWith("real-mutation-redacted.json"), true, "external_access_real_evidence_path");
  const applyEvidencePayload = JSON.parse(await readFile(applyEvidence.path, "utf8"));
  assert.equal(applyEvidencePayload.redactionAudit.tencentSslCertIdExposed, false, "external_access_evidence_hides_cert_id");
  assert.equal(applyEvidencePayload.redactionAudit.tlsPrivateKeyMaterialExposed, false, "external_access_evidence_hides_tls_key");
  assertNoQcloudApplySensitiveText(JSON.stringify(applyEvidencePayload), "external_access_evidence");

  const envPath = path.join(externalAccessEvidenceRoot, "package-d-external-access.env");
  const kubeconfigPath = path.join(externalAccessEvidenceRoot, "kubeconfig-package-d-deploy");
  await writeFile(envPath, [
    "PORTAL_HOST_DOMAIN=portal.medopl.cn",
    "INGRESS_CLASS=qcloud",
    "TLS_SECRET_NAME=medopl-portal-tls",
    "TENCENT_SSL_CERT_ID=qcloud-cert-id-must-not-leak",
    "EXTERNAL_SMOKE_URL=https://portal.medopl.cn/",
  ].join("\n"));
  await writeFile(kubeconfigPath, [
    "apiVersion: v1",
    "current-context: cls-fi097sy4-context",
    "clusters:",
    "- name: cls-fi097sy4",
    "  cluster:",
    "    server: https://cls-fi097sy4.example.invalid",
    "contexts:",
    "- name: cls-fi097sy4-context",
    "  context:",
    "    cluster: cls-fi097sy4",
  ].join("\n"));
  const previousRunGate = process.env.RUN_TENCENT_DEPLOY_EXECUTION;
  process.env.RUN_TENCENT_DEPLOY_EXECUTION = "external-access";
  try {
    const commandLog = [];
    const execution = await runPackageDExternalAccessExecution({
      envPath,
      kubeconfigPath,
      evidenceDir,
      authorized: true,
      mode: "qcloud-ingress-apply",
      runId: "gap08d-local-execution",
      commandExecutor: async ({ args, stdin, env }) => {
        commandLog.push({ args, stdin, envKeys: Object.keys(env).sort() });
        assert.equal(args[0] === "kubectl" || args[0] === "getent" || args[0] === "curl", true, "external_access_executor_command_allowlist");
        if (args[0] === "kubectl") {
          assert.deepEqual(Object.keys(env).sort(), ["KUBECONFIG"], "external_access_kubectl_env_only_kubeconfig");
        }
        if (args.includes("delete") || args.includes("patch") || args.includes("scale") || args.includes("rollout") || args.includes("exec")) {
          throw new Error(`external_access_forbidden_fake_command:${args.join(" ")}`);
        }
        if (args.join(" ").includes("config current-context")) return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
        if (args.join(" ").includes("get namespace medopl-platform")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"medopl-platform\"}}\n", stderr: "" };
        if (args.join(" ").includes("get service portal-frontend")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend\"},\"spec\":{\"ports\":[{\"port\":8080}]}}\n", stderr: "" };
        if (args.join(" ").includes("get ingressclass qcloud")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"qcloud\"},\"spec\":{\"controller\":\"cloud.tencent.com/ingress-controller\"}}\n", stderr: "" };
        if (args.includes("apply")) {
          assert.equal(args[args.indexOf("-f") + 1], "-", "external_access_apply_and_dry_run_must_use_stdin_manifest");
          assert.equal(String(stdin || "").trim().startsWith("{"), true, "external_access_execution_stdin_must_include_manifest");
          if (String(stdin || "").includes("\"kind\": \"Secret\"")) {
            assert.equal(String(stdin || "").includes("qcloud-cert-id-must-not-leak"), true, "external_access_execution_secret_stdin_uses_live_manifest");
          }
          assert.equal(String(stdin || "").includes("<redacted-env:TENCENT_SSL_CERT_ID>"), false, "external_access_execution_stdin_must_not_use_redacted_manifest");
        }
        if (args.join(" ").includes("get secret medopl-portal-tls")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"medopl-portal-tls\"},\"type\":\"Opaque\"}\n", stderr: "" };
        if (args.join(" ").includes("describe secret medopl-portal-tls")) return { status: 0, stdout: "Name: medopl-portal-tls\nType: Opaque\n", stderr: "" };
        if (args.join(" ").includes("get ingress portal-frontend")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend\"}}\n", stderr: "" };
        if (args.join(" ").includes("describe ingress portal-frontend")) return { status: 0, stdout: "Name: portal-frontend\n", stderr: "" };
        if (args[0] === "getent") return { status: 0, stdout: "203.0.113.10 portal.medopl.cn\n", stderr: "" };
        if (args[0] === "curl") return { status: 0, stdout: "portal ok\n", stderr: "" };
        return { status: 0, stdout: "ok\n", stderr: "" };
      },
    });
    assert.equal(execution.ok, true, "external_access_fake_execution_must_pass");
    assert.equal(commandLog.some((entry) => entry.args.includes("--dry-run=server")), true, "external_access_execution_must_run_server_side_dry_run");
    assert.equal(commandLog.some((entry) => entry.args.includes("apply") && !entry.args.includes("--dry-run=server")), true, "external_access_execution_must_apply_after_dry_run");
    const runEvidenceDir = path.join(evidenceDir, "gap08d-local-execution");
    const redactedSecretEvidence = JSON.parse(await readFile(path.join(runEvidenceDir, "qcloud-cert-secret-redacted.json"), "utf8"));
    const redactedIngressEvidence = JSON.parse(await readFile(path.join(runEvidenceDir, "portal-ingress-redacted.json"), "utf8"));
    assert.equal(redactedSecretEvidence.stringData.qcloud_cert_id, "<redacted-env:TENCENT_SSL_CERT_ID>", "external_access_execution_secret_manifest_evidence_redacted");
    assert.equal(redactedIngressEvidence.kind, "Ingress", "external_access_execution_ingress_manifest_evidence_written");
    const executionEvidenceText = await readFile(execution.evidencePath, "utf8");
    assertNoQcloudApplySensitiveText(executionEvidenceText, "external_access_execution_evidence");

    await assert.rejects(
      runPackageDExternalAccessExecution({
        envPath,
        kubeconfigPath,
        evidenceDir,
        authorized: true,
        mode: "qcloud-ingress-apply",
        runId: "gap08d-local-dry-run-failure",
        commandExecutor: async ({ args, stdin }) => {
          if (args.join(" ").includes("config current-context")) return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
          if (args.join(" ").includes("get namespace medopl-platform")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"medopl-platform\"}}\n", stderr: "" };
          if (args.join(" ").includes("get service portal-frontend")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend\"},\"spec\":{\"ports\":[{\"port\":8080}]}}\n", stderr: "" };
          if (args.join(" ").includes("get ingressclass qcloud")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"qcloud\"},\"spec\":{\"controller\":\"cloud.tencent.com/ingress-controller\"}}\n", stderr: "" };
          if (args.includes("apply") && args.includes("--dry-run=server")) {
            assert.equal(args[args.indexOf("-f") + 1], "-", "external_access_failed_dry_run_uses_stdin_manifest");
            assert.equal(String(stdin || "").includes("qcloud-cert-id-must-not-leak"), true, "external_access_failed_dry_run_uses_live_manifest_stdin");
            return { status: 1, stdout: "", stderr: "server dry-run rejected qcloud cert secret qcloud-cert-id-must-not-leak" };
          }
          return { status: 0, stdout: "ok\n", stderr: "" };
        },
      }),
      /package_d_external_access_command_failed:dry_run_qcloud_cert_secret/,
      "external_access_dry_run_failure_must_fail_closed",
    );
    const failureRunEvidenceDir = path.join(evidenceDir, "gap08d-local-dry-run-failure");
    const failureSecretEvidence = await readFile(path.join(failureRunEvidenceDir, "qcloud-cert-secret-redacted.json"), "utf8");
    const failureIngressEvidence = await readFile(path.join(failureRunEvidenceDir, "portal-ingress-redacted.json"), "utf8");
    const failureExecutionEvidence = await readFile(path.join(failureRunEvidenceDir, "real-mutation-redacted.json"), "utf8");
    assert.equal(failureSecretEvidence.includes("<redacted-env:TENCENT_SSL_CERT_ID>"), true, "external_access_failed_dry_run_secret_manifest_evidence_written");
    assert.equal(failureIngressEvidence.includes("\"kind\": \"Ingress\""), true, "external_access_failed_dry_run_ingress_manifest_evidence_written");
    assert.equal(failureExecutionEvidence.includes("dry_run_qcloud_cert_secret"), true, "external_access_failed_dry_run_execution_evidence_written");
    assertNoQcloudApplySensitiveText(failureSecretEvidence, "external_access_failed_dry_run_secret_manifest_evidence");
    assertNoQcloudApplySensitiveText(failureIngressEvidence, "external_access_failed_dry_run_ingress_manifest_evidence");
    assertNoQcloudApplySensitiveText(failureExecutionEvidence, "external_access_failed_dry_run_execution_evidence");
  } finally {
    if (previousRunGate === undefined) {
      delete process.env.RUN_TENCENT_DEPLOY_EXECUTION;
    } else {
      process.env.RUN_TENCENT_DEPLOY_EXECUTION = previousRunGate;
    }
  }
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
  packageDQcloudExternalAccessRunnerContract: true,
}, null, 2));
