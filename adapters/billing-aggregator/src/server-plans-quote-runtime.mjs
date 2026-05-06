export function normalizeTencentPrice(response = {}, { firstString, firstNumber }) {
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

export function createServerPlansQuoteRuntime({
  callTencentCloud,
  env,
  firstString,
  firstNumber,
  markCloudState,
  sanitizeCloudError,
  tencentCloudConfigured,
}) {
  const {
    TENCENT_CLOUD_REGION = "",
    TENCENT_PRICE_ENABLED = false,
    TENCENT_PRICE_IMAGE_ID = "",
    TENCENT_PRICE_IMAGE_SOURCE = "",
    TENCENT_CVM_ENDPOINT = "",
    TENCENT_CVM_VERSION = "",
  } = env;

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
      if (Array.isArray(plan.dataDisks) && plan.dataDisks.length > 0) payload.DataDisks = plan.dataDisks;
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
        ...normalizeTencentPrice(response, { firstString, firstNumber }),
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

  return { quoteTencentServerPlan };
}
