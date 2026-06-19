import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateReview,
  findMissingLocalCommandReferences,
  findMissingLocalTestCommandReferences,
} from "../../scripts/v22-workflow-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function assertRepoFileExists(repoPath) {
  await access(path.join(repoRoot, repoPath));
}

const review = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [],
  changedStatuses: new Map(),
  addedLines: [],
});

assert.equal(review.ok, true, `empty_review_must_pass:${JSON.stringify(review.findings, null, 2)}`);
assert.deepEqual(review.missingLocalCommandReferences, [], "workflow_gate_must_not_reference_missing_local_commands");
assert.deepEqual(review.missingLocalTestCommandReferences, [], "workflow_gate_legacy_alias_must_match_missing_local_commands");

const missing = await findMissingLocalCommandReferences();
assert.deepEqual(missing, [], `current_commands_reference_missing_local_targets:${JSON.stringify(missing, null, 2)}`);
assert.deepEqual(await findMissingLocalTestCommandReferences(), missing, "legacy_test_command_reference_alias_must_match_local_command_reference_gate");

const workflowSource = await readFile(path.join(repoRoot, "scripts/v22-workflow-gate.mjs"), "utf8");
const workflowModuleSources = await Promise.all([
  "scripts/workflow-gate/command-reference.mjs",
  "scripts/workflow-gate/report.mjs",
].map((repoPath) => readFile(path.join(repoRoot, repoPath), "utf8")));
const combinedWorkflowSource = [workflowSource, ...workflowModuleSources].join("\n");
for (const expected of [
  "findMissingLocalCommandReferences",
  "findMissingLocalTestCommandReferences",
  "missing_local_command_reference",
  "currentCommandReferenceSources",
  "package_script_missing",
  "node_entry_missing",
]) {
  assert(combinedWorkflowSource.includes(expected), `workflow_gate_reference_integrity_source_missing:${expected}`);
}

for (const expected of [
  "tests/contracts/contract-test-v22-node-portal-backend-physical-removal.mjs",
  "tests/contracts/runtime-bridge/contract-test-v22-runtime-gate-contract.mjs",
  "tests/contracts/contract-test-v22-precloud-deployable-rc.mjs",
  "tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs",
  "scripts/v22-verify.mjs",
  "scripts/v22-workflow-gate.mjs",
  "scripts/v22-repo-bloat-audit.mjs",
  "tests/governance/governance-test-v22-product-engineering-loop-index.mjs",
]) {
  await assertRepoFileExists(expected);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_workflow_command_reference_gate",
  checked: "current_node_and_package_command_references",
}, null, 2));
