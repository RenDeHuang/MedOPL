import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listSmokeEvalScripts, smokeEvalMetadataOf } from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const localAcceptanceTiers = ["health-check", "smoke-golden", "contract-local"];
const smokeScripts = listSmokeEvalScripts({ tiers: localAcceptanceTiers })
  .filter((scriptPath) => scriptPath !== "tests/suites/suite-test-v22-local-acceptance.mjs")
  .filter((scriptPath) => !scriptPath.startsWith("tests/fixtures/"))
  .filter((scriptPath) => smokeEvalMetadataOf(scriptPath).entryKind !== "suite-wrapper");

const passed = [];
for (const scriptPath of smokeScripts) {
  const metadata = smokeEvalMetadataOf(scriptPath);
  assert.notEqual(metadata.tier, "local-regression", `local_acceptance_suite_must_not_run_local_regression:${scriptPath}`);
  assert.notEqual(metadata.tier, "future-authorized", `local_acceptance_suite_must_not_run_future_authorized:${scriptPath}`);
  assert.notEqual(metadata.tier, "local-rc-authorized", `local_acceptance_suite_must_not_run_local_rc_authorized:${scriptPath}`);
  assert.equal(metadata.authorization, "none", `local_acceptance_suite_must_not_require_authorization:${scriptPath}`);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`local_acceptance_suite_member_failed:${scriptPath}`);
  }
  passed.push(scriptPath);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_local_acceptance_contract_suite",
  role: "suite-wrapper",
  passed,
}, null, 2));
