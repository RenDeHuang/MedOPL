import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotMatches(source, pattern, label) {
  assert.equal(pattern.test(source), false, `${label}_must_not_match:${pattern}`);
}

const [
  agents,
  docsIndex,
  active,
  policies,
  delivery,
  source,
  packageJson,
  workflowSource,
  manifest,
  closeoutSource,
  gateSource,
] = await Promise.all([
  readRepoFile("AGENTS.md"),
  readRepoFile("docs/README.md"),
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/policies/README.md"),
  readRepoFile("docs/delivery/README.md"),
  readRepoFile("docs/source/README.md"),
  readJson("package.json"),
  readRepoFile(".github/workflows/verify.yml"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readRepoFile("scripts/v22-landing-closeout.mjs"),
  readRepoFile("scripts/v22-workflow-gate.mjs"),
]);

for (const [label, sourceText] of Object.entries({
  agents,
  docsIndex,
  policies,
  delivery,
  source,
})) {
  assertIncludesAll(sourceText, [
    "authoring branch",
    "landing gate",
    "post-merge closeout",
    "清退",
  ], `framework_terms:${label}`);
  assertNotMatches(sourceText, /A\/B\/C\s*窗口|A 窗口|B 窗口|C 窗口|B review|B absorb|B 吸收|post-absorb/u, `legacy_window_terms:${label}`);
}

assertIncludesAll(active, [
  "governance-verification-post-merge-closeout",
  "不能跳过 post-merge closeout",
], "active_framework_loop");

assertIncludesAll(policies, [
  "Framework Landing Protocol",
  "Cleanup Lifecycle Policy",
  "ready_for_landing_review",
], "policies_framework_loop");

assertIncludesAll(delivery, [
  "Framework Entry Commands",
  "Authoring Record Discipline",
  "landing gate recommendation",
], "delivery_framework_loop");

assertIncludesAll(source, [
  "Cleanup Source Semantics",
  "Cleanup item",
], "source_cleanup_terms");

const expectedScripts = {
  "test:health": "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk",
  "test:smoke": "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk",
  "test:contract": "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "test:regression": "node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk",
  "gate:contract": "node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk",
  "closeout:check": "node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk",
};

for (const [scriptName, command] of Object.entries(expectedScripts)) {
  assert.equal(packageJson.scripts?.[scriptName], command, `framework_package_script_mismatch:${scriptName}`);
  assert(workflowSource.includes(`npm run ${scriptName}`), `verify_workflow_must_run_script:${scriptName}`);
}

assert.equal(manifest.required_post_merge_fields?.includes("landing_gate_result"), true, "manifest_must_require_landing_gate_result");
assert.equal(manifest.required_post_merge_fields?.includes("post_merge_closeout"), true, "manifest_must_require_post_merge_closeout");
assert.equal(manifest.required_post_absorb_fields, undefined, "manifest_must_remove_post_absorb_schema");

const contractGate = manifest.package_suites.find((suite) => suite.id === "contract-gate");
assert(contractGate, "contract_gate_package_suite_missing");
for (const command of [
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite mvp --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite history-closeout --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
]) {
  assert(contractGate.commands.includes(command), `contract_gate_command_missing:${command}`);
}

assert.equal(closeoutSource.includes("required_post_absorb_fields"), false, "closeout_script_must_remove_post_absorb_schema");
assertIncludesAll(closeoutSource, [
  "ready_for_landing_review",
  "landing_gate_result",
  "post_merge_closeout",
], "closeout_script_framework_terms");

assert.equal(gateSource.includes("只由 B 窗口执行 push"), false, "workflow_checkpoint_must_remove_b_window_push");
assertIncludesAll(gateSource, [
  "landing operator",
  "landing gate",
], "workflow_gate_framework_terms");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_framework_workflow_convergence",
  checkedDocs: ["AGENTS.md", "docs/README.md", "docs/active/README.md", "docs/policies/README.md", "docs/delivery/README.md", "docs/source/README.md"],
  packageScripts: Object.keys(expectedScripts).sort(),
}, null, 2));
