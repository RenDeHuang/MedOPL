import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { createPortalHttpDispatcher } = await import("../services/portal/src/app/portal-http-dispatcher.mjs");

const overview = await readFile("services/portal/frontend/src/views/overview/OverviewView.vue", "utf8");
const billing = await readFile("services/portal/frontend/src/views/billing/BillingView.vue", "utf8");
const resources = await readFile("services/portal/frontend/src/views/resources/ResourcesView.vue", "utf8");
const api = await readFile("services/portal/frontend/src/api/portal.ts", "utf8");
const client = await readFile("services/portal/frontend/src/api/client.ts", "utf8");
const dispatcher = await readFile("services/portal/src/app/portal-http-dispatcher.mjs", "utf8");
const payloads = await readFile("services/portal/src/app/portal-page-payloads.mjs", "utf8");

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

mustMatch(overview, /\boverviewLoading\b/, "overview_must_track_primary_summary_loading");
mustMatch(overview, /\borderPanelLoading\b/, "overview_must_track_resource_order_panel_loading");
mustMatch(overview, /payload\s*=\s*ref<OverviewPayload \| null>\(null\)/, "overview_must_keep_summary_payload_separate");
mustMatch(overview, /resourceOrders\s*=\s*ref<ResourceOrdersPayload \| null>\(null\)/, "overview_must_keep_resource_orders_separate");
mustMatch(overview, /fetchOverview\([\s\S]*?\)[\s\S]*?payload\.value\s*=\s*overviewData/, "overview_must_render_summary_as_soon_as_overview_returns");
mustMatch(overview, /void\s+loadResourceOrders\(/, "overview_must_load_resource_orders_as_secondary_panel");
mustNotMatch(
  overview,
  /const\s+\[[^\]]*overview[^\]]*resourceOrders[^\]]*\]\s*=\s*await\s+Promise\.all|await\s+Promise\.all\(\s*\[\s*fetchOverview[\s\S]*fetchResourceOrders/,
  "overview_must_not_block_summary_on_resource_orders",
);

mustMatch(billing, /\bsummaryLoading\b/, "billing_must_track_summary_loading");
mustMatch(billing, /\bdetailsLoading\b/, "billing_must_track_details_loading");
mustMatch(billing, /\bsummaryPayload\b/, "billing_must_store_summary_payload_for_first_screen");
mustMatch(billing, /\bdetailsPayload\b/, "billing_must_store_details_payload_for_secondary_sections");
mustMatch(billing, /\bfetchBillingSummary\b/, "billing_must_use_summary_api_for_first_screen");
mustMatch(billing, /\bfetchBillingDetails\b/, "billing_must_use_details_api_for_tables_and_charts");
mustMatch(billing, /void\s+loadBillingDetails\(/, "billing_must_not_block_first_screen_on_details");
mustNotMatch(billing, /v-if="loading"[\s\S]{0,180}正在加载账单数据/, "billing_must_not_use_single_full_page_loading_state");

mustMatch(resources, /\bresourcesLoading\b/, "resources_must_track_resource_panel_loading");
mustMatch(resources, /\bresourceSummary\b/, "resources_must_have_first_screen_summary");
mustMatch(resources, /资源绑定/, "resources_must_keep_business_heading_visible_before_items_load");
mustNotMatch(resources, /v-if="!loading && items\.length === 0"/, "resources_empty_state_must_not_depend_on_single_page_loading");

mustMatch(api, /\bexport interface BillingSummaryPayload\b/, "api_must_define_billing_summary_payload");
mustMatch(api, /\bexport interface BillingDetailsPayload\b/, "api_must_define_billing_details_payload");
mustMatch(api, /\bexport async function fetchBillingSummary\b/, "api_must_export_billing_summary_fetcher");
mustMatch(api, /\bexport async function fetchBillingDetails\b/, "api_must_export_billing_details_fetcher");
mustMatch(api, /apiClient\.get<BillingSummaryPayload>\("\/billing\/summary"/, "billing_summary_must_use_summary_endpoint");
mustMatch(api, /apiClient\.get<BillingDetailsPayload>\("\/billing\/details"/, "billing_details_must_use_details_endpoint");
mustMatch(dispatcher, /\/portal\/api\/billing\/summary/, "dispatcher_must_route_billing_summary_endpoint");
mustMatch(dispatcher, /\/portal\/api\/billing\/details/, "dispatcher_must_route_billing_details_endpoint");
mustMatch(payloads, /\basync function buildBillingSummaryPayload\b/, "server_must_build_billing_summary_payload");
mustMatch(payloads, /\basync function buildBillingDetailsPayload\b/, "server_must_build_billing_details_payload");

for (const [name, source] of [
  ["api_client", client],
  ["portal_api", api],
  ["overview", overview],
  ["billing", billing],
  ["resources", resources],
]) {
  mustNotMatch(source, /\bsetTimeout\b|\bsetInterval\b|\bretry\b|\bpoll\b/i, `${name}_must_not_hide_latency_with_retry_or_polling`);
}

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = "") {
      this.body += String(body || "");
      this.ended = true;
    },
  };
}

function createReq(url) {
  return { method: "GET", url, headers: { cookie: "portal_session=session-1" } };
}

function createBillingDispatcher() {
  const calls = [];
  const dispatch = createPortalHttpDispatcher({
    buildBillingDetailsPayload: async () => {
      calls.push("billingDetails");
      return { kind: "details" };
    },
    buildBillingPayload: async () => {
      calls.push("billingFull");
      return { kind: "full" };
    },
    buildBillingSummaryPayload: async () => {
      calls.push("billingSummary");
      return { kind: "summary" };
    },
    buildOverviewPayload: async () => ({}),
    buildPortalHealthPayload: () => ({ ok: true }),
    buildWorkspacePayload: async () => ({}),
    currentUser: async () => ({ db: {}, user: { id: "user-1", currentTaskSlug: "default", preferences: {} } }),
    frontendDistRoot: "/tmp/frontend",
    guessContentType: () => "text/plain",
    handleAuthRoutes: async () => false,
    handleLabPackageRoutes: async () => false,
    handleOplRoutes: async () => false,
    handlePortalAdminApiRoutes: async () => false,
    handlePortalAdminOpsRoutes: async () => false,
    handlePortalAdminUserRoutes: async () => false,
    handlePortalApiRoutes: async () => false,
    handlePortalBillingExportRoutes: async () => false,
    handlePortalLegacyRedirectRoutes: async () => false,
    handlePortalTaskSpaceRoutes: async () => false,
    handleResourceOrderRoutes: async () => false,
    handleServerPlanRoutes: async () => false,
    handleWorkspaceStorageRoutes: async () => false,
    layoutV2: () => "",
    logPortalEvent: async () => {},
    parseForm: () => ({}),
    path: { join: (...parts) => parts.join("/") },
    readBillingRequestOptions: () => ({}),
    readBody: async () => Buffer.from(""),
    readOverviewRequestOptions: () => ({}),
    sendHtml: (res, html, status = 200) => {
      res.writeHead(status, { "content-type": "text/html" });
      res.end(html);
    },
    sendJson: (res, payload, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    },
    sendStaticAsset: async () => {},
    slugify: (value) => String(value || ""),
    writeDb: async () => {},
  });
  return { calls, dispatch };
}

for (const [url, expectedCall, expectedKind] of [
  ["/portal/api/billing/summary", "billingSummary", "summary"],
  ["/portal/api/billing/details", "billingDetails", "details"],
  ["/portal/api/billing", "billingFull", "full"],
]) {
  const { calls, dispatch } = createBillingDispatcher();
  const res = createResponse();
  await dispatch(createReq(url), res);
  assert.equal(res.statusCode, 200, `${url}:must_return_200`);
  assert.deepEqual(calls, [expectedCall], `${url}:must_call_only_expected_billing_builder`);
  assert.equal(JSON.parse(res.body).kind, expectedKind, `${url}:must_return_expected_payload`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_portal_rendering",
}, null, 2));
