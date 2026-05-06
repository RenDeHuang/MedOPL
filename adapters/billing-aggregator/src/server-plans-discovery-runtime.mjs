import { hasSoldOutMarker } from "./server-plans-billing-policy.mjs";
import { buildTencentDiscoveryFilters } from "./server-plans-availability-filters.mjs";
import { normalizeTencentPrice } from "./server-plans-quote-runtime.mjs";

export function createServerPlansDiscoveryRuntime({
  callTencentCloud,
  env,
  firstString,
  firstNumber,
  markCloudState,
  randomUUID,
  tencentCloudConfigured,
}) {
  const {
    TENCENT_CLOUD_REGION = "",
    TENCENT_PLAN_DISCOVERY_ENABLED = false,
    TENCENT_PLAN_DISCOVERY_ZONES = "",
    TENCENT_PLAN_DISCOVERY_CHARGE_TYPE = "POSTPAID_BY_HOUR",
    TENCENT_PLAN_DISCOVERY_MAX = 80,
    TENCENT_CVM_ENDPOINT = "",
    TENCENT_CVM_VERSION = "",
  } = env;

  function normalizeTencentDiscoveredPlan(item = {}, region = TENCENT_CLOUD_REGION) {
    const zone = firstString(item.Zone, item.zone);
    const instanceType = firstString(item.InstanceType, item.instanceType);
    const cpu = firstNumber(item.CPU, item.Cpu, item.cpu);
    const memoryGb = firstNumber(item.Memory, item.memory);
    const gpu = firstNumber(item.Gpu, item.GPU, item.GpuCount, item.GPUCount, 0);
    const price = normalizeTencentPrice({ Price: item.Price || item.InstancePrice || {} }, { firstString, firstNumber });
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
      provisioningMode: "platform_provisioned_runtime",
      selectionNote: "腾讯云发现的可售规格；用于平台代开隔离 runtime 与存储的套餐选择与计费参考。",
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
          Filters: buildTencentDiscoveryFilters(query, {
            firstString,
            TENCENT_PLAN_DISCOVERY_CHARGE_TYPE,
            TENCENT_PLAN_DISCOVERY_ZONES,
          }),
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

  return {
    discoverTencentServerPlans,
    overlayCatalogOnDiscovered,
  };
}
