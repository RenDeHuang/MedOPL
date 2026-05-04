import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const rootDir = "/home/dev/projects/platform-v20";

function read(relPath) {
  const absPath = path.join(rootDir, relPath);
  assert.ok(existsSync(absPath), `文件不存在: ${relPath}`);
  return readFileSync(absPath, "utf8");
}

function ensure(pattern, source, message) {
  assert.match(source, pattern, message);
}

function ensureNot(pattern, source, message) {
  assert.doesNotMatch(source, pattern, message);
}

const routerSource = read("services/portal/frontend/src/router/index.ts");
const sidebarSource = read("services/portal/frontend/src/layouts/AppSidebar.vue");
const apiSource = read("services/portal/frontend/src/api/portal.ts");
const packageViewSource = read("services/portal/frontend/src/views/packages/PackagesView.vue");
const serversViewSource = read("services/portal/frontend/src/views/servers/ServersView.vue");
const resourcesViewPath = "services/portal/frontend/src/views/resources/ResourcesView.vue";
const resourcesViewSource = read(resourcesViewPath);

ensure(/path:\s*"\/resources"/, routerSource, "router 必须包含 /resources 路由");
ensure(/我的资源/, sidebarSource, "侧边栏必须包含“我的资源”");
ensure(/export\s+async\s+function\s+fetchMyResources\s*\(/, apiSource, "API 必须导出 fetchMyResources");

const deleteInputStart = apiSource.indexOf("export async function deleteResourceOrderNodePool(input:");
assert.ok(deleteInputStart >= 0, "必须存在 deleteResourceOrderNodePool");
const deleteInputSlice = apiSource.slice(deleteInputStart, deleteInputStart + 260);
ensureNot(/\bnodePoolId\b/, deleteInputSlice, "deleteResourceOrderNodePool 输入类型不得包含 nodePoolId");

for (const text of ["入门套餐", "进阶套餐", "自定义套餐", "加 100GB 存储", "加一个计算节点", "进入 OPL"]) {
  ensure(new RegExp(text), packageViewSource, `PackagesView 必须包含：${text}`);
}

ensure(/fetchMyResources\s*\(/, resourcesViewSource, "ResourcesView 必须调用 fetchMyResources");
ensure(/deleteResourceOrderNodePool\s*\(/, resourcesViewSource, "ResourcesView 必须调用 deleteResourceOrderNodePool");
ensure(/\bcvmInstanceIds\b/, apiSource, "MyResourceBindingItem 必须暴露 cvmInstanceIds");
ensure(/\bcosPrefix\b/, apiSource, "MyResourceBindingItem 必须暴露 cosPrefix");
ensure(/\bcvmInstanceIds\?\.length|\(item\.cvmInstanceIds\s*\|\|\s*\[\]\)\.length/, resourcesViewSource, "ResourcesView 必须按 cvmInstanceIds 计算 CVM 数量");
ensure(/item\.cosPrefix/, resourcesViewSource, "ResourcesView 必须显示后端 cosPrefix 字段");
ensure(
  /deleteResourceOrderNodePool\s*\(\s*\{\s*resourceOrderId[^}]*confirmDeleteNodePool:\s*true[^}]*destroyCvmInstances:\s*true/s,
  resourcesViewSource,
  "ResourcesView 删除请求必须仅按订单提交必要确认字段"
);
ensureNot(
  /deleteResourceOrderNodePool\s*\(\s*\{[^}]*nodePoolId/s,
  resourcesViewSource,
  "ResourcesView 删除请求不得提交 nodePoolId"
);
ensureNot(
  /deleteResourceOrderNodePool\s*\(\s*\{[^}]*nodePoolId/s,
  serversViewSource,
  "ServersView 删除请求不得提交 nodePoolId"
);
ensure(/\bbackingServerPlanId\b/, apiSource, "LabPackagePlan 必须包含 backingServerPlanId");
ensure(/current\?\.backingServerPlanId/, packageViewSource, "加计算节点必须使用套餐 backingServerPlanId");
ensureNot(/return\s+current\?\.id\s*\|\|/, packageViewSource, "加计算节点不得用套餐 id 冒充 serverPlanId");

console.log("v20.32 package minimal loop static contract: PASS");
