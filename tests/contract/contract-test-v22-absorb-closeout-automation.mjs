import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readJson(repoPath) {
  return JSON.parse(await readFile(path.join(repoRoot, repoPath), "utf8"));
}

const current = await readJson("tests/fixtures/v22/goal-current.json");

const result = spawnSync("node", [
  "scripts/v22-absorb-closeout.mjs",
  "check",
  "--trunk-ref",
  "origin/recovery/platform-v22-trunk",
  "--json",
], {
  cwd: repoRoot,
  encoding: "utf8",
  stdio: "pipe",
});

assert.equal(result.status, 0, `absorb_closeout_check_failed:${result.stderr || result.stdout}`);

const payload = JSON.parse(result.stdout);
assert.equal(payload.ok, true, "absorb_closeout_payload_must_be_ok");
assert.equal(payload.trunkRef, "origin/recovery/platform-v22-trunk", "absorb_closeout_trunk_ref_mismatch");
assert.equal(payload.lastAbsorbedCommit, current.last_absorbed_commit, "absorb_closeout_must_read_goal_current");
assert.equal(payload.lastAbsorbedBranch, current.last_absorbed_branch, "absorb_closeout_must_read_latest_branch");
assert.equal(payload.postAbsorbTruthCloseoutCompleted, true, "absorb_closeout_must_confirm_truth_closeout");
assert.deepEqual(payload.missingPostAbsorbFields, [], "absorb_closeout_missing_required_fields");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_absorb_closeout_automation",
  trunkRef: payload.trunkRef,
  lastAbsorbedCommit: payload.lastAbsorbedCommit,
  lastAbsorbedBranch: payload.lastAbsorbedBranch,
}, null, 2));
