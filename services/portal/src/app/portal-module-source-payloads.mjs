function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

export const PORTAL_MODULE_SOURCE_BUILD_TAG = "opl-v20.32";

export const REQUIRED_PORTAL_MODULE_SOURCES = Object.freeze([
  Object.freeze({ module: "overview", apiSource: "/portal/api/overview", capability: "overview_snapshot" }),
  Object.freeze({ module: "billing", apiSource: "/portal/api/billing", capability: "billing_summary" }),
  Object.freeze({ module: "workspace", apiSource: "/portal/api/workspace", capability: "workspace_file_io" }),
  Object.freeze({ module: "resource_orders", apiSource: "/portal/api/resource-orders", capability: "resource_order_status" }),
  Object.freeze({ module: "opl_launch", apiSource: "/portal/api/opl/launch", capability: "launch_bridge" }),
  Object.freeze({ module: "session_trace", apiSource: "/portal/api/session-traces", capability: "trace_lookup" }),
]);

export function buildPortalModuleSourcePayload({ module, apiSource, capability, buildTag = PORTAL_MODULE_SOURCE_BUILD_TAG }) {
  return {
    moduleSource: normalizeText(module),
    apiSource: normalizeText(apiSource),
    capability: normalizeText(capability),
    buildTag: normalizeText(buildTag, PORTAL_MODULE_SOURCE_BUILD_TAG),
  };
}

export function listPortalRequiredModuleSourcePayloads(buildTag = PORTAL_MODULE_SOURCE_BUILD_TAG) {
  return REQUIRED_PORTAL_MODULE_SOURCES.map((item) => buildPortalModuleSourcePayload({ ...item, buildTag }));
}
