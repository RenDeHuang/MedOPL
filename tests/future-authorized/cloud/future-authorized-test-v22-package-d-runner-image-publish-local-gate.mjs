import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
  buildPackageDRunnerImagePublishPlan,
  runPackageDRunnerImagePublishPrivateBuild,
} from "../../support/cloud-prework/package-d-runner-image-publish-runner.js";

const imageRef = "uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001";
const dockerfilePath = "tests/support/cloud-prework/package-d-platform-runner.Dockerfile";
const entrypointPath = "tests/support/cloud-prework/package-d-platform-runner-entrypoint.js";

function assertNoSensitiveText(text = "", label = "text") {
  for (const forbidden of [
    "tcr-secret-value",
    "client-certificate-data",
    "client-key-data",
    "kubeconfig-package-d-deploy",
    "PORTAL_POSTGRES_PASSWORD=",
    "PORTAL_ADMIN_PASSWORD=",
    "KUBECONFIG",
    "CreateNodePool",
    "medopl-tenant-",
    ":latest",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

function fakeDockerExecutor(commandLog) {
  return async ({ args, env }) => {
    commandLog.push({ args, envKeys: Object.keys(env).sort() });
    assert.equal(args[0], "docker", "private_build_must_use_docker_only");
    assert.equal(args.includes("kubectl"), false, "private_build_must_not_call_kubectl");
    assert.equal(args.includes("gh"), false, "private_build_must_not_call_github_actions");
    assert.equal(args.includes("CreateNodePool"), false, "private_build_must_not_call_tencent_mutation");
    if (args.includes("login")) {
      assert.equal(args.includes("--password-stdin"), true, "docker_login_must_use_password_stdin");
      assert.equal(args.includes("--username"), true, "docker_login_must_pass_username_flag");
      assert.equal(args.includes("tcr-user"), true, "docker_login_must_use_env_tcr_id_not_placeholder");
      assert.equal(args.includes("$TCR_ID"), false, "docker_login_must_not_send_placeholder_username");
    }
    if (args.includes("build")) {
      assert.deepEqual(args.slice(0, 3), ["docker", "buildx", "build"], "docker_build_must_use_buildx");
      assert.equal(args.includes("--platform"), true, "docker_build_must_set_platform_flag");
      assert.equal(args.includes("linux/amd64"), true, "docker_build_must_target_linux_amd64");
      assert.equal(args.includes(imageRef), true, "docker_build_must_use_fixed_image_ref");
    }
    if (args.includes("push")) assert.equal(args.includes(imageRef), true, "docker_push_must_use_fixed_image_ref");
    assert.deepEqual(Object.keys(env).sort(), [
      "PACKAGE_D_RUNNER_IMAGE_REF",
      "TCR_ID",
      "TCR_SECRET",
    ], "private_build_env_must_only_include_tcr_and_image_ref");
    return { status: 0, stdout: "ok\n", stderr: "" };
  };
}

const dockerfile = await readFile(dockerfilePath, "utf8");
const entrypoint = await readFile(entrypointPath, "utf8");

assert.equal(
  PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
  "node tests/support/cloud-prework/package-d-runner-image-publish-runner.js --mode private-build-push --env /home/dev/.secrets/medopl/v22/package-d-deploy.env --authorized 1",
  "publish_boundary_must_use_private_build_runner",
);

assert.equal(dockerfile.includes("FROM node:22-bookworm-slim"), true, "runner_image_must_use_node22");
assert.equal(dockerfile.includes(entrypointPath.split("/").at(-1)), true, "runner_image_must_copy_entrypoint");
assert.equal(dockerfile.includes("ENTRYPOINT"), true, "runner_image_must_define_entrypoint");
assertNoSensitiveText(dockerfile, "dockerfile");

assert.equal(entrypoint.includes('allowedCommands = new Set(["preflight"])'), true, "runner_entrypoint_must_allow_preflight_only");
assert.equal(entrypoint.includes("package_d_runner_namespace_mismatch"), true, "runner_entrypoint_namespace_guard");
assert.equal(entrypoint.includes("package_d_runner_platform_pool_mismatch"), true, "runner_entrypoint_platform_pool_guard");
assert.equal(entrypoint.includes("10.66.0.21:5432"), true, "runner_entrypoint_postgres_smoke_target");
for (const forbidden of ["kubectl", "docker", "CreateNodePool", "medopl-tenant-", "TCR_SECRET", "kubeconfig"]) {
  assert.equal(entrypoint.includes(forbidden), false, `runner_entrypoint_must_not_include:${forbidden}`);
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-runner-image-publish-"));
try {
  const evidenceDir = path.join(tmp, "evidence");
  const deployEnvPath = path.join(tmp, "package-d-deploy.env");
  await writeFile(deployEnvPath, [
    "TCR_ID=tcr-user",
    "TCR_SECRET=tcr-secret-value",
    `PACKAGE_D_RUNNER_IMAGE_REF=${imageRef}`,
    "",
  ].join("\n"));
  const plan = await buildPackageDRunnerImagePublishPlan({
    imageRef,
    evidenceDir,
    deployEnvPath,
  });
  assert.equal(plan.ok, true, "plan_ok");
  assert.equal(plan.route, "private_build_runner", "route");
  assert.equal(plan.mode, "private-build-push", "mode");
  assert.equal(plan.image.ref, "redacted", "public_plan_must_redact_image_ref");
  assert.equal(plan.image.registry, "uswccr.ccs.tencentyun.com", "registry_fixed");
  assert.equal(plan.image.namespace, "medopl", "namespace_fixed");
  assert.equal(plan.image.repository, "medopl-platform-runner", "repo_fixed");
  assert.equal(plan.image.tag, "v22-package-d-20260615-001", "tag_fixed");
  assert.equal(plan.image.platform, "linux/amd64", "platform_must_be_linux_amd64");
  assert.equal(plan.privateBuildRunner.platform, "linux/amd64", "private_build_platform_must_be_linux_amd64");
  assert.equal(plan.boundary.implicitHostPlatformAllowed, false, "implicit_host_platform_must_be_forbidden");
  assert.equal(plan.privateBuildRunner.secretSource, "package-d-deploy.env", "private_build_secret_source");
  assert.deepEqual(plan.privateBuildRunner.allowedEnvKeys, ["TCR_ID", "TCR_SECRET", "PACKAGE_D_RUNNER_IMAGE_REF"], "private_build_allowed_env_keys");
  assert.deepEqual(plan.privateBuildRunner.forbiddenSecretClasses, ["kubeconfig", "DB password", "Portal admin password", "Tencent SecretId/SecretKey"], "private_build_forbidden_secret_classes");
  assert.equal(plan.githubActions.status, "removed_from_current_live_path", "github_actions_must_not_be_current_live_path");
  assert.equal(plan.githubActions.currentLivePath, false, "github_actions_current_live_path_must_be_false");
  assert.equal(plan.boundary.tkeRunnerDockerAllowed, false, "tke_runner_must_not_build");
  assert.equal(plan.boundary.deployAllowed, false, "deploy_forbidden");
  assert.equal(plan.boundary.clusterCommandAllowed, false, "cluster_command_forbidden");
  assert.equal(plan.boundary.tencentMutationAllowed, false, "tencent_mutation_forbidden");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "package_c_live_forbidden");
  assert.deepEqual(plan.commands.map((command) => command.kind), ["docker_login", "docker_build", "docker_push"], "private_build_commands_only");
  assertNoSensitiveText(JSON.stringify(plan), "plan");

  const commandLog = [];
  const summary = await runPackageDRunnerImagePublishPrivateBuild({
    imageRef,
    evidenceDir,
    deployEnvPath,
    authorized: true,
    docker: fakeDockerExecutor(commandLog),
  });
  assert.equal(summary.ok, true, "summary_ok");
  assert.equal(summary.imageRef, "redacted", "summary_must_redact_image_ref");
  assert.equal(summary.image.platform, "linux/amd64", "summary_platform_must_be_linux_amd64");
  assert.equal(summary.evidencePath.endsWith("private-build-push-redacted.json"), true, "evidence_path");
  assert.equal(commandLog.length, 3, "must_run_login_build_push_once");
  assertNoSensitiveText(JSON.stringify(summary), "summary");

  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.ok, true, "evidence_ok");
  assert.equal(evidence.imageRef, "redacted", "evidence_must_redact_image_ref");
  assert.equal(evidence.image.platform, "linux/amd64", "evidence_platform_must_be_linux_amd64");
  assert.equal(evidence.redactionAudit.tcrSecretValueExposed, false, "evidence_must_hide_tcr_secret");
  assert.equal(evidence.redactionAudit.fullImageRefExposed, false, "evidence_must_hide_full_image_ref");
  assertNoSensitiveText(JSON.stringify(evidence), "evidence");

  await assert.rejects(
    () => runPackageDRunnerImagePublishPrivateBuild({
      imageRef,
      evidenceDir,
      deployEnvPath,
      docker: fakeDockerExecutor([]),
    }),
    /package_d_runner_image_publish_not_authorized/,
    "missing_publish_authorization_must_fail_closed",
  );

  for (const badRef of [
    "uswccr.ccs.tencentyun.com/other/medopl-platform-runner:v22-package-d-20260615-001",
    "uswccr.ccs.tencentyun.com/medopl/other:v22-package-d-20260615-001",
    "uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:latest",
    "ccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001",
    "bad image",
  ]) {
    await assert.rejects(
      () => buildPackageDRunnerImagePublishPlan({
        imageRef: badRef,
        evidenceDir,
        deployEnvPath,
      }),
      /package_d_runner_image_ref_/,
      `bad_image_ref_must_fail_closed:${badRef}`,
    );
  }

  for (const forbiddenArg of ["--deploy", "--kubectl", "--tencent-mutation", "--package-c-live", "--pull", "--latest", "--github-actions"]) {
    await assert.rejects(
      () => buildPackageDRunnerImagePublishPlan({
        imageRef,
        evidenceDir,
        deployEnvPath,
        argv: [forbiddenArg],
      }),
      /package_d_runner_image_publish_forbidden_arg/,
      `forbidden_arg_must_fail_closed:${forbiddenArg}`,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "package_d_runner_image_publish_local_gate",
    command: PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
    route: "private_build_runner",
    imageRef,
    evidence: ".runtime/package-d-runner-image-publish/private-build-push-redacted.json",
    realExecutionReady: false,
  }, null, 2));
} finally {
  await rm(tmp, { recursive: true, force: true });
}
