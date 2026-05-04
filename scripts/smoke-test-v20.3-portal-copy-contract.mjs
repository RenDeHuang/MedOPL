import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const userFacingFiles = [
  "services/portal/frontend/src/layouts/AppHeader.vue",
  "services/portal/frontend/src/views/overview/OverviewView.vue",
  "services/portal/frontend/src/views/billing/BillingView.vue",
  "services/portal/frontend/src/views/packages/PackagesView.vue",
  "services/portal/frontend/src/views/workspace/WorkspaceView.vue",
  "services/portal/frontend/src/views/trace/TraceView.vue",
  "services/portal/frontend/src/views/servers/ServersView.vue",
  "services/portal/src/app/portal-module-source-payloads.mjs",
  "services/portal/src/domain/support-boundaries.mjs",
];

const adminFiles = [
  "services/portal/frontend/src/views/admin/AdminDashboardView.vue",
  "services/portal/frontend/src/views/admin/AdminBillingOpsView.vue",
  "services/portal/frontend/src/views/admin/AdminOpsView.vue",
  "services/portal/frontend/src/views/admin/AdminSandboxesView.vue",
  "services/portal/frontend/src/views/admin/AdminSystemView.vue",
];

const forbiddenUserTerms = [
  /\bkubectl\b/i,
  /\bRBAC\b/,
  /\bTKE\b/,
  /\bCVM\b/,
  /\bCOS\b/,
  /\bnode pool\b/i,
  /\bNodePool\b/,
  /\bOpenCost\b/,
  /\b502\b/,
  /\bK8s\b/i,
  /\bKubernetes\b/i,
  /\bTencent CVM\b/i,
];

for (const file of userFacingFiles) {
  const source = await readFile(file, "utf8");
  for (const term of forbiddenUserTerms) {
    assert.doesNotMatch(source, term, `${file} must not expose technical term ${term}`);
  }
}

for (const file of adminFiles) {
  const source = await readFile(file, "utf8");
  const hasTechnicalEvidence = forbiddenUserTerms.some((term) => term.test(source));
  if (!hasTechnicalEvidence) continue;
  assert.match(
    source,
    /客户账务|云资源|待处理|释放|停止计费|真实账单|业务|用户|任务/,
    `${file} admin technical evidence must be paired with business-facing action copy`,
  );
}

console.log(JSON.stringify({
  ok: true,
  contract: "v20.3-portal-copy",
  userFacingFiles: userFacingFiles.length,
  adminFiles: adminFiles.length,
}, null, 2));
