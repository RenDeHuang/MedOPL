const TENCENT_DEFAULT_IMAGE_ID = "img-487zeit5";

function defaultServerPlanCatalog() {
  const runtimeNodePoolScheduling = {
    nodeSelector: { "gaofenglab/node-pool-role": "runtime" },
    tolerations: [{ key: "gaofenglab/node-pool-role", operator: "Equal", value: "runtime", effect: "NoSchedule" }],
  };
  return [
    { id: "cpu-2c4g", name: "CPU 2C4G", provider: "tencent", region: "na-siliconvalley", zone: "na-siliconvalley-1", instanceType: "SA5.MEDIUM4", cpu: 2, memoryGb: 4, gpu: 0, salable: true, provisioningMode: "tke_node_pool_create", cpuRequest: "1000m", cpuLimit: "2", memoryRequest: "2Gi", memoryLimit: "3Gi", minBillableHours: 1, riskFactor: 1, reservationFloor: 0, storageRequest: "20Gi", storageLimit: "100Gi", ...runtimeNodePoolScheduling },
    { id: "cpu-4c8g", name: "CPU 4C8G", provider: "tencent", region: "na-siliconvalley", zone: "na-siliconvalley-1", instanceType: "SA5.LARGE8", cpu: 4, memoryGb: 8, gpu: 0, salable: true, provisioningMode: "tke_node_pool_create", cpuRequest: "2000m", cpuLimit: "4", memoryRequest: "4Gi", memoryLimit: "6Gi", minBillableHours: 1, riskFactor: 1, reservationFloor: 0, storageRequest: "20Gi", storageLimit: "150Gi", ...runtimeNodePoolScheduling },
    { id: "cpu-8c16g", name: "CPU 8C16G", provider: "tencent", region: "na-siliconvalley", zone: "na-siliconvalley-1", instanceType: "SA5.2XLARGE16", cpu: 8, memoryGb: 16, gpu: 0, salable: true, provisioningMode: "tke_node_pool_create", cpuRequest: "4000m", cpuLimit: "8", memoryRequest: "8Gi", memoryLimit: "12Gi", minBillableHours: 1, riskFactor: 1, reservationFloor: 0, storageRequest: "40Gi", storageLimit: "200Gi", ...runtimeNodePoolScheduling },
    { id: "cpu-16c32g", name: "CPU 16C32G", provider: "tencent", region: "na-siliconvalley", zone: "na-siliconvalley-1", instanceType: "SA5.4XLARGE32", cpu: 16, memoryGb: 32, gpu: 0, salable: true, provisioningMode: "tke_node_pool_create", cpuRequest: "8000m", cpuLimit: "16", memoryRequest: "16Gi", memoryLimit: "24Gi", minBillableHours: 1, riskFactor: 1, reservationFloor: 0, storageRequest: "80Gi", storageLimit: "300Gi", ...runtimeNodePoolScheduling },
  ];
}

function ensureServerPlanCatalogEnv(env) {
  if (String(env.SERVER_PLAN_CATALOG_JSON || "").trim()) {
    return String(env.SERVER_PLAN_CATALOG_JSON || "").trim();
  }
  const defaultCatalog = JSON.stringify(defaultServerPlanCatalog());
  env.SERVER_PLAN_CATALOG_JSON = defaultCatalog;
  return defaultCatalog;
}

export function parseBillingCli(argv = []) {
  const args = [...argv];
  const command = args[0] && !String(args[0]).startsWith("-") ? String(args.shift()).trim().toLowerCase() : "";
  const options = {
    customerId: "",
    workspaceId: "",
    window: "",
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = String(args[index] || "").trim();
    const next = String(args[index + 1] || "").trim();
    if (!token) continue;
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }
    if (token === "--customer-id" || token === "--customer") {
      options.customerId = next;
      index += 1;
      continue;
    }
    if (token.startsWith("--customer-id=") || token.startsWith("--customer=")) {
      options.customerId = token.split("=").slice(1).join("=").trim();
      continue;
    }
    if (token === "--workspace-id" || token === "--workspace") {
      options.workspaceId = next;
      index += 1;
      continue;
    }
    if (token.startsWith("--workspace-id=") || token.startsWith("--workspace=")) {
      options.workspaceId = token.split("=").slice(1).join("=").trim();
      continue;
    }
    if (token === "--window") {
      options.window = next;
      index += 1;
      continue;
    }
    if (token.startsWith("--window=")) {
      options.window = token.split("=").slice(1).join("=").trim();
      continue;
    }
    throw new Error(`Unknown billing-aggregator argument: ${token}`);
  }

  return { command, options };
}

export function readBillingRuntimeConfig({
  env = process.env,
  argv = process.argv.slice(2),
} = {}) {
  const SERVER_PLAN_CATALOG_JSON = ensureServerPlanCatalogEnv(env);
  const cliArgs = parseBillingCli(argv);
  if (cliArgs.command && !new Set(["serve", "reconcile", "billing-reconcile"]).has(cliArgs.command)) {
    throw new Error(`Unsupported billing-aggregator command: ${cliArgs.command}`);
  }

  const AUTO_RECONCILE_WINDOW = String(env.AUTO_RECONCILE_WINDOW || "168h").trim() || "168h";
  const BILLING_RECONCILE_ONCE = String(env.BILLING_RECONCILE_ONCE || "0") === "1";
  const BILLING_RECONCILE_CUSTOMER_ID = String(env.BILLING_RECONCILE_CUSTOMER_ID || "").trim();
  const BILLING_RECONCILE_WORKSPACE_ID = String(env.BILLING_RECONCILE_WORKSPACE_ID || "").trim();
  const BILLING_RECONCILE_WINDOW = String(env.BILLING_RECONCILE_WINDOW || AUTO_RECONCILE_WINDOW).trim() || AUTO_RECONCILE_WINDOW;
  const TENCENT_CLOUD_REGION = String(env.TENCENT_CLOUD_REGION || "na-siliconvalley").trim();
  const TENCENT_PRICE_IMAGE_ID = String(env.TENCENT_PRICE_IMAGE_ID || TENCENT_DEFAULT_IMAGE_ID).trim();

  const config = {
    PORT: Number(env.PORT || 3001),
    OPENCOST_BASE_URL: String(env.OPENCOST_BASE_URL || "").trim(),
    CPU_CORE_HOUR_RATE: Number(env.CPU_CORE_HOUR_RATE || "0.12"),
    GPU_HOUR_RATE: Number(env.GPU_HOUR_RATE || "2.00"),
    STORAGE_GB_DAY_RATE: Number(env.STORAGE_GB_DAY_RATE || "0.02"),
    DEFAULT_CPU_CORES: Number(env.DEFAULT_CPU_CORES || "0.5"),
    DEFAULT_GPU_COUNT: Number(env.DEFAULT_GPU_COUNT || "0"),
    AUTO_RECONCILE_ENABLED: String(env.AUTO_RECONCILE_ENABLED || "1") !== "0",
    AUTO_RECONCILE_INTERVAL_MS: Number(env.AUTO_RECONCILE_INTERVAL_MS || "600000"),
    AUTO_RECONCILE_WINDOW,
    BILLING_RECONCILE_ONCE,
    BILLING_RECONCILE_CUSTOMER_ID,
    BILLING_RECONCILE_WORKSPACE_ID,
    BILLING_RECONCILE_WINDOW,
    RESOURCE_PROVISIONER_URL: String(env.RESOURCE_PROVISIONER_URL || "").trim(),
    RESOURCE_PROVISIONER_TIMEOUT_MS: Number(env.RESOURCE_PROVISIONER_TIMEOUT_MS || 20000),
    TENCENT_CLOUD_SECRET_ID: String(env.TENCENT_CLOUD_SECRET_ID || env.TENCENTCLOUD_SECRET_ID || "").trim(),
    TENCENT_CLOUD_SECRET_KEY: String(env.TENCENT_CLOUD_SECRET_KEY || env.TENCENTCLOUD_SECRET_KEY || "").trim(),
    TENCENT_CLOUD_TOKEN: String(env.TENCENT_CLOUD_TOKEN || "").trim(),
    TENCENT_DEFAULT_IMAGE_ID,
    TENCENT_CLOUD_REGION,
    TENCENT_BILLING_ENABLED: String(env.TENCENT_BILLING_ENABLED || "0") === "1",
    TENCENT_BILLING_REQUIRED: String(env.TENCENT_BILLING_REQUIRED || "0") === "1",
    TENCENT_BILLING_ENDPOINT: String(env.TENCENT_BILLING_ENDPOINT || "billing.tencentcloudapi.com").trim(),
    TENCENT_BILLING_VERSION: String(env.TENCENT_BILLING_VERSION || "2018-07-09").trim(),
    TENCENT_BILLING_MAX_PAGES: Math.max(1, Number(env.TENCENT_BILLING_MAX_PAGES || 20)),
    TENCENT_BILLING_PAGE_SIZE: Math.min(100, Math.max(1, Number(env.TENCENT_BILLING_PAGE_SIZE || 100))),
    L3_EXACT_WAIT_MINUTES: Math.max(0, Number(env.L3_EXACT_WAIT_MINUTES || 120)),
    TENCENT_PRICE_ENABLED: String(env.TENCENT_PRICE_ENABLED || "0") === "1",
    TENCENT_CVM_ENDPOINT: String(env.TENCENT_CVM_ENDPOINT || "cvm.tencentcloudapi.com").trim(),
    TENCENT_CVM_VERSION: String(env.TENCENT_CVM_VERSION || "2017-03-12").trim(),
    TENCENT_PRICE_IMAGE_ID,
    TENCENT_PRICE_IMAGE_CONFIGURED: Boolean(String(env.TENCENT_PRICE_IMAGE_ID || "").trim()),
    TENCENT_PRICE_IMAGE_SOURCE: env.TENCENT_PRICE_IMAGE_ID ? "env" : "siliconvalley_ubuntu_22_04_fallback",
    TENCENT_PLAN_DISCOVERY_ENABLED: String(env.TENCENT_PLAN_DISCOVERY_ENABLED || "").trim() === "1",
    TENCENT_PLAN_DISCOVERY_ZONES: String(env.TENCENT_PLAN_DISCOVERY_ZONES || "").trim(),
    TENCENT_PLAN_DISCOVERY_CHARGE_TYPE: String(env.TENCENT_PLAN_DISCOVERY_CHARGE_TYPE || "POSTPAID_BY_HOUR").trim(),
    TENCENT_PLAN_DISCOVERY_MAX: Number(env.TENCENT_PLAN_DISCOVERY_MAX || 80),
    SERVER_PLAN_CACHE_TTL_MS: Math.max(0, Number(env.SERVER_PLAN_CACHE_TTL_MS || 300000)),
    TENCENT_COS_BILL_BUCKET: String(env.TENCENT_COS_BILL_BUCKET || "opl-1410708315").trim(),
    TENCENT_COS_BILL_REGION: String(env.TENCENT_COS_BILL_REGION || TENCENT_CLOUD_REGION).trim(),
    TENCENT_COS_BILL_PREFIX: Object.prototype.hasOwnProperty.call(env, "TENCENT_COS_BILL_PREFIX")
      ? String(env.TENCENT_COS_BILL_PREFIX || "").trim()
      : "daily/",
    TENCENT_COS_BILL_ENDPOINT: String(env.TENCENT_COS_BILL_ENDPOINT || "").trim(),
    TENCENT_COS_SECRET_ID: String(env.TENCENT_COS_SECRET_ID || env.TENCENT_COS_BILL_SECRET_ID || "").trim(),
    TENCENT_COS_SECRET_KEY: String(env.TENCENT_COS_SECRET_KEY || env.TENCENT_COS_BILL_SECRET_KEY || "").trim(),
    SERVER_PLAN_CATALOG_JSON,
    PORTAL_STORAGE_MODE: String(env.PORTAL_STORAGE_MODE || "postgres_redis").trim().toLowerCase(),
    PORTAL_POSTGRES_URL: env.PORTAL_POSTGRES_URL || "postgres://postgres:postgres@127.0.0.1:5432/med_meta",
    PORTAL_DB_NAMESPACE: env.PORTAL_DB_NAMESPACE || "portal",
    cliArgs,
  };

  config.BILLING_RECONCILE_COMMAND = new Set(["reconcile", "billing-reconcile"]).has(cliArgs.command) || BILLING_RECONCILE_ONCE;
  config.BILLING_RECONCILE_TARGET = {
    customerId: cliArgs.options.customerId || BILLING_RECONCILE_CUSTOMER_ID,
    workspaceId: cliArgs.options.workspaceId || BILLING_RECONCILE_WORKSPACE_ID,
    window: cliArgs.options.window || BILLING_RECONCILE_WINDOW,
    l3ExactWaitMinutes: config.L3_EXACT_WAIT_MINUTES,
  };

  return config;
}
