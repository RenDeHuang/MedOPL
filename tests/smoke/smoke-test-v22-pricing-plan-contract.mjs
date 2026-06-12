import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const contractPath = path.join(repoRoot, "docs/specs/README.md");
const goLabDomainPath = path.join(repoRoot, "services/medopl-go-backend/internal/domain/lab/lab.go");

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

const [contractMarkdown, goLabDomainSource] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(goLabDomainPath, "utf8"),
]);
const contract = extractContractJson(contractMarkdown);

assert.equal(contract.contract, "v22_pricing_snapshot_boundary", "pricing_contract_name_mismatch");
assert.equal(contract.version, 1, "pricing_contract_version_mismatch");
assert.deepEqual(sortedKeys(contract), ["computeProvisioningModel", "contract", "plans", "version"], "pricing_contract_top_level_keys_mismatch");
assert.deepEqual(contract.computeProvisioningModel, {
  tenantNodePoolCreatedByPackageC: true,
  sharedUserComputePoolSupported: false,
  userBuysNodePool: false,
}, "pricing_contract_compute_provisioning_model_mismatch");
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
  assert.equal(plan.compute.isolationMode, "tenant_node_pool", `${plan.id}_isolation_mode_mismatch`);
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

  assert.equal(plan.costSnapshot.providerCostAmount, null, `${plan.id}_provider_cost_must_be_null_without_cloud_quote`);
  assert.equal(plan.costSnapshot.mayPopulateBasePrice, false, `${plan.id}_provider_cost_must_not_populate_base_price`);
}

for (const marker of [
  "starter_2c4g_10gb",
  "pro_8c16g_100gb",
  "PendingProductApproval: true",
  "PriceLabel: \"正式售价未定价\"",
]) {
  assert(goLabDomainSource.includes(marker), `go_lab_domain_pricing_marker_missing:${marker}`);
}
assert.equal(goLabDomainSource.includes("¥/小时"), false, "go_lab_domain_must_not_hardcode_hourly_sale_price");
assert.equal(goLabDomainSource.includes("腾讯云 CVM 实时报价"), false, "go_lab_domain_must_not_claim_cvm_realtime_quote");

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  planIds: contract.plans.map((plan) => plan.id),
}, null, 2));
