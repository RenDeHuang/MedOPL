const RELEASED_BINDING_STATUSES = new Set([
  "release_requested",
  "billing_stop_confirming",
  "billing_stopped",
  "audit_pending",
  "audit_ready",
  "audited",
]);

function text(value) {
  return String(value ?? "").trim();
}

function userTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function ensureArrayField(db, key) {
  db[key] = Array.isArray(db[key]) ? db[key] : [];
  return db[key];
}

function addMinutes(iso = "", minutes = 0) {
  return new Date(Date.parse(iso) + Number(minutes || 0) * 60 * 1000).toISOString();
}

function addDays(iso = "", days = 0) {
  return new Date(Date.parse(iso) + Number(days || 0) * 24 * 60 * 60 * 1000).toISOString();
}

function releaseTimeFrom(input = {}) {
  const explicit = text(input.releasedAt || input.released_at);
  if (explicit) return new Date(Date.parse(explicit)).toISOString();
  return new Date().toISOString();
}

function transition(status = "", at = "") {
  return { status: text(status), at: text(at) };
}

function ownerMatches(item = {}, user = {}) {
  return text(item.ownerUserId || item.userId || item.user_id) === text(user.id)
    && text(item.ownerTenantId || item.tenantId || item.tenant_id) === userTenantId(user);
}

function bindingMatchesWorkspace(item = {}, user = {}, workspaceId = "") {
  return ownerMatches(item, user) && text(item.workspaceId) === text(workspaceId);
}

function bindingReleaseStatus(binding = {}) {
  return text(binding.status || "active").toLowerCase();
}

function bindingAlreadyReleased(binding = {}) {
  return RELEASED_BINDING_STATUSES.has(bindingReleaseStatus(binding)) || Boolean(text(binding.releasedAt || binding.billingStoppedAt));
}

function findActiveBinding(db = {}, user = {}, workspaceId = "") {
  return ensureArrayField(db, "workspaceResourceBindings")
    .find((item) => bindingMatchesWorkspace(item, user, workspaceId) && bindingReleaseStatus(item) === "active") || null;
}

function findReleasedBinding(db = {}, user = {}, workspaceId = "") {
  return ensureArrayField(db, "workspaceResourceBindings")
    .find((item) => bindingMatchesWorkspace(item, user, workspaceId) && bindingAlreadyReleased(item)) || null;
}

function workspaceIdFrom(input = {}) {
  return text(input.workspaceId || input.workspace_id);
}

function releaseAuditEvent(binding = {}, user = {}, release = {}, input = {}) {
  return {
    id: `audit-${text(binding.resourceBindingId || binding.id)}-${text(release.releasedAt)}`,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    billingAccountId: text(binding.billingAccountId),
    auditTag: text(binding.auditTag),
    action: "managed_environment_release_stop_billing_audit_pending",
    reason: text(input.reason || "user_release_managed_environment"),
    status: "audit_pending",
    releasedAt: text(release.releasedAt),
    billingStoppedAt: text(release.billingStoppedAt),
    billingStopConfirmBy: text(release.billingStopConfirmBy),
    auditReadyAt: text(release.auditReadyAt),
    createdAt: text(release.releasedAt),
  };
}

function releasePublicResourceBinding(binding = {}) {
  return {
    id: text(binding.id),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    tenantId: text(binding.tenantId || binding.ownerTenantId),
    userId: text(binding.userId || binding.ownerUserId),
    workspaceId: text(binding.workspaceId),
    billingAccountId: text(binding.billingAccountId),
    auditTag: text(binding.auditTag),
    costAllocationTag: text(binding.costAllocationTag),
    status: text(binding.status),
    releasedAt: text(binding.releasedAt),
    billingStoppedAt: text(binding.billingStoppedAt),
    billingStopConfirmBy: text(binding.billingStopConfirmBy),
    auditReadyAt: text(binding.auditReadyAt),
    updatedAt: text(binding.updatedAt),
  };
}

function releasePayload(binding = {}) {
  return {
    status: text(binding.status),
    releasedAt: text(binding.releasedAt),
    transitions: Array.isArray(binding.releaseTransitions) ? binding.releaseTransitions.map((item) => ({
      status: text(item.status),
      at: text(item.at),
    })) : [],
  };
}

function stopBillingPayload(binding = {}) {
  return {
    status: text(binding.stopBillingStatus || "billing_stopped"),
    billingStoppedAt: text(binding.billingStoppedAt),
    billingStopConfirmBy: text(binding.billingStopConfirmBy),
    confirmationWindowMinutes: 120,
  };
}

function auditPayload(binding = {}) {
  return {
    status: text(binding.auditStatus || "audit_pending"),
    auditReadyAt: text(binding.auditReadyAt),
    auditPolicy: "T+1",
  };
}

function protectWorkspaceFiles(db = {}, user = {}, binding = {}, releasedAt = "") {
  const cleanupAfterAt = addDays(releasedAt, 7);
  let count = 0;
  const fileIds = [];
  for (const file of ensureArrayField(db, "workspaceFiles")) {
    if (text(file.tenantId) !== userTenantId(user)) continue;
    if (text(file.userId) !== text(user.id)) continue;
    if (text(file.workspaceId) !== text(binding.workspaceId)) continue;
    if (text(file.resourceBindingId) !== text(binding.resourceBindingId || binding.id)) continue;
    if (text(file.status || "active") === "deleted") continue;
    file.status = "retention_protected";
    file.protectionStatus = "protected";
    file.releaseProtectionStatus = "retention_protected";
    file.deletedAt = releasedAt;
    file.retentionCleanupAfterAt = cleanupAfterAt;
    file.updatedAt = releasedAt;
    count += 1;
    fileIds.push(text(file.id));
  }
  return {
    status: "retention_protected",
    workspaceFileCount: count,
    workspaceFileIds: fileIds,
    retentionCleanupAfterAt: cleanupAfterAt,
  };
}

function markBackendResourcesBillingStopped(db = {}, binding = {}, releasedAt = "") {
  for (const compute of ensureArrayField(db, "userComputeInstances")) {
    if (text(compute.id) !== text(binding.computeInstanceId)) continue;
    compute.status = "billing_stopped";
    compute.billingStoppedAt = releasedAt;
    compute.updatedAt = releasedAt;
  }
  for (const storage of ensureArrayField(db, "userStorageBuckets")) {
    if (text(storage.id) !== text(binding.storageBucketId)) continue;
    storage.status = "billing_stopped";
    storage.billingStoppedAt = releasedAt;
    storage.updatedAt = releasedAt;
  }
}

function markFreezeReleased(db = {}, binding = {}, releasedAt = "") {
  const freeze = ensureArrayField(db, "weeklyProtectionFreezes")
    .find((item) => text(item.resourceBindingId) === text(binding.resourceBindingId || binding.id)) || null;
  if (!freeze) return null;
  freeze.status = "released";
  freeze.preauthStatus = "billing_stopped";
  freeze.releasedAt = releasedAt;
  freeze.billingStoppedAt = releasedAt;
  freeze.updatedAt = releasedAt;
  freeze.remainingAmount = 0;
  freeze.remainingAmountCents = 0;
  freeze.frozenAmount = 0;
  freeze.frozenAmountCents = 0;
  return freeze;
}

export function releaseManagedEnvironment(db = {}, user = {}, input = {}) {
  const workspaceId = workspaceIdFrom(input);
  if (!workspaceId) return { ok: false, status: 422, error: "workspace_required" };

  const active = findActiveBinding(db, user, workspaceId);
  if (!active) {
    const released = findReleasedBinding(db, user, workspaceId);
    if (released) return { ok: false, status: 409, error: "managed_environment_already_released" };
    return { ok: false, status: 409, error: "managed_environment_required" };
  }

  const releasedAt = releaseTimeFrom(input);
  const billingStopConfirmBy = addMinutes(releasedAt, 120);
  const auditReadyAt = addDays(releasedAt, 1);
  const transitions = [
    transition("release_requested", releasedAt),
    transition("billing_stop_confirming", releasedAt),
    transition("billing_stopped", releasedAt),
    transition("audit_pending", releasedAt),
  ];

  active.status = "audit_pending";
  active.releaseStatus = "released";
  active.releaseRequestedAt = releasedAt;
  active.releasedAt = releasedAt;
  active.billingStoppedAt = releasedAt;
  active.billingStopConfirmBy = billingStopConfirmBy;
  active.stopBillingStatus = "billing_stopped";
  active.auditStatus = "audit_pending";
  active.auditReadyAt = auditReadyAt;
  active.releaseTransitions = transitions;
  active.updatedAt = releasedAt;

  markBackendResourcesBillingStopped(db, active, releasedAt);
  markFreezeReleased(db, active, releasedAt);
  const fileProtection = protectWorkspaceFiles(db, user, active, releasedAt);

  const release = {
    releasedAt,
    billingStoppedAt: releasedAt,
    billingStopConfirmBy,
    auditReadyAt,
  };
  ensureArrayField(db, "managedEnvironmentReleaseAudits").push(releaseAuditEvent(active, user, release, input));

  return {
    ok: true,
    released: true,
    resourceBinding: releasePublicResourceBinding(active),
    release: releasePayload(active),
    stopBilling: stopBillingPayload(active),
    audit: auditPayload(active),
    fileProtection,
  };
}
