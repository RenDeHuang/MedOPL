import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createReconcileService,
  isCompletedRun,
  systemLedgerEntriesForRun,
} from "./reconcile-service.mjs";
import { readFile, readdir, stat, mkdir, appendFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { readBillingRuntimeConfig } from "./billing-config.mjs";
import { buildCosBillReader } from "./cos-bill-reader.mjs";
import { createCosBillingRuntime } from "./cos-billing-runtime.mjs";
import { createPortalStateStore } from "./portal-state-store.mjs";
import {
  cloudErrorMessage,
  createTencentCloudClient,
  sanitizeCloudError,
} from "./tencent-cloud-client.mjs";
import { createServerPlansService } from "./server-plans-service.mjs";
import { createBillingSummaryRuntime } from "./billing-summary-runtime.mjs";
import { createBillingMeteringRuntime } from "./billing-metering-runtime.mjs";
import { createTencentBillingRuntime } from "./tencent-billing-runtime.mjs";
import { createBillingServerRuntime } from "./billing-server-runtime.mjs";
import { createBillingHttpHandler } from "./http-routes.mjs";
import { createBillingWebServer } from "./billing-web-entry.mjs";
import {
  buildUnattributedSummary,
  firstNumber,
  firstString,
  normalizeTencentBillRow,
  normalizeTags,
  summaryFromTencentBillRows,
  zeroTotals,
} from "./tencent-bill-summary.mjs";
import { applyResourceAttributionToRows } from "./resource-attribution.mjs";

const config = readBillingRuntimeConfig();
const {
  PORT,
  OPENCOST_BASE_URL,
  CPU_CORE_HOUR_RATE,
  GPU_HOUR_RATE,
  STORAGE_GB_DAY_RATE,
  DEFAULT_CPU_CORES,
  DEFAULT_GPU_COUNT,
  AUTO_RECONCILE_ENABLED,
  AUTO_RECONCILE_INTERVAL_MS,
  AUTO_RECONCILE_WINDOW,
  BILLING_RECONCILE_COMMAND,
  BILLING_RECONCILE_TARGET,
  RESOURCE_PROVISIONER_URL,
  RESOURCE_PROVISIONER_TIMEOUT_MS,
  TENCENT_CLOUD_SECRET_ID,
  TENCENT_CLOUD_SECRET_KEY,
  TENCENT_CLOUD_TOKEN,
  TENCENT_CLOUD_REGION,
  TENCENT_BILLING_ENABLED,
  TENCENT_BILLING_REQUIRED,
  TENCENT_BILLING_ENDPOINT,
  TENCENT_BILLING_VERSION,
  TENCENT_BILLING_MAX_PAGES,
  TENCENT_BILLING_PAGE_SIZE,
  L3_EXACT_WAIT_MINUTES,
  TENCENT_PRICE_ENABLED,
  TENCENT_CVM_ENDPOINT,
  TENCENT_CVM_VERSION,
  TENCENT_PRICE_IMAGE_ID,
  TENCENT_PRICE_IMAGE_CONFIGURED,
  TENCENT_PRICE_IMAGE_SOURCE,
  TENCENT_PLAN_DISCOVERY_ENABLED,
  TENCENT_PLAN_DISCOVERY_ZONES,
  TENCENT_PLAN_DISCOVERY_CHARGE_TYPE,
  TENCENT_PLAN_DISCOVERY_MAX,
  SERVER_PLAN_CACHE_TTL_MS,
  TENCENT_COS_BILL_BUCKET,
  TENCENT_COS_BILL_REGION,
  TENCENT_COS_BILL_PREFIX,
  TENCENT_COS_BILL_ENDPOINT,
  TENCENT_COS_SECRET_ID,
  TENCENT_COS_SECRET_KEY,
  SERVER_PLAN_CATALOG_JSON,
  PORTAL_STORAGE_MODE,
  PORTAL_POSTGRES_URL,
  PORTAL_DB_NAMESPACE,
  cliArgs,
} = config;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.env.BILLING_REPO_ROOT || path.resolve(__dirname, "../../../"));
const portalDbFile = path.join(repoRoot, ".runtime", "portal", "portal-db.json");
const medRunsRoot = path.join(repoRoot, ".runtime", "med-autoscience", "runs");
const medWorkspacesRoot = path.join(repoRoot, ".runtime", "med-autoscience", "workspaces");
const codexRuntimeEventsFile = path.join(repoRoot, ".runtime", "codex-runtime-gateway", "events.jsonl");
const runtimeRoot = path.join(repoRoot, ".runtime", "billing-aggregator");
const reconcileEventsFile = path.join(runtimeRoot, "events.jsonl");
const TENCENT_REQUIRED_COST_TAGS = ["resource_order_id", "run_id", "server_plan_id", "tenant_id", "workspace_id"];
const TENCENT_COST_TAG_ALIASES = {
  resource_order_id: ["resourceorderid", "resource-order-id"],
  run_id: ["runid", "run-id"],
  server_plan_id: ["serverplanid", "server-plan-id"],
  tenant_id: ["tenantid", "tenant-id"],
  workspace_id: ["workspaceid", "workspace-id"],
};

let billingSummaryRuntimeApi = null;
async function fetchExactSummary(...args) {
  if (!billingSummaryRuntimeApi?.fetchExactSummary) {
    throw new Error("billing summary runtime not initialized");
  }
  return billingSummaryRuntimeApi.fetchExactSummary(...args);
}

const cosBillReader = buildCosBillReader({
  bucket: TENCENT_COS_BILL_BUCKET,
  region: TENCENT_COS_BILL_REGION,
  prefix: TENCENT_COS_BILL_PREFIX,
  endpoint: TENCENT_COS_BILL_ENDPOINT,
  secretId: TENCENT_COS_SECRET_ID || TENCENT_CLOUD_SECRET_ID,
  secretKey: TENCENT_COS_SECRET_KEY || TENCENT_CLOUD_SECRET_KEY,
});
const tencentCloudClient = createTencentCloudClient({
  secretId: TENCENT_CLOUD_SECRET_ID,
  secretKey: TENCENT_CLOUD_SECRET_KEY,
  token: TENCENT_CLOUD_TOKEN,
});

function firstNonEmpty(...values) {
  return values
    .map((value) => String(value ?? "").trim().replace(/^"(.*)"$/s, "$1").trim())
    .find((value) => value && value !== "-" && value.toLowerCase() !== "null" && value.toLowerCase() !== "n/a") || "";
}

function moneyNumber(value, fallback = 0) {
  const normalized = String(value ?? "").trim().replace(/,/g, "");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function billTagValue(row = {}, key = "") {
  const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
  const tagKeys = [
    key,
    ...(TENCENT_COST_TAG_ALIASES[key] || []),
    camel,
    pascal,
    `tag:${key}`,
    `Tag:${key}`,
    `tag_${key}`,
    `Tag_${key}`,
  ];
  for (const alias of TENCENT_COST_TAG_ALIASES[key] || []) {
    tagKeys.push(`标签键:${alias}`, `标签:${alias}`, `标签键:${alias.toLowerCase()}`, `标签:${alias.toLowerCase()}`);
  }
  tagKeys.push(`标签键:${key}`, `标签:${key}`, `标签键:${camel}`, `标签:${camel}`, `标签键:${pascal}`, `标签:${pascal}`);
  for (const candidate of tagKeys) {
    const value = firstNonEmpty(row[candidate], row.tags?.[candidate], row.Tags?.[candidate], row.tags?.[key], row.Tags?.[key]);
    if (value) return value;
  }
  return "";
}

function rowHasRequiredCostTags(row = {}) {
  return TENCENT_REQUIRED_COST_TAGS.every((key) => Boolean(billTagValue(row, key)));
}

function normalizeCosBillRow(row = {}) {
  const totalCost = moneyNumber(firstNonEmpty(
    row.totalCost,
    row.TotalCost,
    row.RealTotalCost,
    row.realTotalCost,
    row.Cost,
    row.cost,
    row["优惠后总价(元)"],
    row["现金支付(元)"],
    row["原价(元)"],
  ));
  return {
    ...row,
    totalCost,
    resourceOrderId: billTagValue(row, "resource_order_id"),
    runId: billTagValue(row, "run_id"),
    serverPlanId: billTagValue(row, "server_plan_id"),
    tenantId: billTagValue(row, "tenant_id"),
    workspaceId: billTagValue(row, "workspace_id"),
    attributed: rowHasRequiredCostTags(row),
    pricingSource: "tencent_cos_daily_bill",
  };
}

const {
  buildCosBillStatus,
  normalizeCosTarget,
  cosReaderForTarget,
  parseCosBillTarget,
  fetchProvisionResourceMappings,
  normalizeCosBillRowsWithAttribution,
  buildCosBillFilesPayload,
  buildCosBillReconcilePayload,
  fetchCosExactSummary,
  buildAttributionPayload,
  collectAttributionItems,
} = createCosBillingRuntime({
  cosBillReader,
  buildCosBillReader,
  cosConfig: {
    bucket: TENCENT_COS_BILL_BUCKET,
    region: TENCENT_COS_BILL_REGION,
    prefix: TENCENT_COS_BILL_PREFIX,
    endpoint: TENCENT_COS_BILL_ENDPOINT,
    secretId: TENCENT_COS_SECRET_ID || TENCENT_CLOUD_SECRET_ID,
    secretKey: TENCENT_COS_SECRET_KEY || TENCENT_CLOUD_SECRET_KEY,
  },
  firstNonEmpty,
  normalizeCosBillRow,
  summaryFromTencentBillRows,
  applyResourceAttributionToRows,
  requiredCostTags: TENCENT_REQUIRED_COST_TAGS,
  fetchImpl: fetch,
  resourceProvisionerUrl: RESOURCE_PROVISIONER_URL,
  resourceProvisionerTimeoutMs: RESOURCE_PROVISIONER_TIMEOUT_MS,
  fetchExactSummary,
});

const portalStateStore = createPortalStateStore({
  mode: PORTAL_STORAGE_MODE,
  postgresUrl: PORTAL_POSTGRES_URL,
  namespace: PORTAL_DB_NAMESPACE,
  jsonFile: portalDbFile,
});

const cloudRuntimeState = {
  lastDiscoveryAt: "",
  lastDiscoveryError: null,
  lastQuoteAt: "",
  lastQuoteError: null,
  lastBillQueryAt: "",
  lastBillQueryError: null,
};
let serverPlanCache = {
  expiresAt: 0,
  payload: null,
};

function tencentCloudConfigured() {
  return tencentCloudClient.configured();
}

function parseJsonEnv(raw, fallback) {
  if (!String(raw || "").trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const callTencentCloud = tencentCloudClient.callTencentCloud;

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

async function exists(file) {
  return stat(file).then(() => true, () => false);
}

const readPortalDb = portalStateStore.readPortalDb;
const writePortalDb = portalStateStore.writePortalDb;

async function logRuntimeEvent(event) {
  await mkdir(runtimeRoot, { recursive: true });
  await appendFile(reconcileEventsFile, `${JSON.stringify({ occurredAt: new Date().toISOString(), ...event })}\n`, "utf8");
}

const billingMeteringRuntime = createBillingMeteringRuntime({
  paths: {
    codexRuntimeEventsFile,
    medRunsRoot,
    medWorkspacesRoot,
  },
  rates: {
    CPU_CORE_HOUR_RATE,
    GPU_HOUR_RATE,
    STORAGE_GB_DAY_RATE,
    DEFAULT_CPU_CORES,
    DEFAULT_GPU_COUNT,
  },
  deps: {
    exists,
    isCompletedRun,
    path,
    randomUUID,
    readFile,
    readdir,
    stat,
  },
});
const {
  asEntries,
  completionTimestamp,
  pendingRequestedRunCosts,
  readRuns,
  summaryFromPendingRuns,
  summaryFromRawAllocations,
  summarize,
} = billingMeteringRuntime;

async function fetchAllocation(windowValue, aggregateValue = "") {
  if (!OPENCOST_BASE_URL) {
    throw new Error("Missing OPENCOST_BASE_URL");
  }

  const url = new URL("/allocation", OPENCOST_BASE_URL);
  url.searchParams.set("window", windowValue || "7d");
  if (aggregateValue) {
    url.searchParams.set("aggregate", aggregateValue);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenCost request failed with status ${response.status}`);
  }

  return response.json();
}

const { fetchTencentBillSummary } = createTencentBillingRuntime({
  env: {
    TENCENT_BILLING_ENABLED,
    TENCENT_BILLING_ENDPOINT,
    TENCENT_BILLING_MAX_PAGES,
    TENCENT_BILLING_PAGE_SIZE,
    TENCENT_BILLING_VERSION,
    TENCENT_CLOUD_REGION,
    L3_EXACT_WAIT_MINUTES,
  },
  deps: {
    callTencentCloud,
    normalizeTencentBillRow,
    applyResourceAttributionToRows,
    fetchProvisionResourceMappings,
    summaryFromTencentBillRows,
  },
});

const billingSummaryRuntime = createBillingSummaryRuntime({
  env: {
    TENCENT_BILLING_ENABLED,
    TENCENT_BILLING_REQUIRED,
    OPENCOST_BASE_URL,
  },
  deps: {
    buildUnattributedSummary,
    zeroTotals,
    fetchAllocation,
    fetchTencentBillSummary,
    fetchCosExactSummary,
    normalizeCosTarget,
    summarize,
    asEntries,
    summaryFromRawAllocations,
    pendingRequestedRunCosts,
    summaryFromPendingRuns,
    onExactBillSuccess: () => {
      markCloudState("bill");
    },
    onExactBillError: (error) => {
      markCloudState("bill", error);
    },
  },
});
billingSummaryRuntimeApi = billingSummaryRuntime;
const {
  buildUnavailableSummary,
  buildBillingEnvelope,
  fetchPendingSummary,
} = billingSummaryRuntime;

const serverPlansService = createServerPlansService({
  env: {
    SERVER_PLAN_CATALOG_JSON,
    SERVER_PLAN_CACHE_TTL_MS,
    TENCENT_CLOUD_REGION,
    TENCENT_CLOUD_TOKEN,
    TENCENT_PRICE_ENABLED,
    TENCENT_PRICE_IMAGE_ID,
    TENCENT_PRICE_IMAGE_CONFIGURED,
    TENCENT_PRICE_IMAGE_SOURCE,
    TENCENT_PLAN_DISCOVERY_ENABLED,
    TENCENT_PLAN_DISCOVERY_ZONES,
    TENCENT_PLAN_DISCOVERY_CHARGE_TYPE,
    TENCENT_PLAN_DISCOVERY_MAX,
    TENCENT_CVM_ENDPOINT,
    TENCENT_CVM_VERSION,
    TENCENT_BILLING_ENABLED,
    TENCENT_BILLING_REQUIRED,
    TENCENT_BILLING_ENDPOINT,
    OPENCOST_BASE_URL,
  },
  deps: {
    firstString,
    firstNumber,
    sanitizeCloudError,
    cloudErrorMessage,
    tencentCloudConfigured,
    callTencentCloud,
    randomUUID,
  },
  state: {
    cloudRuntimeState,
    serverPlanCache,
  },
});
const {
  buildTencentCloudStatus,
  listServerPlans,
  markCloudState,
  serverPlanCatalog,
} = serverPlansService;

const runReconcileCharges = createReconcileService({
  buildUnattributedSummary,
  fetchExactSummary,
  l3ExactWaitMinutes: L3_EXACT_WAIT_MINUTES,
  logRuntimeEvent,
  readPortalDb,
  readRuns,
  writePortalDb,
});

const billingServerRuntime = createBillingServerRuntime({
  env: {
    AUTO_RECONCILE_ENABLED,
    AUTO_RECONCILE_INTERVAL_MS,
    AUTO_RECONCILE_WINDOW,
  },
  deps: {
    buildUnavailableSummary,
    buildUnattributedSummary,
    completionTimestamp,
    fetchExactSummary,
    fetchPendingSummary,
    isCompletedRun,
    logRuntimeEvent,
    readPortalDb,
    readRuns,
    runReconcileCharges,
    systemLedgerEntriesForRun,
  },
});
const {
  getReconcileState,
  listPendingRuns,
  printCliUsage,
  reconcileCharges,
  runSingleReconcile,
  scheduleAutoReconcileLoop,
} = billingServerRuntime;

const billingHttpHandler = createBillingHttpHandler({
  config: {
    OPENCOST_BASE_URL,
    TENCENT_BILLING_ENABLED,
    TENCENT_BILLING_REQUIRED,
    TENCENT_PRICE_ENABLED,
    TENCENT_CLOUD_REGION,
    AUTO_RECONCILE_ENABLED,
    AUTO_RECONCILE_INTERVAL_MS,
    AUTO_RECONCILE_WINDOW,
  },
  deps: {
    sendJson,
    buildTencentCloudStatus,
    serverPlanCatalog,
    tencentCloudConfigured,
    buildCosBillStatus,
    cosBillReader,
    buildCosBillFilesPayload,
    buildCosBillReconcilePayload,
    normalizeCosTarget,
    collectAttributionItems,
    buildAttributionPayload,
    listServerPlans,
    cloudErrorMessage,
    reconcileCharges,
    getReconcileState,
    listPendingRuns,
  },
});

const server = createBillingWebServer({
  handleBillingHttpRoute: billingHttpHandler,
  fetchExactSummary,
  buildUnavailableSummary,
  fetchPendingSummary,
  buildBillingEnvelope,
  buildUnattributedSummary,
  sendJson,
});

if (cliArgs.options.help) {
  printCliUsage();
  process.exit(0);
}

if (BILLING_RECONCILE_COMMAND) {
  runSingleReconcile({
    customerId: BILLING_RECONCILE_TARGET.customerId,
    workspaceId: BILLING_RECONCILE_TARGET.workspaceId,
    windowValue: BILLING_RECONCILE_TARGET.window,
    target: BILLING_RECONCILE_TARGET,
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(getReconcileState().lastError ? 1 : 0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  server.listen(PORT, () => {
    console.log(`billing-aggregator listening on :${PORT}`);
  });
  scheduleAutoReconcileLoop();
}
