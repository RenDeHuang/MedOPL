import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const commercialLaunchChecks = [
  "tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs",
  "tests/regression/portal/regression-test-v22-saas-portal-opl-ops-surface-contract.mjs",
  "tests/regression/portal/regression-test-v22-retire-legacy-resource-user-surface.mjs",
];

for (const testFile of commercialLaunchChecks) {
  const result = spawnSync(process.execPath, [testFile], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(
    result.status,
    0,
    `commercial_launch_ui_productization_check_failed:${testFile}:${result.stderr || result.stdout}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_commercial_launch_ui_productization_frontend",
  checked: commercialLaunchChecks,
}, null, 2));
