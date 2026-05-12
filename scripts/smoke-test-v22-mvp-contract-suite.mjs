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
  "Portal structure/failure isolation governance contract",
  "release stop billing audit flow",
  "contract-level + Portal API/domain 小闭包",
  "不是完整真实上线",
  "Portal frontend MVP UI",
  "Gateway / Runtime Bridge 生产联通",
  "scripts/smoke-test-v22-opl-adapter-state-store-atomic-flow.mjs",
  "scripts/smoke-test-v22-portal-opl-adapter-api-local-flow.mjs",
  "scripts/smoke-test-v22-portal-opl-api-runtime-loop.mjs",
  "scripts/smoke-test-v22-portal-opl-context-backflow-contract.mjs",
  "scripts/smoke-test-v22-real-opl-capability-canary-contract.mjs",
  "scripts/smoke-test-v22-real-opl-provider-message-canary-contract.mjs",
  "scripts/smoke-test-v22-real-opl-file-run-artifact-canary-contract.mjs",
  "scripts/smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop.mjs",
  "scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs",
  "/home/dev/projects/one-person-lab` 主仓真实 canary 已确认",
  "真实 OPL/AionUI WebUI canary 已确认",
  "`/api/opl/*` 只是通用 `/api` catch-all 200 placeholder",
  "真实 WebUI Adapter session bridge canary",
  "run 在没有真实 Runtime Agent relay 时不能伪成功",
  "one-person-lab 实际拉取/部署/运行接入：已完成主仓本地 canary",
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
  ["smoke-test-v22-portal-opl-connection-contract", "scripts/smoke-test-v22-portal-opl-connection-contract.mjs"],
  ["smoke-test-v22-portal-opl-context-backflow-contract", "scripts/smoke-test-v22-portal-opl-context-backflow-contract.mjs"],
  ["smoke-test-v22-real-opl-capability-canary-contract", "scripts/smoke-test-v22-real-opl-capability-canary-contract.mjs"],
  ["smoke-test-v22-real-opl-provider-message-canary-contract", "scripts/smoke-test-v22-real-opl-provider-message-canary-contract.mjs"],
  ["smoke-test-v22-real-opl-file-run-artifact-canary-contract", "scripts/smoke-test-v22-real-opl-file-run-artifact-canary-contract.mjs"],
  ["smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop", "scripts/smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop.mjs"],
  ["smoke-test-v22-real-opl-file-run-artifact-gates", "scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs"],
  ["smoke-test-v22-opl-adapter-state-store-atomic-flow", "scripts/smoke-test-v22-opl-adapter-state-store-atomic-flow.mjs"],
  ["smoke-test-v22-portal-opl-adapter-api-local-flow", "scripts/smoke-test-v22-portal-opl-adapter-api-local-flow.mjs"],
  ["smoke-test-v22-portal-opl-api-runtime-loop", "scripts/smoke-test-v22-portal-opl-api-runtime-loop.mjs"],
  ["smoke-test-v22-opl-runtime-e2e-local-flow", "scripts/smoke-test-v22-opl-runtime-e2e-local-flow.mjs"],
  ["smoke-test-v22-mvp-managed-opl-loop-contract", "scripts/smoke-test-v22-mvp-managed-opl-loop-contract.mjs"],
  ["smoke-test-v22-user-credit-provider-key-flow", "scripts/smoke-test-v22-user-credit-provider-key-flow.mjs"],
  ["smoke-test-v22-managed-environment-open-flow", "scripts/smoke-test-v22-managed-environment-open-flow.mjs"],
  ["smoke-test-v22-managed-resource-binding-plan-view", "scripts/smoke-test-v22-managed-resource-binding-plan-view.mjs"],
  ["smoke-test-v22-tencent-readonly-quote-provider-boundary", "scripts/smoke-test-v22-tencent-readonly-quote-provider-boundary.mjs"],
  ["smoke-test-v22-tencent-dry-run-resource-plan-provider", "scripts/smoke-test-v22-tencent-dry-run-resource-plan-provider.mjs"],
  ["smoke-test-v22-production-cloud-topology-contract", "scripts/smoke-test-v22-production-cloud-topology-contract.mjs"],
  ["smoke-test-v22-cloud-onboarding-workflow-contract", "scripts/smoke-test-v22-cloud-onboarding-workflow-contract.mjs"],
  ["smoke-test-v22-cloud-onboarding-board-status", "scripts/smoke-test-v22-cloud-onboarding-board-status.mjs"],
  ["smoke-test-v22-cloud-harness-manifest-selector", "scripts/smoke-test-v22-cloud-harness-manifest-selector.mjs"],
  ["smoke-test-v22-cloud-live-cleanup-gate", "scripts/smoke-test-v22-cloud-live-cleanup-gate.mjs"],
  ["smoke-test-v22-cloud-connection-runnable-path", "scripts/smoke-test-v22-cloud-connection-runnable-path.mjs"],
  ["smoke-test-v22-portal-cloud-operation-test-api-fake-live", "scripts/smoke-test-v22-portal-cloud-operation-test-api-fake-live.mjs"],
  ["smoke-test-v22-portal-cloud-operation-worker-entrypoint", "scripts/smoke-test-v22-portal-cloud-operation-worker-entrypoint.mjs"],
  ["smoke-test-v22-portal-cloud-operation-async-worker-loop", "scripts/smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs"],
  ["smoke-test-v22-portal-production-cloud-operation-loop", "scripts/smoke-test-v22-portal-production-cloud-operation-loop.mjs"],
  ["smoke-test-v22-portal-production-cloud-operation-resource-lifecycle-loop", "scripts/smoke-test-v22-portal-production-cloud-operation-resource-lifecycle-loop.mjs"],
  ["smoke-test-v22-portal-cloud-operation-postgres-canonical-store", "scripts/smoke-test-v22-portal-cloud-operation-postgres-canonical-store.mjs"],
  ["smoke-test-v22-program-board", "scripts/smoke-test-v22-program-board.mjs"],
  ["smoke-test-v22-discovery-canary-governance", "scripts/smoke-test-v22-discovery-canary-governance.mjs"],
  ["smoke-test-v22-agent-workflow-cloud-onboarding", "scripts/smoke-test-v22-agent-workflow-cloud-onboarding.mjs"],
  ["smoke-test-v22-long-term-governance-surfaces", "scripts/smoke-test-v22-long-term-governance-surfaces.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-boundary", "scripts/smoke-test-v22-tencent-readonly-inventory-boundary.mjs"],
  ["smoke-test-v22-tencent-official-sdk-provider-strategy-contract", "scripts/smoke-test-v22-tencent-official-sdk-provider-strategy-contract.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper", "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-official-sdk-loader", "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-official-sdk-shape", "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs"],
  ["smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan", "scripts/smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-local-guard", "scripts/smoke-test-v22-tencent-readonly-inventory-local-guard.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-live-adapter-shell", "scripts/smoke-test-v22-tencent-readonly-inventory-live-adapter-shell.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-sdk-client", "scripts/smoke-test-v22-tencent-readonly-inventory-sdk-client.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-live-runner", "scripts/smoke-test-v22-tencent-readonly-inventory-live-runner.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-real-sdk-client", "scripts/smoke-test-v22-tencent-readonly-inventory-real-sdk-client.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-real-live-run", "scripts/smoke-test-v22-tencent-readonly-inventory-real-live-run.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-tc3-modules", "scripts/smoke-test-v22-tencent-readonly-inventory-tc3-modules.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-live-bridge", "scripts/smoke-test-v22-tencent-readonly-inventory-live-bridge.mjs"],
  ["smoke-test-v22-tencent-readonly-inventory-live-diagnostics", "scripts/smoke-test-v22-tencent-readonly-inventory-live-diagnostics.mjs"],
  ["smoke-test-v22-authorized-tencent-create-release-contract", "scripts/smoke-test-v22-authorized-tencent-create-release-contract.mjs"],
  ["smoke-test-v22-authorized-tencent-create-release-implementation-contract", "scripts/smoke-test-v22-authorized-tencent-create-release-implementation-contract.mjs"],
  ["smoke-test-v22-authorized-tencent-create-release-execution-contract", "scripts/smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs"],
  ["smoke-test-v22-cloud-resource-isolation-contract", "scripts/smoke-test-v22-cloud-resource-isolation-contract.mjs"],
  ["smoke-test-v22-tencent-authorized-resource-lifecycle-runner", "scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-runner.mjs"],
  ["smoke-test-v22-tencent-authorized-resource-lifecycle-live-gate", "scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-live-gate.mjs"],
  ["smoke-test-v22-authorized-tencent-deploy-execution-contract", "scripts/smoke-test-v22-authorized-tencent-deploy-execution-contract.mjs"],
  ["smoke-test-v22-tencent-authorized-deploy-execution-runner", "scripts/smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs"],
  ["smoke-test-v22-tencent-authorized-deploy-execution-live-gate", "scripts/smoke-test-v22-tencent-authorized-deploy-execution-live-gate.mjs"],
  ["smoke-test-v22-package-d-opl-deploy-discovery-status", "scripts/smoke-test-v22-package-d-opl-deploy-discovery-status.mjs"],
  ["smoke-test-v22-opl-deployment-ownership-release-plan-contract", "scripts/smoke-test-v22-opl-deployment-ownership-release-plan-contract.mjs"],
  ["smoke-test-v22-package-d-image-push-gate", "scripts/smoke-test-v22-package-d-image-push-gate.mjs"],
  ["smoke-test-v22-package-d-deploy-dry-run-gate", "scripts/smoke-test-v22-package-d-deploy-dry-run-gate.mjs"],
  ["smoke-test-v22-cloud-onboarding-absorption-sequence", "scripts/smoke-test-v22-cloud-onboarding-absorption-sequence.mjs"],
  ["smoke-test-v22-real-resource-contract-alignment", "scripts/smoke-test-v22-real-resource-contract-alignment.mjs"],
  ["smoke-test-v22-retire-legacy-resource-user-surface", "scripts/smoke-test-v22-retire-legacy-resource-user-surface.mjs"],
  ["smoke-test-v22-admin-ops-console-boundary", "scripts/smoke-test-v22-admin-ops-console-boundary.mjs"],
  ["smoke-test-v22-portal-role-surface-boundaries", "scripts/smoke-test-v22-portal-role-surface-boundaries.mjs"],
  ["smoke-test-v22-portal-structure-failure-isolation-contract", "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs"],
  ["smoke-test-v22-admin-ops-console-readonly-mvp", "scripts/smoke-test-v22-admin-ops-console-readonly-mvp.mjs"],
  ["smoke-test-v22-workflow-gate", "scripts/smoke-test-v22-workflow-gate.mjs"],
  ["smoke-test-v22-portal-runtime-startup-config", "scripts/smoke-test-v22-portal-runtime-startup-config.mjs"],
  ["smoke-test-v22-portal-dev-server-auth-proxy", "scripts/smoke-test-v22-portal-dev-server-auth-proxy.mjs"],
  ["smoke-test-v22-portal-auth-landing-route", "scripts/smoke-test-v22-portal-auth-landing-route.mjs"],
  ["smoke-test-v22-portal-web-route-alignment", "scripts/smoke-test-v22-portal-web-route-alignment.mjs"],
  ["smoke-test-v22-portal-api-auth-boundary", "scripts/smoke-test-v22-portal-api-auth-boundary.mjs"],
  ["smoke-test-v22-portal-package-surface-isolation", "scripts/smoke-test-v22-portal-package-surface-isolation.mjs"],
  ["smoke-test-v22-portal-package-click-cloud-resource-loop", "scripts/smoke-test-v22-portal-package-click-cloud-resource-loop.mjs"],
  ["smoke-test-v22-portal-frontend-surface-composables", "scripts/smoke-test-v22-portal-frontend-surface-composables.mjs"],
  ["smoke-test-v22-opl-work-message-file-run-flow", "scripts/smoke-test-v22-opl-work-message-file-run-flow.mjs"],
  ["smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow", "scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs"],
  ["smoke-test-v22-portal-files-billing-trace-flow", "scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs"],
  ["smoke-test-v22-portal-file-space-management", "scripts/smoke-test-v22-portal-file-space-management.mjs"],
  ["smoke-test-v22-portal-mobile-usability", "scripts/smoke-test-v22-portal-mobile-usability.mjs"],
  ["smoke-test-v22-portal-mobile-table-usability", "scripts/smoke-test-v22-portal-mobile-table-usability.mjs"],
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
