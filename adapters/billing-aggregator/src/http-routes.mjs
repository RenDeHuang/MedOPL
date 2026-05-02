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

  return async function handleBillingHttpRoute(req, res) {
    const url = new URL(req.url || "/", "http://local");

    if (url.pathname === "/healthz") {
      sendJson(res, 200, buildHealthPayload());
      return true;
    }

    if (req.method === "GET" && url.pathname === "/billing/cos/status") {
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

    if (req.method === "GET" && url.pathname === "/billing/cos/files") {
      sendJson(res, 200, await buildCosBillFilesPayload());
      return true;
    }

    if (req.method === "POST" && url.pathname === "/billing/cos/reconcile") {
      const body = await parseBody(req);
      sendJson(res, 200, await buildCosBillReconcilePayload(normalizeCosTarget(body)));
      return true;
    }

    if (req.method === "GET" && url.pathname === "/billing/attribution") {
      const resourceOrderId = String(url.searchParams.get("resourceOrderId") || url.searchParams.get("resource_order_id") || "").trim();
      const items = await collectAttributionItems(url).catch(() => []);
      sendJson(res, 200, buildAttributionPayload(items, resourceOrderId));
      return true;
    }

    if (req.method === "GET" && url.pathname === "/server-plans") {
      try {
        sendJson(res, 200, await listServerPlans({
          region: url.searchParams.get("region") || "",
          zone: url.searchParams.get("zone") || "",
          cpu: url.searchParams.get("cpu") || "",
          memoryGb: url.searchParams.get("memoryGb") || url.searchParams.get("memory") || "",
        }));
      } catch (error) {
        sendJson(res, 502, {
          ok: false,
          error: cloudErrorMessage(error) || "server_plans_unavailable",
          cloudStatus: currentCloudStatus(),
        });
      }
      return true;
    }

    if (req.method === "POST" && url.pathname === "/reconcile") {
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

    if (req.method === "GET" && url.pathname === "/status") {
      sendJson(res, 200, buildStatusPayload());
      return true;
    }

    if (req.method === "GET" && url.pathname === "/cloud/status") {
      sendJson(res, 200, {
        ok: true,
        cloudStatus: currentCloudStatus(),
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/pending") {
      try {
        const customerId = url.searchParams.get("customer_id") || "";
        const workspaceId = url.searchParams.get("workspace_id") || "";
        const windowValue = url.searchParams.get("window") || "7d";
        const result = await listPendingRuns(customerId, workspaceId, windowValue);
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 500, { error: String(error) });
      }
      return true;
    }

    return false;
  };
}
