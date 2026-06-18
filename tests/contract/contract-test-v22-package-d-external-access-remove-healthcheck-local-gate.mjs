import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_EXTERNAL_ACCESS_REMOVE_HEALTHCHECK_APPLY_COMMAND,
  PACKAGE_D_EXTERNAL_ACCESS_REMOVE_HEALTHCHECK_DRY_RUN_COMMAND,
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
const annotationKey = "ingress.cloud.tencent.com/tke-service-config";

function assertNoRemoveHealthcheckSensitiveText(text = "", label = "text") {
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
    "kubectl patch",
    "type: LoadBalancer",
    "CreateLoadBalancer",
    "CreateRecord",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-external-access-remove-healthcheck-"));
try {
  const evidenceDir = path.join(evidenceRoot, "evidence");
  const runId = "gap08l-local-gate";
  assert.equal(
    PACKAGE_D_EXTERNAL_ACCESS_REMOVE_HEALTHCHECK_DRY_RUN_COMMAND,
    "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-remove-healthcheck-annotation-dry-run --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1",
    "external_access_remove_healthcheck_dry_run_command",
  );
  assert.equal(
    PACKAGE_D_EXTERNAL_ACCESS_REMOVE_HEALTHCHECK_APPLY_COMMAND,
    "RUN_TENCENT_DEPLOY_EXECUTION=external-access node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-remove-healthcheck-annotation-apply --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id gap08l-remove-healthcheck-annotation-apply-001 --authorized 1",
    "external_access_remove_healthcheck_apply_command",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: false,
      mode: "qcloud-remove-healthcheck-annotation-dry-run",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: dryRunGateEnv,
    }),
    /package_d_external_access_not_authorized/,
    "external_access_remove_healthcheck_unauthorized_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-remove-healthcheck-annotation-apply",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: dryRunGateEnv,
    }),
    /package_d_external_access_apply_gate_not_authorized/,
    "external_access_remove_healthcheck_apply_requires_external_access_gate",
  );
  await assert.rejects(
    () => buildPackageDExternalAccessPlan({
      runId,
      evidenceDir,
      authorized: true,
      mode: "qcloud-remove-healthcheck-annotation-dry-run",
      externalAccessEnv: requiredExternalAccessBusinessEnv,
      runGateEnv: applyRunGateEnv,
    }),
    /package_d_external_access_dry_run_gate_must_remain_zero/,
    "external_access_remove_healthcheck_dry_run_requires_zero_gate",
  );

  const dryRunPlan = await buildPackageDExternalAccessPlan({
    runId,
    evidenceDir,
    authorized: true,
    mode: "qcloud-remove-healthcheck-annotation-dry-run",
    externalAccessEnv: requiredExternalAccessBusinessEnv,
    runGateEnv: dryRunGateEnv,
  });
  assert.equal(dryRunPlan.contract, "production_launch_gap_08l_qcloud_remove_healthcheck_annotation_contract_local_gate", "external_access_remove_healthcheck_contract");
  assert.equal(dryRunPlan.boundary.realMutationAllowedNow, false, "external_access_remove_healthcheck_dry_run_no_real_mutation");
  assert.equal(dryRunPlan.target.backendService, "portal-frontend-edge", "external_access_remove_healthcheck_backend_service");
  assert.equal(dryRunPlan.target.externalSmokeUrl, "https://portal.medopl.cn/", "external_access_remove_healthcheck_fixed_smoke_url");
  assert.equal(Object.hasOwn(dryRunPlan.manifests, "secret"), false, "external_access_remove_healthcheck_must_not_materialize_secret");
  assert.equal(Object.hasOwn(dryRunPlan.manifests, "edgeService"), false, "external_access_remove_healthcheck_must_not_materialize_edge_service");
  assert.equal(Object.hasOwn(dryRunPlan.manifests, "tkeServiceConfig"), false, "external_access_remove_healthcheck_must_not_materialize_tke_config");
  assert.equal(dryRunPlan.manifests.ingress.spec.rules[0].http.paths[0].backend.service.name, "portal-frontend-edge", "external_access_remove_healthcheck_ingress_backend_stays_edge");
  assert.equal(dryRunPlan.manifests.ingress.spec.tls[0].secretName, "medopl-portal-tls", "external_access_remove_healthcheck_tls_stays");
  assert.equal(Object.hasOwn(dryRunPlan.manifests.ingress.metadata.annotations, annotationKey), false, "external_access_remove_healthcheck_annotation_absent");
  assert.deepEqual(dryRunPlan.allowedOperations.mutations, [
    "server-side dry-run Ingress/portal-frontend with qcloud health-check annotation removed in medopl-platform",
  ], "external_access_remove_healthcheck_dry_run_mutation_boundary");
  assert(dryRunPlan.commands.some((command) => command.name === "dry_run_portal_ingress_remove_healthcheck_annotation"), "external_access_remove_healthcheck_dry_run_command");
  assert(dryRunPlan.commands.every((command) => !command.command.includes("kubectl patch")), "external_access_remove_healthcheck_commands_must_not_patch");
  assert(dryRunPlan.commands.every((command) => !command.command.includes("kubectl delete")), "external_access_remove_healthcheck_commands_must_not_delete");
  assert.equal(dryRunPlan.rollbackCleanupPlan.deleteHealthcheckConfig, "not_allowed_in_this_gap", "external_access_remove_healthcheck_must_not_delete_tke_config");
  assert.equal(dryRunPlan.rollbackCleanupPlan.preserveSecretIngressEdgeService, true, "external_access_remove_healthcheck_preserve_existing_resources");
  assert.equal(dryRunPlan.evidence.ingressManifestPath.endsWith("portal-ingress-redacted.json"), true, "external_access_remove_healthcheck_ingress_evidence_path");
  assert.equal(Object.hasOwn(dryRunPlan.evidence, "healthcheckManifestPath"), false, "external_access_remove_healthcheck_no_healthcheck_evidence_path");
  assertNoRemoveHealthcheckSensitiveText(JSON.stringify(dryRunPlan), "external_access_remove_healthcheck_dry_run_plan");

  const applyPlan = await buildPackageDExternalAccessPlan({
    runId,
    evidenceDir,
    authorized: true,
    mode: "qcloud-remove-healthcheck-annotation-apply",
    externalAccessEnv: requiredExternalAccessBusinessEnv,
    runGateEnv: applyRunGateEnv,
  });
  assert.equal(applyPlan.boundary.realMutationAllowedNow, true, "external_access_remove_healthcheck_apply_real_mutation_boundary");
  assert.deepEqual(applyPlan.allowedOperations.mutations, [
    "apply Ingress/portal-frontend only to remove qcloud health-check annotation in medopl-platform",
  ], "external_access_remove_healthcheck_apply_mutation_allowlist");
  assert(applyPlan.commands.some((command) => command.name === "apply_portal_ingress_remove_healthcheck_annotation"), "external_access_remove_healthcheck_apply_command");
  assert.equal(applyPlan.boundary.ingressMutationScope, "Ingress/portal-frontend remove health-check annotation only", "external_access_remove_healthcheck_ingress_scope");
  assert.equal(applyPlan.boundary.healthcheckMutationScope, "not mutated; TkeServiceConfig is preserved for separate cleanup authorization", "external_access_remove_healthcheck_tke_config_scope");
  assert.equal(applyPlan.rollbackCleanupPlan.deleteHealthcheckConfig, "not_allowed_in_this_gap", "external_access_remove_healthcheck_apply_no_tke_delete");
  assert.equal(applyPlan.smokePlan.externalHttpsSmoke, "GET https://portal.medopl.cn/", "external_access_remove_healthcheck_https_smoke_plan");
  assertNoRemoveHealthcheckSensitiveText(JSON.stringify(applyPlan), "external_access_remove_healthcheck_apply_plan");

  const envPath = path.join(evidenceRoot, "package-d-external-access.env");
  const kubeconfigPath = path.join(evidenceRoot, "kubeconfig-package-d-deploy");
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
    const commandLog = [];
    const execution = await runPackageDExternalAccessExecution({
      envPath,
      kubeconfigPath,
      evidenceDir,
      authorized: true,
      mode: "qcloud-remove-healthcheck-annotation-apply",
      runId: "gap08l-local-remove-healthcheck-apply",
      commandExecutor: async ({ args, stdin, env }) => {
        commandLog.push({ args, stdin });
        if (args[0] === "kubectl") assert.deepEqual(Object.keys(env).sort(), ["KUBECONFIG"], "external_access_remove_healthcheck_kubectl_env_only_kubeconfig");
        if (args.includes("delete") || args.includes("patch") || args.includes("scale") || args.includes("rollout") || args.includes("exec")) throw new Error(`external_access_remove_healthcheck_forbidden_fake_command:${args.join(" ")}`);
        if (args.join(" ").includes("config current-context")) return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
        if (args.join(" ").includes("get namespace medopl-platform")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"medopl-platform\"}}\n", stderr: "" };
        if (args.join(" ").includes("get service portal-frontend-edge")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend-edge\"},\"spec\":{\"type\":\"NodePort\",\"ports\":[{\"port\":8080,\"targetPort\":8080}]}}\n", stderr: "" };
        if (args.join(" ").includes("describe service portal-frontend-edge")) return { status: 0, stdout: "Name: portal-frontend-edge\nType: NodePort\n", stderr: "" };
        if (args.join(" ").includes("get service portal-frontend")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend\"},\"spec\":{\"type\":\"ClusterIP\",\"ports\":[{\"port\":8080}]}}\n", stderr: "" };
        if (args.join(" ").includes("get ingressclass qcloud")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"qcloud\"},\"spec\":{\"controller\":\"cloud.tencent.com/ingress-controller\"}}\n", stderr: "" };
        if (args.join(" ").includes("get ingress portal-frontend")) return { status: 0, stdout: "{\"metadata\":{\"name\":\"portal-frontend\"}}\n", stderr: "" };
        if (args.join(" ").includes("describe ingress portal-frontend")) return { status: 0, stdout: "Name: portal-frontend\n", stderr: "" };
        if (args.includes("apply")) {
          assert.equal(args[args.indexOf("-f") + 1], "-", "external_access_remove_healthcheck_apply_and_dry_run_must_use_stdin_manifest");
          assert.equal(String(stdin || "").includes("\"kind\": \"Secret\""), false, "external_access_remove_healthcheck_execution_must_not_apply_secret");
          assert.equal(String(stdin || "").includes("\"kind\": \"Service\""), false, "external_access_remove_healthcheck_execution_must_not_apply_service");
          assert.equal(String(stdin || "").includes("\"kind\": \"TkeServiceConfig\""), false, "external_access_remove_healthcheck_execution_must_not_apply_tke_config");
          assert.equal(String(stdin || "").includes(annotationKey), false, "external_access_remove_healthcheck_execution_must_remove_annotation");
          assert.equal(String(stdin || "").includes("qcloud-cert-id-must-not-leak"), false, "external_access_remove_healthcheck_execution_must_not_send_cert_id");
        }
        if (args[0] === "getent") return { status: 0, stdout: "203.0.113.10 portal.medopl.cn\n", stderr: "" };
        if (args[0] === "curl" && args.join(" ") === "curl --help all") return { status: 0, stdout: "Usage: curl [options...] <url>\n", stderr: "" };
        if (args[0] === "curl") {
          assert.equal(args.includes("--fail-with-body"), false, "external_access_remove_healthcheck_old_curl_must_use_fallback");
          assert.equal(args.at(-1), "https://portal.medopl.cn/", "external_access_remove_healthcheck_fixed_url");
          return { status: 0, stdout: "{\"service\":\"portal-frontend\",\"url\":\"https://portal.medopl.cn/\",\"http_code\":\"200\",\"ssl_verify_result\":\"0\",\"time_total\":\"0.123\"}\n", stderr: "" };
        }
        return { status: 0, stdout: "ok\n", stderr: "" };
      },
    });
    assert.equal(execution.ok, true, "external_access_remove_healthcheck_fake_execution_must_pass");
    assert.equal(execution.contract, "production_launch_gap_08l_qcloud_remove_healthcheck_annotation_execution", "external_access_remove_healthcheck_execution_contract");
    assert.equal(commandLog.some((entry) => entry.args.includes("apply") && String(entry.stdin).includes("\"kind\": \"Ingress\"")), true, "external_access_remove_healthcheck_execution_must_apply_ingress");
    assert.equal(commandLog.some((entry) => entry.args.includes("apply") && String(entry.stdin).includes(annotationKey)), false, "external_access_remove_healthcheck_execution_must_not_bind_annotation");
    assert.equal(commandLog.some((entry) => entry.args.join(" ").includes("kubectl delete")), false, "external_access_remove_healthcheck_execution_must_not_delete");

    const runEvidenceDir = path.join(evidenceDir, "gap08l-local-remove-healthcheck-apply");
    const ingressEvidence = JSON.parse(await readFile(path.join(runEvidenceDir, "portal-ingress-redacted.json"), "utf8"));
    const executionEvidence = JSON.parse(await readFile(execution.evidencePath, "utf8"));
    assert.equal(Object.hasOwn(ingressEvidence.metadata.annotations, annotationKey), false, "external_access_remove_healthcheck_ingress_evidence_annotation_removed");
    assert.equal(ingressEvidence.spec.rules[0].http.paths[0].backend.service.name, "portal-frontend-edge", "external_access_remove_healthcheck_ingress_evidence_backend");
    assert.equal(executionEvidence.contract, "production_launch_gap_08l_qcloud_remove_healthcheck_annotation_execution", "external_access_remove_healthcheck_execution_evidence_contract");
    assert.equal(executionEvidence.publicAccessClaimAllowedNow, false, "external_access_remove_healthcheck_public_access_not_claimed");
    assertNoRemoveHealthcheckSensitiveText(await readFile(execution.evidencePath, "utf8"), "external_access_remove_healthcheck_execution_evidence");
  } finally {
    if (previousRunGate === undefined) delete process.env.RUN_TENCENT_DEPLOY_EXECUTION;
    else process.env.RUN_TENCENT_DEPLOY_EXECUTION = previousRunGate;
  }
} finally {
  await rm(evidenceRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_d_external_access_remove_healthcheck_local_gate",
  ingressBackend: "portal-frontend-edge:8080",
  removedAnnotation: annotationKey,
}, null, 2));
