import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEvidenceRecorder } from "./lib/v20.33-evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.33-isolated-full-loop");
const evidenceRecorder = createEvidenceRecorder({ evidenceDir, contract: "v20.33_isolated_full_loop" });
const sensitivePattern = /cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token/i;
const tagKeys = ["resourceorderid", "runid", "serverplanid", "tenantid", "workspaceid"];
const stageOrder = [
  "admin_login",
  "admin_user_create",
  "admin_user_lookup",
  "wallet_topup",
  "portal_login",
  "storage_order",
  "workspace_upload",
  "server_plan_select",
  "resource_quote",
  "resource_freeze",
  "resource_order_visibility",
  "resource_provision",
  "user_resources",
  "opl_native_login",
  "opl_session_bind",
  "opl_message",
  "opl_file_run",
  "workspace_download",
  "billing_trace",
  "delete_node_pool",
  "post_delete_resource_binding",
  "billing_stop_observe",
  "t0_120min_checkpoint",
  "t1_audit_checkpoint",
];

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function parseEnvFileContent(source = "") {
  const values = {};
  for (const rawLine of String(source || "").replace(/^\uFEFF/, "").split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[=:]\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function envFileList(value = "") {
  return String(value || "")
    .split(/[,:]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadEnvFileIntoProcess(filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
  const parsed = parseEnvFileContent(await readFile(absolute, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

async function loadConfiguredEnvFiles() {
  const files = [
    ...envFileList(process.env.V20_33_ENV_FILE),
    ...envFileList(process.env.V20_33_SECRETS_ENV_FILE),
  ];
  for (const filePath of files) {
    await loadEnvFileIntoProcess(filePath);
  }
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function positiveIntEnv(name, fallback) {
  const parsed = Number(env(name));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function trimTrailingSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function sanitizeUrl(value = "") {
  try {
    const parsed = new URL(String(value || ""));
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return String(value || "").replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

function sanitizeText(value = "") {
  return String(value || "")
    .replace(/\b(cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token)\b[^,\n]*/gi, "$1=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[redacted]");
}

function sanitizeEvidence(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeEvidence(item));
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? sanitizeText(value) : value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      sensitivePattern.test(key) ? key : key,
      sensitivePattern.test(key) ? "[redacted]" : sanitizeEvidence(item),
    ]),
  );
}

async function writeEvidence(payload) {
  return evidenceRecorder.writeEvidence(sanitizeEvidence(payload));
}

function assertFixedHostsAndIsolatedTransport({ portalBaseUrl, oplBaseUrl }) {
  const confirmed = boolEnv("V20_33_ISOLATED_TRANSPORT_CONFIRMED");
  const connectHost = env("V20_33_CONNECT_HOST");
  const portal = new URL(portalBaseUrl);
  const opl = new URL(oplBaseUrl);
  assert.equal(portal.protocol, "https:", "v20_32_portal_base_url_must_use_https");
  assert.equal(opl.protocol, "https:", "v20_32_opl_base_url_must_use_https");
  assert.equal(portal.hostname, "portal.medopl.cn", "v20_32_portal_host_must_be_fixed_official_host");
  assert.equal(opl.hostname, "opl.medopl.cn", "v20_32_opl_host_must_be_fixed_official_host");
  assert.equal(confirmed, true, "V20_33_ISOLATED_TRANSPORT_CONFIRMED_must_be_true");
  assert(connectHost, "V20_33_CONNECT_HOST_required_for_fixed_host_isolated_transport");
}

function randomPassword() {
  return `T${randomBytes(12).toString("base64url")}9!a`;
}

function makeFixtureIdentity() {
  const slug = `test-v20-33-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`.slice(0, 44);
  return {
    slug,
    email: `test-${slug}@example.test`,
    name: `test ${slug}`,
    password: randomPassword(),
    runId: `run-${slug}`.slice(0, 63).replace(/-+$/g, ""),
    inputRelativePath: `inputs/${slug}.txt`,
    outputRelativePath: `${`run-${slug}`.slice(0, 63).replace(/-+$/g, "")}-reply.md`,
    fileText: [
      "v20.33 isolated full loop fixture",
      `workspaceId=${slug}`,
      `createdAt=${nowIso()}`,
    ].join("\n"),
  };
}

function extractCookie(setCookie, name) {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const header of headers) {
    const cookie = String(header || "").split(";")[0] || "";
    const [cookieName, ...value] = cookie.split("=");
    if (cookieName === name && value.length) return `${cookieName}=${value.join("=")}`;
  }
  return "";
}

function transportOptionsFor(target, headers = {}) {
  const connectHost = env("V20_33_CONNECT_HOST");
  const connectPort = positiveIntEnv("V20_33_CONNECT_PORT", Number(target.port || (target.protocol === "https:" ? 443 : 80)));
  const allowInsecureTls = boolEnv("V20_33_ALLOW_INSECURE_TLS");
  if (!connectHost) {
    return {
      requestTarget: target,
      headers,
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
    };
  }
  return {
    requestTarget: {
      protocol: target.protocol,
      hostname: connectHost,
      port: connectPort,
      path: `${target.pathname}${target.search}`,
    },
    headers: { ...headers, host: target.host },
    rejectUnauthorized: !allowInsecureTls && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
    servername: target.hostname,
  };
}

function requestOptionsFor(target, options = {}) {
  const transportOptions = transportOptionsFor(target, options.headers || {});
  return {
    ...transportOptions.requestTarget,
    method: options.method || "GET",
    headers: transportOptions.headers,
    rejectUnauthorized: transportOptions.rejectUnauthorized,
    servername: transportOptions.servername,
  };
}

async function requestNodeText(url, options = {}) {
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  const timeoutMs = options.timeoutMs || 120_000;
  const requestOptions = requestOptionsFor(target, options);
  return new Promise((resolve, reject) => {
    const req = transport.request(requestOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        resolve({
          response: {
            status: res.statusCode || 0,
            headers: res.headers,
          },
          bodyText: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", (error) => reject(new Error(`request_failed:${sanitizeUrl(url)}:${String(error.message || error)}`)));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function requestJson(url, options = {}) {
  const { response, bodyText } = await requestNodeText(url, options);
  let json = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {}
  return { response, bodyText, json };
}

function summarizeStatus(status, bodyText = "") {
  return `${status}:${sanitizeText(String(bodyText || "").slice(0, 260))}`;
}

async function apiJson(config, pathname, cookie, options = {}) {
  const body = options.body;
  const headers = {
    accept: "application/json",
    ...(cookie ? { cookie } : {}),
    ...(body ? { "content-type": "application/json", "content-length": String(Buffer.byteLength(String(body))) } : {}),
    ...(options.headers || {}),
  };
  const { response, bodyText, json } = await requestJson(`${config.portalBaseUrl}${pathname}`, {
    method: options.method || (body ? "POST" : "GET"),
    headers,
    body,
    timeoutMs: options.timeoutMs || config.timeoutMs,
  });
  assert(response.status >= 200 && response.status < 300, `portal_api_failed:${pathname}:${summarizeStatus(response.status, bodyText)}`);
  return json;
}

async function verifyPortalBuildTag(config) {
  const expectedBuildTag = config.expectedBuildTag;
  const { response, bodyText, json } = await requestJson(`${config.portalBaseUrl}/healthz`, {
    method: "GET",
    headers: { accept: "application/json" },
    timeoutMs: config.timeoutMs,
  });
  assert(response.status >= 200 && response.status < 300, `portal_healthz_failed:${summarizeStatus(response.status, bodyText)}`);
  const buildTag = String(json?.build?.sha || json?.buildTag || json?.version || "").trim();
  assert.equal(buildTag, expectedBuildTag, `portal_build_tag_mismatch:${buildTag || "missing"}`);
  return { buildTag, expectedBuildTag };
}

async function postForm(config, pathname, cookie, form) {
  const body = new URLSearchParams(form).toString();
  return requestNodeText(`${config.portalBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(Buffer.byteLength(body)),
      ...(cookie ? { cookie } : {}),
    },
    body,
    timeoutMs: config.timeoutMs,
  });
}

async function loginPortalSession(config, email, password) {
  const { response, bodyText } = await postForm(config, "/login", "", { email, password });
  const cookie = extractCookie(response.headers["set-cookie"], "portal_session");
  assert([302, 303].includes(response.status), `portal_login_failed:${summarizeStatus(response.status, bodyText)}`);
  assert(cookie.includes("portal_session="), "portal_session_cookie_missing");
  return cookie;
}

async function createUser(config, adminCookie, fixture) {
  const { response, bodyText } = await postForm(config, "/portal/admin/create-user", adminCookie, {
    redirectTo: "/portal/app/admin/users",
    email: fixture.email,
    name: fixture.name,
    password: fixture.password,
    role: "user",
    status: "active",
  });
  assert([302, 303].includes(response.status), `admin_user_create_failed:${summarizeStatus(response.status, bodyText)}`);
}

async function findAdminUser(config, adminCookie, email) {
  const payload = await apiJson(
    config,
    `/portal/api/admin/users?page_size=500&email=${encodeURIComponent(email)}`,
    adminCookie,
  );
  const found = (Array.isArray(payload?.items) ? payload.items : [])
    .find((item) => String(item.email || "").toLowerCase() === email.toLowerCase());
  assert(found, `created_user_not_visible:${email}`);
  return found;
}

async function rechargeUser(config, adminCookie, userId) {
  const { response, bodyText } = await postForm(config, "/portal/admin/recharge", adminCookie, {
    redirectTo: "/portal/app/admin/users",
    userId,
    amount: String(config.rechargeAmount),
  });
  assert([302, 303].includes(response.status), `wallet_topup_failed:${summarizeStatus(response.status, bodyText)}`);
}

function multipartBody(boundary, file) {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.contentType}\r\n\r\n`, "utf8"),
    Buffer.from(file.contents, "utf8"),
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
  ]);
}

async function uploadWorkspaceFile(config, userCookie, fixture) {
  const uploadUrl = await apiJson(config, "/portal/api/workspace/files/upload-url", userCookie, {
    body: JSON.stringify({
      workspaceId: fixture.slug,
      kind: "inputs",
      relativePath: fixture.inputRelativePath,
      fileName: path.basename(fixture.inputRelativePath),
    }),
  });
  const boundary = `----v20-33-${randomBytes(8).toString("hex")}`;
  const body = multipartBody(boundary, {
    name: path.basename(fixture.inputRelativePath),
    contentType: "text/plain; charset=utf-8",
    contents: fixture.fileText,
  });
  const { response, bodyText, json } = await requestJson(`${config.portalBaseUrl}${uploadUrl.url}`, {
    method: "POST",
    headers: {
      cookie: userCookie,
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length),
    },
    body,
    timeoutMs: config.timeoutMs,
  });
  assert(response.status >= 200 && response.status < 300, `workspace_upload_failed:${summarizeStatus(response.status, bodyText)}`);
  assert.equal(String(json?.file?.relativePath || ""), fixture.inputRelativePath, "workspace_upload_relative_path_mismatch");
  return json;
}

async function chooseServerPlan(config, userCookie, fixture) {
  const payload = await apiJson(config, `/portal/api/server-plans?task=${encodeURIComponent(fixture.slug)}`, userCookie);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const selected = config.serverPlanId
    ? items.find((item) => String(item.id || "") === config.serverPlanId)
    : items.find((item) =>
        (item.salable === true || item.canOrder === true) &&
        String(item.provisioningMode || "") === "tke_node_pool_create"
      );
  assert(selected, "salable_server_plan_missing");
  assert(selected.salable === true || selected.canOrder === true, `server_plan_not_salable:${String(selected.id || "")}`);
  assert.equal(String(selected.provisioningMode || ""), "tke_node_pool_create", `server_plan_must_create_tke_node_pool:${String(selected.id || "")}`);
  await apiJson(config, "/portal/api/server-plans/select", userCookie, {
    body: JSON.stringify({ task: fixture.slug, planId: selected.id }),
  });
  return selected;
}

async function quoteFreezeProvision(config, userCookie, fixture, selectedPlan) {
  const quote = await apiJson(config, "/portal/api/resource-orders/quote", userCookie, {
    body: JSON.stringify({
      workspaceId: fixture.slug,
      task: fixture.slug,
      serverPlanId: selectedPlan.id,
      runId: fixture.runId,
      storagePlanId: `cos-${config.storageGb}gb`,
      storageSizeGb: config.storageGb,
      estimatedHours: 1,
    }),
  });
  const resourceOrderId = String(quote?.resourceOrderId || quote?.order?.id || "");
  assert(resourceOrderId, "resource_quote_order_id_missing");
  const freeze = await apiJson(config, "/portal/api/resource-orders/freeze", userCookie, {
    body: JSON.stringify({ resourceOrderId }),
  });
  assert.equal(String(freeze?.order?.status || freeze?.status || "").toLowerCase(), "frozen", "resource_freeze_status_mismatch");
  const provision = await apiJson(config, "/portal/api/resource-orders/provision", userCookie, {
    body: JSON.stringify({ resourceOrderId, runId: fixture.runId }),
    timeoutMs: config.provisionTimeoutMs,
  });
  assert(provision?.ok === true || ["running", "provisioning"].includes(String(provision?.order?.status || "").toLowerCase()), "resource_provision_failed");
  return { quote, freeze, provision, resourceOrderId };
}

function assertBillingTags(binding, expected) {
  for (const key of tagKeys) {
    assert(String(binding?.billingTags?.[key] || "").trim(), `billing_tag_missing:${key}`);
  }
  assert.equal(String(binding.billingTags.resourceorderid), expected.resourceOrderId, "resourceorderid_tag_mismatch");
  assert.equal(String(binding.billingTags.runid), expected.runId, "runid_tag_mismatch");
  assert.equal(String(binding.billingTags.serverplanid), expected.serverPlanId, "serverplanid_tag_mismatch");
  assert.equal(String(binding.billingTags.workspaceid), expected.workspaceId, "workspaceid_tag_mismatch");
}

async function verifyMyResources(config, userCookie, expected) {
  const payload = await apiJson(config, "/portal/api/my/resources", userCookie);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const binding = items.find((item) => String(item.resourceOrderId || "") === expected.resourceOrderId);
  assert(binding, `resource_binding_missing:${expected.resourceOrderId}`);
  assertBillingTags(binding, expected);
  return binding;
}

async function inspectResourceOrderVisibility(config, userCookie, expectedResourceOrderId) {
  const [ordersPayload, resourcesPayload] = await Promise.all([
    apiJson(config, "/portal/api/resource-orders", userCookie),
    apiJson(config, "/portal/api/my/resources", userCookie),
  ]);
  const resourceOrders = Array.isArray(ordersPayload?.items) ? ordersPayload.items : [];
  const resources = Array.isArray(resourcesPayload?.items) ? resourcesPayload.items : [];
  const resourceOrder = resourceOrders.find((item) =>
    String(item.id || item.resourceOrderId || "") === expectedResourceOrderId
  ) || null;
  const resourceBinding = resources.find((item) =>
    String(item.resourceOrderId || item.id || "") === expectedResourceOrderId
  ) || null;
  return {
    expectedResourceOrderId,
    visibleInResourceOrders: Boolean(resourceOrder),
    visibleInMyResources: Boolean(resourceBinding),
    resourceOrderStatus: String(resourceOrder?.status || resourceBinding?.status || ""),
    workspaceId: String(resourceOrder?.workspaceId || resourceBinding?.workspaceId || ""),
    runId: String(resourceOrder?.runId || resourceBinding?.runId || ""),
    serverPlanId: String(resourceOrder?.serverPlanId || resourceBinding?.serverPlanId || ""),
    resourceOrderEventCount: Array.isArray(resourceOrder?.events) ? resourceOrder.events.length : 0,
    resourceOrderCount: resourceOrders.length,
    myResourceCount: resources.length,
    sources: {
      resourceOrders: String(ordersPayload?.source || ""),
      myResources: String(resourcesPayload?.source || ""),
    },
  };
}

async function nativeOplLogin(config, fixture) {
  const { response, bodyText, json } = await requestJson(`${config.oplBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: fixture.email,
      password: fixture.password,
      apiKey: config.gflabtoken,
      task: fixture.slug,
    }),
    timeoutMs: config.timeoutMs,
  });
  assert(response.status >= 200 && response.status < 300, `opl_native_login_failed:${summarizeStatus(response.status, bodyText)}`);
  assert(json?.launchToken, "opl_launch_token_missing");
  assert(json?.launch?.bootstrapUrl, "opl_bootstrap_url_missing");
  return json;
}

async function absoluteJson(url, options = {}) {
  const { response, bodyText, json } = await requestJson(url, options);
  assert(response.status >= 200 && response.status < 300, `absolute_request_failed:${sanitizeUrl(url)}:${summarizeStatus(response.status, bodyText)}`);
  return json;
}

async function prepareOplBootstrap(config, launch, fixture) {
  const bootstrap = await absoluteJson(launch.launch.bootstrapUrl, { timeoutMs: config.timeoutMs });
  assert(bootstrap?.callbacks?.sessionBind, "opl_session_bind_callback_missing");
  assert(bootstrap?.callbacks?.message, "opl_message_callback_missing");
  assert(bootstrap?.callbacks?.startRun, "opl_start_run_callback_missing");
  assert(bootstrap?.callbacks?.runStatus, "opl_run_status_callback_missing");
  assert(bootstrap?.callbacks?.artifacts, "opl_artifacts_callback_missing");
  const oplSessionId = `opl-${fixture.runId}`.slice(0, 63);
  const bound = await absoluteJson(bootstrap.callbacks.sessionBind, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      launchToken: launch.launchToken,
      oplSessionId,
      status: "active",
    }),
    timeoutMs: config.timeoutMs,
  });
  assert.equal(bound?.runtimeSession?.oplSessionId, oplSessionId, "opl_session_bind_mismatch");
  return { bootstrap, oplSessionId };
}

async function sendOplMessage(config, launch, bootstrap, fixture) {
  const startedAt = Date.now();
  const payload = await absoluteJson(bootstrap.callbacks.message, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "v20.33-isolated-full-loop" },
    body: JSON.stringify({
      launchToken: launch.launchToken,
      messageId: `${fixture.runId}-message`,
      message: "请回复：v20.33 isolated full loop ok",
      waitForCompletion: true,
      model: "gpt-5.4",
      tokenCount: 32,
    }),
    timeoutMs: config.oplTimeoutMs,
  });
  const latencyMs = Date.now() - startedAt;
  assert(payload?.ok === true, "opl_message_not_ok");
  assert(String(payload?.message?.reply || "").trim(), "opl_message_reply_empty");
  return { payload, latencyMs };
}

async function startOplFileRun(config, launch, bootstrap, fixture) {
  const run = await absoluteJson(bootstrap.callbacks.startRun, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "v20.33-isolated-full-loop" },
    body: JSON.stringify({
      launchToken: launch.launchToken,
      runId: fixture.runId,
      agentId: "mas",
      toolName: "v20.33-isolated-full-loop",
      source: "v20.33-isolated-full-loop",
      input: { relativePath: fixture.inputRelativePath, message: "process uploaded file and produce output" },
      model: "gpt-5.4",
      tokenCount: 64,
    }),
    timeoutMs: config.oplTimeoutMs,
  });
  assert(run?.ok === true && run?.run?.runId === fixture.runId, "opl_file_run_start_failed");
  const statusUrl = String(bootstrap.callbacks.runStatus).replace("{runId}", encodeURIComponent(fixture.runId));
  const artifactsUrl = String(bootstrap.callbacks.artifacts).replace("{runId}", encodeURIComponent(fixture.runId));
  const status = await poll(config, async () => {
    const current = await absoluteJson(statusUrl, { timeoutMs: config.timeoutMs });
    const state = String(current?.run?.status || "").toLowerCase();
    assert(["succeeded", "failed", "cancelled", "timeout"].includes(state), `opl_file_run_not_terminal:${state}`);
    return current;
  }, "opl_file_run_status");
  assert.equal(String(status?.run?.status || "").toLowerCase(), "succeeded", "opl_file_run_not_succeeded");
  const artifacts = await absoluteJson(artifactsUrl, { timeoutMs: config.timeoutMs });
  assert((Array.isArray(artifacts?.items) ? artifacts.items : []).length > 0, "opl_file_run_artifacts_missing");
  return { run, status, artifacts };
}

function outputPathFromArtifact(artifact = {}) {
  const candidates = [
    artifact.relativePath,
    artifact.relative_path,
    artifact.objectKey,
    artifact.object_key,
    artifact.localPath,
    artifact.local_path,
    artifact.path,
    artifact.name,
  ].map((value) => String(value || "").replaceAll("\\", "/").trim()).filter(Boolean);
  for (const candidate of candidates) {
    const outputsIndex = candidate.lastIndexOf("/outputs/");
    if (outputsIndex >= 0) return candidate.slice(outputsIndex + "/outputs/".length).replace(/^\/+/, "");
    if (!candidate.includes("/") && candidate) return candidate;
  }
  return "";
}

async function downloadWorkspaceOutput(config, userCookie, fixture, artifact) {
  const outputRelativePath = outputPathFromArtifact(artifact);
  assert(outputRelativePath, "workspace_output_artifact_relative_path_missing");
  const download = await apiJson(
    config,
    `/portal/api/workspace/files/download-url?workspaceId=${encodeURIComponent(fixture.slug)}&kind=outputs&relativePath=${encodeURIComponent(outputRelativePath)}`,
    userCookie,
  );
  const { response, bodyText } = await requestNodeText(`${config.portalBaseUrl}${download.url}`, {
    method: "GET",
    headers: { cookie: userCookie },
    timeoutMs: config.timeoutMs,
  });
  assert(response.status >= 200 && response.status < 300, `workspace_download_failed:${summarizeStatus(response.status, bodyText)}`);
  assert(Buffer.byteLength(bodyText || "") > 0, "workspace_download_empty");
  return { relativePath: outputRelativePath, sizeBytes: Buffer.byteLength(bodyText || "") };
}

async function verifyBillingTrace(config, userCookie, fixture, resourceOrderId) {
  const [billing, summary, traces] = await Promise.all([
    apiJson(config, "/portal/api/billing", userCookie),
    apiJson(config, "/portal/api/billing/me/summary", userCookie),
    apiJson(config, `/portal/api/session-traces?workspaceId=${encodeURIComponent(fixture.slug)}&page_size=200`, userCookie),
  ]);
  const traceItems = Array.isArray(traces?.items) ? traces.items : [];
  assert(traceItems.length > 0, "session_trace_missing");
  return {
    billingSource: String(billing?.source || billing?.pricingSource || ""),
    walletBalanceCents: Number(summary?.balanceCents || 0),
    traceCount: traceItems.length,
    resourceOrderId,
  };
}

async function deleteNodePool(config, userCookie, resourceOrderId) {
  assert.equal(boolEnv("V20_33_CONFIRM_DELETE"), true, "V20_33_CONFIRM_DELETE_must_be_true_before_delete");
  const deleteNodePoolPayload = {
    resourceOrderId,
    confirmDeleteNodePool: true,
    destroyCvmInstances: true,
    confirmation: "delete-node-pool",
  };
  const payload = await apiJson(config, "/portal/api/resource-orders/delete-node-pool", userCookie, {
    body: JSON.stringify(deleteNodePoolPayload),
    timeoutMs: config.provisionTimeoutMs,
  });
  assert(payload?.ok === true || String(payload?.order?.status || "").toLowerCase() === "released", "delete_node_pool_failed");
  return payload;
}

async function verifyPostDeleteResourceBinding(config, userCookie, resourceOrderId) {
  const payload = await apiJson(config, "/portal/api/my/resources", userCookie);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const binding = items.find((item) => String(item.resourceOrderId || "") === String(resourceOrderId || ""));
  assert(binding, `post_delete_resource_binding_missing:${resourceOrderId}`);
  assert.equal(String(binding.status || "").toLowerCase(), "released", "post_delete_resource_status_must_be_released");
  assert.equal(String(binding.storageStatus || "").toLowerCase(), "deleting", "post_delete_storage_status_must_be_deleting");
  assert(String(binding.storageDeletedAt || "").trim(), "post_delete_storage_deleted_at_missing");
  assert(String(binding.storageBillingStoppedAt || "").trim(), "post_delete_storage_billing_stopped_at_missing");
  assert(String(binding.retentionCleanupAfterAt || "").trim(), "post_delete_storage_retention_cleanup_missing");
  return binding;
}

async function observeBillingStop(config, userCookie, fixture, resourceOrderId) {
  const before = await apiJson(config, `/portal/api/costs/run?runId=${encodeURIComponent(fixture.runId)}`, userCookie);
  if (config.billingObserveMinutes > 0) {
    await new Promise((resolve) => setTimeout(resolve, config.billingObserveMinutes * 60 * 1000));
  }
  const after = await apiJson(config, `/portal/api/costs/run?runId=${encodeURIComponent(fixture.runId)}`, userCookie);
  return {
    resourceOrderId,
    before: sanitizeEvidence(before),
    after: sanitizeEvidence(after),
    observeMinutes: config.billingObserveMinutes,
  };
}

function checkpointEvidence(label, config, fixture, resourceOrderId) {
  return {
    label,
    workspaceId: fixture.slug,
    runId: fixture.runId,
    resourceOrderId,
    expected120minMinutes: config.expected120MinMinutes,
    auditMode: label === "t1_audit_checkpoint" ? "t_plus_1" : "same_day",
  };
}

async function poll(config, task, label) {
  const deadline = Date.now() + config.pollTimeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      return await task();
    } catch (error) {
      lastError = String(error.message || error);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollMs));
  }
  throw new Error(`${label}_timeout:${sanitizeText(lastError)}`);
}

function buildConfig() {
  const portalBaseUrl = trimTrailingSlash(env("V20_33_PORTAL_BASE_URL", "https://portal.medopl.cn"));
  const oplBaseUrl = trimTrailingSlash(env("V20_33_OPL_BASE_URL", "https://opl.medopl.cn"));
  return {
    portalBaseUrl,
    oplBaseUrl,
    expectedBuildTag: env("V20_33_EXPECTED_BUILD_TAG", "opl-v20.33"),
    adminEmail: env("V20_33_ADMIN_EMAIL", env("PORTAL_ADMIN_EMAIL")),
    adminPassword: env("V20_33_ADMIN_PASSWORD", env("PORTAL_ADMIN_PASSWORD")),
    gflabtoken: env("V20_33_GFLABTOKEN", env("GFLABTOKEN")),
    rechargeAmount: positiveIntEnv("V20_33_RECHARGE_AMOUNT", 1000),
    storageGb: positiveIntEnv("V20_33_STORAGE_GB", 10),
    serverPlanId: env("V20_33_SERVER_PLAN_ID", "cpu-2c4g"),
    billingObserveMinutes: Number(env("V20_33_BILLING_OBSERVE_MINUTES", "0")),
    expected120MinMinutes: positiveIntEnv("V20_33_EXPECTED_120MIN_MINUTES", 120),
    timeoutMs: positiveIntEnv("V20_33_HTTP_TIMEOUT_MS", 120_000),
    oplTimeoutMs: positiveIntEnv("V20_33_OPL_TIMEOUT_MS", 240_000),
    provisionTimeoutMs: positiveIntEnv("V20_33_PROVISION_TIMEOUT_MS", 15 * 60_000),
    pollTimeoutMs: positiveIntEnv("V20_33_POLL_TIMEOUT_MS", 15 * 60_000),
    pollMs: positiveIntEnv("V20_33_POLL_MS", 5_000),
  };
}

function assertRequiredConfig(config) {
  const missing = [
    ["V20_33_ADMIN_EMAIL", config.adminEmail],
    ["V20_33_ADMIN_PASSWORD", config.adminPassword],
    ["V20_33_GFLABTOKEN", config.gflabtoken],
  ].filter(([, value]) => !value).map(([name]) => name);
  assert.equal(missing.length, 0, `missing_required_env:${missing.join(",")}`);
}

function addStage(evidence, stage, details = {}) {
  const at = nowIso();
  const item = {
    stage,
    at,
    startedAt: details.startedAt || at,
    endedAt: details.endedAt || at,
    latencyMs: Number.isFinite(Number(details.latencyMs)) ? Number(details.latencyMs) : 0,
    ok: details.ok ?? true,
    blockingUser: details.blockingUser ?? false,
    userVisibleState: details.userVisibleState || stage,
    ...sanitizeEvidence(details),
  };
  evidence.stages.push(item);
  evidenceRecorder.addStage(stage, item);
}

async function runStage(evidence, stage, costRisk, task, detailsForResult = (result) => result || {}, detailsForError = () => ({})) {
  const startedAt = nowIso();
  const startedMs = Date.now();
  try {
    const result = await task();
    const endedAt = nowIso();
    addStage(evidence, stage, {
      startedAt,
      endedAt,
      latencyMs: Date.now() - startedMs,
      costRisk,
      ...detailsForResult(result),
    });
    return result;
  } catch (error) {
    const endedAt = nowIso();
    addStage(evidence, stage, {
      startedAt,
      endedAt,
      latencyMs: Date.now() - startedMs,
      costRisk,
      ok: false,
      error: sanitizeText(error instanceof Error ? error.message : String(error)),
      ...detailsForError(error),
    });
    throw error;
  }
}

if (env("RUN_V20_33_FULL_LOOP") !== "1") {
  evidenceRecorder.addStage("full_loop_skip", {
    blockingUser: false,
    userVisibleState: "v20.33 isolated full loop is waiting for explicit RUN_V20_33_FULL_LOOP opt-in",
  });
  const payload = {
    ok: true,
    status: "skip",
    reason: "RUN_V20_33_FULL_LOOP_not_enabled",
    requiredEnv: [
      "RUN_V20_33_FULL_LOOP",
      "V20_33_ISOLATED_TRANSPORT_CONFIRMED",
      "V20_33_CONNECT_HOST",
      "V20_33_CONFIRM_DELETE",
      "V20_33_PORTAL_BASE_URL",
      "V20_33_OPL_BASE_URL",
      "V20_33_EXPECTED_BUILD_TAG",
      "V20_33_ADMIN_EMAIL",
      "V20_33_ADMIN_PASSWORD",
      "V20_33_GFLABTOKEN",
      "V20_33_RECHARGE_AMOUNT",
      "V20_33_STORAGE_GB",
      "V20_33_SERVER_PLAN_ID",
      "V20_33_BILLING_OBSERVE_MINUTES",
    ],
    stageOrder,
  };
  payload.evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

await loadConfiguredEnvFiles();

const config = buildConfig();
const fixture = makeFixtureIdentity();
const evidence = {
  status: "running",
  startedAt: nowIso(),
  finishedAt: "",
  hosts: {
    portal: sanitizeUrl(config.portalBaseUrl),
    opl: sanitizeUrl(config.oplBaseUrl),
  },
  fixture: {
    email: fixture.email,
    workspaceId: fixture.slug,
    runId: fixture.runId,
  },
  stages: [],
};

try {
  assertFixedHostsAndIsolatedTransport(config);
  assertRequiredConfig(config);
  const portalBuild = await verifyPortalBuildTag(config);
  evidence.portalBuild = portalBuild;

  const adminCookie = await runStage(
    evidence,
    "admin_login",
    "no_cloud_resource",
    () => loginPortalSession(config, config.adminEmail, config.adminPassword),
    () => ({ email: config.adminEmail }),
  );
  await runStage(
    evidence,
    "admin_user_create",
    "no_cloud_resource",
    () => createUser(config, adminCookie, fixture),
    () => ({ email: fixture.email }),
  );

  const createdUser = await runStage(
    evidence,
    "admin_user_lookup",
    "no_cloud_resource",
    () => findAdminUser(config, adminCookie, fixture.email),
    (user) => ({ userId: user.id, email: fixture.email }),
  );
  await runStage(
    evidence,
    "wallet_topup",
    "wallet_ledger_mutation",
    () => rechargeUser(config, adminCookie, createdUser.id),
    () => ({ userId: createdUser.id, rechargeAmount: config.rechargeAmount }),
  );

  const { userCookie, me } = await runStage(
    evidence,
    "portal_login",
    "no_cloud_resource",
    async () => {
      const cookie = await loginPortalSession(config, fixture.email, fixture.password);
      const payload = await apiJson(config, "/portal/api/me", cookie);
      assert.equal(String(payload?.email || "").toLowerCase(), fixture.email.toLowerCase(), "portal_login_identity_mismatch");
      return { userCookie: cookie, me: payload };
    },
    (result) => ({ userId: result.me.id, email: fixture.email }),
  );

  await runStage(
    evidence,
    "storage_order",
    "storage_billing",
    async () => {
      const storage = await apiJson(config, "/portal/api/storage/orders", userCookie, {
        body: JSON.stringify({
          workspaceId: fixture.slug,
          storageSizeGb: config.storageGb,
          storagePlanId: `cos-${config.storageGb}gb`,
        }),
      });
      assert(storage?.ok === true, "storage_order_failed");
      return storage;
    },
    (storage) => ({ workspaceId: fixture.slug, storageOrderId: storage?.order?.id || "", storageGb: config.storageGb }),
  );

  await runStage(
    evidence,
    "workspace_upload",
    "storage_io",
    () => uploadWorkspaceFile(config, userCookie, fixture),
    (uploaded) => ({ workspaceId: fixture.slug, fileId: uploaded?.file?.id || "", relativePath: fixture.inputRelativePath }),
  );

  const selectedPlan = await runStage(
    evidence,
    "server_plan_select",
    "no_cloud_resource",
    () => chooseServerPlan(config, userCookie, fixture),
    (plan) => ({ serverPlanId: plan.id, provisioningMode: plan.provisioningMode }),
  );
  const quote = await runStage(
    evidence,
    "resource_quote",
    "wallet_freeze_preview",
    async () => {
      const payload = await apiJson(config, "/portal/api/resource-orders/quote", userCookie, {
        body: JSON.stringify({
          workspaceId: fixture.slug,
          task: fixture.slug,
          serverPlanId: selectedPlan.id,
          runId: fixture.runId,
          storagePlanId: `cos-${config.storageGb}gb`,
          storageSizeGb: config.storageGb,
          estimatedHours: 1,
        }),
      });
      const resourceOrderId = String(payload?.resourceOrderId || payload?.order?.id || "");
      assert(resourceOrderId, "resource_quote_order_id_missing");
      return { payload, resourceOrderId };
    },
    (result) => ({ resourceOrderId: result.resourceOrderId, serverPlanId: selectedPlan.id }),
  );
  await runStage(
    evidence,
    "resource_freeze",
    "wallet_ledger_mutation",
    async () => {
      const freeze = await apiJson(config, "/portal/api/resource-orders/freeze", userCookie, {
        body: JSON.stringify({ resourceOrderId: quote.resourceOrderId }),
      });
      assert.equal(String(freeze?.order?.status || freeze?.status || "").toLowerCase(), "frozen", "resource_freeze_status_mismatch");
      const freezeResourceOrderId = String(freeze?.resourceOrderId || freeze?.order?.id || "");
      assert.equal(freezeResourceOrderId, quote.resourceOrderId, "resource_freeze_order_id_mismatch");
      return freeze;
    },
    (freeze) => ({
      resourceOrderId: quote.resourceOrderId,
      freezeResourceOrderId: String(freeze?.resourceOrderId || freeze?.order?.id || ""),
    }),
  );
  const preProvisionVisibility = await runStage(
    evidence,
    "resource_order_visibility",
    "no_cloud_resource",
    () => inspectResourceOrderVisibility(config, userCookie, quote.resourceOrderId),
    (visibility) => visibility,
  );
  const provision = await runStage(
    evidence,
    "resource_provision",
    "cloud_resource",
    async () => {
      const payload = await apiJson(config, "/portal/api/resource-orders/provision", userCookie, {
        body: JSON.stringify({ resourceOrderId: quote.resourceOrderId, runId: fixture.runId }),
        timeoutMs: config.provisionTimeoutMs,
      });
      assert(payload?.ok === true || ["running", "provisioning"].includes(String(payload?.order?.status || "").toLowerCase()), "resource_provision_failed");
      return payload;
    },
    (payload) => ({
      resourceOrderId: quote.resourceOrderId,
      status: payload?.order?.status || "",
      preProvisionVisibility,
    }),
    () => ({
      resourceOrderId: quote.resourceOrderId,
      preProvisionVisibility,
    }),
  );
  const ordered = { resourceOrderId: quote.resourceOrderId, quote: quote.payload, provision };

  const binding = await runStage(
    evidence,
    "user_resources",
    "no_cloud_resource",
    () => verifyMyResources(config, userCookie, {
      resourceOrderId: ordered.resourceOrderId,
      runId: fixture.runId,
      serverPlanId: String(selectedPlan.id || ""),
      workspaceId: fixture.slug,
    }),
    (item) => ({
      resourceOrderId: item.resourceOrderId,
      nodePoolId: item.nodePoolId,
      cvmCount: Array.isArray(item.cvmInstanceIds) ? item.cvmInstanceIds.length : 0,
      billingTags: item.billingTags,
    }),
  );

  const launch = await runStage(
    evidence,
    "opl_native_login",
    "no_cloud_resource",
    () => nativeOplLogin(config, fixture),
    (payload) => ({ launchId: payload?.launch?.launchId || "", hasBootstrapUrl: Boolean(payload?.launch?.bootstrapUrl) }),
  );
  const { bootstrap } = await runStage(
    evidence,
    "opl_session_bind",
    "no_cloud_resource",
    () => prepareOplBootstrap(config, launch, fixture),
    (payload) => ({ oplSessionId: payload.oplSessionId }),
  );
  await runStage(
    evidence,
    "opl_message",
    "model_call",
    () => sendOplMessage(config, launch, bootstrap, fixture),
    (message) => ({
      firstReplyLatencyMs: message.latencyMs,
      completeReplyLatencyMs: message.latencyMs,
      messageId: message.payload?.message?.messageId || "",
    }),
  );

  const fileRun = await runStage(
    evidence,
    "opl_file_run",
    "model_call_and_storage_io",
    () => startOplFileRun(config, launch, bootstrap, fixture),
    (payload) => ({ runId: fixture.runId, artifactCount: payload.artifacts?.items?.length || 0 }),
  );

  const [firstArtifact] = Array.isArray(fileRun.artifacts?.items) ? fileRun.artifacts.items : [];
  await runStage(
    evidence,
    "workspace_download",
    "storage_io",
    () => downloadWorkspaceOutput(config, userCookie, fixture, firstArtifact),
    (download) => download,
  );

  await runStage(
    evidence,
    "billing_trace",
    "no_cloud_resource",
    () => verifyBillingTrace(config, userCookie, fixture, ordered.resourceOrderId),
    (billingTrace) => billingTrace,
  );

  await runStage(
    evidence,
    "delete_node_pool",
    "cloud_resource_delete",
    () => deleteNodePool(config, userCookie, ordered.resourceOrderId),
    (deleted) => ({ resourceOrderId: ordered.resourceOrderId, status: deleted?.order?.status || "", destroyCvmInstances: true }),
  );

  await runStage(
    evidence,
    "post_delete_resource_binding",
    "no_cloud_resource",
    () => verifyPostDeleteResourceBinding(config, userCookie, ordered.resourceOrderId),
    (postDeleteBinding) => ({
      resourceOrderId: postDeleteBinding.resourceOrderId,
      storageOrderId: postDeleteBinding.storageOrderId,
      storageStatus: postDeleteBinding.storageStatus,
      storageBillingStoppedAt: postDeleteBinding.storageBillingStoppedAt,
      retentionCleanupAfterAt: postDeleteBinding.retentionCleanupAfterAt,
    }),
  );

  await runStage(
    evidence,
    "billing_stop_observe",
    "no_cloud_resource",
    () => observeBillingStop(config, userCookie, fixture, ordered.resourceOrderId),
    (billingStop) => billingStop,
  );
  addStage(evidence, "t0_120min_checkpoint", { ...checkpointEvidence("t0_120min_checkpoint", config, fixture, ordered.resourceOrderId), costRisk: "no_cloud_resource" });
  addStage(evidence, "t1_audit_checkpoint", { ...checkpointEvidence("t1_audit_checkpoint", config, fixture, ordered.resourceOrderId), costRisk: "t_plus_1_deferred" });

  evidence.status = "done";
  evidence.finishedAt = nowIso();
  const payload = {
    ok: true,
    status: "live",
    contract: "v20.33_isolated_full_loop",
    evidence,
  };
  payload.evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify(sanitizeEvidence(payload), null, 2));
} catch (error) {
  evidence.status = "failed";
  evidence.finishedAt = nowIso();
  evidence.error = sanitizeText(error instanceof Error ? error.message : String(error));
  const payload = {
    ok: false,
    status: "failed",
    contract: "v20.33_isolated_full_loop",
    evidence,
  };
  payload.evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify(sanitizeEvidence(payload), null, 2));
  process.exitCode = 1;
}
