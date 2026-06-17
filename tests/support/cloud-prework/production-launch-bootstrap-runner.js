#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_LAUNCH_BOOTSTRAP_COMMAND = "node tests/support/cloud-prework/production-launch-bootstrap-runner.js --mode contract-local-gate --run-id <runid> --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/production-launch-bootstrap";
const FIXED_MODE = "contract-local-gate";
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
]);
const PORTAL_BOOTSTRAP_API_TRACE = Object.freeze([
  Object.freeze({
    methodPath: "POST /api/v22/production/bootstrap/plan",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-bootstrap.ts:planProductionBootstrap",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
  Object.freeze({
    methodPath: "POST /api/v22/production/bootstrap/commit",
    owner: "services/medopl-go-backend/internal/server/handlers/controlplane.go",
    portalTypedApi: "services/portal/frontend/src/api/portal/production-bootstrap.ts:commitProductionBootstrap",
    status: "contract-only",
    plaintextSecretsAllowed: false,
  }),
]);
const NEXT_GAP = Object.freeze({
  id: "production-launch-gap-02-portal-backend-package-c-live-operation-contract",
  title: "Production launch Gap 02: Portal -> Go backend -> Package C live operation contract",
  boundary: "local contract only until separate authorization; no Package C live execution",
});

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`production_launch_bootstrap_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`production_launch_bootstrap_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`production_launch_bootstrap_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("production_launch_bootstrap_not_authorized");
}

function assertRunId(runId = "") {
  const normalized = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(normalized)) throw new Error("production_launch_bootstrap_run_id_required");
  return normalized;
}

function defaultSeed() {
  return {
    firstAdmin: {
      email: "founder@example.invalid",
      displayName: "MedOPL Founder",
      role: "platform_owner",
    },
    tenant: {
      id: "tenant-production-seed",
      slug: "research-team-alpha",
      name: "Research Team Alpha",
      planId: "starter_2c4g_10gb",
    },
    workspace: {
      id: "workspace-production-seed",
      slug: "alpha-opl-workbench",
      title: "Alpha OPL Workbench",
      storageGb: 10,
      packageId: "starter_2c4g_10gb",
    },
    provider: {
      provider: "gflabtoken",
      providerKeyRef: "gflab:workspace-production-seed:bootstrap-ref",
    },
  };
}

function cleanSeed(seed = {}) {
  const fallback = defaultSeed();
  const providerKeyRef = text(seed.provider?.providerKeyRef) || fallback.provider.providerKeyRef;
  if (!providerKeyRef || providerKeyRef.includes(" ") || providerKeyRef.includes("raw")) {
    throw new Error("production_launch_bootstrap_provider_key_ref_invalid");
  }
  return {
    firstAdmin: {
      email: text(seed.firstAdmin?.email) || fallback.firstAdmin.email,
      displayName: text(seed.firstAdmin?.displayName) || fallback.firstAdmin.displayName,
      role: text(seed.firstAdmin?.role) || fallback.firstAdmin.role,
      status: "bootstrap_required",
      identitySource: "production_identity_provider_required",
    },
    tenant: {
      id: text(seed.tenant?.id) || fallback.tenant.id,
      slug: text(seed.tenant?.slug) || fallback.tenant.slug,
      name: text(seed.tenant?.name) || fallback.tenant.name,
      planId: text(seed.tenant?.planId) || fallback.tenant.planId,
      status: "bootstrap_required",
    },
    workspace: {
      id: text(seed.workspace?.id) || fallback.workspace.id,
      slug: text(seed.workspace?.slug) || fallback.workspace.slug,
      title: text(seed.workspace?.title) || fallback.workspace.title,
      storageGb: Number(seed.workspace?.storageGb || fallback.workspace.storageGb),
      packageId: text(seed.workspace?.packageId) || fallback.workspace.packageId,
      providerKeyRef,
      status: "seed_required",
    },
  };
}

function redactionAudit(serialized = "") {
  return {
    rawSecretMaterialExposed: /gflabtoken-raw-provider-key-material|rawProviderKey"\s*:|providerApiKey"\s*:|providerSecret"\s*:/u.test(serialized),
    dbPasswordExposed: /postgres-password|PORTAL_POSTGRES_PASSWORD|DATABASE_URL/u.test(serialized),
    portalAdminPasswordExposed: /portal-admin-password|PORTAL_ADMIN_PASSWORD/u.test(serialized),
    tokenExposed: /bearer-token|launchToken"\s*:|runtimeToken"\s*:|bearerToken"\s*:/u.test(serialized),
    browserStorageSecretWritePresent: /(?:localStorage|sessionStorage)\.setItem/u.test(serialized),
  };
}

function assertNoForbiddenContent(plan) {
  const serialized = JSON.stringify(plan);
  for (const forbidden of [
    "medopl-tenant-",
    "kubectl",
    "docker build",
    "docker push",
    "CreateNodePool",
    "production_deploy_apply",
  ]) {
    if (serialized.includes(forbidden)) throw new Error(`production_launch_bootstrap_forbidden_content:${forbidden}`);
  }
  const audit = redactionAudit(serialized);
  if (Object.values(audit).some(Boolean)) throw new Error("production_launch_bootstrap_redaction_audit_failed");
}

async function writeEvidence({ evidenceDir, runId, payload }) {
  const targetDir = path.join(evidenceDir, runId);
  await mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, "bootstrap-contract-redacted.json");
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildProductionLaunchBootstrapContract({
  runId = "",
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  mode = FIXED_MODE,
  seed = {},
  argv = [],
} = {}) {
  parseArgs(argv);
  assertAuthorized(authorized);
  const safeRunId = assertRunId(runId);
  if (mode !== FIXED_MODE) throw new Error("production_launch_bootstrap_mode_required");
  const bootstrap = cleanSeed(seed);
  const plan = {
    ok: true,
    contract: "production_launch_gap_01_bootstrap_contract_local_gate",
    mode: FIXED_MODE,
    command: PRODUCTION_LAUNCH_BOOTSTRAP_COMMAND,
    runId: safeRunId,
    target: {
      product: "MedOPL multi-tenant SaaS managed OPL workbench",
      phase: "production control-plane bootstrap minimum",
      clusterBaseline: "Package D deployed inside TKE; in-cluster HTTP reachability passed",
    },
    bootstrap,
    providerBoundary: {
      provider: "gflabtoken",
      publicFields: ["provider", "providerKeyRef", "boundStatus"],
      rawSecretAcceptedByRunner: false,
      rawSecretBackendOnly: true,
      browserStorageAllowed: false,
      evidenceMayContainRawSecret: false,
    },
    portalToBackendApiTrace: PORTAL_BOOTSTRAP_API_TRACE,
    productionVsLocalDefaults: {
      localFallbackIds: [...LOCAL_FALLBACK_IDS],
      localDefaultsScope: "local-rc-only",
      productionRequiresExplicitBootstrap: true,
      productionMustNotRelyOnLocalFallbackIds: true,
    },
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, safeRunId, "bootstrap-contract-redacted.json"),
    },
    externalAccess: {
      status: "blocked_until_multi_tenant_minimum_launch_closure",
      allowedNow: ["contract/local gate only"],
      forbiddenNow: [
        "Ingress mutation",
        "LoadBalancer mutation",
        "DNS/TLS mutation",
        "public user access claim",
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

export async function runProductionLaunchBootstrapContract(options = {}) {
  const plan = await buildProductionLaunchBootstrapContract(options);
  const redaction = redactionAudit(JSON.stringify(plan));
  const evidence = {
    ...plan,
    redactionAudit: redaction,
  };
  if (Object.values(redaction).some(Boolean)) throw new Error("production_launch_bootstrap_redaction_audit_failed");
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
  const summary = await runProductionLaunchBootstrapContract({
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
