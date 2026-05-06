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
  resourceOrderPublicView,
  resourceOrdersForUser,
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
    const resourceOrders = resourceOrdersForUser(db, user.id);
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
        resourceOrderCount: resourceOrders.length,
      }),
      commercial,
      serverPlansSummary,
      selectedServerPlan: currentServerPlanSelection(currentTask),
      latestResourceOrders: resourceOrders.slice(0, 5).map((order) => resourceOrderPublicView(order, db.resourceOrderEvents || [])),
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
