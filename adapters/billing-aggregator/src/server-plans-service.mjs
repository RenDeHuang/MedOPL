export function createServerPlansService({
  env = {},
  deps = {},
  state = {},
} = {}) {
  const {
    SERVER_PLAN_CATALOG_JSON = "[]",
    SERVER_PLAN_CACHE_TTL_MS = 300000,
    TENCENT_CLOUD_REGION = "",
    TENCENT_CLOUD_TOKEN = "",
    TENCENT_PRICE_ENABLED = false,
    TENCENT_PRICE_IMAGE_ID = "",
    TENCENT_PRICE_IMAGE_CONFIGURED = false,
    TENCENT_PRICE_IMAGE_SOURCE = "",
    TENCENT_PLAN_DISCOVERY_ENABLED = false,
    TENCENT_PLAN_DISCOVERY_ZONES = "",
    TENCENT_PLAN_DISCOVERY_CHARGE_TYPE = "POSTPAID_BY_HOUR",
    TENCENT_PLAN_DISCOVERY_MAX = 80,
    TENCENT_CVM_ENDPOINT = "",
    TENCENT_CVM_VERSION = "",
    TENCENT_BILLING_ENABLED = false,
    TENCENT_BILLING_REQUIRED = false,
    TENCENT_BILLING_ENDPOINT = "",
    OPENCOST_BASE_URL = "",
  } = env;
  const {
    firstString,
    firstNumber,
    sanitizeCloudError,
    cloudErrorMessage,
    tencentCloudConfigured,
    callTencentCloud,
    randomUUID,
  } = deps;
  const cloudRuntimeState = state.cloudRuntimeState || {
    lastDiscoveryAt: "",
    lastDiscoveryError: null,
    lastQuoteAt: "",
    lastQuoteError: null,
    lastBillQueryAt: "",
    lastBillQueryError: null,
  };
  const serverPlanCache = state.serverPlanCache || {
    expiresAt: 0,
    payload: null,
  };

  function markCloudState(kind, error = null) {
    const now = new Date().toISOString();
    if (kind === "discovery") {
      cloudRuntimeState.lastDiscoveryAt = now;
      cloudRuntimeState.lastDiscoveryError = sanitizeCloudError(error);
    }
    if (kind === "quote") {
      cloudRuntimeState.lastQuoteAt = now;
      cloudRuntimeState.lastQuoteError = sanitizeCloudError(error);
    }
    if (kind === "bill") {
      cloudRuntimeState.lastBillQueryAt = now;
      cloudRuntimeState.lastBillQueryError = sanitizeCloudError(error);
    }
  }

  function parseJsonEnv(raw, fallback) {
    if (!String(raw || "").trim()) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function serverPlanCatalog() {
    const parsed = parseJsonEnv(SERVER_PLAN_CATALOG_JSON, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function normalizeStringMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [String(key || "").trim(), String(entry ?? "").trim()])
        .filter(([key, entry]) => key && entry),
    );
  }

  function normalizeTolerations(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => ({
        key: firstString(item.key),
        operator: firstString(item.operator, "Equal"),
        value: firstString(item.value),
        effect: firstString(item.effect),
      }))
      .filter((item) => item.key);
  }

  function commaList(value = "") {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseOptionalNumber(value) {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeServerPlanQuery(input = {}) {
    return {
      region: firstString(input.region),
      zone: firstString(input.zone),
      cpu: parseOptionalNumber(input.cpu),
      memoryGb: parseOptionalNumber(input.memoryGb ?? input.memory),
    };
  }

  function buildTencentDiscoveryFilters(query = {}) {
    const filters = [
      {
        Name: "instance-charge-type",
        Values: [TENCENT_PLAN_DISCOVERY_CHARGE_TYPE],
      },
    ];
    const zones = commaList(firstString(query.zone, TENCENT_PLAN_DISCOVERY_ZONES));
    if (zones.length) filters.push({ Name: "zone", Values: zones });
    return filters;
  }

  function normalizeTencentPrice(response = {}) {
    const price = response.Price || response.InstancePrice || response;
    const instancePrice = price.InstancePrice || price;
    return {
      currency: firstString(price.Currency, instancePrice.Currency, "CNY"),
      originalPrice: firstNumber(instancePrice.OriginalPrice, price.OriginalPrice),
      discountPrice: firstNumber(instancePrice.DiscountPrice, price.DiscountPrice, instancePrice.UnitPrice, price.UnitPrice),
      unitPrice: firstNumber(instancePrice.UnitPrice, price.UnitPrice, instancePrice.DiscountPrice, price.DiscountPrice),
      raw: response,
    };
  }

  function hasSoldOutMarker(statusCategory = "", soldOutReason = "") {
    const category = String(statusCategory || "").trim().toLowerCase();
    const reason = String(soldOutReason || "").trim();
    if (reason) return true;
    const normalized = category.replace(/[^a-z0-9]+/g, "");
    if (["enoughstock", "normalstock", "instock"].includes(normalized)) return false;
    return [
      "soldout",
      "stockout",
      "outofstock",
      "nostock",
      "understock",
      "insufficient",
      "shortage",
      "inventoryshortage",
    ].some((marker) => normalized.includes(marker))
      || category.includes("sold out")
      || category.includes("out of stock")
      || category.includes("库存不足")
      || category.includes("无库存")
      || category.includes("售罄");
  }

  function normalizeTencentDiscoveredPlan(item = {}, region = TENCENT_CLOUD_REGION) {
    const zone = firstString(item.Zone, item.zone);
    const instanceType = firstString(item.InstanceType, item.instanceType);
    const cpu = firstNumber(item.CPU, item.Cpu, item.cpu);
    const memoryGb = firstNumber(item.Memory, item.memory);
    const gpu = firstNumber(item.Gpu, item.GPU, item.GpuCount, item.GPUCount, 0);
    const price = normalizeTencentPrice({ Price: item.Price || item.InstancePrice || {} });
    const availabilityStatus = firstString(item.Status, item.InstanceTypeState, "UNKNOWN").toUpperCase();
    const statusCategory = firstString(item.StatusCategory, item.StatusCategoryName);
    const soldOutReason = firstString(item.SoldOutReason);
    const hourlyPrice = firstNumber(price.discountPrice, price.unitPrice, price.originalPrice);
    const hasPrice = Boolean(price.unitPrice || price.discountPrice);
    const canOrder = availabilityStatus === "SELL" && hasPrice && !hasSoldOutMarker(statusCategory, soldOutReason);
    return {
      id: `tencent-${zone}-${instanceType}`.replace(/[^a-zA-Z0-9._-]+/g, "-"),
      name: firstString(item.TypeName, item.InstanceFamily, instanceType),
      provider: "tencent",
      region,
      zone,
      instanceType,
      cpu,
      memoryGb,
      gpu,
      gpuCount: gpu,
      nodePool: "",
      runtimeClass: "",
      nodeSelector: {},
      tolerations: [],
      cpuRequest: cpu ? `${cpu * 1000}m` : "",
      cpuLimit: cpu ? `${cpu * 1000}m` : "",
      memoryRequest: memoryGb ? `${memoryGb}Gi` : "",
      memoryLimit: memoryGb ? `${memoryGb}Gi` : "",
      storageRequest: "",
      storageLimit: "",
      minBillableHours: 1,
      riskFactor: 1.2,
      reservationFloor: 0,
      priceStatus: hasPrice ? "quoted" : "discovered",
      availabilityStatus,
      statusCategory,
      soldOutReason,
      hourlyPrice,
      canOrder,
      salable: canOrder,
      reason: canOrder ? "" : firstString(soldOutReason, statusCategory, hasPrice ? availabilityStatus : "price_not_available"),
      provisioningMode: "schedule_to_node_pool",
      selectionNote: "腾讯云发现的可售规格；节点池和 runtimeClass 可由平台目录覆盖。",
      source: "tencent_cloud_discovery",
      pricingSource: "tencent_cloud_zone_instance_catalog",
      priceUpdatedAt: new Date().toISOString(),
      ...price,
    };
  }

  async function discoverTencentServerPlans(query = {}) {
    if (!TENCENT_PLAN_DISCOVERY_ENABLED) return [];
    if (!tencentCloudConfigured()) return [];
    const targetRegion = firstString(query.region, TENCENT_CLOUD_REGION);
    try {
      const response = await callTencentCloud({
        endpoint: TENCENT_CVM_ENDPOINT,
        service: "cvm",
        action: "DescribeZoneInstanceConfigInfos",
        version: TENCENT_CVM_VERSION,
        region: targetRegion,
        payload: {
          Filters: buildTencentDiscoveryFilters(query),
        },
      });
      const items = Array.isArray(response.InstanceTypeQuotaSet) ? response.InstanceTypeQuotaSet : [];
      const limit = Number.isFinite(TENCENT_PLAN_DISCOVERY_MAX) && TENCENT_PLAN_DISCOVERY_MAX > 0 ? TENCENT_PLAN_DISCOVERY_MAX : 80;
      markCloudState("discovery");
      return items
        .map((item) => normalizeTencentDiscoveredPlan(item, targetRegion))
        .filter((item) => item.instanceType && item.zone)
        .slice(0, limit);
    } catch (error) {
      markCloudState("discovery", error);
      throw error;
    }
  }

  function overlayCatalogOnDiscovered(discovered = [], catalog = []) {
    const map = new Map(discovered.map((item) => [`${item.zone}:${item.instanceType}`, item]));
    for (const plan of catalog) {
      const key = `${plan.zone || ""}:${plan.instanceType || ""}`;
      const current = key.trim() !== ":" ? map.get(key) : null;
      if (current) {
        map.set(key, { ...current, ...plan, id: firstString(plan.id, current.id), source: "tencent_cloud_discovery+platform_catalog" });
      } else {
        map.set(firstString(plan.id, plan.instanceType, randomUUID()), plan);
      }
    }
    return Array.from(map.values());
  }

  function planMatchesQuery(plan, query = {}) {
    const normalized = normalizeServerPlanQuery(query);
    if (normalized.region && String(plan.region || "").trim() !== normalized.region) return false;
    if (normalized.zone && String(plan.zone || "").trim() !== normalized.zone) return false;
    if (normalized.cpu !== null && Number(plan.cpu || 0) !== normalized.cpu) return false;
    if (normalized.memoryGb !== null && Number(plan.memoryGb || plan.memory || 0) !== normalized.memoryGb) return false;
    return true;
  }

  async function quoteTencentServerPlan(plan) {
    if (!TENCENT_PRICE_ENABLED) {
      markCloudState("quote", new Error("tencent_price_disabled"));
      return { priceStatus: "disabled", salable: false, reason: "tencent_price_disabled" };
    }
    if (!tencentCloudConfigured()) {
      markCloudState("quote", new Error("tencent_cloud_credentials_not_configured"));
      return { priceStatus: "not_configured", salable: false, reason: "tencent_cloud_credentials_not_configured" };
    }
    if (!plan.zone || !plan.instanceType) {
      markCloudState("quote", new Error("zone_and_instanceType_required"));
      return { priceStatus: "invalid_plan", salable: false, reason: "zone_and_instanceType_required" };
    }
    const imageId = firstString(plan.imageId, TENCENT_PRICE_IMAGE_ID);
    if (!imageId) {
      markCloudState("quote", new Error("imageId_or_TENCENT_PRICE_IMAGE_ID_required"));
      return { priceStatus: "invalid_plan", salable: false, reason: "imageId_or_TENCENT_PRICE_IMAGE_ID_required" };
    }
    try {
      const payload = {
        InstanceChargeType: plan.instanceChargeType || "POSTPAID_BY_HOUR",
        Placement: { Zone: plan.zone },
        InstanceType: plan.instanceType,
        ImageId: imageId,
        SystemDisk: plan.systemDisk || {
          DiskType: plan.systemDiskType || "CLOUD_BSSD",
          DiskSize: Number(plan.systemDiskSize || 50),
        },
        InternetAccessible: plan.internetAccessible || { InternetChargeType: "TRAFFIC_POSTPAID_BY_HOUR", InternetMaxBandwidthOut: 1 },
        InstanceCount: 1,
      };
      if (Array.isArray(plan.dataDisks) && plan.dataDisks.length > 0) {
        payload.DataDisks = plan.dataDisks;
      }
      const response = await callTencentCloud({
        endpoint: TENCENT_CVM_ENDPOINT,
        service: "cvm",
        action: "InquiryPriceRunInstances",
        version: TENCENT_CVM_VERSION,
        region: plan.region || TENCENT_CLOUD_REGION,
        payload,
      });
      return {
        priceStatus: "quoted",
        salable: true,
        imageId,
        imageSource: plan.imageId ? "server_plan" : TENCENT_PRICE_IMAGE_SOURCE,
        imageRegion: plan.region || TENCENT_CLOUD_REGION,
        ...normalizeTencentPrice(response),
      };
    } catch (error) {
      markCloudState("quote", error);
      return {
        priceStatus: "quote_failed",
        salable: false,
        reason: sanitizeCloudError(error)?.message || "tencent_quote_failed",
        code: error.code || "",
      };
    }
  }

  function buildTencentCloudStatus({ items = [], catalog = [], discovered = [] } = {}) {
    const quotedCount = items.filter((item) => item.priceStatus === "quoted").length;
    const salableCount = items.filter((item) => item.salable || item.canOrder).length;
    const automaticProvisionCount = items.filter((item) => {
      const mode = String(item.provisioningMode || "").toLowerCase();
      return ["tke_node_pool", "tke_node_pool_create", "tke_node_pool_scale", "cvm_instance"].includes(mode);
    }).length;
    return {
      provider: "tencent_cloud",
      region: TENCENT_CLOUD_REGION,
      tokenConfigured: Boolean(TENCENT_CLOUD_TOKEN),
      price: {
        enabled: TENCENT_PRICE_ENABLED,
        imageConfigured: TENCENT_PRICE_IMAGE_CONFIGURED,
        imageSource: TENCENT_PRICE_IMAGE_SOURCE,
        imageRegion: TENCENT_CLOUD_REGION,
        endpoint: TENCENT_CVM_ENDPOINT,
        catalogConfigured: catalog.length > 0,
        catalogCount: catalog.length,
        discoveryEnabled: TENCENT_PLAN_DISCOVERY_ENABLED,
        discoveryZonesConfigured: Boolean(TENCENT_PLAN_DISCOVERY_ZONES),
        discoveredCount: discovered.length,
        quotedCount,
        salableCount,
        lastDiscoveryAt: cloudRuntimeState.lastDiscoveryAt,
        lastDiscoveryError: cloudRuntimeState.lastDiscoveryError,
        lastQuoteAt: cloudRuntimeState.lastQuoteAt,
        lastQuoteError: cloudRuntimeState.lastQuoteError,
      },
      billing: {
        enabled: TENCENT_BILLING_ENABLED,
        required: TENCENT_BILLING_REQUIRED,
        endpoint: TENCENT_BILLING_ENDPOINT,
        exactBillingSource: "DescribeBillDetail",
        lastBillQueryAt: cloudRuntimeState.lastBillQueryAt,
        lastBillQueryError: cloudRuntimeState.lastBillQueryError,
      },
      provisioning: {
        source: "resource_provisioner",
        automaticProvisionCount,
        existingNodePoolCount: items.length - automaticProvisionCount,
        note: automaticProvisionCount > 0
          ? "存在需要 Resource Provisioner 调用 TKE 的可售规格。"
          : "当前可售规格会调度到现有节点池；自动开通需要 nodePool payload。",
      },
      readiness: {
        cloudAccountConnected: tencentCloudConfigured(),
        realPriceReady: tencentCloudConfigured() && TENCENT_PRICE_ENABLED && Boolean(TENCENT_PRICE_IMAGE_ID) && quotedCount > 0,
        exactBillReady: tencentCloudConfigured() && TENCENT_BILLING_ENABLED,
        catalogReady: catalog.length > 0,
        serverPlansReady: salableCount > 0,
      },
      credentialsConfigured: tencentCloudConfigured(),
      priceEnabled: TENCENT_PRICE_ENABLED,
      billingEnabled: TENCENT_BILLING_ENABLED,
      billingRequired: TENCENT_BILLING_REQUIRED,
      tencentRegion: TENCENT_CLOUD_REGION,
      priceImageConfigured: TENCENT_PRICE_IMAGE_CONFIGURED,
      catalogConfigured: catalog.length > 0,
      discoveryEnabled: TENCENT_PLAN_DISCOVERY_ENABLED,
      lastQuoteAt: cloudRuntimeState.lastQuoteAt,
      lastQuoteError: cloudErrorMessage(cloudRuntimeState.lastQuoteError),
      lastBillQueryAt: cloudRuntimeState.lastBillQueryAt,
      lastBillQueryError: cloudErrorMessage(cloudRuntimeState.lastBillQueryError),
      exactBillingSource: TENCENT_BILLING_ENABLED ? "tencent_cloud_bill" : "not_configured",
      pendingSource: OPENCOST_BASE_URL ? "opencost_pending" : "metering_pending",
    };
  }

  function filterServerPlansPayload(payload, query = {}, options = {}) {
    const normalized = normalizeServerPlanQuery(query);
    const items = Array.isArray(payload?.items) ? payload.items.filter((item) => planMatchesQuery(item, normalized)) : [];
    const result = {
      ...payload,
      items,
      candidateCount: items.length,
      orderableCount: items.filter((item) => item.canOrder || item.salable).length,
      filter: normalized,
    };
    if (options.cacheHit) {
      result.cache = {
        hit: true,
        ttlMs: SERVER_PLAN_CACHE_TTL_MS,
        expiresAt: new Date(serverPlanCache.expiresAt).toISOString(),
      };
    }
    return result;
  }

  async function listServerPlans(query = {}) {
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
    for (const plan of plans) {
      const hasCloudDiscoveryPrice = String(plan.source || "").startsWith("tencent_cloud_discovery") && plan.priceStatus;
      const quote = hasCloudDiscoveryPrice
        ? {}
        : (plan.provider === "tencent" || !plan.provider
          ? await quoteTencentServerPlan(plan)
          : { priceStatus: "external_provider", salable: false, reason: "unsupported_provider" });
      if (quote.priceStatus === "quoted") markCloudState("quote");
      const availabilityStatus = firstString(plan.availabilityStatus, plan.status, quote.availabilityStatus).toUpperCase();
      const statusCategory = firstString(plan.statusCategory, quote.statusCategory);
      const soldOutReason = firstString(plan.soldOutReason, quote.soldOutReason);
      const hourlyPrice = firstNumber(
        quote.discountPrice,
        quote.unitPrice,
        quote.originalPrice,
        plan.hourlyPrice,
        plan.discountPrice,
        plan.unitPrice,
        plan.originalPrice,
      );
      const hasPrice = hourlyPrice > 0;
      const canOrder = hasSoldOutMarker(statusCategory, soldOutReason)
        ? false
        : availabilityStatus
          ? availabilityStatus === "SELL" && hasPrice
          : Boolean((plan.canOrder ?? plan.salable ?? quote.salable) && hasPrice);
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
        provisioningMode: firstString(plan.provisioningMode, "schedule_to_node_pool"),
        selectionNote: firstString(plan.selectionNote, "选择后会按规格资源和节点选择器调度到集群。"),
        source: plan.source || "platform_catalog",
        availabilityStatus,
        statusCategory,
        soldOutReason,
        hourlyPrice,
        canOrder,
        ...quote,
        salable: canOrder,
        currency: firstString(quote.currency, plan.currency, "CNY"),
        pricingSource: firstString(quote.priceStatus === "quoted" ? "tencent_cloud_inquiry_price_run_instances" : "", plan.pricingSource, plan.source, "tencent_cloud_catalog"),
        reason: canOrder ? "" : firstString(soldOutReason, quote.reason, plan.reason, statusCategory, availabilityStatus, "server_plan_unavailable"),
        priceUpdatedAt: new Date().toISOString(),
        quotedAt: new Date().toISOString(),
      });
    }
    const payload = {
      ok: true,
      source: discovered.length > 0 ? "tencent_cloud_live_catalog" : "tencent_cloud_platform_catalog",
      configured: tencentCloudConfigured(),
      priceEnabled: TENCENT_PRICE_ENABLED,
      discoveryEnabled: TENCENT_PLAN_DISCOVERY_ENABLED,
      discoveredCount: discovered.length,
      catalogCount: catalog.length,
      cloudStatus: buildTencentCloudStatus({ items, catalog, discovered }),
      items,
    };
    if (SERVER_PLAN_CACHE_TTL_MS > 0 && items.some((item) => item.priceStatus === "quoted")) {
      serverPlanCache.expiresAt = Date.now() + SERVER_PLAN_CACHE_TTL_MS;
      serverPlanCache.payload = payload;
    }
    return filterServerPlansPayload(payload, query);
  }

  return {
    buildTencentCloudStatus,
    listServerPlans,
    markCloudState,
    serverPlanCatalog,
  };
}
