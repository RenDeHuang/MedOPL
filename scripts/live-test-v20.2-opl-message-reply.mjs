import assert from "node:assert/strict";

const runtimeUrl = "https://github.com/gaofeng21cn/one-person-lab";
const requiredEnv = [
  "OPL_LIVE_BASE_URL",
  "OPL_LIVE_EMAIL",
  "OPL_LIVE_PASSWORD",
  "OPL_LIVE_GFLABTOKEN",
];
const optionalPortalEnv = [
  "PORTAL_LIVE_BASE_URL",
  "PORTAL_LIVE_EMAIL",
  "PORTAL_LIVE_PASSWORD",
];

function env(name) {
  return String(process.env[name] || "").trim();
}

function positiveIntEnv(name, fallback) {
  const value = Number(env(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function hasRequiredEnv() {
  return requiredEnv.every((name) => env(name));
}

function hasPortalEnv() {
  return optionalPortalEnv.every((name) => env(name));
}

function redact(value = "") {
  if (!value) return "";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`request_failed:${response.status}`);
    error.payload = payload;
    throw error;
  }
  return { response, payload };
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  const bodyText = await response.text();
  if (!response.ok && response.status !== 302) {
    const error = new Error(`request_failed:${response.status}`);
    error.bodyText = bodyText;
    throw error;
  }
  return { response, bodyText };
}

function loginSucceeded(payload = {}) {
  return payload.ok === true || payload.success === true;
}

function providerRuntimeStatus(loginPayload = {}, bootstrap = {}) {
  const runtimeSession = bootstrap.runtimeSession || {};
  const provider = bootstrap.provider || {};
  return {
    providerConfigured: Boolean(
      loginPayload.providerConfigured
        ?? runtimeSession.providerConfigured
        ?? provider.providerConfigured
    ),
    providerName: String(
      loginPayload.providerName
        || runtimeSession.providerName
        || provider.providerName
        || "gflab"
    ),
    providerConfigStatus: String(
      loginPayload.providerConfigStatus
        || runtimeSession.providerConfigStatus
        || provider.providerConfigStatus
        || ""
    ),
    providerRef: String(
      loginPayload.providerConfigSecretRef
        || runtimeSession.providerConfigSecretRef
        || provider.providerConfigSecretRef
        || ""
    ),
  };
}

function launchRuntimeUrl(loginPayload = {}, bootstrap = {}) {
  return String(
    loginPayload.launch?.runtimeUrl
      || bootstrap.launch?.runtimeUrl
      || bootstrap.runtimeSession?.runtimeUrl
      || runtimeUrl
  );
}

function cookieFromSetCookie(headers, name) {
  const all = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie") || ""].filter(Boolean);
  for (const header of all) {
    const cookie = String(header || "").split(";")[0] || "";
    const [cookieName, ...value] = cookie.split("=");
    if (cookieName === name && value.length) return `${cookieName}=${value.join("=")}`;
  }
  return "";
}

function chooseSalablePlan(payload = {}, preferredPlanId = "") {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (preferredPlanId) {
    const matched = items.find((item) => String(item.id || "") === preferredPlanId);
    assert(matched, `preferred_server_plan_not_found:${preferredPlanId}`);
    assert(matched.salable === true, `preferred_server_plan_not_salable:${preferredPlanId}`);
    return matched;
  }
  const salable = items.filter((item) => item?.salable === true);
  assert(salable.length > 0, "salable_server_plan_missing");
  const runnable = salable.find((item) =>
    String(item.provisioningMode || "") === "tke_node_pool_create" &&
    Number(item.hourlyPrice || item.discountPrice || item.unitPrice || 0) > 0
  );
  return runnable || salable[0];
}

async function loginPortalLocal({ baseUrl, email, password }) {
  const body = new URLSearchParams({ email, password }).toString();
  const { response } = await fetchText(`${baseUrl}/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const cookie = cookieFromSetCookie(response.headers, "portal_session");
  assert(cookie, `portal_session_cookie_missing:${response.status}`);
  return cookie;
}

async function portalApiJson(baseUrl, pathname, cookie, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `portal_api_failed:${response.status}:${pathname}`);
  }
  return payload;
}

async function preparePortalServerPlan(task) {
  if (!hasPortalEnv()) return null;
  const portalBaseUrl = env("PORTAL_LIVE_BASE_URL").replace(/\/$/, "");
  const email = env("PORTAL_LIVE_EMAIL");
  const password = env("PORTAL_LIVE_PASSWORD");
  const cookie = await loginPortalLocal({ baseUrl: portalBaseUrl, email, password });
  const plans = await portalApiJson(portalBaseUrl, `/portal/api/server-plans?task=${encodeURIComponent(task)}`, cookie);
  const plan = chooseSalablePlan(plans, env("PORTAL_LIVE_SERVER_PLAN_ID"));
  const selected = await portalApiJson(portalBaseUrl, "/portal/api/server-plans/select", cookie, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task, planId: plan.id }),
  });
  assert.equal(selected.selectedServerPlan?.id, plan.id, "portal_live_server_plan_selection_must_persist");
  return {
    portalBaseUrl,
    workspaceId: selected.workspaceId || task,
    serverPlanId: plan.id,
    serverPlanName: plan.name || plan.id,
  };
}

if (!hasRequiredEnv()) {
  console.log(JSON.stringify({
    ok: true,
    status: "skip",
    reason: "missing_required_env",
    requiredEnv,
    runtimeUrl,
  }, null, 2));
  process.exit(0);
}

const baseUrl = env("OPL_LIVE_BASE_URL").replace(/\/$/, "");
const email = env("OPL_LIVE_EMAIL");
const password = env("OPL_LIVE_PASSWORD");
const apiKey = env("OPL_LIVE_GFLABTOKEN");
const task = env("OPL_LIVE_TASK") || "default";
const prompt = env("OPL_LIVE_PROMPT") || "请回复：v20.2 live reply ok";
const portalPreparation = await preparePortalServerPlan(task);

const evidence = {
  runtimeUrl,
  providerKeyPayload: {
    provider: "gflabtoken",
    source: "user_input",
  },
  login: null,
  launch: null,
  portalPreparation,
  sessionBind: null,
  run: null,
  status: null,
};

const loginBody = {
  email,
  password,
  task,
  apiKey,
};

const { payload: loginPayload } = await fetchJson(`${baseUrl}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(loginBody),
});

assert.equal(loginSucceeded(loginPayload), true, "live_login_must_succeed");

const launchToken = String(loginPayload.launchToken || "");
const bootstrapUrl = String(loginPayload.launch?.bootstrapUrl || "");
assert.equal(Boolean(launchToken), true, "live_launch_token_must_exist");
assert.equal(Boolean(bootstrapUrl), true, "live_bootstrap_url_must_exist");

const { payload: bootstrap } = await fetchJson(bootstrapUrl);
assert.equal(Boolean(bootstrap?.callbacks?.sessionBind), true, "live_session_bind_callback_must_exist");
assert.equal(Boolean(bootstrap?.callbacks?.message), true, "live_message_callback_must_exist");
assert.equal(Boolean(bootstrap?.callbacks?.startRun), true, "live_start_run_callback_must_exist");
assert.equal(Boolean(bootstrap?.callbacks?.runStatus), true, "live_run_status_callback_must_exist");
assert.equal(Boolean(bootstrap?.callbacks?.artifacts), true, "live_artifacts_callback_must_exist");
assert.equal(launchRuntimeUrl(loginPayload, bootstrap), runtimeUrl, "live_runtime_url_must_match_contract");

const providerStatus = providerRuntimeStatus(loginPayload, bootstrap);
assert.equal(providerStatus.providerConfigured, true, "live_login_must_configure_provider");
assert.equal(providerStatus.providerName, "gflab", "live_login_provider_name_must_be_gflab");
assert.equal(providerStatus.providerConfigStatus, "configured", "live_login_provider_status_must_be_configured");
assert.equal(Boolean(providerStatus.providerRef), true, "live_login_must_return_provider_ref");

evidence.login = {
  ok: loginSucceeded(loginPayload),
  providerConfigured: providerStatus.providerConfigured,
  providerName: providerStatus.providerName,
  providerConfigStatus: providerStatus.providerConfigStatus,
  providerRef: providerStatus.providerRef,
};

evidence.launch = {
  launchId: loginPayload.launch?.launchId || bootstrap.launch?.launchId || "",
  runtimeUrl: launchRuntimeUrl(loginPayload, bootstrap),
  oplWebUrl: loginPayload.launch?.oplWebUrl || "",
};

const { payload: sessionBind } = await fetchJson(bootstrap.callbacks.sessionBind, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    launchToken,
    oplSessionId: `opl-live-session-${Date.now()}`,
    status: "active",
  }),
});
assert.equal(Boolean(sessionBind?.runtimeSession?.oplSessionId), true, "live_session_bind_must_return_opl_session_id");

evidence.sessionBind = {
  oplSessionId: sessionBind.runtimeSession.oplSessionId,
  runtimeSessionId: sessionBind.runtimeSession.runtimeSessionId || "",
};

const messageId = `v20-2-live-reply-${Date.now()}`;
const { payload: messagePayload } = await fetchJson(bootstrap.callbacks.message, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "user-agent": "v20.2-opl-message-reply-live",
  },
  body: JSON.stringify({
    launchToken,
    messageId,
    source: "opl-web-native-message-reply",
    model: loginPayload.model || "gpt-5.5",
    message: prompt,
  }),
});

assert.equal(messagePayload.message?.messageId, messageId, "live_message_id_must_match");
assert.equal(Boolean(String(messagePayload.message?.reply || "").trim()), true, "live_message_reply_must_be_non_empty");
assert.equal(messagePayload.artifact?.kind, "message_reply", "live_message_reply_must_persist_artifact");
assert(Number(messagePayload.artifact?.sizeBytes || 0) > 0, "live_message_reply_artifact_must_be_non_empty");
evidence.run = {
  runId: messageId,
  resourceOrderId: messagePayload.message?.resourceOrderId || "",
  status: messagePayload.message?.status || "",
};

evidence.status = {
  runId: messageId,
  status: messagePayload.message.status,
  hasReply: true,
  artifactCount: 1,
};

const serializedEvidence = JSON.stringify(evidence);
assert.doesNotMatch(serializedEvidence, /sk-|gflabtoken_[A-Za-z0-9]|AKID|SECRET/i, "live_evidence_must_not_expose_secrets");
assert.doesNotMatch(serializedEvidence, new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "live_evidence_must_not_include_plaintext_api_key");

console.log(JSON.stringify({
  ok: true,
  status: "done",
  runtimeUrl,
  providerKeyPayload: evidence.providerKeyPayload,
  email: redact(email),
  providerRef: evidence.login.providerRef,
  runId: messageId,
  runStatus: evidence.status.status,
  artifactCount: evidence.status.artifactCount,
}, null, 2));
