import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const taxonomyDirs = [
  "active",
  "product",
  "runtime",
  "specs",
  "policies",
  "delivery",
  "source",
  "public",
  "references",
  "history",
];

const retiredPaths = [
  ["docs", "contracts"].join("/"),
  ["docs", "recovery"].join("/"),
  ["docs", "product.md"].join("/"),
  ["docs", "architecture.md"].join("/"),
  ["docs", "status.md"].join("/"),
  ["docs", "invariants.md"].join("/"),
  ["docs", "decisions.md"].join("/"),
  ["docs", "vibe-coding.md"].join("/"),
  ["scripts", ["v22", "agent", "workflow"].join("-") + ".mjs"].join("/"),
  ["scripts", ["v22", "cloud", "harness", "select", "checks"].join("-") + ".mjs"].join("/"),
  ["scripts", ["v22", "cloud", "operation", "local", "executor"].join("-") + ".mjs"].join("/"),
  ["scripts", ["v22", "retired", "surface", "data"].join("-") + ".mjs"].join("/"),
  ["scripts", ["v22", "tencent", "readonly", "inventory", "runner"].join("-") + ".mjs"].join("/"),
  ["scripts", ["check", "mojibake"].join("-") + ".mjs"].join("/"),
  "tests/fixtures/v22/autonomous-goal-runner-policy.json",
  "tests/fixtures/v22/cloud-harness-manifest.json",
  "tests/fixtures/v22/goal-leaf-manifest.schema.json",
  "tests/fixtures/v22/product-completion-scoreboard.json",
];

const allowedScripts = [
  "scripts/sync-workspace-file-to-minio.ps1",
  "scripts/v22-absorb-closeout.mjs",
  "scripts/v22-line-budget.mjs",
  "scripts/v22-repo-hygiene.mjs",
  "scripts/v22-test-classification.mjs",
  "scripts/v22-verify.mjs",
  "scripts/v22-workflow-gate.mjs",
];

const oldLiteralFragments = [
  ["docs", "contracts"].join("/"),
  ["docs", "recovery"].join("/"),
  ["docs", "product.md"].join("/"),
  ["docs", "architecture.md"].join("/"),
  ["docs", "status.md"].join("/"),
  ["docs", "invariants.md"].join("/"),
  ["docs", "decisions.md"].join("/"),
  ["docs", "vibe-coding.md"].join("/"),
  ["v22", "agent", "workflow"].join("-"),
  ["v22", "cloud", "harness"].join("-"),
  ["v22", "cloud", "operation", "local", "executor"].join("-"),
  ["v22", "tencent", "readonly", "inventory", "runner"].join("-"),
  ["v22", "retired", "surface", "data"].join("-"),
  ["check", "mojibake"].join("-"),
];

const allowedOldLiteralFiles = new Set([
  "docs/README.md",
  "tests/contract/contract-test-v22-agent-verify-entrypoint.mjs",
  "tests/contract/contract-test-v22-current-state-index-loop.mjs",
  "tests/contract/contract-test-v22-full-taxonomy-hard-retirement.mjs",
  "tests/fixtures/v22/agent-verify-manifest.json",
  "tests/health/health-check-v22-workflow-gate.mjs",
  "tests/health/health-check-v22-smoke-eval-boundary.mjs",
  "tests/health/health-check-v22-zero-compat-active-surface-gate.mjs",
  "scripts/v22-workflow-gate.mjs",
]);

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function listFiles(rootPath) {
  if (!(await exists(rootPath))) return [];
  const entries = await readdir(path.join(repoRoot, rootPath), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${rootPath}/${entry.name}`.replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if ([".git", "node_modules", ".runtime", "dist", "coverage"].includes(entry.name)) continue;
      files.push(...await listFiles(repoPath));
    } else if (entry.isFile()) {
      files.push(repoPath);
    }
  }
  return files.sort();
}

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

for (const repoPath of retiredPaths) {
  assert.equal(await exists(repoPath), false, `retired_path_must_not_exist:${repoPath}`);
}

assert.equal(await exists("docs/README.md"), true, "docs_root_readme_required");
for (const dir of taxonomyDirs) {
  const files = await listFiles(`docs/${dir}`);
  assert.deepEqual(files, [`docs/${dir}/README.md`], `taxonomy_dir_must_only_contain_readme:${dir}`);
}

const scripts = (await listFiles("scripts")).sort();
assert.deepEqual(scripts, allowedScripts, "scripts_root_must_only_keep_runner_classifier_workflow_and_service_sync_helper");

const fixtureFiles = (await listFiles("tests/fixtures/v22")).sort();
assert.deepEqual(fixtureFiles, [
  "tests/fixtures/v22/agent-verify-manifest.json",
  "tests/fixtures/v22/goal-current.json",
  "tests/fixtures/v22/line-budget-baseline.json",
], "fixtures_must_only_keep_current_and_manifest");

const verifySource = await readRepoFile("scripts/v22-verify.mjs");
assert(verifySource.includes("tests/fixtures/v22/agent-verify-manifest.json"), "verify_must_read_fixture_manifest");
assert(verifySource.includes("tests/fixtures/v22/goal-current.json"), "verify_must_read_fixture_current");

const classificationSource = await readRepoFile("scripts/v22-test-classification.mjs");
assert(classificationSource.includes("listTestFiles"), "classification_must_scan_tests_taxonomy");
assert(!classificationSource.includes("scripts/smoke-test-v22-"), "classification_must_not_reference_legacy_script_smoke");

const textFiles = [
  "AGENTS.md",
  "README.md",
  "DESIGN.md",
  ...await listFiles("docs"),
  ...await listFiles("tests"),
  ...await listFiles("scripts"),
].filter((file) => /\.(?:md|mjs|json|ps1)$/u.test(file));

const staleReferences = [];
for (const file of textFiles) {
  if (allowedOldLiteralFiles.has(file)) continue;
  const source = await readRepoFile(file);
  for (const literal of oldLiteralFragments) {
    if (source.includes(literal)) {
      staleReferences.push({ file, literal });
    }
  }
}

assert.deepEqual(staleReferences, [], `retired_literal_references_must_not_remain:${JSON.stringify(staleReferences, null, 2)}`);

const history = await readRepoFile("docs/history/README.md");
for (const phrase of [
  "agent-run evidence 摘要",
  "subagent Kant",
  "subagent Nietzsche",
  "subagent Turing",
  "cleanup/v22-full-taxonomy-hard-retirement",
]) {
  assert(history.includes(phrase), `history_must_record_run_context:${phrase}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_full_taxonomy_hard_retirement",
  docsTaxonomyDirs: taxonomyDirs.length,
  scripts,
  fixtureFiles,
}, null, 2));
