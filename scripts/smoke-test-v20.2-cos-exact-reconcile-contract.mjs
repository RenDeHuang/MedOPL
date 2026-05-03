import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { createBillingHttpHandler } from "../adapters/billing-aggregator/src/http-routes.mjs";
import { createReconcileService } from "../adapters/billing-aggregator/src/reconcile-service.mjs";

function createJsonRequest(method, url, body = undefined) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { "content-type": "application/json" };
  req[Symbol.asyncIterator] = async function* iterate() {
    if (body !== undefined) yield Buffer.from(JSON.stringify(body), "utf8");
  };
  return req;
}

function createJsonResponse() {
  const res = {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    end(chunk = "") {
      this.body += String(chunk || "");
      this.finished = true;
    },
  };
  return res;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function requestJson(handler, method, url, body = undefined) {
  const req = createJsonRequest(method, url, body);
  const res = createJsonResponse();
  const handled = await handler(req, res);
  assert.equal(handled, true, `route_not_handled:${method}:${url}`);
  return JSON.parse(res.body || "{}");
}

function createPortalDb() {
  return {
    wallets: [{ userId: "tenant-a", balance: 200, updatedAt: "2026-05-03T00:00:00.000Z" }],
    ledger: [],
    resourceOrders: [{
      id: "order-a",
      tenantId: "tenant-a",
      userId: "tenant-a",
      portalUserId: "tenant-a",
      workspaceId: "ws-a",
      runId: "run-a",
      billingAccountId: "tenant-a",
      status: "ready",
      serverPlanId: "plan-a",
      currency: "CNY",
      pricingSource: "tencent_cos_daily_bill",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    }],
  };
}

function createRun() {
  return {
    runId: "run-a",
    customerId: "tenant-a",
    userId: "tenant-a",
    workspaceId: "ws-a",
    status: "succeeded",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T01:00:00.000Z",
    k8sStatus: {
      succeeded: true,
      conditions: [{ type: "Complete", status: "True", lastTransitionTime: "2026-05-01T01:00:00.000Z" }],
    },
  };
}

function buildUnattributedSummary(items = [], customerId = "", workspaceId = "") {
  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    source: "tencent_cos_daily_bill",
    itemCount: items.length,
    items,
  };
}

async function main() {
  const previewPayload = {
    ok: true,
    preview: true,
    reconciled: false,
    exactSource: "tencent_cos_daily_bill",
    latestFile: { key: "daily/2026-05-02.zip" },
    parsedRowCount: 4,
    attributedCount: 2,
    unattributedCount: 1,
    totalCost: 11.11,
    items: [
      { rowId: "charge-row", branch: "exact_charge", totalCost: 8.88, tenantId: "tenant-a", workspaceId: "ws-a", resourceOrderId: "order-a", runId: "run-a" },
      { rowId: "refund-row", branch: "refund", totalCost: -1.11, tenantId: "tenant-a", workspaceId: "ws-a", resourceOrderId: "order-a", runId: "run-a" },
    ],
    unattributed: [
      { rowId: "unattributed-row", branch: "unattributed", totalCost: 2.22 },
    ],
  };

  const previewHandler = createBillingHttpHandler({
    deps: {
      sendJson,
      buildTencentCloudStatus: () => ({}),
      serverPlanCatalog: () => [],
      tencentCloudConfigured: () => false,
      buildCosBillStatus: () => ({ ok: true }),
      cosBillReader: {
        configured: () => true,
        listFiles: async () => [],
      },
      buildCosBillFilesPayload: async () => ({ ok: true, files: [] }),
      buildCosBillReconcilePayload: async () => previewPayload,
      normalizeCosTarget: (value = {}) => value,
      collectAttributionItems: async () => [],
      buildAttributionPayload: () => ({ ok: true }),
      listServerPlans: async () => [],
      cloudErrorMessage: () => "",
      reconcileCharges: async () => ({ ok: true }),
      getReconcileState: () => ({}),
      listPendingRuns: async () => ({ ok: true }),
    },
  });

  const preview = await requestJson(previewHandler, "POST", "/billing/cos/reconcile", {});
  assert.equal(preview.preview, true);
  assert.equal(Array.isArray(preview.rows), true, "preview_must_include_rows");
  assert.equal(Array.isArray(preview.attributedRows), true, "preview_must_include_attributed_rows");
  assert.equal(Array.isArray(preview.unattributedRows), true, "preview_must_include_unattributed_rows");
  assert.equal(typeof preview.wouldChargeCents, "number", "preview_must_include_wouldChargeCents");
  assert.equal(typeof preview.wouldRefundCents, "number", "preview_must_include_wouldRefundCents");
  assert.equal(typeof preview.wouldMakeupCents, "number", "preview_must_include_wouldMakeupCents");
  assert.equal(preview.rows.length, 3, "rows_must_cover_attributed_and_unattributed");
  assert.equal(preview.attributedRows.length, 2);
  assert.equal(preview.unattributedRows.length, 1);

  const branchNames = preview.rows.map((row) => row.branch).filter(Boolean);
  const uniqueBranchRows = new Set(preview.rows.map((row) => `${row.rowId}:${row.branch}`));
  assert.equal(uniqueBranchRows.size, preview.rows.length, "each_bill_row_must_enter_exactly_one_branch");
  assert.equal(branchNames.includes("exact_charge"), true);
  assert.equal(branchNames.includes("refund"), true);
  assert.equal(branchNames.includes("unattributed"), true);

  let db = createPortalDb();
  const reconcile = createReconcileService({
    buildUnattributedSummary,
    fetchExactSummary: async () => ({
      runs: [{
        resourceOrderId: "order-a",
        runId: "run-a",
        workspaceId: "ws-a",
        customerId: "tenant-a",
        tenantId: "tenant-a",
        serverPlanId: "plan-a",
        totalCost: 12.34,
        pricingSource: "tencent_cos_daily_bill",
      }],
      unattributed: buildUnattributedSummary([]),
    }),
    logRuntimeEvent: async () => {},
    now: () => "2026-05-03T12:00:00.000Z",
    readPortalDb: async () => db,
    readRuns: async () => [createRun()],
    writePortalDb: async (nextDb) => {
      db = nextDb;
    },
  });

  const first = await reconcile("tenant-a", "ws-a", "7d", {
    objectKey: "daily/2026-05-02.zip",
    billingStartedAt: "2026-05-01T00:00:00.000Z",
    billingStoppedAt: "2026-05-01T01:00:00.000Z",
  });
  const second = await reconcile("tenant-a", "ws-a", "7d", {
    objectKey: "daily/2026-05-02.zip",
    billingStartedAt: "2026-05-01T00:00:00.000Z",
    billingStoppedAt: "2026-05-01T01:00:00.000Z",
  });

  assert.equal(first.result.exactCount, 1);
  assert.equal(db.ledger.length, 1, "first_reconcile_must_write_single_charge");
  assert.equal(db.ledger[0].type, "exact_resource_charge");
  assert.equal(second.result.exactCount, 1, "second_reconcile_must_still_recognize_exact_row");
  assert.equal(db.ledger.length, 1, "reconcile_must_be_idempotent_for_same_bill_row_resource_tenant");
  assert.equal(db.wallets[0].balance, 187.66);
}

await main();

console.log(JSON.stringify({ ok: true, contract: "v20.2_cos_exact_reconcile" }, null, 2));
