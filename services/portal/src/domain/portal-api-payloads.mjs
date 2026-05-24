import {
  buildWeeklyProtectionFreezeView,
  buildWorkspaceBindingAccess,
  ownerScopeFromUser,
} from "./platform-provisioned-resources.mjs";
import {
  fileSpacePublicView,
  managedEnvironmentUserNarrative,
  workspacePublicView,
} from "./managed-environment-projection.mjs";
import {
  canonicalResourcePlanPublicView,
  getCanonicalResourcePlan,
} from "./lab-packages.mjs";

function text(value) {
  return String(value ?? "").trim();
}

async function collectAllRunsWithUsers(db, collectRunsForUser) {
  const rows = [];
  for (const user of db.users.filter((item) => item.role !== "admin")) {
    const runs = await collectRunsForUser(user.id);
    rows.push(...runs.map((run) => ({ ...run, userId: user.id, userName: user.name || user.email || user.id, userEmail: user.email || "" })));
  }
  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return rows;
}

function userTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function statusText(value = "", fallback = "active") {
  return text(value || fallback).toLowerCase();
}

function providerBindingMatchesUser(binding = {}, user = {}) {
  const tenantId = userTenantId(user);
  const userId = text(user.id);
  return text(binding.tenantId || binding.tenant_id || binding.ownerTenantId) === tenantId
    && text(binding.userId || binding.user_id || binding.ownerUserId) === userId
    && text(binding.provider || "gflabtoken") === "gflabtoken";
}

function providerBindingIsBound(binding = {}) {
  const status = statusText(binding.boundStatus || binding.status || binding.providerConfigStatus, "bound");
  return ["bound", "configured", "active"].includes(status);
}

function resolveProviderState(db = {}, user = {}) {
  const binding = (Array.isArray(db.providerKeyBindings) ? db.providerKeyBindings : [])
    .find((item) => providerBindingMatchesUser(item, user) && providerBindingIsBound(item));
  const userProviderKeyRef = text(user.providerKeyRef || user.providerConfigSecretRef);
  const providerKeyRef = text(binding?.providerKeyRef || binding?.providerConfigSecretRef || userProviderKeyRef);
  const providerBound = Boolean(providerKeyRef && (!binding || providerBindingIsBound(binding)));
  return {
    providerBound,
    providerKeyRef: providerBound ? providerKeyRef : "",
    provider: "gflabtoken",
    boundStatus: providerBound ? "bound" : "missing",
  };
}

function managedEnvironmentReadiness(provider = {}) {
  if (!provider.providerBound || !text(provider.providerKeyRef)) {
    return {
      ready: false,
      reason: "provider_key_required",
      providerBound: false,
      providerKeyRef: "",
    };
  }
  return {
    ready: true,
    reason: "ready",
    providerMode: "user_gflabtoken",
    providerBound: true,
    providerKeyRef: text(provider.providerKeyRef),
  };
}

function tenantRecord(db = {}, user = {}) {
  const tenantId = userTenantId(user);
  return (Array.isArray(db.tenants) ? db.tenants : []).find((item) => text(item.id || item.tenantId) === tenantId) || {};
}

function identityPayload(user = {}, activeUserStatus = (status) => status || "active") {
  return {
    id: text(user.id),
    userId: text(user.id),
    name: text(user.name),
    email: text(user.email),
    role: text(user.role || "user"),
    status: activeUserStatus(user.status),
  };
}

function tenantPayload(db = {}, user = {}) {
  const tenant = tenantRecord(db, user);
  return {
    status: statusText(tenant.status || "active"),
    runtimeOwnership: "platform_provisioned",
    isolationMode: "customer_dedicated",
  };
}

function ownerMatches(item = {}, owner = {}) {
  return text(item.ownerUserId || item.userId || item.user_id) === text(owner.ownerUserId)
    && text(item.ownerTenantId || item.tenantId || item.tenant_id) === text(owner.ownerTenantId);
}

const CANONICAL_BINDING_STATUSES = new Set([
  "active",
  "release_requested",
  "billing_stop_confirming",
  "billing_stopped",
  "audit_pending",
  "audit_ready",
  "audited",
]);

function findTaskSpace(db = {}, user = {}, workspaceId = "", currentTaskSpaceForUser = null) {
  const explicitWorkspaceId = text(workspaceId);
  if (explicitWorkspaceId) {
    const byWorkspace = (Array.isArray(db.taskSpaces) ? db.taskSpaces : [])
      .find((item) => text(item.slug || item.workspaceId || item.id) === explicitWorkspaceId && text(item.userId || item.ownerUserId) === text(user.id));
    if (byWorkspace) return byWorkspace;
  }
  if (typeof currentTaskSpaceForUser === "function") return currentTaskSpaceForUser(db, user) || null;
  return (Array.isArray(db.taskSpaces) ? db.taskSpaces : [])
    .find((item) => text(item.userId || item.ownerUserId) === text(user.id) && text(item.slug) === text(user.currentTaskSlug)) || null;
}

function activeBindingForWorkspace(db = {}, user = {}, workspaceId = "") {
  const owner = ownerScopeFromUser(user);
  const targetWorkspaceId = text(workspaceId);
  const bindings = (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : [])
    .filter((item) => ownerMatches(item, owner))
    .filter((item) => CANONICAL_BINDING_STATUSES.has(statusText(item.status)))
    .filter((item) => !targetWorkspaceId || text(item.workspaceId) === targetWorkspaceId)
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
  return bindings[0] || null;
}

function freezeForBinding(db = {}, user = {}, binding = null) {
  if (!binding) return null;
  const owner = ownerScopeFromUser(user);
  const bindingIds = new Set([text(binding.id), text(binding.resourceBindingId)].filter(Boolean));
  const freeze = (Array.isArray(db.weeklyProtectionFreezes) ? db.weeklyProtectionFreezes : [])
    .filter((item) => ownerMatches(item, owner))
    .filter((item) => bindingIds.has(text(item.resourceBindingId)))
    .sort((left, right) => String(right.updatedAt || right.windowStartAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.windowStartAt || left.createdAt || "")))[0] || null;
  return freeze ? buildWeeklyProtectionFreezeView(freeze) : null;
}

function workspaceFilePublicView(file = {}) {
  return {
    id: text(file.id),
    fileRef: text(file.id),
    workspaceId: text(file.workspaceId),
    sessionId: text(file.oplSessionId || file.runId),
    kind: text(file.kind),
    name: text(file.name),
    relativePath: text(file.kind) ? `${text(file.kind)}/${text(file.relativePath)}` : text(file.relativePath),
    sizeBytes: Number(file.sizeBytes || 0),
    contentType: text(file.contentType),
    status: text(file.status || "active"),
    createdAt: text(file.createdAt),
    updatedAt: text(file.updatedAt),
  };
}

function workspaceFilesForPortal(db = {}, user = {}, workspaceId = "", resourceBinding = null) {
  const tenantId = userTenantId(user);
  const userId = text(user.id);
  const bindingId = text(resourceBinding?.resourceBindingId || resourceBinding?.id);
  return (Array.isArray(db.workspaceFiles) ? db.workspaceFiles : [])
    .filter((item) => text(item.tenantId) === tenantId)
    .filter((item) => text(item.userId) === userId)
    .filter((item) => text(item.workspaceId) === text(workspaceId))
    .filter((item) => !bindingId || text(item.resourceBindingId) === bindingId)
    .filter((item) => statusText(item.status || "active") !== "deleted")
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")))
    .map(workspaceFilePublicView);
}

function sessionTraceMetadataView(trace = {}, resourceBinding = null) {
  const timestamps = trace.timestamps && typeof trace.timestamps === "object" ? trace.timestamps : {};
  return {
    sessionId: text(trace.sessionId),
    workspaceId: text(trace.workspaceId),
    providerKeyRef: text(trace.providerKeyRef),
    artifactRefs: Array.isArray(trace.artifactRefs) ? trace.artifactRefs.map(text).filter(Boolean) : [],
    timestamps: {
      createdAt: text(timestamps.createdAt || trace.createdAt),
      updatedAt: text(timestamps.updatedAt || trace.updatedAt || timestamps.createdAt || trace.createdAt),
    },
    status: text(trace.status || "recorded"),
  };
}

function sessionTraceMetadataForPortal(db = {}, user = {}, workspaceId = "", resourceBinding = null) {
  const bindingId = text(resourceBinding?.resourceBindingId || resourceBinding?.id);
  return (Array.isArray(db.oplWorkTraceMetadata) ? db.oplWorkTraceMetadata : [])
    .filter((item) => text(item.workspaceId) === text(workspaceId))
    .filter((item) => !bindingId || text(item.resourceBindingId) === bindingId)
    .filter((item) => !item.tenantId || text(item.tenantId) === userTenantId(user))
    .map((item) => sessionTraceMetadataView(item, resourceBinding))
    .sort((left, right) => String(right.timestamps.updatedAt || "").localeCompare(String(left.timestamps.updatedAt || "")));
}

function cents(value = 0) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
}

function yuanToCents(value = 0) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function amountCents(centsValue, yuanValue = 0) {
  if (centsValue !== undefined && centsValue !== null && text(centsValue) !== "") return cents(centsValue);
  return yuanToCents(yuanValue);
}

function sumPendingUsageCents(balance = {}) {
  return (Array.isArray(balance.pending) ? balance.pending : [])
    .reduce((sum, item) => sum + cents(item.amountCents), 0);
}

function billingSummaryPayload(balance = {}, freeze = null) {
  const frozenAmountCents = freeze
    ? amountCents(freeze.frozenAmountCents ?? freeze.weeklyAmountCents, freeze.frozenAmount ?? freeze.weeklyAmount)
    : cents(balance.frozenWeeklyAmountCents);
  const estimatedUsageCents = sumPendingUsageCents(balance);
  const pendingItems = Array.isArray(balance.pending) ? balance.pending.map((item) => ({
    id: text(item.id),
    workspaceId: text(item.workspaceId),
    amountCents: cents(item.amountCents),
    status: text(item.status || "waiting_exact_bill"),
    createdAt: text(item.createdAt),
  })) : [];
  return {
    balance: {
      balanceCents: cents(balance.balanceCents),
      availableBalanceCents: cents(balance.availableBalanceCents),
    },
    frozen: {
      amountCents: frozenAmountCents,
      status: frozenAmountCents > 0 ? text(freeze?.status || "active_pending_product_approval") : "none",
    },
    preauth: {
      amountCents: frozenAmountCents,
      status: frozenAmountCents > 0 ? text(freeze?.preauthStatus || "pending_product_approval") : "none",
    },
    estimatedUsage: {
      amountCents: estimatedUsageCents,
      status: estimatedUsageCents > 0 ? "estimated" : "none",
      items: pendingItems,
    },
    pendingReconciliation: {
      status: pendingItems.length > 0 ? "pending_reconciliation" : "none",
      items: pendingItems,
    },
    releaseStopBillingStatus: "none",
    billingLifecycle: {
      status: "active_billing",
      activeBilling: true,
      stopBillingConfirming: false,
      billingStopped: false,
      auditPending: false,
      auditReady: false,
      audited: false,
    },
  };
}

function preauthPayload(freeze = null) {
  if (!freeze) return { status: "none", amountCents: 0 };
  return {
    status: text(freeze.preauthStatus || "pending_product_approval"),
    amountCents: amountCents(freeze.frozenAmountCents ?? freeze.weeklyAmountCents, freeze.frozenAmount ?? freeze.weeklyAmount),
  };
}

function managedEnvironmentPayload({ runtimeEnabled = false, workspace = null, fileSpace = null, preauth = null, selectedPlan = null } = {}) {
  return {
    enabled: Boolean(runtimeEnabled),
    workspace,
    fileSpace,
    preauth,
    selectedPlan,
  };
}

function parseTime(value = "") {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function auditStatusForBinding(binding = null, now = "") {
  if (!binding || !text(binding.releasedAt)) return "none";
  const explicit = statusText(binding.auditStatus || binding.status, "audit_pending");
  if (explicit === "audited") return "audited";
  const auditReadyAt = parseTime(binding.auditReadyAt);
  const nowMs = parseTime(now) || Date.now();
  if (auditReadyAt && nowMs >= auditReadyAt) return "audit_ready";
  return explicit === "audit_ready" ? "audit_ready" : "audit_pending";
}

function releasePayload(binding = null) {
  if (!binding || !text(binding.releasedAt)) return { status: "none" };
  return {
    status: text(binding.status || "audit_pending"),
    releasedAt: text(binding.releasedAt),
    transitions: Array.isArray(binding.releaseTransitions) ? binding.releaseTransitions.map((item) => ({
      status: text(item.status),
      at: text(item.at),
    })) : [],
  };
}

function stopBillingPayload(binding = null) {
  if (!binding || !text(binding.releasedAt)) {
    return {
      status: "active_billing",
      billingStoppedAt: "",
      billingStopConfirmBy: "",
      confirmationWindowMinutes: 120,
    };
  }
  return {
    status: text(binding.stopBillingStatus || "billing_stopped"),
    billingStoppedAt: text(binding.billingStoppedAt || binding.releasedAt),
    billingStopConfirmBy: text(binding.billingStopConfirmBy),
    confirmationWindowMinutes: 120,
  };
}

function auditPayload(binding = null, now = "") {
  if (!binding || !text(binding.releasedAt)) return { status: "none", auditReadyAt: "", auditPolicy: "T+1" };
  return {
    status: auditStatusForBinding(binding, now),
    auditReadyAt: text(binding.auditReadyAt),
    auditPolicy: "T+1",
  };
}

function billingLifecyclePayload({ release = {}, stopBilling = {}, audit = {} } = {}) {
  const activeBilling = stopBilling.status === "active_billing";
  return {
    status: activeBilling ? "active_billing" : audit.status,
    activeBilling,
    stopBillingConfirming: stopBilling.status === "billing_stop_confirming",
    billingStopped: stopBilling.status === "billing_stopped",
    auditPending: audit.status === "audit_pending",
    auditReady: audit.status === "audit_ready",
    audited: audit.status === "audited",
    releasedAt: text(release.releasedAt),
    billingStoppedAt: text(stopBilling.billingStoppedAt),
    billingStopConfirmBy: text(stopBilling.billingStopConfirmBy),
    auditReadyAt: text(audit.auditReadyAt),
  };
}

function portalTraceProjectionView(row = {}) {
  const usageSummary = row.usageSummary && typeof row.usageSummary === "object" ? row.usageSummary : {};
  const costEstimate = row.costEstimate && typeof row.costEstimate === "object" ? row.costEstimate : {};
  return {
    traceId: text(row.traceId),
    sessionId: text(row.sessionId),
    runId: text(row.runId),
    status: text(row.status),
    latencyMs: Number(row.latencyMs),
    usageSummary: {
      inputTokens: Number(usageSummary.inputTokens),
      outputTokens: Number(usageSummary.outputTokens),
      totalTokens: Number(usageSummary.totalTokens),
    },
    costEstimate: {
      currency: text(costEstimate.currency),
      amount: Number(costEstimate.amount),
    },
    traceUrl: text(row.traceUrl),
    tags: Array.isArray(row.tags) ? row.tags.map(text).filter(Boolean) : [],
  };
}

function applyReleaseBillingSummary(summary = {}, { release = {}, stopBilling = {}, audit = {} } = {}) {
  return {
    ...summary,
    releaseStopBillingStatus: stopBilling.status === "active_billing" ? "none" : stopBilling.status,
    billingLifecycle: billingLifecyclePayload({ release, stopBilling, audit }),
  };
}

function planIdFromInputs({ binding = null, taskSpace = null, selectedServerPlan = null } = {}) {
  return text(
    binding?.planId
    || binding?.packageId
    || binding?.serverPlanId
    || taskSpace?.serverPlanId
    || taskSpace?.packageId
    || selectedServerPlan?.id
    || "starter_2c4g_10gb"
  );
}

function canonicalPlanPayload({ binding = null, taskSpace = null, selectedServerPlan = null } = {}) {
  const plan = getCanonicalResourcePlan(planIdFromInputs({ binding, taskSpace, selectedServerPlan }))
    || getCanonicalResourcePlan("starter_2c4g_10gb");
  return canonicalResourcePlanPublicView(plan);
}

export function buildCanonicalPortalStatePayload(db = {}, user = {}, {
  activeUserStatus = (status) => status || "active",
  buildUserBillingSummary = () => ({ balanceCents: 0, availableBalanceCents: 0, frozenWeeklyAmountCents: 0 }),
  currentServerPlanSelection = () => null,
  currentTaskSpaceForUser = null,
  now = "",
  workspaceId = "",
} = {}) {
  const taskSpace = findTaskSpace(db, user, workspaceId, currentTaskSpaceForUser);
  const selectedServerPlan = currentServerPlanSelection(taskSpace);
  const targetWorkspaceId = text(workspaceId || taskSpace?.slug || taskSpace?.workspaceId || user.currentTaskSlug || "");
  const binding = activeBindingForWorkspace(db, user, targetWorkspaceId);
  const freeze = freezeForBinding(db, user, binding);
  const provider = resolveProviderState(db, user);
  const balance = buildUserBillingSummary(db, { user });
  const bindingAccess = binding ? buildWorkspaceBindingAccess(binding) : null;
  const runtimeEnabled = Boolean(bindingAccess?.fullRuntime?.allowed);
  const readiness = managedEnvironmentReadiness(provider);
  const workspace = workspacePublicView(taskSpace || {}, targetWorkspaceId);
  const selectedPlan = canonicalPlanPayload({ binding, taskSpace, selectedServerPlan });
  const fileSpace = fileSpacePublicView(binding || taskSpace || {}, selectedPlan);
  const publicWorkspaceFiles = workspaceFilesForPortal(db, user, targetWorkspaceId, binding);
  const outputFiles = publicWorkspaceFiles.filter((item) => item.kind === "outputs");
  const sessionTraceMetadata = sessionTraceMetadataForPortal(db, user, targetWorkspaceId, binding);
  const release = releasePayload(binding);
  const stopBilling = stopBillingPayload(binding);
  const audit = auditPayload(binding, now);
  const billingSummary = applyReleaseBillingSummary(billingSummaryPayload(balance, freeze), { release, stopBilling, audit });
  return {
    ok: true,
    source: "portal_canonical_state",
    identity: identityPayload(user, activeUserStatus),
    tenant: tenantPayload(db, user),
    balance,
    providerBound: provider.providerBound,
    providerKeyRef: provider.providerKeyRef,
    provider,
    readyForManagedEnvironment: readiness.ready,
    readiness,
    managedEnvironmentEnabled: runtimeEnabled,
    runtimeEnabled,
    workspace,
    fileSpace,
    preauth: preauthPayload(freeze),
    release,
    stopBilling,
    audit,
    selectedPlan,
    plan: selectedPlan,
    managedEnvironment: managedEnvironmentPayload({
      runtimeEnabled,
      workspace,
      fileSpace,
      preauth: preauthPayload(freeze),
      selectedPlan,
    }),
    workspaceFiles: publicWorkspaceFiles,
    outputFiles,
    artifacts: outputFiles,
    billingSummary,
    sessionTraceMetadata,
    userNarrative: managedEnvironmentUserNarrative(),
  };
}

export function createPortalApiPayloads(deps) {
  const {
    buildWorkspacePayload,
    collectRunsForUser,
    defaultTaskTitle,
    ensureTaskSpace,
    fetchBillingSummary,
    fetchHarborSummary,
    fetchLangfuseSummary,
    fetchTraceRows = async () => ({ source: "langfuse_sanitized_projection", type: "status_only", rows: [] }),
    findTaskSpace,
    isRunTerminal,
    normalizePageSize,
    paginateRows,
  } = deps;

  function buildSessionsApiPayload(db) {
    const ordinarySessions = (db.sessions || []).map((session) => {
      const user = db.users.find((entry) => entry.id === session.userId) || {};
      return {
        sessionId: session.id,
        sessionType: "ordinary",
        userId: session.userId || "",
        userName: user.name || user.email || session.userId || "",
        userEmail: user.email || "",
        workspaceId: "",
        workspaceSessionId: "",
        lastUsedAt: session.createdAt || "",
        status: "active",
        source: session.authSource || "portal_session",
      };
    });
    const workspaceSessions = (db.workspaceSessions || []).map((session) => {
      const user = db.users.find((entry) => entry.id === session.userId) || {};
      return {
        sessionId: session.id,
        sessionType: "mas",
        userId: session.userId || "",
        userName: user.name || user.email || session.userId || "",
        userEmail: user.email || "",
        workspaceId: session.workspaceId || "",
        workspaceSessionId: session.id,
        lastUsedAt: session.lastUsedAt || session.createdAt || "",
        status: session.status || "active",
        source: session.source || "workspace_session",
      };
    });
    const items = [...workspaceSessions, ...ordinarySessions].sort((a, b) => String(b.lastUsedAt || "").localeCompare(String(a.lastUsedAt || "")));
    return {
      items,
      summary: {
        ordinary: ordinarySessions.filter((item) => item.status === "active").length,
        mas: workspaceSessions.filter((item) => item.status === "active").length,
        total: items.length,
      },
      dataSource: {
        ordinary: "portal sessions",
        mas: "workspace sessions",
      },
    };
  }

  async function buildRunsApiPayload(db, options = {}) {
    const runs = await collectAllRunsWithUsers(db, collectRunsForUser);
    const filtered = runs.filter((item) => {
      if (options.runId && item.runId !== options.runId) return false;
      if (options.userId && item.userId !== options.userId) return false;
      if (options.workspaceId && item.workspaceId !== options.workspaceId) return false;
      return true;
    });
    const pagination = paginateRows(filtered, options.page, normalizePageSize(options.pageSize || 10));
    return {
      items: pagination.rows.map((run) => ({
        runId: run.runId || "",
        userId: run.userId || "",
        userName: run.userName || "",
        userEmail: run.userEmail || "",
        workspaceId: run.workspaceId || "",
        workspaceSessionId: run.workspaceSessionId || "",
        status: isRunTerminal(run) ? "completed" : (run.status || "running"),
        createdAt: run.createdAt || "",
        source: run.source || "",
      })),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
      dataSource: "runtime events + run artifacts",
    };
  }

  async function buildWorkspaceStorageApiPayload(db, user, taskSlug) {
    const task = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    const payload = await buildWorkspacePayload(db, user, task.slug);
    return {
      workspaceId: payload.workspace.slug,
      inputsCount: payload.counts.inputs,
      outputsCount: payload.counts.outputs,
      inputBytes: payload.distribution.inputBytes,
      outputBytes: payload.distribution.outputBytes,
      minioSynced: true,
      lastSyncAt: new Date().toISOString(),
      dataSource: "workspace filesystem + minio sync pipeline",
    };
  }

  async function buildCostsSummaryApiPayload() {
    const billing = await fetchBillingSummary("", "", "168h");
    const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
    return {
      cpuCost: Number(totals.cpuCost || 0),
      gpuCost: Number(totals.gpuCost || 0),
      storageCost: Number(totals.pvCost || 0),
      totalCost: Number(totals.totalCost || 0),
      pricingSource: billing?.source || "unavailable",
      dataSource: billing ? "portal_billing_ledger" : "unavailable",
    };
  }

  async function buildWorkspaceCostsApiPayload(workspaceId = "") {
    const billing = await fetchBillingSummary("", workspaceId, "168h");
    const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
    return {
      workspaceId,
      cpuCost: Number(totals.cpuCost || 0),
      gpuCost: Number(totals.gpuCost || 0),
      storageCost: Number(totals.pvCost || 0),
      totalCost: Number(totals.totalCost || 0),
      pricingSource: billing?.source || "unavailable",
      dataSource: billing ? "portal_billing_ledger" : "unavailable",
    };
  }

  async function buildRunCostsApiPayload(runId = "") {
    const billing = await fetchBillingSummary("", "", "168h");
    const match = (billing?.items || []).find((item) => {
      const props = item?.properties || {};
      return props["label:run_id"] === runId || props.run_id === runId || String(item?.name || "").includes(runId);
    });
    return {
      runId,
      workspaceId: String(match?.properties?.["label:workspace_id"] || match?.properties?.workspace_id || ""),
      customerId: String(match?.properties?.["label:customer_id"] || match?.properties?.customer_id || ""),
      cpuCost: Number(match?.cpuCost || 0),
      gpuCost: Number(match?.gpuCost || 0),
      storageCost: Number(match?.pvCost || 0),
      totalCost: Number(match?.totalCost || 0),
      pricingSource: String(match?.properties?.pricing_source || match?.properties?.["label:pricing_source"] || "unavailable"),
      dataSource: match ? "portal_billing_ledger" : "unavailable",
    };
  }

  async function buildRegistrySummaryApiPayload(db) {
    const harbor = await fetchHarborSummary();
    return {
      ...harbor,
      imageTagCount: new Set((db.userSandboxes || []).map((item) => item.imageTag).filter(Boolean)).size,
      dataSource: harbor.available ? "Harbor API" : "Harbor probe",
    };
  }

  function buildRegistryImagesApiPayload(db) {
    const items = (db.userSandboxes || [])
      .map((item) => ({
        userId: item.userId,
        containerName: item.containerName || "",
        namespace: item.namespace || "",
        imageTag: item.imageTag || "",
        status: item.status || "",
        lastWorkspaceId: item.lastWorkspaceId || "",
        updatedAt: item.updatedAt || item.lastActiveAt || "",
      }))
      .filter((item) => item.imageTag)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return {
      items,
      dataSource: "user sandboxes + Harbor naming",
    };
  }

  async function buildTraceSummaryApiPayload() {
    const summary = await fetchLangfuseSummary();
    return {
      ...summary,
      dataSource: summary.available ? "Portal 会话轨迹 sanitized projection" : "trace summary unavailable",
    };
  }

  async function buildTracesApiPayload(options = {}) {
    const [summary, traceRows] = await Promise.all([
      fetchLangfuseSummary(),
      fetchTraceRows({
        userId: options.userId || "",
        workspaceId: options.workspaceId || "",
        runId: options.runId || "",
        limit: options.limit || 20,
      }),
    ]);
    const items = (Array.isArray(traceRows.rows) ? traceRows.rows : []).map(portalTraceProjectionView);
    return {
      filters: {
        userId: options.userId || "",
        workspaceId: options.workspaceId || "",
        runId: options.runId || "",
      },
      summary: {
        ...summary,
        canonicalSource: false,
        billingTruth: false,
        traceCount: items.length,
      },
      items,
      customerTraceSurface: "Portal 会话轨迹",
      customerDefaultLangfuseUi: false,
      dataSource: "Portal 会话轨迹 sanitized projection",
      source: traceRows.source || "langfuse_sanitized_projection",
    };
  }

  return {
    buildCostsSummaryApiPayload,
    buildRegistryImagesApiPayload,
    buildRegistrySummaryApiPayload,
    buildRunCostsApiPayload,
    buildRunsApiPayload,
    buildSessionsApiPayload,
    buildTraceSummaryApiPayload,
    buildTracesApiPayload,
    buildWorkspaceCostsApiPayload,
    buildWorkspaceStorageApiPayload,
  };
}
