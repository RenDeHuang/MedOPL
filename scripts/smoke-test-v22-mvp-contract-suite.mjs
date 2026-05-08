import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const reportPath = "docs/recovery/mvp-contract-acceptance.md";

const requiredReportPhrases = [
  "pricing snapshot contract",
  "MVP managed OPL loop contract",
  "user credit provider key flow",
  "managed environment open flow",
  "OPL work message/file/run flow",
  "Portal files/billing/trace flow",
  "release stop billing audit flow",
  "contract-level + Portal API/domain 小闭包",
  "不是完整真实上线",
  "Portal frontend MVP UI",
  "Gateway / Runtime Bridge 真实联通",
  "one-person-lab 实际拉取/部署/运行接入",
  "真实云资源开通",
  "真实价格审批",
  "Langfuse 真实 trace source 接入",
  "cleanup 删除 v19/v20/v21 旧路线",
];

const smokeScripts = [
  ["smoke-test-v22-pricing-plan-contract", "scripts/smoke-test-v22-pricing-plan-contract.mjs"],
  ["smoke-test-v22-gflabtoken-entry-contract", "scripts/smoke-test-v22-gflabtoken-entry-contract.mjs"],
  ["smoke-test-v22-retire-portal-provider-key-entry", "scripts/smoke-test-v22-retire-portal-provider-key-entry.mjs"],
  ["smoke-test-v22-opl-entry-preflight-auth-flow", "scripts/smoke-test-v22-opl-entry-preflight-auth-flow.mjs"],
  ["smoke-test-v22-opl-dual-entry-contract", "scripts/smoke-test-v22-opl-dual-entry-contract.mjs"],
  ["smoke-test-v22-opl-gateway-upstream-proxy-local", "scripts/smoke-test-v22-opl-gateway-upstream-proxy-local.mjs"],
  ["smoke-test-v22-opl-runtime-e2e-local-flow", "scripts/smoke-test-v22-opl-runtime-e2e-local-flow.mjs"],
  ["smoke-test-v22-mvp-managed-opl-loop-contract", "scripts/smoke-test-v22-mvp-managed-opl-loop-contract.mjs"],
  ["smoke-test-v22-user-credit-provider-key-flow", "scripts/smoke-test-v22-user-credit-provider-key-flow.mjs"],
  ["smoke-test-v22-managed-environment-open-flow", "scripts/smoke-test-v22-managed-environment-open-flow.mjs"],
  ["smoke-test-v22-managed-resource-binding-plan-view", "scripts/smoke-test-v22-managed-resource-binding-plan-view.mjs"],
  ["smoke-test-v22-tencent-readonly-quote-provider-boundary", "scripts/smoke-test-v22-tencent-readonly-quote-provider-boundary.mjs"],
  ["smoke-test-v22-tencent-dry-run-resource-plan-provider", "scripts/smoke-test-v22-tencent-dry-run-resource-plan-provider.mjs"],
  ["smoke-test-v22-authorized-tencent-create-release-contract", "scripts/smoke-test-v22-authorized-tencent-create-release-contract.mjs"],
  ["smoke-test-v22-workflow-gate", "scripts/smoke-test-v22-workflow-gate.mjs"],
  ["smoke-test-v22-opl-work-message-file-run-flow", "scripts/smoke-test-v22-opl-work-message-file-run-flow.mjs"],
  ["smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow", "scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs"],
  ["smoke-test-v22-portal-files-billing-trace-flow", "scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs"],
  ["smoke-test-v22-portal-session-trace-view", "scripts/smoke-test-v22-portal-session-trace-view.mjs"],
  ["smoke-test-v22-portal-trace-file-linkage", "scripts/smoke-test-v22-portal-trace-file-linkage.mjs"],
  ["smoke-test-v22-portal-cost-balance-trace-linkage", "scripts/smoke-test-v22-portal-cost-balance-trace-linkage.mjs"],
  ["smoke-test-v22-release-stop-billing-audit-flow", "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs"],
  ["smoke-test-v22-langfuse-observability-metadata-contract", "scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs"],
];

async function assertReportAcceptanceBoundary() {
  const report = await readFile(path.join(repoRoot, reportPath), "utf8");
  for (const phrase of requiredReportPhrases) {
    assert(report.includes(phrase), `mvp_acceptance_report_missing:${phrase}`);
  }
}

async function assertSmokeScriptsExist() {
  for (const [name, scriptPath] of smokeScripts) {
    await access(path.join(repoRoot, scriptPath)).catch((error) => {
      throw new Error(`${name}_missing:${error.message}`);
    });
  }
}

function runSmoke(name, scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    if (result.stdout) {
      process.stderr.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error(`${name}_failed`);
  }
}

await assertReportAcceptanceBoundary();
await assertSmokeScriptsExist();

const passed = [];
for (const [name, scriptPath] of smokeScripts) {
  runSmoke(name, scriptPath);
  passed.push(name);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_mvp_contract_acceptance_suite",
  passed,
}, null, 2));
