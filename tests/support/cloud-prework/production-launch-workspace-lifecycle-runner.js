#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_LAUNCH_WORKSPACE_LIFECYCLE_COMMAND = "node tests/support/cloud-prework/production-launch-workspace-lifecycle-runner.js --mode contract-local-gate --run-id <runid> --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/production-launch-workspace-lifecycle";
const FIXED_MODE = "contract-local-gate";
const EVIDENCE_FILE = "workspace-lifecycle-contract-redacted.json";
const LIFECYCLE_ACTIONS = Object.freeze(["suspend", "resume", "delete"]);
const LIFECYCLE_REQUEST_FIELDS = Object.freeze([
  "tenantId",
  "accountId",
  "workspaceId",
  "resourceBindingId",
  "cloudOperationId",
  "billingAttributionId",
  "serverPlanId",
  "providerKeyRef",
  "idempotencyKey",
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
  "account-local-rc",
  "workspace-local-rc",
  "rb-local-rc",
  "op-local-rc",
  "bill-local-rc",
]);
const PORTAL_WORKSPACE_LIFECYCLE_API_TRACE = Object.freeze([
  Object.freeze({
    methodPath: "POST /api/v22/production/workspace-lifecycle/plan",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-workspace-lifecycle.ts:planProductionWorkspaceLifecycle",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
  Object.freeze({
    methodPath: "POST /api/v22/production/workspace-lifecycle/commit",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-workspace-lifecycle.ts:commitProductionWorkspaceLifecycle",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
]);
const NEXT_GAP = Object.freeze({
  id: "production-launch-gap-06-production-canary-rollback-evidence-contract",
  title: "Production launch Gap 06: production smoke / canary / rollback / cleanup evidence contract",
  boundary: "local contract only until separate authorization; external access remains blocked until multi-tenant minimum launch closure is complete",
});

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`production_launch_workspace_lifecycle_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`production_launch_workspace_lifecycle_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`production_launch_workspace_lifecycle_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("production_launch_workspace_lifecycle_not_authorized");
}

function assertRunId(runId = "") {
  const normalized = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(normalized)) throw new Error("production_launch_workspace_lifecycle_run_id_required");
  return normalized;
}

function defaultLifecycle() {
  return {
    tenantId: "tenant-production-alpha",
    accountId: "account-production-alpha",
    workspaceId: "workspace-production-alpha",
    resourceBindingId: "rb-production-alpha",
    cloudOperationId: "op:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:workspace-ledger-alpha-once",
    billingAttributionId: "bill-production-alpha",
    serverPlanId: "starter_2c4g_10gb",
    providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
    idempotencyKey: "workspace-lifecycle-alpha-once",
  };
}

function cleanLifecycle(lifecycle = {}) {
  const fallback = defaultLifecycle();
  const providerKeyRef = text(lifecycle.providerKeyRef) || fallback.providerKeyRef;
  if (!providerKeyRef || providerKeyRef.includes(" ") || providerKeyRef.includes("raw")) {
    throw new Error("production_launch_workspace_lifecycle_provider_key_ref_invalid");
  }
  return {
    tenantId: text(lifecycle.tenantId) || fallback.tenantId,
    accountId: text(lifecycle.accountId) || fallback.accountId,
    workspaceId: text(lifecycle.workspaceId) || fallback.workspaceId,
    resourceBindingId: text(lifecycle.resourceBindingId) || fallback.resourceBindingId,
    cloudOperationId: text(lifecycle.cloudOperationId) || fallback.cloudOperationId,
    billingAttributionId: text(lifecycle.billingAttributionId) || fallback.billingAttributionId,
    serverPlanId: text(lifecycle.serverPlanId) || fallback.serverPlanId,
    providerKeyRef,
    idempotencyKey: text(lifecycle.idempotencyKey) || fallback.idempotencyKey,
  };
}

function operationIdFor(input) {
  return `lifecycle:${input.tenantId}:${input.workspaceId}:${input.resourceBindingId}:${input.idempotencyKey}`;
}

function requestFor(input, action) {
  return {
    tenantId: input.tenantId,
    accountId: input.accountId,
    workspaceId: input.workspaceId,
    resourceBindingId: input.resourceBindingId,
    cloudOperationId: `${input.cloudOperationId}:${action}`,
    billingAttributionId: input.billingAttributionId,
    serverPlanId: input.serverPlanId,
    providerKeyRef: input.providerKeyRef,
    idempotencyKey: `${input.idempotencyKey}:${action}`,
  };
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
    if (serialized.includes(forbidden)) throw new Error(`production_launch_workspace_lifecycle_forbidden_content:${forbidden}`);
  }
  const audit = redactionAudit(serialized);
  if (Object.values(audit).some(Boolean)) throw new Error("production_launch_workspace_lifecycle_redaction_audit_failed");
}

function lifecycleRows(input) {
  const operationId = operationIdFor(input);
  return {
    suspend: {
      resourceBinding: {
        resource_binding_id: input.resourceBindingId,
        workspace_id: input.workspaceId,
        status_before: "ready",
        requested_status: "suspendRequested",
        terminal_status: "suspended",
        operation_id: `${operationId}:suspend`,
      },
      billing: {
        billing_event_type: "workspace_billing_stopped",
        billing_attribution_id: input.billingAttributionId,
      },
      audit: {
        action: "workspace_suspend_requested",
        redaction_status: "redacted",
      },
      quota: {
        quota_event_type: "workspace_quota_released",
        restore_token_ref: "quota-restore-ref-only",
      },
    },
    resume: {
      resourceBinding: {
        resource_binding_id: input.resourceBindingId,
        workspace_id: input.workspaceId,
        status_before: "suspended",
        requested_status: "resumeRequested",
        terminal_status: "ready",
        operation_id: `${operationId}:resume`,
      },
      billing: {
        billing_event_type: "workspace_billing_resumed",
        billing_attribution_id: input.billingAttributionId,
      },
      audit: {
        action: "workspace_resume_requested",
        redaction_status: "redacted",
      },
      quota: {
        quota_event_type: "workspace_quota_restored",
        restore_token_ref: "quota-restore-ref-only",
      },
    },
    delete: {
      resourceBinding: {
        resource_binding_id: input.resourceBindingId,
        workspace_id: input.workspaceId,
        status_before: "ready",
        requested_status: "releaseRequested",
        transitional_status: "deleting",
        terminal_status: "released",
        operation_id: `${operationId}:delete`,
      },
      billing: {
        billing_event_type: "workspace_billing_finalized",
        billing_attribution_id: input.billingAttributionId,
      },
      audit: {
        action: "workspace_delete_requested",
        redaction_status: "redacted",
      },
      quota: {
        quota_event_type: "workspace_quota_final_released",
        restore_token_ref: "none_after_delete",
      },
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

export async function buildProductionLaunchWorkspaceLifecycleContract({
  runId = "",
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  mode = FIXED_MODE,
  lifecycle = {},
  argv = [],
} = {}) {
  parseArgs(argv);
  assertAuthorized(authorized);
  const safeRunId = assertRunId(runId);
  if (mode !== FIXED_MODE) throw new Error("production_launch_workspace_lifecycle_mode_required");
  const request = cleanLifecycle(lifecycle);
  const operationId = operationIdFor(request);
  const rows = lifecycleRows(request);
  const requests = Object.fromEntries(LIFECYCLE_ACTIONS.map((action) => [action, requestFor(request, action)]));
  const plan = {
    ok: true,
    contract: "production_launch_gap_05_workspace_lifecycle_contract_local_gate",
    mode: FIXED_MODE,
    command: PRODUCTION_LAUNCH_WORKSPACE_LIFECYCLE_COMMAND,
    runId: safeRunId,
    target: {
      product: "MedOPL multi-tenant SaaS managed OPL workbench",
      phase: "workspace suspend / resume / delete lifecycle contract",
      clusterBaseline: "Package D deployed inside TKE; in-cluster HTTP reachability passed",
    },
    lifecycleRequest: {
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
    portalWorkspaceLifecycleApiTrace: PORTAL_WORKSPACE_LIFECYCLE_API_TRACE,
    requestShape: {
      actions: [...LIFECYCLE_ACTIONS],
      requiredFields: [...LIFECYCLE_REQUEST_FIELDS],
      rawSecretFieldsAllowed: false,
    },
    requests,
    resourceBindingLifecycle: {
      canonicalTable: "resource_bindings",
      canonicalOwnershipSource: "postgres_resource_binding_ledger",
      statesByAction: {
        suspend: ["ready", "suspendRequested", "suspended"],
        resume: ["suspended", "resumeRequested", "ready"],
        delete: ["ready", "releaseRequested", "deleting", "released"],
      },
      rows,
      productionWriteNow: false,
      productionReadNow: false,
    },
    cloudOperationLifecycle: {
      canonicalTable: "cloud_operations",
      operationTypes: {
        suspend: "workspace_suspend",
        resume: "workspace_resume",
        delete: "workspace_delete",
      },
      statusFlow: ["requested", "creating", "ready"],
      operationId,
      idempotencyKey: request.idempotencyKey,
      productionWriteNow: false,
      productionReadNow: false,
    },
    billingLifecycle: {
      table: "billing_events",
      actions: ["stop_on_suspend", "resume_on_resume", "finalize_on_delete"],
      resourceBindingId: request.resourceBindingId,
      cloudOperationId: request.cloudOperationId,
      billingAttributionId: request.billingAttributionId,
      productionChargeMutationNow: false,
    },
    auditLifecycle: {
      table: "audit_events",
      actions: ["workspace_suspend_requested", "workspace_resume_requested", "workspace_delete_requested"],
      redactionRequired: true,
      providerKeyRefOnly: true,
    },
    quotaLifecycle: {
      table: "quota_ledger",
      actions: ["release_on_suspend", "restore_on_resume", "final_release_on_delete"],
      enforcementBoundary: "contract-only",
      packageCAdmissionDependsOnFutureQuotaGate: true,
      productionEnforcementNow: false,
    },
    idempotency: {
      required: true,
      key: request.idempotencyKey,
      operationId,
      perActionOperationIds: Object.fromEntries(LIFECYCLE_ACTIONS.map((action) => [action, `${operationId}:${action}`])),
      duplicateRequestBehavior: "same workspace lifecycle action must return same operation identity, not create a second truth",
    },
    providerBoundary: {
      provider: "gflabtoken",
      publicFields: ["provider", "providerKeyRef", "boundStatus"],
      rawSecretAcceptedByRunner: false,
      rawSecretBackendOnly: true,
      browserStorageAllowed: false,
      evidenceMayContainRawSecret: false,
    },
    rollbackCleanupEvidence: {
      rollbackPlan: {
        required: true,
        suspend: "resume workspace from suspended state when suspend side effects are not finalized",
        resume: "re-suspend workspace when resume validation fails before production readiness claim",
        delete: "cleanup-required evidence when delete cannot be completed safely",
      },
      cleanupPlan: {
        required: true,
        records: ["cloud_operations", "resource_bindings", "billing_events", "audit_events", "quota_ledger"],
        evidenceMustRemainRedacted: true,
      },
    },
    productionVsLocalRepository: {
      localRepositoryMode: "dry-run-memory-shape-only",
      localFallbackIds: [...LOCAL_FALLBACK_IDS],
      futureProductionRepository: "PostgreSQL resource_bindings/cloud_operations/billing_events/audit_events/quota_ledger",
      productionRequiresExplicitPostgresAuthorization: true,
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
        "public edge mutation",
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
      nodePortalBackendRestored: false,
      compatibilityControlPlaneAdded: false,
    },
    nextGap: NEXT_GAP,
    realExecutionReady: false,
  };
  assertNoForbiddenContent(plan);
  return plan;
}

export async function runProductionLaunchWorkspaceLifecycleContract(options = {}) {
  const plan = await buildProductionLaunchWorkspaceLifecycleContract(options);
  const redaction = redactionAudit(JSON.stringify(plan));
  const evidence = {
    ...plan,
    redactionAudit: redaction,
  };
  if (Object.values(redaction).some(Boolean)) throw new Error("production_launch_workspace_lifecycle_redaction_audit_failed");
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
  const summary = await runProductionLaunchWorkspaceLifecycleContract({
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
