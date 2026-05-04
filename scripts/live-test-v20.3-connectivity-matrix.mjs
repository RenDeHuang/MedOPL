import assert from "node:assert/strict";
import { REQUIRED_EDGES } from "./smoke-test-v20.3-connectivity-matrix-contract.mjs";

function env(name) {
  return String(process.env[name] || "").trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function pickBaseUrl(primary, legacy, fallback) {
  const value = env(primary) || env(legacy) || fallback;
  return value.replace(/\/+$/, "");
}

function getBuildTag(headers) {
  return (
    headers.get("x-build-tag")
    || headers.get("x-release")
    || headers.get("x-version")
    || "unknown"
  );
}

function getCorrelationId(headers, fallback) {
  return (
    headers.get("x-correlation-id")
    || headers.get("x-request-id")
    || headers.get("traceparent")
    || fallback
  );
}

function buildTagFromBody(text) {
  try {
    const payload = JSON.parse(text || "{}");
    return String(payload?.build?.sha || payload?.buildTag || payload?.version || "");
  } catch {
    return "";
  }
}

function fetchSuccessPayload(response, text, start) {
  return {
    ok: response.ok,
    status: response.status,
    latencyMs: Date.now() - start,
    buildTag: buildTagFromBody(text) || getBuildTag(response.headers),
    correlationId: getCorrelationId(response.headers, `conn-${Date.now()}`),
  };
}

function fetchFailurePayload(error, start) {
  return {
    ok: false,
    status: 0,
    latencyMs: Date.now() - start,
    buildTag: "unknown",
    correlationId: `conn-${Date.now()}`,
    reason: error instanceof Error ? error.message : String(error),
  };
}

async function timedFetch(url, init, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text().catch(() => "");
    return fetchSuccessPayload(response, text, start);
  } catch (error) {
    return fetchFailurePayload(error, start);
  } finally {
    clearTimeout(timer);
  }
}

async function probeService(baseUrl, paths) {
  for (const path of paths) {
    const result = await timedFetch(`${baseUrl}${path}`, { method: "GET", redirect: "manual" });
    if (result.ok || (result.status >= 200 && result.status < 500)) {
      return { ...result, path };
    }
  }
  const fallback = await timedFetch(`${baseUrl}${paths[0]}`, { method: "GET", redirect: "manual" });
  return { ...fallback, path: paths[0] };
}

function uncheckableEdgeStatus(edge) {
  return {
    edge: edge.edge,
    ok: false,
    status: 0,
    latencyMs: 0,
    buildTag: "unknown",
    module: edge.module,
    source: "live",
    correlationId: `conn-${edge.edge}`,
    reason: "external_live_gate_cannot_verify_this_internal_edge; requires in-cluster health endpoint or kubectl diagnostics",
  };
}

if (!boolEnv("RUN_V20_3_LIVE")) {
  console.log(JSON.stringify({
    ok: true,
    status: "skip",
    reason: "RUN_V20_3_LIVE_not_enabled",
    requiredEdges: REQUIRED_EDGES.map((item) => ({
      edge: item.edge,
      ok: false,
      status: 0,
      latencyMs: 0,
      buildTag: "opl-v20.3",
      module: item.module,
      source: "skip",
      correlationId: `conn-${item.edge}`,
    })),
  }, null, 2));
  process.exit(0);
}

const portalBaseUrl = pickBaseUrl("PORTAL_BASE_URL", "V20_3_PORTAL_BASE_URL", "https://portal.medopl.cn");
const oplBaseUrl = pickBaseUrl("OPL_BASE_URL", "V20_3_OPL_BASE_URL", "https://opl.medopl.cn");
const traceBaseUrl = pickBaseUrl("TRACE_BASE_URL", "V20_3_TRACE_BASE_URL", "https://trace.medopl.cn");

const [portalProbe, oplProbe, traceProbe, portalApiProbe] = await Promise.all([
  probeService(portalBaseUrl, ["/healthz", "/"]),
  probeService(oplBaseUrl, ["/healthz", "/"]),
  probeService(traceBaseUrl, ["/healthz", "/"]),
  probeService(portalBaseUrl, ["/portal/api/me", "/login"]),
]);

const probeByEdge = new Map([
  ["portal_to_trace", traceProbe],
  ["opl_to_trace", traceProbe],
  ["portal_to_opl_adapter", oplProbe],
]);

const edges = REQUIRED_EDGES.map((edge) => {
  const probe = probeByEdge.get(edge.edge);
  if (!probe) return uncheckableEdgeStatus(edge);
  return {
    edge: edge.edge,
    ok: probe.ok,
    status: probe.status,
    latencyMs: probe.latencyMs,
    buildTag: probe.buildTag,
    module: edge.module,
    source: "live",
    correlationId: probe.correlationId || `conn-${edge.edge}`,
    path: probe.path,
    reason: probe.reason || "",
  };
});

assert.equal(edges.length, REQUIRED_EDGES.length, "required_edges_must_be_preserved");
for (const edge of edges) {
  assert.equal(typeof edge.edge, "string", "live_edge_must_include_edge");
  assert.equal(typeof edge.ok, "boolean", "live_edge_must_include_ok");
  assert.equal(typeof edge.status, "number", "live_edge_must_include_status");
  assert.equal(typeof edge.latencyMs, "number", "live_edge_must_include_latency");
  assert.equal(typeof edge.buildTag, "string", "live_edge_must_include_build_tag");
  assert.equal(typeof edge.module, "string", "live_edge_must_include_module");
  assert.equal(edge.source, "live", "live_edge_must_include_source");
  assert.equal(typeof edge.correlationId, "string", "live_edge_must_include_correlation_id");
}

const payload = {
  ok: edges.every((edge) => edge.ok),
  status: "live",
  suite: "v20.3_connectivity_matrix",
  probes: {
    portal: portalProbe,
    opl: oplProbe,
    trace: traceProbe,
    portalApi: portalApiProbe,
  },
  edges,
};

console.log(JSON.stringify(payload, null, 2));
assert.equal(payload.ok, true, "v20_3_connectivity_matrix_has_failed_edges");
