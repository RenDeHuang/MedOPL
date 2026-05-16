import { randomUUID } from "node:crypto";

function text(value) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function ensureArrayField(db, key) {
  db[key] = Array.isArray(db[key]) ? db[key] : [];
  return db[key];
}

function userTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function ownerMatches(item = {}, user = {}) {
  return text(item.tenantId || item.ownerTenantId) === userTenantId(user)
    && text(item.userId || item.ownerUserId) === text(user.id);
}

function workspaceMatches(item = {}, workspaceId = "") {
  return text(item.workspaceId) === text(workspaceId);
}

function operationTypeFrom(input = {}) {
  return text(input.operationType || input.operation_type);
}

function workspaceIdFrom(input = {}) {
  return text(input.workspaceId || input.workspace_id);
}

function resourceBindingIdFrom(input = {}) {
  return text(input.resourceBindingId || input.resource_binding_id);
}

function planIdFrom(input = {}, fallback = "starter_2c4g_10gb") {
  return text(input.planId || input.plan_id || fallback) || fallback;
}

function positiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function addDays(iso = "", days = 0) {
  return new Date(Date.parse(iso) + Number(days || 0) * 24 * 60 * 60 * 1000).toISOString();
}

function acceptedDryRunIdFrom(input = {}) {
  return text(input.acceptedDryRunId || input.accepted_dry_run_id);
}

const TEST_OPERATIONS = new Set([
  "create_storage",
  "create_compute",
  "expand_storage",
  "expand_compute",
  "release_compute",
  "delete_storage",
]);

const COMPUTE_STATUS_LABELS = new Map([
  ["available", "可用"],
  ["scaling", "扩容中"],
  ["released", "已释放"],
  ["none", "未开通"],
]);

const FILE_SPACE_STATUS_LABELS = new Map([
  ["available", "可用"],
  ["expanding", "扩容中"],
  ["retention_protected", "文件保护期"],
  ["none", "未开通"],
]);

function testBridgeEnvelope(extra = {}) {
  return {
    ok: true,
    testOnly: true,
    productionPortalConnected: false,
    runnerMode: "local-executor",
    realCloudCalls: false,
    ...extra,
  };
}

function ensureWorkspace(db = {}, user = {}, workspaceId = "", planId = "starter_2c4g_10gb") {
  const workspaces = ensureArrayField(db, "taskSpaces");
  let workspace = workspaces.find((item) => ownerMatches(item, user) && text(item.slug || item.workspaceId || item.id) === workspaceId);
  if (!workspace) {
    workspace = {
      id: workspaceId,
      slug: workspaceId,
      workspaceId,
      tenantId: userTenantId(user),
      userId: text(user.id),
      ownerTenantId: userTenantId(user),
      ownerUserId: text(user.id),
      title: workspaceId,
      status: "active",
      serverPlanId: planId,
      createdAt: nowIso(),
    };
    workspaces.push(workspace);
  }
  workspace.serverPlanId = planIdFrom({ planId }, workspace.serverPlanId);
  workspace.updatedAt = nowIso();
  return workspace;
}

function bindingAuditTag(user = {}, workspaceId = "") {
  return `tenant:${userTenantId(user)}/user:${text(user.id)}/workspace:${workspaceId}`;
}

function bindingCostTag(user = {}, workspaceId = "") {
  return `medopl:v22:${userTenantId(user)}:${workspaceId}`;
}

function createBinding(db = {}, user = {}, workspaceId = "", planId = "starter_2c4g_10gb") {
  const id = `rb-${randomUUID()}`;
  const binding = {
    id,
    resourceBindingId: id,
    tenantId: userTenantId(user),
    userId: text(user.id),
    ownerTenantId: userTenantId(user),
    ownerUserId: text(user.id),
    workspaceId,
    planId,
    packageId: planId,
    serverPlanId: planId,
    status: "provisioning",
    billingAccountId: userTenantId(user),
    auditTag: bindingAuditTag(user, workspaceId),
    costAllocationTag: bindingCostTag(user, workspaceId),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  ensureArrayField(db, "workspaceResourceBindings").push(binding);
  return binding;
}

function findOwnedBinding(db = {}, user = {}, workspaceId = "", resourceBindingId = "") {
  const bindings = ensureArrayField(db, "workspaceResourceBindings");
  if (resourceBindingId) {
    const binding = bindings.find((item) => text(item.resourceBindingId || item.id) === resourceBindingId) || null;
    if (!binding) return { ok: false, status: 404, error: "resource_binding_not_found" };
    if (!ownerMatches(binding, user) || !workspaceMatches(binding, workspaceId)) {
      return { ok: false, status: 403, error: "resource_binding_owner_mismatch" };
    }
    return { ok: true, binding };
  }
  const binding = bindings
    .filter((item) => ownerMatches(item, user))
    .filter((item) => workspaceMatches(item, workspaceId))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
  if (!binding) return { ok: false, status: 409, error: "resource_binding_required" };
  return { ok: true, binding };
}

function upsertFileSpaceEntitlement(db = {}, user = {}, binding = {}, input = {}, status = "available") {
  const entitlements = ensureArrayField(db, "fileSpaceEntitlements");
  const capacityGb = positiveNumber(input.fileSpaceGb ?? input.file_space_gb, positiveNumber(binding.fileSpaceGb, 10));
  let entitlement = entitlements.find((item) => text(item.resourceBindingId) === text(binding.resourceBindingId || binding.id)) || null;
  if (!entitlement) {
    entitlement = {
      id: `fs-${text(binding.resourceBindingId || binding.id)}`,
      tenantId: userTenantId(user),
      userId: text(user.id),
      workspaceId: text(binding.workspaceId),
      resourceBindingId: text(binding.resourceBindingId || binding.id),
      createdAt: nowIso(),
    };
    entitlements.push(entitlement);
  }
  entitlement.capacityGb = capacityGb;
  entitlement.planId = planIdFrom(input, binding.planId);
  entitlement.status = status;
  entitlement.retentionProtectionStatus = status === "retention_protected" ? "active" : text(entitlement.retentionProtectionStatus);
  entitlement.retentionCleanupAfterAt = status === "retention_protected" ? addDays(nowIso(), 7) : text(entitlement.retentionCleanupAfterAt);
  entitlement.updatedAt = nowIso();
  binding.fileSpaceGb = capacityGb;
  binding.storageEntitlementId = entitlement.id;
  binding.storageStatus = status;
  binding.updatedAt = nowIso();
  return entitlement;
}

function upsertComputeAllocation(db = {}, user = {}, binding = {}, input = {}, status = "available") {
  const allocations = ensureArrayField(db, "computeAllocations");
  let allocation = allocations.find((item) => text(item.resourceBindingId) === text(binding.resourceBindingId || binding.id)) || null;
  if (!allocation) {
    allocation = {
      id: `compute-${text(binding.resourceBindingId || binding.id)}`,
      tenantId: userTenantId(user),
      userId: text(user.id),
      workspaceId: text(binding.workspaceId),
      resourceBindingId: text(binding.resourceBindingId || binding.id),
      createdAt: nowIso(),
    };
    allocations.push(allocation);
  }
  allocation.planId = planIdFrom(input, binding.planId);
  allocation.computeUnits = positiveNumber(input.computeUnits ?? input.compute_units, positiveNumber(allocation.computeUnits, 1));
  allocation.status = status;
  allocation.updatedAt = nowIso();
  binding.computeAllocationId = allocation.id;
  binding.computeStatus = status;
  binding.status = status === "released" ? "compute_released" : "active";
  binding.updatedAt = nowIso();
  return allocation;
}

function upsertFreeze(db = {}, user = {}, binding = {}) {
  const freezes = ensureArrayField(db, "weeklyProtectionFreezes");
  let freeze = freezes.find((item) => text(item.resourceBindingId) === text(binding.resourceBindingId || binding.id)) || null;
  if (!freeze) {
    freeze = {
      id: `freeze-${text(binding.resourceBindingId || binding.id)}`,
      tenantId: userTenantId(user),
      userId: text(user.id),
      workspaceId: text(binding.workspaceId),
      resourceBindingId: text(binding.resourceBindingId || binding.id),
      status: "active",
      preauthStatus: "estimated",
      frozenAmountCents: 0,
      createdAt: nowIso(),
    };
    freezes.push(freeze);
  }
  freeze.updatedAt = nowIso();
  return freeze;
}

function appendLedger(db = {}, user = {}, binding = {}, operationType = "") {
  ensureArrayField(db, "ledger").push({
    id: `ledger-${randomUUID()}`,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    type: "cloud_operation_test_freeze",
    amount: 0,
    amountCents: 0,
    currency: "CNY",
    status: "estimated",
    reason: operationType,
    createdAt: nowIso(),
  });
}

function appendBillingReconciliation(db = {}, user = {}, binding = {}, operation = {}) {
  ensureArrayField(db, "billingReconciliations").push({
    id: `recon-${operation.id}`,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    operationId: operation.id,
    status: "reconciling",
    statusLabel: "对账中",
    source: "portal_test_local_executor",
    createdAt: nowIso(),
  });
}

function appendAuditEvent(db = {}, user = {}, binding = {}, operation = {}) {
  ensureArrayField(db, "auditEvents").push({
    id: `audit-${operation.id}`,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    operationId: operation.id,
    action: `portal_cloud_operation_test_${operation.operationType}`,
    status: "recorded",
    createdAt: nowIso(),
  });
}

function upsertProjection(db = {}, user = {}, binding = {}, operation = {}) {
  const projections = ensureArrayField(db, "cloudResourceProjections");
  let projection = projections.find((item) => text(item.resourceBindingId) === text(binding.resourceBindingId || binding.id)) || null;
  if (!projection) {
    projection = {
      id: `projection-${text(binding.resourceBindingId || binding.id)}`,
      tenantId: userTenantId(user),
      userId: text(user.id),
      workspaceId: text(binding.workspaceId),
      resourceBindingId: text(binding.resourceBindingId || binding.id),
      createdAt: nowIso(),
    };
    projections.push(projection);
  }
  projection.status = "updated";
  projection.lastOperationId = operation.id;
  projection.updatedAt = nowIso();
  return projection;
}

function createOperationRecord(db = {}, user = {}, binding = {}, input = {}) {
  const operationType = operationTypeFrom(input);
  const id = `op-${randomUUID()}`;
  const operation = {
    id,
    operationId: id,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    operationType,
    status: "succeeded",
    testOnly: true,
    runnerMode: "local-executor",
    realCloudCalls: false,
    acceptedDryRunId: acceptedDryRunIdFrom(input),
    evidenceRef: `.runtime/v22-cloud-lifecycle/${id}-local-executor.json`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  ensureArrayField(db, "cloudOperations").push(operation);
  return operation;
}

function latestForBinding(rows = [], binding = {}) {
  const bindingId = text(binding?.resourceBindingId || binding?.id);
  return rows
    .filter((item) => text(item.resourceBindingId) === bindingId)
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
}

function publicProjectionForBinding(db = {}, user = {}, binding = null) {
  const fileSpace = latestForBinding(ensureArrayField(db, "fileSpaceEntitlements"), binding);
  const compute = latestForBinding(ensureArrayField(db, "computeAllocations"), binding);
  const reconciliation = latestForBinding(ensureArrayField(db, "billingReconciliations"), binding);
  const computeStatus = text(compute?.status || "none");
  const fileSpaceStatus = text(fileSpace?.status || "none");
  return {
    workspaceId: text(binding?.workspaceId),
    resourceBindingId: text(binding?.resourceBindingId || binding?.id),
    visibleConcepts: ["工作台资源", "计算资源", "文件空间", "套餐", "余额", "冻结金额"],
    resources: {
      workbench: {
        statusLabel: binding ? "可用" : "未开通",
      },
      compute: {
        statusLabel: COMPUTE_STATUS_LABELS.get(computeStatus) || "可用",
        computeUnits: Number(compute?.computeUnits || 0),
        planId: text(compute?.planId || binding?.planId),
      },
      fileSpace: {
        statusLabel: FILE_SPACE_STATUS_LABELS.get(fileSpaceStatus) || "可用",
        capacityGb: Number(fileSpace?.capacityGb || binding?.fileSpaceGb || 0),
      },
    },
    billing: {
      reconciliationStatusLabel: text(reconciliation?.statusLabel || "对账中"),
    },
    userNarrative: {
      statusLabel: fileSpaceStatus === "retention_protected" ? "文件保护期" : "可用",
      visibleConcepts: ["工作台资源", "计算资源", "文件空间", "套餐", "余额", "冻结金额"],
    },
  };
}

function operationPublicView(operation = {}) {
  return {
    id: text(operation.id || operation.operationId),
    operationId: text(operation.operationId || operation.id),
    operationType: text(operation.operationType),
    status: text(operation.status),
    runnerMode: text(operation.runnerMode),
    realCloudCalls: Boolean(operation.realCloudCalls),
    evidenceRef: text(operation.evidenceRef),
  };
}

function validateOperationInput(input = {}) {
  const operationType = operationTypeFrom(input);
  if (!TEST_OPERATIONS.has(operationType)) return { ok: false, status: 422, error: "unsupported_operation_type" };
  if (!workspaceIdFrom(input)) return { ok: false, status: 422, error: "workspace_required" };
  if (!acceptedDryRunIdFrom(input)) return { ok: false, status: 422, error: "accepted_dry_run_required" };
  if ((operationType === "create_storage" || operationType === "expand_storage") && positiveNumber(input.fileSpaceGb ?? input.file_space_gb, 0) <= 0) {
    return { ok: false, status: 422, error: "file_space_required" };
  }
  return { ok: true, operationType };
}

export function executePortalCloudOperationTestLocal(db = {}, user = {}, input = {}) {
  const validation = validateOperationInput(input);
  if (!validation.ok) return validation;

  const workspaceId = workspaceIdFrom(input);
  const planId = planIdFrom(input);
  ensureWorkspace(db, user, workspaceId, planId);

  let binding;
  if (validation.operationType === "create_storage" && !resourceBindingIdFrom(input)) {
    binding = createBinding(db, user, workspaceId, planId);
  } else {
    const found = findOwnedBinding(db, user, workspaceId, resourceBindingIdFrom(input));
    if (!found.ok) return found;
    binding = found.binding;
  }
  binding.planId = planId;
  binding.serverPlanId = planId;
  binding.packageId = planId;

  if (validation.operationType === "create_storage") {
    upsertFileSpaceEntitlement(db, user, binding, input, "available");
    binding.status = text(binding.computeAllocationId) ? "active" : "storage_available";
  }
  if (validation.operationType === "create_compute") {
    upsertComputeAllocation(db, user, binding, input, "available");
  }
  if (validation.operationType === "expand_storage") {
    upsertFileSpaceEntitlement(db, user, binding, input, "available");
  }
  if (validation.operationType === "expand_compute") {
    upsertComputeAllocation(db, user, binding, input, "available");
  }
  if (validation.operationType === "release_compute") {
    upsertComputeAllocation(db, user, binding, input, "released");
  }
  if (validation.operationType === "delete_storage") {
    upsertFileSpaceEntitlement(db, user, binding, input, "retention_protected");
  }

  const operation = createOperationRecord(db, user, binding, input);
  upsertFreeze(db, user, binding);
  appendLedger(db, user, binding, validation.operationType);
  appendBillingReconciliation(db, user, binding, operation);
  appendAuditEvent(db, user, binding, operation);
  upsertProjection(db, user, binding, operation);

  const publicProjection = publicProjectionForBinding(db, user, binding);
  return testBridgeEnvelope({
    operation: operationPublicView(operation),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    publicProjection,
  });
}

export function buildPortalCloudOperationTestProjection(db = {}, user = {}, { workspaceId = "" } = {}) {
  const targetWorkspaceId = text(workspaceId || user.currentTaskSlug || "");
  if (!targetWorkspaceId) return { ok: false, status: 422, error: "workspace_required" };
  const binding = ensureArrayField(db, "workspaceResourceBindings")
    .filter((item) => ownerMatches(item, user))
    .filter((item) => workspaceMatches(item, targetWorkspaceId))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
  if (!binding) return testBridgeEnvelope({
    workspaceId: targetWorkspaceId,
    visibleConcepts: ["工作台资源", "计算资源", "文件空间", "套餐", "余额", "冻结金额"],
    resources: {
      workbench: { statusLabel: "未开通" },
      compute: { statusLabel: "未开通", computeUnits: 0, planId: "" },
      fileSpace: { statusLabel: "未开通", capacityGb: 0 },
    },
    billing: { reconciliationStatusLabel: "对账中" },
  });

  return testBridgeEnvelope(publicProjectionForBinding(db, user, binding));
}
