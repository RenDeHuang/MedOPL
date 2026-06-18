import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_SHARED_EDGE_STRATEGY_COMMAND,
  buildPackageDSharedEdgeStrategyContract,
  runPackageDSharedEdgeStrategyContract,
} from "../support/cloud-prework/package-d-external-access-strategy-runner.js";

const forbiddenText = Object.freeze([
  "kubectl",
  "client-certificate-data",
  "client-key-data",
  "certificate-authority-data",
  "current-context:",
  "SecretId",
  "SecretKey",
  "DATABASE_URL",
  "PORTAL_POSTGRES_PASSWORD",
  "PORTAL_ADMIN_PASSWORD",
  "TENCENT_SECRET",
  "tls.key",
  "-----BEGIN",
  "CreateLoadBalancer",
  "CreateRecord",
  "ModifyLoadBalancer",
  "medopl-tenant-",
  "dual write",
]);

function assertNoForbiddenText(value = "", label = "text") {
  for (const forbidden of forbiddenText) {
    assert.equal(String(value).includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-shared-edge-strategy-"));
try {
  assert.equal(
    PACKAGE_D_SHARED_EDGE_STRATEGY_COMMAND,
    "node tests/support/cloud-prework/package-d-external-access-strategy-runner.js --mode shared-edge-strategy-contract-local-gate --run-id <runid> --authorized 1",
    "shared_edge_strategy_single_entrypoint",
  );

  await assert.rejects(
    () => buildPackageDSharedEdgeStrategyContract({
      runId: "gap08n-local",
      evidenceDir: evidenceRoot,
      authorized: false,
      mode: "shared-edge-strategy-contract-local-gate",
    }),
    /package_d_shared_edge_strategy_not_authorized/,
    "shared_edge_strategy_unauthorized_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDSharedEdgeStrategyContract({
      runId: "gap08n-local",
      evidenceDir: evidenceRoot,
      authorized: true,
      mode: "shared-edge-strategy-contract-local-gate",
      argv: ["--kubeconfig", "/tmp/forbidden"],
    }),
    /package_d_external_access_strategy_forbidden_arg:--kubeconfig/,
    "shared_edge_strategy_must_reject_kubeconfig_arg",
  );

  const plan = await buildPackageDSharedEdgeStrategyContract({
    runId: "gap08n-local",
    evidenceDir: evidenceRoot,
    authorized: true,
    mode: "shared-edge-strategy-contract-local-gate",
  });

  assert.equal(plan.contract, "production_launch_gap_08n_shared_edge_clb_strategy_contract_local_gate", "shared_edge_contract_name");
  assert.equal(plan.mode, "shared-edge-strategy-contract-local-gate", "shared_edge_mode");
  assert.equal(plan.currentFacts.portalNodePortDirectHttp, 200, "portal_nodeport_direct_http_fact");
  assert.equal(plan.currentFacts.portalHttpsViaFailedClb, 504, "portal_failed_clb_504_fact");
  assert.equal(plan.currentFacts.oplWebuiHttpsViaWorkingClb, 200, "opl_working_clb_fact");
  assert.equal(plan.target.portalHost, "portal.medopl.cn", "portal_host");
  assert.equal(plan.target.oplHost, "opl.medopl.cn", "opl_host");
  assert.equal(plan.target.failedPortalClb, "lb-b33auprw-h1bv86yx9nswdtfj.clb.usw-tencentclb.com", "failed_portal_clb");
  assert.equal(plan.target.workingOplClb, "lb-lhj3bgii-ms5ocrjz6hdaki2l.clb.usw-tencentclb.com", "working_opl_clb");

  assert.deepEqual(
    plan.options.map((option) => option.id),
    ["continue_fixing_failed_portal_clb", "reuse_opl_webui_working_clb", "create_or_designate_medopl_shared_edge_clb"],
    "must_compare_three_required_options",
  );
  assert.equal(plan.options[0].recommended, false, "continue_fixing_failed_clb_not_recommended");
  assert.equal(plan.options[1].recommended, false, "reuse_opl_clb_not_recommended");
  assert.equal(plan.options[2].recommended, true, "shared_edge_recommended");
  assert.equal(plan.recommendedOption.id, "create_or_designate_medopl_shared_edge_clb", "recommended_shared_edge");
  assert.equal(plan.recommendedOption.shortTermOnly, false, "recommendation_not_short_term_only");

  assert.equal(plan.noCompatPolicy.noFallbackHost, true, "no_fallback_host");
  assert.equal(plan.noCompatPolicy.noDualClbParallelLongTerm, true, "no_dual_clb_long_term");
  assert.equal(plan.noCompatPolicy.noDualWriteRoute, true, "no_dual_write_route");
  assert.equal(plan.noCompatPolicy.failedPortalClbLongTermEntryAllowed, false, "failed_clb_not_long_term");
  assert.equal(plan.noCompatPolicy.cleanupGapRequiredAfterSharedEdgeSmoke, true, "cleanup_gap_required");
  assert.equal(plan.cleanupPlan.executeNow, false, "cleanup_not_execute_now");
  assert.equal(plan.cleanupPlan.explicitAuthorizationRequired, true, "cleanup_requires_auth");
  assert.equal(plan.cleanupPlan.failedPortalClbResources.includes("Ingress/portal-frontend"), true, "cleanup_lists_portal_ingress");

  assert.deepEqual(
    plan.hostRoutingModel.routes.map((route) => `${route.host}->${route.backend}`),
    [
      "portal.medopl.cn->portal-frontend-edge:8080",
      "opl.medopl.cn->OPL-Webui backend",
      "trace.medopl.cn->future trace backend",
    ],
    "host_routing_model",
  );
  assert.equal(plan.hostRoutingModel.oplWebuiDisruptionAllowed, false, "opl_not_disrupted");
  assert.equal(plan.tlsCertificateStrategy.certPrivateKeyInEvidenceAllowed, false, "no_tls_key_evidence");
  assert.equal(plan.qcloudIngressGatewayStrategy.mutationNowAllowed, false, "no_mutation_now");
  assert.equal(plan.dnsCutoverPlan.mutationNowAllowed, false, "no_dns_now");
  assert.equal(plan.rollbackPlan.rollbackRequiresSeparateAuthorization, true, "rollback_separate_auth");
  assert.equal(plan.smokePlan.portalExternalSmoke.url, "https://portal.medopl.cn/", "portal_smoke_url");
  assert.equal(plan.smokePlan.oplExternalSmoke.url, "https://opl.medopl.cn/", "opl_smoke_url");
  assert.equal(plan.boundary.publicAccessClaimAllowedNow, false, "no_public_claim");
  assert.equal(plan.boundary.tencentApiMutationAllowedNow, false, "no_tencent_mutation");
  assert.equal(plan.boundary.kubernetesMutationAllowedNow, false, "no_k8s_mutation");

  assert.deepEqual(
    plan.nextGaps.map((gap) => gap.id),
    [
      "gap-08n-1-shared-edge-dry-run-creation-strategy",
      "gap-08n-2-portal-route-attach",
      "gap-08n-3-portal-dns-cutover",
      "gap-08n-4-portal-https-smoke",
      "gap-08n-5-opl-route-migration-decision",
      "gap-08n-6-external-access-closeout",
      "gap-08n-7-cleanup-failed-portal-clb",
    ],
    "ordered_next_gaps",
  );
  assert.equal(plan.nextGaps[4].optional, true, "opl_migration_optional_or_leave_existing");
  assert.equal(plan.nextGaps[6].explicitAuthorizationRequired, true, "failed_clb_cleanup_explicit");

  assertNoForbiddenText(JSON.stringify(plan), "shared_edge_plan");

  const result = await runPackageDSharedEdgeStrategyContract({
    runId: "gap08n-local",
    evidenceDir: evidenceRoot,
    authorized: true,
    mode: "shared-edge-strategy-contract-local-gate",
  });
  assert.equal(result.ok, true, "runner_result_ok");
  assert.equal(result.evidencePath.endsWith("shared-edge-strategy-redacted.json"), true, "evidence_file_name");
  const evidence = await readFile(result.evidencePath, "utf8");
  assertNoForbiddenText(evidence, "shared_edge_evidence");
  assert.equal(JSON.parse(evidence).redactionAudit.secretLeakageDetected, false, "redaction_audit_pass");
} finally {
  await rm(evidenceRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_d_shared_edge_strategy_local_gate",
}, null, 2));
