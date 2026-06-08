import {
  firstString,
  objectMapFrom,
  storageOwnerIdFrom,
  tenantIdFrom,
  tolerationsFrom,
  usableServerPlanId,
} from "./state-store-identity.mjs";
import { nowIso } from "./state-store-record-time.mjs";

export function runtimeOwnershipFields(input = {}, ownerId = "") {
  const storageOwnerId = storageOwnerIdFrom(input) || ownerId;
  return {
    tenantId: tenantIdFrom(input),
    portalUserId: input.portalUserId || input.portal_user_id || "",
    ownerId,
    storageOwner: input.storageOwner || input.storage_owner || storageOwnerId,
    storageOwnerId,
  };
}

export function workspaceSessionScopeFields(input = {}) {
  return {
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspacePath: input.workspacePath || input.workspace_path || "",
    projectId: input.projectId || input.project_id || input.moduleId || input.module_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
  };
}

export function runtimeResourceFields(input = {}) {
  return {
    ...serverPlanIdentityFields(input),
    ...runtimeSchedulingFields(input),
    ...runtimeResourceRequestFields(input),
  };
}

function serverPlanIdentityFields(input = {}) {
  return {
    serverPlanId: usableServerPlanId(input.serverPlanId, input.server_plan_id),
    instanceType: input.instanceType || input.instance_type || input.InstanceType || "",
  };
}

function runtimeSchedulingFields(input = {}) {
  return {
    region: input.region || "",
    zone: input.zone || "",
    nodePool: input.nodePool || input.node_pool || "",
    runtimeClass: input.runtimeClass || input.runtime_class || "",
    nodeSelector: objectMapFrom(input.nodeSelector),
    tolerations: tolerationsFrom(input.tolerations),
    podNetworkingMode: input.podNetworkingMode || input.pod_networking_mode || "",
    requiresEniPod: input.requiresEniPod === true || input.requires_eni_pod === true,
    podAnnotations: objectMapFrom(input.podAnnotations || input.pod_annotations),
  };
}

function runtimeResourceRequestFields(input = {}) {
  return {
    cpuRequest: input.cpuRequest || input.cpu_request || "",
    cpuLimit: input.cpuLimit || input.cpu_limit || "",
    memoryRequest: input.memoryRequest || input.memory_request || "",
    memoryLimit: input.memoryLimit || input.memory_limit || "",
    gpuCount: Number(input.gpuCount ?? input.gpu_count ?? 0),
    storageRequest: input.storageRequest || input.storage_request || "",
    storageLimit: input.storageLimit || input.storage_limit || "",
  };
}

export function providerConfigFields(input = {}) {
  const rawProviderConfig = objectMapFrom(input.providerConfig || input.provider_config);
  const providerKeyRef = firstString([
    input.providerKeyRef,
    input.provider_key_ref,
    input.providerConfigSecretRef,
    input.provider_config_secret_ref,
    rawProviderConfig.providerKeyRef,
    rawProviderConfig.providerConfigSecretRef,
  ]);
  const providerConfigSecretRef = firstString([
    input.providerConfigSecretRef,
    input.provider_config_secret_ref,
    rawProviderConfig.providerConfigSecretRef,
  ]) || providerKeyRef;
  const providerConfigStatus = firstString([
    input.providerConfigStatus,
    input.provider_config_status,
    rawProviderConfig.providerConfigStatus,
  ]) || (providerConfigSecretRef ? "configured" : "missing");
  const providerConfigured = [
    input.providerConfigured,
    input.provider_configured,
    rawProviderConfig.providerConfigured,
    rawProviderConfig.providerConfigStatus === "configured",
    providerConfigSecretRef,
  ].some(Boolean);
  return {
    providerKeyRef,
    providerConfigured,
    providerConfigStatus,
    providerConfigSecretRef,
    providerName: firstString([input.providerName, input.provider_name, rawProviderConfig.providerName]),
    providerBaseUrl: firstString([rawProviderConfig.providerBaseUrl, input.providerBaseUrl, input.provider_base_url]),
    modelProvider: firstString([rawProviderConfig.modelProvider, input.modelProvider, input.model_provider]),
    model: firstString([rawProviderConfig.model, input.model]),
    modelReasoningEffort: firstString([rawProviderConfig.modelReasoningEffort, input.modelReasoningEffort, input.model_reasoning_effort]),
    serviceTier: firstString([rawProviderConfig.serviceTier, input.serviceTier, input.service_tier]),
    sandboxMode: firstString([rawProviderConfig.sandboxMode, input.sandboxMode, input.sandbox_mode]),
    secretFingerprint: firstString([rawProviderConfig.secretFingerprint, input.secretFingerprint, input.secret_fingerprint]),
  };
}

export function runExecutionFields(input = {}) {
  return {
    status: input.status || "submitted",
    createdAt: input.createdAt || input.created_at || nowIso(),
    startedAt: input.startedAt || input.started_at || "",
    finishedAt: input.finishedAt || input.finished_at || "",
    latencyMs: Number(input.latencyMs || input.latency_ms || 0),
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    model: input.model || "opl-runtime",
    userAgent: input.userAgent || input.user_agent || "",
    error: input.error || "",
  };
}
