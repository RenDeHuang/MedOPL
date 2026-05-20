import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const smokeScripts = [
  ["smoke-test-v22-cloud-resource-isolation-contract", "tests/future-authorized/cloud/future-authorized-test-v22-cloud-resource-isolation-contract.mjs"],
  ["smoke-test-v22-resource-plan-contract", "tests/smoke/smoke-test-v22-resource-plan-contract.mjs"],
  ["smoke-test-v22-pricing-plan-contract", "tests/smoke/smoke-test-v22-pricing-plan-contract.mjs"],
  ["smoke-test-v22-production-cloud-topology-contract", "tests/future-authorized/cloud/future-authorized-test-v22-production-cloud-topology-contract.mjs"],
  ["smoke-test-v22-authorized-tencent-create-release-contract", "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-contract.mjs"],
  ["smoke-test-v22-authorized-tencent-create-release-execution-contract", "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-execution-contract.mjs"],
  ["smoke-test-v22-authorized-tencent-deploy-execution-contract", "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-deploy-execution-contract.mjs"],
  ["smoke-test-v22-opl-deployment-ownership-release-plan-contract", "tests/future-authorized/cloud/future-authorized-test-v22-opl-deployment-ownership-release-plan-contract.mjs"],
  ["smoke-test-v22-cloud-onboarding-workflow-contract", "tests/future-authorized/cloud/future-authorized-test-v22-cloud-onboarding-workflow-contract.mjs"],
  ["smoke-test-v22-cloud-onboarding-board-status", "tests/future-authorized/cloud/future-authorized-test-v22-cloud-onboarding-board-status.mjs"],
];

function runSmoke(name, scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${name}_failed`);
  }
}

const passed = [];
for (const [name, scriptPath] of smokeScripts) {
  runSmoke(name, scriptPath);
  passed.push(name);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_resource_contract_suite",
  purpose: "scoped_b_review_entry_for_package_c_resource_isolation_and_package_d_no_resource_lifecycle_mutation",
  replacesMvpSuite: false,
  readsSecret: false,
  callsRealCloud: false,
  passed,
}, null, 2));
