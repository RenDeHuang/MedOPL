function text(value) {
  return String(value ?? "").trim();
}

function moneyAmount(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed * 100) / 100);
}

function nowIso() {
  return new Date().toISOString();
}

function requireField(payload = {}, field) {
  const value = text(payload[field]);
  if (!value) {
    const error = new Error(`missing_${field}`);
    error.code = `missing_${field}`;
    throw error;
  }
  return value;
}

function normalizeResourceLifecycleMode(payload = {}) {
  const raw = text(payload.provisioningMode || payload.provisioning_mode || payload.resourceLifecycleMode || payload.resource_lifecycle_mode || payload.lifecycleMode || payload.lifecycle_mode || "platform_provisioned")
    .toLowerCase()
    .replace(/-/g, "_");
  if (raw === "user_owned") {
    const error = new Error("legacy_user_owned_lifecycle_mode_retired");
    error.code = "legacy_user_owned_lifecycle_mode_retired";
    throw error;
  }
  const aliases = {
    cloud: "platform_provisioned",
    cloud_provisioned: "platform_provisioned",
    customer_dedicated: "platform_provisioned",
    platform_provisioned: "platform_provisioned",
    registered: "platform_provisioned",
    registered_only: "platform_provisioned",
  };
  return aliases[raw] || "platform_provisioned";
}

export function normalizeCustomerComputeResource(payload = {}, owner = {}) {
  const id = text(payload.id) || `ccr_${crypto.randomUUID()}`;
  const cvmInstanceId = text(payload.cvmInstanceId || payload.cvm_instance_id || payload.instanceId || payload.instance_id || id);
  return {
    id,
    ownerUserId: requireField(owner, "ownerUserId"),
    ownerTenantId: requireField(owner, "ownerTenantId"),
    provider: text(payload.provider || "tencent-cloud"),
    region: requireField(payload, "region"),
    zone: text(payload.zone),
    provisioningMode: normalizeResourceLifecycleMode(payload),
    cloudResourceId: text(payload.cloudResourceId || payload.cloud_resource_id || cvmInstanceId),
    serverPlanId: text(payload.serverPlanId || payload.server_plan_id),
    cvmInstanceId,
    instanceId: cvmInstanceId,
    instanceType: requireField(payload, "instanceType"),
    publicEndpoint: text(payload.publicEndpoint || payload.public_endpoint),
    privateEndpoint: text(payload.privateEndpoint || payload.private_endpoint),
    runtimeAgentId: text(payload.runtimeAgentId || payload.runtime_agent_id),
    runtimeAgentEndpoint: text(payload.runtimeAgentEndpoint || payload.runtime_agent_endpoint),
    runtimeAgentVersion: text(payload.runtimeAgentVersion || payload.runtime_agent_version),
    healthStatus: text(payload.healthStatus || payload.health_status || "unknown").toLowerCase(),
    provisionEvidenceId: text(payload.provisionEvidenceId || payload.provision_evidence_id),
    provisionEvidence: payload.provisionEvidence || payload.provision_evidence || null,
    releaseEvidenceId: text(payload.releaseEvidenceId || payload.release_evidence_id),
    releaseEvidence: payload.releaseEvidence || payload.release_evidence || null,
    billingStartedAt: text(payload.billingStartedAt || payload.billing_started_at),
    billingStoppedAt: text(payload.billingStoppedAt || payload.billing_stopped_at),
    status: text(payload.status || "active").toLowerCase(),
    createdAt: text(payload.createdAt) || nowIso(),
    updatedAt: text(payload.updatedAt) || nowIso(),
  };
}

export function normalizeCustomerStorageResource(payload = {}, owner = {}) {
  const id = text(payload.id) || `csr_${crypto.randomUUID()}`;
  const bucketName = requireField(payload, "bucketName");
  return {
    id,
    ownerUserId: requireField(owner, "ownerUserId"),
    ownerTenantId: requireField(owner, "ownerTenantId"),
    provider: text(payload.provider || "cos"),
    provisioningMode: normalizeResourceLifecycleMode(payload),
    cloudResourceId: text(payload.cloudResourceId || payload.cloud_resource_id || payload.bucketId || payload.bucket_id || bucketName),
    region: requireField(payload, "region"),
    bucketName,
    bucketId: text(payload.bucketId || payload.bucket_id || bucketName),
    storagePlanId: text(payload.storagePlanId || payload.storage_plan_id),
    storageCapacityGb: Number(payload.storageCapacityGb || payload.storage_capacity_gb || 0) || 0,
    endpoint: text(payload.endpoint),
    credentialsSecretRef: text(payload.credentialsSecretRef || payload.credentials_secret_ref),
    rootPrefix: text(payload.rootPrefix || payload.root_prefix || `users/${owner.ownerUserId}/`),
    provisionEvidenceId: text(payload.provisionEvidenceId || payload.provision_evidence_id),
    provisionEvidence: payload.provisionEvidence || payload.provision_evidence || null,
    releaseEvidenceId: text(payload.releaseEvidenceId || payload.release_evidence_id),
    releaseEvidence: payload.releaseEvidence || payload.release_evidence || null,
    billingStartedAt: text(payload.billingStartedAt || payload.billing_started_at),
    billingStoppedAt: text(payload.billingStoppedAt || payload.billing_stopped_at),
    status: text(payload.status || "active").toLowerCase(),
    createdAt: text(payload.createdAt) || nowIso(),
    updatedAt: text(payload.updatedAt) || nowIso(),
  };
}

export function normalizeWorkspaceResourceBinding(payload = {}, owner = {}) {
  const id = text(payload.id) || `wrb_${crypto.randomUUID()}`;
  return {
    id,
    resourceBindingId: text(payload.resourceBindingId || payload.resource_binding_id || id),
    ownerUserId: requireField(owner, "ownerUserId"),
    ownerTenantId: requireField(owner, "ownerTenantId"),
    workspaceId: requireField(payload, "workspaceId"),
    computeInstanceId: requireField(payload, "computeInstanceId"),
    storageBucketId: requireField(payload, "storageBucketId"),
    rootPrefix: text(payload.rootPrefix || payload.root_prefix || `users/${owner.ownerUserId}/workspaces/${payload.workspaceId}/`),
    protectionPolicyId: text(payload.protectionPolicyId || payload.protection_policy_id),
    status: text(payload.status || "active").toLowerCase(),
    createdAt: text(payload.createdAt) || nowIso(),
    updatedAt: text(payload.updatedAt) || nowIso(),
  };
}

function bindingAllowed(status = "") {
  return text(status).toLowerCase() === "active";
}

export function buildWorkspaceBindingAccess(binding = {}) {
  const active = bindingAllowed(binding.status);
  const activeGate = {
    bindingRequired: true,
    allowed: active,
    reason: active ? "active_binding_present" : "active_binding_required",
  };
  return {
    oplLite: {
      bindingRequired: false,
      allowed: true,
      reason: "opl_lite_does_not_require_workspace_binding",
    },
    fullRuntime: { ...activeGate },
    workspaceFiles: { ...activeGate },
    workspaceTasks: { ...activeGate },
    workspaceOutputs: { ...activeGate },
  };
}

export function buildOwnerAccessPolicy({ activeBindingCount = 0 } = {}) {
  const active = Number(activeBindingCount || 0) > 0;
  const activeGate = {
    bindingRequired: true,
    allowed: active,
    reason: active ? "active_binding_present" : "active_binding_required",
  };
  return {
    oplLite: {
      bindingRequired: false,
      allowed: true,
      reason: "opl_lite_does_not_require_workspace_binding",
    },
    fullRuntime: { ...activeGate },
    workspaceFiles: { ...activeGate },
    workspaceTasks: { ...activeGate },
    workspaceOutputs: { ...activeGate },
  };
}

function requiredMoneyField(payload = {}, field) {
  const raw = payload[field];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const error = new Error(`invalid_${field}`);
    error.code = `invalid_${field}`;
    throw error;
  }
  return moneyAmount(parsed);
}

function normalizeUsageMode(value = "") {
  const normalized = text(value).toLowerCase().replace(/-/g, "_");
  const aliases = {
    api: "api_only",
    api_only: "api_only",
    opl_lite: "opl_lite",
    full_runtime: "full_runtime",
    file: "workspace_file",
    task: "workspace_task",
    output: "workspace_output",
    workspace_file: "workspace_file",
    workspace_files: "workspace_file",
    workspace_task: "workspace_task",
    workspace_tasks: "workspace_task",
    workspace_output: "workspace_output",
    workspace_outputs: "workspace_output",
  };
  const mode = aliases[normalized];
  if (!mode) {
    const error = new Error("invalid_usage_mode");
    error.code = "invalid_usage_mode";
    throw error;
  }
  return mode;
}

export function normalizeWeeklyProtectionFreeze(payload = {}, owner = {}, binding = {}) {
  const id = text(payload.id) || `wpf_${crypto.randomUUID()}`;
  const windowStartAt = requireField(payload, "windowStartAt");
  const windowEndAt = requireField(payload, "windowEndAt");
  if (Date.parse(windowEndAt) <= Date.parse(windowStartAt)) {
    const error = new Error("invalid_window_range");
    error.code = "invalid_window_range";
    throw error;
  }
  const weeklyAmount = requiredMoneyField(payload, "weeklyAmount");
  const frozenAmount = moneyAmount(payload.frozenAmount, weeklyAmount);
  const consumedAmount = moneyAmount(payload.consumedAmount, 0);
  const remainingAmount = moneyAmount(payload.remainingAmount, frozenAmount - consumedAmount);
  return {
    id,
    resourceBindingId: requireField(payload, "resourceBindingId"),
    ownerUserId: requireField(owner, "ownerUserId"),
    ownerTenantId: requireField(owner, "ownerTenantId"),
    workspaceId: requireField(payload, "workspaceId"),
    computeInstanceId: requireField(payload, "computeInstanceId"),
    storageBucketId: requireField(payload, "storageBucketId"),
    usageMode: normalizeUsageMode(payload.usageMode || "full_runtime"),
    windowStartAt,
    windowEndAt,
    weeklyAmount,
    frozenAmount,
    consumedAmount,
    remainingAmount,
    reconcile120MinStatus: text(payload.reconcile120MinStatus || payload.reconcile_120_min_status || "pending"),
    tPlus1AuditStatus: text(payload.tPlus1AuditStatus || payload.t_plus_1_audit_status || "pending"),
    status: text(payload.status || "active").toLowerCase(),
    createdAt: text(payload.createdAt) || nowIso(),
    updatedAt: text(payload.updatedAt) || nowIso(),
    protectionPolicyId: text(payload.protectionPolicyId || binding.protectionPolicyId),
  };
}

export function releasedAmount(freeze = {}) {
  const frozen = moneyAmount(freeze.frozenAmount, 0);
  const consumed = moneyAmount(freeze.consumedAmount, 0);
  const remaining = moneyAmount(freeze.remainingAmount, Math.max(0, frozen - consumed));
  return moneyAmount(frozen - consumed - remaining, 0);
}

export function buildWeeklyProtectionFreezeView(freeze = {}) {
  const frozenAmount = moneyAmount(freeze.frozenAmount, 0);
  const consumedAmount = moneyAmount(freeze.consumedAmount, 0);
  const remainingAmount = moneyAmount(freeze.remainingAmount, Math.max(0, frozenAmount - consumedAmount));
  return {
    ...freeze,
    weeklyAmount: moneyAmount(freeze.weeklyAmount, frozenAmount),
    frozenAmount,
    consumedAmount,
    remainingAmount,
    releasedAmount: releasedAmount({ frozenAmount, consumedAmount, remainingAmount }),
  };
}

export function moneyDelta(value = 0) {
  return moneyAmount(value, 0);
}

export function usageModeNeedsFreeze(value = "") {
  const mode = normalizeUsageMode(value || "full_runtime");
  return mode !== "api_only" && mode !== "opl_lite";
}

export function ownerScopeFromUser(user = {}) {
  return {
    ownerUserId: text(user.id),
    ownerTenantId: text(user.tenantId || user.tenant_id || user.id),
  };
}
