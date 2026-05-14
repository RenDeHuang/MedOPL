import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readmePath = "README.md";
const vibeCodingPath = "docs/vibe-coding.md";
const mvpSuitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const repoZoningPath = "docs/recovery/repo-zoning.md";
const inventoryPath = "docs/recovery/physical-legacy-file-retirement-inventory.md";
const manifestPath = "docs/recovery/physical-legacy-file-retirement-run-manifest.json";

const slice2Id = "slice-2-legacy-script-archive-delete-boundary";

const legacyCommandPatterns = [
  /\bnode\s+scripts\/smoke-test-v19-/,
  /\bnode\s+scripts\/smoke-test-v20/,
  /\bnode\s+scripts\/smoke-test-v21-/,
  /\bnode\s+scripts\/live-test-/,
  /\bnode\s+scripts\/check-v18-/,
  /\bnode\s+scripts\/check-v20/,
  /\bnode\s+scripts\/check-v21-/,
  /\bnode\s+scripts\/smoke-test-portal-/,
  /\bnode\s+scripts\/smoke-test-opl-/,
  /\bnode\s+scripts\/smoke-test-billing-/,
  /\bnode\s+scripts\/smoke-test-resource-/,
];

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function extractFencedCodeBlocks(source) {
  return [...source.matchAll(/```(?:bash|sh)?\n([\s\S]*?)```/g)].map((match) => match[1]);
}

function assertNoLegacyCommandsInCodeBlocks(source, label) {
  const codeBlocks = extractFencedCodeBlocks(source);
  for (const [index, block] of codeBlocks.entries()) {
    for (const pattern of legacyCommandPatterns) {
      assert.doesNotMatch(block, pattern, `${label}_code_block_${index}_must_not_reference:${pattern.source}`);
    }
  }
}

function assertOnlyV22SmokeScriptsInMvpSuite(source) {
  const scriptReferences = [...source.matchAll(/scripts\/[A-Za-z0-9_.-]+\.mjs/g)].map((match) => match[0]);
  assert(scriptReferences.length > 0, "mvp_suite_script_reference_missing");

  for (const scriptReference of scriptReferences) {
    assert(
      scriptReference.startsWith("scripts/smoke-test-v22-"),
      `mvp_suite_must_only_reference_v22_smoke:${scriptReference}`,
    );
  }

  for (const forbidden of [
    "smoke-test-v19",
    "smoke-test-v20",
    "smoke-test-v21",
    "live-test",
    "check-v18",
    "check-v20",
    "check-v21",
    "smoke-test-portal",
    "smoke-test-opl",
    "smoke-test-billing",
    "smoke-test-resource",
  ]) {
    assert.equal(source.includes(forbidden), false, `mvp_suite_must_not_include:${forbidden}`);
  }
}

function assertZoningRow(source, pathPattern, zone, action) {
  assertIncludes(
    source,
    `| \`${pathPattern}\` | ${zone} | ${action} |`,
    `repo_zoning_${pathPattern.replaceAll("*", "star").replaceAll("/", "_").replaceAll("-", "_")}`,
  );
}

function inventoryRows(markdown) {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("| `") || line.startsWith("| scripts/"));
}

function inventoryRow(markdown, pathOrGroup) {
  return inventoryRows(markdown).find((line) => line.includes(pathOrGroup));
}

function assertInventoryDecisionStatus(markdown, pathOrGroup, decision, physicalDeleteStatus) {
  const row = inventoryRow(markdown, pathOrGroup);
  assert(row, `inventory_row_missing:${pathOrGroup}`);
  assert(row.includes(`| ${decision} |`), `inventory_decision_mismatch:${pathOrGroup}:${decision}`);
  assert(
    row.includes(`| ${physicalDeleteStatus} |`),
    `inventory_physical_delete_status_mismatch:${pathOrGroup}:${physicalDeleteStatus}`,
  );
}

function sliceById(manifest, sliceId) {
  const slice = (manifest.slices ?? []).find((candidate) => candidate.id === sliceId);
  assert(slice, `manifest_slice_missing:${sliceId}`);
  return slice;
}

const readme = await readFile(readmePath, "utf8");
const vibeCoding = await readFile(vibeCodingPath, "utf8");
const mvpSuite = await readFile(mvpSuitePath, "utf8");
const repoZoning = await readFile(repoZoningPath, "utf8");
const inventory = await readFile(inventoryPath, "utf8");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

assertIncludes(readme, "scripts/smoke-test-v22-*", "readme_active_surface");
assertIncludes(readme, "node scripts/smoke-test-v22-mvp-contract-suite.mjs", "readme_default_v22_mvp_suite");
assertNoLegacyCommandsInCodeBlocks(readme, "readme");

assertIncludes(vibeCoding, "node scripts/smoke-test-v22-mvp-contract-suite.mjs", "vibe_default_v22_mvp_suite");
assertIncludes(vibeCoding, "node scripts/smoke-test-v22-opl-entry-preflight-auth-flow.mjs", "vibe_gateway_v22_smoke");
assertIncludes(
  vibeCoding,
  "node scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs",
  "vibe_runtime_v22_smoke",
);
assertNoLegacyCommandsInCodeBlocks(vibeCoding, "vibe_coding");

assertOnlyV22SmokeScriptsInMvpSuite(mvpSuite);

for (const archivedPattern of [
  "scripts/smoke-test-v19-*",
  "scripts/smoke-test-v20*",
  "scripts/smoke-test-v21-*",
  "scripts/live-test-*",
  "scripts/check-v18-*",
  "scripts/check-v20*",
  "scripts/check-v21-*",
]) {
  assertZoningRow(repoZoning, archivedPattern, "Zone 3", "archive");
}

for (const rewritePattern of [
  "scripts/smoke-test-portal-*",
  "scripts/smoke-test-opl-*",
  "scripts/smoke-test-billing-*",
  "scripts/smoke-test-resource-*",
]) {
  assertZoningRow(repoZoning, rewritePattern, "Zone 2", "review/rewrite");
}

for (const [pathOrGroup, status] of [
  ["`scripts/smoke-test-v19-*`", "`archive_reference`"],
  ["`scripts/smoke-test-v20*`", "`archive_reference`"],
  ["`scripts/smoke-test-v21-*`", "`archive_reference`"],
  ["`scripts/live-test-*`", "`blocked_without_auth`"],
]) {
  assertInventoryDecisionStatus(inventory, pathOrGroup, "`archive_reference`", status);
}

for (const phrase of [
  "slice-2 truth writeback: completed",
  "no active/default/workflow refs to v19/v20/v21/live-test script families",
  "live-test execution and deletion remain blocked without explicit authorization",
]) {
  assertIncludes(inventory, phrase, "inventory_slice2_truth");
}

const slice2 = sliceById(manifest, slice2Id);
assert(manifest.completed_slices.includes(slice2Id), "slice2_completion_truth_missing");
assert(!manifest.next_slices.includes(slice2Id), "slice2_must_not_remain_in_next_slices");
assert.notEqual(manifest.current_slice, slice2Id, "slice2_must_not_remain_current_slice_after_writeback");
assert.equal(slice2.status, "completed", "slice2_status_mismatch");
assert.equal(
  slice2.decision_scope,
  "archive_reference_or_blocked_without_auth_or_explicit_delete_candidates_only",
  "slice2_decision_scope_mismatch",
);
assertIncludes(
  slice2.red_gate_policy,
  "target_paths_still_need_truth_writeback",
  "slice2_red_gate_policy",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_legacy_script_archive_boundary",
  protectedEntrypoints: [
    readmePath,
    vibeCodingPath,
    mvpSuitePath,
  ],
  zoningAssertions: {
    archive: [
      "scripts/smoke-test-v19-*",
      "scripts/smoke-test-v20*",
      "scripts/smoke-test-v21-*",
      "scripts/live-test-*",
      "scripts/check-v18-*",
      "scripts/check-v20*",
      "scripts/check-v21-*",
    ],
    reviewRewrite: [
      "scripts/smoke-test-portal-*",
      "scripts/smoke-test-opl-*",
      "scripts/smoke-test-billing-*",
      "scripts/smoke-test-resource-*",
    ],
  },
  slice2: {
    status: slice2.status,
    currentSlice: manifest.current_slice,
  },
}, null, 2));
