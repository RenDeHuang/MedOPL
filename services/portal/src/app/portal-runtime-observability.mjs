import { listCanonicalResourcePlans } from "../domain/lab-packages.mjs";
import { normalizeLedgerEntries } from "../domain/wallet-ledger.mjs";

const COST_LEDGER_TYPES = new Set([
  "pending_usage",
  "exact_resource_charge",
  "makeup_charge",
  "subscription_daily_charge",
]);

function text(value = "") {
  return String(value ?? "").trim();
}

function parseHourWindow(value = "") {
  const match = /^(\d+)h$/u.exec(text(value));
  if (!match) return null;
  const hours = Number(match[1]);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

function withinHourWindow(isoString = "", hours = null, now = Date.now()) {
  if (!hours) return true;
  const timestamp = Date.parse(text(isoString));
  if (!Number.isFinite(timestamp)) return false;
  return timestamp >= now - hours * 60 * 60 * 1000;
}

function entryMatchesScope(entry = {}, { customerId = "", workspaceId = "" } = {}) {
  const targetCustomerId = text(customerId);
  const targetWorkspaceId = text(workspaceId);
  if (targetCustomerId) {
    const customerMatches = [
      entry.userId,
      entry.tenantId,
      entry.accountId,
      entry.billingAccountId,
    ].some((value) => text(value) === targetCustomerId);
    if (!customerMatches) return false;
  }
  if (targetWorkspaceId && text(entry.workspaceId) !== targetWorkspaceId) return false;
  return true;
}

function costSplitFor(entry = {}) {
  const amount = Math.abs(Number(entry.amount || 0));
  const basis = `${entry.sourceType || ""} ${entry.reason || ""}`.toLowerCase();
  if (basis.includes("storage") || basis.includes("file") || basis.includes("cos")) {
    return { cpuCost: 0, gpuCost: 0, pvCost: amount, totalCost: amount };
  }
  return { cpuCost: amount, gpuCost: 0, pvCost: 0, totalCost: amount };
}

function billingItemFromLedgerEntry(entry = {}) {
  const split = costSplitFor(entry);
  const pricingSource = entry.type === "pending_usage" ? "platform_metering_projection" : "portal_billing_ledger";
  const name = text(entry.runId || entry.resourceBindingId || entry.sourceId || entry.id);
  const properties = {
    "label:run_id": text(entry.runId),
    "label:workspace_id": text(entry.workspaceId),
    "label:customer_id": text(entry.userId || entry.tenantId),
    "label:tenant_id": text(entry.tenantId || entry.userId),
    "label:resource_binding_id": text(entry.resourceBindingId),
    "label:billing_attribution_id": text(entry.billingAttributionId),
    "label:account_id": text(entry.accountId || entry.billingAccountId || entry.userId),
    "label:server_plan_id": text(entry.serverPlanId),
    "label:pricing_source": pricingSource,
    run_id: text(entry.runId),
    workspace_id: text(entry.workspaceId),
    customer_id: text(entry.userId || entry.tenantId),
    tenant_id: text(entry.tenantId || entry.userId),
    resource_binding_id: text(entry.resourceBindingId),
    billing_attribution_id: text(entry.billingAttributionId),
    account_id: text(entry.accountId || entry.billingAccountId || entry.userId),
    server_plan_id: text(entry.serverPlanId),
    pricing_source: pricingSource,
  };
  return {
    id: entry.id,
    name,
    runId: text(entry.runId),
    workspaceId: text(entry.workspaceId),
    customerId: text(entry.userId || entry.tenantId),
    resourceBindingId: text(entry.resourceBindingId),
    billingAttributionId: text(entry.billingAttributionId),
    accountId: text(entry.accountId || entry.billingAccountId || entry.userId),
    serverPlanId: text(entry.serverPlanId),
    start: text(entry.createdAt),
    end: text(entry.createdAt),
    createdAt: text(entry.createdAt),
    pricingSource,
    status: entry.type === "pending_usage" ? "pending" : "settled",
    properties,
    ...split,
  };
}

function billingTotals(items = []) {
  return items.reduce((acc, item) => {
    acc.cpuCost += Number(item.cpuCost || 0);
    acc.gpuCost += Number(item.gpuCost || 0);
    acc.pvCost += Number(item.pvCost || item.storageCost || 0);
    acc.totalCost += Number(item.totalCost || 0);
    return acc;
  }, { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 });
}

function canonicalServerPlanItem(plan = {}) {
  return {
    id: plan.id,
    name: plan.name || plan.id,
    cpu: Number(plan.compute?.cpuCores || 0),
    memoryGb: Number(plan.compute?.memoryGb || 0),
    gpu: 0,
    gpuCount: 0,
    storageRequest: `${Number(plan.storage?.capacityGb || 0)}Gi`,
    storageLimit: `${Number(plan.storage?.capacityGb || 0)}Gi`,
    minBillableHours: 1,
    riskFactor: 1,
    reservationFloor: 0,
    currency: "CNY",
    hourlyPrice: 0,
    originalPrice: 0,
    unitPrice: 0,
    discountPrice: 0,
    quoteAmount: 0,
    preauthAmount: 0,
    priceOrigin: "platform_catalog",
    priceStatus: "catalog_price",
    catalogSource: "platform_catalog",
    region: plan.region || "",
    zone: plan.zone || "",
    availabilityCategory: "available",
    availabilityStatus: "available",
    statusCategory: "available",
    unavailableReason: "",
    isPurchasable: true,
    isSelectable: true,
    provisioningMode: "platform_provisioned_runtime",
    selectionNote: "平台根据套餐开通客户专属运行环境、文件空间与计费绑定。",
    priceUpdatedAt: "",
  };
}

function platformServerPlansPayload() {
  const items = listCanonicalResourcePlans().map(canonicalServerPlanItem);
  return {
    ok: true,
    source: "platform_billing_ledger",
    catalogSource: "platform_catalog",
    configured: true,
    priceEnabled: false,
    catalogCount: items.length,
    candidateCount: items.length,
    purchasableCount: items.length,
    selectableCount: items.length,
    availabilitySyncEnabled: false,
    availabilitySnapshotCount: 0,
    availabilityBreakdown: { available: items.length },
    items,
    note: "套餐目录来自 Portal monolith 平台套餐目录；客户售卖价仍等待产品审批。",
    catalogRuntimeStatus: {
      status: "ready",
      catalogSource: "platform_catalog",
      catalogCount: items.length,
      candidateCount: items.length,
    },
    pricingSourceStatus: {
      status: "catalog_price",
      priceOrigin: "platform_catalog",
      quotedCount: 0,
      pendingSource: "platform_metering_projection",
    },
  };
}

export function createPortalRuntimeObservability({
  codexRuntimeEventsFile,
  codexRuntimeRoot,
  harborRegistryClient,
  langfuseTraceClient,
  minioStorageClient,
  runtimeBridgeClient,
  path,
  readDb,
  readFile,
  readdir,
} = {}) {
  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function readBillingRequestOptions(url) {
    return {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      pageSize: url.searchParams.get("page_size"),
      tasksPage: url.searchParams.get("tasks_page"),
      ledgerPage: url.searchParams.get("ledger_page"),
      runsPage: url.searchParams.get("runs_page"),
    };
  }

  function readOverviewRequestOptions(url) {
    return {
      tasksPage: url.searchParams.get("tasks_page"),
      runsPage: url.searchParams.get("runs_page"),
    };
  }

  function readSessionsRequestOptions(url) {
    return {
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("page_size"),
      limit: url.searchParams.get("limit"),
    };
  }

  function readTracesRequestOptions(url) {
    return {
      userId: url.searchParams.get("userId"),
      workspaceId: url.searchParams.get("workspaceId"),
      runId: url.searchParams.get("runId"),
      messageId: url.searchParams.get("messageId"),
      sessionId: url.searchParams.get("sessionId"),
      status: url.searchParams.get("status"),
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("page_size"),
      limit: url.searchParams.get("limit"),
    };
  }

  async function fetchBillingSummary(customerId, workspaceId = "", windowValue = "24h") {
    const db = await readDb();
    const hours = parseHourWindow(windowValue);
    const items = normalizeLedgerEntries(db.ledger || [])
      .filter((entry) => COST_LEDGER_TYPES.has(entry.type))
      .filter((entry) => entryMatchesScope(entry, { customerId, workspaceId }))
      .filter((entry) => withinHourWindow(entry.createdAt, hours))
      .map(billingItemFromLedgerEntry);
    return {
      ok: true,
      source: "portal_billing_ledger",
      cloudSource: "platform_metering_projection",
      window: windowValue,
      customerId: text(customerId),
      workspaceId: text(workspaceId),
      totals: billingTotals(items),
      totalCost: billingTotals(items).totalCost,
      items,
    };
  }

  async function fetchPendingSummary(customerId = "", workspaceId = "", windowValue = "168h") {
    const db = await readDb();
    const hours = parseHourWindow(windowValue);
    const now = Date.now();
    const pendingEntries = normalizeLedgerEntries(db.ledger || [])
      .filter((entry) => entry.type === "pending_usage")
      .filter((entry) => entryMatchesScope(entry, { customerId, workspaceId }))
      .filter((entry) => withinHourWindow(entry.createdAt, hours, now));
    const runs = pendingEntries.map((entry) => {
      const createdAt = text(entry.createdAt);
      const timestamp = Date.parse(createdAt);
      const pendingHours = Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / 3600000) : 0;
      return {
        runId: text(entry.runId || entry.sourceId || entry.id),
        customerId: text(entry.userId || entry.tenantId),
        workspaceId: text(entry.workspaceId),
        resourceBindingId: text(entry.resourceBindingId),
        billingAttributionId: text(entry.billingAttributionId),
        completedAt: createdAt,
        createdAt,
        pendingHours,
        totalCost: Math.abs(Number(entry.amount || 0)),
        pricingSource: "platform_metering_projection",
      };
    });
    const items = pendingEntries.map(billingItemFromLedgerEntry);
    return {
      ok: true,
      source: "portal_billing_ledger",
      pendingCount: runs.length,
      oldestPendingHours: runs.reduce((max, run) => Math.max(max, Number(run.pendingHours || 0)), 0),
      totals: billingTotals(items),
      totalCost: billingTotals(items).totalCost,
      runs,
      riskByUser: [],
      riskByWorkspace: [],
    };
  }

  async function fetchBillingStatus() {
    const db = await readDb();
    const ledger = normalizeLedgerEntries(db.ledger || []);
    const pending = ledger.filter((entry) => entry.type === "pending_usage");
    const exact = ledger.filter((entry) => entry.type === "exact_resource_charge" || entry.type === "makeup_charge");
    return {
      ok: true,
      source: "portal_billing_ledger",
      configured: true,
      mode: "monolith_projection",
      autoReconcileEnabled: false,
      autoReconcileWindow: "168h",
      tencentBillingEnabled: false,
      tencentCloudConfigured: false,
      exactSources: ["portal_billing_ledger", "tencent_cloud_bill"],
      pendingSources: ["platform_metering_projection"],
      reconcileState: {
        lastRunAt: "",
        lastScope: "local_projection",
        lastReconciledCount: exact.length,
        lastExactCount: exact.length,
        lastEstimatedCount: pending.length,
        lastAdjustmentCount: ledger.filter((entry) => entry.type === "refund" || entry.type === "makeup_charge").length,
        lastError: "",
      },
    };
  }

  async function fetchServerPlans() {
    return platformServerPlansPayload();
  }

  async function fetchMinioSummary() {
    return minioStorageClient.fetchSummary();
  }

  async function fetchHarborSummary() {
    return harborRegistryClient.fetchSummary();
  }

  async function fetchLangfuseSummary() {
    return langfuseTraceClient.fetchSummary();
  }

  async function fetchTraceRows({ userId = "", workspaceId = "", runId = "", limit = 20 } = {}) {
    return langfuseTraceClient.fetchTraceRows({ userId, workspaceId, runId, limit });
  }

  async function fetchRuntimeBridgeRuns() {
    return runtimeBridgeClient.fetchRuns();
  }

  async function fetchRuntimeBridgeTraceRows({ userId = "", workspaceId = "", runId = "", limit = 200 } = {}) {
    return runtimeBridgeClient.fetchTraceRows({ userId, workspaceId, runId, limit });
  }

  async function fetchRuntimeBridgeCosts({ userId = "", workspaceId = "", runId = "" } = {}) {
    return runtimeBridgeClient.fetchCosts({ userId, workspaceId, runId });
  }

  function workspaceChatSessionsForUser(db, user, limit = 20) {
    return (db.workspaceSessions || [])
      .filter((item) => item.userId === user.id)
      .sort((a, b) => String(b.lastUsedAt || b.createdAt || "").localeCompare(String(a.lastUsedAt || a.createdAt || "")))
      .slice(0, limit)
      .map((item) => ({
        sessionId: item.id,
        sessionType: "mas",
        source: "portal_workspace_sessions",
        type: "live",
        userId: item.userId,
        userName: user.name || user.email || "",
        email: user.email || "",
        workspaceId: item.workspaceId || "",
        workspaceSessionId: item.id,
        lastUsedAt: item.lastUsedAt || item.createdAt || "",
        expiresAt: item.expiresAt || "",
        status: item.status || "unknown",
      }));
  }

  async function probe(url) {
    if (!url) return { ok: false, status: "未配置" };
    const startedAt = Date.now();
    try {
      const response = await fetch(url, { redirect: "manual" });
      return { ok: true, status: String(response.status), responseMs: Date.now() - startedAt };
    } catch {
      return { ok: false, status: "不可达", responseMs: Date.now() - startedAt };
    }
  }

  async function runtimePerformanceSummary() {
    const runsDir = path.join(codexRuntimeRoot, "sessions");
    let eventRows = [];
    try {
      const raw = await readFile(codexRuntimeEventsFile, "utf8");
      eventRows = raw.split(/\r?\n/).filter(Boolean).slice(-400).map((line) => safeJsonParse(line)).filter(Boolean);
    } catch {}
    let files = [];
    try {
      files = await readdir(runsDir);
    } catch {}
    const metas = [];
    for (const file of files.filter((name) => name.endsWith(".json")).slice(-200)) {
      try {
        const parsed = JSON.parse(await readFile(path.join(runsDir, file), "utf8"));
        metas.push(parsed);
      } catch {}
    }
    const byRunId = new Map(metas.map((item) => [String(item.runId || ""), item]));
    const runtimeEvents = eventRows
      .filter((item) => item.type === "codex_runtime_run")
      .slice()
      .reverse();
    const completed = runtimeEvents.map((item) => {
      const meta = byRunId.get(String(item.runId || ""));
      const startedAt = Date.parse(String(meta?.createdAt || ""));
      const endedAt = Date.parse(String(item.occurredAt || ""));
      const durationMs = Number.isFinite(startedAt) && Number.isFinite(endedAt) ? Math.max(0, endedAt - startedAt) : null;
      return {
        runId: item.runId || "",
        workspaceId: item.workspaceId || "",
        workspaceSessionId: item.workspaceSessionId || "",
        exitCode: typeof item.exitCode === "number" ? item.exitCode : Number(item.exitCode || 0),
        durationMs,
        occurredAt: item.occurredAt || "",
      };
    }).filter((item) => item.durationMs != null);
    const successful = completed.filter((item) => item.exitCode === 0);
    const latestMas = successful.slice(-10);
    const avgMas = latestMas.length ? Math.round(latestMas.reduce((sum, item) => sum + Number(item.durationMs || 0), 0) / latestMas.length) : null;
    const warmups = eventRows.filter((item) => item.type === "codex_runtime_warmup").slice(-20);
    const slowWarmups = warmups.filter((item) => !item.runnerWarmup?.ok || String(item.runnerWarmup?.detail || "").toLowerCase().includes("timeout"));
    return {
      masFirstReplyApproxMs: avgMas,
      latestSuccessfulMasRuns: latestMas.slice(-5).reverse(),
      warmupTimeoutCount: slowWarmups.length,
      totalSuccessfulMasRuns: successful.length,
    };
  }

  return {
    fetchBillingStatus,
    fetchBillingSummary,
    fetchHarborSummary,
    fetchLangfuseSummary,
    fetchMinioSummary,
    fetchRuntimeBridgeCosts,
    fetchRuntimeBridgeRuns,
    fetchRuntimeBridgeTraceRows,
    fetchPendingSummary,
    fetchServerPlans,
    fetchTraceRows,
    probe,
    readBillingRequestOptions,
    readOverviewRequestOptions,
    readSessionsRequestOptions,
    readTracesRequestOptions,
    runtimePerformanceSummary,
    workspaceChatSessionsForUser,
  };
}
