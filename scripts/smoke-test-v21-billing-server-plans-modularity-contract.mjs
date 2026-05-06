import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const servicePath = path.join(repoRoot, "adapters/billing-aggregator/src/server-plans-service.mjs");
const listQueryPath = path.join(repoRoot, "adapters/billing-aggregator/src/server-plans-list-query.mjs");
const portalServerPlanHandlerPath = path.join(repoRoot, "services/portal/src/app/portal-server-plan-runtime-handler.mjs");
const portalServerPlansDomainPath = path.join(repoRoot, "services/portal/src/domain/server-plans.mjs");
const portalServerPlansApiPath = path.join(repoRoot, "services/portal/frontend/src/api/portal/server-plans.ts");
const overviewViewPath = path.join(repoRoot, "services/portal/frontend/src/views/overview/OverviewView.vue");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nonEmptyLineCount(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function firstString(...values) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function assertNoKeys(target, keys, context) {
  for (const key of keys) {
    assert(!hasOwn(target, key), `contract_failed:${context}_must_not_expose_${key}`);
  }
}

function assertNoSourceSnippet(sourceText, snippets, context) {
  for (const snippet of snippets) {
    assert(!sourceText.includes(snippet), `contract_failed:${context}_must_not_reference_${snippet}`);
  }
}

async function assertPortalServerPlansPublicPayload() {
  const { createPortalServerPlanRuntimeHandler } = await import("../services/portal/src/app/portal-server-plan-runtime-handler.mjs");
  const res = {};
  const postRes = {};
  const handler = createPortalServerPlanRuntimeHandler({
    defaultTaskTitle: (slug) => slug,
    ensureTaskSpace: async (_db, user, slug) => ({ slug, userId: user.id }),
    evaluateUserPolicy: async () => ({ ok: true }),
    fetchBillingStatus: async () => ({
      cloudStatus: {
        provider: "tencent_cloud",
        tokenConfigured: true,
        price: { endpoint: "cvm.tencentcloudapi.com" },
      },
    }),
    fetchServerPlans: async () => ({
      ok: true,
      source: "tencent_cloud_live_catalog",
      configured: true,
      priceEnabled: true,
      discoveryEnabled: true,
      discoveredCount: 1,
      catalogCount: 1,
      cloudStatus: { provider: "tencent_cloud" },
      items: [{
        id: "cpu-2c4g",
        name: "CPU 2C4G",
        isPurchasable: true,
        isSelectable: true,
        nodePool: "legacy-node-pool",
        provisionerPayload: { create: true },
        source: "tencent_cloud_discovery",
        pricingSource: "tencent_cloud_inquiry_price_run_instances",
        hourlyPrice: 1.25,
      }],
    }),
    findTaskSpace: () => null,
    logPortalEvent: async () => {},
    readBody: async () => Buffer.from(JSON.stringify({ planId: "cpu-2c4g", task: "analysis" })),
    sendJson: (target, payload, status = 200) => {
      target.statusCode = status;
      target.payload = payload;
    },
    slugify: (value) => String(value || "default").trim() || "default",
    writeDb: async () => {},
  });
  const handled = await handler({
    req: { method: "GET" },
    res,
    url: new URL("http://portal.local/portal/api/server-plans"),
    db: { wallets: [], ledger: [], groups: [] },
    user: { id: "user-1", preferences: {}, currentTaskSlug: "analysis" },
  });
  assert(handled, "contract_failed:portal_server_plans_route_not_handled");
  assert(res.statusCode === 200, "contract_failed:portal_server_plans_status_not_200");
  assertNoKeys(res.payload, ["source", "cloudStatus", "discoveryEnabled", "discoveredCount"], "portal_server_plans_payload");
  assert(res.payload.catalogSource, "contract_failed:portal_server_plans_must_expose_catalog_source");
  assert(res.payload.catalogRuntimeStatus, "contract_failed:portal_server_plans_must_expose_catalog_runtime_status");
  assert(res.payload.pricingSourceStatus, "contract_failed:portal_server_plans_must_expose_pricing_source_status");
  assert(hasOwn(res.payload, "availabilitySyncEnabled"), "contract_failed:portal_server_plans_must_expose_availability_sync_enabled");
  assert(hasOwn(res.payload, "availabilitySnapshotCount"), "contract_failed:portal_server_plans_must_expose_availability_snapshot_count");
  assertNoKeys(res.payload.summary || {}, ["cloudStatus", "discoveryEnabled", "discoveredCount", "salableCount", "orderableCount"], "portal_server_plans_summary");
  const [item] = Array.isArray(res.payload.items) ? res.payload.items : [];
  assert(item, "contract_failed:portal_server_plans_must_return_item");
  assert(hasOwn(item, "isPurchasable"), "contract_failed:portal_server_plan_item_must_expose_is_purchasable");
  assert(hasOwn(item, "isSelectable"), "contract_failed:portal_server_plan_item_must_expose_is_selectable");
  assertNoKeys(item, ["salable", "canOrder", "nodePool", "provisionerPayload", "source", "pricingSource"], "portal_server_plan_item");
  const serialized = JSON.stringify(res.payload);
  for (const forbiddenText of ["InquiryPriceRunInstances", "DescribeZoneInstanceConfigInfos", "tencent_cloud_inquiry_price_run_instances", "腾讯云", "CVM"]) {
    assert(!serialized.includes(forbiddenText), `contract_failed:portal_server_plans_must_not_expose_${forbiddenText}`);
  }
  const postHandled = await handler({
    req: { method: "POST" },
    res: postRes,
    url: new URL("http://portal.local/portal/api/server-plans/select"),
    db: { wallets: [], ledger: [], groups: [] },
    user: { id: "user-1", preferences: {}, currentTaskSlug: "analysis" },
  });
  assert(postHandled, "contract_failed:portal_server_plan_select_route_not_handled");
  assert(postRes.statusCode === 200, "contract_failed:portal_server_plan_select_status_not_200");
  assertNoKeys(postRes.payload.selectedServerPlan || {}, ["canOrder", "salable", "pricingSource", "source"], "portal_selected_server_plan");
  assert(hasOwn(postRes.payload.selectedServerPlan || {}, "isPurchasable"), "contract_failed:portal_selected_server_plan_must_expose_is_purchasable");
  assert(hasOwn(postRes.payload.selectedServerPlan || {}, "priceOrigin"), "contract_failed:portal_selected_server_plan_must_expose_price_origin");
}

async function main() {
  const source = await readFile(servicePath, "utf8");
  const lines = nonEmptyLineCount(source);
  assert(/from "\.\/server-plans-catalog-normalization\.mjs"/.test(source), "contract_failed:missing_catalog_normalization_module_import");
  assert(/from "\.\/server-plans-availability-filters\.mjs"/.test(source), "contract_failed:missing_availability_filters_module_import");
  assert(/from "\.\/server-plans-list-query\.mjs"/.test(source), "contract_failed:missing_list_query_module_import");
  assert(/from "\.\/server-plans-cloud-state\.mjs"/.test(source), "contract_failed:missing_cloud_state_module_import");
  assert(/from "\.\/server-plans-discovery-runtime\.mjs"/.test(source), "contract_failed:missing_discovery_runtime_module_import");
  assert(/from "\.\/server-plans-quote-runtime\.mjs"/.test(source), "contract_failed:missing_quote_runtime_module_import");
  assert(/from "\.\/server-plans-cloud-status\.mjs"/.test(source), "contract_failed:missing_cloud_status_module_import");
  const discoverySource = await readFile(path.join(repoRoot, "adapters/billing-aggregator/src/server-plans-discovery-runtime.mjs"), "utf8");
  const listQuerySource = await readFile(listQueryPath, "utf8");
  const portalServerPlanHandlerSource = await readFile(portalServerPlanHandlerPath, "utf8");
  const portalServerPlansDomainSource = await readFile(portalServerPlansDomainPath, "utf8");
  const portalServerPlansApiSource = await readFile(portalServerPlansApiPath, "utf8");
  const overviewViewSource = await readFile(overviewViewPath, "utf8");
  assert(/from "\.\/server-plans-billing-policy\.mjs"/.test(discoverySource), "contract_failed:discovery_runtime_must_use_billing_policy");
  assert(/from "\.\/server-plans-availability-filters\.mjs"/.test(discoverySource), "contract_failed:discovery_runtime_must_use_availability_filters");
  assert(listQuerySource.includes("catalogRuntimeStatus"), "contract_failed:missing_catalog_runtime_status");
  assert(listQuerySource.includes("pricingSourceStatus"), "contract_failed:missing_pricing_source_status");
  assert(listQuerySource.includes("availabilitySyncEnabled"), "contract_failed:missing_availability_sync_enabled");
  assert(listQuerySource.includes("availabilitySnapshotCount"), "contract_failed:missing_availability_snapshot_count");
  assert(listQuerySource.includes("isPurchasable"), "contract_failed:missing_is_purchasable");
  assert(listQuerySource.includes("isSelectable"), "contract_failed:missing_is_selectable");
  assert(listQuerySource.includes("priceOrigin"), "contract_failed:missing_price_origin");
  assert(listQuerySource.includes("catalogSource"), "contract_failed:missing_catalog_source");
  assert(portalServerPlanHandlerSource.includes("sanitizeServerPlansPublicPayload"), "contract_failed:portal_server_plans_must_sanitize_public_payload");
  assert(!portalServerPlanHandlerSource.includes("InquiryPriceRunInstances 实时报价"), "contract_failed:portal_server_plans_must_not_expose_cvm_quote_action");
  assertNoSourceSnippet(portalServerPlansDomainSource, [
    "salableCount",
    "orderableCount",
    "cloudStatus",
    "discoveryEnabled",
    "discoveredCount",
    "item.salable",
    "item.canOrder",
    "pricingSource:",
    "腾讯云地域",
  ], "portal_server_plans_domain_public_semantics");
  assertNoSourceSnippet(portalServerPlansApiSource, [
    "salableCount",
    "orderableCount",
    "cloudStatus",
    "discoveryEnabled",
    "discoveredCount",
    "salable:",
    "canOrder",
    "pricingSource:",
    ".pricingSource",
    "source:",
  ], "portal_server_plans_api_types");
  assertNoSourceSnippet(overviewViewSource, [
    "salableCount",
    "orderableCount",
    "cloudStatus",
    "discoveryEnabled",
    "discoveredCount",
  ], "overview_server_plans_public_semantics");
  assert(!source.includes("function normalizeStringMap("), "contract_failed:service_still_embeds_catalog_normalization");
  assert(!source.includes("function hasSoldOutMarker("), "contract_failed:service_still_embeds_billing_policy");
  assert(!source.includes("function filterServerPlansPayload("), "contract_failed:service_still_embeds_availability_filters");
  assert(!source.includes("async function listServerPlans("), "contract_failed:service_still_embeds_list_query");
  for (const functionName of [
    "normalizeTencentPrice",
    "normalizeTencentDiscoveredPlan",
    "discoverTencentServerPlans",
    "overlayCatalogOnDiscovered",
    "quoteTencentServerPlan",
    "buildTencentCloudStatus",
  ]) {
    assert(!source.includes(`function ${functionName}(`) && !source.includes(`async function ${functionName}(`), `contract_failed:service_still_embeds_${functionName}`);
  }
  assert(lines <= 220, `contract_failed:server_plans_service_too_large:${lines}`);
  const { createServerPlansService } = await import("../adapters/billing-aggregator/src/server-plans-service.mjs");
  const service = createServerPlansService({
    env: {
      SERVER_PLAN_CATALOG_JSON: JSON.stringify([{
        id: "cpu-2c4g",
        name: "CPU 2C4G",
        provider: "tencent",
        region: "na-siliconvalley",
        zone: "na-siliconvalley-1",
        instanceType: "SA5.MEDIUM4",
        cpu: 2,
        memoryGb: 4,
        isPurchasable: true,
        isSelectable: true,
        hourlyPrice: 1.25,
        nodePool: "legacy-node-pool",
        nodePoolId: "np-legacy",
        provisionerPayload: { create: true },
        pricingSource: "tencent_cloud_catalog",
        source: "tencent_cloud_platform_catalog",
      }]),
      TENCENT_CLOUD_REGION: "na-siliconvalley",
      TENCENT_PRICE_ENABLED: false,
      TENCENT_PLAN_DISCOVERY_ENABLED: false,
      SERVER_PLAN_CACHE_TTL_MS: 0,
    },
    deps: {
      firstString,
      firstNumber,
      sanitizeCloudError: (error) => error ? { message: String(error.message || error) } : null,
      cloudErrorMessage: (error) => String(error?.message || error || ""),
      tencentCloudConfigured: () => false,
      callTencentCloud: async () => {
        throw new Error("unexpected_cloud_call");
      },
      randomUUID: () => "uuid-test",
    },
  });
  const payload = await service.listServerPlans();
  assert(payload.catalogSource, "contract_failed:server_plans_must_expose_catalog_source");
  assert(payload.catalogRuntimeStatus, "contract_failed:server_plans_must_expose_catalog_runtime_status");
  assert(payload.pricingSourceStatus, "contract_failed:server_plans_must_expose_pricing_source_status");
  assert(hasOwn(payload, "availabilitySyncEnabled"), "contract_failed:server_plans_must_expose_availability_sync_enabled");
  assert(hasOwn(payload, "availabilitySnapshotCount"), "contract_failed:server_plans_must_expose_availability_snapshot_count");
  const [item] = payload.items;
  assert(item, "contract_failed:server_plans_must_return_catalog_item");
  assert(hasOwn(item, "isPurchasable"), "contract_failed:server_plan_item_must_expose_is_purchasable");
  assert(hasOwn(item, "isSelectable"), "contract_failed:server_plan_item_must_expose_is_selectable");
  assert(hasOwn(item, "priceOrigin"), "contract_failed:server_plan_item_must_expose_price_origin");
  assert(hasOwn(item, "catalogSource"), "contract_failed:server_plan_item_must_expose_catalog_source");
  await assertPortalServerPlansPublicPayload();
  console.log(JSON.stringify({
    ok: true,
    contract: "v21_billing_server_plans_modularity",
    serviceNonEmptyLines: lines,
    publicApiSemantics: "product_catalog",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error.message || error) }, null, 2));
  process.exit(1);
});
