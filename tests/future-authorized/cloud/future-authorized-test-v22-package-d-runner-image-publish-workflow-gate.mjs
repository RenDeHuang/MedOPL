import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowPath = ".github/workflows/package-d-runner-image-publish.yml";
const workflow = await readFile(workflowPath, "utf8");

const imageRef = "uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001";
const workflowHeader = workflow.slice(0, workflow.indexOf("permissions:"));

function assertContains(value, expected, label) {
  assert.equal(value.includes(expected), true, `${label}_must_include:${expected}`);
}

function assertNotContains(value, forbidden, label) {
  assert.equal(value.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

assertContains(workflow, "workflow_dispatch:", "workflow");
assertNotContains(workflowHeader, "pull_request", "workflow_trigger");
assertNotContains(workflowHeader, "pull_request_target", "workflow_trigger");
assertNotContains(workflowHeader, "\n  push:", "workflow_trigger");
assert.equal(/on:\s*\n\s*workflow_dispatch:\s*\n\s*\npermissions:/u.test(workflow), true, "workflow_must_be_manual_dispatch_only");
assertContains(workflow, "environment: package-d-image-publish", "workflow");
assertContains(workflow, "package-d-image-publish requires environment secrets, not repository secrets", "workflow_environment_secret_boundary");
assertContains(workflow, "Required reviewer and branch restriction live on the GitHub Environment.", "workflow_environment_review_boundary");
assertContains(workflow, "github.ref_name != 'recovery/platform-v22-trunk' && !startsWith(github.ref_name, 'release/')", "workflow_branch_guard");
assertContains(workflow, "permissions:", "workflow_permissions");
assertContains(workflow, "contents: read", "workflow_permissions");
assert.equal(/permissions:\s*\n\s*contents:\s*read\s*\n\s*\n/u.test(workflow), true, "workflow_permissions_must_be_contents_read_only");

assertContains(workflow, `PACKAGE_D_RUNNER_IMAGE_REF: ${imageRef}`, "workflow_image_ref");
assertContains(workflow, "TENCENT_TCR_REGISTRY: uswccr.ccs.tencentyun.com", "workflow_registry");
assertContains(workflow, "TENCENT_TCR_NAMESPACE: medopl", "workflow_namespace");
assertContains(workflow, "PACKAGE_D_RUNNER_IMAGE_REPOSITORY: medopl-platform-runner", "workflow_repository");
assertContains(workflow, "PACKAGE_D_RUNNER_IMAGE_TAG: v22-package-d-20260615-001", "workflow_tag");

assertContains(workflow, "secrets.TCR_ID", "workflow_tcr_id_secret");
assertContains(workflow, "secrets.TCR_SECRET", "workflow_tcr_secret");
assertContains(workflow, "--password-stdin", "workflow_login");
assertContains(workflow, "docker build", "workflow_build");
assertContains(workflow, "docker push", "workflow_push");
assertContains(workflow, "tests/support/cloud-prework/package-d-platform-runner.Dockerfile", "workflow_dockerfile");

for (const forbidden of [
  "kubectl",
  "helm",
  "deploy",
  "CreateNodePool",
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "KUBECONFIG",
  "kubeconfig-package-d-deploy",
  "PORTAL_POSTGRES_PASSWORD",
  "PORTAL_ADMIN_PASSWORD",
  "PORTAL_POSTGRES_URL",
  "package-d-deploy.env",
  "portal-runtime.env",
  "medopl-tenant-",
  "secrets.KUBECONFIG",
  "secrets.PORTAL_POSTGRES_PASSWORD",
  "secrets.PORTAL_ADMIN_PASSWORD",
  "secrets.PORTAL_POSTGRES_URL",
  "secrets.TENCENT_SECRET_ID",
  "secrets.TENCENT_SECRET_KEY",
  "pull_request:",
  "pull_request_target:",
  "\n  push:",
  "workflow_dispatch:\n    inputs:",
  "printenv",
  "env |",
  "set |",
]) {
  assertNotContains(workflow, forbidden, "workflow_boundary");
}

assertNotContains(workflow, ":latest", "workflow_image_tag");
assertNotContains(workflow, "PACKAGE_D_RUNNER_IMAGE_TAG: latest", "workflow_image_tag");
assert.equal((workflow.match(/secrets\.[A-Z0-9_]+/gu) || []).sort().join(","), "secrets.TCR_ID,secrets.TCR_SECRET", "workflow_secrets_must_only_be_tcr");
assert.equal(/echo\s+.*secrets\./u.test(workflow), false, "workflow_must_not_echo_secret_expression");
assert.equal(/docker\s+build[\s\S]*-t\s+\$\{\{\s*env\.PACKAGE_D_RUNNER_IMAGE_REF\s*\}\}/u.test(workflow), true, "docker_build_must_use_fixed_env_image_ref");
assert.equal(/docker\s+push\s+\$\{\{\s*env\.PACKAGE_D_RUNNER_IMAGE_REF\s*\}\}/u.test(workflow), true, "docker_push_must_use_fixed_env_image_ref");
assert.equal(/\$\{\{\s*secrets\.TCR_SECRET\s*\}\}[\s\S]*docker\s+login/u.test(workflow), true, "tcr_secret_must_only_feed_login");

console.log(JSON.stringify({
  ok: true,
  contract: "package_d_runner_image_publish_workflow_gate",
  workflow: workflowPath,
  route: "github_actions_workflow_dispatch",
  environment: "package-d-image-publish",
  requiredSecrets: ["TCR_ID", "TCR_SECRET"],
  imageRef,
  realExecutionReady: false,
}, null, 2));
