import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listSmokeEvalScripts, smokeEvalMetadataOf } from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const activeSource = await readFile(path.join(repoRoot, "docs/active/README.md"), "utf8");
const productSource = await readFile(path.join(repoRoot, "docs/product/README.md"), "utf8");
const runtimeSource = await readFile(path.join(repoRoot, "docs/runtime/README.md"), "utf8");
const specsSource = await readFile(path.join(repoRoot, "docs/specs/README.md"), "utf8");
const current = JSON.parse(await readFile(path.join(repoRoot, "tests/fixtures/v22/goal-current.json"), "utf8"));

for (const phrase of [
  "platform-provisioned / customer-dedicated",
  "portal.medopl.cn",
  "opl.medopl.cn",
  "gflabtoken",
  "7 天保护期",
  "120min",
  "T+1",
]) {
  assert(productSource.includes(phrase), `product_truth_missing:${phrase}`);
}

for (const phrase of [
  "PostgreSQL",
  "Redis",
]) {
  assert(runtimeSource.includes(phrase), `runtime_truth_missing:${phrase}`);
}

for (const phrase of [
  "spec:v22-mvp-managed-opl-loop",
  "spec:v22-saas-control-plane-user-experience-boundary",
  "spec:v22-smoke-eval-boundary",
  "spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary",
  "spec:v22-portal-files-billing-trace-boundary",
]) {
  assert(specsSource.includes(phrase), `spec_truth_missing:${phrase}`);
}

assert(current.current_cursor, "current_cursor_required");
assert(activeSource.includes(`| current cursor | \`${current.current_cursor}\` |`), "active_truth_must_track_current_cursor");
assert(activeSource.includes("| current phase |"), "active_truth_must_track_current_phase");
assert(activeSource.includes("| current blocker |"), "active_truth_must_track_current_blocker");
assert.equal(current.release_readiness_state.cursor_eligible, false, "release_readiness_must_not_be_cursor_eligible");

const mvpLocalTiers = ["health-check", "smoke-golden", "contract-local"];
const smokeScripts = listSmokeEvalScripts({ tiers: mvpLocalTiers })
  .filter((scriptPath) => scriptPath !== "tests/contract/contract-test-v22-mvp-contract-suite.mjs")
  .filter((scriptPath) => !scriptPath.startsWith("tests/fixtures/"))
  .filter((scriptPath) => smokeEvalMetadataOf(scriptPath).entryKind !== "suite-wrapper");

const passed = [];
for (const scriptPath of smokeScripts) {
  const metadata = smokeEvalMetadataOf(scriptPath);
  assert.notEqual(metadata.tier, "local-regression", `mvp_suite_must_not_run_local_regression:${scriptPath}`);
  assert.notEqual(metadata.tier, "future-authorized", `mvp_suite_must_not_run_future_authorized:${scriptPath}`);
  assert.notEqual(metadata.tier, "local-rc-authorized", `mvp_suite_must_not_run_local_rc_authorized:${scriptPath}`);
  assert.equal(metadata.authorization, "none", `mvp_suite_must_not_require_authorization:${scriptPath}`);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`mvp_suite_member_failed:${scriptPath}`);
  }
  passed.push(scriptPath);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_mvp_contract_acceptance_suite",
  currentCursor: current.current_cursor,
  passed,
}, null, 2));
