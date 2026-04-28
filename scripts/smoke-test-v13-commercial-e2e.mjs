import assert from "node:assert/strict";

const PORTAL_URL = trimTrailingSlash(process.env.PORTAL_URL || "http://portal.medopl.cn");
const OPL_URL = trimTrailingSlash(process.env.OPL_URL || "http://opl.medopl.cn");
const ADMIN_EMAIL = process.env.PORTAL_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PORTAL_ADMIN_PASSWORD || "";
const TEST_EMAIL = process.env.V13_TEST_EMAIL || `opl-v13-${Date.now()}@example.test`;
const TEST_PASSWORD = process.env.V13_TEST_PASSWORD || `PortalV13-${Date.now()}!`;
const TEST_NAME = process.env.V13_TEST_NAME || "OPL v13 smoke user";
const RECHARGE_AMOUNT = Number(process.env.V13_RECHARGE_AMOUNT || 100);
const SERVER_PLAN_ID = process.env.V13_SERVER_PLAN_ID || "cpu-2c4g";
const WORKSPACE_ID = process.env.V13_WORKSPACE_ID || "default";
const ALLOW_PROVISION = process.env.V13_ALLOW_PROVISION === "1";

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function assertConfigured(value, name) {
  if (!value) throw new Error(`${name} is required. Do not commit credentials; pass it through environment variables.`);
}

function splitSetCookie(headerValue) {
  return String(headerValue || "")
    .split(/,(?=[^ ;]+=)/)
    .map((item) => item.split(";")[0])
    .filter(Boolean);
}

function cookiesFrom(response, names = []) {
  const cookies = splitSetCookie(response.headers.get("set-cookie") || "");
  if (!names.length) return cookies.join("; ");
  return cookies
    .filter((cookie) => names.some((name) => cookie.startsWith(`${name}=`)))
    .join("; ");
}

async function formPost(url, body, cookie = "") {
  const response = await fetch(url, {
    method: "POST",
    body: new URLSearchParams(body),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  return response;
}

async function jsonPost(url, body, cookie = "", timeoutMs = 60000) {
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return response;
}

async function jsonGet(url, cookie = "", timeoutMs = 30000) {
  const response = await fetch(url, {
    headers: {
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  try {
    return { response, text, json: JSON.parse(text) };
  } catch {
    return { response, text, json: null };
  }
}

async function createAdminSession() {
  assertConfigured(ADMIN_EMAIL, "PORTAL_ADMIN_EMAIL");
  assertConfigured(ADMIN_PASSWORD, "PORTAL_ADMIN_PASSWORD");
  const response = await formPost(`${PORTAL_URL}/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  assert.equal(response.status, 302, "admin login should redirect");
  const cookie = cookiesFrom(response, ["portal_session"]);
  assert.ok(cookie, "admin portal_session cookie should be set");
  return cookie;
}

async function createAndRechargeUser(adminCookie) {
  const create = await formPost(`${PORTAL_URL}/portal/admin/create-user`, {
    redirectTo: "/portal/app/admin/users",
    email: TEST_EMAIL,
    name: TEST_NAME,
    password: TEST_PASSWORD,
    role: "user",
    status: "active",
  }, adminCookie);
  assert.equal(create.status, 302, "admin create user should redirect");

  const users = await jsonGet(`${PORTAL_URL}/portal/api/admin/users?pageSize=500`, adminCookie);
  assert.equal(users.response.status, 200, "admin users API should be reachable");
  const items = users.json?.items || users.json?.users || [];
  const user = items.find((item) => item.email === TEST_EMAIL);
  assert.ok(user, "created user should appear in admin users API");

  const recharge = await formPost(`${PORTAL_URL}/portal/admin/recharge`, {
    redirectTo: "/portal/app/admin/users",
    userId: user.id,
    amount: String(RECHARGE_AMOUNT),
  }, adminCookie);
  assert.equal(recharge.status, 302, "admin recharge should redirect");

  const after = await jsonGet(`${PORTAL_URL}/portal/api/admin/users?pageSize=500`, adminCookie);
  const afterUser = (after.json?.items || after.json?.users || []).find((item) => item.email === TEST_EMAIL);
  assert.ok(afterUser, "recharged user should still appear in admin users API");
  assert.ok(Number(afterUser.balance || 0) >= RECHARGE_AMOUNT, "balance should reflect recharge");
  return afterUser;
}

async function loginPortalUser() {
  const response = await formPost(`${PORTAL_URL}/login`, {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  assert.equal(response.status, 302, "user portal login should redirect");
  const cookie = cookiesFrom(response, ["portal_session"]);
  assert.ok(cookie, "user portal_session cookie should be set");

  const overview = await fetch(`${PORTAL_URL}/portal/app/overview`, {
    headers: { cookie },
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(overview.status, 200, "portal overview should be reachable");
  return cookie;
}

async function loginOplNative() {
  for (const path of ["/api/auth/login", "/api/v1/auths/signin"]) {
    const response = await jsonPost(`${OPL_URL}${path}`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    assert.equal(response.status, 200, `OPL native login ${path} should return 200`);
    const cookie = cookiesFrom(response);
    assert.ok(cookie.includes("opl_portal_launch="), `OPL native login ${path} should set launch cookie`);
  }
}

async function verifyPortalLaunch(portalCookie) {
  const launch = await fetch(`${PORTAL_URL}/portal/opl`, {
    headers: { cookie: portalCookie },
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(launch.status, 302, "Portal OPL entry should redirect to OPL with launch token");
  const location = launch.headers.get("location") || "";
  const launchToken = new URL(location).searchParams.get("launch_token") || "";
  assert.ok(launchToken, "launch token should be present");

  const bootstrap = await jsonGet(`${OPL_URL}/portal-adapter/api/opl-launch/bootstrap?launch_token=${encodeURIComponent(launchToken)}`);
  assert.equal(bootstrap.response.status, 200, "adapter bootstrap should accept launch token");
  assert.equal(bootstrap.json?.version, "v1", "adapter bootstrap should return v1 contract");

  const page = await fetch(`${OPL_URL}/?launch_token=${encodeURIComponent(launchToken)}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(page.status, 200, "OPL page with launch token should load");
  const launchCookie = cookiesFrom(page, ["opl_portal_launch"]);
  assert.ok(launchCookie, "OPL launch page should set launch cookie");

  const auth = await jsonGet(`${OPL_URL}/api/auth/user`, launchCookie);
  assert.equal(auth.response.status, 200, "OPL auth user should resolve launch cookie");
  assert.equal(auth.json?.user?.email, TEST_EMAIL, "OPL auth user should be the Portal user");
}

async function verifyOplRuntimeSurface() {
  const response = await fetch(`${OPL_URL}/`, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, "OPL root should load");
  const html = await response.text();
  assert.ok(html.includes("One Person Lab"), "OPL root should expose the original One Person Lab surface");
  assert.ok(html.includes("/portal-launch.js"), "Gateway should inject Portal launch script without modifying upstream");
}

async function verifyPortalWorkspace(portalCookie) {
  const workspace = await jsonGet(`${PORTAL_URL}/portal/api/workspace`, portalCookie);
  assert.equal(workspace.response.status, 200, "Portal workspace API should be reachable");
  const storage = await jsonGet(`${PORTAL_URL}/portal/api/workspace/storage?task=${encodeURIComponent(WORKSPACE_ID)}`, portalCookie);
  assert.equal(storage.response.status, 200, "Portal workspace storage API should be reachable");
  const billing = await jsonGet(`${PORTAL_URL}/portal/api/billing`, portalCookie);
  assert.equal(billing.response.status, 200, "Portal billing API should be reachable");
  const traces = await jsonGet(`${PORTAL_URL}/portal/api/traces`, portalCookie);
  assert.equal(traces.response.status, 200, "Portal traces API should be reachable");
  return {
    workspace: workspace.json,
    storage: storage.json,
    billing: billing.json,
    traces: traces.json,
  };
}

async function verifyResourceOrder(portalCookie) {
  const plans = await jsonGet(`${PORTAL_URL}/portal/api/server-plans`, portalCookie);
  assert.equal(plans.response.status, 200, "server plans API should be reachable");
  const planItems = plans.json?.items || plans.json?.plans || [];
  const plan = planItems.find((item) => item.id === SERVER_PLAN_ID) || planItems[0] || { id: SERVER_PLAN_ID };

  const quoteResponse = await jsonPost(`${PORTAL_URL}/portal/api/resource-orders/quote`, {
    serverPlanId: plan.id,
    workspaceId: WORKSPACE_ID,
    storagePlanId: "workspace-default",
    storageSizeGb: 20,
    estimatedHours: 1,
  }, portalCookie);
  const quoteText = await quoteResponse.text();
  const quote = JSON.parse(quoteText);
  assert.equal(quoteResponse.status, 200, "resource order quote should be created");

  let freeze = null;
  const canFreeze = Number(quote.order?.freezeAmount || quote.order?.frozenAmount || 0) > 0;
  if (canFreeze) {
    const freezeResponse = await jsonPost(`${PORTAL_URL}/portal/api/resource-orders/freeze`, {
      orderId: quote.resourceOrderId,
    }, portalCookie);
    freeze = JSON.parse(await freezeResponse.text());
    assert.equal(freezeResponse.status, 200, "resource order freeze should succeed when quote amount is positive");
  }

  let provision = null;
  if (ALLOW_PROVISION && freeze?.resourceOrderId) {
    const provisionResponse = await jsonPost(`${PORTAL_URL}/portal/api/resource-orders/provision`, {
      orderId: freeze.resourceOrderId,
    }, portalCookie, 120000);
    provision = JSON.parse(await provisionResponse.text());
    assert.equal(provisionResponse.status, 200, "resource order provisioning should succeed when explicitly enabled");
  }

  return {
    plans: {
      source: plans.json?.source,
      priceEnabled: plans.json?.priceEnabled,
      lastQuoteError: plans.json?.cloudStatus?.price?.lastQuoteError || null,
      catalogCount: plans.json?.catalogCount,
    },
    quote: {
      status: quote.order?.status,
      resourceOrderId: quote.resourceOrderId,
      freezeAmount: quote.order?.freezeAmount,
      unitPrice: quote.order?.unitPrice,
      pricingSource: quote.order?.pricingSource,
    },
    freeze,
    provision,
    skippedProvision: !ALLOW_PROVISION,
  };
}

const summary = {
  portalUrl: PORTAL_URL,
  oplUrl: OPL_URL,
  testEmail: TEST_EMAIL,
  allowProvision: ALLOW_PROVISION,
  checks: {},
};

const adminCookie = await createAdminSession();
summary.checks.user = await createAndRechargeUser(adminCookie);
const portalCookie = await loginPortalUser();
summary.checks.portalLogin = true;
await loginOplNative();
summary.checks.oplNativeLogin = true;
await verifyPortalLaunch(portalCookie);
summary.checks.portalLaunch = true;
await verifyOplRuntimeSurface();
summary.checks.oplRuntimeSurface = true;
summary.checks.portalWorkspace = await verifyPortalWorkspace(portalCookie);
summary.checks.resourceOrder = await verifyResourceOrder(portalCookie);

console.log(JSON.stringify(summary, null, 2));
