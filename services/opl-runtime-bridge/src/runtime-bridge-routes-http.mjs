import { createHash, randomUUID } from "node:crypto";
import {
  hasRequiredFullRuntimeScope,
  normalizeRuntimeSessionMode,
  runtimeScopeFrom as runtimeScopeFromPrimitive,
} from "./runtime-bridge-scope-primitives.mjs";

function stringEnv(name, fallback = "") {
  return String(process.env[name] ?? fallback);
}

function cleanEnv(name, fallback = "") {
  return stringEnv(name, fallback).trim() || fallback;
}

function urlEnv(name, fallback = "") {
  return stringEnv(name, fallback).replace(/\/$/, "");
}

export function isWebuiRuntimeMode(value = process.env.OPL_RUNTIME_MODE) {
  return String(value || "").trim().toLowerCase() === "webui";
}

function normalizeProductRuntimeMode(value = "", fallback = "platform_provisioned") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "cloud_provisioned" || normalized === "customer_dedicated") return "platform_provisioned";
  return normalized;
}

export function readConfig() {
  const port = Number(cleanEnv("PORT", "8788"));
  const webuiMode = isWebuiRuntimeMode(cleanEnv("OPL_RUNTIME_MODE", "unknown"));
  return {
    port,
    baseUrl: urlEnv("PORTAL_RUNTIME_BRIDGE_PUBLIC_URL", `http://127.0.0.1:${port}`),
    launchSecret: cleanEnv("OPL_LAUNCH_SECRET", "dev-opl-launch-secret-change-me"),
    runnerImage: cleanEnv("MED_AUTOSCIENCE_RUNNER_IMAGE"),
    k8sNamespace: cleanEnv("K8S_NAMESPACE", "med-agent-demo"),
    nodeEnv: cleanEnv("NODE_ENV", "development").toLowerCase(),
    buildSha: cleanEnv("BUILD_SHA", "dev"),
    buildTime: cleanEnv("BUILD_TIME", "unknown"),
    runtimeMode: cleanEnv("OPL_RUNTIME_MODE", "unknown"),
    webuiProviderMessageEnabled: webuiMode && cleanEnv("OPL_WEBUI_PROVIDER_MESSAGE_ENABLED") === "1",
    oplWebUrl: urlEnv("OPL_WEB_URL"),
    runnerUrl: urlEnv("MED_AUTOSCIENCE_RUNNER_URL"),
    portalInternalBaseUrl: urlEnv("PORTAL_INTERNAL_BASE_URL"),
    portalInternalAuthToken: cleanEnv("PORTAL_INTERNAL_AUTH_TOKEN"),
    localFakeRuntimeRelay: cleanEnv("OPL_RUNTIME_BRIDGE_LOCAL_FAKE_RUNTIME") === "1",
    runtimeAgentRelayMode: cleanEnv("OPL_RUNTIME_AGENT_RELAY_MODE"),
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

export function buildLaunchCookie(launchToken = "") {
  return `opl_portal_launch=${encodeURIComponent(String(launchToken || ""))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`;
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

export function runIdFromInput(input = {}) {
  return input.runId || input.run_id || randomUUID();
}

export function traceIdFromInput(input = {}) {
  return input.traceId || input.trace_id || `trace-${randomUUID()}`;
}

export function operationModeFrom(record = {}) {
  return normalizeRuntimeSessionMode(record);
}

export function runtimeScopeFrom(record = {}) {
  return runtimeScopeFromPrimitive(record);
}

export function validateFullRuntimeScope(record = {}) {
  const scope = runtimeScopeFrom(record);
  if (scope.mode !== "full_runtime") return { ok: true, scope };
  if (!hasRequiredFullRuntimeScope(scope, { requireRuntimeAgent: false })) {
    return { ok: false, status: 409, error: "resource_binding_required", code: "RESOURCE_BINDING_REQUIRED", scope };
  }
  if (!hasRequiredFullRuntimeScope(scope)) {
    return { ok: false, status: 409, error: "platform_isolated_runtime_agent_required", code: "PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED", scope };
  }
  return { ok: true, scope };
}

function authorizationBearerFrom(req = null) {
  const authorization = String(req?.headers?.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export function launchTokenFrom(input = {}, url, req = null) {
  return authorizationBearerFrom(req);
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
