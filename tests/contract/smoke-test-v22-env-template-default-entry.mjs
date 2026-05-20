import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const filePaths = {
  envDemo: ".env.demo.template",
  legacyBacklog: "docs/recovery/legacy-cleanup-backlog.md",
  repoZoning: "docs/recovery/repo-zoning.md",
};

const allowedDiffPaths = new Set([
  ".env.demo.template",
  "docs/recovery/legacy-cleanup-backlog.md",
  "docs/recovery/repo-zoning.md",
  "tests/contract/smoke-test-v22-default-entry-narrative-gate.mjs",
  "tests/contract/smoke-test-v22-env-template-default-entry.mjs",
]);

const branchScopedAllowedDiffPatterns = new Map([
  ["cleanup/v22-zero-compat-contract-smoke-physical-retirement", [
    "OPL-v20-*",
    "docs/status.md",
    "docs/contracts/v22-*",
    "docs/recovery/*",
    "docs/plan/**",
    "docs/reports/**",
    "docs/releases/**",
    "docs/logs/**",
    "docs/operations/**",
    "docs/superpowers/**",
    "scripts/fixtures/opl-product-api-fixture.mjs",
    "tests/**/*.mjs",
    "scripts/v22-test-classification.mjs",
    "scripts/v22-verify.mjs",
    "services/portal/src/migrate-schema.mjs",
    "services/portal/src/portal-cloud-operation-worker.mjs",
    "services/portal/src/app/portal-auth-runtime-handler.mjs",
    "services/portal/src/app/portal-http-dispatcher.mjs",
    "services/portal/src/app/portal-workspace-runtime.mjs",
    "services/portal/src/app/portal-runtime-observability.mjs",
    "services/portal/src/app/portal-page-overview-payloads.mjs",
    "services/portal/src/app/portal-page-payload-helpers.mjs",
    "services/portal/src/app/portal-page-workspace-payloads.mjs",
    "services/portal/src/app/portal-server-plan-runtime-handler.mjs",
    "services/portal/src/domain/**",
    "services/portal/src/routes/**",
    "services/portal/src/state/**",
    "services/portal/src/state/portal-platform-provisioned-resource-store.mjs",
    "services/portal/frontend/src/**",
    "services/opl-web-gateway/src/**",
    "services/opl-runtime-bridge/src/**",
  ]],
]);

function globToRegExp(pattern) {
  const escapedParts = String(pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escapedParts.join(".*")}$`, "u");
}

const forbiddenEnvTerms = [
  "MED_AUTOSCIENCE_RUNNER_URL",
  "MED_AUTOSCIENCE_RUNNER_TOKEN",
  "MED_AUTOSCIENCE_RUNNER_IMAGE",
  "med-autoscience-runner",
  "RESOURCE_PROVISIONER_URL",
  "RESOURCE_PROVISIONER_IMAGE",
  "resource-provisioner",
  "PRODUCT_RUNTIME_MODE=user_owned",
  "resource-order",
  "OPENCOST_BASE_URL",
  "LANGFUSE_IMAGE",
  "LANGFUSE_WORKER_IMAGE",
];

const secretLikeValuePatterns = [
  /sk-[A-Za-z0-9_-]{16,}/u,
  /gh[pousr]_[A-Za-z0-9_]{16,}/u,
  /github_pat_[A-Za-z0-9_]{16,}/u,
  /AKID[A-Za-z0-9]{12,}/u,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /x-access-token[:=][A-Za-z0-9._-]+/iu,
  /Bearer\s+[A-Za-z0-9._-]{20,}/u,
  /^(?:SecretId|SecretKey|TENCENT_[A-Z_]*SECRET[A-Z_]*|LANGFUSE_SECRET_KEY|ZITADEL_ADMIN_BEARER_TOKEN)[ \t]*=[ \t]*[^#\s$][^\r\n#]*/mu,
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertDoesNotInclude(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function assertMatches(source, pattern, label) {
  assert.match(source, pattern, `${label}_missing:${pattern.source}`);
}

function assertDoesNotMatch(source, pattern, label) {
  assert.doesNotMatch(source, pattern, `${label}_must_not_match:${pattern.source}`);
}

function changedFilesFromBase() {
  const outputs = [
    ["diff", "--name-only", "origin/recovery/platform-v22-trunk"],
    ["ls-files", "--others", "--exclude-standard"],
  ].map((args) => {
    const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    assert.equal(result.status, 0, `git_${args.join("_")}_failed:${result.stderr || result.stdout}`);
    return result.stdout;
  });
  return [...new Set(outputs
    .flatMap((output) => output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)))];
}

function currentBranchName() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_branch_show_current_failed:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function assertOnlyAllowedFilesChanged() {
  const branchName = currentBranchName();
  const branchAllowedDiffPatterns = (branchScopedAllowedDiffPatterns.get(branchName) ?? []).map(globToRegExp);
  for (const filePath of changedFilesFromBase()) {
    assert(
      allowedDiffPaths.has(filePath) || branchAllowedDiffPatterns.some((pattern) => pattern.test(filePath)),
      `env_template_branch_modified_unsubscribed_file:${filePath}`,
    );
  }
}

function assertNoSecretLikeValues(source, label) {
  for (const pattern of secretLikeValuePatterns) {
    assertDoesNotMatch(source, pattern, `${label}_secret_like_value`);
  }
}

function assertEnvTemplateBoundary(source) {
  for (const forbidden of forbiddenEnvTerms) {
    assertDoesNotInclude(source, forbidden, "env_template_default_entry");
  }

  assertDoesNotMatch(source, /^K8S_NAMESPACE[ \t]*=/mu, "env_template_k8s_namespace_default");
  assertMatches(source, /^PRODUCT_RUNTIME_MODE=platform_provisioned$/mu, "env_template_platform_runtime_mode");
  assertDoesNotMatch(source, /^PRODUCT_RUNTIME_MODE=user_owned$/mu, "env_template_user_owned_runtime_mode");

  assertIncludes(source, "Langfuse is optional sanitized trace attachment only", "env_template_langfuse_optional_sanitized_note");
  assertMatches(source, /^LANGFUSE_URL=$/mu, "env_template_langfuse_url_empty");
  assertMatches(source, /^LANGFUSE_PUBLIC_KEY=$/mu, "env_template_langfuse_public_key_empty");
  assertMatches(source, /^LANGFUSE_SECRET_KEY=$/mu, "env_template_langfuse_secret_key_empty");

  assertIncludes(source, "OpenCost is not billing truth in this template", "env_template_opencost_not_billing_truth_note");
}

function assertRecoveryRecords({ legacyBacklog, repoZoning }) {
  assertIncludes(legacyBacklog, "Env Template Default Entry", "legacy_backlog_env_template_slice");
  assertIncludes(legacyBacklog, "cleanup/v22-env-template-default-entry", "legacy_backlog_env_template_branch");
  assertIncludes(legacyBacklog, "completed on cleanup/v22-env-template-default-entry", "legacy_backlog_env_template_completed_note");
  assertIncludes(legacyBacklog, "content-level secret scan", "legacy_backlog_env_template_secret_scan_record");
  assertIncludes(repoZoning, "| `.env.demo.template` | Zone 2 | review/rewrite |", "repo_zoning_env_template_zone2_record");
  assertIncludes(repoZoning, "env-template cleanup completed", "repo_zoning_env_template_completed_note");
  assertIncludes(repoZoning, "secret_like_path_changed", "repo_zoning_workflow_gate_blocker_record");
}

const sources = Object.fromEntries(await Promise.all(
  Object.entries(filePaths).map(async ([key, filePath]) => [key, await readRepoFile(filePath)]),
));

assertOnlyAllowedFilesChanged();
assertEnvTemplateBoundary(sources.envDemo);
assertRecoveryRecords(sources);

for (const [label, source] of Object.entries(sources)) {
  assertNoSecretLikeValues(source, label);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_env_template_default_entry",
  protectedEntrypoints: [
    filePaths.envDemo,
  ],
  retainedDefaults: [
    "v22_portal_gateway_runtime_bridge_local_template",
    "platform_provisioned_runtime_mode",
    "optional_sanitized_langfuse_trace_attachment_empty_by_default",
  ],
  retiredDefaults: [
    "legacy_med_autoscience_runner",
    "legacy_k8s_namespace_default",
    "legacy_opencost_billing_truth",
    "legacy_langfuse_stack_images",
    "user_owned_runtime_mode",
    "resource_order_primary_path",
    "resource_provisioner_default_path",
  ],
}, null, 2));
