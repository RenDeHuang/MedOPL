export function firstNonEmpty(values = []) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export function normalizeRuntimeSessionMode(value = {}) {
  const mode = typeof value === "object" && value !== null
    ? String(value.mode || value.runtimeSessionMode || value.runtime_session_mode || "").trim()
    : String(value || "").trim();
  return mode.toLowerCase() === "full_runtime" ? "full_runtime" : "api_only";
}

export function normalizeRuntimeEndpoint(value = "") {
  return String(value || "").replace(/\/$/, "");
}

export function runtimeScopeFrom(record = {}) {
  return {
    mode: normalizeRuntimeSessionMode(record),
    resourceBindingId: firstNonEmpty([record.resourceBindingId, record.resource_binding_id]),
    computeInstanceId: firstNonEmpty([record.computeInstanceId, record.compute_instance_id]),
    storageBucketId: firstNonEmpty([record.storageBucketId, record.storage_bucket_id]),
    runtimeAgentId: firstNonEmpty([record.runtimeAgentId, record.runtime_agent_id]),
    runtimeAgentEndpoint: normalizeRuntimeEndpoint(firstNonEmpty([record.runtimeAgentEndpoint, record.runtime_agent_endpoint])),
  };
}

export function hasRequiredFullRuntimeScope(scope = {}, { requireRuntimeAgent = true } = {}) {
  if (scope.mode !== "full_runtime") return true;
  if (!scope.resourceBindingId || !scope.computeInstanceId || !scope.storageBucketId) return false;
  if (requireRuntimeAgent && !scope.runtimeAgentId && !scope.runtimeAgentEndpoint) return false;
  return true;
}
