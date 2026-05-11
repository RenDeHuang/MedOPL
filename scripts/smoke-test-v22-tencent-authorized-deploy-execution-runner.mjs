import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseTencentDeploySecretFile } from "./v22-tencent-authorized-deploy-execution-runner.mjs";

const runnerPath = "scripts/v22-tencent-authorized-deploy-execution-runner.mjs";
const repoRoot = path.resolve(".");

const forbiddenPhrases = [
  "deploy-secret-id-proof",
  "deploy-secret-key-proof",
  "registry-password-proof",
  "runtime-smoke-proof",
  "raw-response-proof",
  "kubeconfig-proof",
  "object-key-proof",
];

function assertNotContainsForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  for (const phrase of forbiddenPhrases) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
  assert.equal(
    /SecretId|SecretKey|TCR_SECRET|token|kubeconfig|objectKey|storageKey|signedUrl|rawResponse|providerRawResponse|dockerConfig|\bAuthorization\b|\bCookie\b/i.test(serialized),
    false,
    `${label}_must_not_contain_forbidden_key`,
  );
}

function runRunner(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [runnerPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, expectedStatus, `runner_status:${args.join(" ")}:${result.stderr}`);
  assertNotContainsForbidden(result.stdout, `stdout:${args.join(" ")}`);
  assertNotContainsForbidden(result.stderr, `stderr:${args.join(" ")}`);
  return result;
}

function parseStdout(stdout) {
  return JSON.parse(stdout.trim());
}

function baseArgs(secretFile) {
  return [
    "--secret-file",
    secretFile,
  ];
}

function assertSummaryShape(summary, label) {
  assert.equal(summary.ok, true, `${label}_ok`);
  assert.equal(summary.authorizationPackage, "deploy_and_production_integration", `${label}_package`);
  assert.equal(summary.runId, "pkg-d-proof", `${label}_run_id`);
  assert.equal(summary.versionTag, "pkg-d-proof-20260510-000001", `${label}_tag`);
  assert.equal(summary.forbidsLatestTag, true, `${label}_forbids_latest`);
  assert.equal(summary.doesNotModifyTkeNodePool, true, `${label}_no_node_pool`);
  assert.equal(summary.doesNotModifyCosStorage, true, `${label}_no_cos`);
  assert.equal(summary.releasePlan?.targetCount, 3, `${label}_target_count`);
  assert.deepEqual(summary.releasePlan?.components, ["portal", "opl-web-gateway", "opl-runtime-bridge"], `${label}_components`);
  assert.equal(summary.releasePlan?.targetClasses?.platformService, 3, `${label}_platform_service_target_count`);
  assert.equal(summary.releasePlan?.targetClasses?.workspaceRuntime, 0, `${label}_workspace_runtime_target_count`);
  assert.deepEqual(summary.releasePlan?.runtimeSmokeSurfaces, ["portal", "opl", "trace"], `${label}_smoke_surfaces`);
  assert.equal(summary.targets?.length, 3, `${label}_targets_length`);
  assert.equal(summary.runtimeSmokeTargets?.length, 3, `${label}_runtime_smoke_targets_length`);
  for (const target of summary.targets || []) {
    assert.equal(target.ownerGuard?.verified, true, `${label}_${target.component}_owner_guard`);
  }
  for (const smokeTarget of summary.runtimeSmokeTargets || []) {
    assert.equal(smokeTarget.endpointRef?.startsWith("https://[redacted-host]/"), true, `${label}_${smokeTarget.surface}_smoke_ref`);
  }
  assertNotContainsForbidden(summary, label);
}

const goodSecretText = [
  "RUN_TENCENT_DEPLOY_EXECUTION=1",
  "TCR_ID=deploy-secret-id-proof",
  "TCR_SECRET=registry-password-proof",
  "TENCENT_TCR_REGISTRY=registry-proof.example.tencentcloudcr.com",
  "TENCENT_TCR_NAMESPACE=namespace-proof",
  "TENCENT_TCR_REGION=na-siliconvalley",
  "TENCENT_DEPLOY_CLUSTER_ID=cls-proof",
  "TENCENT_DEPLOY_KUBECONFIG_REF=/tmp/kubeconfig-proof",
].join("\n");

const parsed = parseTencentDeploySecretFile(goodSecretText);
assert.deepEqual(Object.keys(parsed).sort(), [
  "RUN_TENCENT_DEPLOY_EXECUTION",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_DEPLOY_CLUSTER_ID",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
  "TENCENT_TCR_NAMESPACE",
  "TENCENT_TCR_REGION",
  "TENCENT_TCR_REGISTRY",
].sort(), "parser_must_only_return_package_d_allowlist_keys");

assert.throws(
  () => parseTencentDeploySecretFile(`${goodSecretText}\nTENCENT_TCR_REPOSITORY=single-repository-proof`),
  /tencent_deploy_non_allowlist_secret_key_rejected:TENCENT_TCR_REPOSITORY/,
  "parser_must_reject_single_repository_secret",
);
assert.throws(
  () => parseTencentDeploySecretFile(`${goodSecretText}\nTENCENT_DEPLOY_CONTAINER=single-container-proof`),
  /tencent_deploy_non_allowlist_secret_key_rejected:TENCENT_DEPLOY_CONTAINER/,
  "parser_must_reject_single_container_secret",
);
assert.throws(
  () => parseTencentDeploySecretFile(`${goodSecretText}\nTENCENT_DEPLOY_RUNTIME_SMOKE_URL=https://runtime-smoke-proof.example/healthz`),
  /tencent_deploy_non_allowlist_secret_key_rejected:TENCENT_DEPLOY_RUNTIME_SMOKE_URL/,
  "parser_must_reject_single_smoke_url_secret",
);

assert.throws(
  () => parseTencentDeploySecretFile(`${goodSecretText}\nTENCENT_MUTATION_SECRET_ID=mutation-secret-proof`),
  /tencent_deploy_forbidden_secret_key:TENCENT_MUTATION_SECRET_ID/,
  "parser_must_reject_package_c_secret",
);
assert.throws(
  () => parseTencentDeploySecretFile(`${goodSecretText}\nTENCENT_READONLY_SECRET_ID=readonly-secret-proof`),
  /tencent_deploy_forbidden_secret_key:TENCENT_READONLY_SECRET_ID/,
  "parser_must_reject_readonly_secret",
);
assert.throws(
  () => parseTencentDeploySecretFile(`${goodSecretText}\nUNLISTED_SECRET_KEY=proof`),
  /tencent_deploy_non_allowlist_secret_key_rejected:UNLISTED_SECRET_KEY/,
  "parser_must_reject_unknown_key",
);

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-deploy-runner-"));
const reportPathsToCleanup = [];
try {
  const goodSecretFile = path.join(tmpDir, "deploy.env");
  await writeFile(goodSecretFile, goodSecretText, "utf8");
  const disabledSecretFile = path.join(tmpDir, "disabled.env");
  await writeFile(disabledSecretFile, goodSecretText.replace("RUN_TENCENT_DEPLOY_EXECUTION=1", "RUN_TENCENT_DEPLOY_EXECUTION=0"), "utf8");
  const releasePlanFile = path.join(tmpDir, "release-plan.json");
  const releasePlan = {
    runId: "pkg-d-proof",
    versionTag: "pkg-d-proof-20260510-000001",
    namespace: "namespace-proof",
    targets: [
      {
        component: "portal",
        targetClass: "platform_service_target",
        repository: "portal-proof",
        dockerfile: "deploy/local/dockerfiles/portal.Dockerfile",
        buildContext: "services/portal",
        namespace: "namespace-proof",
        workload: "portal-deployment-proof",
        container: "portal-container-proof",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-proof-20260510-000001",
      },
      {
        component: "opl-web-gateway",
        targetClass: "platform_service_target",
        repository: "opl-web-gateway-proof",
        dockerfile: "deploy/local/dockerfiles/opl-web-gateway.Dockerfile",
        buildContext: "services/opl-web-gateway",
        namespace: "namespace-proof",
        workload: "opl-web-gateway-deployment-proof",
        container: "opl-web-gateway-container-proof",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-proof-20260510-000001",
      },
      {
        component: "opl-runtime-bridge",
        targetClass: "platform_service_target",
        repository: "opl-runtime-bridge-proof",
        dockerfile: "deploy/local/dockerfiles/opl-runtime-bridge.Dockerfile",
        buildContext: "services/opl-runtime-bridge",
        namespace: "namespace-proof",
        workload: "opl-runtime-bridge-deployment-proof",
        container: "opl-runtime-bridge-container-proof",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-proof-20260510-000001",
      },
    ],
    runtimeSmokeTargets: [
      {
        surface: "portal",
        url: "https://portal.medopl.cn/healthz",
        expectedVersionMarker: "pkg-d-proof-20260510-000001",
        provesPushedVersion: true,
        provesComponents: ["portal"],
      },
      {
        surface: "opl",
        url: "https://opl.medopl.cn/healthz",
        expectedVersionMarker: "pkg-d-proof-20260510-000001",
        provesPushedVersion: true,
        provesComponents: ["opl-web-gateway", "opl-runtime-bridge"],
      },
      {
        surface: "trace",
        url: "https://trace.medopl.cn/api/public/health",
        expectedVersionMarker: "langfuse-health-ok",
        provesPushedVersion: false,
        provesComponents: [],
      },
    ],
  };
  await writeFile(releasePlanFile, `${JSON.stringify(releasePlan, null, 2)}\n`, "utf8");

  const checkConfig = runRunner(["--check-config", ...baseArgs(goodSecretFile), "--release-plan", releasePlanFile]);
  const checkConfigOut = parseStdout(checkConfig.stdout);
  assert.equal(checkConfigOut.reportPath, null, "check_config_must_not_write_report");
  assertSummaryShape(checkConfigOut.summary, "check_config");

  const repoRootContextPlanFile = path.join(tmpDir, "repo-root-context-release-plan.json");
  const repoRootContextPlan = JSON.parse(JSON.stringify(releasePlan));
  for (const target of repoRootContextPlan.targets) target.buildContext = ".";
  await writeFile(repoRootContextPlanFile, `${JSON.stringify(repoRootContextPlan, null, 2)}\n`, "utf8");
  const repoRootContext = runRunner(["--check-config", ...baseArgs(goodSecretFile), "--release-plan", repoRootContextPlanFile]);
  assert.equal(parseStdout(repoRootContext.stdout).summary.ok, true, "repo_root_build_context_must_be_allowed_for_multi_service_dockerfiles");

  const disabled = runRunner(["--check-config", ...baseArgs(disabledSecretFile), "--release-plan", releasePlanFile], 1);
  assert.equal(parseStdout(disabled.stdout).summary.blockedReason, "deploy_run_gate_disabled", "disabled_reason");

  const latestPlanFile = path.join(tmpDir, "latest-release-plan.json");
  await writeFile(latestPlanFile, `${JSON.stringify({ ...releasePlan, versionTag: "latest" }, null, 2)}\n`, "utf8");
  const latest = runRunner(["--check-config", ...baseArgs(goodSecretFile), "--release-plan", latestPlanFile], 1);
  assert.equal(parseStdout(latest.stdout).summary.blockedReason, "deploy_latest_tag_forbidden", "latest_reason");

  const missingOwnerPlanFile = path.join(tmpDir, "missing-owner-release-plan.json");
  const missingOwnerPlan = JSON.parse(JSON.stringify(releasePlan));
  delete missingOwnerPlan.targets[0].ownerRef;
  await writeFile(missingOwnerPlanFile, `${JSON.stringify(missingOwnerPlan, null, 2)}\n`, "utf8");
  const missingOwner = runRunner(["--check-config", ...baseArgs(goodSecretFile), "--release-plan", missingOwnerPlanFile], 1);
  assert.equal(parseStdout(missingOwner.stdout).summary.blockedReason, "deploy_platform_owner_guard_required", "missing_owner_reason");

  const duplicatePlanFile = path.join(tmpDir, "duplicate-release-plan.json");
  const duplicatePlan = JSON.parse(JSON.stringify(releasePlan));
  duplicatePlan.targets[1].repository = duplicatePlan.targets[0].repository;
  await writeFile(duplicatePlanFile, `${JSON.stringify(duplicatePlan, null, 2)}\n`, "utf8");
  const duplicate = runRunner(["--check-config", ...baseArgs(goodSecretFile), "--release-plan", duplicatePlanFile], 1);
  assert.equal(parseStdout(duplicate.stdout).summary.blockedReason, "deploy_duplicate_repository_tag_forbidden", "duplicate_repository_tag_reason");

  const crossNamespacePlanFile = path.join(tmpDir, "cross-namespace-release-plan.json");
  const crossNamespacePlan = JSON.parse(JSON.stringify(releasePlan));
  crossNamespacePlan.targets[2].namespace = "other-namespace-proof";
  await writeFile(crossNamespacePlanFile, `${JSON.stringify(crossNamespacePlan, null, 2)}\n`, "utf8");
  const crossNamespace = runRunner(["--check-config", ...baseArgs(goodSecretFile), "--release-plan", crossNamespacePlanFile], 1);
  assert.equal(parseStdout(crossNamespace.stdout).summary.blockedReason, "deploy_cross_namespace_target_forbidden", "cross_namespace_reason");

  const missingSmokeCoveragePlanFile = path.join(tmpDir, "missing-smoke-coverage-release-plan.json");
  const missingSmokeCoveragePlan = JSON.parse(JSON.stringify(releasePlan));
  missingSmokeCoveragePlan.runtimeSmokeTargets[1].provesComponents = ["opl-web-gateway"];
  await writeFile(missingSmokeCoveragePlanFile, `${JSON.stringify(missingSmokeCoveragePlan, null, 2)}\n`, "utf8");
  const missingSmokeCoverage = runRunner(["--check-config", ...baseArgs(goodSecretFile), "--release-plan", missingSmokeCoveragePlanFile], 1);
  assert.equal(parseStdout(missingSmokeCoverage.stdout).summary.blockedReason, "deploy_runtime_smoke_component_coverage_required", "missing_smoke_coverage_reason");

  const registryPreflight = runRunner(["--tcr-preflight", "--provider-mode", "fake-live", ...baseArgs(goodSecretFile), "--release-plan", releasePlanFile]);
  const registryPreflightOut = parseStdout(registryPreflight.stdout);
  reportPathsToCleanup.push(registryPreflightOut.reportPath);
  assert.equal(registryPreflightOut.reportPath.endsWith(".runtime/v22-registry/pkg-d-proof-tcr-preflight.json"), true, "tcr_preflight_path");
  assertSummaryShape(registryPreflightOut.summary, "tcr_preflight");
  assert.equal(registryPreflightOut.summary.targets.every((target) => target.registry?.digestReadable === true), true, "tcr_preflight_digest_readable");

  const buildPushWithoutPreflight = runRunner(["--build-push", "--provider-mode", "fake-live", ...baseArgs(goodSecretFile), "--release-plan", releasePlanFile], 1);
  assert.equal(parseStdout(buildPushWithoutPreflight.stdout).summary.blockedReason, "deploy_accepted_preflight_required", "build_push_must_require_accepted_preflight");

  const buildPush = runRunner(["--build-push", "--provider-mode", "fake-live", ...baseArgs(goodSecretFile), "--release-plan", releasePlanFile, "--accepted-preflight-id", "pkg-d-proof-tcr-preflight"]);
  const buildPushOut = parseStdout(buildPush.stdout);
  reportPathsToCleanup.push(buildPushOut.reportPath);
  assert.equal(buildPushOut.reportPath.endsWith(".runtime/v22-registry/pkg-d-proof-build-push.json"), true, "build_push_path");
  assertSummaryShape(buildPushOut.summary, "build_push");
  assert.equal(buildPushOut.summary.targets.every((target) => /^sha256:[a-f0-9]{64}$/.test(target.registry?.digest || "")), true, "build_push_digest");
  assert.equal(buildPushOut.summary.targets.every((target) => target.registry?.acceptedPreflightId.includes("****")), true, "build_push_preflight_id_must_be_masked");

  const deployDryRunWithoutDigests = runRunner(["--deploy-dry-run", "--provider-mode", "fake-live", ...baseArgs(goodSecretFile), "--release-plan", releasePlanFile], 1);
  assert.equal(parseStdout(deployDryRunWithoutDigests.stdout).summary.blockedReason, "deploy_image_digests_file_required", "deploy_dry_run_must_require_image_digests_file");

  const deployDryRun = runRunner(["--deploy-dry-run", "--provider-mode", "fake-live", ...baseArgs(goodSecretFile), "--release-plan", releasePlanFile, "--image-digests-file", buildPushOut.reportPath]);
  const deployDryRunOut = parseStdout(deployDryRun.stdout);
  reportPathsToCleanup.push(deployDryRunOut.reportPath);
  assert.equal(deployDryRunOut.reportPath.endsWith(".runtime/v22-cloud-deploy/pkg-d-proof-deploy-dry-run.json"), true, "deploy_dry_run_path");
  assertSummaryShape(deployDryRunOut.summary, "deploy_dry_run");
  assert.equal(deployDryRunOut.summary.targets.every((target) => target.deploy?.dryRunVerified === true), true, "deploy_dry_run_verified");

  const rollout = runRunner(["--rollout", "--provider-mode", "fake-live", ...baseArgs(goodSecretFile), "--release-plan", releasePlanFile, "--image-digests-file", buildPushOut.reportPath, "--accepted-dry-run-id", "pkg-d-proof"]);
  const rolloutOut = parseStdout(rollout.stdout);
  reportPathsToCleanup.push(rolloutOut.reportPath);
  assert.equal(rolloutOut.reportPath.endsWith(".runtime/v22-cloud-deploy/pkg-d-proof-rollout.json"), true, "rollout_path");
  assertSummaryShape(rolloutOut.summary, "rollout");
  assert.equal(rolloutOut.summary.targets.every((target) => target.deploy?.rolloutStatus === "available"), true, "rollout_status");
  assert.equal(rolloutOut.summary.targets.every((target) => Boolean(target.deploy?.rollbackEvidenceRef)), true, "rollout_rollback_evidence");

  const runtimeSmoke = runRunner(["--runtime-smoke", "--provider-mode", "fake-live", ...baseArgs(goodSecretFile), "--release-plan", releasePlanFile, "--image-digests-file", buildPushOut.reportPath]);
  const runtimeSmokeOut = parseStdout(runtimeSmoke.stdout);
  reportPathsToCleanup.push(runtimeSmokeOut.reportPath);
  assert.equal(runtimeSmokeOut.reportPath.endsWith(".runtime/v22-runtime-smoke/pkg-d-proof-runtime-smoke.json"), true, "runtime_smoke_path");
  assertSummaryShape(runtimeSmokeOut.summary, "runtime_smoke");
  assert.equal(runtimeSmokeOut.summary.targets.every((target) => target.runtimeSmoke?.pushedVersionRunning === true), true, "runtime_smoke_version");

  for (const reportPath of reportPathsToCleanup) {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assertNotContainsForbidden(report, `report:${reportPath}`);
  }

  const source = await readFile(runnerPath, "utf8");
  assert.equal(/(^|\n)\s*source\s+/.test(source), false, "runner_must_not_source_secret_file");
  const realSecretPathLiteral = ["/home/dev", ".secrets"].join("/");
  assert.equal(source.includes(realSecretPathLiteral), false, "runner_must_not_hardcode_real_secret_path");
  assert.equal(/kubectl\s+delete|DeleteNodePool|CreateNodePool|ScaleNodePool|ModifyNodePoolDesiredCapacityAboutAsg|deleteObject|deleteBucket|emptyBucket/.test(source), false, "runner_must_not_contain_forbidden_mutations");
  assert.equal(source.includes("\"set\""), false, "runner_must_not_use_kubectl_set_image");
  assert.match(source, /"get"[\s\S]*"deployment"/, "runner_must_get_target_deployment_before_apply");
  assert.match(source, /"--dry-run=server"[\s\S]*"apply"/, "runner_must_use_server_side_apply_dry_run");
  assert.match(source, /"rollout"[\s\S]*"status"/, "runner_must_wait_for_rollout_status");
  assert.match(source, /deploy_ownership_guard_failed/, "runner_must_fail_closed_on_owner_label_mismatch");
  assert.match(source, /deploy_portal_schema_missing_tables/, "runner_must_classify_portal_schema_missing_tables");
  assert.match(source, /deploy_portal_schema_not_ready/, "runner_must_classify_portal_schema_not_ready");
  assert.match(source, /manifest\.Digest[\s\S]*manifest\.digest[\s\S]*manifest\.Descriptor\?\.digest[\s\S]*manifest\.manifest\?\.digest/, "runner_must_read_tcr_digest_from_buildx_json_shapes");
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await Promise.all(reportPathsToCleanup.map((reportPath) => rm(reportPath, { force: true })));
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_authorized_deploy_execution_runner",
  checked: [
    "package_d_secret_allowlist_only",
    "package_c_and_readonly_secret_rejected",
    "latest_tag_forbidden",
    "multi_target_release_plan_required",
    "owner_guard_required_per_target",
    "duplicate_repository_tag_forbidden",
    "cross_namespace_release_plan_forbidden",
    "runtime_smoke_surface_and_component_coverage_required",
    "fake_registry_preflight_build_push_deploy_rollout_runtime_smoke_per_target",
    "redacted_stdout_and_runtime_reports",
    "no_node_pool_or_cos_mutation_commands",
    "portal_schema_rollout_failure_classified",
  ],
}, null, 2));
