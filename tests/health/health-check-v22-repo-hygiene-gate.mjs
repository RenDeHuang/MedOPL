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
  "frontendProductionDependencyAudit",
  "rootProductionDependencyAudit",
  "npm audit --omit=dev --audit-level=high --json",
  "npm --prefix services/portal/frontend audit --omit=dev --audit-level=high --json",
  "root_production_dependency_vulnerability",
  "frontend_production_dependency_vulnerability",
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
assert.deepEqual(
  payload.checked.frontendProductionDependencyAudit.command,
  ["npm", "--prefix", "services/portal/frontend", "audit", "--omit=dev", "--audit-level=high", "--json"],
  "repo_hygiene_must_run_frontend_production_dependency_audit",
);
assert.equal(payload.checked.frontendProductionDependencyAudit.maxHighVulnerabilities, 0, "repo_hygiene_frontend_audit_high_threshold_mismatch");
assert.equal(payload.checked.frontendProductionDependencyAudit.highVulnerabilities, 0, "repo_hygiene_frontend_prod_high_vulnerabilities_must_be_zero");
assert.equal(
  payload.checked.currentTruthLocalServiceClaimFiles.some((item) => item.startsWith("changes/")),
  false,
  "repo_hygiene_must_not_scan_retired_changes_for_current_truth",
);
assert.deepEqual(
  payload.checked.rootProductionDependencyAudit.command,
  ["npm", "audit", "--omit=dev", "--audit-level=high", "--json"],
  "repo_hygiene_must_run_root_production_dependency_audit",
);
assert.equal(payload.checked.rootProductionDependencyAudit.maxHighOrCriticalVulnerabilities, 0, "repo_hygiene_root_audit_high_or_critical_threshold_mismatch");
assert.equal(payload.checked.rootProductionDependencyAudit.highOrCriticalVulnerabilities, 0, "repo_hygiene_root_prod_high_or_critical_vulnerabilities_must_be_zero");

const suite = manifest.suites.find((item) => item.id === "repo-hygiene");
assert(suite, "repo_hygiene_suite_missing");
assert(suite.commands.includes("node scripts/v22-repo-hygiene.mjs"), "repo_hygiene_suite_must_run_script");
assert(suite.commands.includes("node tests/health/health-check-v22-repo-hygiene-gate.mjs"), "repo_hygiene_suite_must_run_self_gate");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_repo_hygiene_gate",
}, null, 2));
