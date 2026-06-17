#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_LAUNCH_LEDGER_COMMAND = "node tests/support/cloud-prework/production-launch-ledger-runner.js --mode contract-local-gate --run-id <runid> --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/production-launch-ledger";
const FIXED_MODE = "contract-local-gate";
const EVIDENCE_FILE = "resourcebinding-ledger-contract-redacted.json";
const RESOURCE_BINDING_FIELDS = Object.freeze([
  "tenant_id",
  "account_id",
  "workspace_id",
  "resource_binding_id",
  "billing_attribution_id",
  "server_plan_id",
  "workspace_storage_gb",
  "cloud_provider",
  "region",
  "cluster_id",
  "node_pool_id",
  "node_pool_name",
  "status",
  "operation_id",
  "canonical_ownership_source",
  "cloud_tag_support",
]);
const CLOUD_OPERATION_FIELDS = Object.freeze([
  "operation_id",
  "resource_binding_id",
  "tenant_id",
  "account_id",
  "workspace_id",
  "billing_attribution_id",
  "operation_type",
  "server_plan_id",
  "workspace_storage_gb",
  "status",
  "cloud_provider",
  "region",
  "cluster_id",
  "node_pool_id",
  "node_pool_name",
  "cloud_tag_support",
  "canonical_ownership_source",
]);
const MINIMUM_STATES = Object.freeze(["requested", "creating", "ready"]);
const FULL_LIFECYCLE_STATES = Object.freeze([
  "requested",
  "creating",
  "created",
  "scaling",
  "ready",
  "releaseRequested",
  "deleting",
  "released",
  "failed",
  "cleanupRequired",
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
]);
const PORTAL_LEDGER_API_TRACE = Object.freeze([
  Object.freeze({
    methodPath: "POST /api/v22/production/ledger/plan",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-ledger.ts:planProductionLedger",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
  Object.freeze({
    methodPath: "POST /api/v22/production/ledger/commit",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-ledger.ts:commitProductionLedger",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
]);
const NEXT_GAP = Object.freeze({
  id: "production-launch-gap-04-billing-audit-quota-ledger-contract",
  title: "Production launch Gap 04: billing / audit / quota ledger contract",
  boundary: "local contract only until separate authorization; no production billing, quota enforcement, Package C live execution or external access",
});

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`production_launch_ledger_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`production_launch_ledger_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`production_launch_ledger_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("production_launch_ledger_not_authorized");
}

function assertRunId(runId = "") {
  const normalized = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(normalized)) throw new Error("production_launch_ledger_run_id_required");
  return normalized;
}

function defaultLedger() {
  return {
    tenantId: "tenant-production-alpha",
    accountId: "account-production-alpha",
    workspaceId: "workspace-production-alpha",
    resourceBindingId: "rb-production-alpha",
    billingAttributionId: "bill-production-alpha",
    serverPlanId: "starter_2c4g_10gb",
    workspaceStorageGb: 10,
    cloudProvider: "tencent",
    region: "ap-guangzhou",
    clusterId: "cls-fi097sy4",
    nodePoolId: "np-tenant-production-alpha",
    nodePoolName: "tenant-production-alpha-pool",
    providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
    idempotencyKey: "workspace-ledger-alpha-once",
  };
}

function cleanLedger(ledger = {}) {
  const fallback = defaultLedger();
  const providerKeyRef = text(ledger.providerKeyRef) || fallback.providerKeyRef;
  if (!providerKeyRef || providerKeyRef.includes(" ") || providerKeyRef.includes("raw")) {
    throw new Error("production_launch_ledger_provider_key_ref_invalid");
  }
  const workspaceStorageGb = Number(ledger.workspaceStorageGb || fallback.workspaceStorageGb);
  if (!Number.isInteger(workspaceStorageGb) || workspaceStorageGb <= 0) {
    throw new Error("production_launch_ledger_workspace_storage_gb_invalid");
  }
  return {
    tenantId: text(ledger.tenantId) || fallback.tenantId,
    accountId: text(ledger.accountId) || fallback.accountId,
    workspaceId: text(ledger.workspaceId) || fallback.workspaceId,
    resourceBindingId: text(ledger.resourceBindingId) || fallback.resourceBindingId,
    billingAttributionId: text(ledger.billingAttributionId) || fallback.billingAttributionId,
    serverPlanId: text(ledger.serverPlanId) || fallback.serverPlanId,
    workspaceStorageGb,
    cloudProvider: text(ledger.cloudProvider) || fallback.cloudProvider,
    region: text(ledger.region) || fallback.region,
    clusterId: text(ledger.clusterId) || fallback.clusterId,
    nodePoolId: text(ledger.nodePoolId) || fallback.nodePoolId,
    nodePoolName: text(ledger.nodePoolName) || fallback.nodePoolName,
    providerKeyRef,
    idempotencyKey: text(ledger.idempotencyKey) || fallback.idempotencyKey,
  };
}

function operationIdFor(input) {
  return `op:${input.tenantId}:${input.workspaceId}:${input.resourceBindingId}:${input.idempotencyKey}`;
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
  ]) {
    if (serialized.includes(forbidden)) throw new Error(`production_launch_ledger_forbidden_content:${forbidden}`);
  }
  const audit = redactionAudit(serialized);
  if (Object.values(audit).some(Boolean)) throw new Error("production_launch_ledger_redaction_audit_failed");
}

function rowShapes(input) {
  const operationId = operationIdFor(input);
  return {
    resourceBinding: {
      tenant_id: input.tenantId,
      account_id: input.accountId,
      workspace_id: input.workspaceId,
      resource_binding_id: input.resourceBindingId,
      billing_attribution_id: input.billingAttributionId,
      server_plan_id: input.serverPlanId,
      workspace_storage_gb: input.workspaceStorageGb,
      cloud_provider: input.cloudProvider,
      region: input.region,
      cluster_id: input.clusterId,
      node_pool_id: input.nodePoolId,
      node_pool_name: input.nodePoolName,
      operation_id: operationId,
      canonical_ownership_source: "postgres_resource_binding_ledger",
      cloud_tag_support: "tke_nodepool_unsupported",
    },
    cloudOperation: {
      operation_id: operationId,
      resource_binding_id: input.resourceBindingId,
      tenant_id: input.tenantId,
      account_id: input.accountId,
      workspace_id: input.workspaceId,
      billing_attribution_id: input.billingAttributionId,
      operation_type: "package_c_create_release_canary",
      server_plan_id: input.serverPlanId,
      workspace_storage_gb: input.workspaceStorageGb,
      cloud_provider: input.cloudProvider,
      region: input.region,
      cluster_id: input.clusterId,
      node_pool_id: input.nodePoolId,
      node_pool_name: input.nodePoolName,
      cloud_tag_support: "tke_nodepool_unsupported",
      canonical_ownership_source: "postgres_resource_binding_ledger",
    },
  };
}

function stateTransitions(input) {
  const shapes = rowShapes(input);
  return MINIMUM_STATES.map((status) => ({
    state: status,
    persistedNow: false,
    resourceBinding: {
      ...shapes.resourceBinding,
      status,
    },
    cloudOperation: {
      ...shapes.cloudOperation,
      status,
    },
    readbackContract: {
      resourceBindingLookup: {
        table: "resource_bindings",
        key: "resource_binding_id",
        value: input.resourceBindingId,
      },
      cloudOperationLookup: {
        table: "cloud_operations",
        key: "operation_id",
        value: shapes.cloudOperation.operation_id,
      },
    },
  }));
}

async function writeEvidence({ evidenceDir, runId, payload }) {
  const targetDir = path.join(evidenceDir, runId);
  await mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, EVIDENCE_FILE);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildProductionLaunchLedgerContract({
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
  if (mode !== FIXED_MODE) throw new Error("production_launch_ledger_mode_required");
  const request = cleanLedger(ledger);
  const operationId = operationIdFor(request);
  const transitions = stateTransitions(request);
  const plan = {
    ok: true,
    contract: "production_launch_gap_03_resourcebinding_postgresql_ledger_contract_local_gate",
    mode: FIXED_MODE,
    command: PRODUCTION_LAUNCH_LEDGER_COMMAND,
    runId: safeRunId,
    target: {
      product: "MedOPL multi-tenant SaaS managed OPL workbench",
      phase: "ResourceBinding PostgreSQL ledger live write/read contract",
      clusterBaseline: "Package D deployed inside TKE; in-cluster HTTP reachability passed",
    },
    ledgerRequest: {
      tenantId: request.tenantId,
      accountId: request.accountId,
      workspaceId: request.workspaceId,
      resourceBindingId: request.resourceBindingId,
      billingAttributionId: request.billingAttributionId,
      serverPlanId: request.serverPlanId,
      workspaceStorageGb: request.workspaceStorageGb,
      cloudProvider: request.cloudProvider,
      region: request.region,
      clusterId: request.clusterId,
      nodePoolId: request.nodePoolId,
      nodePoolName: request.nodePoolName,
      providerKeyRef: request.providerKeyRef,
      idempotencyKey: request.idempotencyKey,
      operationId,
    },
    portalLedgerApiTrace: PORTAL_LEDGER_API_TRACE,
    resourceBindingWriteReadShape: {
      table: "resource_bindings",
      requiredWriteFields: [...RESOURCE_BINDING_FIELDS],
      readbackKey: "resource_binding_id",
      uniqueKey: "resource_binding_id",
      statusField: "status",
      operationReference: "operation_id",
      parentRowsRequired: ["tenants.id", "workspaces.id"],
      productionWriteNow: false,
      productionReadNow: false,
    },
    cloudOperationWriteReadShape: {
      table: "cloud_operations",
      requiredWriteFields: [...CLOUD_OPERATION_FIELDS],
      readbackKey: "operation_id",
      uniqueKey: "operation_id",
      resourceBindingReference: "resource_binding_id",
      statusField: "status",
      productionWriteNow: false,
      productionReadNow: false,
    },
    statePersistenceBoundary: {
      minimumStates: [...MINIMUM_STATES],
      fullLifecycleStates: [...FULL_LIFECYCLE_STATES],
      transitions,
      persistenceOrder: [
        "write resource_bindings row keyed by resource_binding_id",
        "append cloud_operations event keyed by operation_id",
        "read back resource_bindings by resource_binding_id",
        "read back cloud_operations by operation_id",
      ],
      productionPersistenceNow: false,
    },
    idempotency: {
      required: true,
      key: request.idempotencyKey,
      operationId,
      uniqueKeys: {
        resourceBinding: "resource_binding_id",
        cloudOperation: "operation_id",
      },
      duplicateRequestBehavior: "same resource_binding_id and operation_id must be idempotent, not a second ledger truth",
    },
    canonicalOwnershipSource: "postgres_resource_binding_ledger",
    cloudTagSupport: "tke_nodepool_unsupported",
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
      futureProductionRepository: "PostgreSQL resource_bindings/cloud_operations",
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
      billingQuotaLifecycleImplementedNow: false,
      nodePortalBackendRestored: false,
      compatibilityControlPlaneAdded: false,
    },
    nextGap: NEXT_GAP,
    realExecutionReady: false,
  };
  assertNoForbiddenContent(plan);
  return plan;
}

export async function runProductionLaunchLedgerContract(options = {}) {
  const plan = await buildProductionLaunchLedgerContract(options);
  const redaction = redactionAudit(JSON.stringify(plan));
  const evidence = {
    ...plan,
    redactionAudit: redaction,
  };
  if (Object.values(redaction).some(Boolean)) throw new Error("production_launch_ledger_redaction_audit_failed");
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
  const summary = await runProductionLaunchLedgerContract({
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
