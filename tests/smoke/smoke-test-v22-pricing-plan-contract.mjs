import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function assertIncludesAll(source, markers, label) {
  for (const marker of markers) {
    assert(source.includes(marker), `${label}_missing:${marker}`);
  }
}

function assertExcludesAll(source, markers, label) {
  for (const marker of markers) {
    assert.equal(source.includes(marker), false, `${label}_must_not_include:${marker}`);
  }
}

const [
  specsIndex,
  productSpec,
  productTruth,
  operationsSpec,
  goLabDomainSource,
] = await Promise.all([
  readRepoFile("docs/specs/README.md"),
  readRepoFile("specs/product/spec.md"),
  readRepoFile("docs/product/README.md"),
  readRepoFile("specs/operations/spec.md"),
  readRepoFile("services/medopl-go-backend/internal/domain/lab/lab.go"),
]);

assert.equal(specsIndex.split("\n").length <= 400, true, `specs_index_line_budget_exceeded:${specsIndex.split("\n").length}`);
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_machine_json");
assertIncludesAll(specsIndex, [
  "spec:v22-pricing-snapshot-boundary",
  "spec:v22-resource-plan-boundary",
  "specs/product/spec.md",
  "specs/operations/spec.md",
], "pricing_specs_index");

assertIncludesAll(productSpec, [
  "`product:starter-2c4g-10gb-plan-catalog`",
  "services/medopl-go-backend/internal/domain/lab/lab.go",
  "node tests/smoke/smoke-test-v22-pricing-plan-contract.mjs",
], "pricing_product_spec");

assertIncludesAll(productTruth, [
  "starter_2c4g_10gb",
  "pro_8c16g_100gb",
  "基础套餐",
  "Pro 套餐",
  "2c / 4GB",
  "10GB 文件空间",
  "8c / 16GB",
  "100GB 文件空间",
  "7 天保护期",
  "`120min`",
  "`T+1`",
  "不能任意填写云厂商 instance type",
], "pricing_product_truth");

assertIncludesAll(operationsSpec, [
  "`operations:package-c-plan-catalog-allowlist`",
  "`operations:release-stop-billing-audit`",
], "pricing_operations_spec");

for (const marker of [
  "starter_2c4g_10gb",
  "pro_8c16g_100gb",
  "Cores: 2",
  "MemoryGB: 4",
  "IncludedGB: 10",
  "MaxConcurrentRuns: 1",
  "Cores: 8",
  "MemoryGB: 16",
  "IncludedGB: 100",
  "MaxConcurrentRuns: 2",
  "PendingProductApproval: true",
  "PriceLabel: \"正式售价未定价\"",
  "FreezeDays: 7",
]) {
  assert(goLabDomainSource.includes(marker), `go_lab_domain_pricing_marker_missing:${marker}`);
}

assertExcludesAll(goLabDomainSource, [
  "¥/小时",
  "腾讯云 CVM 实时报价",
  "BasePrice: 1.",
  "BasePrice: 0.",
], "go_lab_domain_pricing_false_claim");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_pricing_snapshot_boundary",
  planIds: ["starter_2c4g_10gb", "pro_8c16g_100gb"],
  source: "product_spec_product_truth_and_go_lab_domain",
}, null, 2));
