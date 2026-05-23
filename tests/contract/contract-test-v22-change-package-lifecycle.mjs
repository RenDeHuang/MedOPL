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

const requiredChangeFiles = Object.freeze([
  "proposal.md",
  "spec-delta.md",
  "design.md",
  "tasks.md",
  "eval-plan.md",
  "review.md",
  "closeout.md",
]);

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

async function assertChangePackage({ root, changeId, archived }) {
  const changePath = `${root}/${changeId}`;
  for (const file of requiredChangeFiles) {
    assert.equal(await exists(`${changePath}/${file}`), true, `change_required_file_missing:${changePath}/${file}`);
  }
  if (archived) {
    assert(/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/u.test(changeId), `archived_change_id_must_include_date:${changeId}`);
  } else {
    assert(/^[a-z0-9][a-z0-9-]*$/u.test(changeId), `active_change_id_must_be_kebab:${changeId}`);
    assert(!/^(?:template|tmp|misc|wip)$/iu.test(changeId), `active_change_id_forbidden:${changeId}`);
  }

  const proposal = await readRepoFile(`${changePath}/proposal.md`);
  const specDelta = await readRepoFile(`${changePath}/spec-delta.md`);
  const evalPlan = await readRepoFile(`${changePath}/eval-plan.md`);
  const closeout = await readRepoFile(`${changePath}/closeout.md`);
  const joined = [proposal, specDelta, evalPlan, closeout].join("\n");

  for (const phrase of ["Owner:", "Affected plane:", "## Authorization Boundary", "## Non-Goals"]) {
    assertIncludes(proposal, phrase, `proposal_required_section:${changePath}`);
  }
  for (const heading of ["## ADDED", "## MODIFIED", "## REMOVED", "## CANNOT-CLAIM", "## EVALS"]) {
    assertIncludes(specDelta, heading, `spec_delta_required_section:${changePath}`);
  }
  assert(/specs\/[a-z-]+\/spec\.md/u.test(specDelta), `spec_delta_must_target_domain_spec:${changePath}`);
  assert(/node (?:tests|scripts)\//u.test(evalPlan), `eval_plan_must_reference_eval_command:${changePath}`);
  assertIncludes(closeout, "## Can Claim", `closeout_required_section:${changePath}`);
  assertIncludes(closeout, "## Cannot Claim", `closeout_required_section:${changePath}`);
  assertIncludes(closeout, "## Archive Target", `closeout_required_section:${changePath}`);
  if (archived) {
    assert(/Status:\s*(?:landed|archived)/iu.test(closeout), `archived_closeout_status_must_be_landed_or_archived:${changePath}`);
    assertIncludes(closeout, changePath, `archived_closeout_must_reference_own_archive_target:${changePath}`);
  } else {
    assert(!/Status:\s*archived/iu.test(closeout), `active_closeout_must_not_be_archived:${changePath}`);
  }
  assert(!/\b(?:sk-[A-Za-z0-9_-]{20,}|SECRET_KEY\s*=|SECRET_ID\s*=|PRIVATE KEY|kubeconfig\s*[:=])/u.test(joined), `change_package_must_not_store_secret:${changePath}`);
  assert(!/\bproduction (?:deploy|runtime|cloud|billing) (?:is )?(?:complete|ready|live)\b/iu.test(joined), `change_package_must_not_claim_production_truth:${changePath}`);
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

const activeChanges = (await listDirs("changes/active")).filter((name) => name !== ".gitkeep");
for (const changeId of activeChanges) {
  assert(!/^template$/iu.test(changeId), "active_changes_must_not_use_template_id");
  await assertChangePackage({ root: "changes/active", changeId, archived: false });
}
const archivedChanges = (await listDirs("changes/archive")).filter((name) => name !== ".gitkeep");
for (const changeId of archivedChanges) {
  await assertChangePackage({ root: "changes/archive", changeId, archived: true });
}

const specsReadme = await readRepoFile("specs/README.md");
assertIncludes(specsReadme, "durable behavior specs", "root_specs_readme");
assertIncludes(specsReadme, "docs/specs/README.md remains the human contract index", "root_specs_readme");
assertIncludes(specsReadme, "changes/active/<change-id>/spec-delta.md", "root_specs_readme");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_change_package_lifecycle",
  activeChanges,
  archivedChanges,
}, null, 2));
