import {
  buildWeeklyProtectionFreezeView,
  buildWorkspaceBindingAccess,
  ownerScopeFromUser,
} from "./platform-provisioned-resources.mjs";
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
  const tenantId = userTenantId(user);
  return {
    tenantId,
    id: text(tenant.id || tenant.tenantId || tenantId),
    slug: text(tenant.slug || tenant.name || tenantId),
    status: statusText(tenant.status || "active"),
    runtimeOwnership: "platform_provisioned",
    isolationMode: "customer_dedicated",
  };
}

function ownerMatches(item = {}, owner = {}) {
  return text(item.ownerUserId || item.userId || item.user_id) === text(owner.ownerUserId)
    && text(item.ownerTenantId || item.tenantId || item.tenant_id) === text(owner.ownerTenantId);
}

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
    .filter((item) => statusText(item.status) === "active")
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

function resourceBindingPayload(binding = null) {
  if (!binding) return null;
  return {
    id: text(binding.id),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    workspaceId: text(binding.workspaceId),
    computeInstanceId: text(binding.computeInstanceId),
    storageBucketId: text(binding.storageBucketId),
    rootPrefix: text(binding.rootPrefix),
    status: statusText(binding.status),
    bindingAccess: buildWorkspaceBindingAccess(binding),
    createdAt: text(binding.createdAt),
    updatedAt: text(binding.updatedAt),
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
  workspaceId = "",
} = {}) {
  const taskSpace = findTaskSpace(db, user, workspaceId, currentTaskSpaceForUser);
  const selectedServerPlan = currentServerPlanSelection(taskSpace);
  const targetWorkspaceId = text(workspaceId || taskSpace?.slug || taskSpace?.workspaceId || user.currentTaskSlug || "");
  const binding = activeBindingForWorkspace(db, user, targetWorkspaceId);
  const resourceBinding = resourceBindingPayload(binding);
  const freeze = freezeForBinding(db, user, binding);
  const provider = resolveProviderState(db, user);
  const balance = buildUserBillingSummary(db, { user });
  const runtimeEnabled = Boolean(resourceBinding?.bindingAccess?.fullRuntime?.allowed);
  return {
    ok: true,
    source: "portal_canonical_state",
    identity: identityPayload(user, activeUserStatus),
    tenant: tenantPayload(db, user),
    balance,
    providerBound: provider.providerBound,
    providerKeyRef: provider.providerKeyRef,
    provider,
    runtimeEnabled,
    resourceBinding,
    freeze,
    plan: canonicalPlanPayload({ binding, taskSpace, selectedServerPlan }),
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
      pricingSource: billing ? "opencost_aggregated" : "unavailable",
      dataSource: "billing-aggregator / OpenCost",
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
      pricingSource: billing ? "opencost_aggregated" : "unavailable",
      dataSource: "billing-aggregator / OpenCost",
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
      dataSource: match ? "billing-aggregator / OpenCost" : "unavailable",
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
      dataSource: summary.available ? "Langfuse ClickHouse" : "trace summary unavailable",
    };
  }

  async function buildTracesApiPayload(options = {}) {
    const summary = await fetchLangfuseSummary();
    return {
      filters: {
        userId: options.userId || "",
        workspaceId: options.workspaceId || "",
        runId: options.runId || "",
      },
      summary,
      items: [],
      dataSource: summary.available ? "Langfuse summary only; detailed trace drill-down pending" : "unavailable",
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
