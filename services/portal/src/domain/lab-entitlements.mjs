import { getLabPackage } from "./lab-packages.mjs";
import { currentLabSubscription, ensureLabSubscriptionCollections } from "./lab-subscriptions.mjs";

const BYTES_PER_GB = 1024 ** 3;

function userTenantId(user = {}) {
  return String(user.tenantId || user.id || "").trim();
}

function text(value = "") {
  return String(value ?? "").trim();
}

function activeBindingForWorkspace(db = {}, { user, workspaceId = "" } = {}) {
  const tenantId = userTenantId(user);
  const userId = text(user?.id);
  return (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : [])
    .filter((item) => text(item.workspaceId) === text(workspaceId))
    .filter((item) => text(item.userId || item.ownerUserId) === userId)
    .filter((item) => !tenantId || text(item.tenantId || item.ownerTenantId) === tenantId)
    .filter((item) => ["active", "release_requested", "billing_stop_confirming", "billing_stopped", "audit_pending", "audit_ready", "audited"].includes(text(item.status || "active").toLowerCase()))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
}

function bindingId(binding = {}) {
  return text(binding.resourceBindingId || binding.id);
}

function billingAttributionId(binding = {}) {
  return text(binding.billingAttributionId || binding.billing_attribution_id || binding.cloudOperationId || binding.cloud_operation_id || binding.costAllocationTag || bindingId(binding));
}

function accountId(binding = {}, user = {}) {
  return text(binding.accountId || binding.account_id || binding.userId || binding.user_id || binding.ownerUserId || user.id);
}

function serverPlanId(binding = {}, fallback = "") {
  return text(binding.serverPlanId || binding.server_plan_id || binding.planId || binding.plan_id || binding.packageId || binding.package_id || fallback);
}

export function activeLabStorageAddons(db, subscriptionId = "") {
  ensureLabSubscriptionCollections(db);
  return db.labStorageAddons
    .filter((item) => item.subscriptionId === subscriptionId)
    .filter((item) => item.status === "active");
}

export function workspaceUsedBytes(db, { user, workspaceId = "" } = {}) {
  const tenantId = userTenantId(user);
  const userId = String(user?.id || "").trim();
  return (Array.isArray(db.workspaceFiles) ? db.workspaceFiles : [])
    .filter((item) => item.workspaceId === workspaceId)
    .filter((item) => item.userId === userId || item.tenantId === tenantId)
    .filter((item) => String(item.status || "").toLowerCase() !== "deleted")
    .reduce((sum, item) => sum + Math.max(0, Number(item.sizeBytes || 0)), 0);
}

export function resolveLabEntitlement(db, { user, workspaceId = "default" } = {}) {
  const subscription = currentLabSubscription(db, { user, workspaceId });
  if (!subscription) {
    return {
      enabled: false,
      status: "disabled",
      packageId: "",
      packageName: "",
      sourceType: "none",
      compute: { tier: "", cores: 0, maxConcurrentRuns: 0 },
      storage: { includedGb: 0, addonGb: 0, totalGb: 0, usedGb: 0, warningRatio: 0.8, warning: false, blocked: false },
      gates: { canUpload: false, canRun: false, canDownload: true },
      message: "尚未开通实验室套餐。",
    };
  }
  const labPackage = getLabPackage(subscription.packageId);
  const addons = activeLabStorageAddons(db, subscription.id);
  const addonGb = addons.reduce((sum, item) => sum + Number(item.storageGb || 0), 0);
  const totalGb = Math.max(0, Number(subscription.includedStorageGb || 0) + addonGb);
  const usedGb = Math.round((workspaceUsedBytes(db, { user, workspaceId }) / BYTES_PER_GB) * 100) / 100;
  const availableGb = Math.max(0, Math.round((totalGb - usedGb) * 100) / 100);
  const warningRatio = Number(labPackage?.storage?.warningRatio || 0.8);
  const usageRatio = totalGb > 0 ? usedGb / totalGb : 0;
  const status = subscription.status;
  const canWriteByStatus = status === "active";
  const canUpload = canWriteByStatus && usageRatio < 1;
  const canRun = canWriteByStatus;
  const canDownload = true;
  return {
    enabled: true,
    status,
    subscriptionId: subscription.id,
    packageId: subscription.packageId,
    packageName: labPackage?.name || subscription.packageId,
    sourceType: "lab_package",
    compute: {
      tier: subscription.computeTier,
      cores: Number(labPackage?.compute?.cores || 0),
      maxConcurrentRuns: Number(labPackage?.compute?.maxConcurrentRuns || 0),
      backingServerPlanId: subscription.backingServerPlanId,
    },
    storage: {
      includedGb: Number(subscription.includedStorageGb || 0),
      addonGb,
      totalGb,
      usedGb,
      availableGb,
      retentionDays: 7,
      warningRatio,
      warning: usageRatio >= warningRatio && usageRatio < 1,
      blocked: usageRatio >= 1,
    },
    gates: {
      canUpload,
      canRun,
      canDownload,
    },
    actions: {
      canCreateWorkspace: status === "active",
      canUploadFile: canUpload,
      canStartPaidRun: canRun,
      canDownloadExistingOutputs: canDownload,
    },
    nextStepCopy: canRun ? "你可以上传文件并启动一个小型任务。" : "当前只能查看和下载已生成的结果。",
    message: status === "active"
      ? "实验室套餐权益已就绪。"
      : "当前处于宽限或清理状态，只允许下载已产生的文件。",
  };
}

export function storageUsageRatio(db, { user, workspaceId = "default" } = {}) {
  const entitlement = resolveLabEntitlement(db, { user, workspaceId });
  const totalGb = Number(entitlement.storage.totalGb || 0);
  const usedGb = Number(entitlement.storage.usedGb || 0);
  return {
    usedGb,
    totalGb,
    ratio: totalGb > 0 ? Math.round((usedGb / totalGb) * 10000) / 10000 : 0,
    warning: Boolean(entitlement.storage.warning),
    blocked: Boolean(entitlement.storage.blocked),
  };
}

export function resolveWorkspaceLabStorageEntitlement(db, { user, workspaceId, tenantId, cosPrefix } = {}) {
  const labEntitlement = resolveLabEntitlement(db, { user, workspaceId });
  if (!labEntitlement.enabled) return null;
  const binding = activeBindingForWorkspace(db, { user, workspaceId });
  const resourceBindingId = bindingId(binding);
  return {
    enabled: true,
    status: labEntitlement.status,
    freeQuotaGb: labEntitlement.storage.includedGb,
    minimumPurchaseGb: 0,
    storageBackend: "package_storage",
    retentionPolicy: "lab_subscription_lifecycle",
    cosPrefix,
    resourceBindingId,
    billingAttributionId: billingAttributionId(binding),
    accountId: accountId(binding, user),
    storagePlanId: labEntitlement.packageId,
    serverPlanId: serverPlanId(binding, labEntitlement.packageId),
    storageSizeGb: labEntitlement.storage.totalGb,
    sourceType: "lab_package",
    labEntitlement,
    gates: labEntitlement.gates,
    message: labEntitlement.message,
    tenantId,
  };
}
