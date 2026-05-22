import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const specsPath = "docs/specs/README.md";
const productPath = "docs/product/README.md";
const activePath = "docs/active/README.md";

const startMarker = "<!-- v22-commercial-package-model:start -->";
const endMarker = "<!-- v22-commercial-package-model:end -->";

function extractJson(markdown) {
  const start = markdown.indexOf(startMarker);
  assert.notEqual(start, -1, "commercial_package_model_start_marker_missing");
  const end = markdown.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, "commercial_package_model_end_marker_missing");
  assert.equal(markdown.indexOf(startMarker, start + startMarker.length), -1, "commercial_package_model_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(endMarker, end + endMarker.length), -1, "commercial_package_model_end_marker_must_be_unique");
  const block = markdown.slice(start + startMarker.length, end).trim();
  const match = /^```json\n([\s\S]+)\n```$/u.exec(block);
  assert(match, "commercial_package_model_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function extractSection(markdown, heading) {
  const pattern = new RegExp(`## ${heading}\\n(?<section>[\\s\\S]*?)(?=\\n## |\\n$)`, "u");
  const match = markdown.match(pattern);
  assert(match?.groups?.section, `section_missing:${heading}`);
  return match.groups.section;
}

const [specs, product, active] = await Promise.all([
  readFile(specsPath, "utf8"),
  readFile(productPath, "utf8"),
  readFile(activePath, "utf8"),
]);

const model = extractJson(specs);
const packageIds = model.packages.map((item) => item.id);
const productCommercialSection = extractSection(product, "Commercial Package Model");
const activeCommercialSection = extractSection(active, "商业化主链路");

assert.equal(model.contract, "v22_commercial_package_model", "commercial_package_model_contract_mismatch");
assert.equal(model.version, 1, "commercial_package_model_version_mismatch");
assert.deepEqual(packageIds, ["api_only", "full_runtime", "customer_dedicated"], "commercial_package_model_order_mismatch");
assert.equal(model.customerRule.anyoneCanEnterOpl, true, "anyone_can_enter_opl_rule_mismatch");
assert.equal(model.customerRule.medoplRequiredForCloudCompute, true, "medopl_cloud_compute_gate_mismatch");
assert.equal(model.customerRule.portalIsCloudConsole, false, "portal_must_not_be_cloud_console");
assert.equal(model.customerRule.ordinaryUserSelfConfiguresCloud, false, "ordinary_user_must_not_self_configure_cloud");

const byId = new Map(model.packages.map((item) => [item.id, item]));
assert.deepEqual(byId.get("api_only").includes, [
  "账号",
  "工作空间",
  "OPL 入口",
  "用户自己的 gflabtoken providerKeyRef",
  "文件/任务/结果索引",
], "api_only_includes_mismatch");
assert.equal(byId.get("api_only").allowsPlatformManagedCompute, false, "api_only_must_not_allow_platform_compute");
assert.equal(byId.get("api_only").medoplRequiredBecause, "需要账号、工作空间、入口治理和回流索引，但不购买平台托管算力。", "api_only_reason_mismatch");
assert.equal(byId.get("full_runtime").allowsPlatformManagedCompute, true, "full_runtime_must_allow_platform_compute");
assert.equal(byId.get("full_runtime").requiresBalanceFreeze, true, "full_runtime_must_require_balance_freeze");
assert.equal(byId.get("full_runtime").requiresFileSpace, true, "full_runtime_must_require_file_space");
assert.equal(byId.get("customer_dedicated").allowsPlatformManagedCompute, true, "customer_dedicated_must_allow_compute");
assert.equal(byId.get("customer_dedicated").isolation, "dedicated_runtime_boundary", "customer_dedicated_isolation_mismatch");

for (const packageModel of model.packages) {
  assertNotIncludes(JSON.stringify(packageModel), "CVM", `package_${packageModel.id}`);
  assertNotIncludes(JSON.stringify(packageModel), "COS", `package_${packageModel.id}`);
  assertNotIncludes(JSON.stringify(packageModel), "K8s", `package_${packageModel.id}`);
  assertNotIncludes(JSON.stringify(packageModel), "云资源控制台", `package_${packageModel.id}`);
}

assertIncludes(specs, "### spec:v22-commercial-package-model", "specs_anchor");
assertIncludes(product, "Commercial Package Model", "product_commercial_section");
assertIncludes(productCommercialSection, "谁都可以进入 OPL", "product_anyone_can_enter_opl");
assertIncludes(productCommercialSection, "需要平台托管计算、文件空间、隔离环境、计费和审计时，必须进入 MedOPL", "product_medopl_cloud_gate");
assertIncludes(active, "商业化主链路", "active_commercial_truth");
assertIncludes(activeCommercialSection, "api_only", "active_api_only");
assertIncludes(activeCommercialSection, "full_runtime", "active_full_runtime");
assertIncludes(activeCommercialSection, "customer_dedicated", "active_customer_dedicated");

for (const text of [productCommercialSection, activeCommercialSection]) {
  assertNotIncludes(text, "允许用户自配", "commercial_truth");
  assertNotIncludes(text, "普通用户配置 CVM", "commercial_truth");
  assertNotIncludes(text, "普通用户配置 COS", "commercial_truth");
  assertNotIncludes(text, "普通用户配置 K8s", "commercial_truth");
  assertNotIncludes(text, "普通用户云资源控制台", "commercial_truth");
}

console.log(JSON.stringify({
  ok: true,
  contract: model.contract,
  packages: packageIds,
}, null, 2));
