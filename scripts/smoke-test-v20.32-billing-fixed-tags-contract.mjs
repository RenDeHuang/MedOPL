import assert from "node:assert/strict";

const { createBillingMeteringRuntime } = await import("../adapters/billing-aggregator/src/billing-metering-runtime.mjs");
const { createPortalBillingExportRoutes } = await import("../services/portal/src/routes/portal-billing-export.routes.mjs");

const runtime = createBillingMeteringRuntime({
  deps: {
    exists: async () => false,
    isCompletedRun: () => false,
    path: { join: (...parts) => parts.join("/") },
    randomUUID: () => "uuid-fixed-tags",
    readFile: async () => "",
    readdir: async () => [],
    stat: async () => ({ size: 0 }),
  },
});

const fixedTagAllocations = [{
  name: "allocation-fixed-tags",
  start: "2026-05-04T00:00:00.000Z",
  end: "2026-05-04T00:10:00.000Z",
  cpuCost: 1,
  gpuCost: 0,
  pvCost: 0.25,
  totalCost: 1.25,
  properties: {
    tenantid: "tenant-fixed",
    workspaceid: "workspace-fixed",
    runid: "run-fixed",
    serverplanid: "cpu-2c4g",
    resourceorderid: "ro-fixed",
  },
}];

const rawSummary = runtime.summaryFromRawAllocations(fixedTagAllocations, "tenant-fixed", "workspace-fixed");
assert.equal(rawSummary.itemCount, 1, "raw OpenCost allocations must match fixed tenantid/workspaceid labels");
assert.equal(rawSummary.runs[0].runId, "run-fixed", "raw OpenCost summary must use fixed runid");
assert.equal(rawSummary.runs[0].workspaceId, "workspace-fixed", "raw OpenCost summary must use fixed workspaceid");
assert.equal(rawSummary.runs[0].customerId, "tenant-fixed", "raw OpenCost summary must use fixed tenantid");
assert.equal(rawSummary.items[0].properties.tenantid, "tenant-fixed", "raw summary export properties must carry fixed tenantid");
assert.equal(rawSummary.items[0].properties.workspaceid, "workspace-fixed", "raw summary export properties must carry fixed workspaceid");
assert.equal(rawSummary.items[0].properties.runid, "run-fixed", "raw summary export properties must carry fixed runid");

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

const db = {
  users: [
    { id: "admin-1", name: "Admin", email: "admin@example.test", role: "admin" },
    { id: "tenant-fixed", name: "Fixed User", email: "fixed@example.test", role: "user" },
  ],
  wallets: [{ userId: "tenant-fixed", balance: 10 }],
  ledger: [{
    id: "ledger-fixed",
    type: "resource_charge",
    userId: "tenant-fixed",
    runId: "run-fixed",
    workspaceId: "workspace-fixed",
    amount: 1.25,
    createdAt: "2026-05-04T00:12:00.000Z",
    operatorId: "system",
    reason: "fixed tags",
  }],
  taskSpaces: [{ slug: "workspace-fixed", userId: "tenant-fixed", status: "active" }],
};

const route = createPortalBillingExportRoutes({
  appendLedgerEntry: () => ({ created: true }),
  billingServiceUrl: "http://billing.local",
  buildBillingPayload: async () => ({ runCosts: [], taskCosts: [] }),
  fetchBillingSummary: async () => ({
    items: fixedTagAllocations,
  }),
  fetchFn: async () => ({ ok: true, status: 200, json: async () => ({}) }),
  fetchPendingSummary: async () => ({ runs: [] }),
  layoutV2: (title, body) => `${title}:${body}`,
  logPortalEvent: async () => {},
  parseForm: (raw) => Object.fromEntries(new URLSearchParams(raw)),
  readBillingRequestOptions: () => ({ window: "168h" }),
  readBody: async (req) => Buffer.from(req.body || ""),
  sendHtml: (res, body, status = 200) => {
    res.writeHead(status, { "content-type": "text/html" });
    res.end(body);
  },
  writeDb: Object.assign(async () => {}, {
    async refundWallet() { return { ok: true }; },
    async makeupChargeWallet() { return { ok: true }; },
  }),
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

const ledgerExport = await request("GET", "/portal/admin/ledger-export.csv", db.users[0]);
assert.equal(ledgerExport.handled, true, "ledger export must be handled");
assert.equal(ledgerExport.res.statusCode, 200, "ledger export must return 200");
assert.match(ledgerExport.res.body, /OpenCost aggregated/, "ledger export must relate fixed runid allocations to ledger rows");

const userSummary = await request("GET", "/portal/admin/user-summary-export.csv", db.users[0]);
assert.equal(userSummary.handled, true, "user summary export must be handled");
assert.equal(userSummary.res.statusCode, 200, "user summary export must return 200");
assert.match(userSummary.res.body, /tenant-fixed,Fixed User,fixed@example\.test,active,1,10\.00,0\.00,1\.25,1\.25000/, "user summary must include OpenCost total from fixed tenantid");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.32_billing_fixed_tags",
}, null, 2));
