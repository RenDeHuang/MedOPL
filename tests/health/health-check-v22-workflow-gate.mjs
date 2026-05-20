import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  contractPackageTypes,
  evaluateCheckpoint,
  evaluateReview,
  renderStartTemplate,
} from "../../scripts/v22-workflow-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function runGate(args) {
  return spawnSync(process.execPath, ["scripts/v22-workflow-gate.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

const startResult = runGate(["start", "--type", "portal-ui"]);
assert.equal(startResult.status, 0, "start_cli_must_exit_zero");
assertIncludesAll(startResult.stdout, [
  "分支意图",
  "当前必须读取的阶段文档",
  "AGENTS.md",
  "docs/active/README.md",
  "docs/specs/README.md",
  "docs/policies/README.md",
  "docs/delivery/README.md",
  "推荐合同包",
  "Portal / UI 合同包",
  "docs/specs/README.md",
  "本次不修改项",
  "污染防护",
  "推荐验证命令",
  "node tests/contract/contract-test-v22-mvp-contract-suite.mjs",
  "npm --prefix services/portal run frontend:typecheck",
], "start_output");

const startTemplate = renderStartTemplate({ type: "tencent-quote" });
assertIncludesAll(startTemplate, [
  "Tencent Quote Provider 合同包",
  "docs/specs/README.md",
  "docs/specs/README.md",
  "node tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-quote-provider-boundary.mjs",
], "tencent_quote_start_template");

for (const type of contractPackageTypes) {
  assertIncludesAll(renderStartTemplate({ type }), [
    "docs/specs/README.md",
  ], `workflow_start_template_must_subscribe_ux_truth:${type}`);
}

assert.deepEqual(contractPackageTypes, [
  "portal-ui",
  "gateway",
  "runtime",
  "langfuse-trace",
  "resource-billing",
  "tencent-quote",
  "cleanup",
], "contract_package_types_mismatch");

const reviewWithBlockers = evaluateReview({
  base: "recovery/platform-v22-trunk",
  changedFiles: [
    "deploy/manual/values.yaml",
    ".sentrux/rules.toml",
    "adapters/tencent/provider.mjs",
    "one-person-lab/upstream/internal.js",
    ".env.production",
    "local/github",
    "services/portal/src/domain/example.mjs",
    "docs/specs/README.md",
  ],
});

assert.equal(reviewWithBlockers.ok, false, "review_with_blockers_must_not_be_ok");
assert.deepEqual(reviewWithBlockers.forbiddenPaths, [
  "deploy/manual/values.yaml",
  ".sentrux/rules.toml",
  "adapters/tencent/provider.mjs",
  "one-person-lab/upstream/internal.js",
], "review_forbidden_paths_mismatch");
assert.deepEqual(reviewWithBlockers.secretLikePaths, [
  ".env.production",
  "local/github",
], "review_secret_like_paths_mismatch");
assert(reviewWithBlockers.findings.some((finding) => finding.code === "services_changed_without_v22_smoke_update"), "review_must_require_service_smoke_update");
assert(reviewWithBlockers.findings.some((finding) => finding.code === "contracts_changed_without_v22_smoke_update"), "review_must_require_contract_smoke_update");
assertIncludesAll(reviewWithBlockers.recommendedCommands.join("\n"), [
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "npm --prefix services/portal run check",
], "review_recommended_commands");

const reviewWithTokenNamedSmoke = evaluateReview({
  base: "recovery/platform-v22-trunk",
  changedFiles: [
    "tests/regression/opl/regression-test-v22-gflabtoken-entry-contract.mjs",
  ],
});

assert.equal(reviewWithTokenNamedSmoke.ok, true, "v22_smoke_file_with_token_in_name_must_not_be_secret_like_path");
assert.deepEqual(reviewWithTokenNamedSmoke.secretLikePaths, [], "v22_smoke_file_with_token_in_name_secret_like_paths_must_be_empty");

const reviewWithSmoke = evaluateReview({
  base: "recovery/platform-v22-trunk",
  changedFiles: [
    "services/portal/src/domain/example.mjs",
    "docs/specs/README.md",
    "tests/contract/contract-test-v22-example-boundary.mjs",
  ],
});
assert.equal(reviewWithSmoke.findings.some((finding) => finding.code === "services_changed_without_v22_smoke_update"), false, "review_must_accept_service_smoke_update");
assert.equal(reviewWithSmoke.findings.some((finding) => finding.code === "contracts_changed_without_v22_smoke_update"), false, "review_must_accept_contract_smoke_update");

const fullTaxonomyAuthorizedDeletes = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  branchName: "cleanup/v22-full-taxonomy-hard-retirement",
  changedFiles: [
    ["docs", "contracts", "v22-smoke-eval-boundary.md"].join("/"),
    ["docs", "recovery", "status-matrix.md"].join("/"),
    ["docs", "product.md"].join("/"),
    ["scripts", ["v22", "agent", "workflow"].join("-") + ".mjs"].join("/"),
    "tests/contract/contract-test-v22-goal-state-consistency.mjs",
  ],
  changedStatuses: new Map([
    [["docs", "contracts", "v22-smoke-eval-boundary.md"].join("/"), "D"],
    [["docs", "recovery", "status-matrix.md"].join("/"), "D"],
    [["docs", "product.md"].join("/"), "D"],
    [["scripts", ["v22", "agent", "workflow"].join("-") + ".mjs"].join("/"), "D"],
    ["tests/contract/contract-test-v22-goal-state-consistency.mjs", "D"],
  ]),
});
assert.equal(fullTaxonomyAuthorizedDeletes.ok, true, "full_taxonomy_authorized_deletes_must_be_ok");
assert.deepEqual(fullTaxonomyAuthorizedDeletes.forbiddenPaths, [], "full_taxonomy_deletes_forbidden_paths_must_be_empty");
assert.deepEqual(fullTaxonomyAuthorizedDeletes.authorizedCleanupDeletions, [
  ["docs", "contracts", "v22-smoke-eval-boundary.md"].join("/"),
  ["docs", "recovery", "status-matrix.md"].join("/"),
  ["docs", "product.md"].join("/"),
  ["scripts", ["v22", "agent", "workflow"].join("-") + ".mjs"].join("/"),
  "tests/contract/contract-test-v22-goal-state-consistency.mjs",
], "full_taxonomy_delete_authorization_mismatch");

const strictCleanupAuthorizedDeletes = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  branchName: "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement",
  changedFiles: [
    "adapters/resource-provisioner/package.json",
    "deploy/tke-package/README.md",
  ],
  changedStatuses: new Map([
    ["adapters/resource-provisioner/package.json", "D"],
    ["deploy/tke-package/README.md", "D"],
  ]),
});
assert.equal(strictCleanupAuthorizedDeletes.ok, true, "strict_cleanup_authorized_deletes_must_be_ok");
assert.deepEqual(strictCleanupAuthorizedDeletes.forbiddenPaths, [], "strict_cleanup_delete_forbidden_paths_must_be_empty");
assert.deepEqual(strictCleanupAuthorizedDeletes.authorizedCleanupDeletions, [
  "adapters/resource-provisioner/package.json",
  "deploy/tke-package/README.md",
], "strict_cleanup_delete_authorization_mismatch");

const strictCleanupModifiedZone4 = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  branchName: "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement",
  changedFiles: [
    "adapters/resource-provisioner/package.json",
    "deploy/tke-package/README.md",
  ],
  changedStatuses: new Map([
    ["adapters/resource-provisioner/package.json", "M"],
    ["deploy/tke-package/README.md", "A"],
  ]),
});
assert.equal(strictCleanupModifiedZone4.ok, false, "strict_cleanup_modified_zone4_must_block");
assert.deepEqual(strictCleanupModifiedZone4.authorizedCleanupDeletions, [], "strict_cleanup_modified_zone4_must_not_be_authorized");
assert.deepEqual(strictCleanupModifiedZone4.forbiddenPaths, [
  "adapters/resource-provisioner/package.json",
  "deploy/tke-package/README.md",
], "strict_cleanup_modified_zone4_forbidden_paths_mismatch");

const checkpointReady = evaluateCheckpoint({
  branchName: "recovery/platform-v22-trunk",
  statusPorcelain: "",
  aheadCount: 2,
  remoteUrl: "git@github.com:medopl/platform-v22.git",
});
assert.equal(checkpointReady.ok, true, "checkpoint_ready_must_be_ok");
assert.equal(checkpointReady.checks.onTrunk.ok, true, "checkpoint_must_recognize_trunk");
assert.equal(checkpointReady.checks.worktreeClean.ok, true, "checkpoint_must_recognize_clean_worktree");
assert.equal(checkpointReady.checks.aheadOrigin.ok, true, "checkpoint_must_recognize_ahead_origin");
assert.equal(checkpointReady.checks.remoteSsh.ok, true, "checkpoint_must_recognize_ssh_remote");
assert.equal(checkpointReady.checks.remoteNoToken.ok, true, "checkpoint_must_accept_token_free_remote");
assertIncludesAll(checkpointReady.pushChecklist.join("\n"), [
  "确认工作区干净",
  "确认没有 secret 被 tracked",
  "只由 B 窗口执行 push",
], "checkpoint_push_checklist");

const checkpointBlocked = evaluateCheckpoint({
  branchName: "feat/v22-contract-first-workflow-gate",
  statusPorcelain: " M scripts/v22-workflow-gate.mjs",
  aheadCount: 0,
  remoteUrl: "https://ghp_exampletoken@github.com/medopl/platform-v22.git",
});
assert.equal(checkpointBlocked.ok, false, "checkpoint_blocked_must_not_be_ok");
assert.equal(checkpointBlocked.checks.onTrunk.ok, false, "checkpoint_must_block_non_trunk");
assert.equal(checkpointBlocked.checks.worktreeClean.ok, false, "checkpoint_must_block_dirty_worktree");
assert.equal(checkpointBlocked.checks.aheadOrigin.ok, false, "checkpoint_must_block_not_ahead");
assert.equal(checkpointBlocked.checks.remoteSsh.ok, false, "checkpoint_must_block_non_ssh_remote");
assert.equal(checkpointBlocked.checks.remoteNoToken.ok, false, "checkpoint_must_block_token_remote");

const gateSource = await readFile(path.join(repoRoot, "scripts/v22-workflow-gate.mjs"), "utf8");
const workflowSmokeSource = await readFile(fileURLToPath(import.meta.url), "utf8");
assertNotIncludesAny(workflowSmokeSource, [
  ["deploy/tke-package", "/values.yaml"].join(""),
], "workflow_gate_smoke_source");
assertNotIncludesAny(gateSource, [
  ["deploy/tke-package", "/values.yaml"].join(""),
  "spawnSync(\"git\", [\"push\"",
  "spawnSync(\"kubectl\"",
  "spawnSync(\"docker\", [\"build\"",
  "execFileSync(\"git\", [\"push\"",
  "execFileSync(\"kubectl\"",
  "execFileSync(\"docker\", [\"build\"",
  "readFile(",
  "secrets.env.txt",
], "workflow_gate_source");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_contract_first_workflow_gate",
  covered: [
    "start_template_stage_docs_contract_package_validation_commands",
    "review_forbidden_paths_secret_like_paths_service_and_contract_smoke_updates",
    "checkpoint_trunk_clean_ahead_ssh_token_free_remote",
    "no_secret_file_read_no_push_build_kubectl_live_test",
  ],
}, null, 2));
