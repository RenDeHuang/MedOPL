import { resolvePlanSaleStatus } from "./server-plans-billing-policy.mjs";

function normalizeProvisioningMode(value = "", fallback = "platform_provisioned_runtime") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (!normalized) return fallback;
  if ([
    "platform_provisioned_runtime",
    "platform-provisioned-runtime",
    "cloud_provisioned_runtime",
    "cloud-provisioned-runtime",
    "user_owned_runtime",
    "user-owned-runtime",
    "user_owned",
    "user-owned",
    "cvm_instance",
  ].includes(normalized)) {
    return "platform_provisioned_runtime";
  }
  return normalized;
}

function normalizeCatalogSource(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("tencent_cloud") || normalized.includes("provider")) {
    return "provider_catalog_snapshot";
  }
  return "platform_catalog";
}

export function createServerPlansListQuery({
  firstString,
  firstNumber,
  normalizeStringMap,
  normalizeTolerations,
  filterServerPlansPayload,
  tencentCloudConfigured,
  quoteTencentServerPlan,
  discoverTencentServerPlans,
  serverPlanCatalog,
  overlayCatalogOnDiscovered,
  buildTencentCloudStatus,
  markCloudState,
  now = () => new Date().toISOString(),
  env = {},
  state = {},
}) {
  const {
    TENCENT_CLOUD_REGION = "",
    TENCENT_PRICE_ENABLED = false,
    TENCENT_PLAN_DISCOVERY_ENABLED = false,
    SERVER_PLAN_CACHE_TTL_MS = 300000,
  } = env;
  const {
    serverPlanCache = { expiresAt: 0, payload: null },
  } = state;

  return async function listServerPlans(query = {}) {
    if (serverPlanCache.payload && SERVER_PLAN_CACHE_TTL_MS > 0 && Date.now() < serverPlanCache.expiresAt) {
      return filterServerPlansPayload(serverPlanCache.payload, query, { cacheHit: true });
    }
    const catalog = serverPlanCatalog();
    let discovered = [];
    try {
      discovered = await discoverTencentServerPlans(query);
    } catch {
      discovered = [];
    }
    const plans = TENCENT_PLAN_DISCOVERY_ENABLED
      ? overlayCatalogOnDiscovered(discovered, catalog)
      : catalog;
    const items = [];
    const diagnosticItems = [];
    for (const plan of plans) {
      const hasCloudDiscoveryPrice = String(plan.source || "").startsWith("tencent_cloud_discovery") && plan.priceStatus;
      const quote = hasCloudDiscoveryPrice
        ? {}
        : (plan.provider === "tencent" || !plan.provider
          ? await quoteTencentServerPlan(plan)
          : { priceStatus: "external_provider", salable: false, reason: "unsupported_provider" });
      if (quote.priceStatus === "quoted") markCloudState("quote");
      const saleStatus = resolvePlanSaleStatus({ plan, quote, firstString, firstNumber });
      const catalogSource = normalizeCatalogSource(firstString(plan.catalogSource, plan.source));
      const quoted = quote.priceStatus === "quoted" || plan.priceStatus === "quoted";
      const priceOrigin = firstString(
        quote.priceStatus === "quoted" ? "provider_quote" : "",
        plan.priceOrigin,
        plan.pricingSource ? normalizeCatalogSource(plan.pricingSource) : "",
        catalogSource === "provider_catalog_snapshot" ? "provider_catalog_snapshot" : "catalog_price",
      );
      const provisioningMode = normalizeProvisioningMode(firstString(plan.provisioningMode, "platform_provisioned_runtime"));
      const unavailableReason = saleStatus.canOrder ? "" : firstString(
        saleStatus.soldOutReason,
        quote.reason,
        plan.reason,
        saleStatus.statusCategory,
        saleStatus.availabilityStatus,
        "plan_unavailable",
      );
      diagnosticItems.push({
        priceStatus: quoted ? "quoted" : firstString(quote.priceStatus, plan.priceStatus),
        salable: saleStatus.canOrder,
        canOrder: saleStatus.canOrder,
        provisioningMode,
      });
      items.push({
        id: firstString(plan.id, plan.serverPlanId, plan.instanceType),
        name: firstString(plan.name, plan.instanceType),
        provider: plan.provider || "tencent",
        region: plan.region || firstString(query.region, TENCENT_CLOUD_REGION),
        zone: plan.zone || "",
        instanceType: plan.instanceType || "",
        cpu: Number(plan.cpu || 0),
        memoryGb: Number(plan.memoryGb || plan.memory || 0),
        gpu: Number(plan.gpu || plan.gpuCount || 0),
        nodePool: plan.nodePool || "",
        runtimeClass: plan.runtimeClass || "",
        nodeSelector: normalizeStringMap(plan.nodeSelector),
        tolerations: normalizeTolerations(plan.tolerations),
        podNetworkingMode: firstString(plan.podNetworkingMode, plan.pod_networking_mode),
        requiresEniPod: plan.requiresEniPod === true || plan.requires_eni_pod === true,
        podAnnotations: normalizeStringMap(plan.podAnnotations || plan.pod_annotations),
        cpuRequest: firstString(plan.cpuRequest, plan.resources?.requests?.cpu),
        cpuLimit: firstString(plan.cpuLimit, plan.resources?.limits?.cpu),
        memoryRequest: firstString(plan.memoryRequest, plan.resources?.requests?.memory),
        memoryLimit: firstString(plan.memoryLimit, plan.resources?.limits?.memory),
        gpuCount: Number(plan.gpuCount ?? plan.gpu ?? 0),
        storageRequest: firstString(plan.storageRequest, plan.resources?.requests?.["ephemeral-storage"]),
        storageLimit: firstString(plan.storageLimit, plan.resources?.limits?.["ephemeral-storage"]),
        minBillableHours: Number(plan.minBillableHours || 1),
        riskFactor: Number(plan.riskFactor || 1.2),
        reservationFloor: Number(plan.reservationFloor || 0),
        tkeClusterId: firstString(plan.tkeClusterId, plan.clusterId),
        nodePoolId: firstString(plan.nodePoolId),
        nodePoolCreatePayload: plan.nodePoolCreatePayload || null,
        nodePoolScalePayload: plan.nodePoolScalePayload || plan.nodePoolModifyPayload || null,
        provisionerPayload: plan.provisionerPayload || plan.provisioningPayload || null,
        systemDisk: plan.systemDisk || null,
        dataDisks: Array.isArray(plan.dataDisks) ? plan.dataDisks : [],
        internetAccessible: plan.internetAccessible || null,
        provisioningMode,
        selectionNote: firstString(plan.selectionNote, "选择后由平台代开隔离 runtime、workspace 绑定存储与 runtime agent，并进入本周保护金计费语义。"),
        catalogSource,
        source: plan.source || "platform_catalog",
        availabilityStatus: saleStatus.availabilityStatus,
        statusCategory: saleStatus.statusCategory,
        soldOutReason: saleStatus.soldOutReason,
        availabilityCategory: firstString(saleStatus.statusCategory, saleStatus.availabilityStatus),
        unavailableReason,
        hourlyPrice: saleStatus.hourlyPrice,
        isPurchasable: saleStatus.canOrder,
        isSelectable: saleStatus.canOrder,
        canOrder: saleStatus.canOrder,
        ...quote,
        salable: saleStatus.canOrder,
        currency: firstString(quote.currency, plan.currency, "CNY"),
        originalPrice: firstNumber(quote.originalPrice, plan.originalPrice),
        discountPrice: firstNumber(quote.discountPrice, plan.discountPrice, saleStatus.hourlyPrice),
        unitPrice: firstNumber(quote.unitPrice, plan.unitPrice, saleStatus.hourlyPrice),
        priceOrigin,
        pricingSource: firstString(quote.priceStatus === "quoted" ? "tencent_cloud_inquiry_price_run_instances" : "", plan.pricingSource, plan.source, "tencent_cloud_catalog"),
        reason: unavailableReason,
        priceUpdatedAt: now(),
        quotedAt: now(),
      });
    }
    const cloudStatus = buildTencentCloudStatus({ items: diagnosticItems, catalog, discovered });
    const quotedCount = diagnosticItems.filter((item) => item.priceStatus === "quoted").length;
    const purchasableCount = items.filter((item) => item.isPurchasable).length;
    const selectableCount = items.filter((item) => item.isSelectable).length;
    const payload = {
      ok: true,
      source: discovered.length > 0 ? "tencent_cloud_live_catalog" : "tencent_cloud_platform_catalog",
      catalogSource: discovered.length > 0 ? "provider_catalog_snapshot" : "platform_catalog",
      configured: tencentCloudConfigured(),
      priceEnabled: TENCENT_PRICE_ENABLED,
      catalogRuntimeStatus: {
        status: catalog.length > 0 ? "ready" : "empty",
        configured: tencentCloudConfigured(),
        catalogCount: catalog.length,
        candidateCount: items.length,
        platformProvisionedRuntimeCount: cloudStatus.provisioning?.platformProvisionedRuntimeCount || 0,
      },
      pricingSourceStatus: {
        enabled: TENCENT_PRICE_ENABLED,
        status: quotedCount > 0 ? "ready" : (TENCENT_PRICE_ENABLED ? "pending" : "catalog_price"),
        priceOrigin: quotedCount > 0 ? "provider_quote" : "catalog_price",
        quotedCount,
        lastPricingSyncAt: cloudStatus.price?.lastQuoteAt || "",
        pendingSource: "platform_provisioned_local_metering",
      },
      availabilitySyncEnabled: TENCENT_PLAN_DISCOVERY_ENABLED,
      availabilitySnapshotCount: discovered.length,
      discoveryEnabled: TENCENT_PLAN_DISCOVERY_ENABLED,
      discoveredCount: discovered.length,
      catalogCount: catalog.length,
      purchasableCount,
      selectableCount,
      orderableCount: purchasableCount,
      cloudStatus,
      items,
    };
    if (SERVER_PLAN_CACHE_TTL_MS > 0 && diagnosticItems.some((item) => item.priceStatus === "quoted")) {
      serverPlanCache.expiresAt = Date.now() + SERVER_PLAN_CACHE_TTL_MS;
      serverPlanCache.payload = payload;
    }
    return filterServerPlansPayload(payload, query);
  };
}
