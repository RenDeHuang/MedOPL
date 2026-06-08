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

const [scriptSource, baselineSource, manifest] = await Promise.all([
  readFile(path.join(repoRoot, "scripts/v22-line-budget.mjs"), "utf8"),
  readFile(path.join(repoRoot, "tests/fixtures/v22/line-budget-baseline.json"), "utf8"),
  readFile(path.join(repoRoot, "tests/fixtures/v22/agent-verify-manifest.json"), "utf8").then(JSON.parse),
]);
const baseline = JSON.parse(baselineSource);

assert.equal(baseline.default_limit, 1000, "line_budget_default_limit_mismatch");
for (const expected of [
  "services/opl-web-gateway/src/launch-client-script.mjs",
]) {
  assert(Number.isInteger(baseline.files[expected]), `line_budget_baseline_missing:${expected}`);
}
for (const expected of [".mjs", ".ts", ".tsx", ".sh", ".ps1"]) {
  assert(scriptSource.includes(expected), `line_budget_extension_missing:${expected}`);
}
for (const expected of ["stale baseline entry", "exceeds locked baseline", "baseline can be retired"]) {
  assert(scriptSource.includes(expected), `line_budget_rule_missing:${expected}`);
}

const result = runNode(["scripts/v22-line-budget.mjs"]);
assert.equal(result.status, 0, result.stderr || result.stdout);
const payload = JSON.parse(result.stdout);
assert.equal(payload.ok, true, "line_budget_payload_ok");
assert.equal(payload.contract, "v22_line_budget", "line_budget_contract_mismatch");
assert.equal(
  payload.oversize.length,
  Object.keys(baseline.files).length,
  "line_budget_must_report_current_baseline_oversize_files",
);
for (const expected of Object.keys(baseline.files)) {
  assert(
    payload.oversize.some((entry) => entry.file === expected),
    `line_budget_must_report_baseline_file:${expected}`,
  );
}

const suite = manifest.suites.find((item) => item.id === "repo-hygiene");
assert(suite, "repo_hygiene_suite_missing");
assert(suite.commands.includes("node scripts/v22-line-budget.mjs"), "repo_hygiene_suite_must_run_line_budget");
assert(suite.commands.includes("node tests/health/health-check-v22-line-budget-gate.mjs"), "repo_hygiene_suite_must_run_line_budget_self_gate");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_line_budget_gate",
  defaultLimit: baseline.default_limit,
  baselineFiles: Object.keys(baseline.files).sort(),
}, null, 2));
