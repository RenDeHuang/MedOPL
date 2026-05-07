import { randomUUID } from "node:crypto";

import { getCanonicalResourcePlan, canonicalResourcePlanPublicView } from "./lab-packages.mjs";
import { managedEnvironmentReadinessFromState } from "./user-credit-provider-key-flow.mjs";

function text(value) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function userTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function ensureArrayField(db, key) {
  db[key] = Array.isArray(db[key]) ? db[key] : [];
  return db[key];
}

function centsFromYuan(value = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return "";
}

function workspaceIdFrom(input = {}) {
  return firstNonEmptyText(input.workspaceId, input.workspace_id);
}

function resolvePlan(planId = "") {
  const plan = getCanonicalResourcePlan(planId);
  if (!plan) return null;
  if (!["starter_2c4g_10gb", "pro_8c16g_100gb"].includes(plan.id)) return null;
  return plan;
}

function fileSpaceFrom(input = {}, plan = {}) {
  const requested = Number(firstNonEmptyText(input.fileSpaceGb, input.file_space_gb, input.fileSpace?.capacityGb, input.fileSpace?.capacity_gb));
  const planCapacityGb = Number(plan.storage?.capacityGb || 0);
  if (!Number.isFinite(requested) || requested <= 0 || requested !== planCapacityGb) return null;
  return {
    capacityGb: requested,
    storageBackend: plan.storageBackend,
    status: "active",
  };
}

function hasFileSpaceInput(input = {}) {
  return Boolean(firstNonEmptyText(input.fileSpaceGb, input.file_space_gb, input.fileSpace?.capacityGb, input.fileSpace?.capacity_gb));
}

function ensureWorkspace(db = {}, user = {}, workspaceId = "", plan = {}) {
  const taskSpaces = ensureArrayField(db, "taskSpaces");
  let workspace = taskSpaces.find((item) => text(item.userId || item.ownerUserId) === text(user.id) && text(item.slug || item.workspaceId || item.id) === workspaceId);
  if (!workspace) {
    workspace = {
      id: workspaceId,
      slug: workspaceId,
      workspaceId,
      userId: text(user.id),
      ownerUserId: text(user.id),
      ownerTenantId: userTenantId(user),
      status: "active",
      createdAt: nowIso(),
    };
    taskSpaces.push(workspace);
  }
  workspace.serverPlanId = plan.id;
  workspace.packageId = plan.id;
  workspace.fileSpaceGb = Number(plan.storage?.capacityGb || 0);
  workspace.fileSpaceBackend = plan.storageBackend;
  workspace.managedEnvironmentStatus = "active";
  workspace.updatedAt = nowIso();
  return workspace;
}

function managedEnvironmentBillingAccountId(user = {}) {
  return userTenantId(user);
}

function auditTagFor(user = {}, workspaceId = "") {
  return `tenant:${userTenantId(user)}/user:${text(user.id)}/workspace:${workspaceId}`;
}

function costAllocationTagFor(user = {}, workspaceId = "") {
  return `medopl:v22:${userTenantId(user)}:${workspaceId}`;
}

function createComputeResource(db = {}, user = {}, workspaceId = "", plan = {}, bindingId = "") {
  const compute = {
    id: `compute-${bindingId}`,
    ownerTenantId: userTenantId(user),
    ownerUserId: text(user.id),
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId,
    planId: plan.id,
    provider: "platform-managed",
    implementationKind: "platform-managed CVM / runtime",
    runtimeKind: "managed_opl_runtime",
    cpuCores: Number(plan.compute?.cpuCores || 0),
    memoryGb: Number(plan.compute?.memoryGb || 0),
    status: "active",
    billingAccountId: managedEnvironmentBillingAccountId(user),
    auditTag: auditTagFor(user, workspaceId),
    costAllocationTag: costAllocationTagFor(user, workspaceId),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  ensureArrayField(db, "userComputeInstances").push(compute);
  return compute;
}

function createStorageResource(db = {}, user = {}, workspaceId = "", plan = {}, bindingId = "") {
  const storage = {
    id: `storage-${bindingId}`,
    ownerTenantId: userTenantId(user),
    ownerUserId: text(user.id),
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId,
    planId: plan.id,
    provider: "platform-managed",
    implementationKind: "platform-managed COS",
    storageBackend: plan.storageBackend,
    storageCapacityGb: Number(plan.storage?.capacityGb || 0),
    status: "active",
    billingAccountId: managedEnvironmentBillingAccountId(user),
    auditTag: auditTagFor(user, workspaceId),
    costAllocationTag: costAllocationTagFor(user, workspaceId),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  ensureArrayField(db, "userStorageBuckets").push(storage);
  return storage;
}

function createWorkspaceBinding(db = {}, user = {}, workspaceId = "", plan = {}, compute = {}, storage = {}, bindingId = "") {
  const binding = {
    id: bindingId,
    resourceBindingId: bindingId,
    ownerTenantId: userTenantId(user),
    ownerUserId: text(user.id),
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId,
    planId: plan.id,
    packageId: plan.id,
    serverPlanId: plan.id,
    computeInstanceId: compute.id,
    storageBucketId: storage.id,
    fileSpaceGb: Number(plan.storage?.capacityGb || 0),
    storageBackend: plan.storageBackend,
    rootPrefix: `tenants/${userTenantId(user)}/workspaces/${workspaceId}/`,
    status: "active",
    billingAccountId: managedEnvironmentBillingAccountId(user),
    auditTag: auditTagFor(user, workspaceId),
    costAllocationTag: costAllocationTagFor(user, workspaceId),
    basePrice: null,
    pendingProductApproval: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  ensureArrayField(db, "workspaceResourceBindings").push(binding);
  return binding;
}

function createFreeze(db = {}, user = {}, workspaceId = "", plan = {}, binding = {}, input = {}) {
  const weeklyAmount = Number(input.freezeAmount || input.weeklyAmount || 0);
  const freeze = {
    id: `freeze-${binding.resourceBindingId}`,
    resourceBindingId: binding.resourceBindingId,
    ownerTenantId: userTenantId(user),
    ownerUserId: text(user.id),
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId,
    computeInstanceId: binding.computeInstanceId,
    storageBucketId: binding.storageBucketId,
    billingAccountId: binding.billingAccountId,
    auditTag: binding.auditTag,
    costAllocationTag: binding.costAllocationTag,
    usageMode: "full_runtime",
    weeklyAmount,
    weeklyAmountCents: centsFromYuan(weeklyAmount),
    frozenAmount: weeklyAmount,
    frozenAmountCents: centsFromYuan(weeklyAmount),
    consumedAmount: 0,
    remainingAmount: weeklyAmount,
    status: "active_pending_product_approval",
    preauthStatus: "pending_product_approval",
    basePrice: null,
    pendingProductApproval: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  ensureArrayField(db, "weeklyProtectionFreezes").push(freeze);
  return freeze;
}

export function managedEnvironmentUserNarrative() {
  return {
    statusLabel: "托管运行环境已开通",
    visibleConcepts: ["托管运行环境", "工作空间", "文件空间", "套餐", "余额", "预扣费"],
  };
}

export function resourceBindingPublicView(binding = {}) {
  if (!binding) return null;
  return {
    id: text(binding.id),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    tenantId: text(binding.tenantId || binding.ownerTenantId),
    userId: text(binding.userId || binding.ownerUserId),
    workspaceId: text(binding.workspaceId),
    billingAccountId: text(binding.billingAccountId),
    auditTag: text(binding.auditTag),
    costAllocationTag: text(binding.costAllocationTag),
    computeInstanceId: text(binding.computeInstanceId),
    storageBucketId: text(binding.storageBucketId),
    fileSpaceGb: Number(binding.fileSpaceGb || 0),
    storageBackend: text(binding.storageBackend),
    status: text(binding.status || "active"),
    createdAt: text(binding.createdAt),
    updatedAt: text(binding.updatedAt),
  };
}

export function freezePublicView(freeze = null) {
  if (!freeze) return null;
  return {
    id: text(freeze.id),
    resourceBindingId: text(freeze.resourceBindingId),
    status: text(freeze.status),
    preauthStatus: text(freeze.preauthStatus),
    billingAccountId: text(freeze.billingAccountId),
    auditTag: text(freeze.auditTag),
    costAllocationTag: text(freeze.costAllocationTag),
    weeklyAmount: Number(freeze.weeklyAmount || 0),
    weeklyAmountCents: Number(freeze.weeklyAmountCents || 0),
    frozenAmount: Number(freeze.frozenAmount || 0),
    frozenAmountCents: Number(freeze.frozenAmountCents || 0),
    consumedAmount: Number(freeze.consumedAmount || 0),
    remainingAmount: Number(freeze.remainingAmount || 0),
    basePrice: null,
    pendingProductApproval: true,
    createdAt: text(freeze.createdAt),
    updatedAt: text(freeze.updatedAt),
  };
}

export function workspacePublicView(workspace = {}, workspaceId = "") {
  return {
    id: text(workspace.id || workspace.slug || workspaceId),
    workspaceId: text(workspace.workspaceId || workspace.slug || workspaceId),
    slug: text(workspace.slug || workspaceId),
    status: text(workspace.status || "active"),
  };
}

export function fileSpacePublicView(source = {}, plan = {}) {
  return {
    capacityGb: Number(source.fileSpaceGb || source.storageCapacityGb || plan.storage?.capacityGb || 0),
    storageBackend: text(source.storageBackend || source.fileSpaceBackend || plan.storageBackend),
    status: text(source.status || "active"),
  };
}

export function openManagedEnvironment(db = {}, user = {}, input = {}, { state = {} } = {}) {
  const readiness = managedEnvironmentReadinessFromState(state);
  if (!readiness.ok) return readiness;

  const workspaceId = workspaceIdFrom(input);
  if (!workspaceId) return { ok: false, status: 422, error: "workspace_required" };

  const planId = firstNonEmptyText(input.planId, input.plan_id);
  if (!planId) return { ok: false, status: 422, error: "plan_required" };

  if (!hasFileSpaceInput(input)) return { ok: false, status: 422, error: "file_space_required" };

  const plan = resolvePlan(planId);
  if (!plan) return { ok: false, status: 422, error: "invalid_managed_environment_plan" };

  const fileSpace = fileSpaceFrom(input, plan);
  if (!fileSpace) return { ok: false, status: 422, error: "invalid_file_space_for_plan" };

  const existing = ensureArrayField(db, "workspaceResourceBindings")
    .find((item) => text(item.ownerUserId || item.userId) === text(user.id) && text(item.workspaceId) === workspaceId && text(item.status || "active") === "active");
  if (existing) {
    const existingPlan = resolvePlan(existing.planId || existing.serverPlanId || plan.id) || plan;
    const existingFreeze = ensureArrayField(db, "weeklyProtectionFreezes")
      .find((item) => text(item.resourceBindingId) === text(existing.resourceBindingId || existing.id)) || null;
    const existingWorkspace = ensureWorkspace(db, user, workspaceId, existingPlan);
    return {
      ok: true,
      created: false,
      managedEnvironmentEnabled: true,
      userNarrative: managedEnvironmentUserNarrative(),
      workspace: workspacePublicView(existingWorkspace, workspaceId),
      fileSpace: fileSpacePublicView(existing, existingPlan),
      selectedPlan: canonicalResourcePlanPublicView(existingPlan),
      resourceBinding: resourceBindingPublicView(existing),
      freeze: freezePublicView(existingFreeze),
    };
  }

  const bindingId = `rb-${randomUUID()}`;
  const workspace = ensureWorkspace(db, user, workspaceId, plan);
  const compute = createComputeResource(db, user, workspaceId, plan, bindingId);
  const storage = createStorageResource(db, user, workspaceId, plan, bindingId);
  const binding = createWorkspaceBinding(db, user, workspaceId, plan, compute, storage, bindingId);
  const freeze = createFreeze(db, user, workspaceId, plan, binding, input);

  return {
    ok: true,
    created: true,
    managedEnvironmentEnabled: true,
    userNarrative: managedEnvironmentUserNarrative(),
    workspace: workspacePublicView(workspace, workspaceId),
    fileSpace,
    selectedPlan: canonicalResourcePlanPublicView(plan),
    resourceBinding: resourceBindingPublicView(binding),
    freeze: freezePublicView(freeze),
  };
}
