import { createHash, randomUUID } from "node:crypto";

function stringEnv(name, fallback = "") {
  return String(process.env[name] ?? fallback);
}

function cleanEnv(name, fallback = "") {
  return stringEnv(name, fallback).trim() || fallback;
}

function urlEnv(name, fallback = "") {
  return stringEnv(name, fallback).replace(/\/$/, "");
}

function normalizeProductRuntimeMode(value = "", fallback = "platform_provisioned") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (!normalized) return fallback;
  if (["user_owned", "user-owned", "user_owned_runtime", "user-owned-runtime"].includes(normalized)) {
    return "platform_provisioned";
  }
  if (normalized === "cloud_provisioned" || normalized === "customer_dedicated") return "platform_provisioned";
  return normalized;
}

export function readConfig() {
  const port = Number(cleanEnv("PORT", "8788"));
  return {
    port,
    baseUrl: urlEnv("PORTAL_OPL_ADAPTER_PUBLIC_URL", `http://127.0.0.1:${port}`),
    launchSecret: cleanEnv("OPL_LAUNCH_SECRET", "dev-opl-launch-secret-change-me"),
    nodeEnv: cleanEnv("NODE_ENV", "development").toLowerCase(),
    buildSha: cleanEnv("BUILD_SHA", "dev"),
    buildTime: cleanEnv("BUILD_TIME", "unknown"),
    runtimeMode: cleanEnv("OPL_RUNTIME_MODE", "unknown"),
    oplWebUrl: urlEnv("OPL_WEB_URL"),
    portalInternalBaseUrl: urlEnv("PORTAL_INTERNAL_BASE_URL"),
    portalInternalAuthToken: cleanEnv("PORTAL_INTERNAL_AUTH_TOKEN"),
    productRuntimeMode: normalizeProductRuntimeMode(cleanEnv("PRODUCT_RUNTIME_MODE", "platform_provisioned")),
  };
}

export function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

export function sendRetired(res, message, replacement = "") {
  sendJson(res, 410, {
    ok: false,
    error: "legacy_endpoint_retired",
    message,
    replacement,
  });
}

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function launchTokenHash(token = "") {
  return createHash("sha256").update(String(token || "")).digest("hex").slice(0, 32);
}

export function messageIdFromInput(input = {}) {
  return input.messageId || input.message_id || input.runId || input.run_id || randomUUID();
}

export function operationModeFrom(record = {}) {
  const mode = String(record.mode || record.runtimeSessionMode || record.runtime_session_mode || "").trim().toLowerCase();
  return mode === "full_runtime" ? "full_runtime" : "api_only";
}

export function runtimeScopeFrom(record = {}) {
  return {
    mode: operationModeFrom(record),
    resourceBindingId: String(record.resourceBindingId || record.resource_binding_id || "").trim(),
    computeInstanceId: String(record.computeInstanceId || record.compute_instance_id || "").trim(),
    storageBucketId: String(record.storageBucketId || record.storage_bucket_id || "").trim(),
    runtimeAgentId: String(record.runtimeAgentId || record.runtime_agent_id || "").trim(),
    runtimeAgentEndpoint: String(record.runtimeAgentEndpoint || record.runtime_agent_endpoint || "").trim().replace(/\/$/, ""),
  };
}

export function validateFullRuntimeScope(record = {}) {
  const scope = runtimeScopeFrom(record);
  if (scope.mode !== "full_runtime") return { ok: true, scope };
  if (!scope.resourceBindingId || !scope.computeInstanceId || !scope.storageBucketId) {
    return { ok: false, status: 409, error: "resource_binding_required", code: "RESOURCE_BINDING_REQUIRED", scope };
  }
  if (!scope.runtimeAgentId && !scope.runtimeAgentEndpoint) {
    return { ok: false, status: 409, error: "platform_isolated_runtime_agent_required", code: "PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED", scope };
  }
  return { ok: true, scope };
}

export function launchTokenFrom(input = {}, url) {
  return input.launchToken || input.launch_token || url.searchParams.get("launch_token") || "";
}

export function routeKey(req, url) {
  return `${req.method || ""} ${url.pathname}`;
}

export function matchDynamicHandler(req, url, dynamicHandlers = []) {
  for (const route of dynamicHandlers) {
    const match = route.method === req.method ? url.pathname.match(route.pattern) : null;
    if (match) return { ...route, match };
  }
  return null;
}
