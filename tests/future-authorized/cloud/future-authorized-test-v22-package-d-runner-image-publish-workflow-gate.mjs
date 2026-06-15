import assert from "node:assert/strict";
import { stat } from "node:fs/promises";

import {
  PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
  PACKAGE_D_RUNNER_IMAGE_PUBLISH_WORKFLOW,
  buildPackageDRunnerImagePublishPlan,
} from "../../support/cloud-prework/package-d-runner-image-publish-runner.js";

const imageRef = "uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001";

await assert.rejects(
  () => stat(PACKAGE_D_RUNNER_IMAGE_PUBLISH_WORKFLOW),
  /ENOENT/u,
  "github_actions_image_publish_workflow_must_be_removed_from_current_live_path",
);

assert.equal(
  PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
  "node tests/support/cloud-prework/package-d-runner-image-publish-runner.js --mode private-build-push --env /home/dev/.secrets/medopl/v22/package-d-deploy.env --authorized 1",
  "current_publish_command_must_be_private_build_runner",
);

const plan = await buildPackageDRunnerImagePublishPlan({
  imageRef,
  deployEnvText: [
    "TCR_ID=redacted-user",
    "TCR_SECRET=redacted-secret",
    `PACKAGE_D_RUNNER_IMAGE_REF=${imageRef}`,
    "",
  ].join("\n"),
});

assert.equal(plan.route, "private_build_runner", "current_live_route_must_be_private_build_runner");
assert.equal(plan.githubActions.status, "removed_from_current_live_path", "github_actions_must_not_be_current_live_path");
assert.equal(plan.githubActions.currentLivePath, false, "github_actions_current_live_path_false");
assert.deepEqual(plan.privateBuildRunner.allowedEnvKeys, ["TCR_ID", "TCR_SECRET", "PACKAGE_D_RUNNER_IMAGE_REF"], "private_build_allowed_keys");
assert.deepEqual(plan.privateBuildRunner.forbiddenSecretClasses, ["kubeconfig", "DB password", "Portal admin password", "Tencent SecretId/SecretKey"], "private_build_forbidden_secret_classes");
assert.equal(plan.image.registry, "uswccr.ccs.tencentyun.com", "registry_fixed");
assert.equal(plan.image.namespace, "medopl", "namespace_fixed");
assert.equal(plan.image.repository, "medopl-platform-runner", "repository_fixed");
assert.equal(plan.image.tag, "v22-package-d-20260615-001", "tag_fixed");
assert.equal(plan.image.floatingTagAllowed, false, "latest_must_be_forbidden");
assert.equal(plan.boundary.deployAllowed, false, "deploy_forbidden");
assert.equal(plan.boundary.clusterCommandAllowed, false, "kubectl_forbidden");
assert.equal(plan.boundary.tencentMutationAllowed, false, "tencent_mutation_forbidden");
assert.equal(plan.boundary.packageCLiveAllowed, false, "package_c_live_forbidden");

console.log(JSON.stringify({
  ok: true,
  contract: "package_d_runner_image_publish_workflow_gate",
  route: "private_build_runner",
  githubActions: "removed_from_current_live_path",
  requiredEnvKeys: ["TCR_ID", "TCR_SECRET", "PACKAGE_D_RUNNER_IMAGE_REF"],
  imageRef,
  realExecutionReady: false,
}, null, 2));
