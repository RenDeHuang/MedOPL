import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

const hygiene = spawnSync(process.execPath, ["scripts/v22-repo-hygiene.mjs"], {
  cwd: repoRoot,
  encoding: "utf8",
  stdio: "pipe",
});
assert.equal(hygiene.status, 0, hygiene.stderr || hygiene.stdout);

const repoBloat = spawnSync(process.execPath, ["scripts/v22-repo-bloat-audit.mjs", "--json"], {
  cwd: repoRoot,
  encoding: "utf8",
  stdio: "pipe",
});
assert.equal(repoBloat.status, 0, repoBloat.stderr || repoBloat.stdout);
const repoBloatPayload = JSON.parse(repoBloat.stdout);
assert.equal(repoBloatPayload.ok, true, "repo_bloat_audit_must_pass_current_repo");

assert.equal(await exists("changes"), false, "changes_directory_must_stay_retired");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_secret_and_retired_changes_boundary",
}, null, 2));
