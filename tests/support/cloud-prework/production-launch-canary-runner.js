#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_LAUNCH_CANARY_COMMAND = "node tests/support/cloud-prework/production-launch-canary-runner.js --mode contract-local-gate --run-id <runid> --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/production-launch-canary";
const FIXED_MODE = "contract-local-gate";
const EVIDENCE_FILE = "canary-contract-redacted.json";
const CANARY_STAGES = Object.freeze([
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
]);
const FORBIDDEN_ARGS = Object.freeze(new Set([
  "--kubeconfig",
  "--kubectl",
  "--deploy",
  "--rollout",
  "--rollback",
  "--build",
  "--push",
  "--tencent-mutation",
  "--package-c-live",
  "--postgres",
  "--db",
  "--ingress",
  "--load-balancer",
  "--secret-file",
  "--env",
]));
const PORTAL_CANARY_API_TRACE = Object.freeze([
  Object.freeze({
    methodPath: "POST /api/v22/production/canary/plan",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-canary.ts:planProductionCanary",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
  Object.freeze({
    methodPath: "POST /api/v22/production/canary/commit",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-canary.ts:commitProductionCanary",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
]);
const NEXT_GAP = Object.freeze({
  id: "production-launch-gap-07-external-access-strategy-after-minimum-saas-closure",
  title: "Production launch Gap 07: Portal external access strategy after minimum SaaS closure",
  boundary: "strategy/local gate only until separate authorization; do not default to public Ingress, LoadBalancer, DNS or TLS mutation",
});

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`production_launch_canary_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`production_launch_canary_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`production_launch_canary_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("production_launch_canary_not_authorized");
}

function assertRunId(runId = "") {
  const normalized = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(normalized)) throw new Error("production_launch_canary_run_id_required");
  return normalized;
}

function defaultCanary() {
  return {
    tenantId: "tenant-production-alpha",
    accountId: "account-production-alpha",
    workspaceId: "workspace-production-alpha",
    resourceBindingId: "rb-production-alpha",
    cloudOperationId: "op:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:workspace-ledger-alpha-once",
    billingAttributionId: "bill-production-alpha",
    serverPlanId: "starter_2c4g_10gb",
    providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
    idempotencyKey: "production-canary-alpha-once",
  };
}

function cleanCanary(canary = {}) {
  const fallback = defaultCanary();
  const providerKeyRef = text(canary.providerKeyRef) || fallback.providerKeyRef;
  if (!providerKeyRef || providerKeyRef.includes(" ") || providerKeyRef.includes("raw")) {
    throw new Error("production_launch_canary_provider_key_ref_invalid");
  }
  return {
    tenantId: text(canary.tenantId) || fallback.tenantId,
    accountId: text(canary.accountId) || fallback.accountId,
    workspaceId: text(canary.workspaceId) || fallback.workspaceId,
    resourceBindingId: text(canary.resourceBindingId) || fallback.resourceBindingId,
    cloudOperationId: text(canary.cloudOperationId) || fallback.cloudOperationId,
    billingAttributionId: text(canary.billingAttributionId) || fallback.billingAttributionId,
    serverPlanId: text(canary.serverPlanId) || fallback.serverPlanId,
    providerKeyRef,
    idempotencyKey: text(canary.idempotencyKey) || fallback.idempotencyKey,
  };
}

function operationIdFor(input) {
  return `canary:${input.tenantId}:${input.workspaceId}:${input.resourceBindingId}:${input.idempotencyKey}`;
}

function redactionAudit(serialized = "") {
  return {
    rawSecretMaterialExposed: /gflabtoken-raw-provider-key-material|rawProviderKey"\s*:|providerApiKey"\s*:|providerSecret"\s*:/u.test(serialized),
    dbPasswordExposed: /postgres-password|PORTAL_POSTGRES_PASSWORD|MEDOPL_POSTGRES_LEDGER_PASSWORD|DATABASE_URL/u.test(serialized),
    portalAdminPasswordExposed: /portal-admin-password|PORTAL_ADMIN_PASSWORD/u.test(serialized),
    tokenExposed: /bearer-token|launchToken"\s*:|runtimeToken"\s*:|bearerToken"\s*:/u.test(serialized),
    tencentSecretExposed: /TENCENT_SECRET|SecretId|SecretKey|tencent-secret/u.test(serialized),
    browserStorageSecretWritePresent: /(?:localStorage|sessionStorage)\.setItem/u.test(serialized),
  };
}

function assertNoForbiddenContent(plan) {
  const serialized = JSON.stringify(plan);
  for (const forbidden of [
    "kubectl",
    "docker build",
    "docker push",
    "production_deploy_apply",
    "localStorage.setItem",
    "sessionStorage.setItem",
    "medopl-tenant-",
    "\"kind\":\"Ingress\"",
    "\"type\":\"LoadBalancer\"",
  ]) {
    if (serialized.includes(forbidden)) throw new Error(`production_launch_canary_forbidden_content:${forbidden}`);
  }
  const audit = redactionAudit(serialized);
  if (Object.values(audit).some(Boolean)) throw new Error("production_launch_canary_redaction_audit_failed");
}

async function writeEvidence({ evidenceDir, runId, payload }) {
  const targetDir = path.join(evidenceDir, runId);
  await mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, EVIDENCE_FILE);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildProductionLaunchCanaryContract({
  runId = "",
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  mode = FIXED_MODE,
  canary = {},
  argv = [],
} = {}) {
  parseArgs(argv);
  assertAuthorized(authorized);
  const safeRunId = assertRunId(runId);
  if (mode !== FIXED_MODE) throw new Error("production_launch_canary_mode_required");
  const request = cleanCanary(canary);
  const operationId = operationIdFor(request);
  const plan = {
    ok: true,
    contract: "production_launch_gap_06_canary_rollback_cleanup_contract_local_gate",
    mode: FIXED_MODE,
    command: PRODUCTION_LAUNCH_CANARY_COMMAND,
    runId: safeRunId,
    target: {
      product: "MedOPL multi-tenant SaaS managed OPL workbench",
      phase: "production smoke / canary / rollback / cleanup evidence contract",
      clusterBaseline: "Package D deployed inside TKE; in-cluster HTTP reachability passed",
    },
    canaryRequest: {
      tenantId: request.tenantId,
      accountId: request.accountId,
      workspaceId: request.workspaceId,
      resourceBindingId: request.resourceBindingId,
      cloudOperationId: request.cloudOperationId,
      billingAttributionId: request.billingAttributionId,
      serverPlanId: request.serverPlanId,
      providerKeyRef: request.providerKeyRef,
      idempotencyKey: request.idempotencyKey,
      operationId,
    },
    portalCanaryApiTrace: PORTAL_CANARY_API_TRACE,
    productionCanaryShape: {
      stages: [...CANARY_STAGES],
      contractOnly: true,
      rawSecretFieldsAllowed: false,
    },
    smokeShape: {
      admin: {
        requiredFields: ["adminIdentityRef", "tenantId", "auditEventId"],
        validates: ["first_admin_identity_bootstrapped", "audit_event_linked"],
      },
      tenant: {
        requiredFields: ["tenantId", "accountId", "billingAttributionId", "quotaScopeId"],
        validates: ["tenant_bootstrapped", "commercial_ledger_scope_linked"],
      },
      workspace: {
        requiredFields: ["workspaceId", "resourceBindingId", "cloudOperationId", "providerKeyRef"],
        validates: ["workspace_seed_linked", "provider_key_ref_only", "package_c_boundary_dry_run_only"],
      },
    },
    portalBackendPackageCDryRunBoundary: {
      portalActionShape: "typed Portal API -> Go backend canary plan/commit",
      goBackendRequestShape: "tenant/account/workspace/resourceBinding/cloudOperation/commercial/providerKeyRef/idempotency",
      packageCRunnerBoundary: "contract-only Package C operation invocation shape",
      liveExecutionAllowedNow: false,
      tencentMutationAllowedNow: false,
      packageCLiveAllowedNow: false,
    },
    resourceBindingCloudOperationLinkage: {
      resourceBindingId: request.resourceBindingId,
      cloudOperationId: request.cloudOperationId,
      states: ["requested", "creating", "ready"],
      persistedNow: false,
      futureProductionRepository: "PostgreSQL resource_bindings/cloud_operations",
    },
    commercialLedgerLinkage: {
      billingAttributionId: request.billingAttributionId,
      billingEvent: "production_canary_billing_smoke_planned",
      auditEvent: "production_canary_audit_smoke_planned",
      quotaEvent: "production_canary_quota_smoke_planned",
      persistedNow: false,
    },
    workspaceLifecycleLinkage: {
      actions: ["suspend", "resume", "delete"],
      linkedEvidence: "workspace lifecycle contract evidence shape only",
      lifecycleMutationNow: false,
    },
    rollbackEvidence: {
      required: true,
      evidenceShape: ["rollback_plan_id", "allowed_service_refs", "pre_rollback_snapshot_ref", "post_rollback_snapshot_ref", "redaction_status"],
      commandPlan: {
        allowlistedOnly: true,
        allowedOperations: ["future_service_rollback_for_allowed_services_only", "future_status_read_for_allowed_services_only"],
        executionNow: false,
      },
    },
    cleanupEvidence: {
      required: true,
      evidenceShape: ["cleanup_plan_id", "resource_snapshot_ref", "ledger_snapshot_ref", "smoke_artifact_ref", "redaction_status"],
      commandPlan: {
        allowlistedOnly: true,
        allowedOperations: ["future_run_scoped_smoke_cleanup_only", "future_evidence_retention_check_only"],
        executionNow: false,
      },
    },
    redactionObservabilityEvidence: {
      redactionAuditRequired: true,
      observabilitySignals: ["http_status_summary", "operation_state_summary", "ledger_linkage_summary", "rollback_cleanup_summary"],
      rawSecretOutputAllowed: false,
      browserStorageSecretWriteAllowed: false,
    },
    idempotency: {
      required: true,
      key: request.idempotencyKey,
      operationId,
      duplicateRequestBehavior: "same canary idempotency key must return same operation identity and evidence refs",
    },
    providerBoundary: {
      provider: "gflabtoken",
      publicFields: ["provider", "providerKeyRef", "boundStatus"],
      rawSecretAcceptedByRunner: false,
      rawSecretBackendOnly: true,
      browserStorageAllowed: false,
      evidenceMayContainRawSecret: false,
    },
    productionVsLocalRepository: {
      localRepositoryMode: "dry-run-memory-shape-only",
      futureProductionRepository: "PostgreSQL ledgers plus future Kubernetes execution evidence",
      productionRequiresExplicitPostgresAuthorization: true,
      productionRequiresExplicitKubernetesAuthorization: true,
      readsDbPasswordNow: false,
      connectsToPostgresNow: false,
      connectsToKubernetesNow: false,
      writesProductionRowsNow: false,
    },
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, safeRunId, EVIDENCE_FILE),
      redacted: true,
    },
    externalAccess: {
      status: "blocked_until_multi_tenant_minimum_launch_closure",
      allowedNow: ["contract/local gate only"],
      forbiddenNow: ["public edge mutation", "public user access claim"],
    },
    boundary: {
      contractOnly: true,
      localDevDefaultsAllowedInProduction: false,
      externalAccessBlocked: true,
      kubernetesAccessAllowed: false,
      deployAllowed: false,
      rolloutAllowed: false,
      rollbackAllowed: false,
      buildPushAllowed: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      productionPostgresConnectAllowedNow: false,
      productionPostgresWriteAllowedNow: false,
      productionPostgresReadAllowedNow: false,
      productionBillingChargeAllowedNow: false,
      productionQuotaEnforcementAllowedNow: false,
      nodePortalBackendRestored: false,
      compatibilityControlPlaneAdded: false,
    },
    nextGap: NEXT_GAP,
    realExecutionReady: false,
  };
  assertNoForbiddenContent(plan);
  return plan;
}

export async function runProductionLaunchCanaryContract(options = {}) {
  const plan = await buildProductionLaunchCanaryContract(options);
  const redaction = redactionAudit(JSON.stringify(plan));
  const evidence = {
    ...plan,
    redactionAudit: redaction,
  };
  if (Object.values(redaction).some(Boolean)) throw new Error("production_launch_canary_redaction_audit_failed");
  const evidencePath = await writeEvidence({
    evidenceDir: options.evidenceDir || DEFAULT_EVIDENCE_DIR,
    runId: plan.runId,
    payload: evidence,
  });
  return {
    ok: true,
    contract: plan.contract,
    mode: plan.mode,
    command: plan.command,
    runId: plan.runId,
    evidencePath,
    nextGap: plan.nextGap,
    realExecutionReady: false,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await runProductionLaunchCanaryContract({
    mode: args.mode,
    runId: args["run-id"],
    evidenceDir: args["evidence-dir"] || DEFAULT_EVIDENCE_DIR,
    authorized: args.authorized === "1" || args.authorized === "true",
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
