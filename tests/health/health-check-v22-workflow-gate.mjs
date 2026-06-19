import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  changePackageTypes,
  evaluateCheckpoint,
  evaluateReview,
  renderStartTemplate,
} from "../../scripts/v22-workflow-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const workflowModuleFiles = [
  "scripts/workflow-gate/git-diff.mjs",
  "scripts/workflow-gate/policy.mjs",
  "scripts/workflow-gate/change-package.mjs",
  "scripts/workflow-gate/command-reference.mjs",
  "scripts/workflow-gate/report.mjs",
];

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
  "推荐 change package",
  "Portal / UI change package",
  "docs/specs/README.md",
  "本次不修改项",
  "污染防护",
  "推荐验证命令",
  "node tests/suites/suite-test-v22-mvp.mjs",
  "npm --prefix services/portal run frontend:typecheck",
], "start_output");

const startTemplate = renderStartTemplate({ type: "tencent-quote" });
assertIncludesAll(startTemplate, [
  "Tencent Quote Provider change package",
  "docs/specs/README.md",
  "docs/specs/README.md",
  "node tests/cloud/cloud-test-v22-tencent-readonly-inventory-boundary.mjs",
], "tencent_quote_start_template");

function localTestFilesFromTemplate(template) {
  return [...template.matchAll(/\b(?:node\s+)?(tests\/[^\s`'"]+\.mjs)\b/gu)]
    .map((match) => match[1])
    .sort();
}

async function assertLocalTestFilesExist(template, label) {
  for (const filePath of localTestFilesFromTemplate(template)) {
    await access(path.join(repoRoot, filePath)).catch((error) => {
      throw new Error(`${label}_references_missing_test_file:${filePath}:${error.message}`);
    });
  }
}

for (const type of changePackageTypes) {
  const template = renderStartTemplate({ type });
  assertIncludesAll(template, [
    "docs/specs/README.md",
  ], `workflow_start_template_must_subscribe_ux_truth:${type}`);
  await assertLocalTestFilesExist(template, `workflow_start_template_${type}`);
}

assert.deepEqual(changePackageTypes, [
  "portal-ui",
  "gateway",
  "runtime",
  "langfuse-trace",
  "resource-billing",
  "tencent-quote",
  "cleanup",
], "change_package_types_mismatch");

const reviewWithBlockers = evaluateReview({
  base: "recovery/platform-v22-trunk",
  activeChangePackageNames: [],
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
assert(reviewWithBlockers.findings.some((finding) => finding.code === "services_changed_without_eval_plan_update"), "review_must_require_service_eval_plan_update");
assert(reviewWithBlockers.findings.some((finding) => finding.code === "specs_changed_without_eval_plan_update"), "review_must_require_spec_eval_plan_update");
assert(reviewWithBlockers.findings.some((finding) => finding.code === "formal_change_without_active_change_package"), "review_must_require_active_change_package");
assertIncludesAll(reviewWithBlockers.recommendedCommands.join("\n"), [
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "npm --prefix services/portal run check",
], "review_recommended_commands");

const reviewWithArchivedSentruxRulesChange = evaluateReview({
  base: "recovery/platform-v22-trunk",
  changedFiles: [
    ".sentrux/rules.toml",
    "changes/archive/2026-06-19-sentrux-v22-rules-alignment/proposal.md",
    "changes/archive/2026-06-19-sentrux-v22-rules-alignment/spec-delta.md",
    "changes/archive/2026-06-19-sentrux-v22-rules-alignment/eval-plan.md",
    "changes/archive/2026-06-19-sentrux-v22-rules-alignment/closeout.md",
  ],
});
assert.equal(reviewWithArchivedSentruxRulesChange.ok, false, "archived_sentrux_rules_change_must_not_authorize_sentrux_write");
assert.deepEqual(reviewWithArchivedSentruxRulesChange.forbiddenPaths, [".sentrux/rules.toml"], "archived_sentrux_rules_change_must_still_block_sentrux_path");

const reviewWithTokenNamedSmoke = evaluateReview({
  base: "recovery/platform-v22-trunk",
  changedFiles: [
    "changes/archive/2026-05-23-repo-native-change-lifecycle/proposal.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/spec-delta.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/eval-plan.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/closeout.md",
    "tests/regression/opl/regression-test-v22-gflabtoken-entry-contract.mjs",
  ],
});

assert.equal(reviewWithTokenNamedSmoke.ok, true, "v22_smoke_file_with_token_in_name_must_not_be_secret_like_path");
assert.deepEqual(reviewWithTokenNamedSmoke.secretLikePaths, [], "v22_smoke_file_with_token_in_name_secret_like_paths_must_be_empty");

const reviewWithDeletedLegacySecretNamedTest = evaluateReview({
  base: "recovery/platform-v22-trunk",
  changedFiles: [
    "tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs",
  ],
  changedStatuses: new Map([
    ["tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs", "D"],
  ]),
});
assert.deepEqual(reviewWithDeletedLegacySecretNamedTest.secretLikePaths, [], "deleted_legacy_secret_named_test_must_not_be_secret_like_path");
assert.equal(
  reviewWithDeletedLegacySecretNamedTest.findings.some((finding) => finding.code === "secret_like_path_changed"),
  false,
  "deleted_legacy_secret_named_test_must_not_report_secret_like_path",
);

const reviewWithSmoke = evaluateReview({
  base: "recovery/platform-v22-trunk",
  changedFiles: [
    "changes/archive/2026-05-23-repo-native-change-lifecycle/proposal.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/spec-delta.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/eval-plan.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/closeout.md",
    "services/portal/src/domain/example.mjs",
    "docs/specs/README.md",
    "tests/contracts/contract-test-v22-example-boundary.mjs",
  ],
});
assert.equal(reviewWithSmoke.findings.some((finding) => finding.code === "services_changed_without_eval_plan_update"), false, "review_must_accept_service_eval_plan_update");
assert.equal(reviewWithSmoke.findings.some((finding) => finding.code === "specs_changed_without_eval_plan_update"), false, "review_must_accept_spec_eval_plan_update");

const reviewWithUnboundChangePackage = evaluateReview({
  base: "recovery/platform-v22-trunk",
  changedFiles: [
    "changes/archive/2026-05-23-unbound-change/proposal.md",
    "services/portal/src/domain/example.mjs",
  ],
});
assert.equal(reviewWithUnboundChangePackage.ok, false, "review_must_block_unbound_change_package");
assert(reviewWithUnboundChangePackage.findings.some((finding) => finding.code === "formal_change_package_missing_spec_or_eval_plan"), "review_must_require_change_package_spec_and_eval_binding");

const reviewWithMissingCompletionAudit = evaluateReview({
  base: "recovery/platform-v22-trunk",
  changedFiles: [
    "changes/archive/2026-05-23-repo-native-change-lifecycle/proposal.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/spec-delta.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/eval-plan.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/closeout.md",
    "services/portal/src/domain/example.mjs",
    "tests/contracts/contract-test-v22-example-boundary.mjs",
  ],
  changedStatuses: new Map([
    ["changes/archive/2026-05-23-repo-native-change-lifecycle/closeout.md", "M"],
  ]),
});
assert.equal(reviewWithMissingCompletionAudit.ok, true, "archive_provenance_package_must_not_require_current_completion_audit_shape");
assert.equal(
  reviewWithMissingCompletionAudit.findings.some((finding) => finding.code === "formal_change_package_missing_completion_audit"),
  false,
  "archive_provenance_package_must_not_report_missing_current_completion_audit",
);

const fullTaxonomyAuthorizedDeletes = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  branchName: "cleanup/v22-full-taxonomy-hard-retirement",
  activeChangePackageNames: ["full-taxonomy-hard-retirement"],
  changedFiles: [
    "changes/archive/2026-05-23-repo-native-change-lifecycle/proposal.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/spec-delta.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/eval-plan.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/closeout.md",
    ["docs", "contracts", "v22-smoke-eval-boundary.md"].join("/"),
    ["docs", "recovery", "status-matrix.md"].join("/"),
    ["docs", "product.md"].join("/"),
    ["scripts", ["v22", "agent", "workflow"].join("-") + ".mjs"].join("/"),
    "tests/regression/opl/smoke-test-v22-gflabtoken-entry-contract.mjs",
  ],
  changedStatuses: new Map([
    [["docs", "contracts", "v22-smoke-eval-boundary.md"].join("/"), "D"],
    [["docs", "recovery", "status-matrix.md"].join("/"), "D"],
    [["docs", "product.md"].join("/"), "D"],
    [["scripts", ["v22", "agent", "workflow"].join("-") + ".mjs"].join("/"), "D"],
    ["tests/regression/opl/smoke-test-v22-gflabtoken-entry-contract.mjs", "D"],
  ]),
});
assert.equal(fullTaxonomyAuthorizedDeletes.ok, true, "full_taxonomy_authorized_deletes_must_be_ok");
assert.deepEqual(fullTaxonomyAuthorizedDeletes.forbiddenPaths, [], "full_taxonomy_deletes_forbidden_paths_must_be_empty");
assert.deepEqual(fullTaxonomyAuthorizedDeletes.secretLikePaths, [], "full_taxonomy_deletes_secret_like_paths_must_be_empty");
assert.deepEqual(fullTaxonomyAuthorizedDeletes.authorizedCleanupDeletions, [
  ["docs", "contracts", "v22-smoke-eval-boundary.md"].join("/"),
  ["docs", "recovery", "status-matrix.md"].join("/"),
  ["docs", "product.md"].join("/"),
  ["scripts", ["v22", "agent", "workflow"].join("-") + ".mjs"].join("/"),
  "tests/regression/opl/smoke-test-v22-gflabtoken-entry-contract.mjs",
], "full_taxonomy_delete_authorization_mismatch");

const strictCleanupAuthorizedDeletes = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  branchName: "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement",
  activeChangePackageNames: ["strict-monolith-ideal-gap-and-legacy-retirement"],
  changedFiles: [
    "changes/archive/2026-05-23-repo-native-change-lifecycle/proposal.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/spec-delta.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/eval-plan.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/closeout.md",
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
    "changes/archive/2026-05-23-repo-native-change-lifecycle/proposal.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/spec-delta.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/eval-plan.md",
    "changes/archive/2026-05-23-repo-native-change-lifecycle/closeout.md",
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

const nodeBackendPhysicalRemovalDeletes = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  branchName: "cleanup/v22-node-backend-physical-removal",
  activeChangePackageNames: ["node-backend-physical-removal"],
  changedFiles: [
    "changes/archive/2026-05-23-golden-path-first-class/proposal.md",
    "changes/archive/2026-05-23-golden-path-first-class/spec-delta.md",
    "changes/archive/2026-05-23-golden-path-first-class/eval-plan.md",
    "changes/archive/2026-05-23-golden-path-first-class/closeout.md",
    "services/portal/src/domain/provider-secret-store.mjs",
    "tests/local-rc/local-rc-test-v22-provider-bound-message-backflow.mjs",
  ],
  changedStatuses: new Map([
    ["services/portal/src/domain/provider-secret-store.mjs", "D"],
    ["tests/local-rc/local-rc-test-v22-provider-bound-message-backflow.mjs", "D"],
  ]),
});
assert.equal(nodeBackendPhysicalRemovalDeletes.ok, true, "node_backend_physical_removal_authorized_deletes_must_be_ok");
assert.deepEqual(nodeBackendPhysicalRemovalDeletes.secretLikePaths, [], "node_backend_physical_removal_deletes_secret_like_paths_must_be_empty");
assert.deepEqual(nodeBackendPhysicalRemovalDeletes.authorizedCleanupDeletions, [
  "services/portal/src/domain/provider-secret-store.mjs",
  "tests/local-rc/local-rc-test-v22-provider-bound-message-backflow.mjs",
], "node_backend_physical_removal_delete_authorization_mismatch");

const nodeBackendPhysicalRemovalModifiedSecretLike = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  branchName: "cleanup/v22-node-backend-physical-removal",
  changedFiles: [
    "changes/archive/2026-05-23-golden-path-first-class/proposal.md",
    "changes/archive/2026-05-23-golden-path-first-class/spec-delta.md",
    "changes/archive/2026-05-23-golden-path-first-class/eval-plan.md",
    "changes/archive/2026-05-23-golden-path-first-class/closeout.md",
    "services/portal/src/domain/provider-secret-store.mjs",
  ],
  changedStatuses: new Map([
    ["services/portal/src/domain/provider-secret-store.mjs", "M"],
  ]),
});
assert.equal(nodeBackendPhysicalRemovalModifiedSecretLike.ok, false, "node_backend_physical_removal_modified_secret_like_must_block");
assert.deepEqual(nodeBackendPhysicalRemovalModifiedSecretLike.authorizedCleanupDeletions, [], "node_backend_physical_removal_modified_secret_like_must_not_be_authorized");
assert.deepEqual(nodeBackendPhysicalRemovalModifiedSecretLike.secretLikePaths, [
  "services/portal/src/domain/provider-secret-store.mjs",
], "node_backend_physical_removal_modified_secret_like_mismatch");

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
  "landing operator",
  "landing gate",
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
const gateLineCount = gateSource.trimEnd().split("\n").length;
assert(gateLineCount < 400, `workflow_gate_cli_must_be_thin:${gateLineCount}`);
assertIncludesAll(gateSource, [
  "from \"./workflow-gate/git-diff.mjs\"",
  "from \"./workflow-gate/policy.mjs\"",
  "from \"./workflow-gate/change-package.mjs\"",
  "from \"./workflow-gate/command-reference.mjs\"",
  "from \"./workflow-gate/report.mjs\"",
  "export {",
  "findMissingLocalCommandReferences",
  "evaluateReview",
  "evaluateCheckpoint",
], "workflow_gate_cli_split_source");
for (const repoPath of workflowModuleFiles) {
  await access(path.join(repoRoot, repoPath)).catch((error) => {
    throw new Error(`workflow_gate_split_module_missing:${repoPath}:${error.message}`);
  });
}
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
  contract: "v22_change_package_workflow_gate",
  covered: [
    "start_template_stage_docs_change_package_eval_commands",
    "review_forbidden_paths_secret_like_paths_service_and_spec_eval_updates",
    "checkpoint_trunk_clean_ahead_ssh_token_free_remote",
    "thin_cli_with_split_modules_and_compatible_exports",
    "no_secret_file_read_no_push_build_kubectl_live_test",
  ],
}, null, 2));
