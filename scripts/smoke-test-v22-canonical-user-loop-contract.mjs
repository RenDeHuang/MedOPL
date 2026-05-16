import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const DAY_MS = 24 * 60 * 60 * 1000;
const STARTED_AT = "2026-05-07T00:00:00.000Z";

const PACKAGE_CATALOG = Object.freeze({
  "default-2c4gb-10gb": Object.freeze({
    id: "default-2c4gb-10gb",
    title: "Default 2c4gb + 10GB",
    kind: "default",
    compute: Object.freeze({ cpuCores: 2, memoryGb: 4 }),
    storage: Object.freeze({ capacityGb: 10 }),
    weeklyPreauthCents: 3000,
  }),
  "default-8c16gb-100gb": Object.freeze({
    id: "default-8c16gb-100gb",
    title: "Default 8c16gb + 100GB",
    kind: "default",
    compute: Object.freeze({ cpuCores: 8, memoryGb: 16 }),
    storage: Object.freeze({ capacityGb: 100 }),
    weeklyPreauthCents: 12000,
  }),
});

function createContractState() {
  return {
    tenants: [],
    users: [],
    workspaces: [],
    billingAccounts: [],
    providerKeyBindings: [],
    providerSecretVault: new Map(),
    resourceBindings: [],
    ledger: [],
    auditEvents: [],
    workspaceFiles: [],
    sessionTraces: [],
    runs: [],
  };
}

function publicClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertSurfaceIsRedacted(surface, rawProviderKey, message) {
  const payload = JSON.stringify(surface);
  assert.equal(payload.includes(rawProviderKey), false, `${message}:raw_provider_key_must_not_leak`);
  for (const forbiddenField of [
    "rawKey",
    "rawProviderKey",
    "providerApiKey",
    "providerSecret",
    "bearerToken",
    "launchToken",
    "runtimeToken",
  ]) {
    assert.equal(payload.includes(`"${forbiddenField}"`), false, `${message}:forbidden_field_${forbiddenField}`);
  }
}

function appendAudit(state, input) {
  const event = {
    id: `audit-${state.auditEvents.length + 1}`,
    tenantId: input.tenantId,
    userId: input.userId,
    workspaceId: input.workspaceId || "",
    resourceBindingId: input.resourceBindingId || "",
    billingAccountId: input.billingAccountId || "",
    auditTag: input.auditTag || "",
    action: input.action,
    boundary: input.boundary || "portal",
    createdAt: input.createdAt || STARTED_AT,
  };
  state.auditEvents.push(event);
  return event;
}

function createTenantUser(state, input) {
  const tenant = {
    id: input.tenantId,
    slug: input.slug,
    runtimeOwnership: "platform_provisioned",
    isolationMode: "customer_dedicated",
    status: "active",
    createdAt: STARTED_AT,
  };
  const user = {
    id: input.userId,
    tenantId: tenant.id,
    email: input.email,
    role: "owner",
    status: "active",
    createdAt: STARTED_AT,
  };
  const billingAccount = {
    id: `bill-${tenant.id}`,
    tenantId: tenant.id,
    userId: user.id,
    balanceCents: 0,
    frozenCents: 0,
    consumedFrozenCents: 0,
    status: "active",
    currency: "CNY",
    createdAt: STARTED_AT,
  };
  const workspace = {
    id: input.workspaceId,
    tenantId: tenant.id,
    userId: user.id,
    slug: input.workspaceSlug,
    status: "active",
    createdAt: STARTED_AT,
  };
  state.tenants.push(tenant);
  state.users.push(user);
  state.billingAccounts.push(billingAccount);
  state.workspaces.push(workspace);
  appendAudit(state, {
    tenantId: tenant.id,
    userId: user.id,
    workspaceId: workspace.id,
    billingAccountId: billingAccount.id,
    auditTag: `tenant:${tenant.id}/user:${user.id}/workspace:${workspace.id}`,
    action: "tenant_user_created",
  });
  return { tenant, user, billingAccount, workspace };
}

function topUpBalance(state, billingAccount, input) {
  assert.equal(input.amountCents > 0, true, "topup_amount_must_be_positive");
  billingAccount.balanceCents += input.amountCents;
  const ledgerEntry = {
    id: `ledger-${state.ledger.length + 1}`,
    tenantId: billingAccount.tenantId,
    userId: billingAccount.userId,
    billingAccountId: billingAccount.id,
    type: "wallet_topup",
    amountCents: input.amountCents,
    currency: billingAccount.currency,
    balanceAfterCents: billingAccount.balanceCents,
    createdAt: input.createdAt || STARTED_AT,
  };
  state.ledger.push(ledgerEntry);
  appendAudit(state, {
    tenantId: billingAccount.tenantId,
    userId: billingAccount.userId,
    billingAccountId: billingAccount.id,
    auditTag: `billing:${billingAccount.id}`,
    action: "billing_account_topped_up",
  });
  return ledgerEntry;
}

function bindProviderKey(state, input) {
  assert.equal(input.provider, "gflabtoken", "provider_must_be_gflabtoken");
  assert.equal(typeof input.rawProviderKey, "string", "raw_provider_key_must_be_string");
  assert.equal(input.rawProviderKey.length > 20, true, "raw_provider_key_must_be_runtime_secret_material");

  const providerKeyRef = `provider-key-ref:${input.tenantId}:${input.userId}:gflabtoken`;
  const binding = {
    id: `pkb-${state.providerKeyBindings.length + 1}`,
    tenantId: input.tenantId,
    userId: input.userId,
    provider: "gflabtoken",
    providerKeyRef,
    boundStatus: "bound",
    backendSecretBoundary: "portal_server_secret_vault",
    createdAt: STARTED_AT,
  };
  state.providerSecretVault.set(providerKeyRef, {
    provider: "gflabtoken",
    rawProviderKey: input.rawProviderKey,
    tenantId: input.tenantId,
    userId: input.userId,
  });
  state.providerKeyBindings.push(binding);
  appendAudit(state, {
    tenantId: input.tenantId,
    userId: input.userId,
    auditTag: `provider:${providerKeyRef}`,
    action: "provider_key_bound",
    boundary: "portal_server_secret_boundary",
  });
  return {
    provider: binding.provider,
    providerKeyRef: binding.providerKeyRef,
    boundStatus: binding.boundStatus,
  };
}

function packageSelection(input) {
  const basePackage = PACKAGE_CATALOG[input.packageId];
  assert.ok(basePackage, `package_not_found:${input.packageId}`);
  const computeAddons = input.computeAddons || [];
  const storageAddons = input.storageAddons || [];
  const custom = input.custom || null;

  assert.equal(Array.isArray(computeAddons), true, "compute_addons_must_be_array");
  assert.equal(Array.isArray(storageAddons), true, "storage_addons_must_be_array");
  if (custom) {
    assert.equal(custom.kind, "custom_package_boundary", "custom_plan_must_be_explicit_boundary");
    assert.equal(Number.isInteger(custom.compute.cpuCores), true, "custom_cpu_must_be_integer");
    assert.equal(Number.isInteger(custom.compute.memoryGb), true, "custom_memory_must_be_integer");
    assert.equal(Number.isInteger(custom.storage.capacityGb), true, "custom_storage_must_be_integer");
  }

  const addonCpu = computeAddons.reduce((sum, item) => sum + item.cpuCores, 0);
  const addonMemory = computeAddons.reduce((sum, item) => sum + item.memoryGb, 0);
  const addonStorage = storageAddons.reduce((sum, item) => sum + item.capacityGb, 0);
  const selectedCompute = custom?.compute || {
    cpuCores: basePackage.compute.cpuCores + addonCpu,
    memoryGb: basePackage.compute.memoryGb + addonMemory,
  };
  const selectedStorage = custom?.storage || {
    capacityGb: basePackage.storage.capacityGb + addonStorage,
  };

  return {
    packageId: basePackage.id,
    packageKind: basePackage.kind,
    base: {
      compute: publicClone(basePackage.compute),
      storage: publicClone(basePackage.storage),
    },
    addons: {
      compute: computeAddons.map(publicClone),
      storage: storageAddons.map(publicClone),
    },
    custom,
    selected: {
      compute: selectedCompute,
      storage: selectedStorage,
    },
    weeklyPreauthCents: custom?.weeklyPreauthCents || basePackage.weeklyPreauthCents,
  };
}

function hostedRunBeforeRuntime(state, input) {
  const activeBinding = state.resourceBindings.find((binding) =>
    binding.tenantId === input.tenantId &&
    binding.userId === input.userId &&
    binding.workspaceId === input.workspaceId &&
    binding.status === "active"
  );
  if (!activeBinding) {
    return {
      ok: false,
      status: 409,
      error: "runtime_resource_binding_required",
      runMode: "hosted_full_runtime",
      requiredBoundary: "platform_provisioned_resource_binding",
    };
  }
  return { ok: true };
}

function provisionRuntimeBinding(state, input) {
  assert.equal(input.lifecycleMode, "platform_provisioned", "runtime_lifecycle_must_be_platform_provisioned");
  assert.equal(input.cloudMutation, false, "contract_smoke_must_not_mutate_real_cloud");
  const selection = packageSelection(input.packageSelection);
  const billingAccount = state.billingAccounts.find((item) => item.id === input.billingAccountId);
  assert.ok(billingAccount, "billing_account_required");
  assert.equal(billingAccount.balanceCents - billingAccount.frozenCents >= selection.weeklyPreauthCents, true, "balance_must_cover_preauth");

  const resourceBinding = {
    id: `rb-${state.resourceBindings.length + 1}`,
    tenantId: input.tenantId,
    userId: input.userId,
    workspaceId: input.workspaceId,
    billingAccountId: billingAccount.id,
    auditTag: `tenant:${input.tenantId}/user:${input.userId}/workspace:${input.workspaceId}/binding:rb-${state.resourceBindings.length + 1}`,
    status: "active",
    lifecycleMode: "platform_provisioned",
    isolationMode: "customer_dedicated",
    packageSelection: selection,
    compute: {
      id: `compute-${state.resourceBindings.length + 1}`,
      cpuCores: selection.selected.compute.cpuCores,
      memoryGb: selection.selected.compute.memoryGb,
      runtimeAgentId: `runtime-agent-${state.resourceBindings.length + 1}`,
      runtimeAgentEndpointRef: `runtime-agent-endpoint-ref-${state.resourceBindings.length + 1}`,
      billingStartedAt: input.createdAt || STARTED_AT,
      billingStoppedAt: "",
    },
    storage: {
      id: `storage-${state.resourceBindings.length + 1}`,
      capacityGb: selection.selected.storage.capacityGb,
      rootPrefix: `tenants/${input.tenantId}/users/${input.userId}/workspaces/${input.workspaceId}/`,
      billingStartedAt: input.createdAt || STARTED_AT,
      billingStoppedAt: "",
    },
    protection: {
      status: "active",
      frozenCents: selection.weeklyPreauthCents,
      consumedCents: 0,
      remainingCents: selection.weeklyPreauthCents,
      windowStartAt: input.createdAt || STARTED_AT,
      windowEndAt: new Date(Date.parse(input.createdAt || STARTED_AT) + 7 * DAY_MS).toISOString(),
      cleanupState: "protected",
      cleanupEligibleAt: "",
    },
    createdAt: input.createdAt || STARTED_AT,
    releasedAt: "",
  };

  billingAccount.frozenCents += selection.weeklyPreauthCents;
  state.resourceBindings.push(resourceBinding);
  state.ledger.push({
    id: `ledger-${state.ledger.length + 1}`,
    tenantId: input.tenantId,
    userId: input.userId,
    workspaceId: input.workspaceId,
    resourceBindingId: resourceBinding.id,
    billingAccountId: billingAccount.id,
    type: "resource_preauth_freeze",
    amountCents: selection.weeklyPreauthCents,
    frozenAfterCents: billingAccount.frozenCents,
    createdAt: input.createdAt || STARTED_AT,
  });
  appendAudit(state, {
    tenantId: input.tenantId,
    userId: input.userId,
    workspaceId: input.workspaceId,
    resourceBindingId: resourceBinding.id,
    billingAccountId: billingAccount.id,
    auditTag: resourceBinding.auditTag,
    action: "platform_runtime_resource_binding_provisioned",
    boundary: "portal_resource_control_plane",
  });
  return resourceBinding;
}

function launchOplWorkspace(state, input) {
  const binding = state.resourceBindings.find((item) => item.id === input.resourceBindingId && item.status === "active");
  assert.ok(binding, "active_resource_binding_required");
  const providerBinding = state.providerKeyBindings.find((item) =>
    item.tenantId === binding.tenantId &&
    item.userId === binding.userId &&
    item.providerKeyRef === input.providerKeyRef &&
    item.boundStatus === "bound"
  );
  assert.ok(providerBinding, "bound_provider_key_ref_required");

  const trace = {
    id: `trace-${state.sessionTraces.length + 1}`,
    tenantId: binding.tenantId,
    userId: binding.userId,
    workspaceId: binding.workspaceId,
    resourceBindingId: binding.id,
    providerKeyRef: providerBinding.providerKeyRef,
    sessionRef: `opl-session-ref-${state.sessionTraces.length + 1}`,
    boundaryHops: [
      "portal",
      "opl_web_gateway",
      "runtime_bridge",
      "runtime_agent",
    ],
    upstreamBoundary: {
      project: "one-person-lab",
      access: "public_gateway_runtime_bridge_contract",
      sourceModified: false,
      importsInternalModules: false,
    },
    metadata: {
      runMode: "full_runtime",
      runtimeAgentId: binding.compute.runtimeAgentId,
      runtimeAgentEndpointRef: binding.compute.runtimeAgentEndpointRef,
      providerBoundStatus: providerBinding.boundStatus,
    },
    createdAt: input.createdAt || STARTED_AT,
  };
  state.sessionTraces.push(trace);
  appendAudit(state, {
    tenantId: binding.tenantId,
    userId: binding.userId,
    workspaceId: binding.workspaceId,
    resourceBindingId: binding.id,
    billingAccountId: binding.billingAccountId,
    auditTag: binding.auditTag,
    action: "opl_launch_prepared_through_gateway_runtime_bridge_runtime_agent",
    boundary: "gateway_runtime_bridge_runtime_agent",
  });
  return publicClone(trace);
}

function submitWorkspaceRun(state, input) {
  const binding = state.resourceBindings.find((item) => item.id === input.resourceBindingId && item.status === "active");
  assert.ok(binding, "active_binding_required_for_workspace_run");
  const trace = state.sessionTraces.find((item) => item.id === input.traceId && item.resourceBindingId === binding.id);
  assert.ok(trace, "session_trace_required_for_run");

  const run = {
    id: `run-${state.runs.length + 1}`,
    tenantId: binding.tenantId,
    userId: binding.userId,
    workspaceId: binding.workspaceId,
    resourceBindingId: binding.id,
    traceId: trace.id,
    status: "completed",
    boundary: "runtime_agent",
    createdAt: input.createdAt || STARTED_AT,
  };
  const artifact = {
    id: `artifact-${state.workspaceFiles.length + 1}`,
    runId: run.id,
    tenantId: binding.tenantId,
    userId: binding.userId,
    workspaceId: binding.workspaceId,
    resourceBindingId: binding.id,
    traceId: trace.id,
    kind: "outputs",
    name: "result.json",
    relativePath: "outputs/result.json",
    storageKey: `${binding.storage.rootPrefix}sessions/${trace.sessionRef}/outputs/result.json`,
    source: "runtime_agent_output",
    status: "active",
    createdAt: input.createdAt || STARTED_AT,
  };
  run.artifacts = [publicClone(artifact)];
  state.runs.push(run);
  state.workspaceFiles.push(artifact);
  appendAudit(state, {
    tenantId: binding.tenantId,
    userId: binding.userId,
    workspaceId: binding.workspaceId,
    resourceBindingId: binding.id,
    billingAccountId: binding.billingAccountId,
    auditTag: binding.auditTag,
    action: "workspace_run_completed_with_artifact",
    boundary: "runtime_agent_to_portal_file_index",
  });
  return publicClone(run);
}

function readPortalSurface(state, input) {
  const billingAccount = state.billingAccounts.find((item) => item.id === input.billingAccountId);
  assert.ok(billingAccount, "portal_billing_account_required");
  return {
    workspaceFiles: state.workspaceFiles
      .filter((item) => item.tenantId === input.tenantId && item.userId === input.userId && item.workspaceId === input.workspaceId)
      .map((item) => ({
        id: item.id,
        runId: item.runId,
        resourceBindingId: item.resourceBindingId,
        kind: item.kind,
        name: item.name,
        relativePath: item.relativePath,
        status: item.status,
        source: item.source,
      })),
    billingSummary: {
      billingAccountId: billingAccount.id,
      balanceCents: billingAccount.balanceCents,
      frozenCents: billingAccount.frozenCents,
      consumedFrozenCents: billingAccount.consumedFrozenCents,
      availableCents: billingAccount.balanceCents - billingAccount.frozenCents,
      activeResourceBindings: state.resourceBindings.filter((item) => item.billingAccountId === billingAccount.id && item.status === "active").length,
    },
    sessionTraceMetadata: state.sessionTraces
      .filter((item) => item.tenantId === input.tenantId && item.userId === input.userId && item.workspaceId === input.workspaceId)
      .map((item) => ({
        id: item.id,
        resourceBindingId: item.resourceBindingId,
        providerKeyRef: item.providerKeyRef,
        boundaryHops: item.boundaryHops,
        upstreamBoundary: item.upstreamBoundary,
        metadata: item.metadata,
      })),
  };
}

function previewPaidActionRisk(billingAccount, input) {
  const availableCents = billingAccount.balanceCents - billingAccount.frozenCents;
  const wouldConsumeFrozenCents = Math.max(0, input.nextActionCostCents - availableCents);
  if (wouldConsumeFrozenCents > 0) {
    return {
      status: "insufficient_available_balance_would_consume_frozen_amount",
      severity: "warning",
      canStartPaidAction: false,
      availableCents,
      frozenCents: billingAccount.frozenCents,
      nextActionCostCents: input.nextActionCostCents,
      wouldConsumeFrozenCents,
      copy: "余额不足以发起新的托管运行；继续会消耗已冻结金额，请先充值。",
    };
  }
  return {
    status: "healthy",
    severity: "none",
    canStartPaidAction: true,
    availableCents,
    frozenCents: billingAccount.frozenCents,
    nextActionCostCents: input.nextActionCostCents,
    wouldConsumeFrozenCents: 0,
    copy: "",
  };
}

function settleRunCost(state, input) {
  const binding = state.resourceBindings.find((item) => item.id === input.resourceBindingId);
  assert.ok(binding, "binding_required_for_settlement");
  if (binding.status !== "active") {
    return { ok: true, chargedCents: 0, skippedReason: "billing_stopped_after_release" };
  }
  const billingAccount = state.billingAccounts.find((item) => item.id === binding.billingAccountId);
  assert.ok(billingAccount, "billing_account_required_for_settlement");
  binding.protection.consumedCents += input.amountCents;
  binding.protection.remainingCents = Math.max(0, binding.protection.frozenCents - binding.protection.consumedCents);
  billingAccount.consumedFrozenCents += input.amountCents;
  state.ledger.push({
    id: `ledger-${state.ledger.length + 1}`,
    tenantId: binding.tenantId,
    userId: binding.userId,
    workspaceId: binding.workspaceId,
    resourceBindingId: binding.id,
    billingAccountId: binding.billingAccountId,
    runId: input.runId,
    type: "runtime_usage_charge",
    amountCents: input.amountCents,
    createdAt: input.createdAt || STARTED_AT,
  });
  return { ok: true, chargedCents: input.amountCents };
}

function releaseResourceBinding(state, input) {
  const binding = state.resourceBindings.find((item) => item.id === input.resourceBindingId);
  assert.ok(binding, "binding_required_for_release");
  assert.equal(binding.status, "active", "release_requires_active_binding");
  const billingAccount = state.billingAccounts.find((item) => item.id === binding.billingAccountId);
  assert.ok(billingAccount, "billing_account_required_for_release");
  const releasedAt = input.releasedAt;
  binding.status = "released";
  binding.releasedAt = releasedAt;
  binding.compute.billingStoppedAt = releasedAt;
  binding.storage.billingStoppedAt = releasedAt;
  binding.protection.status = "released";
  binding.protection.cleanupState = "retention_protected";
  binding.protection.cleanupEligibleAt = new Date(Date.parse(releasedAt) + 7 * DAY_MS).toISOString();
  billingAccount.frozenCents -= binding.protection.remainingCents;
  state.workspaceFiles
    .filter((item) => item.resourceBindingId === binding.id)
    .forEach((file) => {
      file.status = "retention_protected";
      file.deletedAt = releasedAt;
      file.cleanupEligibleAt = binding.protection.cleanupEligibleAt;
    });
  state.ledger.push({
    id: `ledger-${state.ledger.length + 1}`,
    tenantId: binding.tenantId,
    userId: binding.userId,
    workspaceId: binding.workspaceId,
    resourceBindingId: binding.id,
    billingAccountId: binding.billingAccountId,
    type: "resource_billing_stopped",
    releasedProtectionCents: binding.protection.remainingCents,
    createdAt: releasedAt,
  });
  appendAudit(state, {
    tenantId: binding.tenantId,
    userId: binding.userId,
    workspaceId: binding.workspaceId,
    resourceBindingId: binding.id,
    billingAccountId: binding.billingAccountId,
    auditTag: binding.auditTag,
    action: "resource_binding_released_billing_stopped",
    boundary: "portal_resource_control_plane",
    createdAt: releasedAt,
  });
  return publicClone(binding);
}

function transitionCleanupAfterProtection(state, input) {
  const nowMs = Date.parse(input.now);
  const binding = state.resourceBindings.find((item) => item.id === input.resourceBindingId);
  assert.ok(binding, "binding_required_for_cleanup_transition");
  assert.equal(binding.status, "released", "cleanup_transition_requires_released_binding");
  assert.equal(nowMs >= Date.parse(binding.protection.cleanupEligibleAt), true, "cleanup_transition_requires_7_day_protection_elapsed");
  binding.protection.cleanupState = "cleanup_ready";
  state.workspaceFiles
    .filter((item) => item.resourceBindingId === binding.id)
    .forEach((file) => {
      file.status = "cleanup_ready";
      file.cleanupState = "cleanup_ready";
    });
  appendAudit(state, {
    tenantId: binding.tenantId,
    userId: binding.userId,
    workspaceId: binding.workspaceId,
    resourceBindingId: binding.id,
    billingAccountId: binding.billingAccountId,
    auditTag: binding.auditTag,
    action: "resource_binding_entered_cleanup_ready_after_7_day_protection",
    boundary: "retention_cleanup_controller",
    createdAt: input.now,
  });
  return publicClone(binding);
}

const state = createContractState();
const { tenant, user, billingAccount, workspace } = createTenantUser(state, {
  tenantId: "tenant-v22-canonical",
  userId: "user-v22-canonical",
  email: "canonical@example.test",
  slug: "canonical-lab",
  workspaceId: "workspace-v22-canonical",
  workspaceSlug: "canonical-workspace",
});

assert.equal(tenant.runtimeOwnership, "platform_provisioned", "tenant_must_be_platform_provisioned");
assert.equal(tenant.isolationMode, "customer_dedicated", "tenant_must_be_customer_dedicated");
topUpBalance(state, billingAccount, { amountCents: 20000 });
assert.equal(billingAccount.balanceCents, 20000, "billing_account_topup_must_apply_to_user_tenant");

const rawProviderKey = `runtime-only-gflabtoken-${randomUUID()}-${randomUUID()}`;
const providerSurface = bindProviderKey(state, {
  tenantId: tenant.id,
  userId: user.id,
  provider: "gflabtoken",
  rawProviderKey,
});
assert.deepEqual(Object.keys(providerSurface).sort(), ["boundStatus", "provider", "providerKeyRef"], "provider_surface_must_only_expose_ref_and_status");
assert.equal(providerSurface.boundStatus, "bound", "provider_key_must_be_bound");
assert.equal(state.providerSecretVault.get(providerSurface.providerKeyRef).rawProviderKey, rawProviderKey, "backend_secret_boundary_must_store_raw_key");
assertSurfaceIsRedacted(providerSurface, rawProviderKey, "provider_surface");

const rejectedRun = hostedRunBeforeRuntime(state, {
  tenantId: tenant.id,
  userId: user.id,
  workspaceId: workspace.id,
});
assert.equal(rejectedRun.ok, false, "hosted_run_before_runtime_must_be_rejected");
assert.equal(rejectedRun.error, "runtime_resource_binding_required", "hosted_run_rejection_error_mismatch");

const starterSelection = packageSelection({
  packageId: "default-2c4gb-10gb",
  computeAddons: [{ kind: "additional_compute", cpuCores: 2, memoryGb: 4 }],
  storageAddons: [{ kind: "additional_storage", capacityGb: 20 }],
});
assert.equal(starterSelection.base.compute.cpuCores, 2, "starter_package_must_define_2_cores");
assert.equal(starterSelection.base.compute.memoryGb, 4, "starter_package_must_define_4gb_memory");
assert.equal(starterSelection.base.storage.capacityGb, 10, "starter_package_must_define_10gb_storage");
assert.equal(starterSelection.selected.compute.cpuCores, 4, "compute_addon_must_extend_selected_compute");
assert.equal(starterSelection.selected.storage.capacityGb, 30, "storage_addon_must_extend_selected_storage");

const customSelection = packageSelection({
  packageId: "default-8c16gb-100gb",
  custom: {
    kind: "custom_package_boundary",
    compute: { cpuCores: 12, memoryGb: 24 },
    storage: { capacityGb: 250 },
    weeklyPreauthCents: 18000,
  },
});
assert.equal(customSelection.base.compute.cpuCores, 8, "pro_package_must_define_8_cores");
assert.equal(customSelection.base.compute.memoryGb, 16, "pro_package_must_define_16gb_memory");
assert.equal(customSelection.base.storage.capacityGb, 100, "pro_package_must_define_100gb_storage");
assert.equal(customSelection.selected.compute.cpuCores, 12, "custom_package_must_keep_explicit_compute_boundary");
assert.equal(customSelection.selected.storage.capacityGb, 250, "custom_package_must_keep_explicit_storage_boundary");

const starterBinding = provisionRuntimeBinding(state, {
  tenantId: tenant.id,
  userId: user.id,
  workspaceId: workspace.id,
  billingAccountId: billingAccount.id,
  lifecycleMode: "platform_provisioned",
  cloudMutation: false,
  packageSelection: {
    packageId: "default-2c4gb-10gb",
  },
});
assert.equal(starterBinding.compute.cpuCores, 2, "starter_binding_must_provision_2_cores");
assert.equal(starterBinding.compute.memoryGb, 4, "starter_binding_must_provision_4gb_memory");
assert.equal(starterBinding.storage.capacityGb, 10, "starter_binding_must_provision_10gb_storage");

const proWorkspace = {
  id: "workspace-v22-pro",
  tenantId: tenant.id,
  userId: user.id,
  slug: "canonical-pro-workspace",
  status: "active",
  createdAt: STARTED_AT,
};
state.workspaces.push(proWorkspace);
const proBinding = provisionRuntimeBinding(state, {
  tenantId: tenant.id,
  userId: user.id,
  workspaceId: proWorkspace.id,
  billingAccountId: billingAccount.id,
  lifecycleMode: "platform_provisioned",
  cloudMutation: false,
  packageSelection: {
    packageId: "default-8c16gb-100gb",
  },
});
assert.equal(proBinding.compute.cpuCores, 8, "pro_binding_must_provision_8_cores");
assert.equal(proBinding.compute.memoryGb, 16, "pro_binding_must_provision_16gb_memory");
assert.equal(proBinding.storage.capacityGb, 100, "pro_binding_must_provision_100gb_storage");
assert.equal(billingAccount.frozenCents, 15000, "resource_open_must_freeze_total_preauth");

for (const binding of [starterBinding, proBinding]) {
  assert.equal(binding.tenantId, tenant.id, "binding_tenant_relation_mismatch");
  assert.equal(binding.userId, user.id, "binding_user_relation_mismatch");
  assert.equal(Boolean(binding.workspaceId), true, "binding_workspace_relation_required");
  assert.equal(binding.billingAccountId, billingAccount.id, "binding_billing_account_relation_mismatch");
  assert.match(binding.auditTag, /tenant:tenant-v22-canonical\/user:user-v22-canonical\/workspace:/, "binding_audit_tag_must_include_core_relationships");
}

const trace = launchOplWorkspace(state, {
  resourceBindingId: starterBinding.id,
  providerKeyRef: providerSurface.providerKeyRef,
});
assert.deepEqual(trace.boundaryHops, ["portal", "opl_web_gateway", "runtime_bridge", "runtime_agent"], "opl_launch_must_cross_gateway_runtime_bridge_runtime_agent");
assert.equal(trace.upstreamBoundary.project, "one-person-lab", "launch_must_reference_upstream_boundary");
assert.equal(trace.upstreamBoundary.sourceModified, false, "upstream_source_must_remain_clean");
assert.equal(trace.upstreamBoundary.importsInternalModules, false, "adapter_must_not_import_upstream_internal_modules");
assertSurfaceIsRedacted(trace, rawProviderKey, "trace_surface");

const run = submitWorkspaceRun(state, {
  resourceBindingId: starterBinding.id,
  traceId: trace.id,
});
assert.equal(run.status, "completed", "workspace_run_must_complete_in_contract");
assert.equal(run.artifacts.length, 1, "workspace_run_must_create_artifact");
assert.equal(run.artifacts[0].source, "runtime_agent_output", "workspace_artifact_must_come_from_runtime_agent_output");

const portalSurface = readPortalSurface(state, {
  tenantId: tenant.id,
  userId: user.id,
  workspaceId: workspace.id,
  billingAccountId: billingAccount.id,
});
assert.equal(portalSurface.workspaceFiles.length, 1, "portal_must_read_workspace_file");
assert.equal(portalSurface.workspaceFiles[0].relativePath, "outputs/result.json", "portal_workspace_file_path_mismatch");
assert.equal(portalSurface.billingSummary.frozenCents, 15000, "portal_billing_summary_must_include_frozen_amount");
assert.equal(portalSurface.sessionTraceMetadata.length, 1, "portal_must_read_session_trace_metadata");
assert.deepEqual(portalSurface.sessionTraceMetadata[0].boundaryHops, trace.boundaryHops, "portal_trace_metadata_boundary_mismatch");
assertSurfaceIsRedacted(portalSurface, rawProviderKey, "portal_surface");

const balanceRisk = previewPaidActionRisk(billingAccount, { nextActionCostCents: 6000 });
assert.equal(balanceRisk.status, "insufficient_available_balance_would_consume_frozen_amount", "low_balance_warning_status_mismatch");
assert.equal(balanceRisk.canStartPaidAction, false, "low_balance_warning_must_block_new_paid_action");
assert.equal(balanceRisk.wouldConsumeFrozenCents, 1000, "low_balance_warning_must_report_frozen_consumption_amount");
assert.match(balanceRisk.copy, /消耗已冻结金额/, "low_balance_warning_copy_must_mention_frozen_amount_consumption");

const charged = settleRunCost(state, {
  resourceBindingId: starterBinding.id,
  runId: run.id,
  amountCents: 800,
});
assert.equal(charged.chargedCents, 800, "active_resource_must_accept_runtime_charge");
assert.equal(starterBinding.protection.consumedCents, 800, "runtime_charge_must_consume_protection");

const released = releaseResourceBinding(state, {
  resourceBindingId: starterBinding.id,
  releasedAt: "2026-05-07T01:00:00.000Z",
});
assert.equal(released.status, "released", "release_must_mark_binding_released");
assert.equal(released.compute.billingStoppedAt, "2026-05-07T01:00:00.000Z", "release_must_stop_compute_billing");
assert.equal(released.storage.billingStoppedAt, "2026-05-07T01:00:00.000Z", "release_must_stop_storage_billing");

const postReleaseCharge = settleRunCost(state, {
  resourceBindingId: starterBinding.id,
  runId: run.id,
  amountCents: 500,
  createdAt: "2026-05-07T02:00:00.000Z",
});
assert.equal(postReleaseCharge.chargedCents, 0, "released_resource_must_not_accrue_new_charge");
assert.equal(postReleaseCharge.skippedReason, "billing_stopped_after_release", "released_resource_charge_skip_reason_mismatch");

const cleanupReady = transitionCleanupAfterProtection(state, {
  resourceBindingId: starterBinding.id,
  now: "2026-05-14T01:00:00.001Z",
});
assert.equal(cleanupReady.protection.cleanupState, "cleanup_ready", "binding_must_enter_cleanup_after_7_day_protection");
assert.equal(state.workspaceFiles[0].status, "cleanup_ready", "workspace_file_must_enter_cleanup_state_after_protection");

const relationAudit = state.auditEvents.find((event) => event.action === "platform_runtime_resource_binding_provisioned");
assert.ok(relationAudit, "resource_binding_audit_event_required");
assert.equal(relationAudit.tenantId, tenant.id, "audit_tenant_relation_mismatch");
assert.equal(relationAudit.userId, user.id, "audit_user_relation_mismatch");
assert.equal(relationAudit.billingAccountId, billingAccount.id, "audit_billing_relation_mismatch");
assert.equal(relationAudit.resourceBindingId, starterBinding.id, "audit_resource_binding_relation_mismatch");
assert.match(relationAudit.auditTag, /binding:rb-1/, "audit_tag_must_include_binding_id");

const contractEvidence = {
  ok: true,
  contract: "v22_canonical_user_loop",
  mode: "scripts_only_no_real_cloud",
  branchSafeBoundaries: {
    touchesServices: false,
    touchesDeploy: false,
    touchesSentrux: false,
    touchesAdapters: false,
    mutatesOnePersonLabUpstream: false,
    runsLiveTest: false,
    mutatesRealCloud: false,
  },
  coveredPackages: [
    {
      id: "default-2c4gb-10gb",
      compute: PACKAGE_CATALOG["default-2c4gb-10gb"].compute,
      storage: PACKAGE_CATALOG["default-2c4gb-10gb"].storage,
    },
    {
      id: "default-8c16gb-100gb",
      compute: PACKAGE_CATALOG["default-8c16gb-100gb"].compute,
      storage: PACKAGE_CATALOG["default-8c16gb-100gb"].storage,
    },
  ],
  providerSurface,
  relationships: {
    tenantId: tenant.id,
    userId: user.id,
    workspaceId: workspace.id,
    resourceBindingId: starterBinding.id,
    billingAccountId: billingAccount.id,
    auditTag: starterBinding.auditTag,
  },
  lifecycle: {
    preauthFrozenCents: 15000,
    runArtifactId: run.artifacts[0].id,
    billingStoppedAt: released.compute.billingStoppedAt,
    cleanupStateAfterSevenDays: cleanupReady.protection.cleanupState,
  },
};

assertSurfaceIsRedacted(contractEvidence, rawProviderKey, "contract_evidence");
console.log(JSON.stringify(contractEvidence, null, 2));
