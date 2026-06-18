import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  TENCENT_CLB_READONLY_DIAGNOSTICS_COMMAND,
  buildTencentClbReadonlyDiagnostics,
  runTencentClbReadonlyDiagnostics,
} from "../support/cloud-prework/tencent-clb-readonly-diagnostics-runner.js";

const envValues = Object.freeze({
  TENCENTCLOUD_SECRET_ID: "secret-id-must-not-leak",
  TENCENTCLOUD_SECRET_KEY: "secret-key-must-not-leak",
  TENCENTCLOUD_REGION: "na-siliconvalley",
  PORTAL_CLB_INSTANCE_ID: "lb-pwv9zgky",
  OPL_CLB_INSTANCE_ID: "lb-lhj3bgii",
  PORTAL_HOST_DOMAIN: "portal.medopl.cn",
  OPL_HOST_DOMAIN: "opl.medopl.cn",
  EXPECTED_PORTAL_NODE_IP: "10.66.0.42",
  EXPECTED_PORTAL_NODE_PORT: "30336",
  EXPECTED_OPL_NODE_PORT: "32258",
});

const allowedApis = Object.freeze([
  "DescribeLoadBalancers",
  "DescribeListeners",
  "DescribeRules",
  "DescribeTargets",
  "DescribeTargetsHealth",
  "DescribeLoadBalancerSecurityGroups",
  "DescribeTargetGroups",
  "DescribeCustomizedConfigAssociateList",
]);

const forbiddenMutationPrefixes = Object.freeze([
  "Create",
  "Modify",
  "Delete",
  "Register",
  "Deregister",
  "Attach",
  "Detach",
  "Set",
  "Associate",
  "Disassociate",
  "Rewrite",
  "Batch",
]);

function assertNoSensitiveText(value = "", label = "text") {
  for (const forbidden of [
    "secret-id-must-not-leak",
    "secret-key-must-not-leak",
    "SecretId",
    "SecretKey",
    "Authorization:",
    "authorization:",
    "rawResponse",
    "headers",
    "client-key-data",
    "client-certificate-data",
    "DATABASE_URL",
    "PORTAL_POSTGRES_PASSWORD",
    "PORTAL_ADMIN_PASSWORD",
    "TENCENT_SSL_CERT_ID",
    "qcloud_cert_id",
    "kubectl ",
    "CreateLoadBalancer",
    "ModifyLoadBalancer",
    "DeleteLoadBalancer",
    "RegisterTargets",
    "DeregisterTargets",
    "medopl-tenant-",
  ]) {
    assert.equal(String(value).includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-tencent-clb-readonly-"));
try {
  const runId = "gap08o-local-gate";
  assert.equal(
    TENCENT_CLB_READONLY_DIAGNOSTICS_COMMAND,
    "node tests/support/cloud-prework/tencent-clb-readonly-diagnostics-runner.js --env /home/dev/.secrets/medopl/v22/tencent-clb-readonly.env --run-id <runid> --authorized 1",
    "tencent_clb_readonly_single_entrypoint",
  );

  await assert.rejects(
    () => buildTencentClbReadonlyDiagnostics({
      runId,
      evidenceDir: evidenceRoot,
      authorized: false,
      envValues,
    }),
    /tencent_clb_readonly_diagnostics_not_authorized/,
    "tencent_clb_readonly_unauthorized_must_fail_closed",
  );

  await assert.rejects(
    () => buildTencentClbReadonlyDiagnostics({
      runId,
      evidenceDir: evidenceRoot,
      authorized: true,
      envValues: { ...envValues, RUN_TENCENT_DEPLOY_EXECUTION: "external-access" },
    }),
    /tencent_clb_readonly_env_non_allowlist_key:RUN_TENCENT_DEPLOY_EXECUTION/,
    "tencent_clb_readonly_env_must_keep_exact_allowlist",
  );

  await assert.rejects(
    () => buildTencentClbReadonlyDiagnostics({
      runId,
      evidenceDir: evidenceRoot,
      authorized: true,
      envValues: { ...envValues, EXPECTED_PORTAL_NODE_PORT: "8080" },
    }),
    /tencent_clb_readonly_expected_portal_node_port_mismatch/,
    "tencent_clb_readonly_expected_portal_node_port_fixed",
  );

  await assert.rejects(
    () => buildTencentClbReadonlyDiagnostics({
      runId,
      evidenceDir: evidenceRoot,
      authorized: true,
      envValues,
      apiPlan: ["DescribeLoadBalancers", "ModifyLoadBalancerAttributes"],
    }),
    /tencent_clb_readonly_forbidden_mutation_api:ModifyLoadBalancerAttributes/,
    "tencent_clb_readonly_must_reject_mutation_api_plan",
  );

  const diagnostics = await buildTencentClbReadonlyDiagnostics({
    runId,
    evidenceDir: evidenceRoot,
    authorized: true,
    envValues,
  });

  assert.equal(diagnostics.ok, true, "diagnostics_ok");
  assert.equal(diagnostics.contract, "production_launch_gap_08o_tencent_clb_readonly_diagnostics_local_gate", "diagnostics_contract");
  assert.equal(diagnostics.command, TENCENT_CLB_READONLY_DIAGNOSTICS_COMMAND, "diagnostics_command");
  assert.deepEqual(diagnostics.envAllowlist, Object.keys(envValues), "diagnostics_env_allowlist");
  assert.deepEqual(diagnostics.allowedApis, allowedApis, "diagnostics_allowed_apis");
  assert.deepEqual(diagnostics.forbiddenMutationPrefixes, forbiddenMutationPrefixes, "diagnostics_forbidden_mutation_prefixes");
  assert.equal(diagnostics.boundary.tencentMutationAllowed, false, "diagnostics_no_tencent_mutation");
  assert.equal(diagnostics.boundary.kubernetesAccessAllowed, false, "diagnostics_no_kubernetes_access");
  assert.equal(diagnostics.boundary.dnsMutationAllowed, false, "diagnostics_no_dns_mutation");
  assert.equal(diagnostics.boundary.publicAccessClaimAllowed, false, "diagnostics_no_public_claim");
  assert.equal(diagnostics.evidence.path, ".runtime/package-d-external-access-strategy/<runid>/tencent-clb-readonly-diagnostics-redacted.json", "diagnostics_evidence_path_shape");

  assert.equal(diagnostics.inputs.portal.currentClbInstanceId, "lb-pwv9zgky", "diagnostics_portal_current_clb");
  assert.equal(diagnostics.inputs.portal.previousClbInstanceId, "lb-b33auprw", "diagnostics_portal_previous_clb");
  assert.equal(diagnostics.inputs.portal.host, "portal.medopl.cn", "diagnostics_portal_host");
  assert.equal(diagnostics.inputs.portal.expectedNodeIp, "10.66.0.42", "diagnostics_portal_expected_node_ip");
  assert.equal(diagnostics.inputs.portal.expectedNodePort, 30336, "diagnostics_portal_expected_node_port");
  assert.equal(diagnostics.inputs.opl.clbInstanceId, "lb-lhj3bgii", "diagnostics_opl_clb");
  assert.equal(diagnostics.inputs.opl.host, "opl.medopl.cn", "diagnostics_opl_host");
  assert.equal(diagnostics.inputs.opl.expectedNodePort, 32258, "diagnostics_opl_expected_node_port");
  assert.equal(diagnostics.inputs.opl.expectedNodeIpDiscovery, "discover_from_service_opl-webui-control-plane", "diagnostics_opl_node_ip_discovery_boundary");

  assert.equal(diagnostics.diagnostics.portalClb.exists, true, "diagnostics_portal_clb_exists");
  assert.equal(diagnostics.diagnostics.oplClb.exists, true, "diagnostics_opl_clb_exists");
  assert.equal(diagnostics.diagnostics.portalListener443.port, 443, "diagnostics_portal_listener_443");
  assert.equal(diagnostics.diagnostics.oplListener443.port, 443, "diagnostics_opl_listener_443");
  assert.equal(diagnostics.diagnostics.portalRuleBackend.backendService, "portal-frontend-edge", "diagnostics_portal_rule_backend_service");
  assert.equal(diagnostics.diagnostics.portalRuleBackend.backendPort, 30336, "diagnostics_portal_rule_backend_port");
  assert.equal(diagnostics.diagnostics.oplRuleBackend.backendService, "opl-webui-control-plane", "diagnostics_opl_rule_backend_service");
  assert.equal(diagnostics.diagnostics.portalRegisteredTargets[0].ip, "10.66.0.42", "diagnostics_portal_target_ip");
  assert.equal(diagnostics.diagnostics.portalRegisteredTargets[0].port, 30336, "diagnostics_portal_target_port");
  assert.equal(diagnostics.diagnostics.oplRegisteredTargets[0].port, 32258, "diagnostics_opl_target_port");
  assert.equal(diagnostics.diagnostics.portalTargetHealth.state, "healthy", "diagnostics_portal_health_state");
  assert.equal(diagnostics.diagnostics.oplTargetHealth.state, "healthy", "diagnostics_opl_health_state");
  assert.equal(diagnostics.diagnostics.portalSecurityGroup.defaultAllowObserved, "unknown_or_api_dependent", "diagnostics_portal_sg_shape");
  assert.equal(diagnostics.diagnostics.oplSecurityGroup.defaultAllowObserved, "unknown_or_api_dependent", "diagnostics_opl_sg_shape");
  assert.equal(diagnostics.diagnostics.forwardingDiff.portal.protocol, "HTTPS->HTTP", "diagnostics_forwarding_protocol");
  assert.equal(diagnostics.diagnostics.forwardingDiff.comparisonIncludesSessionGzipHttp2XffSourceIpMode, true, "diagnostics_forwarding_diff_shape");

  assert.equal(diagnostics.classification.rootCause, "unknown_clb_data_plane_504", "diagnostics_default_root_cause");
  assert.equal(diagnostics.classification.recommendedNextRepairAction, "compare Tencent CLB listener/rule/target/security-group data-plane details and repair the first mismatched CLB layer under separate authorization", "diagnostics_recommended_action");
  for (const rootCause of [
    "listener_missing",
    "rule_missing",
    "target_missing",
    "target_unhealthy",
    "wrong_target_port",
    "wrong_target_ip",
    "security_group_block",
    "source_ip_passthrough_mismatch",
    "listener_rule_mismatch",
    "unknown_clb_data_plane_504",
  ]) {
    assert(diagnostics.classification.allowedRootCauses.includes(rootCause), `diagnostics_root_cause_enum:${rootCause}`);
  }
  assertNoSensitiveText(JSON.stringify(diagnostics), "diagnostics_plan");

  const wrongPort = await buildTencentClbReadonlyDiagnostics({
    runId: "gap08o-wrong-port",
    evidenceDir: evidenceRoot,
    authorized: true,
    envValues,
    observations: {
      portalRegisteredTargets: [{ ip: "10.66.0.42", port: 8080, weight: 100 }],
      portalTargetHealth: { state: "healthy", reason: "" },
    },
  });
  assert.equal(wrongPort.classification.rootCause, "wrong_target_port", "diagnostics_wrong_port_classification");

  const result = await runTencentClbReadonlyDiagnostics({
    runId,
    evidenceDir: evidenceRoot,
    authorized: true,
    envValues,
  });
  assert.equal(result.ok, true, "runner_ok");
  assert.equal(result.evidencePath.endsWith("tencent-clb-readonly-diagnostics-redacted.json"), true, "runner_evidence_file");
  const evidence = await readFile(result.evidencePath, "utf8");
  assertNoSensitiveText(evidence, "diagnostics_evidence");
  const evidenceJson = JSON.parse(evidence);
  assert.equal(evidenceJson.redactionAudit.secretLeakageDetected, false, "diagnostics_evidence_redaction_audit");
  assert.equal(evidenceJson.classification.rootCause, "unknown_clb_data_plane_504", "diagnostics_evidence_classification");

  const envPath = path.join(evidenceRoot, "tencent-clb-readonly.env");
  await writeFile(envPath, Object.entries(envValues).map(([key, value]) => `${key}=${value}`).join("\n"));
  const unauthorizedCli = spawnSync(process.execPath, [
    "tests/support/cloud-prework/tencent-clb-readonly-diagnostics-runner.js",
    "--env",
    path.join(evidenceRoot, "missing-env-that-must-not-be-read.env"),
    "--run-id",
    "gap08o-cli-unauthorized",
    "--authorized",
    "0",
    "--evidence-dir",
    evidenceRoot,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(unauthorizedCli.status, 0, "diagnostics_cli_unauthorized_must_fail");
  assert.equal(unauthorizedCli.stderr.includes("tencent_clb_readonly_diagnostics_not_authorized"), true, "diagnostics_cli_unauthorized_reason");
  assert.equal(unauthorizedCli.stderr.includes("ENOENT"), false, "diagnostics_cli_unauthorized_must_not_read_env_first");
  assertNoSensitiveText(unauthorizedCli.stdout + unauthorizedCli.stderr, "diagnostics_cli_unauthorized_output");

  const cli = spawnSync(process.execPath, [
    "tests/support/cloud-prework/tencent-clb-readonly-diagnostics-runner.js",
    "--env",
    envPath,
    "--run-id",
    "gap08o-cli-local",
    "--authorized",
    "1",
    "--evidence-dir",
    evidenceRoot,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(cli.status, 0, `diagnostics_cli_should_pass:${cli.stderr}`);
  assertNoSensitiveText(cli.stdout + cli.stderr, "diagnostics_cli_output");
  assert.equal(JSON.parse(cli.stdout).ok, true, "diagnostics_cli_summary_ok");
} finally {
  await rm(evidenceRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_clb_readonly_diagnostics_local_gate",
}, null, 2));
