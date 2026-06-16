import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
  buildPackageDRunnerImagePublishPlan,
  runPackageDRunnerImagePublishPrivateBuild,
} from "../../support/cloud-prework/package-d-runner-image-publish-runner.js";
import {
  PACKAGE_D_SERVICE_IMAGES_PUBLISH_COMMAND,
  buildPackageDServiceImagesPublishPlan,
  runPackageDServiceImagesPublishPrivateBuild,
} from "../../support/cloud-prework/package-d-service-images-publish-runner.js";

const imageRef = "uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001";
const dockerfilePath = "tests/support/cloud-prework/package-d-platform-runner.Dockerfile";
const entrypointPath = "tests/support/cloud-prework/package-d-platform-runner-entrypoint.js";
const serviceImageRefs = Object.freeze({
  PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF: "uswccr.ccs.tencentyun.com/medopl/portal-frontend:v22-package-d-20260616-001",
  PACKAGE_D_GO_BACKEND_IMAGE_REF: "uswccr.ccs.tencentyun.com/medopl/medopl-go-backend:v22-package-d-20260616-001",
  PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF: "uswccr.ccs.tencentyun.com/medopl/opl-web-gateway:v22-package-d-20260616-001",
  PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF: "uswccr.ccs.tencentyun.com/medopl/opl-runtime-bridge:v22-package-d-20260616-001",
});
const expectedServiceImages = Object.freeze([
  {
    name: "portal-frontend",
    imageKey: "PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF",
    repository: "portal-frontend",
    context: "services/portal/frontend",
    dockerfile: "services/portal/frontend/Dockerfile",
    dockerignore: "services/portal/frontend/.dockerignore",
    requiredDockerfileTokens: [
      "FROM node:22-bookworm-slim AS build",
      "RUN npm ci",
      "RUN npm run build",
      "FROM nginx:1.27-bookworm",
      "COPY --from=build /app/dist",
      "listen 8080",
    ],
    forbiddenDockerfileTokens: ["npm run dev", "vite --host", "PORTAL_POSTGRES_PASSWORD", "TCR_SECRET"],
  },
  {
    name: "medopl-go-backend",
    imageKey: "PACKAGE_D_GO_BACKEND_IMAGE_REF",
    repository: "medopl-go-backend",
    context: "services/medopl-go-backend",
    dockerfile: "services/medopl-go-backend/Dockerfile",
    dockerignore: "services/medopl-go-backend/.dockerignore",
    requiredDockerfileTokens: [
      "FROM golang:1.22-bookworm AS build",
      "go mod download",
      "go build",
      "./cmd/server",
      "FROM debian:12-slim",
      "MEDOPL_BACKEND_PORT=8080",
      "ENTRYPOINT [\"/usr/local/bin/medopl-go-backend\"]",
    ],
    forbiddenDockerfileTokens: ["go run", "PORTAL_POSTGRES_PASSWORD", "TCR_SECRET"],
  },
  {
    name: "opl-web-gateway",
    imageKey: "PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF",
    repository: "opl-web-gateway",
    context: "services/opl-web-gateway",
    dockerfile: "services/opl-web-gateway/Dockerfile",
    dockerignore: "services/opl-web-gateway/.dockerignore",
    requiredDockerfileTokens: [
      "FROM node:22-bookworm-slim",
      "COPY package.json",
      "COPY src ./src",
      "PORT=8080",
      "CMD [\"npm\", \"start\"]",
    ],
    forbiddenDockerfileTokens: ["npm install", "npm run dev", "PORTAL_POSTGRES_PASSWORD", "TCR_SECRET"],
  },
  {
    name: "opl-runtime-bridge",
    imageKey: "PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF",
    repository: "opl-runtime-bridge",
    context: "services/opl-runtime-bridge",
    dockerfile: "services/opl-runtime-bridge/Dockerfile",
    dockerignore: "services/opl-runtime-bridge/.dockerignore",
    requiredDockerfileTokens: [
      "FROM node:22-bookworm-slim",
      "COPY package.json",
      "COPY src ./src",
      "PORT=8080",
      "CMD [\"npm\", \"start\"]",
    ],
    forbiddenDockerfileTokens: ["npm install", "npm run dev", "PORTAL_POSTGRES_PASSWORD", "TCR_SECRET"],
  },
]);

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

function fakeServiceFileExists(pathname = "") {
  return expectedServiceImages.flatMap((service) => [
    service.context,
    service.dockerfile,
    service.dockerignore,
  ]).includes(pathname);
}

function assertDockerfileBaseImagesPinned(source = "", label = "dockerfile") {
  const fromLines = source.split(/\r?\n/u).filter((line) => line.trim().startsWith("FROM "));
  assert.equal(fromLines.length > 0, true, `${label}_must_have_base_images`);
  for (const line of fromLines) {
    assert.equal(/:latest(?:\s|$)/u.test(line), false, `${label}_must_not_use_latest_base:${line}`);
    assert.equal(/^FROM\s+[^:\s]+(?:\s+AS\s+\S+)?$/u.test(line), false, `${label}_must_not_use_untagged_base:${line}`);
    assert.equal(line.includes("$"), false, `${label}_must_not_use_dynamic_base:${line}`);
  }
}

async function assertServiceDockerfileMaterialized(service) {
  const dockerfile = await readFile(service.dockerfile, "utf8");
  const dockerignore = await readFile(service.dockerignore, "utf8");
  assertDockerfileBaseImagesPinned(dockerfile, service.name);
  for (const token of service.requiredDockerfileTokens) {
    assert.equal(dockerfile.includes(token), true, `${service.name}_dockerfile_must_include:${token}`);
  }
  for (const token of service.forbiddenDockerfileTokens) {
    assert.equal(dockerfile.includes(token), false, `${service.name}_dockerfile_must_not_include:${token}`);
  }
  for (const requiredIgnore of [
    ".runtime",
    ".secrets",
    "node_modules",
    "dist",
    "coverage",
    "*.env",
    "*.pem",
    "*kubeconfig*",
    "package-d-*.env",
  ]) {
    assert.equal(dockerignore.includes(requiredIgnore), true, `${service.name}_dockerignore_must_include:${requiredIgnore}`);
  }
}

function fakeServiceDockerExecutor(commandLog) {
  return async ({ args, env }) => {
    commandLog.push({ args, envKeys: Object.keys(env).sort() });
    assert.equal(args[0], "docker", "service_private_build_must_use_docker_only");
    assert.equal(args.includes("kubectl"), false, "service_private_build_must_not_call_kubectl");
    assert.equal(args.includes("CreateNodePool"), false, "service_private_build_must_not_call_tencent_mutation");
    if (args.includes("login")) {
      assert.equal(args.includes("--password-stdin"), true, "service_docker_login_must_use_password_stdin");
      assert.equal(args.includes("--username"), true, "service_docker_login_must_pass_username_flag");
      assert.equal(args.includes("tcr-user"), true, "service_docker_login_must_use_env_tcr_id_not_placeholder");
      assert.equal(args.includes("$TCR_ID"), false, "service_docker_login_must_not_send_placeholder_username");
    }
    if (args.includes("build")) {
      assert.deepEqual(args.slice(0, 3), ["docker", "buildx", "build"], "service_docker_build_must_use_buildx");
      assert.equal(args.includes("--platform"), true, "service_docker_build_must_set_platform_flag");
      assert.equal(args.includes("linux/amd64"), true, "service_docker_build_must_target_linux_amd64");
      assert.equal(args.includes("--push"), false, "service_docker_build_must_not_inline_push");
    }
    if (args.includes("push")) assert.equal(args[1], "push", "service_docker_push_command");
    assert.deepEqual(Object.keys(env).sort(), [
      "PACKAGE_D_GO_BACKEND_IMAGE_REF",
      "PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF",
      "PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF",
      "PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF",
      "TCR_ID",
      "TCR_SECRET",
    ], "service_private_build_env_must_only_include_tcr_and_service_image_refs");
    return { status: 0, stdout: "ok\n", stderr: "" };
  };
}

const dockerfile = await readFile(dockerfilePath, "utf8");
const entrypoint = await readFile(entrypointPath, "utf8");
for (const service of expectedServiceImages) {
  await assertServiceDockerfileMaterialized(service);
}

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

  const serviceEnvPath = path.join(tmp, "package-d-service-images-publish.env");
  await writeFile(serviceEnvPath, [
    "TCR_ID=tcr-user",
    "TCR_SECRET=tcr-secret-value",
    ...Object.entries(serviceImageRefs).map(([key, value]) => `${key}=${value}`),
    "",
  ].join("\n"));

  assert.equal(
    PACKAGE_D_SERVICE_IMAGES_PUBLISH_COMMAND,
    "node tests/support/cloud-prework/package-d-service-images-publish-runner.js --mode private-build-push --env /home/dev/.secrets/medopl/v22/package-d-service-images-publish.env --authorized 1",
    "service_image_publish_must_have_single_private_build_runner_command",
  );
  const servicePlan = await buildPackageDServiceImagesPublishPlan({
    envPath: serviceEnvPath,
    evidenceDir,
  });
  assert.equal(servicePlan.ok, true, "service_plan_ok");
  assert.equal(servicePlan.route, "private_build_runner", "service_route");
  assert.equal(servicePlan.mode, "private-build-push", "service_mode");
  assert.equal(servicePlan.imagePublishBoundary, true, "service_image_publish_boundary");
  assert.equal(servicePlan.deployBoundary, false, "service_deploy_boundary");
  assert.equal(servicePlan.realExecutionReady, false, "service_real_execution_must_remain_false");
  assert.equal(servicePlan.readiness.ready, true, "service_dockerfiles_must_be_materialized");
  assert.equal(servicePlan.readiness.nextGap, "package_d_service_images_private_build_push_authorization", "service_next_gap");
  assert.deepEqual(
    servicePlan.privateBuildRunner.allowedEnvKeys,
    [
      "TCR_ID",
      "TCR_SECRET",
      "PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF",
      "PACKAGE_D_GO_BACKEND_IMAGE_REF",
      "PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF",
      "PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF",
    ],
    "service_image_publish_env_allowlist",
  );
  assert.equal(servicePlan.privateBuildRunner.platform, "linux/amd64", "service_platform");
  assert.equal(servicePlan.boundary.tkeRunnerDockerAllowed, false, "service_tke_runner_must_not_build");
  assert.equal(servicePlan.boundary.deployAllowed, false, "service_deploy_forbidden");
  assert.equal(servicePlan.boundary.clusterCommandAllowed, false, "service_cluster_command_forbidden");
  assert.equal(servicePlan.boundary.tencentMutationAllowed, false, "service_tencent_mutation_forbidden");
  assert.equal(servicePlan.boundary.packageCLiveAllowed, false, "service_package_c_live_forbidden");
  assert.deepEqual(
    servicePlan.services.map(({ name, imageKey, repository, context, dockerfile, dockerignore, image }) => ({
      name,
      imageKey,
      repository,
      context,
      dockerfile: dockerfile.path,
      dockerignore: dockerignore.path,
      imageTag: image.tag,
      imageRef: image.ref,
      dockerfilePresent: dockerfile.present,
      dockerignorePresent: dockerignore.present,
    })),
    expectedServiceImages.map((service) => ({
      name: service.name,
      imageKey: service.imageKey,
      repository: service.repository,
      context: service.context,
      dockerfile: service.dockerfile,
      dockerignore: service.dockerignore,
      imageTag: "v22-package-d-20260616-001",
      imageRef: "redacted",
      dockerfilePresent: true,
      dockerignorePresent: true,
    })),
    "service_images_shape_and_materialized_dockerfiles",
  );
  assert.equal(servicePlan.readiness.ready, true, "service_dockerfiles_and_contexts_ready");
  assert.equal(servicePlan.readiness.nextGap, "package_d_service_images_private_build_push_authorization", "service_next_gap_after_dockerfiles_land");
  assert.deepEqual(servicePlan.readiness.missingDockerfiles, [], "service_dockerfiles_materialized");
  assert.deepEqual(servicePlan.readiness.missingDockerignores, [], "service_dockerignores_materialized");
  assert.deepEqual(servicePlan.readiness.missingContexts, [], "service_contexts_materialized");
  assert.deepEqual(servicePlan.commands.map((command) => command.kind), [
    "docker_login",
    "docker_build",
    "docker_push",
    "docker_build",
    "docker_push",
    "docker_build",
    "docker_push",
    "docker_build",
    "docker_push",
  ], "service_image_publish_command_kinds");
  for (const buildCommand of servicePlan.commands.filter((command) => command.kind === "docker_build")) {
    assert.deepEqual(buildCommand.args.slice(0, 3), ["docker", "buildx", "build"], "service_build_must_use_buildx");
    assert.equal(buildCommand.args.includes("--platform"), true, "service_build_must_set_platform_flag");
    assert.equal(buildCommand.args.includes("linux/amd64"), true, "service_build_must_target_linux_amd64");
    assert.equal(buildCommand.args.includes("--push"), false, "service_build_must_not_use_inline_push");
    assert.equal(buildCommand.args.includes(":latest"), false, "service_build_must_not_use_latest");
  }
  assertNoSensitiveText(JSON.stringify(servicePlan), "service_plan");

  const serviceCommandLog = [];
  const serviceSummary = await runPackageDServiceImagesPublishPrivateBuild({
    envPath: serviceEnvPath,
    evidenceDir,
    authorized: true,
    docker: fakeServiceDockerExecutor(serviceCommandLog),
  });
  assert.equal(serviceSummary.ok, true, "service_summary_ok_with_fake_dockerfiles");
  assert.equal(serviceSummary.evidencePath.endsWith("private-build-push-redacted.json"), true, "service_evidence_path");
  assert.equal(serviceCommandLog.length, 9, "must_run_login_four_service_builds_four_pushes_after_dockerfiles_land");
  assertNoSensitiveText(JSON.stringify(serviceSummary), "service_summary");
  const serviceEvidence = JSON.parse(await readFile(serviceSummary.evidencePath, "utf8"));
  assert.equal(serviceEvidence.ok, true, "service_evidence_ok");
  assert.equal(serviceEvidence.redactionAudit.tcrSecretValueExposed, false, "service_evidence_must_hide_tcr_secret");
  assert.equal(serviceEvidence.redactionAudit.fullImageRefExposed, false, "service_evidence_must_hide_full_image_refs");
  assertNoSensitiveText(JSON.stringify(serviceEvidence), "service_evidence");

  await assert.rejects(
    () => runPackageDServiceImagesPublishPrivateBuild({ envPath: serviceEnvPath, evidenceDir }),
    /package_d_service_images_publish_not_authorized/,
    "service_missing_authorization_must_fail_closed",
  );
  const serviceEnvText = await readFile(serviceEnvPath, "utf8");
  await assert.rejects(
    () => buildPackageDServiceImagesPublishPlan({
      envPath: serviceEnvPath,
      evidenceDir,
      envText: `${serviceEnvText}PORTAL_POSTGRES_PASSWORD=secret\n`,
    }),
    /package_d_service_images_publish_forbidden_env_key:PORTAL_POSTGRES_PASSWORD/,
    "service_db_secret_must_not_be_in_image_publish_env",
  );
  for (const [key, badValue] of [
    ["PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF", "uswccr.ccs.tencentyun.com/medopl/portal-frontend:latest"],
    ["PACKAGE_D_GO_BACKEND_IMAGE_REF", "uswccr.ccs.tencentyun.com/other/medopl-go-backend:v22-package-d-20260616-001"],
    ["PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF", "uswccr.ccs.tencentyun.com/medopl/other:v22-package-d-20260616-001"],
    ["PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF", "ccr.ccs.tencentyun.com/medopl/opl-runtime-bridge:v22-package-d-20260616-001"],
  ]) {
    await assert.rejects(
      () => buildPackageDServiceImagesPublishPlan({
        envPath: serviceEnvPath,
        evidenceDir,
        envText: [
          "TCR_ID=tcr-user",
          "TCR_SECRET=tcr-secret-value",
          ...Object.entries({ ...serviceImageRefs, [key]: badValue }).map(([envKey, value]) => `${envKey}=${value}`),
          "",
        ].join("\n"),
      }),
      /package_d_service_image_ref_/,
      `bad_service_image_ref_must_fail_closed:${key}:${badValue}`,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "package_d_runner_image_publish_local_gate",
    command: PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
    route: "private_build_runner",
    imageRef,
    evidence: ".runtime/package-d-runner-image-publish/private-build-push-redacted.json",
    serviceImagesCommand: PACKAGE_D_SERVICE_IMAGES_PUBLISH_COMMAND,
    serviceImagesEvidence: ".runtime/package-d-service-images-publish/private-build-push-redacted.json",
    serviceImagesDockerfiles: expectedServiceImages.map((service) => service.dockerfile),
    serviceImagesDockerignores: expectedServiceImages.map((service) => service.dockerignore),
    realExecutionReady: false,
  }, null, 2));
} finally {
  await rm(tmp, { recursive: true, force: true });
}
