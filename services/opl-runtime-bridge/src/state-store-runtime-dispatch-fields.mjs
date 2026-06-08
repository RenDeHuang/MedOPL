function firstString(values = []) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function normalizeLaunchMode(input = {}) {
  const mode = firstString([input.mode, input.runtimeSessionMode, input.runtime_session_mode]).toLowerCase();
  return mode === "full_runtime" ? "full_runtime" : "api_only";
}

export function runtimeDispatchFields(input = {}) {
  return {
    mode: normalizeLaunchMode(input),
    resourceBindingId: firstString([input.resourceBindingId, input.resource_binding_id]),
    computeInstanceId: firstString([input.computeInstanceId, input.compute_instance_id]),
    storageBucketId: firstString([input.storageBucketId, input.storage_bucket_id]),
    runtimeAgentId: firstString([input.runtimeAgentId, input.runtime_agent_id]),
    runtimeAgentEndpoint: firstString([input.runtimeAgentEndpoint, input.runtime_agent_endpoint]).replace(/\/$/, ""),
  };
}
