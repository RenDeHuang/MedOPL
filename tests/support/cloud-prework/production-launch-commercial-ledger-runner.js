#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_LAUNCH_COMMERCIAL_LEDGER_COMMAND = "node tests/support/cloud-prework/production-launch-commercial-ledger-runner.js --mode contract-local-gate --run-id <runid> --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/production-launch-commercial-ledger";
const FIXED_MODE = "contract-local-gate";
const EVIDENCE_FILE = "commercial-ledger-contract-redacted.json";
const BILLING_LEDGER_FIELDS = Object.freeze([
  "billing_event_id",
  "tenant_id",
  "account_id",
  "workspace_id",
  "resource_binding_id",
  "cloud_operation_id",
  "billing_attribution_id",
  "server_plan_id",
  "event_type",
  "status",
  "amount",
  "currency",
  "usage_quantity",
  "usage_unit",
  "cost_attribution_scope",
  "idempotency_key",
]);
const AUDIT_LEDGER_FIELDS = Object.freeze([
  "audit_event_id",
  "tenant_id",
  "account_id",
  "workspace_id",
  "resource_binding_id",
  "cloud_operation_id",
  "billing_attribution_id",
  "actor_type",
  "action",
  "status",
  "idempotency_key",
  "redaction_status",
]);
const QUOTA_LEDGER_FIELDS = Object.freeze([
  "quota_event_id",
  "tenant_id",
  "account_id",
  "workspace_id",
  "resource_binding_id",
  "cloud_operation_id",
  "server_plan_id",
  "quota_type",
  "limit_value",
  "usage_value",
  "enforcement_decision",
  "idempotency_key",
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
const LOCAL_FALLBACK_IDS = Object.freeze([
  "tenant-local-rc",
  "workspace-local-rc",
  "rb-local-rc",
  "op-local-rc",
  "bill-local-rc",
]);
const PORTAL_COMMERCIAL_LEDGER_API_TRACE = Object.freeze([
  Object.freeze({
    methodPath: "POST /api/v22/production/commercial-ledger/plan",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-commercial-ledger.ts:planProductionCommercialLedger",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
  Object.freeze({
    methodPath: "POST /api/v22/production/commercial-ledger/commit",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-commercial-ledger.ts:commitProductionCommercialLedger",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
]);
const NEXT_GAP = Object.freeze({
  id: "production-launch-gap-05-workspace-lifecycle-contract",
  title: "Production launch Gap 05: workspace suspend / resume / delete lifecycle contract",
  boundary: "local contract only until separate authorization; no production lifecycle mutation, Package C live execution, PostgreSQL write/read or external access",
});

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`production_launch_commercial_ledger_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`production_launch_commercial_ledger_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`production_launch_commercial_ledger_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("production_launch_commercial_ledger_not_authorized");
}

function assertRunId(runId = "") {
  const normalized = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(normalized)) throw new Error("production_launch_commercial_ledger_run_id_required");
  return normalized;
}

function defaultLedger() {
  return {
    tenantId: "tenant-production-alpha",
    accountId: "account-production-alpha",
    workspaceId: "workspace-production-alpha",
    resourceBindingId: "rb-production-alpha",
    cloudOperationId: "op:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:workspace-ledger-alpha-once",
    billingAttributionId: "bill-production-alpha",
    serverPlanId: "starter_2c4g_10gb",
    workspaceStorageGb: 10,
    providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
    idempotencyKey: "workspace-commercial-ledger-alpha-once",
    quota: {
      storageGb: 10,
      cpuCores: 2,
      memoryGb: 4,
      maxConcurrentRuns: 1,
    },
  };
}

function positiveInteger(value, fallback, errorCode) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(errorCode);
  return parsed;
}

function cleanLedger(ledger = {}) {
  const fallback = defaultLedger();
  const providerKeyRef = text(ledger.providerKeyRef) || fallback.providerKeyRef;
  if (!providerKeyRef || providerKeyRef.includes(" ") || providerKeyRef.includes("raw")) {
    throw new Error("production_launch_commercial_ledger_provider_key_ref_invalid");
  }
  const quota = ledger.quota || {};
  return {
    tenantId: text(ledger.tenantId) || fallback.tenantId,
    accountId: text(ledger.accountId) || fallback.accountId,
    workspaceId: text(ledger.workspaceId) || fallback.workspaceId,
    resourceBindingId: text(ledger.resourceBindingId) || fallback.resourceBindingId,
    cloudOperationId: text(ledger.cloudOperationId) || fallback.cloudOperationId,
    billingAttributionId: text(ledger.billingAttributionId) || fallback.billingAttributionId,
    serverPlanId: text(ledger.serverPlanId) || fallback.serverPlanId,
    workspaceStorageGb: positiveInteger(ledger.workspaceStorageGb, fallback.workspaceStorageGb, "production_launch_commercial_ledger_workspace_storage_gb_invalid"),
    providerKeyRef,
    idempotencyKey: text(ledger.idempotencyKey) || fallback.idempotencyKey,
    quota: {
      storageGb: positiveInteger(quota.storageGb, fallback.quota.storageGb, "production_launch_commercial_ledger_quota_storage_invalid"),
      cpuCores: positiveInteger(quota.cpuCores, fallback.quota.cpuCores, "production_launch_commercial_ledger_quota_cpu_invalid"),
      memoryGb: positiveInteger(quota.memoryGb, fallback.quota.memoryGb, "production_launch_commercial_ledger_quota_memory_invalid"),
      maxConcurrentRuns: positiveInteger(quota.maxConcurrentRuns, fallback.quota.maxConcurrentRuns, "production_launch_commercial_ledger_quota_concurrency_invalid"),
    },
  };
}

function operationIdFor(input) {
  return `commercial:${input.tenantId}:${input.workspaceId}:${input.resourceBindingId}:${input.idempotencyKey}`;
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
  ]) {
    if (serialized.includes(forbidden)) throw new Error(`production_launch_commercial_ledger_forbidden_content:${forbidden}`);
  }
  const audit = redactionAudit(serialized);
  if (Object.values(audit).some(Boolean)) throw new Error("production_launch_commercial_ledger_redaction_audit_failed");
}

function linkedRows(input, operationId) {
  const shared = {
    tenant_id: input.tenantId,
    account_id: input.accountId,
    workspace_id: input.workspaceId,
    resource_binding_id: input.resourceBindingId,
    cloud_operation_id: input.cloudOperationId,
    billing_attribution_id: input.billingAttributionId,
    server_plan_id: input.serverPlanId,
    idempotency_key: input.idempotencyKey,
  };
  return {
    billingEvent: {
      billing_event_id: `bill-event:${operationId}`,
      ...shared,
      event_type: "workspace_resource_reserved",
      status: "pending",
      amount: 0,
      currency: "CNY",
      usage_quantity: input.workspaceStorageGb,
      usage_unit: "workspace_storage_gb",
      cost_attribution_scope: "tenant/account/workspace/resourceBinding/cloudOperation/billingAttribution/serverPlan",
    },
    auditEvent: {
      audit_event_id: `audit-event:${operationId}`,
      ...shared,
      actor_type: "system",
      action: "commercial_ledger_contract_planned",
      status: "pending",
      redaction_status: "redacted",
    },
    quotaEvent: {
      quota_event_id: `quota-event:${operationId}`,
      tenant_id: input.tenantId,
      account_id: input.accountId,
      workspace_id: input.workspaceId,
      resource_binding_id: input.resourceBindingId,
      cloud_operation_id: input.cloudOperationId,
      server_plan_id: input.serverPlanId,
      quota_type: "workspace_storage_gb",
      limit_value: input.quota.storageGb,
      usage_value: input.workspaceStorageGb,
      enforcement_decision: "allow",
      idempotency_key: input.idempotencyKey,
    },
  };
}

async function writeEvidence({ evidenceDir, runId, payload }) {
  const targetDir = path.join(evidenceDir, runId);
  await mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, EVIDENCE_FILE);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildProductionLaunchCommercialLedgerContract({
  runId = "",
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  mode = FIXED_MODE,
  ledger = {},
  argv = [],
} = {}) {
  parseArgs(argv);
  assertAuthorized(authorized);
  const safeRunId = assertRunId(runId);
  if (mode !== FIXED_MODE) throw new Error("production_launch_commercial_ledger_mode_required");
  const request = cleanLedger(ledger);
  const operationId = operationIdFor(request);
  const rows = linkedRows(request, operationId);
  const plan = {
    ok: true,
    contract: "production_launch_gap_04_billing_audit_quota_ledger_contract_local_gate",
    mode: FIXED_MODE,
    command: PRODUCTION_LAUNCH_COMMERCIAL_LEDGER_COMMAND,
    runId: safeRunId,
    target: {
      product: "MedOPL multi-tenant SaaS managed OPL workbench",
      phase: "billing / audit / quota ledger contract",
      clusterBaseline: "Package D deployed inside TKE; in-cluster HTTP reachability passed",
    },
    commercialLedgerRequest: {
      tenantId: request.tenantId,
      accountId: request.accountId,
      workspaceId: request.workspaceId,
      resourceBindingId: request.resourceBindingId,
      cloudOperationId: request.cloudOperationId,
      billingAttributionId: request.billingAttributionId,
      serverPlanId: request.serverPlanId,
      workspaceStorageGb: request.workspaceStorageGb,
      providerKeyRef: request.providerKeyRef,
      idempotencyKey: request.idempotencyKey,
      operationId,
    },
    portalCommercialLedgerApiTrace: PORTAL_COMMERCIAL_LEDGER_API_TRACE,
    linkage: {
      resourceBindingId: request.resourceBindingId,
      cloudOperationId: request.cloudOperationId,
      billingAttributionId: request.billingAttributionId,
      parentLedgersRequired: ["resource_bindings.resource_binding_id", "cloud_operations.operation_id"],
      canonicalOwnershipSource: "postgres_resource_binding_ledger",
    },
    billingLedgerShape: {
      table: "billing_events",
      requiredWriteFields: [...BILLING_LEDGER_FIELDS],
      readbackKey: "billing_event_id",
      uniqueKeys: ["billing_event_id", "idempotency_key"],
      statusField: "status",
      row: rows.billingEvent,
      productionWriteNow: false,
      productionReadNow: false,
    },
    auditLedgerShape: {
      table: "audit_events",
      requiredWriteFields: [...AUDIT_LEDGER_FIELDS],
      readbackKey: "audit_event_id",
      uniqueKeys: ["audit_event_id", "idempotency_key"],
      statusField: "status",
      row: rows.auditEvent,
      productionWriteNow: false,
      productionReadNow: false,
    },
    quotaLedgerShape: {
      table: "quota_ledger",
      requiredWriteFields: [...QUOTA_LEDGER_FIELDS],
      readbackKey: "quota_event_id",
      uniqueKeys: ["quota_event_id", "idempotency_key"],
      statusField: "enforcement_decision",
      row: rows.quotaEvent,
      productionWriteNow: false,
      productionReadNow: false,
    },
    quotaEnforcementBoundary: {
      quotaTypes: ["workspace_storage_gb", "cpu_cores", "memory_gb", "max_concurrent_runs"],
      packageCAdmissionDependsOnQuotaDecision: true,
      productionEnforcementNow: false,
      localDecisionNow: "shape-only",
      futureDecisionValues: ["allow", "deny", "manual_review"],
      failClosedWhenMissingQuota: true,
    },
    workspaceCostAttribution: {
      costAttributionScope: "tenant/account/workspace/resourceBinding/cloudOperation/billingAttribution/serverPlan",
      workspaceId: request.workspaceId,
      accountId: request.accountId,
      resourceBindingId: request.resourceBindingId,
      cloudOperationId: request.cloudOperationId,
      billingAttributionId: request.billingAttributionId,
      serverPlanId: request.serverPlanId,
      currency: "CNY",
      chargeAppliedNow: false,
    },
    idempotency: {
      required: true,
      key: request.idempotencyKey,
      operationId,
      uniqueKeys: {
        billing: "idempotency_key",
        audit: "idempotency_key",
        quota: "idempotency_key",
      },
      duplicateRequestBehavior: "same commercial ledger operation must return same billing/audit/quota row identities, not create a second truth",
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
      localFallbackIds: [...LOCAL_FALLBACK_IDS],
      futureProductionRepository: "PostgreSQL billing_events/audit_events/quota_ledger",
      futureProductionParentRepository: "PostgreSQL resource_bindings/cloud_operations",
      productionRequiresExplicitPostgresAuthorization: true,
      productionParentRowsMustExist: true,
      readsDbPasswordNow: false,
      connectsToPostgresNow: false,
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
      forbiddenNow: [
        "external access strategy execution",
        "public user access claim",
        "Ingress/LB/DNS/TLS mutation",
      ],
    },
    boundary: {
      contractOnly: true,
      localDevDefaultsAllowedInProduction: false,
      externalAccessBlocked: true,
      kubernetesAccessAllowed: false,
      deployAllowed: false,
      buildPushAllowed: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      productionPostgresConnectAllowedNow: false,
      productionPostgresWriteAllowedNow: false,
      productionPostgresReadAllowedNow: false,
      productionBillingChargeAllowedNow: false,
      productionQuotaEnforcementAllowedNow: false,
      workspaceLifecycleImplementedNow: false,
      nodePortalBackendRestored: false,
      compatibilityControlPlaneAdded: false,
    },
    nextGap: NEXT_GAP,
    realExecutionReady: false,
  };
  assertNoForbiddenContent(plan);
  return plan;
}

export async function runProductionLaunchCommercialLedgerContract(options = {}) {
  const plan = await buildProductionLaunchCommercialLedgerContract(options);
  const redaction = redactionAudit(JSON.stringify(plan));
  const evidence = {
    ...plan,
    redactionAudit: redaction,
  };
  if (Object.values(redaction).some(Boolean)) throw new Error("production_launch_commercial_ledger_redaction_audit_failed");
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
  const summary = await runProductionLaunchCommercialLedgerContract({
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
