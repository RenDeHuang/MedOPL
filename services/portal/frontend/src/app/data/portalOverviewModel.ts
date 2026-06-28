import { fetchOverview } from "../../api/portal/overview";
import { fetchMyResources } from "../../api/portal/resources";
import { dateText, gb, money, numberValue } from "./portalFormatters";
import { usePortalQuery } from "./portalQuery";
import { firstFileSpace, planSpec } from "./portalResourceModelHelpers";
import { taskStatus } from "./portalTaskStatus";

export async function loadOverviewModel() {
  const [overview, resources] = await Promise.all([fetchOverview(), fetchMyResources()]);
  const activeBinding = resources.items.find((item) => item.status === "active") || null;
  const fileSpace = firstFileSpace(resources);
  const storageCapacityGb = numberValue(fileSpace?.storageCapacityGb);
  const usedGb = Math.min(storageCapacityGb, numberValue(overview.kpis.runCount) * 1.2);
  const availableGb = Math.max(0, storageCapacityGb - usedGb);
  const latestRuns = overview.latestRuns.slice(0, 4);
  const serviceStatus = activeBinding
    ? numberValue(overview.kpis.availableBalance, overview.kpis.balance) <= 0 ? "restricted" : "ready"
    : "unprovisioned";

  return {
    serviceStatus: serviceStatus as "ready" | "restricted" | "unprovisioned" | "degraded",
    planName: overview.selectedServerPlan?.name || "未返回",
    planSpec: planSpec(overview.selectedServerPlan) || activeBinding?.computeResource?.instanceType || "未返回",
    storageUsed: gb(usedGb),
    storageTotal: gb(storageCapacityGb),
    storageAvailable: gb(availableGb),
    storagePercent: storageCapacityGb > 0 ? Math.min(100, Math.round((usedGb / storageCapacityGb) * 100)) : 0,
    balance: money(overview.kpis.balance),
    availableBalance: money(overview.kpis.availableBalance ?? overview.kpis.balance),
    frozenAmount: money(overview.kpis.frozenAmount),
    todayCost: money(overview.kpis.todayCost),
    historicalCost: money(overview.kpis.historicalCost),
    activeTasks: overview.kpis.activeTasks,
    workspaceCount: overview.kpis.workspaceCount,
    runCount: overview.kpis.runCount,
    runtimeDays: activeBinding?.createdAt ? "已开通" : "未开通",
    pricingStatus: "账本核对",
    priceLabel: "按套餐余额和 quota 核对",
    concurrent: overview.commercial.group?.maxConcurrentRuns || "未返回",
    workspaceTitle: overview.taskCards[0]?.title || "当前工作空间",
    inputFiles: overview.taskCards.reduce((sum, task) => sum + numberValue(task.runCount), 0),
    outputFiles: latestRuns.length,
    recentTasks: latestRuns.map((run) => ({
      name: run.workspaceTitle || "任务记录",
      status: taskStatus(run.status),
      time: run.displayTime || dateText(run.createdAt),
      files: run.status === "completed" ? 1 : 0,
    })),
  };
}

export function useOverviewModel() {
  return usePortalQuery(loadOverviewModel, []);
}
