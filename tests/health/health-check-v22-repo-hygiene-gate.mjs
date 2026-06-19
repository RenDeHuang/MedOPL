import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

const scriptSource = await readFile(path.join(repoRoot, "scripts/v22-repo-hygiene.mjs"), "utf8");
const manifest = JSON.parse(await readFile(path.join(repoRoot, "tests/fixtures/v22/agent-verify-manifest.json"), "utf8"));

for (const expected of [
  ":(glob)**/dist/**",
  ":(glob)**/build/**",
  ":(glob)**/.runtime/**",
  ":(glob)**/.venv/**",
  ":(glob)**/__pycache__/**",
  ":(glob)**/.DS_Store",
  "fixedLocalServiceTruthClaimPattern",
  "currentTruthLocalServiceClaimFiles",
]) {
  assert(scriptSource.includes(expected), `repo_hygiene_must_check:${expected}`);
}

const result = runNode(["scripts/v22-repo-hygiene.mjs"]);
assert.equal(result.status, 0, result.stderr || result.stdout);
const payload = JSON.parse(result.stdout);
assert.equal(payload.ok, true, "repo_hygiene_payload_ok");
assert.equal(payload.contract, "v22_repo_hygiene", "repo_hygiene_contract_mismatch");
assert(payload.checked.currentTruthLocalServiceClaimFiles.includes("docs/active/README.md"), "repo_hygiene_must_scan_active_truth_for_local_service_claims");
assert(payload.checked.currentTruthLocalServiceClaimFiles.includes("docs/delivery/README.md"), "repo_hygiene_must_scan_delivery_truth_for_local_service_claims");
assert.equal(
  payload.checked.currentTruthLocalServiceClaimFiles.some((item) => item.startsWith("changes/")),
  false,
  "repo_hygiene_must_not_scan_retired_changes_for_current_truth",
);

const suite = manifest.suites.find((item) => item.id === "repo-hygiene");
assert(suite, "repo_hygiene_suite_missing");
assert(suite.commands.includes("node scripts/v22-repo-hygiene.mjs"), "repo_hygiene_suite_must_run_script");
assert(suite.commands.includes("node tests/health/health-check-v22-repo-hygiene-gate.mjs"), "repo_hygiene_suite_must_run_self_gate");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_repo_hygiene_gate",
}, null, 2));
