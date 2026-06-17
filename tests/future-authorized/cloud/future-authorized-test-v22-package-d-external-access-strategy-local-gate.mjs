import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_EXTERNAL_ACCESS_STRATEGY_COMMAND,
  buildPackageDExternalAccessStrategyContract,
  runPackageDExternalAccessStrategyContract,
} from "../../support/cloud-prework/package-d-external-access-strategy-runner.js";

function assertNoSensitiveText(text = "", label = "text") {
  for (const forbidden of [
    "kubeconfig-must-not-leak",
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

const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-external-access-strategy-"));
try {
  const evidenceDir = path.join(evidenceRoot, "evidence");
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
    rawProviderKey: "raw-provider-key-that-must-not-leak",
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

  const plan = await buildPackageDExternalAccessStrategyContract({
    runId,
    evidenceDir,
    authorized: true,
    strategyInput,
  });
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
  assertNoSensitiveText(JSON.stringify(plan), "external_access_strategy_plan");

  const summary = await runPackageDExternalAccessStrategyContract({ runId, evidenceDir, authorized: true, strategyInput });
  assert.equal(summary.realExecutionReady, false, "external_access_strategy_real_execution_ready_false");
  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.redactionAudit.dbPasswordExposed, false, "external_access_strategy_evidence_hides_db_password");
  assert.equal(evidence.redactionAudit.tokenExposed, false, "external_access_strategy_evidence_hides_token");
  assert.equal(evidence.redactionAudit.providerSecretExposed, false, "external_access_strategy_evidence_hides_provider_secret");
  assert.equal(evidence.redactionAudit.tencentSecretExposed, false, "external_access_strategy_evidence_hides_tencent_secret");
  assert.equal(evidence.nextGap.id, "production-launch-gap-08-external-access-dry-run-authorization", "external_access_strategy_next_gap");
  assertNoSensitiveText(JSON.stringify(evidence), "external_access_strategy_evidence");
} finally {
  await rm(evidenceRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_d_external_access_strategy_local_gate",
  formalCandidate: "ingress_https_domain_formal_candidate",
  executionNow: false,
}, null, 2));
