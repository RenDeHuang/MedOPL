import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.join(__dirname, "../docs/contracts/v22-pricing-snapshot-boundary.md");
const commercialStatePath = path.join(__dirname, "../services/portal/src/domain/commercial-state.mjs");
const serverPlanRuntimeHandlerPath = path.join(__dirname, "../services/portal/src/app/portal-server-plan-runtime-handler.mjs");

const CONTRACT_START = "<!-- v22-pricing-snapshot-contract:start -->";
const CONTRACT_END = "<!-- v22-pricing-snapshot-contract:end -->";

function extractContractJson(markdown) {
  const startIndex = markdown.indexOf(CONTRACT_START);
  assert.notEqual(startIndex, -1, "pricing_contract_start_marker_missing");

  const contentStart = startIndex + CONTRACT_START.length;
  const endIndex = markdown.indexOf(CONTRACT_END, contentStart);
  assert.notEqual(endIndex, -1, "pricing_contract_end_marker_missing");
  assert.equal(markdown.indexOf(CONTRACT_START, contentStart), -1, "pricing_contract_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(CONTRACT_END, endIndex + CONTRACT_END.length), -1, "pricing_contract_end_marker_must_be_unique");

  const block = markdown.slice(contentStart, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "pricing_contract_must_be_a_single_json_fence");

  return JSON.parse(match[1]);
}

function sortedKeys(value) {
  return Object.keys(value).sort();
}

const expectedPlans = new Map([
  ["starter_2c4g_10gb", { cpuCores: 2, memoryGb: 4, capacityGb: 10 }],
  ["pro_8c16g_100gb", { cpuCores: 8, memoryGb: 16, capacityGb: 100 }],
]);

const contractMarkdown = await readFile(contractPath, "utf8");
const commercialStateSource = await readFile(commercialStatePath, "utf8");
const serverPlanRuntimeHandlerSource = await readFile(serverPlanRuntimeHandlerPath, "utf8");
const contract = extractContractJson(contractMarkdown);

assert.equal(contract.contract, "v22_pricing_snapshot_boundary", "pricing_contract_name_mismatch");
assert.equal(contract.version, 1, "pricing_contract_version_mismatch");
assert.deepEqual(sortedKeys(contract), ["advancedIsolationModes", "contract", "plans", "version"], "pricing_contract_top_level_keys_mismatch");
assert.deepEqual(contract.advancedIsolationModes, ["dedicated_node_pool", "dedicated_node"], "pricing_contract_advanced_isolation_modes_mismatch");
assert(Array.isArray(contract.plans), "pricing_contract_plans_must_be_array");
assert.equal(contract.plans.length, expectedPlans.size, "pricing_contract_plan_count_mismatch");
assert.deepEqual(contract.plans.map((plan) => plan.id), [...expectedPlans.keys()], "pricing_contract_plan_order_mismatch");

for (const plan of contract.plans) {
  const expected = expectedPlans.get(plan.id);
  assert(expected, `${plan.id}_unexpected_plan_id`);
  assert.deepEqual(
    sortedKeys(plan),
    [
      "basePrice",
      "cloudBillingMode",
      "compute",
      "costSnapshot",
      "id",
      "os",
      "pendingProductApproval",
      "region",
      "storage",
      "storageBackend",
      "zone",
    ].sort(),
    `${plan.id}_plan_keys_mismatch`,
  );

  assert.deepEqual(sortedKeys(plan.compute), ["cpuCores", "isolationMode", "memoryGb", "userBuysNodePool"], `${plan.id}_compute_keys_mismatch`);
  assert.equal(plan.compute.cpuCores, expected.cpuCores, `${plan.id}_cpu_mismatch`);
  assert.equal(plan.compute.memoryGb, expected.memoryGb, `${plan.id}_memory_mismatch`);
  assert.equal(plan.compute.isolationMode, "shared_quota", `${plan.id}_isolation_mode_mismatch`);
  assert.equal(plan.compute.userBuysNodePool, false, `${plan.id}_must_not_sell_node_pool`);

  assert.deepEqual(sortedKeys(plan.storage), ["capacityGb"], `${plan.id}_storage_keys_mismatch`);
  assert.equal(plan.storage.capacityGb, expected.capacityGb, `${plan.id}_storage_capacity_mismatch`);
  assert.equal(plan.storageBackend, "cos_standard_workspace_quota", `${plan.id}_storage_backend_mismatch`);
  assert.equal(plan.region, "na-siliconvalley", `${plan.id}_region_mismatch`);
  assert.equal(plan.zone, "na-siliconvalley-1", `${plan.id}_zone_mismatch`);
  assert.equal(plan.os, "ubuntu_22_04", `${plan.id}_os_mismatch`);
  assert.equal(plan.cloudBillingMode, "pay_as_you_go", `${plan.id}_cloud_billing_mode_mismatch`);
  assert.equal(plan.basePrice, null, `${plan.id}_base_price_must_be_null_until_product_approval`);
  assert.equal(plan.pendingProductApproval, true, `${plan.id}_pending_product_approval_must_be_true`);

  assert.deepEqual(
    sortedKeys(plan.costSnapshot),
    [
      "billingMode",
      "capturedAt",
      "currency",
      "kind",
      "mayPopulateBasePrice",
      "provider",
      "providerCostAmount",
      "region",
      "usage",
      "zone",
    ].sort(),
    `${plan.id}_cost_snapshot_keys_mismatch`,
  );
  assert.equal(plan.costSnapshot.kind, "provider_cost_snapshot", `${plan.id}_cost_snapshot_kind_mismatch`);
  assert.equal(plan.costSnapshot.provider, "tencent_cloud", `${plan.id}_cost_snapshot_provider_mismatch`);
  assert.equal(plan.costSnapshot.region, plan.region, `${plan.id}_cost_snapshot_region_mismatch`);
  assert.equal(plan.costSnapshot.zone, plan.zone, `${plan.id}_cost_snapshot_zone_mismatch`);
  assert.equal(plan.costSnapshot.billingMode, plan.cloudBillingMode, `${plan.id}_cost_snapshot_billing_mode_mismatch`);
  assert.equal(plan.costSnapshot.currency, null, `${plan.id}_cost_snapshot_currency_must_be_null_without_quote`);
  assert.equal(plan.costSnapshot.providerCostAmount, null, `${plan.id}_provider_cost_must_be_null_without_cloud_quote`);
  assert.equal(plan.costSnapshot.capturedAt, null, `${plan.id}_cost_snapshot_capture_time_must_be_null_without_cloud_quote`);
  assert.equal(plan.costSnapshot.usage, "internal_cost_review_only", `${plan.id}_cost_snapshot_usage_mismatch`);
  assert.equal(plan.costSnapshot.mayPopulateBasePrice, false, `${plan.id}_provider_cost_must_not_populate_base_price`);
  assert.equal("basePrice" in plan.costSnapshot, false, `${plan.id}_cost_snapshot_must_not_embed_base_price`);
}

for (const source of [commercialStateSource, serverPlanRuntimeHandlerSource]) {
  assert.equal(source.includes("腾讯云 CVM 实时报价"), false, "ordinary_user_price_copy_must_not_use_cvm_realtime_quote");
  assert.equal(source.includes("¥/小时"), false, "ordinary_user_price_copy_must_not_hardcode_hourly_sale_price");
  assert(source.includes("套餐价格由平台后台价格源、保护金规则与对账记录校准"), "ordinary_user_price_copy_must_use_platform_price_source_language");
}

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  planIds: contract.plans.map((plan) => plan.id),
}, null, 2));
