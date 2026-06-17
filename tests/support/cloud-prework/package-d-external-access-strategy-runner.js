#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PACKAGE_D_EXTERNAL_ACCESS_STRATEGY_COMMAND = "node tests/support/cloud-prework/package-d-external-access-strategy-runner.js --mode strategy-contract-local-gate --run-id <runid> --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-external-access-strategy";
const FIXED_MODE = "strategy-contract-local-gate";
const EVIDENCE_FILE = "strategy-contract-redacted.json";
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
  "--secret-file",
  "--env",
]));

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`package_d_external_access_strategy_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`package_d_external_access_strategy_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`package_d_external_access_strategy_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("package_d_external_access_strategy_not_authorized");
}

function assertRunId(runId = "") {
  const normalized = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(normalized)) throw new Error("package_d_external_access_strategy_run_id_required");
  return normalized;
}

function defaultStrategyInput() {
  return {
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
  };
}

function cleanList(values = [], fallback = []) {
  const input = Array.isArray(values) && values.length > 0 ? values : fallback;
  return input.map((value) => text(value)).filter(Boolean);
}

function cleanStrategyInput(input = {}) {
  const fallback = defaultStrategyInput();
  const portalHost = text(input.portalHost) || fallback.portalHost;
  const ingressClass = text(input.ingressClass) || fallback.ingressClass;
  const tlsSecretName = text(input.tlsSecretName) || fallback.tlsSecretName;
  const certificateManagement = text(input.certificateManagement) || fallback.certificateManagement;
  const externalSmokeUrl = text(input.externalSmokeUrl) || fallback.externalSmokeUrl;
  const providerKeyRef = text(input.providerKeyRef) || fallback.providerKeyRef;
  if (!/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/u.test(portalHost)) throw new Error("package_d_external_access_strategy_portal_host_invalid");
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/u.test(ingressClass)) throw new Error("package_d_external_access_strategy_ingress_class_invalid");
  if (!/^[a-z0-9][a-z0-9.-]{1,251}[a-z0-9]$/u.test(tlsSecretName)) throw new Error("package_d_external_access_strategy_tls_secret_invalid");
  if (!externalSmokeUrl.startsWith(`https://${portalHost}`)) throw new Error("package_d_external_access_strategy_external_smoke_url_invalid");
  if (!providerKeyRef || providerKeyRef.includes(" ") || providerKeyRef.includes("raw")) throw new Error("package_d_external_access_strategy_provider_key_ref_invalid");
  return {
    portalHost,
    ingressClass,
    tlsSecretName,
    certificateManagement,
    allowedAnnotations: cleanList(input.allowedAnnotations, fallback.allowedAnnotations),
    forbiddenAnnotations: cleanList(input.forbiddenAnnotations, fallback.forbiddenAnnotations),
    externalSmokeUrl,
    providerKeyRef,
  };
}

function redactionAudit(serialized = "") {
  return {
    providerSecretExposed: /raw-provider-key|rawProviderKey"\s*:|providerApiKey"\s*:|providerSecret"\s*:/u.test(serialized),
    dbPasswordExposed: /postgres-password|PORTAL_POSTGRES_PASSWORD|MEDOPL_POSTGRES_LEDGER_PASSWORD|DATABASE_URL/u.test(serialized),
    portalAdminPasswordExposed: /portal-admin-password|PORTAL_ADMIN_PASSWORD/u.test(serialized),
    tokenExposed: /bearer-token|launchToken"\s*:|runtimeToken"\s*:|bearerToken"\s*:/u.test(serialized),
    tencentSecretExposed: /tencent-secret|TENCENT_SECRET|SecretId|SecretKey/u.test(serialized),
    kubeconfigExposed: /client-certificate-data|client-key-data|certificate-authority-data|current-context:/u.test(serialized),
    browserStorageSecretWritePresent: /(?:localStorage|sessionStorage)\.setItem/u.test(serialized),
  };
}

function assertNoForbiddenContent(plan) {
  const serialized = JSON.stringify(plan);
  for (const forbidden of [
    "kubectl apply",
    "kubectl delete",
    "docker build",
    "docker push",
    "CreateLoadBalancer",
    "CreateRecord",
    "CreateCertificate",
    "medopl-tenant-",
    "localStorage.setItem",
    "sessionStorage.setItem",
  ]) {
    if (serialized.includes(forbidden)) throw new Error(`package_d_external_access_strategy_forbidden_content:${forbidden}`);
  }
  const audit = redactionAudit(serialized);
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_external_access_strategy_redaction_audit_failed");
}

function strategyComparison() {
  return [
    {
      id: "admin_only_port_forward",
      label: "admin-only port-forward",
      status: "admin_acceptance_option_only",
      strengths: ["minimal blast radius", "no public endpoint mutation", "useful for administrator smoke"],
      limits: ["not durable", "operator-session scoped", "not a formal launch completion standard"],
      executionNow: false,
      formalLaunchCompletionStandard: false,
    },
    {
      id: "internal_gateway",
      label: "internal gateway",
      status: "private_access_candidate",
      strengths: ["keeps Portal private", "fits staged enterprise validation"],
      limits: ["requires network path design", "does not satisfy public SaaS entry by itself"],
      executionNow: false,
      formalLaunchCompletionStandard: false,
    },
    {
      id: "kubernetes_ingress",
      label: "Kubernetes Ingress",
      status: "formal_launch_candidate_when_combined_with_https_domain",
      strengths: ["standard Kubernetes edge contract", "host/path/TLS policy is reviewable", "rollback can delete one Ingress"],
      limits: ["requires ingress controller/class, DNS and TLS authorization"],
      executionNow: false,
      formalLaunchCompletionStandard: false,
    },
    {
      id: "loadbalancer_service",
      label: "LoadBalancer Service",
      status: "direct_edge_candidate",
      strengths: ["simple service exposure model"],
      limits: ["cloud load balancer mutation", "weaker host/TLS routing contract than Ingress", "cost/security review required"],
      executionNow: false,
      formalLaunchCompletionStandard: false,
    },
    {
      id: "https_domain",
      label: "HTTPS/domain",
      status: "required_for_formal_user_entry",
      strengths: ["stable Portal host", "browser-trustable TLS", "external smoke URL becomes deterministic"],
      limits: ["DNS/TLS/certificate management mutation requires separate authorization"],
      executionNow: false,
      formalLaunchCompletionStandard: true,
    },
  ];
}

async function writeEvidence({ evidenceDir, runId, payload }) {
  const targetDir = path.join(evidenceDir, runId);
  await mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, EVIDENCE_FILE);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildPackageDExternalAccessStrategyContract({
  runId = "",
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  mode = FIXED_MODE,
  strategyInput = {},
  argv = [],
} = {}) {
  parseArgs(argv);
  assertAuthorized(authorized);
  const safeRunId = assertRunId(runId);
  if (mode !== FIXED_MODE) throw new Error("package_d_external_access_strategy_mode_required");
  const input = cleanStrategyInput(strategyInput);
  const plan = {
    ok: true,
    contract: "production_launch_gap_07_external_access_strategy_contract_local_gate",
    mode: FIXED_MODE,
    command: PACKAGE_D_EXTERNAL_ACCESS_STRATEGY_COMMAND,
    runId: safeRunId,
    target: {
      cluster: "cls-fi097sy4",
      namespace: "medopl-platform",
      service: "portal-frontend",
      servicePort: 8080,
      currentState: "Package D deployed inside TKE; in-cluster HTTP reachability passed; external/public user access not exposed",
    },
    strategyComparison: strategyComparison(),
    recommendedNextOption: {
      id: "ingress_https_domain_formal_candidate",
      label: "Kubernetes Ingress + HTTPS/domain",
      reason: "formal SaaS launch needs a stable host, browser-trustable TLS, reviewable edge policy and deterministic external smoke URL",
      executionNow: false,
      requiresSeparateAuthorization: true,
      publicExposureClaimAllowedNow: false,
    },
    adminOnlyPortForward: {
      allowedPurpose: "administrator acceptance smoke only",
      formalLaunchCompletionStandard: false,
      executionNow: false,
    },
    productionEntryParameters: {
      requiredKeys: [
        "PORTAL_HOST_DOMAIN",
        "INGRESS_CLASS",
        "TLS_SECRET_NAME_OR_CERT_MANAGER_ISSUER",
        "ALLOWED_INGRESS_ANNOTATIONS",
        "FORBIDDEN_INGRESS_ANNOTATIONS",
        "EXTERNAL_SMOKE_URL",
        "ROLLBACK_DELETE_INGRESS_PLAN",
      ],
      portalHost: input.portalHost,
      ingressClass: input.ingressClass,
      tlsSecretName: input.tlsSecretName,
      certificateManagement: input.certificateManagement,
      allowedAnnotations: input.allowedAnnotations,
      forbiddenAnnotations: input.forbiddenAnnotations,
      externalSmokeUrl: input.externalSmokeUrl,
      rollbackDeleteIngressPlan: "delete only the future run-scoped allowlisted Portal Ingress after evidence collection",
    },
    allowedOperations: [
      "local strategy contract generation",
      "redacted authorization pack generation",
      "future server-side dry-run planning for allowlisted Ingress/TLS shapes",
    ],
    forbiddenOperations: [
      "secret/kubeconfig/DB password read",
      "Kubernetes API connection",
      "kubectl",
      "deploy/rollout/rollback execution",
      "build/push",
      "Tencent mutation",
      "Package C live",
      "Ingress/LoadBalancer/DNS/TLS mutation",
      "public user access completion claim",
      "Node Portal backend restoration",
      "compatibility control-plane",
    ],
    securityBoundary: {
      providerKeyRefOnly: true,
      providerKeyRef: input.providerKeyRef,
      providerSecretAllowedInEvidence: false,
      browserStorageSecretAllowed: false,
      portalAdminPasswordAllowed: false,
      dbPasswordAllowed: false,
      kubeconfigAllowed: false,
    },
    controlPlaneContractLinkage: {
      portalTypedApi: "services/portal/frontend/src/api/portal/external-access-strategy.ts",
      goBackendRoutes: [
        "POST /api/v22/production/external-access-strategy/plan",
        "POST /api/v22/production/external-access-strategy/commit",
      ],
      productionSaasContractsAlreadyClosed: [
        "first admin / tenant / workspace bootstrap contract",
        "Portal -> Go backend -> Package C operation contract",
        "ResourceBinding / CloudOperation ledger contract",
        "billing / audit / quota ledger contract",
        "workspace lifecycle contract",
        "production canary / rollback / cleanup evidence contract",
      ],
      executionBoundary: "strategy only; future dry-run/apply requires separate authorization",
    },
    rollbackCleanupPlan: {
      rollbackDeleteIngressPlan: {
        required: true,
        scope: "future Portal Ingress only",
        serviceDeletionAllowed: false,
        namespaceDeletionAllowed: false,
        tenantResourceDeletionAllowed: false,
      },
      cleanupEvidence: {
        required: true,
        evidencePath: ".runtime/package-d-external-access-strategy/<runid>/cleanup-redacted.json",
        redacted: true,
      },
    },
    smokePlan: {
      internal: ["portal-frontend ClusterIP HTTP 200 evidence remains prerequisite"],
      external: [`GET ${input.externalSmokeUrl}`, "Portal login page shape", "redaction audit"],
      adminOnly: ["optional future admin port-forward smoke is not a launch completion standard"],
    },
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, safeRunId, EVIDENCE_FILE),
      redacted: true,
    },
    stopConditions: [
      "portal host/domain missing",
      "ingress class missing or not allowlisted",
      "TLS secret/certificate management missing",
      "forbidden annotation requested",
      "external smoke URL is not HTTPS on the Portal host",
      "any secret appears in plan or evidence",
      "request implies Kubernetes or Tencent mutation in strategy mode",
    ],
    redactionEvidence: {
      required: true,
      rawSecretOutputAllowed: false,
      evidencePath: path.join(evidenceDir, safeRunId, EVIDENCE_FILE),
    },
    boundary: {
      contractOnly: true,
      strategyOnly: true,
      localDevDefaultsAllowedInProduction: false,
      kubernetesAccessAllowed: false,
      productionPostgresConnectAllowedNow: false,
      ingressMutationAllowedNow: false,
      loadBalancerMutationAllowedNow: false,
      dnsTlsMutationAllowedNow: false,
      publicAccessClaimAllowedNow: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      buildPushAllowed: false,
      nodePortalBackendRestored: false,
      compatibilityControlPlaneAdded: false,
    },
    nextGap: {
      id: "production-launch-gap-08-external-access-dry-run-authorization",
      title: "Production launch Gap 08: authorized external access dry-run for Ingress + HTTPS/domain candidate",
      boundary: "separate cloud authorization required before kubeconfig, Kubernetes API, kubectl server-side dry-run, Ingress, DNS or TLS changes",
    },
    realExecutionReady: false,
  };
  assertNoForbiddenContent(plan);
  return plan;
}

export async function runPackageDExternalAccessStrategyContract(options = {}) {
  const plan = await buildPackageDExternalAccessStrategyContract(options);
  const redaction = redactionAudit(JSON.stringify(plan));
  const evidence = {
    ...plan,
    redactionAudit: redaction,
  };
  if (Object.values(redaction).some(Boolean)) throw new Error("package_d_external_access_strategy_redaction_audit_failed");
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
    recommendedNextOption: plan.recommendedNextOption,
    evidencePath,
    nextGap: plan.nextGap,
    realExecutionReady: false,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await runPackageDExternalAccessStrategyContract({
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
