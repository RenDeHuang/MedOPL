#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_LAUNCH_OPERATION_COMMAND = "node tests/support/cloud-prework/production-launch-operation-runner.js --mode contract-local-gate --run-id <runid> --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/production-launch-operation";
const FIXED_MODE = "contract-local-gate";
const PACKAGE_C_RUNNER = "tests/support/cloud-prework/v22-package-c-live-canary-live-runner.js";
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
  "--ingress",
  "--load-balancer",
  "--secret-file",
  "--env",
]));
const LOCAL_FALLBACK_IDS = Object.freeze([
  "tenant-local-rc",
  "user-local-rc",
  "workspace-local-rc",
  "open-managed-environment-local-rc",
]);
const PORTAL_OPERATION_API_TRACE = Object.freeze([
  Object.freeze({
    methodPath: "POST /api/v22/production/package-c-operation/plan",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-operation.ts:planProductionPackageCOperation",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
  Object.freeze({
    methodPath: "POST /api/v22/production/package-c-operation/commit",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-operation.ts:commitProductionPackageCOperation",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
]);
const NEXT_GAP = Object.freeze({
  id: "production-launch-gap-03-resourcebinding-postgresql-ledger-live-write-read-contract",
  title: "Production launch Gap 03: ResourceBinding PostgreSQL ledger live write/read contract",
  boundary: "local contract only until separate authorization; no Package C live execution or production ledger write in this gap",
});

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`production_launch_operation_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`production_launch_operation_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`production_launch_operation_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("production_launch_operation_not_authorized");
}

function assertRunId(runId = "") {
  const normalized = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(normalized)) throw new Error("production_launch_operation_run_id_required");
  return normalized;
}

function defaultOperation() {
  return {
    tenantId: "tenant-production-alpha",
    accountId: "account-production-alpha",
    workspaceId: "workspace-production-alpha",
    resourceBindingId: "rb-production-alpha",
    billingAttributionId: "bill-production-alpha",
    serverPlanId: "starter_2c4g_10gb",
    providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
    idempotencyKey: "workspace-provision-alpha-once",
  };
}

function cleanOperation(operation = {}) {
  const fallback = defaultOperation();
  const providerKeyRef = text(operation.providerKeyRef) || fallback.providerKeyRef;
  if (!providerKeyRef || providerKeyRef.includes(" ") || providerKeyRef.includes("raw")) {
    throw new Error("production_launch_operation_provider_key_ref_invalid");
  }
  return {
    tenantId: text(operation.tenantId) || fallback.tenantId,
    accountId: text(operation.accountId) || fallback.accountId,
    workspaceId: text(operation.workspaceId) || fallback.workspaceId,
    resourceBindingId: text(operation.resourceBindingId) || fallback.resourceBindingId,
    billingAttributionId: text(operation.billingAttributionId) || fallback.billingAttributionId,
    serverPlanId: text(operation.serverPlanId) || fallback.serverPlanId,
    providerKeyRef,
    idempotencyKey: text(operation.idempotencyKey) || fallback.idempotencyKey,
  };
}

function redactionAudit(serialized = "") {
  return {
    rawSecretMaterialExposed: /gflabtoken-raw-provider-key-material|rawProviderKey"\s*:|providerApiKey"\s*:|providerSecret"\s*:/u.test(serialized),
    dbPasswordExposed: /postgres-password|PORTAL_POSTGRES_PASSWORD|DATABASE_URL/u.test(serialized),
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
    if (serialized.includes(forbidden)) throw new Error(`production_launch_operation_forbidden_content:${forbidden}`);
  }
  const audit = redactionAudit(serialized);
  if (Object.values(audit).some(Boolean)) throw new Error("production_launch_operation_redaction_audit_failed");
}

async function writeEvidence({ evidenceDir, runId, payload }) {
  const targetDir = path.join(evidenceDir, runId);
  await mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, "operation-contract-redacted.json");
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

function resourceBindingStateContract(operation) {
  const ledgerShape = {
    resourceBinding: [
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
    ],
    cloudOperation: [
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
      "canonical_ownership_source",
      "cloud_tag_support",
    ],
  };
  return {
    canonicalStore: "PostgreSQL resource_bindings/cloud_operations",
    productionPostgresWriteNow: false,
    minimumStates: ["requested", "creating", "ready"],
    fullLifecycleStates: [
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
    ],
    transitions: [
      {
        from: "portal_action",
        to: "requested",
        reason: "Portal requests production workspace provisioning through Go backend",
      },
      {
        from: "requested",
        to: "creating",
        reason: "Package C runner boundary validates provider/cloud operation shape before future live mutation",
      },
      {
        from: "creating",
        to: "ready",
        reason: "Future Package C live operation observes tenant resource ready and writes ledger",
      },
    ],
    idempotency: {
      required: true,
      key: operation.idempotencyKey,
      deterministicOperationIdShape: `package-c:${operation.tenantId}:${operation.workspaceId}:${operation.resourceBindingId}:${operation.idempotencyKey}`,
    },
    ledgerShape,
  };
}

export async function buildProductionLaunchOperationContract({
  runId = "",
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  mode = FIXED_MODE,
  operation = {},
  argv = [],
} = {}) {
  parseArgs(argv);
  assertAuthorized(authorized);
  const safeRunId = assertRunId(runId);
  if (mode !== FIXED_MODE) throw new Error("production_launch_operation_mode_required");
  const request = cleanOperation(operation);
  const stateContract = resourceBindingStateContract(request);
  const plan = {
    ok: true,
    contract: "production_launch_gap_02_package_c_operation_contract_local_gate",
    mode: FIXED_MODE,
    command: PRODUCTION_LAUNCH_OPERATION_COMMAND,
    runId: safeRunId,
    target: {
      product: "MedOPL multi-tenant SaaS managed OPL workbench",
      phase: "workspace provisioning to Package C live operation",
      clusterBaseline: "Package D deployed inside TKE; in-cluster HTTP reachability passed",
    },
    portalActionShape: {
      action: "request_production_workspace_provisioning",
      userVisibleSurface: "Portal workspace launch action",
      requiresAuthenticatedAdminOrTenantOwner: true,
      browserStorageAllowed: false,
      rawSecretInputAllowed: false,
    },
    portalActionTrace: PORTAL_OPERATION_API_TRACE,
    goBackendOperationRequest: request,
    packageCRunnerInvocationBoundary: {
      runner: PACKAGE_C_RUNNER,
      operationClass: "package_c.tencent_tke_tenant_node_pool.live_canary.create_scale_release",
      contractOnly: true,
      liveExecutionAllowedNow: false,
      invocationMaterializedNow: false,
      futureRunGate: "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
      futureSecretAllowlistOwner: "tests/support/cloud-prework/v22-package-c-live-canary-readiness.js",
      futureAllowlistSource: "Package C live canary readiness runner API allowlist",
      forbiddenNow: [
        "Package C live execution",
        "Tencent mutation",
        "Kubernetes CLI command",
        "deploy",
        "build/push",
      ],
    },
    resourceBindingStateContract: stateContract,
    ledgerShape: stateContract.ledgerShape,
    providerBoundary: {
      provider: "gflabtoken",
      publicFields: ["provider", "providerKeyRef", "boundStatus"],
      rawSecretAcceptedByRunner: false,
      rawSecretBackendOnly: true,
      browserStorageAllowed: false,
      evidenceMayContainRawSecret: false,
    },
    productionVsLocalDefaults: {
      localFallbackIds: [...LOCAL_FALLBACK_IDS],
      localDefaultsScope: "local-rc-only",
      productionOperationRequiresExplicitBootstrap: true,
      productionOperationRequiresExplicitLedgerWrite: true,
      productionMustNotRelyOnLocalFallbackIds: true,
    },
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, safeRunId, "operation-contract-redacted.json"),
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
      productionPostgresWriteAllowedNow: false,
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

export async function runProductionLaunchOperationContract(options = {}) {
  const plan = await buildProductionLaunchOperationContract(options);
  const redaction = redactionAudit(JSON.stringify(plan));
  const evidence = {
    ...plan,
    redactionAudit: redaction,
  };
  if (Object.values(redaction).some(Boolean)) throw new Error("production_launch_operation_redaction_audit_failed");
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
  const summary = await runProductionLaunchOperationContract({
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
