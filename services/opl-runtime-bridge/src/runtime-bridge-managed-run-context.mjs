import { randomUUID } from "node:crypto";

import { usableServerPlanId } from "./server-plan-ids.mjs";
import { createRunCorrelationId, createRunTraceId } from "./run-observability.mjs";

export function buildManagedRunContext({
  input = {},
  k8sNamespace = "",
  req,
  runnerImage = "",
  runtimeSession = {},
}) {
  const runId = input.runId || input.run_id || randomUUID();
  return {
    ...managedRunTraceFields(input, runId),
    ...managedRunIdentityFields(runtimeSession, input, runId),
    ...managedRunToolFields(input),
    ...managedRunResourceFields(runtimeSession, input),
    ...managedRunAccountingFields(input),
    ...managedRunRunnerFields({ input, k8sNamespace, req, runnerImage }),
    ...managedRunProviderFields(runtimeSession),
  };
}

function managedRunTraceFields(input = {}, runId = "") {
  return {
    correlationId: createRunCorrelationId({ ...input, runId }),
    traceId: createRunTraceId({ ...input, runId }),
  };
}

function managedRunIdentityFields(runtimeSession = {}, input = {}, runId = "") {
  return {
    portalUserId: runtimeSession.portalUserId,
    tenantId: input.tenantId || input.tenant_id || runtimeSession.tenantId || runtimeSession.portalUserId,
    customerId: runtimeSession.portalUserId,
    userId: runtimeSession.portalUserId,
    workspaceId: runtimeSession.workspaceId,
    workspaceSessionId: runtimeSession.workspaceSessionId,
    runtimeSessionId: runtimeSession.runtimeSessionId,
    runId,
  };
}

function managedRunToolFields(input = {}) {
  return {
    agentId: input.agentId || input.agent_id || "mas",
    toolName: input.toolName || input.tool_name || "med-autoscience",
  };
}

function managedRunAccountingFields(input = {}) {
  return {
    billingScope: input.billingScope || input.billing_scope || "run",
    costCenter: input.costCenter || input.cost_center || "research-foundry",
    estimatedHours: Number(input.estimatedHours ?? input.estimated_hours ?? 1),
    resourceOrderId: String(input.resourceOrderId || input.resource_order_id || "").trim(),
  };
}

function managedRunRunnerFields({ input = {}, k8sNamespace = "", req, runnerImage = "" } = {}) {
  return {
    model: input.model || "opl-runtime",
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    userAgent: req.headers["user-agent"] || "",
    runnerImage: input.runnerImage || input.runner_image || runnerImage,
    namespace: input.namespace || k8sNamespace,
  };
}

function managedRunProviderFields(runtimeSession = {}) {
  return {
    providerConfigured: Boolean(runtimeSession.providerConfigured),
    providerConfigStatus: runtimeSession.providerConfigStatus || (runtimeSession.providerConfigured ? "configured" : "missing"),
    providerConfigSecretRef: runtimeSession.providerConfigSecretRef || "",
    providerName: runtimeSession.providerName || "",
    providerBaseUrl: runtimeSession.providerBaseUrl || "",
    modelProvider: runtimeSession.modelProvider || "",
    modelReasoningEffort: runtimeSession.modelReasoningEffort || "",
    serviceTier: runtimeSession.serviceTier || "",
    sandboxMode: runtimeSession.sandboxMode || "",
  };
}

function managedRunResourceFields(runtimeSession = {}, input = {}) {
  return {
    ...managedRunPlanFields(runtimeSession, input),
    ...managedRunSchedulingFields(runtimeSession, input),
    ...managedRunResourceRequestFields(runtimeSession, input),
    ...managedRunProvisioningFields(runtimeSession, input),
  };
}

function managedRunPlanFields(runtimeSession = {}, input = {}) {
  return {
    serverPlanId: usableServerPlanId(input.serverPlanId, input.server_plan_id, runtimeSession.serverPlanId),
    instanceType: input.instanceType || input.instance_type || input.InstanceType || runtimeSession.instanceType || "",
  };
}

function managedRunSchedulingFields(runtimeSession = {}, input = {}) {
  return {
    region: input.region || runtimeSession.region || "",
    zone: input.zone || runtimeSession.zone || "",
    nodePool: input.nodePool || input.node_pool || runtimeSession.nodePool || "",
    runtimeClass: input.runtimeClass || input.runtime_class || runtimeSession.runtimeClass || "",
    nodeSelector: (input.nodeSelector && typeof input.nodeSelector === "object" ? input.nodeSelector : runtimeSession.nodeSelector) || {},
    tolerations: Array.isArray(input.tolerations) ? input.tolerations : (Array.isArray(runtimeSession.tolerations) ? runtimeSession.tolerations : []),
    podNetworkingMode: input.podNetworkingMode || input.pod_networking_mode || runtimeSession.podNetworkingMode || "",
    requiresEniPod: input.requiresEniPod === true || input.requires_eni_pod === true || runtimeSession.requiresEniPod === true,
    podAnnotations: (input.podAnnotations && typeof input.podAnnotations === "object" ? input.podAnnotations : runtimeSession.podAnnotations) || {},
  };
}

function managedRunResourceRequestFields(runtimeSession = {}, input = {}) {
  return {
    cpuRequest: input.cpuRequest || input.cpu_request || runtimeSession.cpuRequest || "",
    cpuLimit: input.cpuLimit || input.cpu_limit || runtimeSession.cpuLimit || "",
    memoryRequest: input.memoryRequest || input.memory_request || runtimeSession.memoryRequest || "",
    memoryLimit: input.memoryLimit || input.memory_limit || runtimeSession.memoryLimit || "",
    gpuCount: Number(input.gpuCount ?? input.gpu_count ?? runtimeSession.gpuCount ?? 0),
    storageRequest: input.storageRequest || input.storage_request || runtimeSession.storageRequest || "",
    storageLimit: input.storageLimit || input.storage_limit || runtimeSession.storageLimit || "",
  };
}

function managedRunProvisioningFields(runtimeSession = {}, input = {}) {
  return {
    provisioningMode: input.provisioningMode || input.provisioning_mode || runtimeSession.provisioningMode || "schedule_to_node_pool",
    nodePoolScalePayload: input.nodePoolScalePayload || input.node_pool_scale_payload || runtimeSession.nodePoolScalePayload || null,
  };
}
