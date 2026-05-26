import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const goLabDomainSource = await readFile(path.join(repoRoot, "services/medopl-go-backend/internal/domain/lab/lab.go"), "utf8");
const goLabTestSource = await readFile(path.join(repoRoot, "services/medopl-go-backend/internal/domain/lab/lab_test.go"), "utf8");

for (const marker of [
  "ID:                  \"starter_2c4g_10gb\"",
  "Cores: 2",
  "MemoryGB: 4",
  "IncludedGB: 10",
  "ID:                  \"pro_8c16g_100gb\"",
  "Cores: 8",
  "MemoryGB: 16",
  "IncludedGB: 100",
  "PendingProductApproval: true",
  "BasePrice: nil",
]) {
  assert(goLabDomainSource.includes(marker), `go_lab_resource_plan_marker_missing:${marker}`);
}

for (const marker of [
  "TestCatalogDefinesStarterAndProWithoutProductionPriceClaim",
  "starter_2c4g_10gb",
  "pro_8c16g_100gb",
  "item.Billing.BasePrice != nil",
  "!item.Billing.PendingProductApproval",
]) {
  assert(goLabTestSource.includes(marker), `go_lab_resource_plan_test_marker_missing:${marker}`);
}

for (const forbidden of [
  "dailyPrice",
  "weeklyFreezeAmount",
  "formal hourly",
  "¥/小时",
  "腾讯云 CVM 实时报价",
]) {
  assert.equal(goLabDomainSource.includes(forbidden), false, `go_lab_resource_plan_must_not_publish:${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_resource_plan",
  source: "services/medopl-go-backend/internal/domain/lab/lab.go",
  planIds: ["starter_2c4g_10gb", "pro_8c16g_100gb"],
}, null, 2));
