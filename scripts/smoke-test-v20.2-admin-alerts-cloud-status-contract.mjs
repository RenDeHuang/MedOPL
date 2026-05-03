import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const alertsView = await readFile("services/portal/frontend/src/views/admin/AdminAlertsView.vue", "utf8");
const opsView = await readFile("services/portal/frontend/src/views/admin/AdminOpsView.vue", "utf8");

for (const expected of ["余额风险", "账单归因失败", "资源释放失败", "OPL key", "精准账单导入失败"]) {
  assert.match(alertsView, new RegExp(expected), `missing_actionable_alert_copy:${expected}`);
}

assert.doesNotMatch(alertsView, /告警概览/, "ordinary_generic_alert_overview_should_be_removed");
assert.match(opsView, /云资源状态/, "admin_ops_should_be_reframed_as_cloud_resource_status");
assert.match(opsView, /服务器编号|任务编号|释放证据|停止计费/, "admin_ops_should_show_business_resource_evidence");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.2_admin_alerts_cloud_status",
}, null, 2));
