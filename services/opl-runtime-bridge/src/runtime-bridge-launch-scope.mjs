import { providerKeyRefFrom, scopedMessageIdentity } from "./runtime-bridge-scope-identity.mjs";
import {
  firstNonEmpty,
  normalizeRuntimeEndpoint,
  normalizeRuntimeSessionMode,
} from "./runtime-bridge-scope-primitives.mjs";

export { providerKeyRefFrom, scopedMessageIdentity } from "./runtime-bridge-scope-identity.mjs";

export function launchScopeSnapshot(launch = {}, runtimeSession = {}) {
  const source = runtimeSession && typeof runtimeSession === "object" && Object.keys(runtimeSession).length ? runtimeSession : launch;
  return {
    portalUserId: firstNonEmpty([source.portalUserId, source.portal_user_id, launch.portalUserId, launch.portal_user_id]),
    tenantId: firstNonEmpty([source.tenantId, source.tenant_id, launch.tenantId, launch.tenant_id]),
    workspaceId: firstNonEmpty([source.workspaceId, source.workspace_id, launch.workspaceId, launch.workspace_id]),
    workspaceSessionId: firstNonEmpty([source.workspaceSessionId, source.workspace_session_id, launch.workspaceSessionId, launch.workspace_session_id]),
    runtimeSessionId: firstNonEmpty([source.runtimeSessionId, source.runtime_session_id, launch.runtimeSessionId, launch.runtime_session_id]),
    providerKeyRef: providerKeyRefFrom(source) || providerKeyRefFrom(launch),
    mode: normalizeRuntimeSessionMode(source.mode || source.runtimeSessionMode || source.runtime_session_mode || launch.mode),
    resourceBindingId: firstNonEmpty([source.resourceBindingId, source.resource_binding_id, launch.resourceBindingId, launch.resource_binding_id]),
    computeInstanceId: firstNonEmpty([source.computeInstanceId, source.compute_instance_id, launch.computeInstanceId, launch.compute_instance_id]),
    storageBucketId: firstNonEmpty([source.storageBucketId, source.storage_bucket_id, launch.storageBucketId, launch.storage_bucket_id]),
    runtimeAgentId: firstNonEmpty([source.runtimeAgentId, source.runtime_agent_id, launch.runtimeAgentId, launch.runtime_agent_id]),
    runtimeAgentEndpoint: normalizeRuntimeEndpoint(firstNonEmpty([source.runtimeAgentEndpoint, source.runtime_agent_endpoint, launch.runtimeAgentEndpoint, launch.runtime_agent_endpoint])),
  };
}

function requestedScope(input = {}, expected = {}) {
  const request = {
    portalUserId: firstNonEmpty([input.portalUserId, input.portal_user_id, input.userId, input.user_id, expected.portalUserId]),
    workspaceId: firstNonEmpty([input.workspaceId, input.workspace_id, expected.workspaceId]),
    workspaceSessionId: firstNonEmpty([input.workspaceSessionId, input.workspace_session_id, expected.workspaceSessionId]),
    runtimeSessionId: firstNonEmpty([input.runtimeSessionId, input.runtime_session_id, expected.runtimeSessionId]),
    providerKeyRef: providerKeyRefFrom(input) || providerKeyRefFrom(expected),
    mode: firstNonEmpty([input.mode, input.runtimeSessionMode, input.runtime_session_mode, expected.mode]),
    resourceBindingId: firstNonEmpty([input.resourceBindingId, input.resource_binding_id, expected.resourceBindingId]),
    computeInstanceId: firstNonEmpty([input.computeInstanceId, input.compute_instance_id, expected.computeInstanceId]),
    storageBucketId: firstNonEmpty([input.storageBucketId, input.storage_bucket_id, expected.storageBucketId]),
    runtimeAgentId: firstNonEmpty([input.runtimeAgentId, input.runtime_agent_id, expected.runtimeAgentId]),
    runtimeAgentEndpoint: normalizeRuntimeEndpoint(firstNonEmpty([input.runtimeAgentEndpoint, input.runtime_agent_endpoint, expected.runtimeAgentEndpoint])),
  };
  if (request.mode) request.mode = normalizeRuntimeSessionMode(request.mode);
  return request;
}

function scopeMismatch(field, expected, actual) {
  return {
    ok: false,
    status: 403,
    error: "launch_scope_mismatch",
    field,
    expected,
    actual,
  };
}

export function validateLaunchScope({ launch = {}, runtimeSession = {}, input = {}, expected = {} } = {}) {
  const actual = launchScopeSnapshot(launch, runtimeSession);
  const requested = requestedScope(input, expected);
  for (const field of Object.keys(requested)) {
    if (!requested[field]) continue;
    const normalizedActual = field === "mode" ? normalizeRuntimeSessionMode(actual[field]) : String(actual[field] || "");
    const normalizedRequested = field === "mode" ? normalizeRuntimeSessionMode(requested[field]) : String(requested[field] || "");
    if (normalizedActual !== normalizedRequested) {
      return scopeMismatch(field, normalizedActual, normalizedRequested);
    }
  }
  return { ok: true, scope: actual };
}
