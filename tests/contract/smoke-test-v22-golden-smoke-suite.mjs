import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SMOKE_GOLDEN_MAX,
  SMOKE_GOLDEN_MIN,
  SMOKE_GOLDEN_SCRIPTS,
  smokeEvalMetadataOf,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

assert(SMOKE_GOLDEN_SCRIPTS.length >= SMOKE_GOLDEN_MIN, "golden_smoke_must_cover_core_path");
assert(SMOKE_GOLDEN_SCRIPTS.length <= SMOKE_GOLDEN_MAX, "golden_smoke_must_stay_small");

const passed = [];

for (const scriptPath of SMOKE_GOLDEN_SCRIPTS) {
  const metadata = smokeEvalMetadataOf(scriptPath);
  assert.equal(metadata.tier, "smoke-golden", `golden_suite_must_only_run_golden_tier:${scriptPath}`);
  assert.equal(metadata.category === "cloud-future-authorized", false, `golden_suite_must_not_run_future_authorized:${scriptPath}`);
  assert.equal(/(?:cloud|tencent|authorized|deploy|package-d|live|canary)/iu.test(path.basename(scriptPath)), false, `golden_suite_must_not_run_future_or_live:${scriptPath}`);

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`golden_smoke_failed:${scriptPath}`);
  }
  passed.push(scriptPath);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_golden_smoke_suite",
  passed,
}, null, 2));
