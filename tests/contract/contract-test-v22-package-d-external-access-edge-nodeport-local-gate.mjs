import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_APPLY_COMMAND,
  PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_DRY_RUN_COMMAND,
  buildPackageDExternalAccessPlan,
  runPackageDExternalAccessExecution,
} from "../support/cloud-prework/package-d-external-access-runner.js";

const requiredExternalAccessBusinessEnv = Object.freeze({
  PORTAL_HOST_DOMAIN: "portal.medopl.cn",
  INGRESS_CLASS: "qcloud",
  TLS_SECRET_NAME: "medopl-portal-tls",
  TENCENT_SSL_CERT_ID: "qcloud-cert-id-must-not-leak",
  EXTERNAL_SMOKE_URL: "https://portal.medopl.cn/",
});
const applyRunGateEnv = Object.freeze({ RUN_TENCENT_DEPLOY_EXECUTION: "external-access" });
const dryRunGateEnv = Object.freeze({ RUN_TENCENT_DEPLOY_EXECUTION: "0" });

function assertNoQcloudApplySensitiveText(text = "", label = "text") {
  for (const forbidden of [
    "qcloud-cert-id-must-not-leak",
    "kubernetes.io/tls",
    "tls.crt",
    "tls.key",
    "-----BEGIN CERTIFICATE-----",
    ["-----BEGIN", "PRIVATE", "KEY-----"].join(" "),
    "DATABASE_URL",
    "PORTAL_POSTGRES_PASSWORD",
    "PORTAL_ADMIN_PASSWORD",
    "TCR_SECRET",
    "SecretId",
    "SecretKey",
    "client-key-data",
    "client-certificate-data",
    "medopl-tenant-",
    "kubectl delete namespace",
    "type: LoadBalancer",
    "CreateLoadBalancer",
    "CreateRecord",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const externalAccessEvidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-external-access-edge-nodeport-"));
try {
  const evidenceDir = path.join(externalAccessEvidenceRoot, "evidence");
  const runId = "gap08e-local-gate";
  assert.equal(
    PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_DRY_RUN_COMMAND,
    "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-edge-nodeport-dry-run --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1",
    "external_access_edge_nodeport_dry_run_command",
  );
  assert.equal(
    PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_APPLY_COMMAND,
    "RUN_TENCENT_DEPLOY_EXECUTION=external-access node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-edge-nodeport-apply --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id gap08e-qcloud-edge-nodeport-apply-001 --authorized 1",
    "external_access_edge_nodeport_apply_command",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-edge-nodeport-apply",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: {},
    }),
    /package_d_external_access_apply_gate_not_authorized/,
    "external_access_edge_nodeport_apply_missing_run_gate_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-edge-nodeport-dry-run",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: applyRunGateEnv,
    }),
    /package_d_external_access_dry_run_gate_must_remain_zero/,
    "external_access_edge_nodeport_dry_run_must_not_use_apply_gate",
  );
  const edgeDryRunPlan = await buildPackageDExternalAccessPlan({
    runId,
    evidenceDir,
    authorized: true,
    mode: "qcloud-edge-nodeport-dry-run",
    externalAccessEnv: requiredExternalAccessBusinessEnv,
    runGateEnv: dryRunGateEnv,
  });
  assert.equal(edgeDryRunPlan.contract, "production_launch_gap_08e_qcloud_edge_nodeport_backend_contract_local_gate", "external_access_edge_contract");
  assert.equal(edgeDryRunPlan.boundary.realMutationAllowedNow, false, "external_access_edge_dry_run_no_real_mutation");
  assert.equal(edgeDryRunPlan.target.backendService, "portal-frontend-edge", "external_access_edge_backend_service");
  assert.equal(edgeDryRunPlan.target.originClusterIpService, "portal-frontend", "external_access_edge_origin_service");
  assert.equal(Object.hasOwn(edgeDryRunPlan.manifests, "secret"), false, "external_access_edge_plan_must_not_materialize_secret_manifest");
  assert.equal(edgeDryRunPlan.manifests.edgeService.kind, "Service", "external_access_edge_service_kind");
  assert.equal(edgeDryRunPlan.manifests.edgeService.metadata.name, "portal-frontend-edge", "external_access_edge_service_name");
  assert.equal(edgeDryRunPlan.manifests.edgeService.metadata.namespace, "medopl-platform", "external_access_edge_service_namespace");
  assert.equal(edgeDryRunPlan.manifests.edgeService.spec.type, "NodePort", "external_access_edge_service_type");
  assert.deepEqual(edgeDryRunPlan.manifests.edgeService.spec.selector, {
    "app.kubernetes.io/name": "portal-frontend",
    "app.kubernetes.io/part-of": "medopl-package-d",
  }, "external_access_edge_service_selector");
  assert.deepEqual(edgeDryRunPlan.manifests.edgeService.spec.ports, [{
    name: "http",
    port: 8080,
    protocol: "TCP",
    targetPort: 8080,
  }], "external_access_edge_service_ports");
  assert.equal(edgeDryRunPlan.manifests.ingress.spec.rules[0].http.paths[0].backend.service.name, "portal-frontend-edge", "external_access_edge_ingress_backend_service");
  assert.equal(edgeDryRunPlan.manifestBoundary.originalClusterIpServiceMutationAllowed, false, "external_access_edge_original_clusterip_service_not_mutated");
  assert.equal(edgeDryRunPlan.manifestBoundary.loadBalancerServiceForbidden, true, "external_access_edge_loadbalancer_forbidden");
  assert.deepEqual(edgeDryRunPlan.allowedOperations.mutations, [
    "server-side dry-run Service/portal-frontend-edge type NodePort in medopl-platform",
    "server-side dry-run Ingress/portal-frontend in medopl-platform for portal.medopl.cn -> portal-frontend-edge:8080",
  ], "external_access_edge_dry_run_mutation_boundary");
  assert(edgeDryRunPlan.commands.some((command) => command.name === "dry_run_portal_edge_service"), "external_access_edge_dry_run_service_command");
  assert(edgeDryRunPlan.commands.every((command) => !command.command.includes("kubectl patch")), "external_access_edge_commands_must_not_patch");
  assert(edgeDryRunPlan.commands.every((command) => !command.command.includes("service portal-frontend -n medopl-platform") || command.kind === "readonly"), "external_access_edge_origin_service_readonly_only");
  assert.equal(edgeDryRunPlan.evidence.edgeServiceManifestPath.endsWith("portal-frontend-edge-service-redacted.json"), true, "external_access_edge_service_evidence_path");
  assert.equal(Object.hasOwn(edgeDryRunPlan.evidence, "secretManifestPath"), false, "external_access_edge_secret_evidence_path_not_applicable");
  assertNoQcloudApplySensitiveText(JSON.stringify(edgeDryRunPlan), "external_access_edge_dry_run_plan");

  const edgeApplyPlan = await buildPackageDExternalAccessPlan({
    runId,
    evidenceDir,
    authorized: true,
    mode: "qcloud-edge-nodeport-apply",
    externalAccessEnv: requiredExternalAccessBusinessEnv,
    runGateEnv: applyRunGateEnv,
  });
  assert.equal(edgeApplyPlan.boundary.realMutationAllowedNow, true, "external_access_edge_apply_real_mutation_boundary");
  assert.deepEqual(edgeApplyPlan.allowedOperations.mutations, [
    "apply Service/portal-frontend-edge type NodePort in medopl-platform",
    "apply Ingress/portal-frontend in medopl-platform for portal.medopl.cn -> portal-frontend-edge:8080",
  ], "external_access_edge_apply_mutation_allowlist");
  assert(edgeApplyPlan.commands.some((command) => command.name === "apply_portal_edge_service"), "external_access_edge_apply_service_command");
  const httpsCapabilityCommand = edgeApplyPlan.commands.find((command) => command.name === "curl_fail_with_body_capability_probe");
  const httpsSmokeCommand = edgeApplyPlan.commands.find((command) => command.name === "https_external_smoke");
  assert(httpsCapabilityCommand, "external_access_edge_apply_must_probe_curl_fail_with_body_support");
  assert(httpsSmokeCommand, "external_access_edge_apply_must_include_https_smoke");
  assert.equal(httpsSmokeCommand.command.includes("--fail-with-body"), false, "external_access_edge_https_smoke_must_not_hard_require_fail_with_body");
  assert.equal(httpsSmokeCommand.command.includes("https://portal.medopl.cn/"), true, "external_access_edge_https_smoke_fixed_url");
  assert.equal(httpsSmokeCommand.command.includes("--connect-timeout 10"), true, "external_access_edge_https_smoke_connect_timeout");
  assert.equal(httpsSmokeCommand.command.includes("--max-time 30"), true, "external_access_edge_https_smoke_max_time");
  assert.equal(httpsSmokeCommand.command.includes("-w"), true, "external_access_edge_https_smoke_structured_writeout");
  assert.equal(edgeApplyPlan.rollbackCleanupPlan.deleteEdgeService, "delete only Service/portal-frontend-edge if created by this run and rollback is separately authorized", "external_access_edge_delete_service_plan");
  assert.equal(edgeApplyPlan.dnsPlan.dnsMutationAllowed, false, "external_access_edge_dns_no_mutation");
  assertNoQcloudApplySensitiveText(JSON.stringify(edgeApplyPlan), "external_access_edge_apply_plan");

  const envPath = path.join(externalAccessEvidenceRoot, "package-d-external-access.env");
  const kubeconfigPath = path.join(externalAccessEvidenceRoot, "kubeconfig-package-d-deploy");
  await writeFile(envPath, [
    "PORTAL_HOST_DOMAIN=portal.medopl.cn",
    "INGRESS_CLASS=qcloud",
    "TLS_SECRET_NAME=medopl-portal-tls",
    "TENCENT_SSL_CERT_ID=qcloud-cert-id-must-not-leak",
    "EXTERNAL_SMOKE_URL=https://portal.medopl.cn/",
  ].join("\n"));
  await writeFile(kubeconfigPath, [
    "apiVersion: v1",
    "current-context: cls-fi097sy4-context",
    "clusters:",
    "- name: cls-fi097sy4",
    "  cluster:",
    "    server: https://cls-fi097sy4.example.invalid",
    "contexts:",
    "- name: cls-fi097sy4-context",
    "  context:",
    "    cluster: cls-fi097sy4",
  ].join("\n"));
  const previousRunGate = process.env.RUN_TENCENT_DEPLOY_EXECUTION;
  process.env.RUN_TENCENT_DEPLOY_EXECUTION = "external-access";
  try {
    const edgeCommandLog = [];
    const edgeExecution = await runPackageDExternalAccessExecution({
      envPath,
      kubeconfigPath,
      evidenceDir,
      authorized: true,
      mode: "qcloud-edge-nodeport-apply",
      runId: "gap08e-local-edge-apply",
      commandExecutor: async ({ args, stdin, env }) => {
        edgeCommandLog.push({ args, stdin });
        if (args[0] === "kubectl") assert.deepEqual(Object.keys(env).sort(), ["KUBECONFIG"], "external_access_edge_kubectl_env_only_kubeconfig");
        if (args.includes("delete") || args.includes("patch") || args.includes("scale") || args.includes("rollout") || args.includes("exec")) throw new Error(`external_access_edge_forbidden_fake_command:${args.join(" ")}`);
        if (args.join(" ").includes("config current-context")) return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
        if (args.join(" ").includes("get namespace medopl-platform")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"medopl-platform\"}}\n", stderr: "" };
        if (args.join(" ").includes("get service portal-frontend-edge")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend-edge\"},\"spec\":{\"type\":\"NodePort\",\"ports\":[{\"port\":8080}]}}\n", stderr: "" };
        if (args.join(" ").includes("describe service portal-frontend-edge")) return { status: 0, stdout: "Name: portal-frontend-edge\nType: NodePort\n", stderr: "" };
        if (args.join(" ").includes("get service portal-frontend")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend\"},\"spec\":{\"type\":\"ClusterIP\",\"ports\":[{\"port\":8080}]}}\n", stderr: "" };
        if (args.join(" ").includes("get ingressclass qcloud")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"qcloud\"},\"spec\":{\"controller\":\"cloud.tencent.com/ingress-controller\"}}\n", stderr: "" };
        if (args.includes("apply")) {
          assert.equal(args[args.indexOf("-f") + 1], "-", "external_access_edge_apply_and_dry_run_must_use_stdin_manifest");
          assert.equal(String(stdin || "").includes("\"kind\": \"Secret\""), false, "external_access_edge_execution_must_not_apply_secret");
          assert.equal(String(stdin || "").includes("qcloud-cert-id-must-not-leak"), false, "external_access_edge_execution_must_not_send_cert_id");
        }
        if (args.join(" ").includes("get ingress portal-frontend")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend\"}}\n", stderr: "" };
        if (args.join(" ").includes("describe ingress portal-frontend")) return { status: 0, stdout: "Name: portal-frontend\n", stderr: "" };
        if (args[0] === "getent") return { status: 0, stdout: "203.0.113.10 portal.medopl.cn\n", stderr: "" };
        if (args[0] === "curl" && args.join(" ") === "curl --help all") return { status: 0, stdout: "Usage: curl [options...] <url>\n", stderr: "" };
        if (args[0] === "curl") {
          assert.equal(args.includes("--fail-with-body"), false, "external_access_edge_execution_old_curl_must_use_fallback");
          assert.equal(args.includes("--connect-timeout"), true, "external_access_edge_execution_fallback_connect_timeout");
          assert.equal(args.includes("--max-time"), true, "external_access_edge_execution_fallback_max_time");
          assert.equal(args.includes("-sS"), true, "external_access_edge_execution_fallback_silent_show_error");
          assert.equal(args.includes("-o"), true, "external_access_edge_execution_fallback_output_sink");
          assert.equal(args.includes("-w"), true, "external_access_edge_execution_fallback_writeout");
          assert.equal(args.at(-1), "https://portal.medopl.cn/", "external_access_edge_execution_fallback_fixed_url");
          return { status: 0, stdout: "{\"service\":\"portal-frontend\",\"url\":\"https://portal.medopl.cn/\",\"http_code\":\"200\",\"ssl_verify_result\":\"0\",\"time_total\":\"0.123\"}\n", stderr: "" };
        }
        return { status: 0, stdout: "ok\n", stderr: "" };
      },
    });
    assert.equal(edgeExecution.ok, true, "external_access_edge_fake_execution_must_pass");
    assert.equal(edgeExecution.contract, "production_launch_gap_08e_qcloud_edge_nodeport_execution", "external_access_edge_execution_contract");
    assert.equal(edgeCommandLog.some((entry) => entry.args.includes("--dry-run=server") && String(entry.stdin).includes("\"name\": \"portal-frontend-edge\"")), true, "external_access_edge_execution_must_dry_run_edge_service");
    assert.equal(edgeCommandLog.some((entry) => entry.args.includes("apply") && !entry.args.includes("--dry-run=server") && String(entry.stdin).includes("\"name\": \"portal-frontend-edge\"")), true, "external_access_edge_execution_must_apply_edge_service");
    assert.equal(edgeCommandLog.some((entry) => entry.args.includes("apply") && String(entry.stdin).includes("\"kind\": \"Secret\"")), false, "external_access_edge_execution_must_not_apply_secret_manifest");
    const edgeRunEvidenceDir = path.join(evidenceDir, "gap08e-local-edge-apply");
    const edgeServiceEvidence = JSON.parse(await readFile(path.join(edgeRunEvidenceDir, "portal-frontend-edge-service-redacted.json"), "utf8"));
    const edgeIngressEvidence = JSON.parse(await readFile(path.join(edgeRunEvidenceDir, "portal-ingress-redacted.json"), "utf8"));
    const edgeExecutionEvidence = JSON.parse(await readFile(edgeExecution.evidencePath, "utf8"));
    assert.equal(edgeServiceEvidence.spec.type, "NodePort", "external_access_edge_execution_service_evidence_nodeport");
    assert.equal(edgeIngressEvidence.spec.rules[0].http.paths[0].backend.service.name, "portal-frontend-edge", "external_access_edge_execution_ingress_evidence_backend");
    assert.equal(edgeExecutionEvidence.contract, "production_launch_gap_08e_qcloud_edge_nodeport_execution", "external_access_edge_execution_evidence_contract");
    const smokeEvidence = edgeExecutionEvidence.commands.find((command) => command.name === "https_external_smoke");
    assert.equal(smokeEvidence.httpsSmoke.url, "https://portal.medopl.cn/", "external_access_edge_execution_smoke_evidence_url");
    assert.equal(smokeEvidence.httpsSmoke.http_code, "200", "external_access_edge_execution_smoke_evidence_http_code");
    assert.equal(smokeEvidence.httpsSmoke.compatibilityMode, "fallback_without_fail_with_body", "external_access_edge_execution_smoke_evidence_fallback_mode");
    assertNoQcloudApplySensitiveText(await readFile(edgeExecution.evidencePath, "utf8"), "external_access_edge_execution_evidence");
  } finally {
    if (previousRunGate === undefined) delete process.env.RUN_TENCENT_DEPLOY_EXECUTION;
    else process.env.RUN_TENCENT_DEPLOY_EXECUTION = previousRunGate;
  }
  process.env.RUN_TENCENT_DEPLOY_EXECUTION = "external-access";
  try {
    const edgeCommandLog = [];
    await runPackageDExternalAccessExecution({
      envPath,
      kubeconfigPath,
      evidenceDir,
      authorized: true,
      mode: "qcloud-edge-nodeport-apply",
      runId: "gap08e-local-edge-apply-new-curl",
      commandExecutor: async ({ args }) => {
        edgeCommandLog.push(args);
        if (args.join(" ").includes("config current-context")) return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
        if (args[0] === "curl" && args.join(" ") === "curl --help all") {
          return { status: 0, stdout: "Usage: curl [options...] <url>\n     --fail-with-body  Fail on HTTP errors but save the body\n", stderr: "" };
        }
        if (args[0] === "curl") {
          assert.equal(args.includes("--fail-with-body"), true, "external_access_edge_execution_new_curl_must_use_fail_with_body");
          return { status: 0, stdout: "{\"service\":\"portal-frontend\",\"url\":\"https://portal.medopl.cn/\",\"http_code\":\"200\",\"ssl_verify_result\":\"0\",\"time_total\":\"0.111\"}\n", stderr: "" };
        }
        return { status: 0, stdout: "ok\n", stderr: "" };
      },
    });
    assert.equal(edgeCommandLog.some((args) => args.includes("--fail-with-body")), true, "external_access_edge_new_curl_command_log");
  } finally {
    if (previousRunGate === undefined) delete process.env.RUN_TENCENT_DEPLOY_EXECUTION;
    else process.env.RUN_TENCENT_DEPLOY_EXECUTION = previousRunGate;
  }
} finally {
  await rm(externalAccessEvidenceRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_d_external_access_edge_nodeport_local_gate",
  edgeService: "portal-frontend-edge",
  ingressBackend: "portal-frontend-edge:8080",
}, null, 2));
