import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const expectedSlideIds = [
  "slide-00-product-goal-index",
  "slide-01-data-truth",
  "slide-02-portal-api-real-data",
  "slide-03-account-wallet-billing",
  "slide-04-workspace-files",
  "slide-05-resource-lifecycle",
  "slide-06-opl-entry-runtime",
  "slide-07-run-artifact-trace",
  "slide-08-admin-ops",
  "slide-09-precloud-readiness",
];

const expectedLifecycle = [
  "inventory",
  "classify",
  "absorb_truth",
  "retire_stale_surface",
  "eval",
  "implementation",
  "verify",
  "commit",
];

const requiredForbiddenOps = [
  "secret",
  "live-cloud",
  "true-cloud-mutation",
  "build-push-kubectl",
  "deploy",
  "live-test",
  "upstream-write",
];

const allowedOpenStatuses = ["indexed", "active"];
const allowedSlideStatuses = ["indexed", "active", "pending", "landed"];
const closedSummaryFields = [
  "id",
  "status",
  "landed_commit",
  "closed_at",
  "history_summary",
  "next_cursor",
];

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludes(source, expected, label) {
  assert(String(source).includes(expected), `${label}_missing:${expected}`);
}

function assertArrayIncludesAll(actual, expected, label) {
  assert(Array.isArray(actual), `${label}_must_be_array`);
  for (const item of expected) assert(actual.includes(item), `${label}_missing:${item}`);
}

const [current, manifest, active, history] = await Promise.all([
  readJson("tests/fixtures/v22/goal-current.json"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/history/README.md"),
]);

const loop = current.product_engineering_loop;
assert(loop, "product_engineering_loop_missing");
assert.equal(loop.schema_version, 1, "product_engineering_loop_schema_version_mismatch");
assert.equal(loop.id, "precloud-product-slides-closure", "product_engineering_loop_id_mismatch");
assert.equal(loop.owner, "MedOPL", "product_engineering_loop_owner_mismatch");
assert.equal(loop.method, "OPL-style framework repo lifecycle", "product_engineering_loop_method_mismatch");
assert([...allowedOpenStatuses, "closed"].includes(loop.status), "product_engineering_loop_status_mismatch");
assert.equal(loop.truth_file, "docs/active/README.md", "product_engineering_loop_truth_file_mismatch");
assert.equal(loop.machine_cursor_file, "tests/fixtures/v22/goal-current.json", "product_engineering_loop_cursor_file_mismatch");
assert.equal(loop.verify_manifest_file, "tests/fixtures/v22/agent-verify-manifest.json", "product_engineering_loop_manifest_file_mismatch");
assert.equal(loop.history_file, "docs/history/README.md", "product_engineering_loop_history_file_mismatch");
assert.equal(loop.no_new_slide_docs, true, "product_engineering_loop_must_forbid_slide_docs");
assert.equal(loop.no_compatibility_layers, true, "product_engineering_loop_must_forbid_compat_layers");
assert.equal(loop.no_per_slide_docs, true, "product_engineering_loop_must_forbid_per_slide_docs");
assert.equal(loop.no_slide_subtask_docs, true, "product_engineering_loop_must_forbid_slide_subtask_docs");
assert.equal(loop.no_unregistered_slide_tests, true, "product_engineering_loop_must_forbid_unregistered_slide_tests");
assert.equal(loop.slide_subtasks_policy, "subtasks_may_exist_only_as_code_tests_fixture_tasks_or_history_closeout_summary", "product_engineering_loop_subtasks_policy_mismatch");
assert.deepEqual(loop.lifecycle, expectedLifecycle, "product_engineering_loop_lifecycle_mismatch");

assert.equal(loop.active_detail_retention, "open_only", "product_engineering_loop_active_detail_retention_must_be_open_only");
assert(loop.closeout_policy, "product_engineering_loop_closeout_policy_missing");
assert.equal(loop.closeout_policy.when, "all_slides_complete", "product_engineering_loop_closeout_when_mismatch");
assert.equal(loop.closeout_policy.action, "collapse_to_history_and_next_cursor", "product_engineering_loop_closeout_action_mismatch");
assertArrayIncludesAll(
  loop.closeout_policy.remove_from_current_truth,
  ["product_engineering_loop.slides"],
  "product_engineering_loop_closeout_remove_from_current_truth",
);
assertArrayIncludesAll(
  loop.closeout_policy.remove_from_verify_manifest,
  ["branch_override_suites.product-engineering-loop-index"],
  "product_engineering_loop_closeout_remove_from_verify_manifest",
);
assertArrayIncludesAll(
  loop.closeout_policy.keep_closed_summary_fields,
  closedSummaryFields,
  "product_engineering_loop_closeout_keep_closed_summary_fields",
);
assert.equal(loop.closeout_policy.history_file, "docs/history/README.md", "product_engineering_loop_closeout_history_file_mismatch");
assert.equal(loop.closeout_policy.next_cursor, "figma-portal-ui-absorption", "product_engineering_loop_closeout_next_cursor_mismatch");
assert.equal(loop.closeout_policy.forbid_permanent_slide_details, true, "product_engineering_loop_must_forbid_permanent_slide_details");
assert.equal(loop.closeout_policy.forbid_shadow_archive, true, "product_engineering_loop_must_forbid_shadow_archive");

if (loop.status === "closed") {
  assert(!("slides" in loop) || loop.slides.length === 0, "closed_product_engineering_loop_must_not_keep_slide_details");
  for (const field of closedSummaryFields) assert(loop[field], `closed_product_engineering_loop_missing_summary_field:${field}`);
} else {
  assert(allowedOpenStatuses.includes(loop.status), "product_engineering_loop_status_mismatch");
  assert.equal(loop.slides.length, expectedSlideIds.length, "product_engineering_loop_slide_count_mismatch");
  assert.deepEqual(loop.slides.map((slide) => slide.id), expectedSlideIds, "product_engineering_loop_slide_order_mismatch");
  assert(expectedSlideIds.includes(loop.active_slide), `product_engineering_loop_active_slide_unknown:${loop.active_slide}`);
  const activeSlideIndex = expectedSlideIds.indexOf(loop.active_slide);
  assert(activeSlideIndex > 0, "product_engineering_loop_active_slide_must_be_product_slide");

  for (const [index, slide] of loop.slides.entries()) {
    assert.equal(slide.order, index, `slide_order_mismatch:${slide.id}`);
    assert(slide.title, `slide_missing_title:${slide.id}`);
    assert(slide.goal, `slide_missing_goal:${slide.id}`);
    assert(Array.isArray(slide.owner_surface) && slide.owner_surface.length > 0, `slide_missing_owner_surface:${slide.id}`);
    assert(Array.isArray(slide.cleanup_targets) && slide.cleanup_targets.length > 0, `slide_missing_cleanup_targets:${slide.id}`);
    assert(Array.isArray(slide.subtask_surfaces), `slide_missing_subtask_surfaces:${slide.id}`);
    assert(Array.isArray(slide.eval_commands) && slide.eval_commands.length > 0, `slide_missing_eval_commands:${slide.id}`);
    assert(Array.isArray(slide.done_when) && slide.done_when.length > 0, `slide_missing_done_when:${slide.id}`);
    assertArrayIncludesAll(slide.lifecycle, expectedLifecycle, `slide_lifecycle:${slide.id}`);
    assertArrayIncludesAll(slide.forbidden_ops, requiredForbiddenOps, `slide_forbidden_ops:${slide.id}`);
    assert(allowedSlideStatuses.includes(slide.status), `slide_status_unknown:${slide.id}:${slide.status}`);
    const expectedStatus = index === 0 ? "indexed" : index < activeSlideIndex ? "landed" : index === activeSlideIndex ? "active" : "pending";
    assert.equal(slide.status, expectedStatus, `slide_status_mismatch:${slide.id}`);
    if (index > 0 && index < activeSlideIndex) {
      assert.match(slide.landed_commit || "", /^[a-f0-9]{40}$/u, `landed_slide_commit_missing:${slide.id}`);
      assert(slide.landed_branch, `landed_slide_branch_missing:${slide.id}`);
      assert(slide.closed_at, `landed_slide_closed_at_missing:${slide.id}`);
      assert(slide.history_summary, `landed_slide_history_summary_missing:${slide.id}`);
      assert(slide.next_cursor, `landed_slide_next_cursor_missing:${slide.id}`);
    }
    for (const subtask of slide.subtask_surfaces) {
      assert(subtask.id, `slide_subtask_missing_id:${slide.id}`);
      assert(subtask.owner_surface, `slide_subtask_missing_owner_surface:${slide.id}:${subtask.id}`);
      assert(Array.isArray(subtask.allowed_files), `slide_subtask_missing_allowed_files:${slide.id}:${subtask.id}`);
      assert(Array.isArray(subtask.eval_commands), `slide_subtask_missing_eval_commands:${slide.id}:${subtask.id}`);
      assert(Array.isArray(subtask.done_when), `slide_subtask_missing_done_when:${slide.id}:${subtask.id}`);
      assert.equal(subtask.permanent_doc_allowed, false, `slide_subtask_must_not_allow_permanent_doc:${slide.id}:${subtask.id}`);
      for (const command of subtask.eval_commands) {
        assert(command.startsWith("node ") || command.startsWith("npm "), `slide_subtask_eval_command_must_be_local:${slide.id}:${subtask.id}:${command}`);
        assert(!command.includes("kubectl"), `slide_subtask_eval_command_must_not_use_kubectl:${slide.id}:${subtask.id}:${command}`);
        assert(!command.includes("git push"), `slide_subtask_eval_command_must_not_push:${slide.id}:${subtask.id}:${command}`);
      }
    }
    for (const command of slide.eval_commands) {
      assert(command.startsWith("node ") || command.startsWith("npm "), `slide_eval_command_must_be_local:${slide.id}:${command}`);
      assert(!command.includes("kubectl"), `slide_eval_command_must_not_use_kubectl:${slide.id}:${command}`);
      assert(!command.includes("git push"), `slide_eval_command_must_not_push:${slide.id}:${command}`);
    }
  }
}

const productSuite = manifest.suites.find((suite) => suite.id === "product-engineering-loop");
assert(productSuite, "product_engineering_loop_suite_missing");
assert(productSuite.commands.includes("node tests/contract/contract-test-v22-product-engineering-loop-index.mjs"), "product_loop_suite_must_run_index_gate");

const branchOverride = manifest.branch_override_suites.find((suite) => suite.id === "product-engineering-loop-index");
if (loop.status === "closed") {
  assert.equal(branchOverride, undefined, "product_engineering_loop_branch_override_must_be_removed_after_closeout");
  assert.equal(
    manifest.branch_override_suites.some((suite) => suite.id === "product-engineering-loop-index"),
    false,
    "product_engineering_loop_closed_state_must_not_keep_branch_override",
  );
} else {
  assert(branchOverride, "product_engineering_loop_branch_override_missing");
  assert(branchOverride.branches.includes("feat/v22-product-engineering-loop-index"), "product_engineering_loop_branch_override_branch_missing");
  assert(branchOverride.commands.includes("node tests/contract/contract-test-v22-product-engineering-loop-index.mjs"), "product_engineering_loop_branch_override_must_run_gate");
  for (const forbiddenFile of ["services/*", "deploy/*", "adapters/*", ".sentrux/*", "infra/*", "one-person-lab/*", "upstream/*", ".runtime/*"]) {
    assert(branchOverride.forbidden_files.includes(forbiddenFile), `product_engineering_loop_branch_override_forbidden_file_missing:${forbiddenFile}`);
  }
  for (const forbiddenOp of [...requiredForbiddenOps, "services-implementation", "git-push"]) {
    assert(branchOverride.forbidden_ops.includes(forbiddenOp), `product_engineering_loop_branch_override_forbidden_op_missing:${forbiddenOp}`);
  }
}

const currentSuite = manifest.suites.find((suite) => suite.id === "current");
const localContractSuite = manifest.suites.find((suite) => suite.id === "local-contract");
const reviewSuite = manifest.suites.find((suite) => suite.id === "review");
for (const suite of [currentSuite, localContractSuite, reviewSuite]) {
  assert(suite, "required_suite_missing");
  assert(suite.commands.includes("node tests/contract/contract-test-v22-product-engineering-loop-index.mjs"), `suite_must_run_product_loop_gate:${suite?.id}`);
}

const currentLeaf = manifest.leaves.find((leaf) => leaf.leaf_id === current.current_cursor);
assert(currentLeaf, `current_leaf_missing:${current.current_cursor}`);
assert(currentLeaf.verification_commands.includes("node tests/contract/contract-test-v22-product-engineering-loop-index.mjs"), "current_leaf_must_run_product_loop_gate");

assertIncludes(active, current.current_cursor, "active_must_reference_product_loop_next_cursor");
assertIncludes(active, loop.landed_commit, "active_must_reference_product_loop_landed_commit");
assertIncludes(history, "Purpose: `history_archive_index`", "history_must_be_archive_index");
assertIncludes(history, "tests/fixtures/v22/goal-current.json", "history_must_point_to_product_loop_machine_owner");
assertIncludes(history, "changes/archive/", "history_must_point_to_archive_root");
assert.equal(/^###\s+\d{4}-\d{2}-\d{2}\s+/mu.test(history), false, "history_must_not_store_product_loop_markdown_database");
if (loop.status === "closed") {
  assert.equal(loop.id, "precloud-product-slides-closure", "product_loop_closed_summary_must_hold_goal_id");
  assert.equal(loop.next_cursor, "figma-portal-ui-absorption", "product_loop_closed_summary_must_hold_package_next_cursor");
  assertIncludes(loop.history_summary, "slide-01", "product_loop_closed_summary_must_hold_human_summary");
  assertIncludes(current.current_cursor, "real-cloud-authorization-boundary", "current_cursor_must_hold_global_next_cursor");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_product_engineering_loop_index",
  productLoop: loop.id,
  activeSlide: loop.active_slide,
  slides: loop.slides?.map((slide) => slide.id) || [],
}, null, 2));
