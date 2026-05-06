import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resourcesViewPath = path.join(
  repoRoot,
  "services",
  "portal",
  "frontend",
  "src",
  "views",
  "resources",
  "ResourcesView.vue",
);
const overviewViewPath = path.join(
  repoRoot,
  "services",
  "portal",
  "frontend",
  "src",
  "views",
  "overview",
  "OverviewView.vue",
);
const resourcesApiPath = path.join(
  repoRoot,
  "services",
  "portal",
  "frontend",
  "src",
  "api",
  "portal",
  "resources.ts",
);

const resourcesViewSource = readFileSync(resourcesViewPath, "utf8");
const overviewViewSource = readFileSync(overviewViewPath, "utf8");
const resourcesApiSource = readFileSync(resourcesApiPath, "utf8");

function extractRootTemplate(source) {
  const start = source.indexOf("<template>");
  const end = source.lastIndexOf("</template>");
  return start >= 0 && end > start ? source.slice(start + "<template>".length, end) : "";
}

const resourcesTemplate = extractRootTemplate(resourcesViewSource);
const overviewTemplate = extractRootTemplate(overviewViewSource);

for (const expected of [
  "运行套餐",
  "计算能力",
  "存储容量",
  "文件空间",
  "开通运行环境",
  "关闭运行环境",
  "扩容",
  "平台代开",
  "隔离运行环境",
  "OPL Lite",
  "OPL Full Runtime",
  "本周保护金",
  "两小时核对",
  "次日审计",
]) {
  assert(resourcesTemplate.includes(expected), `resources view missing product copy: ${expected}`);
}

for (const forbidden of [
  "云主机",
  "云存储",
  "登记云主机",
  "登记云存储",
  "填写要接入平台的计算能力信息",
  "接入用来保存文件",
  "运行节点",
  "运行代理",
  "机器规格",
  "计算能力 ID",
  "存储 ID",
  "存储名称",
  "空间名称",
  "默认目录",
  "区域",
  "可用区",
  "ap-guangzhou",
  "底层资源标识",
  "公网地址",
  "内网地址",
  "空间代号",
  "Runtime Agent",
  "运行助手 ID",
  "工作空间 ID",
  "CVM",
  "COS",
  "K8s",
  "TKE",
  "nodePool",
  "MinIO",
  "Harbor",
  "OpenCost",
  "Rancher",
  "KubeSphere",
]) {
  assert(!resourcesTemplate.includes(forbidden), `resources view default UX must not expose ${forbidden}`);
}

for (const expected of [
  "平台代开隔离运行环境",
  "文件空间",
  "OPL Lite",
  "OPL Full Runtime",
]) {
  assert(overviewTemplate.includes(expected), `overview view missing product copy: ${expected}`);
}

for (const forbidden of [
  "用户自有 CVM",
  "自有存储",
  "workspace 绑定的 CVM 和存储",
  "CVM ",
  "腾讯云报价",
  "等待腾讯云报价",
  "最低小时价",
  "T+1",
]) {
  assert(!overviewTemplate.includes(forbidden), `overview view default UX must not expose ${forbidden}`);
}

assert(
  resourcesApiSource.includes('resourceLifecycleMode: "cloud_provisioned"')
    || resourcesApiSource.includes('resourceLifecycleMode: "platform_provisioned"'),
  "resources api must submit platform provisioned lifecycle mode by default",
);

const displayStorageLabelBody = resourcesViewSource.match(/function displayStorageLabel[\s\S]*?\n}\n/)?.[0] || "";
assert(
  displayStorageLabelBody && !displayStorageLabelBody.includes("bucketName"),
  "storage label must not use generated bucketName as the user-facing primary label",
);

console.log(JSON.stringify({ ok: true, contract: "v21-platform-provisioned-resource-ui" }, null, 2));
