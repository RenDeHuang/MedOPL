import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_EXTERNAL_ACCESS_HEALTHCHECK_APPLY_COMMAND,
  PACKAGE_D_EXTERNAL_ACCESS_HEALTHCHECK_DRY_RUN_COMMAND,
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
const dryRunGateEnv = Object.freeze({ RUN_TENCENT_DEPLOY_EXECUTION: "0" });
const applyRunGateEnv = Object.freeze({ RUN_TENCENT_DEPLOY_EXECUTION: "external-access" });

function assertNoQcloudHealthcheckSensitiveText(text = "", label = "text") {
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
    "kubectl delete",
    "kubectl patch service portal-frontend",
    "type: LoadBalancer",
    "CreateLoadBalancer",
    "CreateRecord",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const healthcheckEvidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-external-access-healthcheck-"));
try {
  const evidenceDir = path.join(healthcheckEvidenceRoot, "evidence");
  const runId = "gap08h-local-gate";
  assert.equal(
    PACKAGE_D_EXTERNAL_ACCESS_HEALTHCHECK_DRY_RUN_COMMAND,
    "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-healthcheck-dry-run --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1",
    "external_access_healthcheck_dry_run_command",
  );
  assert.equal(
    PACKAGE_D_EXTERNAL_ACCESS_HEALTHCHECK_APPLY_COMMAND,
    "RUN_TENCENT_DEPLOY_EXECUTION=external-access node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-healthcheck-apply --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id gap08h-qcloud-healthcheck-apply-001 --authorized 1",
    "external_access_healthcheck_apply_command",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: false,
      mode: "qcloud-healthcheck-dry-run",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: dryRunGateEnv,
    }),
    /package_d_external_access_not_authorized/,
    "external_access_healthcheck_unauthorized_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-healthcheck-apply",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: dryRunGateEnv,
    }),
    /package_d_external_access_apply_gate_not_authorized/,
    "external_access_healthcheck_apply_requires_external_access_run_gate",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-healthcheck-dry-run",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: applyRunGateEnv,
    }),
    /package_d_external_access_dry_run_gate_must_remain_zero/,
    "external_access_healthcheck_dry_run_requires_zero_gate",
  );
  const healthcheckDryRunPlan = await buildPackageDExternalAccessPlan({
    runId,
    evidenceDir,
    authorized: true,
    mode: "qcloud-healthcheck-dry-run",
    externalAccessEnv: requiredExternalAccessBusinessEnv,
    runGateEnv: dryRunGateEnv,
  });
  assert.equal(healthcheckDryRunPlan.contract, "production_launch_gap_08h_qcloud_healthcheck_contract_local_gate", "external_access_healthcheck_contract");
  assert.equal(healthcheckDryRunPlan.boundary.realMutationAllowedNow, false, "external_access_healthcheck_dry_run_no_real_mutation");
  assert.equal(healthcheckDryRunPlan.target.backendService, "portal-frontend-edge", "external_access_healthcheck_backend_service");
  assert.equal(healthcheckDryRunPlan.target.originClusterIpService, "portal-frontend", "external_access_healthcheck_origin_service");
  assert.equal(healthcheckDryRunPlan.target.externalSmokeUrl, "https://portal.medopl.cn/", "external_access_healthcheck_fixed_smoke_url");
  assert.equal(healthcheckDryRunPlan.healthcheckStrategy.kind, "TkeServiceConfig", "external_access_healthcheck_strategy_kind");
  assert.equal(healthcheckDryRunPlan.healthcheckStrategy.crdRequired, true, "external_access_healthcheck_crd_required");
  assert.equal(healthcheckDryRunPlan.healthcheckStrategy.failClosedWhenCrdMissing, true, "external_access_healthcheck_crd_missing_fail_closed");
  assert.equal(healthcheckDryRunPlan.healthcheckStrategy.bindingAnnotationKey, "ingress.cloud.tencent.com/tke-service-config", "external_access_healthcheck_annotation_key");
  assert.equal(healthcheckDryRunPlan.healthcheckStrategy.backend, "portal-frontend-edge:8080", "external_access_healthcheck_strategy_backend");
  assert.equal(healthcheckDryRunPlan.manifests.tkeServiceConfig.kind, "TkeServiceConfig", "external_access_healthcheck_manifest_kind");
  assert.equal(healthcheckDryRunPlan.manifests.tkeServiceConfig.metadata.name, "portal-frontend-edge-healthcheck", "external_access_healthcheck_manifest_name");
  assert.equal(healthcheckDryRunPlan.manifests.tkeServiceConfig.metadata.namespace, "medopl-platform", "external_access_healthcheck_manifest_namespace");
  assert.equal(healthcheckDryRunPlan.manifests.tkeServiceConfig.apiVersion, "cloud.tencent.com/v1alpha1", "external_access_healthcheck_manifest_api_version");
  const listener = healthcheckDryRunPlan.manifests.tkeServiceConfig.spec.loadBalancer.l7Listeners[0];
  const domain = listener.domains[0];
  const rule = domain.rules[0];
  assert.equal(listener.protocol, "HTTPS", "external_access_healthcheck_listener_protocol");
  assert.equal(listener.port, 443, "external_access_healthcheck_listener_port");
  assert.equal(domain.domain, "portal.medopl.cn", "external_access_healthcheck_domain");
  assert.equal(rule.url, "/", "external_access_healthcheck_path");
  assert.equal(rule.forwardType, "HTTP", "external_access_healthcheck_forward_type");
  assert.equal(rule.healthCheck.enable, true, "external_access_healthcheck_enabled");
  assert.equal(rule.healthCheck.httpCheckPath, "/", "external_access_healthcheck_check_path");
  assert.equal(rule.healthCheck.httpCheckDomain, "portal.medopl.cn", "external_access_healthcheck_check_domain");
  assert(["GET", "HEAD"].includes(rule.healthCheck.httpCheckMethod), "external_access_healthcheck_method");
  assert.equal(rule.healthCheck.httpCode, 6, "external_access_healthcheck_codes_2xx_3xx");
  assert.equal(rule.healthCheck.checkType, "HTTP", "external_access_healthcheck_check_type");
  assert.equal(
    healthcheckDryRunPlan.manifests.ingress.metadata.annotations["ingress.cloud.tencent.com/tke-service-config"],
    "portal-frontend-edge-healthcheck",
    "external_access_healthcheck_ingress_annotation_binding",
  );
  assert.equal(
    healthcheckDryRunPlan.manifests.ingress.spec.rules[0].http.paths[0].backend.service.name,
    "portal-frontend-edge",
    "external_access_healthcheck_ingress_backend_stays_edge",
  );
  assert.deepEqual(healthcheckDryRunPlan.allowedOperations.mutations, [
    "server-side dry-run TkeServiceConfig/portal-frontend-edge-healthcheck in medopl-platform",
    "server-side dry-run Ingress/portal-frontend health-check annotation binding in medopl-platform",
  ], "external_access_healthcheck_dry_run_mutation_boundary");
  assert(healthcheckDryRunPlan.commands.some((command) => command.name === "tke_service_config_crd_read"), "external_access_healthcheck_crd_read_command");
  assert(healthcheckDryRunPlan.commands.some((command) => command.name === "dry_run_tke_service_config"), "external_access_healthcheck_dry_run_config_command");
  assert(healthcheckDryRunPlan.commands.some((command) => command.name === "dry_run_portal_ingress_healthcheck_binding"), "external_access_healthcheck_dry_run_ingress_command");
  assert(healthcheckDryRunPlan.commands.every((command) => !command.command.includes("kubectl patch")), "external_access_healthcheck_commands_must_not_patch");
  assert(healthcheckDryRunPlan.commands.every((command) => !command.command.includes("service portal-frontend -n medopl-platform") || command.kind === "readonly"), "external_access_healthcheck_origin_service_readonly_only");
  assert.equal(healthcheckDryRunPlan.evidence.healthcheckManifestPath.endsWith("qcloud-healthcheck-redacted.json"), true, "external_access_healthcheck_evidence_manifest_path");
  assert.equal(healthcheckDryRunPlan.evidence.ingressManifestPath.endsWith("portal-ingress-redacted.json"), true, "external_access_healthcheck_ingress_evidence_path");
  assertNoQcloudHealthcheckSensitiveText(JSON.stringify(healthcheckDryRunPlan), "external_access_healthcheck_dry_run_plan");

  const healthcheckApplyPlan = await buildPackageDExternalAccessPlan({
    runId,
    evidenceDir,
    authorized: true,
    mode: "qcloud-healthcheck-apply",
    externalAccessEnv: requiredExternalAccessBusinessEnv,
    runGateEnv: applyRunGateEnv,
  });
  assert.equal(healthcheckApplyPlan.boundary.realMutationAllowedNow, true, "external_access_healthcheck_apply_real_mutation_boundary");
  assert.deepEqual(healthcheckApplyPlan.allowedOperations.mutations, [
    "apply TkeServiceConfig/portal-frontend-edge-healthcheck in medopl-platform",
    "apply Ingress/portal-frontend only for health-check annotation binding in medopl-platform",
  ], "external_access_healthcheck_apply_mutation_allowlist");
  assert(healthcheckApplyPlan.commands.some((command) => command.name === "apply_tke_service_config"), "external_access_healthcheck_apply_config_command");
  assert(healthcheckApplyPlan.commands.some((command) => command.name === "apply_portal_ingress_healthcheck_binding"), "external_access_healthcheck_apply_ingress_command");
  assert.equal(healthcheckApplyPlan.rollbackCleanupPlan.removeHealthcheckBinding, "remove only health-check annotation binding from Ingress/portal-frontend with separate authorization", "external_access_healthcheck_rollback_annotation");
  assert.equal(healthcheckApplyPlan.rollbackCleanupPlan.deleteHealthcheckConfig, "delete only TkeServiceConfig/portal-frontend-edge-healthcheck with separate authorization", "external_access_healthcheck_rollback_config");
  assert.equal(healthcheckApplyPlan.rollbackCleanupPlan.preserveSecretIngressEdgeService, true, "external_access_healthcheck_rollback_preserve_existing_resources");
  assert.equal(healthcheckApplyPlan.smokePlan.externalHttpsSmoke, "GET https://portal.medopl.cn/", "external_access_healthcheck_https_smoke_plan");
  assertNoQcloudHealthcheckSensitiveText(JSON.stringify(healthcheckApplyPlan), "external_access_healthcheck_apply_plan");

  const envPath = path.join(healthcheckEvidenceRoot, "package-d-external-access.env");
  const kubeconfigPath = path.join(healthcheckEvidenceRoot, "kubeconfig-package-d-deploy");
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
    await assert.rejects(
      () => runPackageDExternalAccessExecution({
        envPath,
        kubeconfigPath,
        evidenceDir,
        authorized: true,
        mode: "qcloud-healthcheck-apply",
        runId: "gap08h-local-crd-missing",
        commandExecutor: async ({ args }) => {
          if (args.join(" ").includes("config current-context")) return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
          if (args.join(" ").includes("get crd tkeserviceconfigs")) return { status: 1, stdout: "", stderr: "Error from server (NotFound): customresourcedefinitions.apiextensions.k8s.io \"tkeserviceconfigs.cloud.tencent.com\" not found\n" };
          return { status: 0, stdout: "ok\n", stderr: "" };
        },
      }),
      /package_d_external_access_command_failed:tke_service_config_crd_read/,
      "external_access_healthcheck_missing_crd_must_fail_before_apply",
    );
    const missingCrdEvidence = await readFile(path.join(evidenceDir, "gap08h-local-crd-missing", "real-mutation-redacted.json"), "utf8");
    assert.equal(missingCrdEvidence.includes("tke_service_config_crd_read"), true, "external_access_healthcheck_missing_crd_evidence_command");
    assert.equal(missingCrdEvidence.includes("apply_tke_service_config"), false, "external_access_healthcheck_missing_crd_must_not_apply_config");
    assertNoQcloudHealthcheckSensitiveText(missingCrdEvidence, "external_access_healthcheck_missing_crd_evidence");

    const healthcheckCommandLog = [];
    const healthcheckExecution = await runPackageDExternalAccessExecution({
      envPath,
      kubeconfigPath,
      evidenceDir,
      authorized: true,
      mode: "qcloud-healthcheck-apply",
      runId: "gap08h-local-healthcheck-apply",
      commandExecutor: async ({ args, stdin, env }) => {
        healthcheckCommandLog.push({ args, stdin });
        if (args[0] === "kubectl") assert.deepEqual(Object.keys(env).sort(), ["KUBECONFIG"], "external_access_healthcheck_kubectl_env_only_kubeconfig");
        if (args.includes("delete") || args.includes("patch") || args.includes("scale") || args.includes("rollout") || args.includes("exec")) throw new Error(`external_access_healthcheck_forbidden_fake_command:${args.join(" ")}`);
        if (args.join(" ").includes("config current-context")) return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
        if (args.join(" ").includes("get namespace medopl-platform")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"medopl-platform\"}}\n", stderr: "" };
        if (args.join(" ").includes("get service portal-frontend-edge")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend-edge\"},\"spec\":{\"type\":\"NodePort\",\"ports\":[{\"port\":8080,\"targetPort\":8080}]}}\n", stderr: "" };
        if (args.join(" ").includes("describe service portal-frontend-edge")) return { status: 0, stdout: "Name: portal-frontend-edge\nType: NodePort\n", stderr: "" };
        if (args.join(" ").includes("get service portal-frontend")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend\"},\"spec\":{\"type\":\"ClusterIP\",\"ports\":[{\"port\":8080}]}}\n", stderr: "" };
        if (args.join(" ").includes("get ingressclass qcloud")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"qcloud\"},\"spec\":{\"controller\":\"cloud.tencent.com/ingress-controller\"}}\n", stderr: "" };
        if (args.join(" ").includes("get crd tkeserviceconfigs.cloud.tencent.com")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"tkeserviceconfigs.cloud.tencent.com\"}}\n", stderr: "" };
        if (args.includes("apply")) {
          assert.equal(args[args.indexOf("-f") + 1], "-", "external_access_healthcheck_apply_and_dry_run_must_use_stdin_manifest");
          assert.equal(String(stdin || "").includes("qcloud-cert-id-must-not-leak"), false, "external_access_healthcheck_execution_must_not_send_cert_id");
          assert.equal(String(stdin || "").includes("\"name\": \"portal-frontend\"") || String(stdin || "").includes("\"name\": \"portal-frontend-edge-healthcheck\""), true, "external_access_healthcheck_execution_manifest_scope");
        }
        if (args.join(" ").includes("get tkeserviceconfig portal-frontend-edge-healthcheck")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend-edge-healthcheck\"}}\n", stderr: "" };
        if (args.join(" ").includes("describe tkeserviceconfig portal-frontend-edge-healthcheck")) return { status: 0, stdout: "Name: portal-frontend-edge-healthcheck\n", stderr: "" };
        if (args.join(" ").includes("get ingress portal-frontend")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend\"}}\n", stderr: "" };
        if (args.join(" ").includes("describe ingress portal-frontend")) return { status: 0, stdout: "Name: portal-frontend\n", stderr: "" };
        if (args[0] === "getent") return { status: 0, stdout: "203.0.113.10 portal.medopl.cn\n", stderr: "" };
        if (args[0] === "curl" && args.join(" ") === "curl --help all") return { status: 0, stdout: "Usage: curl [options...] <url>\n", stderr: "" };
        if (args[0] === "curl") {
          assert.equal(args.includes("--fail-with-body"), false, "external_access_healthcheck_execution_old_curl_must_use_fallback");
          assert.equal(args.at(-1), "https://portal.medopl.cn/", "external_access_healthcheck_execution_fallback_fixed_url");
          return { status: 0, stdout: "{\"service\":\"portal-frontend\",\"url\":\"https://portal.medopl.cn/\",\"http_code\":\"200\",\"ssl_verify_result\":\"0\",\"time_total\":\"0.123\"}\n", stderr: "" };
        }
        return { status: 0, stdout: "ok\n", stderr: "" };
      },
    });
    assert.equal(healthcheckExecution.ok, true, "external_access_healthcheck_fake_execution_must_pass");
    assert.equal(healthcheckExecution.contract, "production_launch_gap_08h_qcloud_healthcheck_execution", "external_access_healthcheck_execution_contract");
    assert.equal(healthcheckCommandLog.some((entry) => entry.args.includes("apply") && String(entry.stdin).includes("\"kind\": \"TkeServiceConfig\"")), true, "external_access_healthcheck_execution_must_apply_tke_service_config");
    assert.equal(healthcheckCommandLog.some((entry) => entry.args.includes("apply") && String(entry.stdin).includes("\"ingress.cloud.tencent.com/tke-service-config\"")), true, "external_access_healthcheck_execution_must_apply_ingress_binding");
    assert.equal(healthcheckCommandLog.some((entry) => entry.args.join(" ").includes("kubectl patch")), false, "external_access_healthcheck_execution_must_not_patch");
    const healthcheckRunEvidenceDir = path.join(evidenceDir, "gap08h-local-healthcheck-apply");
    const healthcheckManifestEvidence = JSON.parse(await readFile(path.join(healthcheckRunEvidenceDir, "qcloud-healthcheck-redacted.json"), "utf8"));
    const healthcheckIngressEvidence = JSON.parse(await readFile(path.join(healthcheckRunEvidenceDir, "portal-ingress-redacted.json"), "utf8"));
    const healthcheckExecutionEvidence = JSON.parse(await readFile(healthcheckExecution.evidencePath, "utf8"));
    assert.equal(healthcheckManifestEvidence.kind, "TkeServiceConfig", "external_access_healthcheck_manifest_evidence_kind");
    assert.equal(healthcheckManifestEvidence.spec.loadBalancer.l7Listeners[0].domains[0].domain, "portal.medopl.cn", "external_access_healthcheck_manifest_evidence_domain");
    assert.equal(healthcheckIngressEvidence.metadata.annotations["ingress.cloud.tencent.com/tke-service-config"], "portal-frontend-edge-healthcheck", "external_access_healthcheck_ingress_evidence_annotation");
    assert.equal(healthcheckIngressEvidence.spec.rules[0].http.paths[0].backend.service.name, "portal-frontend-edge", "external_access_healthcheck_ingress_evidence_backend");
    assert.equal(healthcheckExecutionEvidence.contract, "production_launch_gap_08h_qcloud_healthcheck_execution", "external_access_healthcheck_execution_evidence_contract");
    assert.equal(healthcheckExecutionEvidence.publicAccessClaimAllowedNow, false, "external_access_healthcheck_public_access_not_claimed");
    assertNoQcloudHealthcheckSensitiveText(await readFile(healthcheckExecution.evidencePath, "utf8"), "external_access_healthcheck_execution_evidence");
  } finally {
    if (previousRunGate === undefined) delete process.env.RUN_TENCENT_DEPLOY_EXECUTION;
    else process.env.RUN_TENCENT_DEPLOY_EXECUTION = previousRunGate;
  }
} finally {
  await rm(healthcheckEvidenceRoot, { recursive: true, force: true });
}
