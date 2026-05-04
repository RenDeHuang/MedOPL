function chartDateKey(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function seriesForRecentDays(days) {
  const labels = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    labels.push(d.toISOString().slice(0, 10));
  }
  return labels;
}

import {
  buildBillingRunCosts,
  buildBillingTaskCosts,
  buildBillingTotals,
  buildOverviewCollections,
  buildOverviewKpis,
  buildWorkspaceTaskCards,
  netSpent,
  sumFileSizes,
  summarizeRunStatus,
} from "./portal-page-payload-helpers.mjs";
import { resolveSupportBoundary } from "../domain/support-boundaries.mjs";

export function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizePageSize(value) {
  const parsed = parsePositiveInt(value, 5);
  return [5, 10, 20].includes(parsed) ? parsed : 5;
}

export function paginateRows(rows = [], pageValue = 1, pageSizeValue = 5) {
  const total = rows.length;
  const pageSize = normalizePageSize(pageSizeValue);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(parsePositiveInt(pageValue, 1), 1), totalPages);
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}

export function rangeBounds(rangeKey = "today", fromValue = "", toValue = "") {
  const now = new Date();
  if (rangeKey === "custom") {
    const from = new Date(String(fromValue || ""));
    const to = new Date(String(toValue || ""));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { start: null, end: null };
    to.setHours(23, 59, 59, 999);
    return { start: from, end: to };
  }
  if (rangeKey === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  if (rangeKey === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

export function withinDateRange(value, range) {
  if (!range?.start || !range?.end) return true;
  const ts = Date.parse(String(value || ""));
  if (!Number.isFinite(ts)) return false;
  return ts >= range.start.getTime() && ts <= range.end.getTime();
}

export function groupBillingByDay(items = [], days = 7) {
  const labels = seriesForRecentDays(days);
  const base = Object.fromEntries(labels.map((label) => [label, { total: 0, cpu: 0, gpu: 0, storage: 0 }]));
  for (const item of items) {
    const key = chartDateKey(item?.end || item?.start || item?.createdAt);
    if (!base[key]) continue;
    base[key].total += Number(item?.totalCost || 0);
    base[key].cpu += Number(item?.cpuCost || 0);
    base[key].gpu += Number(item?.gpuCost || 0);
    base[key].storage += Number(item?.pvCost || 0);
  }
  return {
    labels,
    total: labels.map((label) => Number(base[label].total.toFixed(5))),
    cpu: labels.map((label) => Number(base[label].cpu.toFixed(5))),
    gpu: labels.map((label) => Number(base[label].gpu.toFixed(5))),
    storage: labels.map((label) => Number(base[label].storage.toFixed(5))),
  };
}

export function createPortalPagePayloads(deps) {
  const {
    buildCommercialProfile,
    buildOverviewOnboarding,
    buildServerPlansFallback,
    buildServerPlansSummary,
    collectRunsForUser,
    currentServerPlanSelection,
    currentTaskSpaceForUser,
    defaultTaskTitle,
    ensureTaskSpace,
    ensureWallet,
    evaluateUserPolicy,
    fetchBillingSummary,
    fetchPendingSummary,
    fetchServerPlans,
    findTaskSpace,
    formatDateOnly,
    formatDateTime,
    isRunTerminal,
    latestActiveWorkspaceSession,
    listFilesRecursive,
    listTaskSpacesForUser,
    mkdir,
    path,
    readPortalEvents,
    resourceOrderPublicView,
    resourceOrdersForUser,
    sanitizeTaskTitle,
    stat,
    workspaceStorageEntitlement,
  } = deps;

  async function buildOverviewPayload(db, user, options = {}) {
    const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
    const tasks = listTaskSpacesForUser(db, user.id);
    const currentTask = currentTaskSpaceForUser(db, user) || tasks[0] || null;
    const runs = await collectRunsForUser(user.id);
    const policy = await evaluateUserPolicy(db, user);
    const commercial = buildCommercialProfile(db, user, { wallet, policy });
    const serverPlans = await fetchServerPlans() || buildServerPlansFallback();
    const serverPlansSummary = buildServerPlansSummary(serverPlans);
    const billing = await fetchBillingSummary(user.id, "", "168h");
    const pendingBilling = await fetchPendingSummary(user.id, "", "168h");
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
    };
  }

  async function buildBillingPayload(db, user, options = {}) {
    const wallet = ensureWallet(db, user.id);
    const commercial = buildCommercialProfile(db, user, { wallet });
    const pageSize = normalizePageSize(options.pageSize);
    const fromValue = String(options.from || "").trim();
    const toValue = String(options.to || "").trim();
    const rangeKey = fromValue || toValue ? "custom" : "30d";
    const fallbackStart = new Date();
    fallbackStart.setDate(fallbackStart.getDate() - 29);
    const normalizedFrom = fromValue || formatDateOnly(fallbackStart);
    const normalizedTo = toValue || formatDateOnly(new Date());
    const range = rangeBounds(rangeKey, normalizedFrom, normalizedTo);
    const billing = await fetchBillingSummary(user.id, "", "720h");
    const pendingBilling = await fetchPendingSummary(user.id, "", "168h");
    const items = billing?.items || [];
    const runs = await collectRunsForUser(user.id);
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
    const supportBoundary = resolveSupportBoundary({
      wallet,
      freeze: { activeFreeze: commercial.activeFreeze || 0 },
      minRequiredBalance: Math.max(1, Number(commercial.balanceFloor || 0)),
      run: allRunCosts.find((run) => ["failed", "error"].includes(String(run.runStatus || "").toLowerCase())) || {},
    });
    return {
      wallet: {
        balance: Number(wallet.balance || 0),
        activeFreeze: commercial.activeFreeze || 0,
        availableBalance: commercial.availableBalance || 0,
        trialRemaining: commercial.trialRemaining || 0,
      },
      totals,
      summary: {
        selectedCost: Number(totals.totalCost.toFixed(5)),
        runCount: filteredRuns.length,
        workspaceCount: taskCostsAll.filter((item) => item.runCount > 0 || item.totalCost > 0).length,
        pendingCost: Number((Number(pendingBilling?.totals?.totalCost || pendingBilling?.totalCost || 0)).toFixed(5)),
        exactCost: Number((Number(billing?.totals?.totalCost || billing?.totalCost || totals.totalCost || 0)).toFixed(5)),
      },
      supportBoundary,
      breakdown: {
        cpuCost: Number(totals.cpuCost.toFixed(5)),
        gpuCost: Number(totals.gpuCost.toFixed(5)),
        storageCost: Number(totals.pvCost.toFixed(5)),
        vpnCost: 0,
        trafficCost: 0,
        otherCloudCost: 0,
        cloudSource: billing?.cloudSource || billing?.source || "not_connected",
        pricingSource: billing?.source || "unavailable",
      },
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
      todayCost: Number(filteredItems
        .filter((item) => withinDateRange(item?.end || item?.start || item?.createdAt, rangeBounds("today")))
        .reduce((sum, item) => sum + Number(item?.totalCost || 0), 0)
        .toFixed(5)),
    };
  }

  async function buildWorkspacePayload(db, user, taskSlug, options = {}) {
    const currentTask = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    const current = {
      ...currentTask,
      title: sanitizeTaskTitle(currentTask.slug || "default", currentTask.title || ""),
    };
    const allTasks = listTaskSpacesForUser(db, user.id);
    const inputDir = path.join(current.path, "inputs");
    const outputDir = path.join(current.path, "outputs");
    await mkdir(inputDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    const files = await listFilesRecursive(inputDir);
    const outputs = await listFilesRecursive(outputDir);
    const userRuns = await collectRunsForUser(user.id);
    const runs = userRuns.filter((item) => item.workspaceId === current.slug);
    const billing = await fetchBillingSummary(user.id, current.slug, "168h");
    const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
    const events = (await readPortalEvents(200)).filter((event) => event.userId === user.id && (!event.workspaceId || event.workspaceId === current.slug));
    const activeSession = latestActiveWorkspaceSession(db, user.id, current.slug);
    const storageEntitlement = workspaceStorageEntitlement(db, user, current.slug);
    const runPagination = paginateRows(runs, options.runsPage, 5);
    const filePagination = paginateRows(files, options.inputsPage, 5);
    const outputPagination = paginateRows(outputs, options.outputsPage, 5);
    const taskPagination = paginateRows(allTasks, options.tasksPage, 5);
    const billingAll = await fetchBillingSummary(user.id, "", "168h");
    const pagedTasks = taskPagination.rows;
    const taskCards = await buildWorkspaceTaskCards({
      pagedTasks,
      pathApi: path,
      listFilesRecursive,
      userRuns,
      billingItems: billingAll?.items || [],
      formatDateTime,
    });
    return {
      workspace: {
        slug: current.slug,
        title: current.title,
        status: current.status,
        serverPlan: currentServerPlanSelection(current),
        storageEntitlement,
        createdAt: current.createdAt || null,
        archivedAt: current.archivedAt || null,
        deletedAt: current.deletedAt || null,
      },
      counts: {
        inputs: files.length,
        outputs: outputs.length,
        runs: runs.length,
        completedRuns: runs.filter((run) => isRunTerminal(run)).length,
      },
      costs: totals,
      storageEntitlement,
      runStatus: summarizeRunStatus(runs, isRunTerminal),
      activeSession: activeSession ? {
        id: activeSession.id,
        createdAt: activeSession.createdAt || null,
        lastUsedAt: activeSession.lastUsedAt || null,
        expiresAt: activeSession.expiresAt || null,
      } : null,
      recentRuns: runPagination.rows.map((run) => ({
        runId: run.runId,
        status: isRunTerminal(run) ? "completed" : (run.status || "running"),
        createdAt: formatDateTime(run.createdAt || ""),
      })),
      eventTimeline: events.slice(0, 16).map((event) => ({
        type: event.type,
        occurredAt: event.occurredAt,
        workspaceId: event.workspaceId || current.slug,
      })),
      distribution: {
        inputBytes: await sumFileSizes(files, stat),
        outputBytes: await sumFileSizes(outputs, stat),
      },
      tasks: taskCards,
      tasksPageRows: taskCards,
      tasksPagination: {
        page: taskPagination.page,
        pageSize: taskPagination.pageSize,
        total: taskPagination.total,
        totalPages: taskPagination.totalPages,
      },
      taskTreemap: taskCards.map((task) => ({
        name: task.title,
        value: Number((task.totalCost || 0) + task.inputs + task.outputs + task.runs) || 0.001,
        task,
      })),
      files: filePagination.rows,
      filesPagination: {
        page: filePagination.page,
        pageSize: filePagination.pageSize,
        total: filePagination.total,
        totalPages: filePagination.totalPages,
      },
      outputs: outputPagination.rows,
      outputsPagination: {
        page: outputPagination.page,
        pageSize: outputPagination.pageSize,
        total: outputPagination.total,
        totalPages: outputPagination.totalPages,
      },
      runsPagination: {
        page: runPagination.page,
        pageSize: runPagination.pageSize,
        total: runPagination.total,
        totalPages: runPagination.totalPages,
      },
    };
  }

  return {
    buildBillingPayload,
    buildOverviewPayload,
    buildWorkspacePayload,
  };
}
