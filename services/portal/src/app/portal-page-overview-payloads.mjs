import {
  createPayloadTimingRecorder,
  paginateRows,
  rangeBounds,
  withinDateRange,
} from "./portal-page-payload-primitives.mjs";
import {
  buildOverviewCollections,
  buildOverviewKpis,
  netSpent,
} from "./portal-page-payload-helpers.mjs";

export function createOverviewPayloadBuilder({
  buildCommercialProfile,
  buildOverviewOnboarding,
  buildServerPlansFallback,
  buildServerPlansSummary,
  collectRunsForUser,
  currentServerPlanSelection,
  currentTaskSpaceForUser,
  evaluateUserPolicy,
  fetchBillingSummary,
  fetchPendingSummary,
  fetchServerPlans,
  formatDateTime,
  isRunTerminal,
  listTaskSpacesForUser,
}) {
  return async function buildOverviewPayload(db, user, options = {}) {
    const timing = createPayloadTimingRecorder();
    const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
    const tasks = listTaskSpacesForUser(db, user.id);
    const currentTask = currentTaskSpaceForUser(db, user) || tasks[0] || null;
    const runs = await collectRunsForUser(user.id, { limit: 50 });
    timing.mark("runs");
    const policy = await evaluateUserPolicy(db, user);
    const commercial = buildCommercialProfile(db, user, { wallet, policy });
    const serverPlans = await fetchServerPlans() || buildServerPlansFallback();
    const serverPlansSummary = buildServerPlansSummary(serverPlans);
    const billing = await fetchBillingSummary(user.id, "", "168h");
    const pendingBilling = await fetchPendingSummary(user.id, "", "168h");
    timing.mark("billing");
    const items = billing?.items || [];
    const resourceBindings = latestResourceBindingsForUser(db, user);
    const todayRange = rangeBounds("today");
    const todayCost = items
      .filter((item) => withinDateRange(item?.end || item?.start || item?.createdAt, todayRange))
      .reduce((sum, item) => sum + Number(item?.totalCost || 0), 0);
    const pendingTotal = Number(pendingBilling?.totals?.totalCost || pendingBilling?.totalCost || 0);
    const exactTotal = Number(billing?.totals?.totalCost || billing?.totalCost || 0);

    const { taskPagination, latestRunsPagination } = buildOverviewCollections({
      tasks,
      runs,
      options,
      paginateRows,
      formatDateTime,
      isRunTerminal,
    });
    const workspaceCount = tasks.filter((item) => !["deleted", "deleting"].includes(String(item.status || "").toLowerCase())).length;
    const sessionCount = db.workspaceSessions.filter((item) => item.userId === user.id && item.status === "active").length;

    return {
      kpis: buildOverviewKpis({
        commercial,
        wallet,
        todayCost,
        pendingTotal,
        exactTotal,
        historicalCost: netSpent(db.ledger.filter((item) => item.userId === user.id)),
        tasks,
        workspaceCount,
        runs,
        resourceBindingCount: resourceBindings.length,
      }),
      commercial,
      serverPlansSummary,
      selectedServerPlan: currentServerPlanSelection(currentTask),
      latestResourceBindings: resourceBindings.slice(0, 5),
      onboarding: buildOverviewOnboarding({ commercial, workspaceCount, sessionCount, serverPlansSummary }),
      taskCards: taskPagination.rows,
      taskPagination: {
        page: taskPagination.page,
        pageSize: taskPagination.pageSize,
        total: taskPagination.total,
        totalPages: taskPagination.totalPages,
      },
      latestRuns: latestRunsPagination.rows,
      latestRunsPagination: {
        page: latestRunsPagination.page,
        pageSize: latestRunsPagination.pageSize,
        total: latestRunsPagination.total,
        totalPages: latestRunsPagination.totalPages,
      },
      performance: timing.done(),
    };
  };
}

function text(value = "") {
  return String(value ?? "").trim();
}

function userTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function bindingId(binding = {}) {
  return text(binding.resourceBindingId || binding.id);
}

function billingAttributionId(binding = {}) {
  return text(binding.billingAttributionId || binding.billing_attribution_id || binding.cloudOperationId || binding.cloud_operation_id || binding.costAllocationTag || bindingId(binding));
}

function accountId(binding = {}) {
  return text(binding.accountId || binding.account_id || binding.userId || binding.user_id || binding.ownerUserId || binding.tenantId || binding.tenant_id || binding.ownerTenantId);
}

function serverPlanId(binding = {}) {
  return text(binding.serverPlanId || binding.server_plan_id || binding.planId || binding.plan_id || binding.packageId || binding.package_id);
}

function publicResourceBindingView(binding = {}) {
  return {
    id: bindingId(binding),
    resourceBindingId: bindingId(binding),
    billingAttributionId: billingAttributionId(binding),
    workspaceId: text(binding.workspaceId),
    accountId: accountId(binding),
    serverPlanId: serverPlanId(binding),
    status: text(binding.status || "active"),
    createdAt: text(binding.createdAt),
    updatedAt: text(binding.updatedAt),
  };
}

function latestResourceBindingsForUser(db = {}, user = {}) {
  const userId = text(user.id);
  const tenantId = userTenantId(user);
  return (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : [])
    .filter((binding) => text(binding.userId || binding.ownerUserId) === userId)
    .filter((binding) => !tenantId || text(binding.tenantId || binding.ownerTenantId) === tenantId)
    .map(publicResourceBindingView)
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
}
