import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  specsIndex: "docs/specs/README.md",
  productSpec: "specs/product/spec.md",
  productTruth: "docs/product/README.md",
  productProfile: "contracts/medopl-product-profile.json",
  apiContract: "contracts/medopl-api-contract.json",
  sourceSpec: "specs/source/spec.md",
  activeTruth: "docs/active/README.md",
  deliveryTruth: "docs/delivery/README.md",
  current: "tests/fixtures/v22/goal-current.json",
};

async function source(path) {
  return readFile(path, "utf8");
}

function assertIncludesAll(text, expectedItems, label) {
  for (const expected of expectedItems) {
    assert(text.includes(expected), `${label}_missing:${expected}`);
  }
}

function assertExcludesAll(text, forbiddenItems, label) {
  for (const forbidden of forbiddenItems) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const [
  specsIndex,
  productSpec,
  productTruth,
  productProfile,
  apiContract,
  sourceSpec,
  activeTruth,
  deliveryTruth,
  current,
] = await Promise.all([
  source(files.specsIndex),
  source(files.productSpec),
  source(files.productTruth),
  source(files.productProfile).then((raw) => JSON.parse(raw)),
  source(files.apiContract).then((raw) => JSON.parse(raw)),
  source(files.sourceSpec),
  source(files.activeTruth),
  source(files.deliveryTruth),
  source(files.current).then((raw) => JSON.parse(raw)),
]);

assert.equal(specsIndex.split("\n").length <= 400, true, `specs_index_line_budget_exceeded:${specsIndex.split("\n").length}`);
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_machine_json");
assertIncludesAll(specsIndex, [
  "spec:v22-saas-control-plane-user-experience-boundary",
  "spec:v22-saas-portal-opl-ops-surface-boundary",
  "specs/product/spec.md",
], "saas_control_plane_specs_index");

assertIncludesAll(productSpec, [
  "`product:managed-opl-service`",
  "`product:no-cloud-console-language`",
  "`product:local-portal-delivery-rc`",
], "saas_control_plane_product_spec");

assertIncludesAll(productTruth, [
  "OPL-Webui 的商业资源控制面",
  "账号创建/批准、充值/授信、套餐选择、计算资源、存储空间、任务并发、费用与释放能力管理",
  "MedOPL 不是云资源控制台",
  "OPL-Webui 是主要 consumer / entry surface",
  "OPL-Webui 负责 ordinary chat",
  "MedOPL 不回答科研问题，不复制 OPL chatbot",
  "MedOPL 负责计算资源、存储空间、套餐、任务并发、usage/billing、release、storage destroy intent",
  "买了什么资源、资源是否可用、存储空间里有什么、套餐是什么、费用是多少、去哪里购买 / 升级 / 释放资源或进入 OPL",
], "saas_control_plane_product_truth");

assert.equal(productProfile.medopl_product_profile.primary_consumer_surface.name, "opl-webui", "saas_control_plane_primary_consumer_must_be_opl_webui");
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface.ordinary_chat_owner, "opl-webui", "saas_control_plane_ordinary_chat_owner_must_be_opl_webui");
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface.runtime_required_owner, "medopl", "saas_control_plane_runtime_required_owner_must_be_medopl");
assert.equal(apiContract.medopl_api_contract.runtime_gate.route, "POST /api/opl/runtime-gate", "saas_control_plane_runtime_gate_route_mismatch");

assertIncludesAll(sourceSpec, [
  "`source:portal-typed-api-contract`",
  "`source:go-control-plane-mvp-takeover`",
  "`source:node-portal-backend-physical-removal`",
], "saas_control_plane_source_spec");

assertIncludesAll(activeTruth, [
  `| current cursor | \`${current.current_cursor}\` |`,
  "| current phase |",
  "| current blocker |",
], "saas_control_plane_active_truth");
assertIncludesAll(deliveryTruth, [
  current.current_cursor,
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
], "saas_control_plane_delivery_truth");

assertExcludesAll(productTruth, [
  "Portal 是科研聊天界面",
  "Portal 是云资源控制台",
  "普通用户自配云资源",
], "saas_control_plane_forbidden_product_truth");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_saas_control_plane_user_experience_boundary",
  checked: Object.values(files),
}, null, 2));
