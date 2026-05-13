import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readmePath = "README.md";
const vibeCodingPath = "docs/vibe-coding.md";
const mvpSuitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const repoZoningPath = "docs/recovery/repo-zoning.md";

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

const readme = await readFile(readmePath, "utf8");
const vibeCoding = await readFile(vibeCodingPath, "utf8");
const mvpSuite = await readFile(mvpSuitePath, "utf8");
const repoZoning = await readFile(repoZoningPath, "utf8");

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
}, null, 2));
