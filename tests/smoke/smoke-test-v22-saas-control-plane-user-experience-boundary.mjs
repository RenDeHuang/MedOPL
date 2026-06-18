import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  specsIndex: "docs/specs/README.md",
  productSpec: "specs/product/spec.md",
  productTruth: "docs/product/README.md",
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
  sourceSpec,
  activeTruth,
  deliveryTruth,
  current,
] = await Promise.all([
  source(files.specsIndex),
  source(files.productSpec),
  source(files.productTruth),
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
  "One Person Lab SaaS 控制面和托管交付平台",
  "用户购买托管 OPL 科研工作台服务",
  "MedOPL 不是云资源控制台",
  "Portal 不回答科研问题，不复制 OPL chatbot",
  "Portal 负责准备、管理、进入、回流、计费、审计和释放",
  "OPL 负责 chatbot、agent、文件理解、任务推进、结果生成和工作台内交互体验",
  "买了什么、能不能用、缺什么、下一步点哪里、结果在哪里、费用是否正常",
], "saas_control_plane_product_truth");

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
