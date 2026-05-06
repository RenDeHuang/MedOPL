import { resolveSupportBoundary } from "../domain/support-boundaries.mjs";
import {
  createPayloadTimingRecorder,
  groupBillingByDay,
  normalizePageSize,
  paginateRows,
  rangeBounds,
  withinDateRange,
} from "./portal-page-payload-primitives.mjs";
import {
  buildBillingRunCosts,
  buildBillingTaskCosts,
  buildBillingTotals,
} from "./portal-page-payload-helpers.mjs";

function billingDateFilterOptions({ from = "", to = "" } = {}, formatDateOnly) {
  const fromValue = String(from || "").trim();
  const toValue = String(to || "").trim();
  const rangeKey = fromValue || toValue ? "custom" : "30d";
  const fallbackStart = new Date();
  fallbackStart.setDate(fallbackStart.getDate() - 29);
  const normalizedFrom = fromValue || formatDateOnly(fallbackStart);
  const normalizedTo = toValue || formatDateOnly(new Date());
  return {
    rangeKey,
    normalizedFrom,
    normalizedTo,
    range: rangeBounds(rangeKey, normalizedFrom, normalizedTo),
  };
}

function walletPayload(wallet, commercial) {
  return {
    balance: Number(wallet.balance || 0),
    activeFreeze: commercial.activeFreeze || 0,
    availableBalance: commercial.availableBalance || 0,
    trialRemaining: commercial.trialRemaining || 0,
  };
}

function billingBreakdown(totals, billing) {
  return {
    cpuCost: Number(totals.cpuCost.toFixed(5)),
    gpuCost: Number(totals.gpuCost.toFixed(5)),
    storageCost: Number(totals.pvCost.toFixed(5)),
    vpnCost: 0,
    trafficCost: 0,
    otherCloudCost: 0,
    cloudSource: billing?.cloudSource || billing?.source || "not_connected",
    pricingSource: billing?.source || "unavailable",
  };
}

function billingSupportBoundary(wallet, commercial, run = {}) {
  return resolveSupportBoundary({
    wallet,
    freeze: { activeFreeze: commercial.activeFreeze || 0 },
    minRequiredBalance: Math.max(1, Number(commercial.balanceFloor || 0)),
    run,
  });
}

function billingSummary({ totals, pendingBilling, billing, filteredRuns = [] }) {
  return {
    selectedCost: Number(totals.totalCost.toFixed(5)),
    runCount: filteredRuns.length,
    workspaceCount: 0,
    pendingCost: Number((Number(pendingBilling?.totals?.totalCost || pendingBilling?.totalCost || 0)).toFixed(5)),
    exactCost: Number((Number(billing?.totals?.totalCost || billing?.totalCost || totals.totalCost || 0)).toFixed(5)),
  };
}

function todayCostFrom(items) {
  return Number(items
    .filter((item) => withinDateRange(item?.end || item?.start || item?.createdAt, rangeBounds("today")))
    .reduce((sum, item) => sum + Number(item?.totalCost || 0), 0)
    .toFixed(5));
}

export function createBillingPayloadBuilders({
  buildCommercialProfile,
  collectRunsForUser,
  ensureWallet,
  fetchBillingSummary,
  fetchPendingSummary,
  formatDateOnly,
  isRunTerminal,
  listTaskSpacesForUser,
}) {
  async function buildBillingPayload(db, user, options = {}) {
    const timing = createPayloadTimingRecorder();
    const wallet = ensureWallet(db, user.id);
    const commercial = buildCommercialProfile(db, user, { wallet });
    const pageSize = normalizePageSize(options.pageSize);
    const { rangeKey, normalizedFrom, normalizedTo, range } = billingDateFilterOptions(options, formatDateOnly);
    const billing = await fetchBillingSummary(user.id, "", "720h");
    const pendingBilling = await fetchPendingSummary(user.id, "", "168h");
    timing.mark("billing");
    const items = billing?.items || [];
    const runs = await collectRunsForUser(user.id, { limit: 200 });
    timing.mark("runs");
    const filteredItems = items.filter((item) => withinDateRange(item?.end || item?.start || item?.createdAt, range));
    const filteredRuns = runs.filter((run) => withinDateRange(run.createdAt || "", range));
    const filteredLedger = db.ledger
      .filter((item) => item.userId === user.id)
      .filter((item) => withinDateRange(item.createdAt || "", range))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const totals = buildBillingTotals(filteredItems);
    const taskCostsAll = buildBillingTaskCosts({ tasks: listTaskSpacesForUser(db, user.id), filteredRuns, filteredItems });
    const allRunCosts = buildBillingRunCosts({ filteredRuns, filteredItems, isRunTerminal });
    const taskPagination = paginateRows(taskCostsAll, options.tasksPage, pageSize);
    const ledgerPagination = paginateRows(filteredLedger, options.ledgerPage, pageSize);
    const runPagination = paginateRows(allRunCosts, options.runsPage, pageSize);
    const supportBoundary = billingSupportBoundary(
      wallet,
      commercial,
      allRunCosts.find((run) => ["failed", "error"].includes(String(run.runStatus || "").toLowerCase())) || {},
    );
    return {
      wallet: walletPayload(wallet, commercial),
      totals,
      summary: {
        ...billingSummary({ totals, pendingBilling, billing, filteredRuns }),
        workspaceCount: taskCostsAll.filter((item) => item.runCount > 0 || item.totalCost > 0).length,
      },
      supportBoundary,
      breakdown: billingBreakdown(totals, billing),
      taskCosts: taskPagination.rows,
      taskPagination: {
        page: taskPagination.page,
        pageSize: taskPagination.pageSize,
        total: taskPagination.total,
        totalPages: taskPagination.totalPages,
      },
      runCosts: runPagination.rows,
      runPagination: {
        page: runPagination.page,
        pageSize: runPagination.pageSize,
        total: runPagination.total,
        totalPages: runPagination.totalPages,
      },
      ledger: ledgerPagination.rows,
      ledgerPagination: {
        page: ledgerPagination.page,
        pageSize: ledgerPagination.pageSize,
        total: ledgerPagination.total,
        totalPages: ledgerPagination.totalPages,
      },
      filter: {
        range: rangeKey,
        from: normalizedFrom,
        to: normalizedTo,
      },
      trend: groupBillingByDay(filteredItems, 7),
      todayCost: todayCostFrom(filteredItems),
      performance: timing.done(),
    };
  }

  async function buildBillingSummaryPayload(db, user, options = {}) {
    const timing = createPayloadTimingRecorder();
    const wallet = ensureWallet(db, user.id);
    const commercial = buildCommercialProfile(db, user, { wallet });
    const { rangeKey, normalizedFrom, normalizedTo, range } = billingDateFilterOptions(options, formatDateOnly);
    const [billing, pendingBilling] = await Promise.all([
      fetchBillingSummary(user.id, "", "720h"),
      fetchPendingSummary(user.id, "", "168h"),
    ]);
    timing.mark("billing");
    const items = billing?.items || [];
    const filteredItems = items.filter((item) => withinDateRange(item?.end || item?.start || item?.createdAt, range));
    const totals = buildBillingTotals(filteredItems);
    return {
      wallet: walletPayload(wallet, commercial),
      totals,
      summary: billingSummary({ totals, pendingBilling, billing }),
      supportBoundary: billingSupportBoundary(wallet, commercial),
      breakdown: billingBreakdown(totals, billing),
      filter: {
        range: rangeKey,
        from: normalizedFrom,
        to: normalizedTo,
      },
      todayCost: todayCostFrom(filteredItems),
      performance: timing.done(),
    };
  }

  async function buildBillingDetailsPayload(db, user, options = {}) {
    const timing = createPayloadTimingRecorder();
    const full = await buildBillingPayload(db, user, options);
    timing.mark("fullBilling");
    return {
      taskCosts: full.taskCosts,
      taskPagination: full.taskPagination,
      runCosts: full.runCosts,
      runPagination: full.runPagination,
      ledger: full.ledger,
      ledgerPagination: full.ledgerPagination,
      trend: full.trend,
      performance: timing.done(),
    };
  }

  return {
    buildBillingPayload,
    buildBillingDetailsPayload,
    buildBillingSummaryPayload,
  };
}
