import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const docsDirs = [
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

const retiredEntrypoints = [
  "distributed contract leaf docs",
  "recovery process docs",
  "legacy root product doc",
  "legacy root architecture doc",
  "legacy root status doc",
  "legacy root invariants doc",
  "legacy root decisions doc",
  "legacy root vibe-coding doc",
  "scripts/smoke-test-*",
];

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

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
  const entries = await readdir(path.join(repoRoot, rootPath), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${rootPath}/${entry.name}`.replaceAll("\\", "/");
    if (entry.isDirectory()) files.push(...await listFiles(repoPath));
    if (entry.isFile()) files.push(repoPath);
  }
  return files.sort();
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertSectionHas(source, heading, expected, label) {
  const start = source.indexOf(heading);
  assert(start >= 0, `${label}_section_missing:${heading}`);
  const next = source.indexOf("\n## ", start + heading.length);
  const section = next >= 0 ? source.slice(start, next) : source.slice(start);
  assertIncludes(section, expected, label);
}

for (const dir of docsDirs) {
  const files = await listFiles(`docs/${dir}`);
  assert.deepEqual(files, [`docs/${dir}/README.md`], `docs_dir_must_only_contain_readme:${dir}`);
}

const [docsIndex, active, policies, history, testsReadme] = await Promise.all([
  readRepoFile("docs/README.md"),
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/policies/README.md"),
  readRepoFile("docs/history/README.md"),
  readRepoFile("tests/README.md"),
]);

assertIncludes(docsIndex, "## Document Portfolio Ledger", "docs_index_portfolio_ledger");
assertIncludes(docsIndex, "allowed content", "docs_index_portfolio_allowed_content");
assertIncludes(docsIndex, "forbidden content", "docs_index_portfolio_forbidden_content");
assertIncludes(docsIndex, "history handoff", "docs_index_portfolio_history_handoff");
assertIncludes(docsIndex, "docs/**` 是人读生命周期面", "docs_index_must_define_human_lifecycle_surface");
assertIncludes(docsIndex, "机器真相归 source、tests、fixtures、manifest、runner 和 API/CLI 行为", "docs_index_must_define_machine_truth_surface");
assertIncludes(docsIndex, "open baton", "docs_index_must_define_open_baton_lifecycle");
assertIncludes(docsIndex, "完成后必须折叠为 `docs/history/README.md` 摘要、closed summary 和 next cursor", "docs_index_must_define_baton_closeout");
for (const dir of docsDirs) {
  assertIncludes(docsIndex, `docs/${dir}/README.md`, `docs_index_must_register_dir:${dir}`);
}

assertSectionHas(active, "## Active Surface Rule", "current facts, gap, cursor, cannot-claim, and next action", "active_surface_rule");
assertSectionHas(policies, "## Human / Machine Boundary", "README files are human truth, not machine APIs", "policies_human_machine_boundary");
assertSectionHas(testsReadme, "## Docs Gate Boundary", "must not assert prose wording as machine truth", "tests_docs_gate_boundary");

assertIncludes(history, "## Tombstone Map", "history_tombstone_map");
for (const entrypoint of retiredEntrypoints) {
  assertIncludes(history, entrypoint, `history_tombstone_entry:${entrypoint}`);
}

for (const repoPath of [["docs", "contracts"].join("/"), ["docs", "recovery"].join("/")]) {
  assert.equal(await exists(repoPath), false, `retired_docs_path_must_not_exist:${repoPath}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_docs_portfolio_lifecycle",
  docsDirs,
  retiredEntrypoints,
}, null, 2));
