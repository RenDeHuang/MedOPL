import assert from "node:assert/strict";
import { Readable } from "node:stream";

const { createBillingHttpHandler } = await import("../adapters/billing-aggregator/src/http-routes.mjs");

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body += String(chunk || "");
    },
  };
}

function createJsonRequest(method, url, payload) {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const stream = Readable.from(body ? [Buffer.from(body)] : []);
  stream.method = method;
  stream.url = url;
  stream.headers = body ? { "content-type": "application/json" } : {};
  return stream;
}

function parseJsonResponse(res) {
  assert.equal(res.headers?.["content-type"], "application/json; charset=utf-8");
  return JSON.parse(res.body);
}

const calls = [];
const handler = createBillingHttpHandler({
  config: {
    OPENCOST_BASE_URL: "",
    TENCENT_BILLING_ENABLED: false,
    TENCENT_BILLING_REQUIRED: false,
    TENCENT_PRICE_ENABLED: false,
    TENCENT_CLOUD_REGION: "na-siliconvalley",
    AUTO_RECONCILE_ENABLED: false,
    AUTO_RECONCILE_INTERVAL_MS: 600000,
    AUTO_RECONCILE_WINDOW: "168h",
  },
  deps: {
    sendJson(res, status, payload) {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload, null, 2));
    },
    buildTencentCloudStatus() {
      return {
        credentialsConfigured: true,
        priceEnabled: false,
        billingEnabled: false,
        billingRequired: false,
        priceImageConfigured: false,
        catalogConfigured: true,
        lastQuoteAt: "",
        lastQuoteError: "",
        lastBillQueryAt: "",
        lastBillQueryError: "",
        exactBillingSource: "tencent_cloud_bill",
        pendingSource: "metering_pending",
      };
    },
    serverPlanCatalog() {
      return [{ id: "catalog-a" }, { id: "catalog-b" }];
    },
    tencentCloudConfigured() {
      return true;
    },
    buildCosBillStatus() {
      return { ok: true, bucket: "opl-bucket", prefix: "daily/" };
    },
    cosBillReader: {
      configured() {
        return true;
      },
      async listFiles() {
        return [{ key: "daily/2026-05-01.csv" }];
      },
    },
    async buildCosBillFilesPayload() {
      calls.push(["buildCosBillFilesPayload"]);
      return { ok: true, files: [{ key: "daily/2026-05-01.csv" }] };
    },
    async buildCosBillReconcilePayload(target) {
      calls.push(["buildCosBillReconcilePayload", target]);
      return { ok: true, preview: true, target };
    },
    normalizeCosTarget(body = {}) {
      return { objectKey: String(body.objectKey || "").trim(), prefix: String(body.prefix || "").trim() };
    },
    async collectAttributionItems(url) {
      calls.push(["collectAttributionItems", url.search]);
      return [{ resourceOrderId: "ro-1", cost: 3.5 }];
    },
    buildAttributionPayload(items, resourceOrderId) {
      return { ok: true, resourceOrderId, itemCount: items.length };
    },
    async listServerPlans(filters) {
      calls.push(["listServerPlans", filters]);
      return { ok: true, filters, items: [] };
    },
    cloudErrorMessage(error) {
      return error?.message || "cloud_error";
    },
    async reconcileCharges(customerId, workspaceId, windowValue, target) {
      calls.push(["reconcileCharges", { customerId, workspaceId, windowValue, target }]);
      return { ok: true, customerId, workspaceId, windowValue, target };
    },
    getReconcileState() {
      return { status: "idle", lastRunAt: "" };
    },
    async listPendingRuns(customerId, workspaceId, windowValue) {
      calls.push(["listPendingRuns", { customerId, workspaceId, windowValue }]);
      return { ok: true, customerId, workspaceId, windowValue, pendingCount: 1 };
    },
  },
});

{
  const req = createJsonRequest("GET", "/healthz");
  const res = createResponseRecorder();
  const handled = await handler(req, res);
  assert.equal(handled, true);
  const payload = parseJsonResponse(res);
  assert.equal(payload.ok, true);
  assert.equal(payload.tencentCloudConfigured, true);
  assert.equal(payload.cloudStatus.catalogConfigured, true);
}

{
  const req = createJsonRequest("GET", "/billing/cos/status");
  const res = createResponseRecorder();
  const handled = await handler(req, res);
  assert.equal(handled, true);
  const payload = parseJsonResponse(res);
  assert.equal(payload.readable, true);
  assert.equal(payload.latestFile.key, "daily/2026-05-01.csv");
}

{
  const req = createJsonRequest("POST", "/billing/cos/reconcile", { objectKey: " daily/file.csv " });
  const res = createResponseRecorder();
  const handled = await handler(req, res);
  assert.equal(handled, true);
  const payload = parseJsonResponse(res);
  assert.deepEqual(payload.target, { objectKey: "daily/file.csv", prefix: "" });
}

{
  const req = createJsonRequest("POST", "/reconcile", {
    customer_id: "tenant-a",
    workspace_id: "ws-a",
    window: "24h",
    objectKey: "daily/2026-05-01.csv",
    billingStartedAt: "2026-05-02T00:00:00.000Z",
    billingStoppedAt: "2026-05-02T01:00:00.000Z",
    l3ExactWaitMinutes: 120,
    resourceOrderId: "order-a",
    runId: "run-a",
    serverPlanId: "cpu-2c4g",
  });
  const res = createResponseRecorder();
  const handled = await handler(req, res);
  assert.equal(handled, true);
  const payload = parseJsonResponse(res);
  assert.equal(payload.customerId, "tenant-a");
  assert.equal(payload.workspaceId, "ws-a");
  assert.equal(payload.windowValue, "24h");
  assert.deepEqual(payload.target, {
    objectKey: "daily/2026-05-01.csv",
    prefix: "",
    tenantId: "tenant-a",
    customerId: "tenant-a",
    workspaceId: "ws-a",
    billingStartedAt: "2026-05-02T00:00:00.000Z",
    billingStoppedAt: "2026-05-02T01:00:00.000Z",
    queryBeginTime: "",
    queryEndTime: "",
    l3ExactWaitMinutes: 120,
    resourceOrderId: "order-a",
    runId: "run-a",
    serverPlanId: "cpu-2c4g",
  });
}

{
  const req = createJsonRequest("GET", "/status");
  const res = createResponseRecorder();
  const handled = await handler(req, res);
  assert.equal(handled, true);
  const payload = parseJsonResponse(res);
  assert.equal(payload.pendingSource, "metering_pending");
  assert.equal(payload.serverPlanCatalogCount, 2);
  assert.deepEqual(payload.reconcileState, { status: "idle", lastRunAt: "" });
}

{
  const req = createJsonRequest("GET", "/cloud/status");
  const res = createResponseRecorder();
  const handled = await handler(req, res);
  assert.equal(handled, true);
  const payload = parseJsonResponse(res);
  assert.equal(payload.cloudStatus.credentialsConfigured, true);
}

{
  const req = createJsonRequest("GET", "/pending?customer_id=tenant-p&workspace_id=ws-p&window=7d");
  const res = createResponseRecorder();
  const handled = await handler(req, res);
  assert.equal(handled, true);
  const payload = parseJsonResponse(res);
  assert.equal(payload.pendingCount, 1);
}

{
  const req = createJsonRequest("GET", "/unhandled");
  const res = createResponseRecorder();
  const handled = await handler(req, res);
  assert.equal(handled, false);
  assert.equal(res.statusCode, null);
}

assert.deepEqual(
  calls,
  [
    ["buildCosBillReconcilePayload", { objectKey: "daily/file.csv", prefix: "" }],
    ["reconcileCharges", {
      customerId: "tenant-a",
      workspaceId: "ws-a",
      windowValue: "24h",
      target: {
        objectKey: "daily/2026-05-01.csv",
        prefix: "",
        tenantId: "tenant-a",
        customerId: "tenant-a",
        workspaceId: "ws-a",
        billingStartedAt: "2026-05-02T00:00:00.000Z",
        billingStoppedAt: "2026-05-02T01:00:00.000Z",
        queryBeginTime: "",
        queryEndTime: "",
        l3ExactWaitMinutes: 120,
        resourceOrderId: "order-a",
        runId: "run-a",
        serverPlanId: "cpu-2c4g",
      },
    }],
    ["listPendingRuns", { customerId: "tenant-p", workspaceId: "ws-p", windowValue: "7d" }],
  ],
);

console.log(JSON.stringify({ ok: true, contract: "billing_http_routes" }, null, 2));
