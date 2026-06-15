import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
  PACKAGE_D_RUNNER_IMAGE_PUBLISH_WORKFLOW,
  buildPackageDRunnerImagePublishPlan,
  runPackageDRunnerImagePublishDispatch,
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

function fakeGhExecutor(commandLog) {
  return async ({ args }) => {
    commandLog.push(args);
    assert.deepEqual(args, [
      "gh",
      "workflow",
      "run",
      "package-d-runner-image-publish.yml",
      "--ref",
      "recovery/platform-v22-trunk",
    ], "dispatch_must_use_single_workflow_command");
    return { status: 0, stdout: "queued\n", stderr: "" };
  };
}

const workflow = await readFile(PACKAGE_D_RUNNER_IMAGE_PUBLISH_WORKFLOW, "utf8");
const dockerfile = await readFile(dockerfilePath, "utf8");
const entrypoint = await readFile(entrypointPath, "utf8");

assert.equal(
  PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
  "gh workflow run package-d-runner-image-publish.yml --ref recovery/platform-v22-trunk",
  "publish_boundary_must_use_github_actions_dispatch",
);

assert.equal(workflow.includes("workflow_dispatch:"), true, "workflow_dispatch_required");
assert.equal(workflow.includes("environment: package-d-image-publish"), true, "protected_environment_anchor_required");
assert.equal(workflow.includes("package-d-image-publish requires environment secrets, not repository secrets"), true, "environment_secrets_only_required");
assert.equal(workflow.includes("Required reviewer and branch restriction live on the GitHub Environment."), true, "required_reviewer_boundary_required");
assert.equal(workflow.includes("github.ref_name != 'recovery/platform-v22-trunk' && !startsWith(github.ref_name, 'release/')"), true, "branch_guard_must_allow_trunk_or_release_only");
assert.equal(workflow.includes("secrets.TCR_ID"), true, "tcr_id_secret_required");
assert.equal(workflow.includes("secrets.TCR_SECRET"), true, "tcr_secret_required");
assert.equal(workflow.includes(`PACKAGE_D_RUNNER_IMAGE_REF: ${imageRef}`), true, "fixed_image_ref_required");
assert.equal(workflow.includes("PACKAGE_D_RUNNER_IMAGE_TAG: v22-package-d-20260615-001"), true, "fixed_tag_required");
assert.equal(workflow.includes("PACKAGE_D_RUNNER_IMAGE_REPOSITORY: medopl-platform-runner"), true, "fixed_repo_required");
assert.equal(workflow.includes("docker build"), true, "workflow_build_step_required");
assert.equal(workflow.includes("docker push"), true, "workflow_push_step_required");
assert.equal(workflow.includes(dockerfilePath), true, "workflow_must_build_runner_dockerfile");
assertNoSensitiveText(workflow, "workflow");

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
  const plan = await buildPackageDRunnerImagePublishPlan({
    imageRef,
    evidenceDir,
  });
  assert.equal(plan.ok, true, "plan_ok");
  assert.equal(plan.route, "github_actions_workflow_dispatch", "route");
  assert.equal(plan.mode, "dispatch-github-actions", "mode");
  assert.equal(plan.image.ref, "redacted", "public_plan_must_redact_image_ref");
  assert.equal(plan.image.registry, "uswccr.ccs.tencentyun.com", "registry_fixed");
  assert.equal(plan.image.namespace, "medopl", "namespace_fixed");
  assert.equal(plan.image.repository, "medopl-platform-runner", "repo_fixed");
  assert.equal(plan.image.tag, "v22-package-d-20260615-001", "tag_fixed");
  assert.equal(plan.githubActions.environment, "package-d-image-publish", "github_environment");
  assert.equal(plan.githubActions.requiredReviewerRequired, true, "github_environment_required_reviewer_required");
  assert.deepEqual(plan.githubActions.branchRestriction, ["recovery/platform-v22-trunk", "release/*"], "github_environment_branch_restriction");
  assert.equal(plan.githubActions.secretsScope, "environment", "github_secrets_must_be_environment_scope");
  assert.equal(plan.githubActions.repositorySecretsAllowed, false, "github_repository_secrets_forbidden");
  assert.deepEqual(plan.githubActions.requiredSecrets, ["TCR_ID", "TCR_SECRET"], "github_secrets_only_tcr");
  assert.equal(plan.githubActions.forbiddenSecretClasses.includes("cluster credential"), true, "cluster_credential_forbidden_in_publish_lane");
  assert.equal(plan.boundary.tkeRunnerDockerAllowed, false, "tke_runner_must_not_build");
  assert.equal(plan.boundary.deployAllowed, false, "deploy_forbidden");
  assert.equal(plan.boundary.clusterCommandAllowed, false, "cluster_command_forbidden");
  assert.equal(plan.boundary.tencentMutationAllowed, false, "tencent_mutation_forbidden");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "package_c_live_forbidden");
  assert.equal(plan.commands.length, 1, "dispatch_only");
  assert.equal(plan.commands[0].kind, "gh_workflow_dispatch", "dispatch_kind");
  assertNoSensitiveText(JSON.stringify(plan), "plan");

  const commandLog = [];
  const summary = await runPackageDRunnerImagePublishDispatch({
    imageRef,
    evidenceDir,
    authorized: true,
    gh: fakeGhExecutor(commandLog),
  });
  assert.equal(summary.ok, true, "summary_ok");
  assert.equal(summary.imageRef, "redacted", "summary_must_redact_image_ref");
  assert.equal(summary.evidencePath.endsWith("github-actions-dispatch-redacted.json"), true, "evidence_path");
  assert.equal(commandLog.length, 1, "must_dispatch_once");
  assertNoSensitiveText(JSON.stringify(summary), "summary");

  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.ok, true, "evidence_ok");
  assert.equal(evidence.imageRef, "redacted", "evidence_must_redact_image_ref");
  assert.equal(evidence.redactionAudit.tcrSecretValueExposed, false, "evidence_must_hide_tcr_secret");
  assert.equal(evidence.redactionAudit.fullImageRefExposed, false, "evidence_must_hide_full_image_ref");
  assertNoSensitiveText(JSON.stringify(evidence), "evidence");

  await assert.rejects(
    () => runPackageDRunnerImagePublishDispatch({
      imageRef,
      evidenceDir,
      gh: fakeGhExecutor([]),
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
      }),
      /package_d_runner_image_ref_/,
      `bad_image_ref_must_fail_closed:${badRef}`,
    );
  }

  for (const forbiddenArg of ["--deploy", "--kubectl", "--tencent-mutation", "--package-c-live", "--pull", "--latest", "--docker-build"]) {
    await assert.rejects(
      () => buildPackageDRunnerImagePublishPlan({
        imageRef,
        evidenceDir,
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
    route: "github_actions_workflow_dispatch",
    imageRef,
    evidence: ".runtime/package-d-runner-image-publish/github-actions-dispatch-redacted.json",
    realExecutionReady: false,
  }, null, 2));
} finally {
  await rm(tmp, { recursive: true, force: true });
}
