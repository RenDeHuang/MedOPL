async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function roundCents(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function previewBranch(row = {}) {
  const explicit = firstNonEmpty(row.branch, row.action, row.previewBranch);
  if (explicit) return explicit;
  if (row.attributed === false || String(row.attributionState || "").trim() === "unattributed") {
    return "unattributed";
  }
  const totalCost = Number(row.totalCost ?? row.cost ?? 0);
  if (Number.isFinite(totalCost) && totalCost < 0) return "refund";
  return "exact_charge";
}

function previewSourceRows(payload = {}, sourceKey, fallbackKey) {
  const primary = payload[sourceKey];
  if (Array.isArray(primary)) return primary;
  const fallback = payload[fallbackKey];
  return Array.isArray(fallback) ? fallback : [];
}

function buildPreviewRows(payload = {}) {
  const attributedRows = previewSourceRows(payload, "attributedRows", "items")
    .map((row) => ({ ...row, branch: previewBranch({ ...row, attributed: true }) }));
  const unattributedRows = previewSourceRows(payload, "unattributedRows", "unattributed")
    .map((row) => ({ ...row, branch: "unattributed", attributed: false }));
  return {
    rows: [...attributedRows, ...unattributedRows],
    attributedRows,
    unattributedRows,
  };
}

function sumPreviewBranchCents(rows = [], branch, transform = (value) => value) {
  return rows
    .filter((row) => row.branch === branch)
    .reduce((sum, row) => sum + transform(roundCents(row.totalCost)), 0);
}

function previewAmountSummary(attributedRows = []) {
  return {
    wouldChargeCents: sumPreviewBranchCents(attributedRows, "exact_charge", (value) => Math.max(0, value)),
    wouldRefundCents: sumPreviewBranchCents(attributedRows, "refund", Math.abs),
    wouldMakeupCents: sumPreviewBranchCents(attributedRows, "makeup_charge", Math.abs),
  };
}

function withPreviewContract(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  if (!payload.preview) return payload;

  const { rows, attributedRows, unattributedRows } = buildPreviewRows(payload);

  return {
    ...payload,
    rows,
    attributedRows,
    unattributedRows,
    ...previewAmountSummary(attributedRows),
  };
}

function normalizeReconcileTarget(body = {}, normalizeCosTarget = () => ({})) {
  const cosTarget = normalizeCosTarget(body);
  const waitRaw = firstNonEmpty(body.l3ExactWaitMinutes, body.l3_exact_wait_minutes, body.L3_EXACT_WAIT_MINUTES);
  return {
    ...cosTarget,
    tenantId: firstNonEmpty(body.tenantId, body.tenant_id, body.customer_id, body.customerId),
    customerId: firstNonEmpty(body.customerId, body.customer_id, body.tenantId, body.tenant_id),
    workspaceId: firstNonEmpty(body.workspaceId, body.workspace_id),
    resourceOrderId: firstNonEmpty(body.resourceOrderId, body.resource_order_id, body.orderId, body.order_id),
    runId: firstNonEmpty(body.runId, body.run_id),
    serverPlanId: firstNonEmpty(body.serverPlanId, body.server_plan_id),
    billingStartedAt: firstNonEmpty(body.billingStartedAt, body.billing_started_at),
    billingStoppedAt: firstNonEmpty(body.billingStoppedAt, body.billing_stopped_at),
    queryBeginTime: firstNonEmpty(body.queryBeginTime, body.query_begin_time, body.beginTime, body.begin_time),
    queryEndTime: firstNonEmpty(body.queryEndTime, body.query_end_time, body.endTime, body.end_time),
    ...(waitRaw ? { l3ExactWaitMinutes: Number(waitRaw) } : {}),
  };
}

export function createBillingHttpHandler({
  config = {},
  deps = {},
} = {}) {
  const {
    OPENCOST_BASE_URL = "",
    TENCENT_BILLING_ENABLED = false,
    TENCENT_BILLING_REQUIRED = false,
    TENCENT_PRICE_ENABLED = false,
    TENCENT_CLOUD_REGION = "",
    AUTO_RECONCILE_ENABLED = false,
    AUTO_RECONCILE_INTERVAL_MS = 0,
    AUTO_RECONCILE_WINDOW = "",
  } = config;

  const {
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
  } = deps;

  if (typeof sendJson !== "function") throw new Error("sendJson is required");
  if (typeof buildTencentCloudStatus !== "function") throw new Error("buildTencentCloudStatus is required");
  if (typeof serverPlanCatalog !== "function") throw new Error("serverPlanCatalog is required");
  if (typeof tencentCloudConfigured !== "function") throw new Error("tencentCloudConfigured is required");
  if (typeof buildCosBillStatus !== "function") throw new Error("buildCosBillStatus is required");
  if (!cosBillReader || typeof cosBillReader.configured !== "function" || typeof cosBillReader.listFiles !== "function") {
    throw new Error("cosBillReader is required");
  }
  if (typeof buildCosBillFilesPayload !== "function") throw new Error("buildCosBillFilesPayload is required");
  if (typeof buildCosBillReconcilePayload !== "function") throw new Error("buildCosBillReconcilePayload is required");
  if (typeof normalizeCosTarget !== "function") throw new Error("normalizeCosTarget is required");
  if (typeof collectAttributionItems !== "function") throw new Error("collectAttributionItems is required");
  if (typeof buildAttributionPayload !== "function") throw new Error("buildAttributionPayload is required");
  if (typeof listServerPlans !== "function") throw new Error("listServerPlans is required");
  if (typeof cloudErrorMessage !== "function") throw new Error("cloudErrorMessage is required");
  if (typeof reconcileCharges !== "function") throw new Error("reconcileCharges is required");
  if (typeof getReconcileState !== "function") throw new Error("getReconcileState is required");
  if (typeof listPendingRuns !== "function") throw new Error("listPendingRuns is required");

  function currentCloudStatus() {
    return buildTencentCloudStatus({ catalog: serverPlanCatalog() });
  }

  function buildHealthPayload() {
    return {
      ok: true,
      opencostBaseUrl: OPENCOST_BASE_URL || null,
      tencentBillingEnabled: TENCENT_BILLING_ENABLED,
      tencentPriceEnabled: TENCENT_PRICE_ENABLED,
      tencentCloudConfigured: tencentCloudConfigured(),
      cloudStatus: currentCloudStatus(),
    };
  }

  function buildStatusPayload() {
    const cloudStatus = currentCloudStatus();
    return {
      ok: true,
      opencostBaseUrl: OPENCOST_BASE_URL || null,
      exactSources: ["tencent_cloud_bill"],
      pendingSources: ["opencost_pending", "metering_pending"],
      tencentBillingEnabled: TENCENT_BILLING_ENABLED,
      tencentBillingRequired: TENCENT_BILLING_REQUIRED,
      tencentPriceEnabled: TENCENT_PRICE_ENABLED,
      tencentCloudConfigured: tencentCloudConfigured(),
      tencentRegion: TENCENT_CLOUD_REGION,
      credentialsConfigured: cloudStatus.credentialsConfigured,
      priceEnabled: cloudStatus.priceEnabled,
      billingEnabled: cloudStatus.billingEnabled,
      billingRequired: cloudStatus.billingRequired,
      priceImageConfigured: cloudStatus.priceImageConfigured,
      catalogConfigured: cloudStatus.catalogConfigured,
      lastQuoteAt: cloudStatus.lastQuoteAt,
      lastQuoteError: cloudStatus.lastQuoteError,
      lastBillQueryAt: cloudStatus.lastBillQueryAt,
      lastBillQueryError: cloudStatus.lastBillQueryError,
      exactBillingSource: cloudStatus.exactBillingSource,
      pendingSource: cloudStatus.pendingSource,
      serverPlanCatalogCount: serverPlanCatalog().length,
      cloudStatus,
      autoReconcileEnabled: AUTO_RECONCILE_ENABLED,
      autoReconcileIntervalMs: AUTO_RECONCILE_INTERVAL_MS,
      autoReconcileWindow: AUTO_RECONCILE_WINDOW,
      reconcileState: getReconcileState(),
    };
  }

  async function handleHealthRoute(_req, res, url) {
    if (url.pathname !== "/healthz") return false;
    sendJson(res, 200, buildHealthPayload());
    return true;
  }

  async function handleCosStatusRoute(req, res, url) {
    if (req.method !== "GET" || url.pathname !== "/billing/cos/status") return false;
    const status = buildCosBillStatus();
    try {
      const files = cosBillReader.configured() ? await cosBillReader.listFiles({ maxKeys: 5 }) : [];
      sendJson(res, 200, {
        ...status,
        readable: cosBillReader.configured(),
        latestFile: files[0] || null,
        fileCount: files.length,
        lastReadAt: cosBillReader.configured() ? new Date().toISOString() : "",
      });
    } catch (error) {
      sendJson(res, 200, {
        ...status,
        readable: false,
        lastReadAt: new Date().toISOString(),
        error: String(error.message || error),
        errorStatus: error.status || null,
      });
    }
    return true;
  }

  async function handleCosFilesRoute(req, res, url) {
    if (req.method !== "GET" || url.pathname !== "/billing/cos/files") return false;
    sendJson(res, 200, await buildCosBillFilesPayload());
    return true;
  }

  async function handleCosReconcileRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== "/billing/cos/reconcile") return false;
    const body = await parseBody(req);
    const payload = await buildCosBillReconcilePayload(normalizeCosTarget(body));
    sendJson(res, 200, withPreviewContract(payload));
    return true;
  }

  async function handleAttributionRoute(req, res, url) {
    if (req.method !== "GET" || url.pathname !== "/billing/attribution") return false;
    const resourceOrderId = String(url.searchParams.get("resourceOrderId") || url.searchParams.get("resource_order_id") || "").trim();
    const items = await collectAttributionItems(url).catch(() => []);
    sendJson(res, 200, buildAttributionPayload(items, resourceOrderId));
    return true;
  }

  function serverPlanFilters(url) {
    return {
      region: url.searchParams.get("region") || "",
      zone: url.searchParams.get("zone") || "",
      cpu: url.searchParams.get("cpu") || "",
      memoryGb: url.searchParams.get("memoryGb") || url.searchParams.get("memory") || "",
    };
  }

  async function handleServerPlansRoute(req, res, url) {
    if (req.method !== "GET" || url.pathname !== "/server-plans") return false;
    try {
      sendJson(res, 200, await listServerPlans(serverPlanFilters(url)));
    } catch (error) {
      sendJson(res, 502, {
        ok: false,
        error: cloudErrorMessage(error) || "server_plans_unavailable",
        cloudStatus: currentCloudStatus(),
      });
    }
    return true;
  }

  async function handleReconcileRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== "/reconcile") return false;
    try {
      const body = await parseBody(req);
      const result = await reconcileCharges(
        body.customer_id || "",
        body.workspace_id || "",
        body.window || "7d",
        normalizeReconcileTarget(body, normalizeCosTarget),
      );
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return true;
  }

  async function handleStatusRoute(req, res, url) {
    if (req.method !== "GET" || url.pathname !== "/status") return false;
    sendJson(res, 200, buildStatusPayload());
    return true;
  }

  async function handleCloudStatusRoute(req, res, url) {
    if (req.method !== "GET" || url.pathname !== "/cloud/status") return false;
    sendJson(res, 200, {
      ok: true,
      cloudStatus: currentCloudStatus(),
    });
    return true;
  }

  async function handlePendingRoute(req, res, url) {
    if (req.method !== "GET" || url.pathname !== "/pending") return false;
    try {
      const customerId = url.searchParams.get("customer_id") || "";
      const workspaceId = url.searchParams.get("workspace_id") || "";
      const windowValue = url.searchParams.get("window") || "7d";
      sendJson(res, 200, await listPendingRuns(customerId, workspaceId, windowValue));
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return true;
  }

  const routeHandlers = [
    handleHealthRoute,
    handleCosStatusRoute,
    handleCosFilesRoute,
    handleCosReconcileRoute,
    handleAttributionRoute,
    handleServerPlansRoute,
    handleReconcileRoute,
    handleStatusRoute,
    handleCloudStatusRoute,
    handlePendingRoute,
  ];

  return async function handleBillingHttpRoute(req, res) {
    const url = new URL(req.url || "/", "http://local");
    for (const routeHandler of routeHandlers) {
      if (await routeHandler(req, res, url)) return true;
    }
    return false;
  };
}
