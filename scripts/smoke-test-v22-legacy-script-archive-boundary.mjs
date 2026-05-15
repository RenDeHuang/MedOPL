import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const readmePath = "README.md";
const vibeCodingPath = "docs/vibe-coding.md";
const mvpSuitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const repoZoningPath = "docs/recovery/repo-zoning.md";
const inventoryPath = "docs/recovery/physical-legacy-file-retirement-inventory.md";
const manifestPath = "docs/recovery/physical-legacy-file-retirement-run-manifest.json";
const activeSurfacePath = "docs/recovery/active-surface.md";
const archivePolicyPath = "docs/recovery/archive-policy.md";

const sliceId = "slice-c-legacy-script-delete";
const deletedFamilies = [
  /^smoke-test-v19-/u,
  /^smoke-test-v20/u,
  /^smoke-test-v21-/u,
  /^check-v18-/u,
  /^check-v20/u,
  /^check-v21-/u,
  /^daily-check-v19-/u,
  /^live-prepare-v19-/u,
  /^smoke-test-resource-provisioner/u,
  /^smoke-test-billing-opencost/u,
  /^install-opencost/u,
  /^start-opencost/u,
];

const legacyCommandPatterns = [
  /\bnode\s+scripts\/smoke-test-v19-/,
  /\bnode\s+scripts\/smoke-test-v20/,
  /\bnode\s+scripts\/smoke-test-v21-/,
  /\bnode\s+scripts\/live-test-/,
  /\bnode\s+scripts\/check-v18-/,
  /\bnode\s+scripts\/check-v20/,
  /\bnode\s+scripts\/check-v21-/,
  /\bnode\s+scripts\/smoke-test-resource-provisioner/,
  /\bnode\s+scripts\/smoke-test-billing-opencost/,
  /\bscripts\/install-opencost-local\.ps1\b/,
  /\bscripts\/start-opencost-/,
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
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
    "resource-provisioner",
    "opencost",
  ]) {
    assert.equal(source.includes(forbidden), false, `mvp_suite_must_not_include:${forbidden}`);
  }
}

async function assertLegacyScriptsDeleted() {
  const scriptNames = await readdir(path.join(repoRoot, "scripts"));
  const legacyNames = scriptNames.filter((name) => deletedFamilies.some((pattern) => pattern.test(name))).sort();
  assert.deepEqual(legacyNames, [], `legacy_scripts_must_be_deleted:${legacyNames.join(",")}`);
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

function sliceById(manifest, candidateId) {
  const slice = (manifest.slices ?? []).find((candidate) => candidate.id === candidateId);
  assert(slice, `manifest_slice_missing:${candidateId}`);
  return slice;
}

const readme = await readRepoFile(readmePath);
const vibeCoding = await readRepoFile(vibeCodingPath);
const mvpSuite = await readRepoFile(mvpSuitePath);
const repoZoning = await readRepoFile(repoZoningPath);
const inventory = await readRepoFile(inventoryPath);
const activeSurface = await readRepoFile(activeSurfacePath);
const archivePolicy = await readRepoFile(archivePolicyPath);
const manifest = JSON.parse(await readRepoFile(manifestPath));

await assertLegacyScriptsDeleted();

assertIncludes(readme, "scripts/smoke-test-v22-*", "readme_active_surface");
assertIncludes(readme, "node scripts/smoke-test-v22-mvp-contract-suite.mjs", "readme_default_v22_mvp_suite");
assertNoLegacyCommandsInCodeBlocks(readme, "readme");

assertIncludes(vibeCoding, "node scripts/smoke-test-v22-mvp-contract-suite.mjs", "vibe_default_v22_mvp_suite");
assertNoLegacyCommandsInCodeBlocks(vibeCoding, "vibe_coding");
assertOnlyV22SmokeScriptsInMvpSuite(mvpSuite);

for (const deletedPattern of [
  "scripts/smoke-test-v19-*",
  "scripts/smoke-test-v20*",
  "scripts/smoke-test-v21-*",
  "scripts/check-v18-*",
  "scripts/check-v20*",
  "scripts/check-v21-*",
  "scripts/daily-check-v19-*",
  "scripts/live-prepare-v19-*",
]) {
  assertZoningRow(repoZoning, deletedPattern, "Zone 3", "delete");
}
assertZoningRow(repoZoning, "scripts/live-test-*", "Zone 3", "delete");

for (const [pathOrGroup, status] of [
  ["`scripts/smoke-test-v19-*`", "`deleted`"],
  ["`scripts/smoke-test-v20*`", "`deleted`"],
  ["`scripts/smoke-test-v21-*`", "`deleted`"],
]) {
  assertInventoryDecisionStatus(inventory, pathOrGroup, "`delete`", status);
}

for (const source of [inventory, activeSurface, archivePolicy]) {
  for (const forbidden of ["archive_reference"]) {
    assertNotIncludes(source, forbidden, "strict_legacy_scripts_delete_truth");
  }
}

const slice = sliceById(manifest, sliceId);
assert.equal(slice.status, "completed", "slice_c_status_mismatch");
assert(manifest.completed_slices.includes(sliceId), "slice_c_completion_truth_missing");
assert(!manifest.next_slices.includes(sliceId), "slice_c_must_not_remain_in_next_slices");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_legacy_script_delete_boundary",
  protectedEntrypoints: [
    readmePath,
    vibeCodingPath,
    mvpSuitePath,
  ],
  deletedFamilies: [
    "scripts/smoke-test-v19-*",
    "scripts/smoke-test-v20*",
    "scripts/smoke-test-v21-*",
    "scripts/check-v18-*",
    "scripts/check-v20*",
    "scripts/check-v21-*",
    "scripts/daily-check-v19-*",
    "scripts/live-prepare-v19-*",
    "scripts/smoke-test-resource-provisioner*",
    "scripts/install-opencost-local.ps1",
    "scripts/start-opencost-*",
    "scripts/smoke-test-billing-opencost.mjs",
  ],
  slice: {
    id: slice.id,
    status: slice.status,
  },
}, null, 2));
