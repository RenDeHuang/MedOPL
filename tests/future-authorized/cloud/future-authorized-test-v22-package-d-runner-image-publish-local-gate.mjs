import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
  buildPackageDRunnerImagePublishPlan,
  runPackageDRunnerImagePublish,
} from "../../support/cloud-prework/package-d-runner-image-publish-runner.js";

const imageRef = "uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001";

function assertNoSensitiveText(text = "", label = "text") {
  for (const forbidden of [
    "tcr-secret-value",
    "docker login --password",
    "kubectl",
    "CreateNodePool",
    "medopl-tenant-",
    "latest",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

function fakeDockerExecutor(commandLog) {
  return async ({ args, stdin }) => {
    commandLog.push({
      args,
      stdinClass: stdin ? "present_redacted" : "empty",
    });
    const joined = args.join(" ");
    assert.equal(args[0], "docker", "runner_must_use_docker_only");
    assert.equal(joined.includes("kubectl"), false, "runner_must_not_use_kubectl");
    assert.equal(joined.includes("apply"), false, "runner_must_not_apply");
    assert.equal(joined.includes("deploy"), false, "runner_must_not_deploy");
    assert.equal(joined.includes("CreateNodePool"), false, "runner_must_not_call_tencent_mutation");
    if (args.includes("login")) {
      assert.equal(args.includes("--password-stdin"), true, "docker_login_must_use_password_stdin");
      assert.equal(stdin, "tcr-secret-value", "docker_login_must_receive_secret_via_stdin_only");
      assert.equal(args.includes("uswccr.ccs.tencentyun.com"), true, "docker_login_registry");
      return { status: 0, stdout: "Login Succeeded\n", stderr: "" };
    }
    if (args.includes("build")) {
      assert.equal(args.includes("-t"), true, "docker_build_must_tag_image");
      assert.equal(args[args.indexOf("-t") + 1], imageRef, "docker_build_must_use_fixed_runner_image_ref");
      assert.equal(args.at(-1), ".", "docker_build_context_must_be_repo_root");
      return { status: 0, stdout: "built\n", stderr: "" };
    }
    if (args.includes("push")) {
      assert.equal(args.at(-1), imageRef, "docker_push_must_use_fixed_runner_image_ref");
      return { status: 0, stdout: "pushed\n", stderr: "" };
    }
    if (args.includes("inspect")) {
      return { status: 0, stdout: "[]\n", stderr: "" };
    }
    return { status: 0, stdout: "ok\n", stderr: "" };
  };
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-runner-image-publish-"));
try {
  const deployEnvPath = path.join(tmp, "package-d-deploy.env");
  const evidenceDir = path.join(tmp, "evidence");

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TCR_ID=100047070895",
    "TCR_SECRET=tcr-secret-value",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    "TENCENT_DEPLOY_KUBECONFIG_REF=/home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy",
    `PACKAGE_D_RUNNER_IMAGE_REF=${imageRef}`,
    "",
  ].join("\n"));

  assert.equal(
    PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
    "node tests/support/cloud-prework/package-d-runner-image-publish-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --image-ref uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001 --mode publish-image",
    "runner_must_publish_single_cloud_command",
  );

  await assert.rejects(
    () => buildPackageDRunnerImagePublishPlan({
      deployEnvPath,
      imageRef,
      evidenceDir,
    }),
    /package_d_runner_image_publish_not_authorized/,
    "missing_publish_authorization_must_fail_closed",
  );

  const plan = await buildPackageDRunnerImagePublishPlan({
    deployEnvPath,
    imageRef,
    evidenceDir,
    authorized: true,
  });
  assert.equal(plan.ok, true, "plan_ok");
  assert.equal(plan.mode, "publish-image", "mode");
  assert.equal(plan.image.ref, "redacted", "public_plan_must_redact_image_ref");
  assert.equal(plan.image.registry, "uswccr.ccs.tencentyun.com", "registry_fixed");
  assert.equal(plan.image.namespace, "medopl", "namespace_fixed");
  assert.equal(plan.image.repository, "medopl-platform-runner", "repo_fixed");
  assert.equal(plan.image.tag, "v22-package-d-20260615-001", "tag_fixed");
  assert.equal(plan.boundary.imagePublishAllowed, true, "image_publish_allowed");
  assert.equal(plan.boundary.deployAllowed, false, "deploy_forbidden");
  assert.equal(plan.boundary.clusterCommandAllowed, false, "cluster_command_forbidden");
  assert.equal(plan.boundary.tencentMutationAllowed, false, "tencent_mutation_forbidden");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "package_c_live_forbidden");
  assert.equal(plan.commands.length, 3, "login_build_push_only");
  assert.equal(plan.commands.map((command) => command.kind).join(","), "docker_login,docker_build,docker_push", "command_kinds");
  assert.equal(plan.commands.every((command) => command.args[0] === "docker"), true, "docker_only");
  assert.equal(JSON.stringify(plan.commands).includes("kubectl"), false, "plan_must_not_include_kubectl");
  assert.equal(JSON.stringify(plan.commands).includes("docker push"), false, "commands_are_structured_not_shell_strings");
  assertNoSensitiveText(JSON.stringify(plan), "plan");

  const commandLog = [];
  const summary = await runPackageDRunnerImagePublish({
    deployEnvPath,
    imageRef,
    evidenceDir,
    authorized: true,
    docker: fakeDockerExecutor(commandLog),
  });
  assert.equal(summary.ok, true, "summary_ok");
  assert.equal(summary.imageRef, "redacted", "summary_must_redact_image_ref");
  assert.equal(summary.evidencePath.endsWith("image-publish-redacted.json"), true, "evidence_path");
  assert.equal(commandLog.length, 3, "must_execute_login_build_push");
  assert.equal(commandLog[0].stdinClass, "present_redacted", "login_secret_stdin_redacted");
  assertNoSensitiveText(JSON.stringify(summary), "summary");

  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.ok, true, "evidence_ok");
  assert.equal(evidence.image.ref, "redacted", "evidence_must_redact_image_ref");
  assert.equal(evidence.redactionAudit.tcrSecretExposed, false, "evidence_must_hide_tcr_secret");
  assert.equal(evidence.redactionAudit.fullImageRefExposed, false, "evidence_must_hide_full_image_ref");
  assertNoSensitiveText(JSON.stringify(evidence), "evidence");

  for (const badRef of [
    "uswccr.ccs.tencentyun.com/other/medopl-platform-runner:v22-package-d-20260615-001",
    "uswccr.ccs.tencentyun.com/medopl/other:v22-package-d-20260615-001",
    "uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:latest",
    "ccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001",
    "bad image",
  ]) {
    await assert.rejects(
      () => buildPackageDRunnerImagePublishPlan({
        deployEnvPath,
        imageRef: badRef,
        evidenceDir,
        authorized: true,
      }),
      /package_d_runner_image_ref_/,
      `bad_image_ref_must_fail_closed:${badRef}`,
    );
  }

  await writeFile(deployEnvPath, [
    "RUN_TENCENT_DEPLOY_EXECUTION=0",
    "TENCENT_TCR_REGISTRY=uswccr.ccs.tencentyun.com",
    "TENCENT_TCR_NAMESPACE=medopl",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cls-fi097sy4",
    "TENCENT_DEPLOY_KUBECONFIG_REF=/home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy",
    `PACKAGE_D_RUNNER_IMAGE_REF=${imageRef}`,
    "",
  ].join("\n"));
  await assert.rejects(
    () => buildPackageDRunnerImagePublishPlan({
      deployEnvPath,
      imageRef,
      evidenceDir,
      authorized: true,
    }),
    /package_d_env_missing:TCR_ID,TCR_SECRET|package_d_tcr_credentials_missing/,
    "missing_tcr_credentials_must_fail_closed",
  );

  for (const forbiddenArg of ["--deploy", "--kubectl", "--tencent-mutation", "--package-c-live", "--pull", "--latest"]) {
    await assert.rejects(
      () => buildPackageDRunnerImagePublishPlan({
        deployEnvPath,
        imageRef,
        evidenceDir,
        authorized: true,
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
    imageRef,
    evidence: ".runtime/package-d-runner-image-publish/image-publish-redacted.json",
    realExecutionReady: false,
  }, null, 2));
} finally {
  await rm(tmp, { recursive: true, force: true });
}
