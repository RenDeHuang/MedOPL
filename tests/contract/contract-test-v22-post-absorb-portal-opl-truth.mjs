import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const absorbedCommit = "8797ffc6f3ba3747cfac55554012b648fcbfb5c9";
const completedLeaf = "leaf-portal-opl-file-run-artifact-closure";
const completedGap = "opl-connection-gateway-preflight-runtime-file-run-artifact-trace";
const nextLeaf = "leaf-portal-postgres-redis-local-production-data-closure";
const nextGap = "portal-postgres-redis-local-production-data-closure";
const recordPath = "docs/recovery/agent-runs/2026-05-19-leaf-portal-opl-file-run-artifact-closure.md";

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readRepoFile(filePath));
}

const [current, manifest, recordText, gapMatrix] = await Promise.all([
  readJson("docs/recovery/v22-goal-current.json"),
  readJson("docs/recovery/v22-agent-verify-manifest.json"),
  readRepoFile(recordPath),
  readRepoFile("docs/recovery/v22-current-vs-ideal-gap-matrix.md"),
]);

assert.equal(current.last_absorbed_commit, absorbedCommit, "portal_opl_absorbed_commit_must_be_current");
assert.equal(current.current_cursor, nextLeaf, "current_cursor_must_advance_after_portal_opl_absorb");
assert.equal(current.next_leaf, nextLeaf, "next_leaf_must_advance_after_portal_opl_absorb");
assert.equal(current.current_leaf.step_id, nextLeaf, "current_leaf_must_describe_next_leaf");
assert.equal(current.current_leaf.gap_id, nextGap, "current_leaf_gap_must_describe_postgres_redis_closure");
assert.equal(current.current_risk_class, "local_service_code", "next_leaf_risk_class_must_remain_local_service_code");
assert(!current.current_blockers.includes("pending_B_review_ff_only_absorb_for_portal_opl_file_run_artifact_closure"), "portal_opl_pending_b_review_blocker_must_be_cleared");

const completedGapEntry = current.gaps.find((gap) => gap.id === completedGap);
assert(completedGapEntry, "completed_portal_opl_gap_missing");
assert.equal(completedGapEntry.status, "completed", "portal_opl_gap_must_be_completed");
assert.equal(completedGapEntry.cursor_eligible, false, "completed_portal_opl_gap_must_not_remain_cursor_eligible");
assert.equal(completedGapEntry.next_leaf_step, "monitor_only_after_B_absorb", "completed_portal_opl_gap_must_be_monitor_only");

const nextGapEntry = current.gaps.find((gap) => gap.id === nextGap);
assert(nextGapEntry, "postgres_redis_next_gap_missing");
assert.equal(nextGapEntry.status, "gated", "postgres_redis_next_gap_must_be_gated_not_completed");
assert.equal(nextGapEntry.cursor_eligible, true, "postgres_redis_next_gap_must_be_cursor_eligible");
assert.equal(nextGapEntry.next_leaf_step, nextLeaf, "postgres_redis_next_gap_leaf_mismatch");

const currentLeafManifest = manifest.leaves.find((leaf) => leaf.leaf_id === nextLeaf);
assert(currentLeafManifest, "postgres_redis_leaf_missing_from_verify_manifest");
assert.deepEqual(currentLeafManifest.verification_commands, current.current_leaf.verification_commands, "manifest_current_leaf_commands_must_match_current_truth");
assert.deepEqual(currentLeafManifest.allowed_files, current.current_leaf.allowed_files, "manifest_current_leaf_allowed_files_must_match_current_truth");
assert.deepEqual(currentLeafManifest.forbidden_files, current.current_leaf.forbidden_files, "manifest_current_leaf_forbidden_files_must_match_current_truth");
assert(currentLeafManifest.verification_commands.includes("node tests/regression/portal/regression-test-v22-portal-storage-mode-local-closure.mjs"), "postgres_redis_leaf_must_subscribe_storage_mode_eval");

const releaseGap = current.gaps.find((gap) => gap.id === "release-readiness-authorized-deploy-only");
assert(releaseGap, "release_readiness_gap_missing");
assert.equal(releaseGap.cursor_eligible, false, "release_readiness_must_not_be_cursor_eligible");
assert.equal(current.release_readiness_state.cursor_eligible, false, "release_readiness_state_must_not_be_cursor_eligible");

assert(recordText.includes("absorbed_commit"), "portal_opl_agent_record_must_include_absorbed_commit_field");
assert(recordText.includes(absorbedCommit), "portal_opl_agent_record_must_include_absorbed_commit");
assert(recordText.includes("ff-only absorbed"), "portal_opl_agent_record_must_record_ff_only_absorb");
assert(recordText.includes("post_absorb_verification"), "portal_opl_agent_record_must_include_post_absorb_verification");
assert(!recordText.includes("pending_B_review\n"), "portal_opl_agent_record_must_not_remain_pending_review");

assert(gapMatrix.includes("id: portal-postgres-redis-local-production-data-closure"), "gap_matrix_must_index_postgres_redis_next_leaf");
assert(gapMatrix.includes("node tests/regression/portal/regression-test-v22-portal-storage-mode-local-closure.mjs"), "gap_matrix_must_reference_storage_mode_eval");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_post_absorb_portal_opl_truth",
  completedLeaf,
  absorbedCommit,
  nextLeaf,
  nextGap,
  verified: [
    "portal_opl_leaf_completed_monitor_only",
    "agent_run_record_absorbed_commit",
    "current_cursor_advanced",
    "postgres_redis_next_leaf_indexed",
    "storage_mode_eval_shell_present",
    "release_readiness_not_cursor_eligible",
  ],
}, null, 2));
