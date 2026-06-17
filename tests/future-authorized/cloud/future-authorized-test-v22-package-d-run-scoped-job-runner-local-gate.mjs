import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_RUN_SCOPED_JOB_COMMAND,
  buildPackageDRunScopedJobPlan,
  runPackageDRunScopedJobPreflight,
} from "../../support/cloud-prework/package-d-run-scoped-job-runner.js";
import {
  PACKAGE_D_SERVICE_REACHABILITY_COMMAND,
  buildPackageDServiceReachabilityPlan,
  runPackageDServiceReachabilitySmoke,
} from "../../support/cloud-prework/package-d-service-reachability-runner.js";

const kubeEnvName = ["KUBE", "CONFIG"].join("");
const runnerImageRef = "uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-fake";
const reachabilityRunId = "psr-20260617-001";
const reachabilitySmokeJobName = `medopl-service-smoke-${reachabilityRunId}`;
const serviceReachabilityEndpoints = Object.freeze([
  "http://portal-frontend.medopl-platform.svc.cluster.local:8080/",
  "http://medopl-go-backend.medopl-platform.svc.cluster.local:8080/readyz",
  "http://opl-web-gateway.medopl-platform.svc.cluster.local:8080/healthz",
  "http://opl-runtime-bridge.medopl-platform.svc.cluster.local:8080/healthz",
]);
const serviceReachabilityContainers = Object.freeze([
  "smoke-portal-frontend",
  "smoke-medopl-go-backend",
  "smoke-opl-web-gateway",
  "smoke-opl-runtime-bridge",
]);

function assertNoSensitiveText(text = "", label = "text") {
  for (const forbidden of [
    "tcr-secret-value",
    "portal-admin-password",
    "postgres-password",
    "postgresql://",
    "client-certificate-data",
    "client-key-data",
    "certificate-authority-data",
    "token:",
    "raw-kubeconfig",
    "kubectl exec",
    "kubectl apply",
    "kubectl patch",
    "kubectl scale",
    "kubectl rollout",
    "docker build",
    "docker push",
    "CreateNodePool",
    "medopl-tenant-",
    runnerImageRef,
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

function fakeKubectlExecutor(commandLog) {
  return async ({ args, env, stdin }) => {
    let stdinImage = "";
    if (stdin) {
      const parsed = JSON.parse(stdin);
      stdinImage = parsed.spec.template.spec.containers[0].image;
    }
    commandLog.push({
      args,
      env: { kubeEnvPresent: env[kubeEnvName] ? "redacted" : "" },
      stdinClass: stdin ? "present_redacted" : "empty",
      stdinImage,
    });
    const joined = args.join(" ");
    assert.equal(args[0], "kubectl", "runner_must_use_kubectl_only");
    assert.equal(joined.includes(" apply "), false, "runner_must_not_apply");
    assert.equal(joined.includes(" patch "), false, "runner_must_not_patch");
    assert.equal(joined.includes(" scale "), false, "runner_must_not_scale");
    assert.equal(joined.includes(" rollout "), false, "runner_must_not_rollout");
    if (args.includes("delete")) {
      assert.deepEqual(args, [
        "kubectl",
        "delete",
        "job",
        "medopl-platform-runner-preflight-20260615a",
        "-n",
        "medopl-platform",
        "--wait=false",
      ], "runner_must_delete_only_the_unique_run_scoped_job");
    }
    if (args.includes("create")) {
      assert.equal(args[args.indexOf("-f") + 1], "-", "job_create_must_use_stdin_manifest");
      assert.notEqual(stdin, "", "job_create_must_receive_manifest_stdin");
      assert.equal(stdinImage, runnerImageRef, "job_create_live_manifest_must_use_real_runner_image_ref");
      assert.equal(stdinImage.startsWith("REDACTED_"), false, "job_create_live_manifest_must_not_use_redacted_image_ref");
    }
    if (args.includes("current-context")) return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
    if (args.includes("namespace")) {
      return { status: 0, stdout: JSON.stringify({ metadata: { name: "medopl-platform" }, status: { phase: "Active" } }), stderr: "" };
    }
    if (args.includes("wait")) return { status: 0, stdout: "job.batch/medopl-platform-runner-preflight-20260615a condition met\n", stderr: "" };
    if (args.includes("logs")) return { status: 0, stdout: "preflight completed\n", stderr: "" };
    if (args.includes("job") && args.includes("-o")) {
      return {
        status: 0,
        stdout: JSON.stringify({
          metadata: { name: "medopl-platform-runner-preflight-20260615a", namespace: "medopl-platform" },
          status: { succeeded: 1, conditions: [{ type: "Complete", status: "True" }] },
        }),
        stderr: "",
      };
    }
    return { status: 0, stdout: "ok\n", stderr: "" };
  };
}

function fakeServiceReachabilityKubectlExecutor(commandLog, { failWait = false } = {}) {
  return async ({ args, env, stdin }) => {
    commandLog.push({
      args,
      env: { kubeEnvPresent: env[kubeEnvName] ? "redacted" : "" },
      stdinClass: stdin ? "present_redacted" : "empty",
      stdin,
    });
    const joined = args.join(" ");
    assert.equal(args[0], "kubectl", "reachability_runner_must_use_kubectl_only");
    assert.equal(joined.includes(" exec "), false, "reachability_runner_must_not_exec");
    assert.equal(joined.includes(" apply "), false, "reachability_runner_must_not_apply");
    assert.equal(joined.includes(" patch "), false, "reachability_runner_must_not_patch");
    assert.equal(joined.includes(" scale "), false, "reachability_runner_must_not_scale");
    assert.equal(joined.includes(" rollout "), false, "reachability_runner_must_not_rollout");
    if (args.includes("create")) {
      assert.deepEqual(args, ["kubectl", "create", "-f", "-"], "reachability_smoke_job_create_must_use_stdin_manifest");
      const manifest = JSON.parse(stdin);
      assert.equal(manifest.kind, "Job", "reachability_smoke_manifest_must_be_job");
      assert.equal(manifest.metadata.name, reachabilitySmokeJobName, "reachability_smoke_job_name_must_be_run_scoped");
      assert.equal(manifest.metadata.namespace, "medopl-platform", "reachability_smoke_job_namespace");
      assert.deepEqual(
        manifest.spec.template.spec.nodeSelector,
        { "node.tke.cloud.tencent.com/machineset": "np-6l4nkdto" },
        "reachability_smoke_job_must_target_platform_runner_pool",
      );
      assert.deepEqual(manifest.spec.template.spec.containers.map((container) => container.name), serviceReachabilityContainers, "reachability_smoke_job_must_use_one_container_per_endpoint");
      assert.deepEqual(manifest.spec.template.spec.containers.map((container) => container.args.at(-1)), serviceReachabilityEndpoints, "reachability_smoke_job_must_use_fixed_endpoints_only");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.command.join(" ") === "curl"), true, "reachability_smoke_job_must_use_curl_without_shell");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.args.includes("--write-out")), true, "reachability_smoke_job_must_capture_http_status");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.args.includes("--connect-timeout")), true, "reachability_smoke_job_must_use_connect_timeout");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.args.includes("--max-time")), true, "reachability_smoke_job_must_use_max_time");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.args.includes("--fail-with-body")), true, "reachability_smoke_job_must_fail_with_body");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.args.some((arg) => arg.includes("service="))), true, "reachability_smoke_job_must_emit_service_summary");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.args.some((arg) => arg.includes("exit_code="))), true, "reachability_smoke_job_must_emit_exit_code_summary");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.args.some((arg) => arg.includes("total_time="))), true, "reachability_smoke_job_must_emit_timing_summary");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.securityContext?.runAsNonRoot === true), true, "reachability_smoke_job_must_run_as_non_root");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.securityContext?.runAsUser === 1000), true, "reachability_smoke_job_must_use_numeric_non_root_user");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.securityContext?.runAsGroup === 1000), true, "reachability_smoke_job_must_use_numeric_non_root_group");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.securityContext?.allowPrivilegeEscalation === false), true, "reachability_smoke_job_must_disallow_privilege_escalation");
      assert.equal(manifest.spec.template.spec.containers.every((container) => container.securityContext?.readOnlyRootFilesystem === true), true, "reachability_smoke_job_must_use_readonly_root_filesystem");
      assert.equal(manifest.spec.template.spec.containers.every((container) => JSON.stringify(container.securityContext?.capabilities?.drop || []) === JSON.stringify(["ALL"])), true, "reachability_smoke_job_must_drop_all_capabilities");
      assert.equal(JSON.stringify(manifest).includes("medopl-tenant-"), false, "reachability_smoke_manifest_must_not_reference_tenant_pool");
    }
    if (args.includes("delete")) {
      assert.deepEqual(args, [
        "kubectl",
        "delete",
        "job",
        reachabilitySmokeJobName,
        "-n",
        "medopl-platform",
        "--ignore-not-found=true",
        "--wait=false",
      ], "reachability_runner_must_delete_only_the_unique_smoke_job");
    }
    if (args.includes("current-context")) return { status: 0, stdout: "cls-fi097sy4-context\n", stderr: "" };
    if (args.includes("namespace")) return { status: 0, stdout: JSON.stringify({ metadata: { name: "medopl-platform" } }), stderr: "" };
    if (args.includes("deployment")) {
      const serviceName = args[3];
      return {
        status: 0,
        stdout: JSON.stringify({
          metadata: { name: serviceName, namespace: "medopl-platform" },
          status: { readyReplicas: 1, replicas: 1, availableReplicas: 1 },
        }),
        stderr: "",
      };
    }
    if (args.includes("service")) {
      const serviceName = args[3];
      return {
        status: 0,
        stdout: JSON.stringify({
          metadata: { name: serviceName, namespace: "medopl-platform" },
          spec: { type: "ClusterIP", ports: [{ name: "http", port: 8080 }] },
        }),
        stderr: "",
      };
    }
    if (args.includes("pods") && !args.includes(`job-name=${reachabilitySmokeJobName}`)) {
      return { status: 0, stdout: JSON.stringify({ items: [] }), stderr: "" };
    }
    if (args.includes("wait")) {
      if (failWait) return { status: 1, stdout: "", stderr: "timed out waiting for the condition" };
      return { status: 0, stdout: `job.batch/${reachabilitySmokeJobName} condition met\n`, stderr: "" };
    }
    if (args.includes("logs")) {
      const containerName = args[args.indexOf("-c") + 1];
      assert.notEqual(serviceReachabilityContainers.indexOf(containerName), -1, "logs_must_target_allowlisted_smoke_container");
      if (failWait) {
        if (containerName === "smoke-opl-runtime-bridge") {
          return { status: 1, stdout: "", stderr: "container smoke-opl-runtime-bridge is waiting diagnostic-marker" };
        }
        return {
          status: 1,
          stdout: [
            "curl diagnostic body must be redacted",
            "service=portal-frontend",
            "url=http://portal-frontend.medopl-platform.svc.cluster.local:8080/",
            "http_code=000",
            "exit_code=28",
            "total_time=10.001",
            "error_class=timeout_or_connection_failed",
            "",
          ].join("\n"),
          stderr: "curl: (28) Operation timed out after 10001 milliseconds diagnostic-marker",
        };
      }
      return {
        status: 0,
        stdout: [
          "portal-secret-like-body",
          "service=portal-frontend",
          "url=http://portal-frontend.medopl-platform.svc.cluster.local:8080/",
          "http_code=200",
          "exit_code=0",
          "total_time=0.123",
          "error_class=",
          "",
        ].join("\n"),
        stderr: "",
      };
    }
    if (args.join(" ") === `kubectl get job ${reachabilitySmokeJobName} -n medopl-platform -o json`) {
      return {
        status: 0,
        stdout: JSON.stringify({
          metadata: { name: reachabilitySmokeJobName, namespace: "medopl-platform" },
          status: {
            active: 1,
            succeeded: 0,
            failed: 0,
            conditions: [{ type: "Complete", status: "False", reason: "DeadlineExceeded", message: "timed out diagnostic-marker" }],
          },
        }),
        stderr: "",
      };
    }
    if (args.join(" ") === `kubectl describe job ${reachabilitySmokeJobName} -n medopl-platform`) {
      return {
        status: 0,
        stdout: [
          `Name: ${reachabilitySmokeJobName}`,
          "Namespace: medopl-platform",
          "Pods Statuses: 0 Active / 0 Succeeded / 1 Failed",
          "Events:",
          "  Warning Failed diagnostic-marker",
          "",
        ].join("\n"),
        stderr: "",
      };
    }
    if (args.join(" ") === `kubectl get pods -n medopl-platform -l job-name=${reachabilitySmokeJobName} -o json`) {
      return {
        status: 0,
        stdout: JSON.stringify({
          items: [{
            metadata: { name: `${reachabilitySmokeJobName}-abcde`, namespace: "medopl-platform" },
            status: {
              phase: "Pending",
              reason: "ContainersNotReady",
              message: "containers with unready status diagnostic-marker",
              nodeName: "node-10-66-0-42",
              hostIP: "10.66.0.42",
              containerStatuses: [
                {
                  name: "smoke-portal-frontend",
                  image: "curlimages/curl:8.8.0",
                  ready: false,
                  restartCount: 0,
                  state: { waiting: { reason: "ImagePullBackOff", message: "pull backoff diagnostic-marker" } },
                  lastState: { terminated: { reason: "Error", exitCode: 125, message: "previous pull failed diagnostic-marker", startedAt: "2026-06-17T00:01:00Z", finishedAt: "2026-06-17T00:01:02Z" } },
                },
                {
                  name: "smoke-medopl-go-backend",
                  image: "curlimages/curl:8.8.0",
                  ready: false,
                  restartCount: 1,
                  state: { terminated: { reason: "Error", exitCode: 7, message: "curl failed diagnostic-marker", startedAt: "2026-06-17T00:02:00Z", finishedAt: "2026-06-17T00:02:03Z" } },
                  lastState: { waiting: { reason: "ContainerCreating", message: "container creating diagnostic-marker" } },
                },
                {
                  name: "smoke-opl-web-gateway",
                  image: "curlimages/curl:8.8.0",
                  ready: false,
                  restartCount: 0,
                  state: { running: { startedAt: "2026-06-17T00:03:00Z" } },
                  lastState: {},
                },
              ],
            },
          }],
        }),
        stderr: "",
      };
    }
    if (args.join(" ") === `kubectl get events -n medopl-platform --field-selector involvedObject.name=${reachabilitySmokeJobName} -o json`) {
      return {
        status: 0,
        stdout: JSON.stringify({
          items: [{
            type: "Normal",
            reason: "SuccessfulCreate",
            involvedObject: { kind: "Job", name: reachabilitySmokeJobName },
            message: "Created pod diagnostic-marker",
            count: 1,
            firstTimestamp: "2026-06-17T00:00:01Z",
            lastTimestamp: "2026-06-17T00:00:01Z",
          }],
        }),
        stderr: "",
      };
    }
    if (args.join(" ") === `kubectl get events -n medopl-platform --field-selector involvedObject.name=${reachabilitySmokeJobName}-abcde -o json`) {
      return {
        status: 0,
        stdout: JSON.stringify({
          items: [{
            type: "Warning",
            reason: "Failed",
            involvedObject: { kind: "Pod", name: `${reachabilitySmokeJobName}-abcde` },
            message: "Failed to pull image curlimages/curl:8.8.0 due to diagnostic-marker",
            count: 2,
            firstTimestamp: "2026-06-17T00:00:02Z",
            lastTimestamp: "2026-06-17T00:00:05Z",
          }],
        }),
        stderr: "",
      };
    }
    return { status: 0, stdout: "ok\n", stderr: "" };
  };
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-run-scoped-job-"));
try {
  const deployEnvPath = path.join(tmp, "package-d-deploy.env");
  const runtimeEnvPath = path.join(tmp, "portal-runtime.env");
  const kubeconfigPath = path.join(tmp, "kubeconfig-package-d-deploy");
  const evidenceDir = path.join(tmp, "evidence");
  const runId = "20260615a";

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    `PACKAGE_D_RUNNER_IMAGE_REF=${runnerImageRef}`,
    "",
  ].join("\n"));
  await writeFile(runtimeEnvPath, [
    "PORTAL_ADMIN_EMAIL=admin@example.invalid",
    "PORTAL_ADMIN_NAME=MedOPL Admin",
    "PORTAL_ADMIN_PASSWORD=portal-admin-password",
    "PORTAL_POSTGRES_URL=postgresql://medopl:postgres-password@10.66.0.21:5432/medopl",
    "PORTAL_POSTGRES_PASSWORD=postgres-password",
    "",
  ].join("\n"));
  await writeFile(kubeconfigPath, [
    "apiVersion: v1",
    "kind: Config",
    "current-context: cls-fi097sy4-context",
    "clusters:",
    "- name: cls-fi097sy4",
    "  cluster:",
    "    server: https://redacted-kubernetes-api.example.invalid",
    "contexts:",
    "- name: cls-fi097sy4-context",
    "  context:",
    "    cluster: cls-fi097sy4",
    "    user: redacted-user",
    "users:",
    "- name: redacted-user",
    "  user:",
    "    username: redacted-user",
    "",
  ].join("\n"));

  assert.equal(
    PACKAGE_D_RUN_SCOPED_JOB_COMMAND,
    "node tests/support/cloud-prework/package-d-run-scoped-job-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --mode preflight-job",
    "runner_must_publish_single_cloud_command",
  );

  await assert.rejects(
    () => buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir }),
    /package_d_run_scoped_job_runid_required/,
    "missing_runid_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, runId: "bad/runid" }),
    /package_d_run_scoped_job_runid_invalid/,
    "invalid_runid_must_fail_closed",
  );
  await assert.rejects(
    () => runPackageDRunScopedJobPreflight({
      deployEnvPath,
      runtimeEnvPath,
      kubeconfigPath: path.join(tmp, "missing-kubeconfig"),
      evidenceDir,
      runId,
      kubectl: fakeKubectlExecutor([]),
    }),
    /package_d_kubeconfig_missing/,
    "missing_kubeconfig_must_fail_closed",
  );

  const plan = await buildPackageDRunScopedJobPlan({
    deployEnvPath,
    runtimeEnvPath,
    kubeconfigPath,
    evidenceDir,
    runId,
  });
  assert.equal(plan.ok, true, "plan_ok");
  assert.equal(plan.mode, "preflight-job", "mode_must_be_preflight_job");
  assert.equal(plan.jobName, "medopl-platform-runner-preflight-20260615a", "job_name_must_be_run_scoped");
  assert.equal(plan.target.clusterId, "cls-fi097sy4", "target_cluster_fixed");
  assert.equal(plan.target.namespace, "medopl-platform", "target_namespace_fixed");
  assert.equal(plan.target.platformNodePoolId, "np-6l4nkdto", "target_platform_runner_pool_fixed");
  assert.equal(plan.boundary.runTencentDeployExecution, "0", "deploy_gate_must_stay_zero");
  assert.equal(plan.boundary.realDeployAllowed, false, "real_deploy_must_be_forbidden");
  assert.equal(plan.boundary.buildPushAllowed, false, "build_push_must_be_forbidden");
  assert.equal(plan.boundary.tencentMutationAllowed, false, "tencent_mutation_must_be_forbidden");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "package_c_live_must_be_forbidden");
  assert.equal(plan.boundary.platformPoolModificationAllowed, false, "platform_pool_modification_must_be_forbidden");
  assert.equal(plan.cleanupPolicy, "delete-on-success-retain-on-failure", "cleanup_policy_must_be_fixed_default");

  assert.equal(plan.jobManifest.kind, "Job", "manifest_must_be_job");
  assert.equal(plan.jobManifest.metadata.name, plan.jobName, "manifest_name_must_match_unique_job_name");
  assert.equal(plan.jobManifest.metadata.namespace, "medopl-platform", "manifest_namespace_must_be_fixed");
  assert.equal(plan.jobManifest.spec.template.spec.serviceAccountName, "medopl-platform-runner", "service_account_must_be_fixed");
  assert.deepEqual(
    plan.jobManifest.spec.template.spec.nodeSelector,
    { "node.tke.cloud.tencent.com/machineset": "np-6l4nkdto" },
    "job_must_target_tke_machineset_selector",
  );
  assert.notEqual(
    plan.jobManifest.spec.template.spec.nodeSelector["node.tke.cloud.tencent.com/machineset"],
    "np-cbk784r8",
    "job_must_not_schedule_to_legacy_platform_pool",
  );
  assert.equal(
    Object.hasOwn(plan.jobManifest.spec.template.spec.nodeSelector, "medopl.io/nodepool-role"),
    false,
    "job_must_not_require_custom_platform_service_label",
  );
  assert.deepEqual(plan.jobManifest.spec.template.spec.containers[0].args, ["preflight"], "job_command_must_be_preflight_only");
  assert.equal(
    plan.jobManifest.spec.template.spec.containers[0].image,
    "REDACTED_PACKAGE_D_RUNNER_IMAGE_REF",
    "public_plan_manifest_must_redact_runner_image_ref",
  );
  assert.deepEqual(plan.jobManifest.spec.template.spec.containers[0].envFrom, [
    { configMapRef: { name: "medopl-package-d-runner-config" } },
    { secretRef: { name: "medopl-package-d-deploy-env" } },
    { secretRef: { name: "medopl-portal-runtime-env" } },
  ], "job_must_use_configmap_and_secret_refs");
  const env = Object.fromEntries(plan.jobManifest.spec.template.spec.containers[0].env.map((item) => [item.name, item.value]));
  assert.equal(env.RUN_SCOPED_JOB_ID, runId, "job_must_record_runid");
  assert.equal(env.EXPECTED_NAMESPACE, "medopl-platform", "job_must_record_expected_namespace");
  assert.equal(env.EXPECTED_SERVICE_ACCOUNT, "medopl-platform-runner", "job_must_record_expected_service_account");
  assert.equal(env.TARGET_PLATFORM_NODE_POOL_ID, "np-6l4nkdto", "job_must_record_runner_pool");
  assert.equal(env.POSTGRES_ENDPOINT, "10.66.0.21:5432", "job_must_record_vpc_postgres_endpoint");
  assert.equal(env.PACKAGE_D_RUNNER_COMMAND, "preflight", "job_must_force_preflight_command");
  assertNoSensitiveText(JSON.stringify(plan), "plan");

  assert.deepEqual(plan.preflightChecks, [
    "in_cluster_identity_namespace_service_account_sanity",
    "postgres_10_66_0_21_5432_connectivity_smoke",
    "package_d_secretref_env_availability_smoke",
    "tcr_imagepullsecret_image_pull_readiness_shape",
    "evidence_redaction_audit",
  ], "preflight_check_list_must_match_contract");
  assert.equal(plan.commands.filter((command) => command.kind === "job_create").length, 1, "single_job_create_command");
  assert.equal(plan.commands.some((command) => command.args.includes("apply")), false, "runner_must_not_apply_job");
  assert.equal(plan.commands.some((command) => command.args.includes("patch")), false, "runner_must_not_patch_job");
  assert.equal(plan.commands.some((command) => command.args.includes("scale")), false, "runner_must_not_scale_job");
  assert.equal(plan.commands.find((command) => command.kind === "job_cleanup").args.includes(plan.jobName), true, "cleanup_must_target_unique_job");

  const commandLog = [];
  const summary = await runPackageDRunScopedJobPreflight({
    deployEnvPath,
    runtimeEnvPath,
    kubeconfigPath,
    evidenceDir,
    runId,
    kubectl: fakeKubectlExecutor(commandLog),
  });
  assert.equal(summary.ok, true, "summary_ok");
  assert.equal(summary.realExecutionReady, false, "real_execution_ready_must_remain_false");
  assert.equal(summary.jobName, plan.jobName, "summary_job_name");
  assert.equal(summary.jobCreate, "created", "job_create_must_run");
  assert.equal(summary.jobObserved, "complete", "job_must_be_observed_complete");
  assert.equal(summary.cleanup, "deleted_on_success", "successful_job_must_be_cleaned_by_default_policy");
  assert.equal(summary.evidencePath.endsWith("preflight-job-redacted.json"), true, "evidence_path");
  assert.equal(commandLog.some((entry) => entry.args.includes("create")), true, "runner_must_create_unique_job");
  assert.equal(commandLog.some((entry) => entry.args.includes("wait")), true, "runner_must_observe_job");
  assert.equal(commandLog.some((entry) => entry.args.includes("logs")), true, "runner_must_collect_redacted_logs_class");
  assert.equal(commandLog.some((entry) => entry.args.includes("delete")), true, "runner_must_cleanup_unique_successful_job");
  assert.equal(commandLog.every((entry) => entry.env.kubeEnvPresent === "redacted"), true, "kubeconfig_env_must_be_passed_but_not_exposed");
  assert.equal(commandLog.every((entry) => entry.stdinClass !== "present_redacted" || entry.args.includes("create")), true, "stdin_must_only_feed_create");
  assert.equal(
    commandLog.find((entry) => entry.args.includes("create")).stdinImage,
    runnerImageRef,
    "live_create_stdin_must_use_real_runner_image_ref",
  );
  assertNoSensitiveText(JSON.stringify(summary), "summary");

  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.ok, true, "evidence_ok");
  assert.equal(evidence.redactionAudit.tcrSecretExposed, false, "evidence_must_hide_tcr_secret");
  assert.equal(evidence.redactionAudit.portalAdminPasswordExposed, false, "evidence_must_hide_portal_password");
  assert.equal(evidence.redactionAudit.portalPostgresPasswordExposed, false, "evidence_must_hide_postgres_password");
  assert.equal(evidence.redactionAudit.kubeconfigSecretExposed, false, "evidence_must_hide_kubeconfig");
  assert.equal(evidence.commands.some((command) => command.command.includes("delete job medopl-platform-runner-preflight-20260615a")), true, "evidence_must_show_scoped_cleanup");
  assertNoSensitiveText(JSON.stringify(evidence), "evidence");

  const manifest = JSON.parse(await readFile(summary.redactedManifestPath, "utf8"));
  assert.equal(manifest.metadata.name, plan.jobName, "redacted_manifest_job_name");
  assert.equal(manifest.spec.template.spec.containers[0].image, "REDACTED_PACKAGE_D_RUNNER_IMAGE_REF", "redacted_manifest_must_hide_runner_image_ref");
  assertNoSensitiveText(JSON.stringify(manifest), "redacted_manifest");

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    "",
  ].join("\n"));
  await assert.rejects(
    () => buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, runId }),
    /package_d_env_missing:PACKAGE_D_RUNNER_IMAGE_REF|package_d_runner_image_ref_missing/,
    "missing_runner_image_ref_must_fail_closed",
  );

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    "PACKAGE_D_RUNNER_IMAGE_REF=REDACTED_PACKAGE_D_RUNNER_IMAGE_REF",
    "",
  ].join("\n"));
  await assert.rejects(
    () => buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, runId }),
    /package_d_runner_image_ref_redacted_value_forbidden|package_d_runner_image_ref_malformed/,
    "redacted_runner_image_ref_must_fail_closed",
  );

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    "PACKAGE_D_RUNNER_IMAGE_REF=bad image",
    "",
  ].join("\n"));
  await assert.rejects(
    () => buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, runId }),
    /package_d_runner_image_ref_malformed/,
    "malformed_runner_image_ref_must_fail_closed",
  );

  for (const forbiddenArg of ["--deploy", "--build", "--push", "--tencent-mutation", "--package-c-live", "--patch", "--scale", "--apply"]) {
    await assert.rejects(
      () => buildPackageDRunScopedJobPlan({
        deployEnvPath,
        runtimeEnvPath,
        kubeconfigPath,
        evidenceDir,
        runId,
        argv: [forbiddenArg],
      }),
      /package_d_run_scoped_job_forbidden_arg/,
      `runner_must_reject:${forbiddenArg}`,
    );
  }

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    `TENCENT_DEPLOY_KUBECONFIG_REF=${kubeconfigPath}`,
    `PACKAGE_D_RUNNER_IMAGE_REF=${runnerImageRef}`,
    "",
  ].join("\n"));

  assert.equal(
    PACKAGE_D_SERVICE_REACHABILITY_COMMAND,
    "node tests/support/cloud-prework/package-d-service-reachability-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --mode in-cluster-http-smoke --authorized 1",
    "reachability_runner_must_publish_single_cloud_command",
  );
  await assert.rejects(
    () => buildPackageDServiceReachabilityPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceRoot: evidenceDir, runId: reachabilityRunId, authorized: false }),
    /package_d_service_reachability_not_authorized/,
    "reachability_missing_authorization_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDServiceReachabilityPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceRoot: evidenceDir, runId: "", authorized: true }),
    /package_d_service_reachability_run_id_required/,
    "reachability_missing_run_id_must_fail_closed",
  );
  await assert.rejects(
    () => buildPackageDServiceReachabilityPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceRoot: evidenceDir, runId: "bad/runid", authorized: true }),
    /package_d_service_reachability_run_id_invalid/,
    "reachability_invalid_run_id_must_fail_closed",
  );
  await assert.rejects(
    () => runPackageDServiceReachabilitySmoke({
      deployEnvPath,
      runtimeEnvPath,
      kubeconfigPath: path.join(tmp, "missing-kubeconfig"),
      evidenceRoot: evidenceDir,
      runId: reachabilityRunId,
      authorized: true,
      kubectlExecutor: fakeServiceReachabilityKubectlExecutor([]),
    }),
    /package_d_kubeconfig_missing/,
    "reachability_missing_kubeconfig_must_fail_closed",
  );

  const reachabilityPlan = await buildPackageDServiceReachabilityPlan({
    deployEnvPath,
    runtimeEnvPath,
    kubeconfigPath,
    evidenceRoot: evidenceDir,
    runId: reachabilityRunId,
    authorized: true,
  });
  assert.equal(reachabilityPlan.ok, true, "reachability_plan_ok");
  assert.equal(reachabilityPlan.mode, "in-cluster-http-smoke", "reachability_mode_must_be_in_cluster_http_smoke");
  assert.equal(reachabilityPlan.target.clusterId, "cls-fi097sy4", "reachability_cluster_fixed");
  assert.equal(reachabilityPlan.target.namespace, "medopl-platform", "reachability_namespace_fixed");
  assert.equal(reachabilityPlan.target.platformNodePoolId, "np-6l4nkdto", "reachability_runner_pool_fixed");
  assert.equal(reachabilityPlan.smokeJob.name, reachabilitySmokeJobName, "reachability_smoke_job_name_run_scoped");
  assert.equal(reachabilityPlan.smokeJob.cleanupPolicy, "delete-always-after-log-collection", "reachability_cleanup_policy_required");
  assert.deepEqual(reachabilityPlan.endpoints.map((endpoint) => endpoint.url), serviceReachabilityEndpoints, "reachability_service_endpoints_must_be_fixed");
  assert.equal(reachabilityPlan.boundary.runTencentDeployExecution, "0", "reachability_run_gate_must_stay_zero");
  assert.equal(reachabilityPlan.boundary.productionDeployAllowed, false, "reachability_production_deploy_must_be_forbidden");
  assert.equal(reachabilityPlan.boundary.rollbackAllowed, false, "reachability_rollback_must_be_forbidden");
  assert.equal(reachabilityPlan.boundary.buildPushAllowed, false, "reachability_build_push_must_be_forbidden");
  assert.equal(reachabilityPlan.boundary.tencentMutationAllowed, false, "reachability_tencent_mutation_must_be_forbidden");
  assert.equal(reachabilityPlan.boundary.packageCLiveAllowed, false, "reachability_package_c_live_must_be_forbidden");
  assert.equal(reachabilityPlan.boundary.arbitraryUrlAllowed, false, "reachability_arbitrary_url_must_be_forbidden");
  assert.equal(reachabilityPlan.boundary.kubectlExecAllowed, false, "reachability_kubectl_exec_must_be_forbidden");
  assert.equal(reachabilityPlan.commands.filter((command) => command.kind === "smoke_job_create").length, 1, "reachability_single_smoke_job_create_command");
  assert.equal(reachabilityPlan.commands.some((command) => command.args.includes("exec")), false, "reachability_plan_must_not_exec");
  assert.equal(reachabilityPlan.commands.some((command) => command.args.includes("apply")), false, "reachability_plan_must_not_apply");
  assert.equal(reachabilityPlan.commands.some((command) => command.args.includes("rollout")), false, "reachability_plan_must_not_rollout");
  assert.equal(reachabilityPlan.commands.some((command) => command.args.includes("patch")), false, "reachability_plan_must_not_patch");
  assert.equal(reachabilityPlan.commands.some((command) => command.args.includes("scale")), false, "reachability_plan_must_not_scale");
  assert.equal(reachabilityPlan.smokeJob.manifest.kind, "Job", "reachability_smoke_manifest_must_be_job");
  assert.equal(reachabilityPlan.smokeJob.manifest.metadata.name, reachabilityPlan.smokeJob.name, "reachability_manifest_name_must_match_run_scoped_name");
  assert.deepEqual(
    reachabilityPlan.smokeJob.manifest.spec.template.spec.nodeSelector,
    { "node.tke.cloud.tencent.com/machineset": "np-6l4nkdto" },
    "reachability_smoke_manifest_must_target_runner_pool",
  );
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.restartPolicy, "Never", "reachability_smoke_job_restart_policy");
  assert.deepEqual(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.map((container) => container.name), serviceReachabilityContainers, "reachability_smoke_manifest_container_names");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.image.startsWith("curlimages/curl:")), true, "reachability_smoke_image_must_be_fixed_curl_image");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.image !== "curlimages/curl:latest"), true, "reachability_smoke_image_must_not_use_latest");
  assert.deepEqual(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.map((container) => container.args.at(-1)), serviceReachabilityEndpoints, "reachability_smoke_container_args_must_be_fixed_endpoints");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.command.join(" ") === "curl"), true, "reachability_smoke_container_must_not_use_shell");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.args.includes("--connect-timeout")), true, "reachability_smoke_container_must_use_connect_timeout");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.args.includes("--max-time")), true, "reachability_smoke_container_must_use_max_time");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.args.includes("--fail-with-body")), true, "reachability_smoke_container_must_fail_fast_with_body");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.args.some((arg) => arg.includes("exit_code="))), true, "reachability_smoke_container_must_emit_exit_code");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.args.some((arg) => arg.includes("total_time="))), true, "reachability_smoke_container_must_emit_total_time");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.securityContext?.runAsNonRoot === true), true, "reachability_smoke_container_must_run_as_non_root");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.securityContext?.runAsUser === 1000), true, "reachability_smoke_container_must_use_numeric_non_root_user");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.securityContext?.runAsGroup === 1000), true, "reachability_smoke_container_must_use_numeric_non_root_group");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.securityContext?.allowPrivilegeEscalation === false), true, "reachability_smoke_container_must_disallow_privilege_escalation");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => container.securityContext?.readOnlyRootFilesystem === true), true, "reachability_smoke_container_must_use_readonly_root_filesystem");
  assert.equal(reachabilityPlan.smokeJob.manifest.spec.template.spec.containers.every((container) => JSON.stringify(container.securityContext?.capabilities?.drop || []) === JSON.stringify(["ALL"])), true, "reachability_smoke_container_must_drop_all_capabilities");
  assertNoSensitiveText(JSON.stringify(reachabilityPlan), "reachability_plan");

  const reachabilityCommandLog = [];
  const reachabilitySummary = await runPackageDServiceReachabilitySmoke({
    deployEnvPath,
    runtimeEnvPath,
    kubeconfigPath,
    evidenceRoot: evidenceDir,
    runId: reachabilityRunId,
    authorized: true,
    kubectlExecutor: fakeServiceReachabilityKubectlExecutor(reachabilityCommandLog),
  });
  assert.equal(reachabilitySummary.ok, true, "reachability_summary_ok");
  assert.equal(reachabilitySummary.reachabilityPassed, true, "reachability_must_pass");
  assert.equal(reachabilitySummary.cleanup, "deleted_after_log_collection", "reachability_smoke_job_must_be_cleaned_after_log_collection");
  assert.equal(reachabilitySummary.evidencePath.endsWith("readonly-service-reachability-redacted.json"), true, "reachability_evidence_path");
  assert.equal(reachabilityCommandLog.some((entry) => entry.args.includes("create")), true, "reachability_runner_must_create_temp_smoke_job");
  assert.equal(reachabilityCommandLog.some((entry) => entry.args.includes("logs")), true, "reachability_runner_must_collect_logs");
  assert.equal(reachabilityCommandLog.some((entry) => entry.args.includes("delete")), true, "reachability_runner_must_cleanup_temp_smoke_job");
  assert.equal(reachabilityCommandLog.every((entry) => entry.env.kubeEnvPresent === "redacted"), true, "reachability_kubeconfig_env_must_be_passed_but_not_exposed");
  assertNoSensitiveText(JSON.stringify(reachabilitySummary), "reachability_summary");

  const reachabilityEvidence = JSON.parse(await readFile(reachabilitySummary.evidencePath, "utf8"));
  assert.equal(reachabilityEvidence.ok, true, "reachability_evidence_ok");
  assert.equal(reachabilityEvidence.serviceResults.length, 4, "reachability_evidence_must_record_four_service_results");
  assert.equal(reachabilityEvidence.serviceResults.every((result) => result.httpStatus === 200), true, "reachability_all_service_statuses_must_be_200");
  assert.equal(reachabilityEvidence.serviceResults.every((result) => result.exitCode === 0), true, "reachability_all_service_exit_codes_must_be_zero");
  assert.equal(reachabilityEvidence.serviceResults.every((result) => result.totalTimeClass === "present_redacted"), true, "reachability_all_service_timings_must_be_summarized");
  assert.equal(reachabilityEvidence.serviceResults.every((result) => result.bodySummaryClass === "present_redacted"), true, "reachability_body_must_be_summarized_not_dumped");
  assert.equal(JSON.stringify(reachabilityEvidence).includes("portal-secret-like-body"), false, "reachability_evidence_must_not_dump_http_body");
  assert.equal(reachabilityEvidence.redactionAudit.tcrSecretExposed, false, "reachability_evidence_must_hide_tcr_secret");
  assert.equal(reachabilityEvidence.redactionAudit.portalAdminPasswordExposed, false, "reachability_evidence_must_hide_portal_password");
  assert.equal(reachabilityEvidence.redactionAudit.portalPostgresPasswordExposed, false, "reachability_evidence_must_hide_postgres_password");
  assert.equal(reachabilityEvidence.redactionAudit.kubeconfigSecretExposed, false, "reachability_evidence_must_hide_kubeconfig");
  assertNoSensitiveText(JSON.stringify(reachabilityEvidence), "reachability_evidence");

  for (const forbiddenArg of ["--deploy", "--rollback", "--build", "--push", "--tencent-mutation", "--package-c-live", "--exec", "--apply", "--patch", "--scale"]) {
    await assert.rejects(
      () => buildPackageDServiceReachabilityPlan({
        deployEnvPath,
        runtimeEnvPath,
        kubeconfigPath,
        evidenceRoot: evidenceDir,
        runId: reachabilityRunId,
        authorized: true,
        argv: [forbiddenArg],
      }),
      /package_d_service_reachability_forbidden_arg/,
      `reachability_runner_must_reject:${forbiddenArg}`,
    );
  }

  const reachabilityFailureCommandLog = [];
  await assert.rejects(
    () => runPackageDServiceReachabilitySmoke({
      deployEnvPath,
      runtimeEnvPath,
      kubeconfigPath,
      evidenceRoot: evidenceDir,
      runId: reachabilityRunId,
      authorized: true,
      kubectlExecutor: fakeServiceReachabilityKubectlExecutor(reachabilityFailureCommandLog, { failWait: true }),
    }),
    /package_d_service_reachability_failed:smoke_job_wait_complete/,
    "reachability_failure_after_job_create_must_fail_closed",
  );
  assert.equal(
    reachabilityFailureCommandLog.some((entry) => entry.args.join(" ") === `kubectl delete job ${reachabilitySmokeJobName} -n medopl-platform --ignore-not-found=true --wait=false`),
    true,
    "reachability_failure_after_job_create_must_cleanup_unique_smoke_job",
  );
  const diagnosticsPath = path.join(evidenceDir, reachabilityRunId, "diagnostics-redacted.json");
  const diagnostics = JSON.parse(await readFile(diagnosticsPath, "utf8"));
  assert.equal(diagnostics.contract, "package_d_service_reachability_wait_failure_diagnostics", "diagnostics_contract");
  assert.equal(diagnostics.failedStep, "smoke_job_wait_complete", "diagnostics_failed_step");
  assert.equal(diagnostics.job.name, reachabilitySmokeJobName, "diagnostics_job_name");
  assert.equal(diagnostics.job.get.status.active, 1, "diagnostics_job_get_must_summarize_status");
  assert.equal(diagnostics.job.get.status.conditions[0].reason, "DeadlineExceeded", "diagnostics_job_condition_reason");
  assert.equal(diagnostics.job.get.status.conditions[0].messageSummary.includes("diagnostic-marker"), true, "diagnostics_job_condition_message_must_keep_redacted_key_text");
  assert.equal(diagnostics.job.describe.stdoutClass, "present_redacted", "diagnostics_job_describe_must_be_summarized");
  assert.equal(diagnostics.pods.items[0].phase, "Pending", "diagnostics_pod_phase");
  assert.equal(diagnostics.pods.items[0].reason, "ContainersNotReady", "diagnostics_pod_reason");
  assert.equal(diagnostics.pods.items[0].messageSummary.includes("diagnostic-marker"), true, "diagnostics_pod_message_must_keep_redacted_key_text");
  assert.equal(diagnostics.pods.items[0].nodeName, "node-10-66-0-42", "diagnostics_node_name");
  assert.equal(diagnostics.pods.items[0].hostIP, "10.66.0.42", "diagnostics_host_ip");
  assert.equal(diagnostics.pods.items[0].containerStatuses[0].image, "curlimages/curl:8.8.0", "diagnostics_container_image");
  assert.equal(diagnostics.pods.items[0].containerStatuses[0].ready, false, "diagnostics_container_ready");
  assert.equal(diagnostics.pods.items[0].containerStatuses[0].restartCount, 0, "diagnostics_container_restart_count");
  assert.equal(diagnostics.pods.items[0].containerStatuses[0].waitingReason, "ImagePullBackOff", "diagnostics_waiting_reason");
  assert.equal(diagnostics.pods.items[0].containerStatuses[0].state.waiting.reason, "ImagePullBackOff", "diagnostics_waiting_state_reason");
  assert.equal(diagnostics.pods.items[0].containerStatuses[0].state.waiting.messageSummary.includes("diagnostic-marker"), true, "diagnostics_waiting_state_message");
  assert.equal(diagnostics.pods.items[0].containerStatuses[0].imagePullStatus, "ImagePullBackOff", "diagnostics_image_pull_status");
  assert.equal(diagnostics.pods.items[0].containerStatuses[1].terminatedReason, "Error", "diagnostics_terminated_reason");
  assert.equal(diagnostics.pods.items[0].containerStatuses[1].exitCode, 7, "diagnostics_exit_code");
  assert.equal(diagnostics.pods.items[0].containerStatuses[1].state.terminated.messageSummary.includes("diagnostic-marker"), true, "diagnostics_terminated_message");
  assert.equal(diagnostics.pods.items[0].containerStatuses[1].state.terminated.startedAt, "2026-06-17T00:02:00Z", "diagnostics_terminated_started_at");
  assert.equal(diagnostics.pods.items[0].containerStatuses[1].state.terminated.finishedAt, "2026-06-17T00:02:03Z", "diagnostics_terminated_finished_at");
  assert.equal(diagnostics.pods.items[0].containerStatuses[2].state.running.startedAt, "2026-06-17T00:03:00Z", "diagnostics_running_started_at");
  assert.equal(diagnostics.pods.items[0].containerStatuses[0].lastState.terminated.exitCode, 125, "diagnostics_last_state_exit_code");
  assert.equal(diagnostics.pods.items[0].containerStatuses[1].lastState.waiting.reason, "ContainerCreating", "diagnostics_last_state_waiting_reason");
  assert.equal(diagnostics.events.job.items[0].reason, "SuccessfulCreate", "diagnostics_job_events");
  assert.equal(diagnostics.events.job.items[0].messageSummary.includes("diagnostic-marker"), true, "diagnostics_job_event_message_must_keep_key_text");
  assert.equal(diagnostics.events.job.items[0].count, 1, "diagnostics_job_event_count");
  assert.equal(diagnostics.events.job.items[0].firstTimestamp, "2026-06-17T00:00:01Z", "diagnostics_job_event_first_timestamp");
  assert.equal(diagnostics.events.job.items[0].lastTimestamp, "2026-06-17T00:00:01Z", "diagnostics_job_event_last_timestamp");
  assert.equal(diagnostics.events.pods[0].items[0].reason, "Failed", "diagnostics_pod_events");
  assert.equal(diagnostics.events.pods[0].items[0].messageSummary.includes("diagnostic-marker"), true, "diagnostics_pod_event_message_must_keep_key_text");
  assert.equal(diagnostics.events.pods[0].items[0].count, 2, "diagnostics_pod_event_count");
  assert.equal(diagnostics.events.pods[0].items[0].lastTimestamp, "2026-06-17T00:00:05Z", "diagnostics_pod_event_last_timestamp");
  assert.equal(diagnostics.logs.length, serviceReachabilityContainers.length, "diagnostics_must_attempt_each_curl_container_log");
  assert.equal(diagnostics.logs.filter((entry) => entry.logsAvailable).every((entry) => entry.bodySummaryClass === "present_redacted"), true, "diagnostics_available_logs_must_summarize_body");
  assert.equal(diagnostics.logs.some((entry) => entry.logsAvailable === false && entry.unavailableReason.includes("waiting")), true, "diagnostics_logs_must_record_missing_log_reason");
  assert.equal(diagnostics.logs.some((entry) => entry.exitCode === 28 && entry.errorClass === "timeout_or_connection_failed"), true, "diagnostics_logs_must_record_curl_exit_and_error_class");
  assert.equal(JSON.stringify(diagnostics).includes("curl diagnostic body must be redacted"), false, "diagnostics_must_not_dump_log_body");
  assertNoSensitiveText(JSON.stringify(diagnostics), "reachability_diagnostics");
  const diagnosticsIndex = reachabilityFailureCommandLog.findIndex((entry) => entry.args.join(" ") === `kubectl get job ${reachabilitySmokeJobName} -n medopl-platform -o json`);
  const cleanupIndex = reachabilityFailureCommandLog.findIndex((entry) => entry.args.join(" ") === `kubectl delete job ${reachabilitySmokeJobName} -n medopl-platform --ignore-not-found=true --wait=false`);
  assert.equal(diagnosticsIndex > -1, true, "reachability_failure_must_collect_diagnostics_before_cleanup");
  assert.equal(cleanupIndex > diagnosticsIndex, true, "reachability_failure_cleanup_must_run_after_diagnostics");
  const failureEvidence = JSON.parse(await readFile(path.join(evidenceDir, reachabilityRunId, "readonly-service-reachability-redacted.json"), "utf8"));
  assert.equal(failureEvidence.diagnostics.collected, true, "failure_evidence_must_record_diagnostics_collection");
  assert.equal(failureEvidence.diagnostics.path.endsWith("diagnostics-redacted.json"), true, "failure_evidence_must_link_diagnostics_path");
  assertNoSensitiveText(JSON.stringify(failureEvidence), "reachability_failure_evidence");

  console.log(JSON.stringify({
    ok: true,
    contract: "package_d_run_scoped_job_and_service_reachability_runner_local_gate",
    runnerCommand: PACKAGE_D_RUN_SCOPED_JOB_COMMAND,
    reachabilityRunnerCommand: PACKAGE_D_SERVICE_REACHABILITY_COMMAND,
    evidence: ".runtime/package-d-run-scoped-job-preflight/<runid>/preflight-job-redacted.json",
    reachabilityEvidence: ".runtime/package-d-service-reachability/<runid>/readonly-service-reachability-redacted.json",
    cleanupPolicy: "delete-on-success-retain-on-failure",
    realExecutionReady: false,
  }, null, 2));
} finally {
  await rm(tmp, { recursive: true, force: true });
}
