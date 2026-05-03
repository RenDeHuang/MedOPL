import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function read(relPath) {
  return readFile(path.resolve(root, relPath), "utf8");
}

const sidebarFile = "services/portal/frontend/src/layouts/AppSidebar.vue";
const routerFile = "services/portal/frontend/src/router/index.ts";
const packagesViewFile = "services/portal/frontend/src/views/packages/PackagesView.vue";
const apiFile = "services/portal/frontend/src/api/portal.ts";

const sidebar = await read(sidebarFile);
const router = await read(routerFile);
const packagesView = await read(packagesViewFile).catch(() => "");
const api = await read(apiFile);

assert(sidebar.includes('to: "/packages"'), "普通导航必须包含 /packages");
assert(!sidebar.includes('to: "/servers"'), "普通导航不得包含 /servers");

assert(router.includes('{ path: "/packages"'), "路由必须存在 /packages");
assert(router.includes('{ path: "/advanced/servers"'), "路由必须存在 /advanced/servers");
assert(api.includes('"/lab-packages"'), "套餐 API 必须调用 /portal/api/lab-packages");
assert(api.includes('"/lab-subscription"'), "订阅 API 必须调用 /portal/api/lab-subscription");
assert(api.includes('"/lab-entitlement"'), "权益 API 必须调用 /portal/api/lab-entitlement");
assert(api.includes('"/lab-storage/addons"'), "存储加购 API 必须调用 /portal/api/lab-storage/addons");
assert(!api.includes('"/lab/packages"'), "套餐 API 不得使用未实现的 /lab/packages 路径");

const forbiddenWords = [
  "腾讯云",
  "SKU",
  "TKE",
  "CVM",
  "COS",
  "node pool",
  "region",
  "zone",
  "L3",
  "DescribeBillDetail",
  "exact bill",
  "pending bill",
  "unattributed",
];

for (const word of forbiddenWords) {
  assert(!packagesView.includes(word), `套餐页出现禁止词: ${word}`);
}

const requiredCoreWords = ["入门套餐", "进阶套餐", "计算能力", "存储容量", "余额", "冻结", "每日扣款", "宽限期", "升级", "扩容", "进入实验室"];
for (const word of requiredCoreWords) {
  assert(packagesView.includes(word), `套餐页缺少核心产品词: ${word}`);
}

console.log(JSON.stringify({
  ok: true,
  checked: {
    sidebarFile,
    routerFile,
    packagesViewFile,
    apiFile,
  },
}, null, 2));
