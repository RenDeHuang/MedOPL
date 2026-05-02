import assert from "node:assert/strict";

const { createPortalServerPlanRuntimeHandler } = await import("../services/portal/src/app/portal-server-plan-runtime-handler.mjs");

function createResponseRecorder() {
  return { statusCode: null, payload: null };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

function createRequest(method, path, body = "") {
  return {
    req: { method, [Symbol.asyncIterator]: async function* iterator() { if (body) yield Buffer.from(body); } },
    res: createResponseRecorder(),
    url: new URL(path, "http://portal.local"),
  };
}

const events = [];
const writes = [];
const db = {
  groups: [],
  ledger: [],
  taskSpaces: [{
    slug: "analysis",
    userId: "user-1",
    title: "Analysis",
    status: "active",
  }],
  wallets: [{ userId: "user-1", balance: 10 }],
};
const user = { id: "user-1", currentTaskSlug: "analysis", status: "active" };
const plan = {
  id: "cpu-2c4g",
  salable: true,
  region: "na-siliconvalley",
  cpu: 2,
  memoryGb: 4,
  hourlyPrice: 0.05,
};

const handleServerPlanRoutes = createPortalServerPlanRuntimeHandler({
  defaultTaskTitle: (slug) => `Task ${slug}`,
  ensureTaskSpace: async () => db.taskSpaces[0],
  evaluateUserPolicy: async () => ({ blocked: false }),
  fetchBillingStatus: async () => ({ cloudStatus: { available: true, source: "billing" } }),
  fetchServerPlans: async () => ({
    items: [plan],
    cloudStatus: { available: true, source: "catalog" },
  }),
  findTaskSpace: (targetDb, userId, slug) => targetDb.taskSpaces.find((item) => item.userId === userId && item.slug === slug) || null,
  logPortalEvent: async (event) => events.push(event),
  readBody: async (req) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
  },
  sendJson,
  slugify: (value) => String(value || "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "default",
  writeDb: async (targetDb) => writes.push(targetDb),
});

let request = createRequest("GET", "/portal/api/server-plans?task=analysis");
let handled = await handleServerPlanRoutes({ ...request, db, user });
assert.equal(handled, true, "server_plans_list_must_be_handled");
assert.equal(request.res.statusCode, 200, "server_plans_list_must_return_200");
assert.equal(request.res.payload.items[0].id, "cpu-2c4g", "server_plans_list_must_return_items");
assert.equal(request.res.payload.summary.salableCount, 1, "server_plans_list_must_include_summary");
assert.equal(request.res.payload.commercial.accountStatus, "active", "server_plans_list_must_include_commercial_profile");
assert.equal(request.res.payload.selectedServerPlan, null, "server_plans_list_must_include_empty_current_selection");
assert.equal(request.res.payload.freezePolicy.finalBilling.includes("DescribeBillDetail"), true, "server_plans_list_must_explain_exact_bill_basis");

request = createRequest("POST", "/portal/api/server-plans/select", JSON.stringify({ task: "analysis", planId: "cpu-2c4g" }));
handled = await handleServerPlanRoutes({ ...request, db, user });
assert.equal(handled, true, "server_plan_select_must_be_handled");
assert.equal(request.res.statusCode, 200, "server_plan_select_must_return_200");
assert.equal(request.res.payload.selectedServerPlan.id, "cpu-2c4g", "server_plan_select_must_persist_selection");
assert.equal(db.taskSpaces[0].serverPlanId, "cpu-2c4g", "server_plan_select_must_update_task_space");
assert.equal(events[0].type, "server_plan_selected", "server_plan_select_must_log_event");
assert.equal(writes.length, 1, "server_plan_select_must_write_db_once");

request = createRequest("GET", "/portal/api/not-server-plans");
handled = await handleServerPlanRoutes({ ...request, db, user });
assert.equal(handled, false, "unmatched_route_must_not_be_claimed");

console.log(JSON.stringify({
  ok: true,
  contract: "portal_server_plan_runtime_handler",
}, null, 2));
