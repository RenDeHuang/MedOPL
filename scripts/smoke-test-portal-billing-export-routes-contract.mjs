import assert from "node:assert/strict";

const { createPortalBillingExportRoutes } = await import("../services/portal/src/routes/portal-billing-export.routes.mjs");

function encodeForm(fields = {}) {
  return new URLSearchParams(Object.entries(fields).map(([key, value]) => [key, String(value)])).toString();
}

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body += String(body || "");
    },
  };
}

async function readBody(req) {
  return Buffer.from(req.body || "");
}

function parseForm(raw) {
  return Object.fromEntries(new URLSearchParams(raw));
}

function sendHtml(res, body, status = 200) {
  res.writeHead(status, { "content-type": "text/html" });
  res.end(body);
}

const db = {
  users: [
    { id: "admin-1", name: "Admin", email: "admin@example.test", role: "admin" },
    { id: "user-1", name: "Alice", email: "alice@example.test", role: "user" },
  ],
  wallets: [{ userId: "user-1", balance: 10 }],
  ledger: [{
    id: "ledger-1",
    type: "resource_charge",
    userId: "user-1",
    runId: "run-1",
    workspaceId: "analysis",
    amount: 1.5,
    createdAt: new Date().toISOString(),
    operatorId: "system",
    reason: "pending",
  }],
  taskSpaces: [{ slug: "analysis", userId: "user-1", status: "active" }],
};

const events = [];
const writes = [];
const fetchCalls = [];
const route = createPortalBillingExportRoutes({
  appendLedgerEntry: (targetDb, entry) => {
    targetDb.ledger.push(entry);
    return { created: true, entry };
  },
  billingServiceUrl: "http://billing.local",
  buildBillingPayload: async () => ({
    runCosts: [{
      runId: "run-1",
      workspaceId: "analysis",
      runStatus: "completed",
      cpuCost: 1.234567,
      gpuCost: 0,
      storageCost: 0.2,
      totalCost: 1.434567,
      startedAt: "2026-05-01T00:00:00.000Z",
      endedAt: "2026-05-01T00:01:00.000Z",
      pricingSource: "fixture",
    }],
    taskCosts: [{
      slug: "analysis",
      title: "Analysis",
      runCount: 1,
      cpuCost: 1.234567,
      gpuCost: 0,
      storageCost: 0.2,
      totalCost: 1.434567,
    }],
  }),
  fetchBillingSummary: async () => ({
    items: [{
      name: "run-1",
      totalCost: 1.5,
      properties: { "label:run_id": "run-1", "label:customer_id": "user-1" },
      start: new Date().toISOString(),
    }],
  }),
  fetchFn: async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ reconciledCount: 2 }),
    };
  },
  fetchPendingSummary: async () => ({
    runs: [{
      runId: "run-1",
      customerId: "user-1",
      workspaceId: "analysis",
      completedAt: "2026-05-01T00:02:00.000Z",
      pendingHours: 1.25,
      pricingSource: "metering pending",
    }],
  }),
  layoutV2: (title, body) => `${title}:${body}`,
  logPortalEvent: async (event) => events.push(event),
  parseForm,
  readBillingRequestOptions: () => ({ window: "168h" }),
  readBody,
  sendHtml,
  writeDb: async (targetDb) => writes.push(targetDb),
});

async function request(method, path, user, fields = {}) {
  const res = createResponseRecorder();
  const handled = await route({
    req: { method, body: method === "POST" ? encodeForm(fields) : "" },
    res,
    url: new URL(path, "http://portal.local"),
    db,
    user,
  });
  return { handled, res };
}

let result = await request("GET", "/portal/billing/export.csv", db.users[1]);
assert.equal(result.handled, true, "billing_export_must_be_handled");
assert.equal(result.res.statusCode, 200, "billing_export_must_return_200");
assert.equal(result.res.headers["content-disposition"], "attachment; filename=\"portal-billing-export.csv\"");
assert.match(result.res.body, /run-1,analysis,completed,1\.23457/);

result = await request("GET", "/portal/admin/ledger-export.csv", db.users[0]);
assert.equal(result.res.statusCode, 200, "admin_ledger_export_must_return_200");
assert.match(result.res.body, /ledger-1,resource_charge,user-1,Alice/);

result = await request("GET", "/portal/admin/ledger-export.csv", db.users[1]);
assert.equal(result.res.statusCode, 403, "non_admin_ledger_export_must_forbid");

result = await request("POST", "/portal/admin/ledger-adjust", db.users[0], {
  userId: "user-1",
  actionType: "refund",
  amount: "2.5",
  reason: "exact bill refund",
  redirectTo: "/portal/admin/billing-ops",
});
assert.equal(result.res.statusCode, 302, "ledger_adjust_must_redirect");
assert.equal(db.wallets[0].balance, 12.5, "ledger_adjust_must_update_wallet");
assert.ok(db.ledger.some((entry) => entry.type === "refund" && entry.userId === "user-1"), "ledger_adjust_must_append_entry");

result = await request("POST", "/portal/admin/reconcile-billing", db.users[0], {
  scopeType: "workspace",
  userId: "user-1",
  workspaceId: "analysis",
  window: "24h",
  redirectTo: "/portal/admin/billing-ops",
});
assert.equal(result.res.statusCode, 302, "reconcile_billing_must_redirect");
assert.equal(fetchCalls[0].url, "http://billing.local/reconcile", "reconcile_must_call_billing_service");
assert.deepEqual(JSON.parse(fetchCalls[0].options.body), {
  window: "24h",
  customer_id: "user-1",
  workspace_id: "analysis",
});
assert.ok(events.some((event) => event.type === "billing_reconcile_triggered"), "reconcile_must_log_event");

result = await request("GET", "/portal/not-billing", db.users[1]);
assert.equal(result.handled, false, "unknown_billing_route_must_not_be_claimed");

console.log(JSON.stringify({
  ok: true,
  checked: [
    "billing-export",
    "admin-ledger-export",
    "ledger-adjust",
    "reconcile-billing",
    "unmatched",
  ],
  writes: writes.length,
}, null, 2));
