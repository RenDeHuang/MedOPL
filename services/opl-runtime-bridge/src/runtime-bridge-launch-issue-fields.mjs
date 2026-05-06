import { usableServerPlanId } from "./server-plan-ids.mjs";

export function launchIdentityFields(input = {}) {
  return {
    tenantId: input.tenantId || input.tenant_id || input.portalUserId,
    ownerId: input.ownerId || input.owner_id || input.portalUserId,
  };
}

export function launchSessionOwnerFields(input = {}) {
  return {
    sessionOwnerId: input.sessionOwnerId || input.session_owner_id || input.portalUserId,
    storageOwnerId: input.storageOwnerId || input.storage_owner_id || input.portalUserId,
  };
}

export function launchTraceOwnerFields(input = {}) {
  return {
    traceOwnerId: input.traceOwnerId || input.trace_owner_id || input.portalUserId,
    artifactOwnerId: input.artifactOwnerId || input.artifact_owner_id || input.portalUserId,
  };
}

export function launchUserProfileFields(input = {}) {
  return {
    portalUserEmail: input.portalUserEmail || "",
    portalUserName: input.portalUserName || "",
  };
}

export function launchWorkspaceFields({ input = {}, workspace = {}, workspaceSessionId = "" } = {}) {
  return {
    workspaceId: workspace.workspaceId,
    workspaceTitle: workspace.title,
    workspacePath: input.workspacePath || input.workspace_path || workspace.workspacePath || "",
    projectId: input.projectId || input.project_id || input.moduleId || input.module_id || workspace.projectId || "",
    workspaceSessionId,
  };
}

export function selectedPlanResourceFields(input = {}, selectedServerPlan = {}) {
  return {
    ...selectedPlanIdentityFields(input, selectedServerPlan),
    ...selectedPlanSchedulingFields(input, selectedServerPlan),
    ...selectedPlanRequestFields(input, selectedServerPlan),
    ...selectedPlanProvisioningFields(input, selectedServerPlan),
  };
}

export function selectedPlanPortalContextFields(input = {}, selectedServerPlan = {}) {
  return {
    serverPlanId: usableServerPlanId(input.serverPlanId, input.server_plan_id, selectedServerPlan.id),
    instanceType: input.instanceType || input.instance_type || input.InstanceType || selectedServerPlan.instanceType || selectedServerPlan.InstanceType || "",
    region: input.region || selectedServerPlan.region || "",
  };
}

function selectedPlanIdentityFields(input = {}, selectedServerPlan = {}) {
  return {
    serverPlanId: usableServerPlanId(input.serverPlanId, input.server_plan_id, selectedServerPlan.id),
    instanceType: input.instanceType || input.instance_type || input.InstanceType || selectedServerPlan.instanceType || selectedServerPlan.InstanceType || "",
  };
}

function selectedPlanSchedulingFields(input = {}, selectedServerPlan = {}) {
  return {
    region: input.region || selectedServerPlan.region || "",
    zone: input.zone || selectedServerPlan.zone || "",
    nodePool: input.nodePool || input.node_pool || selectedServerPlan.nodePool || "",
    runtimeClass: input.runtimeClass || input.runtime_class || selectedServerPlan.runtimeClass || "",
    nodeSelector: input.nodeSelector || selectedServerPlan.nodeSelector || {},
    tolerations: input.tolerations || selectedServerPlan.tolerations || [],
    podNetworkingMode: input.podNetworkingMode || input.pod_networking_mode || selectedServerPlan.podNetworkingMode || "",
    requiresEniPod: input.requiresEniPod === true || input.requires_eni_pod === true || selectedServerPlan.requiresEniPod === true,
    podAnnotations: input.podAnnotations || input.pod_annotations || selectedServerPlan.podAnnotations || {},
  };
}

function selectedPlanRequestFields(input = {}, selectedServerPlan = {}) {
  return {
    cpuRequest: input.cpuRequest || input.cpu_request || selectedServerPlan.cpuRequest || "",
    cpuLimit: input.cpuLimit || input.cpu_limit || selectedServerPlan.cpuLimit || "",
    memoryRequest: input.memoryRequest || input.memory_request || selectedServerPlan.memoryRequest || "",
    memoryLimit: input.memoryLimit || input.memory_limit || selectedServerPlan.memoryLimit || "",
    gpuCount: Number(input.gpuCount ?? input.gpu_count ?? selectedServerPlan.gpuCount ?? selectedServerPlan.gpu ?? 0),
    storageRequest: input.storageRequest || input.storage_request || selectedServerPlan.storageRequest || "",
    storageLimit: input.storageLimit || input.storage_limit || selectedServerPlan.storageLimit || "",
  };
}

function selectedPlanProvisioningFields(input = {}, selectedServerPlan = {}) {
  return {
    provisioningMode: input.provisioningMode || input.provisioning_mode || selectedServerPlan.provisioningMode || "schedule_to_node_pool",
    tkeClusterId: input.tkeClusterId || input.tke_cluster_id || selectedServerPlan.tkeClusterId || "",
    nodePoolId: input.nodePoolId || input.node_pool_id || selectedServerPlan.nodePoolId || "",
    nodePoolCreatePayload: input.nodePoolCreatePayload || input.node_pool_create_payload || selectedServerPlan.nodePoolCreatePayload || null,
    nodePoolScalePayload: input.nodePoolScalePayload || input.node_pool_scale_payload || selectedServerPlan.nodePoolScalePayload || null,
    provisionerPayload: input.provisionerPayload || input.provisioner_payload || selectedServerPlan.provisionerPayload || null,
  };
}

export function runtimeSessionResourceFields(runtimeSession = {}, selectedServerPlan = {}) {
  return {
    ...runtimeSessionPlanFields(runtimeSession, selectedServerPlan),
    ...runtimeSessionSchedulingFields(runtimeSession, selectedServerPlan),
    ...runtimeSessionRequestFields(runtimeSession, selectedServerPlan),
    ...runtimeSessionProvisioningFields(runtimeSession, selectedServerPlan),
  };
}

function runtimeSessionPlanFields(runtimeSession = {}, selectedServerPlan = {}) {
  return {
    serverPlanId: usableServerPlanId(runtimeSession.serverPlanId, selectedServerPlan.id),
    instanceType: runtimeSession.instanceType || selectedServerPlan.instanceType || selectedServerPlan.InstanceType || "",
  };
}

function runtimeSessionSchedulingFields(runtimeSession = {}, selectedServerPlan = {}) {
  return {
    region: runtimeSession.region || selectedServerPlan.region || "",
    zone: runtimeSession.zone || selectedServerPlan.zone || "",
    nodePool: runtimeSession.nodePool || selectedServerPlan.nodePool || "",
    runtimeClass: runtimeSession.runtimeClass || selectedServerPlan.runtimeClass || "",
    nodeSelector: runtimeSession.nodeSelector || selectedServerPlan.nodeSelector || {},
    tolerations: runtimeSession.tolerations || selectedServerPlan.tolerations || [],
    podNetworkingMode: runtimeSession.podNetworkingMode || selectedServerPlan.podNetworkingMode || "",
    requiresEniPod: runtimeSession.requiresEniPod === true || selectedServerPlan.requiresEniPod === true,
    podAnnotations: runtimeSession.podAnnotations || selectedServerPlan.podAnnotations || {},
  };
}

function runtimeSessionRequestFields(runtimeSession = {}, selectedServerPlan = {}) {
  return {
    cpuRequest: runtimeSession.cpuRequest || selectedServerPlan.cpuRequest || "",
    cpuLimit: runtimeSession.cpuLimit || selectedServerPlan.cpuLimit || "",
    memoryRequest: runtimeSession.memoryRequest || selectedServerPlan.memoryRequest || "",
    memoryLimit: runtimeSession.memoryLimit || selectedServerPlan.memoryLimit || "",
    gpuCount: Number(runtimeSession.gpuCount ?? selectedServerPlan.gpuCount ?? selectedServerPlan.gpu ?? 0),
    storageRequest: runtimeSession.storageRequest || selectedServerPlan.storageRequest || "",
    storageLimit: runtimeSession.storageLimit || selectedServerPlan.storageLimit || "",
  };
}

function runtimeSessionProvisioningFields(runtimeSession = {}, selectedServerPlan = {}) {
  return {
    provisioningMode: runtimeSession.provisioningMode || selectedServerPlan.provisioningMode || "schedule_to_node_pool",
    tkeClusterId: runtimeSession.tkeClusterId || selectedServerPlan.tkeClusterId || "",
    nodePoolId: runtimeSession.nodePoolId || selectedServerPlan.nodePoolId || "",
    nodePoolCreatePayload: runtimeSession.nodePoolCreatePayload || selectedServerPlan.nodePoolCreatePayload || null,
    nodePoolScalePayload: runtimeSession.nodePoolScalePayload || selectedServerPlan.nodePoolScalePayload || null,
    provisionerPayload: runtimeSession.provisionerPayload || selectedServerPlan.provisionerPayload || null,
  };
}
