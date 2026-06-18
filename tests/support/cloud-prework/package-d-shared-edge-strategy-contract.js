import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const PACKAGE_D_SHARED_EDGE_STRATEGY_COMMAND = "node tests/support/cloud-prework/package-d-external-access-strategy-runner.js --mode shared-edge-strategy-contract-local-gate --run-id <runid> --authorized 1";
export const SHARED_EDGE_STRATEGY_MODE = "shared-edge-strategy-contract-local-gate";

const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-external-access-strategy";
const SHARED_EDGE_STRATEGY_EVIDENCE_FILE = "shared-edge-strategy-redacted.json";
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

function assertRunId(runId = "") {
  const normalized = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(normalized)) throw new Error("package_d_external_access_strategy_run_id_required");
  return normalized;
}

function redactionAudit(serialized = "") {
  return {
    providerSecretExposed: /raw-provider-key|rawProviderKey"\s*:|providerApiKey"\s*:|providerSecret"\s*:/u.test(serialized),
    dbPasswordExposed: /postgres-password|PORTAL_POSTGRES_PASSWORD|MEDOPL_POSTGRES_LEDGER_PASSWORD|DATABASE_URL/u.test(serialized),
    portalAdminPasswordExposed: /portal-admin-password|PORTAL_ADMIN_PASSWORD/u.test(serialized),
    tokenExposed: /bearer-token|launchToken"\s*:|runtimeToken"\s*:|bearerToken"\s*:/u.test(serialized),
    tencentSecretExposed: /tencent-secret|TENCENT_(?:MUTATION_|READONLY_)?SECRET(?:_ID|_KEY)?|"SecretId"\s*:|"SecretKey"\s*:/u.test(serialized),
    kubeconfigExposed: /client-certificate-data|client-key-data|certificate-authority-data|current-context:/u.test(serialized),
    tlsCertificateMaterialExposed: /-----BEGIN CERTIFICATE-----|tls-cert-that-must-not-leak|tlsCertificatePem"\s*:/u.test(serialized),
    tlsPrivateKeyMaterialExposed: new RegExp([
      String.raw`-----BEGIN (?:RSA )?PRIVATE KEY-----`,
      String.raw`tls-private-key-that-must-not-leak`,
      String.raw`tlsPrivateKeyPem"\s*:`,
    ].join("|"), "u").test(serialized),
    browserStorageSecretWritePresent: /(?:localStorage|sessionStorage)\.setItem/u.test(serialized),
  };
}

function assertNoForbiddenContent(plan, errorPrefix = "package_d_shared_edge_strategy") {
  const serialized = JSON.stringify(plan);
  for (const forbidden of [
    "kubectl",
    "kubeconfig",
    "kubectl apply",
    "kubectl delete",
    "docker build",
    "docker push",
    "CreateLoadBalancer",
    "CreateRecord",
    "CreateCertificate",
    "ModifyLoadBalancer",
    "medopl-tenant-",
    "localStorage.setItem",
    "sessionStorage.setItem",
    "SecretId",
    "SecretKey",
    "DATABASE_URL",
    "PORTAL_POSTGRES_PASSWORD",
    "PORTAL_ADMIN_PASSWORD",
    "TENCENT_SECRET",
    "tls.key",
    "-----BEGIN",
    "dual write",
  ]) {
    if (serialized.includes(forbidden)) throw new Error(`${errorPrefix}_forbidden_content:${forbidden}`);
  }
  const audit = redactionAudit(serialized);
  if (Object.values(audit).some(Boolean)) throw new Error(`${errorPrefix}_redaction_audit_failed`);
}

async function writeEvidence({ evidenceDir, runId, payload }) {
  const targetDir = path.join(evidenceDir, runId);
  await mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, SHARED_EDGE_STRATEGY_EVIDENCE_FILE);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

function sharedEdgeOptions() {
  return [
    {
      id: "continue_fixing_failed_portal_clb",
      label: "A. continue fixing lb-b33auprw",
      recommended: false,
      reason: "The failed Portal CLB has already gone through ClusterIP backend, NodePort backend, TkeServiceConfig add/remove and health-check annotation changes while still returning stgw 504; continuing on the same edge has low expected yield.",
      shortTermOnly: false,
      formalProductionFit: "weak",
      cleanupRequiredIfSuperseded: true,
    },
    {
      id: "reuse_opl_webui_working_clb",
      label: "B. reuse OPL-Webui working CLB lb-lhj3bgii",
      recommended: false,
      reason: "It may restore short-term connectivity, but it mixes historical OPL-Webui and MedOPL Portal edge ownership and would create an implicit compatibility responsibility boundary.",
      shortTermOnly: true,
      formalProductionFit: "weak",
      noDisruptionToOplRequired: true,
    },
    {
      id: "create_or_designate_medopl_shared_edge_clb",
      label: "C. create/designate MedOPL shared edge CLB",
      recommended: true,
      reason: "A MedOPL-owned shared edge gives one production boundary for TLS, WAF/security policy, monitoring/logging, DNS cutover, rollback and host routing without preserving the failed Portal CLB as a secondary entry.",
      shortTermOnly: false,
      formalProductionFit: "strong",
      cleanupRequiredAfterSmoke: true,
    },
  ];
}

function sharedEdgeNextGaps() {
  return [
    {
      id: "gap-08n-1-shared-edge-dry-run-creation-strategy",
      title: "shared edge dry-run / creation strategy",
      boundary: "designate existing MedOPL-owned edge or dry-run create qcloud shared edge; no live mutation without separate authorization",
    },
    {
      id: "gap-08n-2-portal-route-attach",
      title: "portal route attach",
      boundary: "attach portal.medopl.cn host route to portal-frontend-edge:8080 on the shared edge only after authorized dry-run",
    },
    {
      id: "gap-08n-3-portal-dns-cutover",
      title: "DNS cutover for portal.medopl.cn",
      boundary: "point portal.medopl.cn only to the shared edge after route readiness evidence; no hidden secondary host",
    },
    {
      id: "gap-08n-4-portal-https-smoke",
      title: "HTTPS smoke for portal",
      boundary: "verify https://portal.medopl.cn/ TLS and HTTP 200 through the shared edge before any public access claim",
    },
    {
      id: "gap-08n-5-opl-route-migration-decision",
      title: "optional OPL route migration or leave existing",
      boundary: "do not disrupt current OPL-Webui; future OPL migration requires its own gap and cannot become hidden compatibility",
      optional: true,
    },
    {
      id: "gap-08n-6-external-access-closeout",
      title: "external access closeout",
      boundary: "record Portal shared edge smoke evidence, rollback boundary and no public access overclaim",
    },
    {
      id: "gap-08n-7-cleanup-failed-portal-clb",
      title: "explicit cleanup of failed lb-b33auprw Portal route/resources",
      boundary: "remove failed Portal Ingress/CLB resources only after separate cleanup authorization",
      explicitAuthorizationRequired: true,
    },
  ];
}

export async function buildPackageDSharedEdgeStrategyContract({
  runId = "",
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  mode = SHARED_EDGE_STRATEGY_MODE,
  argv = [],
} = {}) {
  parseArgs(argv);
  if (authorized !== true) throw new Error("package_d_shared_edge_strategy_not_authorized");
  const safeRunId = assertRunId(runId);
  if (mode !== SHARED_EDGE_STRATEGY_MODE) throw new Error("package_d_shared_edge_strategy_mode_required");
  const options = sharedEdgeOptions();
  const nextGaps = sharedEdgeNextGaps();
  const plan = {
    ok: true,
    contract: "production_launch_gap_08n_shared_edge_clb_strategy_contract_local_gate",
    mode: SHARED_EDGE_STRATEGY_MODE,
    command: PACKAGE_D_SHARED_EDGE_STRATEGY_COMMAND,
    runId: safeRunId,
    currentFacts: {
      packageDInsideTke: true,
      inClusterHttpReachabilityPassed: true,
      portalNodePortDirectHttp: 200,
      portalDnsAlignedToQcloudClb: true,
      portalTlsVerificationPassed: true,
      portalIngressReady: true,
      portalHttpsViaFailedClb: 504,
      portalFailedClbBackendHealthyInConsole: true,
      kubernetesVisibleShapeMatchesWorkingOplWebui: true,
      oplWebuiHttpsViaWorkingClb: 200,
      failedPortalClbFixYield: "low",
      publicAccessComplete: false,
    },
    target: {
      cluster: "cls-fi097sy4",
      namespace: "medopl-platform",
      portalHost: "portal.medopl.cn",
      oplHost: "opl.medopl.cn",
      traceHost: "trace.medopl.cn",
      failedPortalClb: "lb-b33auprw-h1bv86yx9nswdtfj.clb.usw-tencentclb.com",
      workingOplClb: "lb-lhj3bgii-ms5ocrjz6hdaki2l.clb.usw-tencentclb.com",
      portalBackend: "portal-frontend-edge:8080",
      oplBackend: "OPL-Webui backend",
      futureTraceBackend: "future trace backend",
    },
    options,
    recommendedOption: options[2],
    edgeOwnershipBoundary: {
      owner: "MedOPL Platform Edge",
      purpose: "formal production SaaS edge for MedOPL hosts",
      owns: ["TLS", "WAF/security policy", "monitoring/logs", "DNS cutover coordination", "rollback", "host routing"],
      doesNotOwn: ["Package C tenant resources", "workspace lifecycle", "database credentials", "application image build/push"],
    },
    hostRoutingModel: {
      sharedEdgeRequired: true,
      routes: [
        { host: "portal.medopl.cn", backend: "portal-frontend-edge:8080", state: "next target" },
        { host: "opl.medopl.cn", backend: "OPL-Webui backend", state: "working today; do not disrupt" },
        { host: "trace.medopl.cn", backend: "future trace backend", state: "future" },
      ],
      futureHosts: ["api.medopl.cn", "admin.medopl.cn"],
      oplWebuiDisruptionAllowed: false,
      fallbackRouteAllowed: false,
    },
    tlsCertificateStrategy: {
      sharedCertificateOrSniBundle: true,
      hosts: ["portal.medopl.cn", "opl.medopl.cn", "trace.medopl.cn"],
      privateKeyReadAllowedNow: false,
      certPrivateKeyInEvidenceAllowed: false,
      certificateMaterialInGitAllowed: false,
      evidenceUsesOnlyRefs: true,
    },
    qcloudIngressGatewayStrategy: {
      preferred: "MedOPL shared edge CLB with host routing",
      qcloudIngressAllowedAsImplementationPath: true,
      qcloudGatewayAllowedAsFuturePath: true,
      mutationNowAllowed: false,
      lbB33LongTermEntryAllowed: false,
      reuseOplClbAsPortalFallbackAllowed: false,
    },
    dnsCutoverPlan: {
      portal: "cut portal.medopl.cn to shared edge only after portal route attach and dry-run evidence",
      opl: "leave current working OPL-Webui entry unchanged unless a later OPL migration gap is authorized",
      mutationNowAllowed: false,
      rollback: "restore previous DNS target only through separate rollback authorization if shared edge smoke fails",
    },
    rollbackPlan: {
      rollbackRequiresSeparateAuthorization: true,
      portalRouteRollback: "restore portal route/DNS to last known pre-cutover target only if authorized",
      failedPortalClbFallbackAllowed: false,
      dualClbLongTermAllowed: false,
    },
    smokePlan: {
      portalExternalSmoke: {
        url: "https://portal.medopl.cn/",
        expected: "TLS valid and HTTP 200 through shared edge",
      },
      oplExternalSmoke: {
        url: "https://opl.medopl.cn/",
        expected: "existing OPL-Webui HTTPS 200 remains unaffected",
      },
      redactionAuditRequired: true,
    },
    migrationSequence: [
      "shared edge dry-run / creation strategy",
      "portal route attach",
      "DNS cutover for portal.medopl.cn",
      "HTTPS smoke for portal",
      "optional OPL route migration or leave existing with no hidden compatibility layer",
      "external access closeout",
      "explicit cleanup of failed lb-b33auprw Portal route/resources",
    ],
    noCompatPolicy: {
      noCompatibilityLayer: true,
      noFallbackHost: true,
      noLegacyRoute: true,
      noDualWriteRoute: true,
      noDualClbParallelLongTerm: true,
      failedPortalClbLongTermEntryAllowed: false,
      cleanupGapRequiredAfterSharedEdgeSmoke: true,
      oplMigrationMustBeSeparateGap: true,
    },
    cleanupPlan: {
      executeNow: false,
      explicitAuthorizationRequired: true,
      failedPortalClbResources: ["Ingress/portal-frontend", "Portal qcloud CLB lb-b33auprw route/resources"],
      preserveOplWebuiWorkingEntry: true,
      evidencePath: ".runtime/package-d-external-access-strategy/<runid>/failed-portal-clb-cleanup-redacted.json",
    },
    futureSecurityMonitoringBoundary: {
      waf: "shared edge policy owner before public access closeout",
      accessLogs: "shared edge access logs and redaction audit",
      metrics: ["5xx rate", "TLS handshake errors", "backend health", "route latency"],
      alertsRequiredBeforeProductionClaim: true,
    },
    allowedOperations: [
      "local strategy contract generation",
      "redacted authorization pack generation",
      "future dry-run planning only",
    ],
    forbiddenOperations: [
      "secret, DB password, TLS private key or Tencent credential read",
      "Kubernetes API connection",
      "Tencent API call",
      "DNS, CLB, Ingress, Service or Deployment mutation",
      "build/push",
      "Package C live",
      "public access completion claim",
      "compatibility layer or secondary route creation",
    ],
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, safeRunId, SHARED_EDGE_STRATEGY_EVIDENCE_FILE),
      redacted: true,
    },
    stopConditions: [
      "proposal keeps lb-b33auprw as long-term Portal entry",
      "proposal reuses OPL-Webui CLB as hidden Portal secondary route",
      "proposal creates long-term dual CLB routing",
      "proposal disrupts current OPL-Webui HTTPS 200 entry",
      "request attempts DNS/CLB/Ingress/Service mutation in strategy mode",
      "any secret material appears in docs, git, logs or evidence",
      "public access completion is claimed before Portal shared edge HTTPS smoke passes",
    ],
    boundary: {
      contractOnly: true,
      localGateOnly: true,
      kubernetesMutationAllowedNow: false,
      tencentApiMutationAllowedNow: false,
      dnsMutationAllowedNow: false,
      clbMutationAllowedNow: false,
      ingressServiceDeploymentMutationAllowedNow: false,
      buildPushAllowedNow: false,
      packageCLiveAllowedNow: false,
      publicAccessClaimAllowedNow: false,
      secondTruthSourceAdded: false,
      compatibilityLayerAdded: false,
    },
    nextGaps,
    nextGap: nextGaps[0],
    realExecutionReady: false,
  };
  assertNoForbiddenContent(plan);
  return plan;
}

export async function runPackageDSharedEdgeStrategyContract(options = {}) {
  const plan = await buildPackageDSharedEdgeStrategyContract(options);
  const redaction = redactionAudit(JSON.stringify(plan));
  const evidence = {
    ...plan,
    redactionAudit: {
      ...redaction,
      secretLeakageDetected: Object.values(redaction).some(Boolean),
    },
  };
  if (evidence.redactionAudit.secretLeakageDetected) throw new Error("package_d_shared_edge_strategy_redaction_audit_failed");
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
    recommendedOption: plan.recommendedOption,
    evidencePath,
    nextGap: plan.nextGap,
    realExecutionReady: false,
  };
}
