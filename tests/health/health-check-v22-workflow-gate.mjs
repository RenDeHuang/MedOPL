import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateCheckpoint,
  evaluateReview,
} from "../../scripts/v22-workflow-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const workflowModuleFiles = [
  "scripts/workflow-gate/admission.mjs",
  "scripts/workflow-gate/git-diff.mjs",
  "scripts/workflow-gate/line-budget-diff.mjs",
  "scripts/workflow-gate/policy.mjs",
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
assert.equal(startResult.status, 2, "start_cli_must_be_retired");
assertIncludesAll(startResult.stderr, [
  "workflow_start_template_retired",
  "changes/ package templates are retired",
  "validate:active-platform",
], "start_retirement_output");

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
assert(reviewWithBlockers.findings.some((finding) => finding.code === "services_changed_without_registered_eval_update"), "review_must_require_service_eval_update");
assert(reviewWithBlockers.findings.some((finding) => finding.code === "formal_change_without_machine_evidence_update"), "review_must_require_machine_evidence_update");
assertIncludesAll(reviewWithBlockers.recommendedCommands.join("\n"), [
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "npm --prefix services/portal run check",
], "review_recommended_commands");

const reviewWithRetiredChangeWrite = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "changes/active/new-package/proposal.md",
    "changes/archive/2026-06-19-new-package/closeout.md",
    "contracts/medopl-product-profile.json",
    "tests/product/product-test-v22-medopl-contract-authority.mjs",
  ],
  changedStatuses: new Map([
    ["changes/active/new-package/proposal.md", "A"],
    ["changes/archive/2026-06-19-new-package/closeout.md", "A"],
  ]),
});
assert.equal(reviewWithRetiredChangeWrite.ok, false, "retired_change_writes_must_block");
assert.deepEqual(reviewWithRetiredChangeWrite.retiredChangePathWrites, [
  "changes/active/new-package/proposal.md",
  "changes/archive/2026-06-19-new-package/closeout.md",
], "retired_change_writes_mismatch");
assert(reviewWithRetiredChangeWrite.findings.some((finding) => finding.code === "retired_changes_path_write"), "retired_change_write_finding_missing");

const reviewWithRetiredChangeDelete = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "changes/active/old-package/proposal.md",
    "changes/archive/2026-05-23-old-package/closeout.md",
  ],
  changedStatuses: new Map([
    ["changes/active/old-package/proposal.md", "D"],
    ["changes/archive/2026-05-23-old-package/closeout.md", "D"],
  ]),
});
assert.deepEqual(reviewWithRetiredChangeDelete.retiredChangePathWrites, [], "retired_change_deletes_must_not_count_as_writes");
assert.equal(
  reviewWithRetiredChangeDelete.findings.some((finding) => finding.code === "retired_changes_path_write"),
  false,
  "retired_change_deletes_must_not_block_as_writes",
);

const reviewWithRegisteredEval = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "services/portal/src/domain/example.mjs",
    "contracts/medopl-product-profile.json",
    "tests/product/product-test-v22-medopl-contract-authority.mjs",
  ],
});
assert.equal(reviewWithRegisteredEval.findings.some((finding) => finding.code === "services_changed_without_registered_eval_update"), false, "registered_eval_must_cover_services_change");
assert.equal(reviewWithRegisteredEval.findings.some((finding) => finding.code === "contracts_or_specs_changed_without_registered_eval_update"), false, "registered_eval_must_cover_contracts_change");

const reviewWithPostMergeCloseoutOnly = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "docs/active/README.md",
    "docs/delivery/README.md",
    "docs/history/README.md",
    "tests/fixtures/v22/goal-current.json",
  ],
});
assert.equal(reviewWithPostMergeCloseoutOnly.ok, true, "post_merge_closeout_only_diff_must_pass_review_gate");
assert.equal(
  reviewWithPostMergeCloseoutOnly.findings.some((finding) => finding.code === "formal_change_without_machine_evidence_update"),
  false,
  "post_merge_closeout_only_diff_must_not_require_extra_machine_evidence",
);
assert.equal(reviewWithPostMergeCloseoutOnly.closeoutOnly, true, "post_merge_closeout_only_diff_must_be_reported");

const reviewWithDeliveryCloseout = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "docs/active/README.md",
    "docs/delivery/README.md",
    "docs/history/README.md",
    "tests/fixtures/v22/goal-current.json",
  ],
});
assert.equal(reviewWithDeliveryCloseout.ok, true, "post_merge_delivery_closeout_must_pass_review_gate");
assert.equal(reviewWithDeliveryCloseout.closeoutOnly, true, "post_merge_delivery_closeout_must_be_reported");

const reviewWithCloseoutGateSelfUpdate = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "scripts/v22-workflow-gate.mjs",
    "tests/health/health-check-v22-workflow-gate.mjs",
  ],
});
assert.equal(reviewWithCloseoutGateSelfUpdate.ok, true, "workflow_gate_self_update_must_have_registered_eval");

const productAdmission = {
  slice_type: "product",
  owner_surface: "backend",
  allowed_paths: ["services/", "tests/backend/", "contracts/"],
  forbidden_paths: ["changes/active/**", "changes/archive/**"],
  new_top_level_scripts_allowed: false,
  new_contracts_allowed: false,
  new_health_tests_allowed: false,
  touches_cloud: false,
  touches_active_docs: false,
  must_reduce_or_hold_bloat: true,
  cannot_claim: ["production complete"],
};

const reviewProductAdmissionViolation = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "services/medopl-go-backend/internal/service/controlplane/service.go",
    "scripts/v22-new-control-surface.mjs",
    "tests/health/health-check-v22-new-governance.mjs",
    "tests/backend/backend-test-v22-api-contract.mjs",
  ],
  changedStatuses: new Map([
    ["scripts/v22-new-control-surface.mjs", "A"],
    ["tests/health/health-check-v22-new-governance.mjs", "R100"],
  ]),
  sliceAdmission: productAdmission,
  lineBudgetDiff: {
    grownOversizeFiles: [
      {
        file: "services/medopl-go-backend/internal/service/controlplane/service.go",
        before: 1064,
        after: 1065,
      },
    ],
  },
});
assert.equal(reviewProductAdmissionViolation.ok, false, "product_slice_admission_violation_must_block_review");
assert(reviewProductAdmissionViolation.findings.some((finding) => finding.code === "slice_new_top_level_script_forbidden"), "product_slice_must_block_new_top_level_script");
assert(reviewProductAdmissionViolation.findings.some((finding) => finding.code === "slice_new_health_test_forbidden"), "product_slice_must_block_new_health_test");
assert(reviewProductAdmissionViolation.findings.some((finding) => finding.code === "slice_oversize_file_growth_forbidden"), "product_slice_must_block_oversize_service_growth");
assert(
  reviewProductAdmissionViolation.findings.find((finding) => finding.code === "slice_new_health_test_forbidden")?.files.includes("tests/health/health-check-v22-new-governance.mjs"),
  "product_slice_must_treat_renamed_health_test_as_new_target",
);

const reviewProductAdmissionAllowed = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "services/medopl-go-backend/internal/service/controlplane/runtime_lifecycle.go",
    "tests/backend/backend-test-v22-api-contract.mjs",
  ],
  changedStatuses: new Map(),
  sliceAdmission: productAdmission,
  missingLocalCommandReferences: [],
});
assert.equal(
  reviewProductAdmissionAllowed.findings.some((finding) => finding.code?.startsWith("slice_")),
  false,
  "product_slice_allowed_owner_paths_must_not_raise_slice_findings",
);

const cloudAdmission = {
  slice_type: "cloud",
  owner_surface: "cloud",
  operation_class: "readonly_inventory",
  evidence_sink: ".runtime/v22-cloud-authorization",
  receipt_manifest_required: true,
  allowed_paths: ["scripts/", "tests/cloud/", "contracts/"],
  forbidden_paths: ["changes/active/**", "changes/archive/**"],
  new_top_level_scripts_allowed: false,
  new_contracts_allowed: false,
  new_health_tests_allowed: false,
  touches_cloud: true,
  touches_active_docs: false,
  must_reduce_or_hold_bloat: true,
  cannot_claim: ["production complete"],
};
const reviewCloudAdmissionAllowed = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "scripts/v22-cloud-authorized-executor.mjs",
    "tests/cloud/cloud-test-v22-cloud-authorized-executor.mjs",
    "contracts/medopl-cloud-authorization-pack.json",
  ],
  sliceAdmission: cloudAdmission,
  missingLocalCommandReferences: [],
});
assert.equal(
  reviewCloudAdmissionAllowed.findings.some((finding) => finding.code?.startsWith("slice_cloud_admission_")),
  false,
  "cloud_slice_with_operation_evidence_receipt_must_pass_cloud_admission",
);

const reviewWithTokenNamedEval = evaluateReview({
  base: "recovery/platform-v22-trunk",
  changedFiles: [
    "tests/regression/opl/regression-test-v22-gflabtoken-entry-contract.mjs",
  ],
  missingLocalCommandReferences: [],
});
assert.equal(reviewWithTokenNamedEval.ok, true, "v22_eval_file_with_token_in_name_must_not_be_secret_like_path");
assert.deepEqual(reviewWithTokenNamedEval.secretLikePaths, [], "v22_eval_file_with_token_in_name_secret_like_paths_must_be_empty");

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
assert(gateLineCount < 260, `workflow_gate_cli_must_be_thin:${gateLineCount}`);
assertIncludesAll(gateSource, [
  "from \"./workflow-gate/git-diff.mjs\"",
  "from \"./workflow-gate/policy.mjs\"",
  "from \"./workflow-gate/command-reference.mjs\"",
  "from \"./workflow-gate/report.mjs\"",
  "export {",
  "findMissingLocalCommandReferences",
  "evaluateReview",
  "evaluateCheckpoint",
], "workflow_gate_cli_split_source");
assertNotIncludesAny(gateSource, [
  "workflow-gate/change-package.mjs",
  "changePackageTypes",
  "formal_change_without_active_change_package",
], "workflow_gate_source_must_not_keep_change_package_api");
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
  contract: "v22_product_authority_workflow_gate",
  covered: [
    "start_change_package_templates_retired",
    "retired_changes_writes_blocked_deletes_allowed",
    "service_contract_changes_require_registered_eval",
    "checkpoint_trunk_clean_ahead_ssh_token_free_remote",
    "thin_cli_without_change_package_api",
    "no_secret_file_read_no_push_build_kubectl_live_test",
  ],
}, null, 2));
