export function createServerPlansCloudStatus({
  cloudErrorMessage,
  cloudRuntimeState,
  env,
  tencentCloudConfigured,
}) {
  function isPlatformProvisionedRuntimeMode(value = "") {
    const mode = String(value || "").trim().toLowerCase();
    return [
      "platform_provisioned_runtime",
      "platform-provisioned-runtime",
      "cloud_provisioned_runtime",
      "cloud-provisioned-runtime",
      "user_owned_runtime",
      "user-owned-runtime",
      "user_owned",
      "user-owned",
      "cvm_instance",
    ].includes(mode);
  }

  const {
    TENCENT_CLOUD_REGION = "",
    TENCENT_CLOUD_TOKEN = "",
    TENCENT_PRICE_ENABLED = false,
    TENCENT_PRICE_IMAGE_CONFIGURED = false,
    TENCENT_PRICE_IMAGE_ID = "",
    TENCENT_PRICE_IMAGE_SOURCE = "",
    TENCENT_PLAN_DISCOVERY_ENABLED = false,
    TENCENT_PLAN_DISCOVERY_ZONES = "",
    TENCENT_CVM_ENDPOINT = "",
    TENCENT_BILLING_ENABLED = false,
    TENCENT_BILLING_REQUIRED = false,
    TENCENT_BILLING_ENDPOINT = "",
    OPENCOST_BASE_URL = "",
  } = env;

  function buildTencentCloudStatus({ items = [], catalog = [], discovered = [] } = {}) {
    const quotedCount = items.filter((item) => item.priceStatus === "quoted").length;
    const salableCount = items.filter((item) => item.salable || item.canOrder).length;
    const platformProvisionedRuntimeCount = items.filter((item) => isPlatformProvisionedRuntimeMode(item.provisioningMode)).length;
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
        source: "platform_provisioned_runtime",
        platformProvisionedRuntimeCount,
        manualBindingCount: Math.max(0, items.length - platformProvisionedRuntimeCount),
        note: "可售规格描述平台代开隔离运行时与存储的套餐能力；兼容旧 user_owned 输入，但默认语义已经归一到平台托管运行时。",
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
      pendingSource: "local_metering_pending",
    };
  }

  return { buildTencentCloudStatus };
}
