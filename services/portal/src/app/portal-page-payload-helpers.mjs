import { createHash } from "node:crypto";

function text(value = "") {
  return String(value ?? "").trim();
}

function publicTaskRef(...values) {
  const source = values.map(text).find(Boolean);
  if (!source) return "";
  return `task_${createHash("sha256").update(source).digest("hex").slice(0, 16)}`;
}

function taskCostSummary(taskSlug, runs, billingItems) {
  const runIds = new Set(runs.filter((run) => run.workspaceId === taskSlug).map((run) => run.runId));
  const related = billingItems.filter((item) => {
    const runId = item?.properties?.["label:run_id"] || item?.properties?.run_id || "";
    return runIds.has(runId);
  });
  return related.reduce((acc, item) => {
    acc.cpuCost += Number(item?.cpuCost || 0);
    acc.gpuCost += Number(item?.gpuCost || 0);
    acc.pvCost += Number(item?.pvCost || 0);
    acc.totalCost += Number(item?.totalCost || 0);
    return acc;
  }, { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 });
}

export function netSpent(entries = []) {
  return Number(entries.reduce((sum, item) => {
    const amount = Math.abs(Number(item.amount || 0));
    if (item.type === "resource_charge" || item.type === "makeup_charge") return sum + amount;
    if (item.type === "refund") return sum - amount;
    return sum;
  }, 0).toFixed(5));
}

export function buildOverviewCollections({ tasks = [], runs = [], options = {}, paginateRows, formatDateTime, isRunTerminal }) {
  const taskTitleMap = new Map(tasks.map((task) => [task.slug, task.title]));
  const taskRows = tasks.map((task) => ({
    slug: task.slug,
    title: task.title,
    status: task.status,
    runCount: runs.filter((run) => run.workspaceId === task.slug).length,
    updatedAt: formatDateTime(task.updatedAt || task.createdAt || ""),
  }));
  const latestRunsAll = runs.map((run) => ({
    taskRef: publicTaskRef(run.traceId, run.sessionId, run.workspaceSessionId, run.runId, run.createdAt),
    workspaceId: run.workspaceId,
    workspaceTitle: taskTitleMap.get(run.workspaceId) || run.workspaceId || "-",
    status: isRunTerminal(run) ? "completed" : (run.status || "running"),
    createdAt: run.createdAt || "",
    displayTime: formatDateTime(run.createdAt || ""),
  }));
  return {
    taskRows,
    latestRunsAll,
    taskPagination: paginateRows(taskRows, options.tasksPage, 5),
    latestRunsPagination: paginateRows(latestRunsAll, options.runsPage, 5),
  };
}

export function buildOverviewKpis({
  commercial,
  wallet,
  todayCost,
  pendingTotal,
  exactTotal,
  historicalCost,
  tasks,
  workspaceCount,
  runs,
  resourceBindingCount,
}) {
  return {
    accountStatus: commercial.accountStatus,
    billingStatus: commercial.billingStatus,
    entitlementStatus: commercial.entitlementStatus,
    balance: Number(wallet.balance || 0),
    activeFreeze: commercial.activeFreeze || 0,
    availableBalance: commercial.availableBalance || 0,
    todayCost: Number(todayCost.toFixed(5)),
    pendingCost: Number(pendingTotal.toFixed(5)),
    exactCost: Number(exactTotal.toFixed(5)),
    historicalCost,
    activeTasks: tasks.filter((item) => item.status === "active").length,
    workspaceCount,
    runCount: runs.length,
    resourceBindingCount,
  };
}

export function buildBillingTotals(filteredItems = []) {
  return filteredItems.reduce((acc, item) => {
    acc.cpuCost += Number(item?.cpuCost || 0);
    acc.gpuCost += Number(item?.gpuCost || 0);
    acc.pvCost += Number(item?.pvCost || 0);
    acc.totalCost += Number(item?.totalCost || 0);
    return acc;
  }, { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 });
}

export function buildBillingTaskCosts({ tasks = [], filteredRuns = [], filteredItems = [] }) {
  return tasks.map((task) => {
    const taskTotals = taskCostSummary(task.slug, filteredRuns, filteredItems);
    return {
      slug: task.slug,
      title: task.title,
      totalCost: Number(taskTotals.totalCost || 0),
      cpuCost: Number(taskTotals.cpuCost || 0),
      gpuCost: Number(taskTotals.gpuCost || 0),
      storageCost: Number(taskTotals.pvCost || 0),
      runCount: filteredRuns.filter((run) => run.workspaceId === task.slug).length,
    };
  }).sort((a, b) => b.totalCost - a.totalCost);
}

export function buildBillingRunCosts({ filteredRuns = [], filteredItems = [], isRunTerminal }) {
  return filteredRuns.map((run) => {
    const related = filteredItems.find((item) => item?.properties?.["label:run_id"] === run.runId || item?.properties?.run_id === run.runId || item?.name?.includes(run.runId));
    const pricingSource = related?.properties?.["label:pricing_source"] || related?.properties?.pricing_source || (related ? "portal_billing_ledger" : "platform_metering_projection");
    return {
      taskRef: publicTaskRef(run.traceId, run.sessionId, run.workspaceSessionId, run.runId, run.createdAt),
      workspaceId: run.workspaceId,
      cpuCost: Number(related?.cpuCost || 0),
      gpuCost: Number(related?.gpuCost || 0),
      storageCost: Number(related?.pvCost || 0),
      totalCost: Number(related?.totalCost || 0),
      startedAt: related?.start || run.createdAt || "",
      endedAt: related?.end || "",
      pricingSource,
      runStatus: run.status || (isRunTerminal(run) ? "completed" : "running"),
    };
  }).sort((a, b) => String(b.endedAt || b.startedAt || "").localeCompare(String(a.endedAt || a.startedAt || "")));
}

export async function sumFileSizes(files = [], stat) {
  return (await Promise.all(files.map((item) => stat(item.fullPath).then((meta) => meta.size).catch(() => 0)))).reduce((sum, item) => sum + item, 0);
}

export async function buildWorkspaceTaskCards({
  pagedTasks = [],
  pathApi,
  listFilesRecursive,
  userRuns = [],
  billingItems = [],
  formatDateTime,
}) {
  return Promise.all(pagedTasks.map(async (task) => {
    const taskFiles = await listFilesRecursive(pathApi.join(task.path, "inputs"));
    const taskOutputs = await listFilesRecursive(pathApi.join(task.path, "outputs"));
    const taskRuns = userRuns.filter((run) => run.workspaceId === task.slug);
    const taskTotals = taskCostSummary(task.slug, userRuns, billingItems);
    return {
      slug: task.slug,
      title: task.title,
      status: task.status,
      inputs: taskFiles.length,
      outputs: taskOutputs.length,
      runs: taskRuns.length,
      totalCost: Number(taskTotals.totalCost || 0),
      updatedAt: formatDateTime(task.updatedAt || task.createdAt || ""),
    };
  }));
}

export function summarizeRunStatus(runs = [], isRunTerminal) {
  return runs.reduce((acc, run) => {
    const key = isRunTerminal(run) ? "completed" : "running";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { running: 0, completed: 0 });
}
