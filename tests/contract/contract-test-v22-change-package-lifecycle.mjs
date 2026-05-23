import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

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

async function listDirs(repoPath) {
  if (!(await exists(repoPath))) return [];
  const entries = await readdir(path.join(repoRoot, repoPath), { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

assert.equal(await exists("changes/README.md"), true, "changes_readme_required");
assert.equal(await exists("changes/active"), true, "changes_active_dir_required");
assert.equal(await exists("changes/archive"), true, "changes_archive_dir_required");
assert.equal(await exists("specs/README.md"), true, "root_specs_readme_required");
for (const domain of ["product", "runtime", "framework", "operations", "evidence", "policies", "source"]) {
  assert.equal(await exists(`specs/${domain}/spec.md`), true, `domain_spec_required:${domain}`);
}

const changesReadme = await readRepoFile("changes/README.md");
for (const phrase of [
  "repo-native change lifecycle",
  "proposal -> spec delta -> design -> tasks -> eval plan -> implementation -> verify -> review -> archive -> durable specs sync -> history closeout",
  "docs/active/README.md remains the only human current truth",
  "changes/active/<change-id>",
  "changes/archive/YYYY-MM-DD-<change-id>",
  "must not store secrets",
  "must not claim production truth",
]) {
  assertIncludes(changesReadme, phrase, `changes_readme`);
}

assertIncludes(changesReadme, "proposal.md", "changes_required_file");
assertIncludes(changesReadme, "spec-delta.md", "changes_required_file");
assertIncludes(changesReadme, "design.md", "changes_required_file");
assertIncludes(changesReadme, "tasks.md", "changes_required_file");
assertIncludes(changesReadme, "eval-plan.md", "changes_required_file");
assertIncludes(changesReadme, "review.md", "changes_required_file");
assertIncludes(changesReadme, "closeout.md", "changes_required_file");
for (const phrase of [
  "ADDED / MODIFIED / REMOVED / CANNOT-CLAIM / EVALS",
  "Every delta entry must reference a target `specs/<domain>/spec.md` file",
  "Accepted deltas must be synced into durable specs during closeout",
]) {
  assertIncludes(changesReadme, phrase, "changes_spec_delta_rules");
}
assertIncludes(changesReadme, "## File Templates", "changes_template_section");
for (const heading of [
  "### proposal.md",
  "### spec-delta.md",
  "### design.md",
  "### tasks.md",
  "### eval-plan.md",
  "### review.md",
  "### closeout.md",
]) {
  assertIncludes(changesReadme, heading, `changes_template_heading:${heading}`);
}

const activeChanges = await listDirs("changes/active");
for (const changeId of activeChanges) {
  assert(!/^template$/iu.test(changeId), "active_changes_must_not_use_template_id");
}

const specsReadme = await readRepoFile("specs/README.md");
assertIncludes(specsReadme, "durable behavior specs", "root_specs_readme");
assertIncludes(specsReadme, "docs/specs/README.md remains the human contract index", "root_specs_readme");
assertIncludes(specsReadme, "changes/active/<change-id>/spec-delta.md", "root_specs_readme");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_change_package_lifecycle",
  activeChanges,
}, null, 2));
