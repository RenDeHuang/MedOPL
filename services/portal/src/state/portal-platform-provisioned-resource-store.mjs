import {
  buildOwnerAccessPolicy,
  buildWeeklyProtectionFreezeView,
  buildWorkspaceBindingAccess,
  moneyDelta,
  normalizeCustomerComputeResource,
  normalizeCustomerStorageResource,
  normalizeWeeklyProtectionFreeze,
  normalizeWorkspaceResourceBinding,
  ownerScopeFromUser,
  usageModeNeedsFreeze,
} from "../domain/platform-provisioned-resources.mjs";

function text(value) {
  return String(value ?? "").trim();
}

function resourceLifecycleMode(payload = {}) {
  const raw = text(payload.provisioningMode || payload.provisioning_mode || payload.resourceLifecycleMode || payload.resource_lifecycle_mode || "platform_provisioned")
    .toLowerCase()
    .replace(/-/g, "_");
  if (!["platform_provisioned", "customer_dedicated", "cloud", "cloud_provisioned", "registered", "registered_only"].includes(raw)) {
    const error = new Error("unsupported_resource_lifecycle_mode");
    error.code = "unsupported_resource_lifecycle_mode";
    error.status = 410;
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

function isPlatformProvisionedMode(value = "") {
  return ["platform_provisioned", "customer_dedicated"].includes(text(value).toLowerCase().replace(/-/g, "_"));
}

function cloudProvisionerRequired() {
  const error = new Error("cloud_provisioner_required");
  error.code = "cloud_provisioner_required";
  error.status = 503;
  throw error;
}

function isoNow() {
  return new Date().toISOString();
}

function ensureCollections(db = {}) {
  if (!Array.isArray(db.userComputeInstances)) db.userComputeInstances = [];
  if (!Array.isArray(db.userStorageBuckets)) db.userStorageBuckets = [];
  if (!Array.isArray(db.workspaceResourceBindings)) db.workspaceResourceBindings = [];
  if (!Array.isArray(db.weeklyProtectionFreezes)) db.weeklyProtectionFreezes = [];
  return db;
}

function assertOwned(item = {}, owner = {}) {
  return text(item.ownerUserId) === text(owner.ownerUserId) && text(item.ownerTenantId) === text(owner.ownerTenantId);
}

function isActiveStatus(value = "") {
  return text(value).toLowerCase() === "active";
}

function byRecent(left = {}, right = {}) {
  return String(right.updatedAt || right.windowStartAt || right.createdAt || "").localeCompare(
    String(left.updatedAt || left.windowStartAt || left.createdAt || ""),
  );
}

function withFreezeView(freeze = {}) {
  return buildWeeklyProtectionFreezeView(freeze);
}

function collectOwnedComputeInstances(db = {}, owner = {}) {
  return db.userComputeInstances
    .filter((item) => assertOwned(item, owner))
    .sort(byRecent);
}

function collectOwnedStorageBuckets(db = {}, owner = {}) {
  return db.userStorageBuckets
    .filter((item) => assertOwned(item, owner))
    .sort(byRecent);
}

function collectOwnedProtectionFreezes(db = {}, owner = {}) {
  return db.weeklyProtectionFreezes
    .filter((item) => assertOwned(item, owner))
    .map(withFreezeView)
    .sort(byRecent);
}

function indexById(items = []) {
  const result = new Map();
  for (const item of items) {
    result.set(text(item.id), item);
  }
  return result;
}

function protectionForBindingId(freezes = []) {
  const result = new Map();
  for (const freeze of freezes) {
    const key = text(freeze.resourceBindingId);
    const current = result.get(key);
    if (!current) {
      result.set(key, freeze);
      continue;
    }
    const currentActive = isActiveStatus(current.status);
    const nextActive = isActiveStatus(freeze.status);
    if (nextActive && !currentActive) {
      result.set(key, freeze);
      continue;
    }
    if (nextActive === currentActive && byRecent(current, freeze) > 0) {
      result.set(key, freeze);
    }
  }
  return result;
}

function enrichBinding(binding = {}, maps = {}) {
  const computeInstance = maps.computeById.get(text(binding.computeInstanceId)) || null;
  const storageBucket = maps.storageById.get(text(binding.storageBucketId)) || null;
  const protection = maps.protectionByBindingId.get(text(binding.id)) || maps.protectionByBindingId.get(text(binding.resourceBindingId)) || null;
  return {
    ...binding,
    bindingAccess: buildWorkspaceBindingAccess(binding),
    computeInstance,
    storageBucket,
    computeInstances: computeInstance ? [computeInstance] : [],
    storageBuckets: storageBucket ? [storageBucket] : [],
    protection,
  };
}

function buildOwnedResourceMaps(db = {}, owner = {}) {
  const computeInstances = collectOwnedComputeInstances(db, owner);
  const storageBuckets = collectOwnedStorageBuckets(db, owner);
  const protectionFreezes = collectOwnedProtectionFreezes(db, owner);
  return {
    computeInstances,
    storageBuckets,
    protectionFreezes,
    computeById: indexById(computeInstances),
    storageById: indexById(storageBuckets),
    protectionByBindingId: protectionForBindingId(protectionFreezes),
  };
}

function buildBindingView(db = {}, owner = {}, binding = null) {
  if (!binding) return null;
  const maps = buildOwnedResourceMaps(db, owner);
  return enrichBinding(binding, maps);
}

function activeBindings(bindings = []) {
  return bindings.filter((item) => isActiveStatus(item.status));
}

function findOwnedBinding(db = {}, owner = {}, bindingId = "") {
  return db.workspaceResourceBindings.find((item) => {
    if (!assertOwned(item, owner)) return false;
    return text(item.id) === bindingId || text(item.resourceBindingId) === bindingId;
  }) || null;
}

function findOwnedComputeInstance(db = {}, owner = {}, computeInstanceId = "") {
  return db.userComputeInstances.find((item) => {
    if (!assertOwned(item, owner)) return false;
    return (
      text(item.id) === computeInstanceId
      || text(item.instanceId) === computeInstanceId
      || text(item.cvmInstanceId) === computeInstanceId
    );
  }) || null;
}

function findOwnedStorageBucket(db = {}, owner = {}, storageBucketId = "") {
  return db.userStorageBuckets.find((item) => {
    if (!assertOwned(item, owner)) return false;
    return text(item.id) === storageBucketId || text(item.bucketId) === storageBucketId || text(item.bucketName) === storageBucketId;
  }) || null;
}

function findActiveOwnedBinding(db = {}, owner = {}, bindingId = "") {
  const binding = findOwnedBinding(db, owner, bindingId);
  if (!binding || !isActiveStatus(binding.status)) {
    const error = new Error("active_binding_required");
    error.code = "active_binding_required";
    throw error;
  }
  return binding;
}

function updateOwnedComputeInstance(db = {}, owner = {}, computeId = "", updater = (item) => item) {
  let updatedItem = null;
  db.userComputeInstances = db.userComputeInstances.map((item) => {
    if (!assertOwned(item, owner)) return item;
    if (text(item.id) !== computeId) return item;
    updatedItem = updater(item);
    return updatedItem;
  });
  return updatedItem;
}

function updateOwnedStorageBucket(db = {}, owner = {}, storageBucketId = "", updater = (item) => item) {
  let updatedItem = null;
  db.userStorageBuckets = db.userStorageBuckets.map((item) => {
    if (!assertOwned(item, owner)) return item;
    if (text(item.id) !== storageBucketId) return item;
    updatedItem = updater(item);
    return updatedItem;
  });
  return updatedItem;
}

function deactivateBindings(db = {}, owner = {}, accepts = () => false) {
  const updated = [];
  const updatedAt = isoNow();
  db.workspaceResourceBindings = db.workspaceResourceBindings.map((item) => {
    if (!assertOwned(item, owner)) return item;
    if (!accepts(item)) return item;
    if (!isActiveStatus(item.status)) return item;
    const next = { ...item, status: "inactive", updatedAt };
    updated.push(next);
    return next;
  });
  return updated;
}

function releaseBindingProtection(db = {}, owner = {}, bindingIds = []) {
  const scope = new Set(bindingIds.map((item) => text(item)).filter(Boolean));
  if (!scope.size) {
    return { ok: true, count: 0, releasedAmount: 0, items: [] };
  }
  let count = 0;
  let releasedAmount = 0;
  const items = [];
  const updatedAt = isoNow();
  db.weeklyProtectionFreezes = db.weeklyProtectionFreezes.map((item) => {
    if (!assertOwned(item, owner)) return item;
    if (!scope.has(text(item.resourceBindingId))) return item;
    const current = withFreezeView(item);
    const releasableAmount = Number(current.remainingAmount || 0);
    const alreadyReleased = text(current.status).toLowerCase() === "released";
    if (alreadyReleased && releasableAmount <= 0) return item;
    const next = {
      ...item,
      remainingAmount: 0,
      status: "released",
      updatedAt,
    };
    count += 1;
    releasedAmount += releasableAmount;
    items.push(withFreezeView(next));
    return next;
  });
  return {
    ok: true,
    count,
    releasedAmount: moneyDelta(releasedAmount),
    items,
  };
}

function stopComputeBillingWhenUnused(db = {}, owner = {}, computeId = "", status = "inactive") {
  const hasActiveBinding = db.workspaceResourceBindings.some((item) => {
    if (!assertOwned(item, owner)) return false;
    if (!isActiveStatus(item.status)) return false;
    return text(item.computeInstanceId) === computeId;
  });
  if (hasActiveBinding) return findOwnedComputeInstance(db, owner, computeId);
  return updateOwnedComputeInstance(db, owner, computeId, (item) => ({
    ...item,
    status,
    billingStoppedAt: item.billingStoppedAt || isoNow(),
    updatedAt: isoNow(),
  }));
}

function summarizeProtectionFreezes(items = []) {
  return {
    total: items.length,
    active: items.filter((item) => isActiveStatus(item.status)).length,
    frozenAmount: items.reduce((sum, item) => sum + Number(item.frozenAmount || 0), 0),
    consumedAmount: items.reduce((sum, item) => sum + Number(item.consumedAmount || 0), 0),
    remainingAmount: items.reduce((sum, item) => sum + Number(item.remainingAmount || 0), 0),
    releasedAmount: items.reduce((sum, item) => sum + Number(item.releasedAmount || 0), 0),
  };
}

function findExistingWeeklyProtectionFreeze(db = {}, owner = {}, normalized = {}) {
  return (db.weeklyProtectionFreezes || []).find((item) => {
    if (!assertOwned(item, owner)) return false;
    return text(item.resourceBindingId) === text(normalized.resourceBindingId)
      && text(item.windowStartAt) === text(normalized.windowStartAt)
      && text(item.windowEndAt) === text(normalized.windowEndAt);
  }) || null;
}

function consumedProtectionAmount(existing = {}, payload = {}) {
  if (Object.prototype.hasOwnProperty.call(payload, "consumedAmount")) {
    return Number(payload.consumedAmount || 0);
  }
  return Number(existing.consumedAmount || 0) + Number(payload.consumedDeltaAmount || 0);
}

function buildUpdatedWeeklyProtectionFreeze(existing = {}, normalized = {}, payload = {}) {
  const consumedAmount = consumedProtectionAmount(existing, payload);
  const currentRemaining = Math.max(0, Number(existing.frozenAmount || 0) - Math.max(0, consumedAmount));
  const deltaFrozenAmount = Math.max(0, Number(normalized.weeklyAmount || 0) - currentRemaining);
  const nextFrozenAmount = moneyDelta(Number(existing.frozenAmount || 0) + deltaFrozenAmount);
  return {
    deltaFrozenAmount,
    freeze: {
      ...existing,
      usageMode: normalized.usageMode,
      weeklyAmount: normalized.weeklyAmount,
      frozenAmount: nextFrozenAmount,
      consumedAmount: moneyDelta(consumedAmount),
      remainingAmount: moneyDelta(nextFrozenAmount - consumedAmount),
      reconcile120MinStatus: text(payload.reconcile120MinStatus || payload.reconcile_120_min_status || existing.reconcile120MinStatus || "pending"),
      tPlus1AuditStatus: text(payload.tPlus1AuditStatus || payload.t_plus_1_audit_status || existing.tPlus1AuditStatus || "pending"),
      updatedAt: isoNow(),
      status: "active",
    },
  };
}

function replaceOwnedProtectionFreeze(db = {}, owner = {}, freeze = {}) {
  db.weeklyProtectionFreezes = (db.weeklyProtectionFreezes || []).map((item) => {
    if (!assertOwned(item, owner)) return item;
    if (text(item.id) !== text(freeze.id)) return item;
    return freeze;
  });
}

function listOwnerScopedResources(db = {}, user = {}) {
  ensureCollections(db);
  const owner = ownerScopeFromUser(user);
  const maps = buildOwnedResourceMaps(db, owner);
  const bindings = db.workspaceResourceBindings
    .filter((item) => assertOwned(item, owner))
    .sort(byRecent)
    .map((item) => enrichBinding(item, maps));
  const activeBindingItems = activeBindings(bindings);
  const inactiveBindingItems = bindings.filter((item) => !isActiveStatus(item.status));
  const protectionSummary = summarizeProtectionFreezes(maps.protectionFreezes);
  return {
    ok: true,
    source: "portal_platform_provisioned_resources",
    computeInstances: maps.computeInstances,
    storageBuckets: maps.storageBuckets,
    protectionFreezes: maps.protectionFreezes,
    bindings,
    accessPolicy: buildOwnerAccessPolicy({ activeBindingCount: activeBindingItems.length }),
    summary: {
      computeInstances: maps.computeInstances.length,
      storageBuckets: maps.storageBuckets.length,
      activeBindings: activeBindingItems.length,
      inactiveBindings: inactiveBindingItems.length,
      activeProtectionFreezes: protectionSummary.active,
      frozenAmount: moneyDelta(protectionSummary.frozenAmount),
      consumedAmount: moneyDelta(protectionSummary.consumedAmount),
      remainingAmount: moneyDelta(protectionSummary.remainingAmount),
      releasedProtectionAmount: moneyDelta(protectionSummary.releasedAmount),
      computeInstanceCount: maps.computeInstances.length,
      storageBucketCount: maps.storageBuckets.length,
      bindingCount: bindings.length,
      protectionFreezeCount: maps.protectionFreezes.length,
    },
  };
}

function cloudComputePayload(payload = {}, provisioned = {}) {
  return {
    ...payload,
    ...provisioned,
    provisioningMode: "platform_provisioned",
    cvmInstanceId: text(provisioned.cvmInstanceId || provisioned.cvm_instance_id || provisioned.instanceId || provisioned.instance_id || provisioned.cloudResourceId || provisioned.cloud_resource_id || payload.cvmInstanceId || payload.instanceId),
    instanceId: text(provisioned.instanceId || provisioned.instance_id || provisioned.cvmInstanceId || provisioned.cvm_instance_id || provisioned.cloudResourceId || provisioned.cloud_resource_id || payload.instanceId || payload.cvmInstanceId),
    cloudResourceId: text(provisioned.cloudResourceId || provisioned.cloud_resource_id || provisioned.cvmInstanceId || provisioned.cvm_instance_id || provisioned.instanceId || provisioned.instance_id),
    billingStartedAt: text(provisioned.billingStartedAt || provisioned.billing_started_at || payload.billingStartedAt) || isoNow(),
    healthStatus: text(provisioned.healthStatus || provisioned.health_status || payload.healthStatus || "unknown").toLowerCase(),
  };
}

function cloudStoragePayload(payload = {}, provisioned = {}) {
  return {
    ...payload,
    ...provisioned,
    provisioningMode: "platform_provisioned",
    bucketName: text(provisioned.bucketName || provisioned.bucket_name || payload.bucketName),
    bucketId: text(provisioned.bucketId || provisioned.bucket_id || provisioned.bucketName || provisioned.bucket_name || payload.bucketId || payload.bucketName),
    cloudResourceId: text(provisioned.cloudResourceId || provisioned.cloud_resource_id || provisioned.bucketId || provisioned.bucket_id || provisioned.bucketName || provisioned.bucket_name),
    billingStartedAt: text(provisioned.billingStartedAt || provisioned.billing_started_at || payload.billingStartedAt) || isoNow(),
  };
}

function releasePatch(result = {}) {
  return {
    releaseEvidenceId: text(result.releaseEvidenceId || result.release_evidence_id),
    releaseEvidence: result.releaseEvidence || result.release_evidence || null,
    billingStoppedAt: text(result.billingStoppedAt || result.billing_stopped_at) || isoNow(),
  };
}

export function createPortalPlatformProvisionedResourceStore({ writeDb, cloudProvisioner = null } = {}) {
  async function createComputeInstance(db = {}, user = {}, payload = {}) {
    ensureCollections(db);
    const owner = ownerScopeFromUser(user);
    const mode = resourceLifecycleMode(payload);
    const source = { ...payload, provisioningMode: mode };
    if (isPlatformProvisionedMode(mode)) {
      if (typeof cloudProvisioner?.provisionCompute !== "function") cloudProvisionerRequired();
      const provisioned = await cloudProvisioner.provisionCompute({ db, user, owner, payload: source });
      Object.assign(source, cloudComputePayload(source, provisioned));
    }
    const item = normalizeCustomerComputeResource(source, owner);
    db.userComputeInstances.push(item);
    await writeDb(db);
    return item;
  }

  async function createStorageBucket(db = {}, user = {}, payload = {}) {
    ensureCollections(db);
    const owner = ownerScopeFromUser(user);
    const mode = resourceLifecycleMode(payload);
    const source = { ...payload, provisioningMode: mode };
    if (isPlatformProvisionedMode(mode)) {
      if (typeof cloudProvisioner?.provisionStorage !== "function") cloudProvisionerRequired();
      const provisioned = await cloudProvisioner.provisionStorage({ db, user, owner, payload: source });
      Object.assign(source, cloudStoragePayload(source, provisioned));
    }
    const item = normalizeCustomerStorageResource(source, owner);
    db.userStorageBuckets.push(item);
    await writeDb(db);
    return item;
  }

  async function bindWorkspaceResource(db = {}, user = {}, payload = {}) {
    ensureCollections(db);
    const owner = ownerScopeFromUser(user);
    const binding = normalizeWorkspaceResourceBinding(payload, owner);
    const compute = findOwnedComputeInstance(db, owner, text(binding.computeInstanceId));
    const bucket = findOwnedStorageBucket(db, owner, text(binding.storageBucketId));
    if (!compute) {
      const error = new Error("compute_instance_not_found_in_owner_scope");
      error.code = "compute_instance_not_found_in_owner_scope";
      throw error;
    }
    if (!bucket) {
      const error = new Error("storage_bucket_not_found_in_owner_scope");
      error.code = "storage_bucket_not_found_in_owner_scope";
      throw error;
    }
    const updatedAt = isoNow();
    const replacedBindings = [];
    db.workspaceResourceBindings = db.workspaceResourceBindings
      .filter((item) => !(text(item.id) === text(binding.id) && assertOwned(item, owner)))
      .map((item) => {
        if (text(item.workspaceId) !== text(binding.workspaceId) || !assertOwned(item, owner) || !isActiveStatus(item.status)) return item;
        const next = { ...item, status: "inactive", updatedAt };
        replacedBindings.push(next);
        return next;
      });
    db.workspaceResourceBindings.push(binding);
    releaseBindingProtection(db, owner, replacedBindings.map((item) => item.id));
    for (const item of replacedBindings) {
      stopComputeBillingWhenUnused(db, owner, text(item.computeInstanceId));
    }
    updateOwnedComputeInstance(db, owner, compute.id, (item) => ({
      ...item,
      status: "active",
      billingStartedAt: item.billingStartedAt || updatedAt,
      billingStoppedAt: "",
      updatedAt,
    }));
    updateOwnedStorageBucket(db, owner, bucket.id, (item) => ({
      ...item,
      status: "active",
      updatedAt,
    }));
    await writeDb(db);
    return buildBindingView(db, owner, findOwnedBinding(db, owner, binding.id));
  }

  async function unbindWorkspaceResource(db = {}, user = {}, payload = {}) {
    ensureCollections(db);
    const owner = ownerScopeFromUser(user);
    const bindingId = text(payload.bindingId);
    const existing = findOwnedBinding(db, owner, bindingId);
    if (!existing) {
      const error = new Error("binding_not_found_in_owner_scope");
      error.code = "binding_not_found_in_owner_scope";
      throw error;
    }
    deactivateBindings(db, owner, (item) => text(item.id) === text(existing.id));
    const releasedProtection = releaseBindingProtection(db, owner, [existing.id]);
    stopComputeBillingWhenUnused(db, owner, text(existing.computeInstanceId));
    await writeDb(db);
    return {
      ok: true,
      binding: buildBindingView(db, owner, findOwnedBinding(db, owner, existing.id)),
      releasedProtection,
    };
  }

  async function deleteComputeInstance(db = {}, user = {}, payload = {}) {
    ensureCollections(db);
    const owner = ownerScopeFromUser(user);
    const computeInstanceId = text(payload.computeInstanceId || payload.id || payload.instanceId || payload.cvmInstanceId);
    const existing = findOwnedComputeInstance(db, owner, computeInstanceId);
    if (!existing) {
      const error = new Error("compute_instance_not_found_in_owner_scope");
      error.code = "compute_instance_not_found_in_owner_scope";
      throw error;
    }
    const affectedBindings = deactivateBindings(db, owner, (item) => text(item.computeInstanceId) === text(existing.id));
    const releasedProtection = releaseBindingProtection(db, owner, affectedBindings.map((item) => item.id));
    const updatedAt = isoNow();
    let release = {};
    if (isPlatformProvisionedMode(existing.provisioningMode)) {
      if (typeof cloudProvisioner?.releaseCompute !== "function") cloudProvisionerRequired();
      release = releasePatch(await cloudProvisioner.releaseCompute({ db, user, owner, computeInstance: existing, affectedBindings }));
    }
    const item = updateOwnedComputeInstance(db, owner, existing.id, (current) => ({
      ...current,
      ...release,
      status: "deleted",
      billingStoppedAt: release.billingStoppedAt || current.billingStoppedAt || updatedAt,
      updatedAt,
    }));
    await writeDb(db);
    return {
      ok: true,
      item,
      affectedBindings: affectedBindings.map((binding) => buildBindingView(db, owner, findOwnedBinding(db, owner, binding.id))),
      releasedProtection,
    };
  }

  async function deleteStorageBucket(db = {}, user = {}, payload = {}) {
    ensureCollections(db);
    const owner = ownerScopeFromUser(user);
    const storageBucketId = text(payload.storageBucketId || payload.id || payload.bucketId || payload.bucketName);
    const existing = findOwnedStorageBucket(db, owner, storageBucketId);
    if (!existing) {
      const error = new Error("storage_bucket_not_found_in_owner_scope");
      error.code = "storage_bucket_not_found_in_owner_scope";
      throw error;
    }
    const affectedBindings = deactivateBindings(db, owner, (item) => text(item.storageBucketId) === text(existing.id));
    const releasedProtection = releaseBindingProtection(db, owner, affectedBindings.map((item) => item.id));
    const updatedAt = isoNow();
    let release = {};
    if (isPlatformProvisionedMode(existing.provisioningMode)) {
      if (typeof cloudProvisioner?.releaseStorage !== "function") cloudProvisionerRequired();
      release = releasePatch(await cloudProvisioner.releaseStorage({ db, user, owner, storageBucket: existing, affectedBindings }));
    }
    const item = updateOwnedStorageBucket(db, owner, existing.id, (current) => ({
      ...current,
      ...release,
      status: "deleted",
      billingStoppedAt: release.billingStoppedAt || current.billingStoppedAt || updatedAt,
      updatedAt,
    }));
    for (const binding of affectedBindings) {
      stopComputeBillingWhenUnused(db, owner, text(binding.computeInstanceId));
    }
    await writeDb(db);
    return {
      ok: true,
      item,
      affectedBindings: affectedBindings.map((binding) => buildBindingView(db, owner, findOwnedBinding(db, owner, binding.id))),
      releasedProtection,
    };
  }

  function listOwnerScopedProtectionFreezes(db = {}, user = {}, filters = {}) {
    ensureCollections(db);
    const owner = ownerScopeFromUser(user);
    const bindingId = text(filters.bindingId || filters.resourceBindingId);
    const workspaceId = text(filters.workspaceId);
    const windowStartAt = text(filters.windowStartAt);
    const windowEndAt = text(filters.windowEndAt);
    const status = text(filters.status).toLowerCase();
    const items = collectOwnedProtectionFreezes(db, owner)
      .filter((item) => (!bindingId || text(item.resourceBindingId) === bindingId))
      .filter((item) => (!workspaceId || text(item.workspaceId) === workspaceId))
      .filter((item) => (!windowStartAt || text(item.windowStartAt) === windowStartAt))
      .filter((item) => (!windowEndAt || text(item.windowEndAt) === windowEndAt))
      .filter((item) => (!status || text(item.status).toLowerCase() === status));
    return {
      ok: true,
      source: "portal_weekly_protection_freezes",
      items,
      summary: summarizeProtectionFreezes(items),
    };
  }

  async function ensureWeeklyProtectionFreeze(db = {}, user = {}, payload = {}) {
    ensureCollections(db);
    const owner = ownerScopeFromUser(user);
    const bindingId = text(payload.bindingId || payload.resourceBindingId);
    const usageMode = text(payload.usageMode || "full_runtime");
    if (!usageModeNeedsFreeze(usageMode)) {
      const binding = bindingId ? findOwnedBinding(db, owner, bindingId) : null;
      return {
        ok: true,
        created: false,
        skipped: true,
        reason: "api_only_no_freeze",
        deltaFrozenAmount: 0,
        freeze: null,
        binding: binding ? buildBindingView(db, owner, binding) : null,
      };
    }
    const binding = findActiveOwnedBinding(db, owner, bindingId);
    const normalized = normalizeWeeklyProtectionFreeze({
      ...payload,
      resourceBindingId: binding.id,
      workspaceId: binding.workspaceId,
      computeInstanceId: binding.computeInstanceId,
      storageBucketId: binding.storageBucketId,
      protectionPolicyId: binding.protectionPolicyId,
    }, owner, binding);
    const existing = findExistingWeeklyProtectionFreeze(db, owner, normalized);
    if (!existing) {
      db.weeklyProtectionFreezes.push(normalized);
      await writeDb(db);
      return {
        ok: true,
        created: true,
        skipped: false,
        deltaFrozenAmount: Number(normalized.frozenAmount || 0),
        freeze: withFreezeView(normalized),
        binding: buildBindingView(db, owner, binding),
      };
    }
    const updated = buildUpdatedWeeklyProtectionFreeze(existing, normalized, payload);
    replaceOwnedProtectionFreeze(db, owner, updated.freeze);
    await writeDb(db);
    return {
      ok: true,
      created: false,
      skipped: false,
      deltaFrozenAmount: moneyDelta(updated.deltaFrozenAmount),
      freeze: withFreezeView(updated.freeze),
      binding: buildBindingView(db, owner, binding),
    };
  }

  return {
    listOwnerScopedResources,
    listOwnerScopedProtectionFreezes,
    createComputeInstance,
    createStorageBucket,
    bindWorkspaceResource,
    unbindWorkspaceResource,
    deleteComputeInstance,
    deleteStorageBucket,
    ensureWeeklyProtectionFreeze,
  };
}
