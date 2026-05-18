import { useEffect, useState } from "react";
import { fetchBillingDetails, fetchBillingSummary } from "../../api/portal/billing";
import { fetchOverview } from "../../api/portal/overview";
import { bindOplSession, createOplLaunch, fetchOplBootstrap } from "../../api/portal/opl";
import { fetchMyResources, fetchOplLaunchStatus } from "../../api/portal/resources";
import { fetchSessionTraces } from "../../api/portal/traces";
import { fetchWorkspace } from "../../api/portal/workspace";
import type { CustomerStorageResource, PlatformProvisionedResourcesPayload } from "../../api/portal/resources";
import type { SelectedServerPlan } from "../../api/portal/types";

export type QueryState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

const PORTAL_DATA_UNAVAILABLE_MESSAGE = "Portal 数据暂时不可用，请稍后重试。";
const OPL_GATEWAY_UNAVAILABLE_MESSAGE = "OPL 网关暂不可用，请稍后重试；如持续失败，请联系管理员。";

class PortalDisplayError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string) {
    super(userMessage);
    this.name = "PortalDisplayError";
    this.userMessage = userMessage;
  }
}

function portalDisplayMessage(error: unknown) {
  if (error instanceof PortalDisplayError) return error.userMessage;
  return PORTAL_DATA_UNAVAILABLE_MESSAGE;
}

export function usePortalQuery<T>(loader: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ status: "loading", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });
    loader()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", data: null, error: portalDisplayMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, deps);

  return state;
}

export interface FileItem {
  name: string;
  size: string;
  type: string;
  updated: string;
  taskId?: string;
  taskName?: string;
}

export interface TaskItem {
  id: string;
  name: string;
  workspace: string;
  status: "running" | "completed" | "failed" | "waiting";
  startTime: string;
  duration: string;
  cost: string;
  outputFiles: number;
  outputFileNames?: string[];
  resourceUsage: string;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: unknown) {
  return `¥ ${numberValue(value).toFixed(2)}`;
}

function gb(value: unknown) {
  return `${numberValue(value).toFixed(1)} GB`;
}

function bytesToSize(value: unknown) {
  const bytes = numberValue(value);
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function dateText(value: unknown) {
  return typeof value === "string" && value ? value.replace("T", " ").slice(0, 16) : "未返回";
}

function fileType(name: string) {
  const ext = name.split(".").pop();
  return ext ? ext.toLowerCase() : "file";
}

function taskStatus(status: string): TaskItem["status"] {
  if (["completed", "success", "succeeded", "done"].includes(status)) return "completed";
  if (["running", "active", "processing"].includes(status)) return "running";
  if (["failed", "error"].includes(status)) return "failed";
  return "waiting";
}

function firstStorage(resources: PlatformProvisionedResourcesPayload): CustomerStorageResource | null {
  return resources.items.find((item) => item.storageBucket)?.storageBucket || resources.storageBuckets[0] || null;
}

function planSpec(plan: SelectedServerPlan | null | undefined) {
  if (!plan) return "";
  if (plan.cpu && plan.memoryGb) return `${plan.cpu} 核 ${plan.memoryGb} GB`;
  return plan.instanceType || "";
}

export async function loadOverviewModel() {
  const [overview, resources] = await Promise.all([fetchOverview(), fetchMyResources()]);
  const activeBinding = resources.items.find((item) => item.status === "active") || null;
  const storage = firstStorage(resources);
  const storageCapacityGb = numberValue(storage?.storageCapacityGb);
  const usedGb = Math.min(storageCapacityGb, numberValue(overview.kpis.runCount) * 1.2);
  const latestRuns = overview.latestRuns.slice(0, 4);
  const serviceStatus = activeBinding
    ? numberValue(overview.kpis.availableBalance, overview.kpis.balance) <= 0 ? "restricted" : "ready"
    : "unprovisioned";

  return {
    serviceStatus: serviceStatus as "ready" | "restricted" | "unprovisioned" | "degraded",
    planName: overview.selectedServerPlan?.name || activeBinding?.serverPlanId || "未返回",
    planSpec: planSpec(overview.selectedServerPlan) || activeBinding?.computeInstance?.instanceType || "未返回",
    storageUsed: gb(usedGb),
    storageTotal: gb(storageCapacityGb),
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
    pricePerHour: money(overview.selectedServerPlan?.hourlyPrice ?? 0),
    pricePerDay: money(numberValue(overview.selectedServerPlan?.hourlyPrice) * 24),
    concurrent: overview.commercial.group?.maxConcurrentRuns || "未返回",
    workspaceTitle: overview.taskCards[0]?.title || "当前工作空间",
    inputFiles: overview.taskCards.reduce((sum, task) => sum + numberValue(task.runCount), 0),
    outputFiles: latestRuns.length,
    recentTasks: latestRuns.map((run) => ({
      name: run.workspaceTitle || run.runId,
      status: taskStatus(run.status),
      time: run.displayTime || dateText(run.createdAt),
      files: run.status === "completed" ? 1 : 0,
    })),
  };
}

export async function loadRuntimeEnvironmentModel() {
  const resources = await fetchMyResources();
  const activeBinding = resources.items.find((item) => item.status === "active") || null;
  const storage = firstStorage(resources);
  const storageCapacityGb = numberValue(storage?.storageCapacityGb);
  const protection = activeBinding?.protection || resources.protectionFreezes[0] || null;
  return {
    serviceStatus: activeBinding ? "active" : "not_activated",
    currentPlanName: activeBinding?.serverPlanId || "已开通套餐",
    computeSpec: activeBinding?.computeInstance?.instanceType || "未返回",
    storageTotal: gb(storageCapacityGb),
    storageUsed: gb(Math.min(storageCapacityGb, numberValue(protection?.consumedAmount))),
    storageAvailable: gb(Math.max(0, storageCapacityGb - numberValue(protection?.consumedAmount))),
    storagePercent: storageCapacityGb > 0 ? Math.min(100, Math.round((numberValue(protection?.consumedAmount) / storageCapacityGb) * 100)) : 0,
    frozenAmount: money(protection?.frozenAmount),
    billingStatus: protection?.status || activeBinding?.status || "未返回",
  } as const;
}

export async function loadWorkspaceModel() {
  const workspace = await fetchWorkspace();
  const files = workspace.files.map<FileItem>((file) => ({
    name: file.name,
    size: "Portal 文件",
    type: fileType(file.name),
    updated: workspace.workspace.createdAt ? dateText(workspace.workspace.createdAt) : "未返回",
  }));
  const outputs = workspace.outputs.map<FileItem>((file) => ({
    name: file.name,
    size: bytesToSize(file.sizeBytes),
    type: fileType(file.name),
    updated: dateText(file.updatedAt || file.createdAt),
    taskId: file.runId,
    taskName: file.sessionId || file.runId,
  }));
  const usedGb = numberValue(workspace.fileSpace?.usedGb);
  const capacityGb = numberValue(workspace.fileSpace?.capacityGb);
  return {
    pageState: workspace.workspace.archivedAt ? "archived" : workspace.fileSpace ? "ready" : "file-space-unavailable",
    workspaceTitle: workspace.workspace.title,
    createdAt: dateText(workspace.workspace.createdAt),
    status: workspace.workspace.status,
    fileSpaceUsed: gb(usedGb),
    fileSpaceTotal: gb(capacityGb),
    fileSpaceAvailable: gb(Math.max(0, capacityGb - usedGb)),
    fileSpacePercent: capacityGb > 0 ? Math.min(100, Math.round((usedGb / capacityGb) * 100)) : 0,
    inputFiles: files,
    outputFiles: outputs,
    inputsCount: workspace.counts.inputs,
    outputsCount: workspace.counts.outputs,
  } as const;
}

export async function loadTasksResultsModel() {
  const traces = await fetchSessionTraces();
  return {
    tasks: traces.items.map<TaskItem>((item) => ({
      id: item.runId || item.traceId,
      name: item.title || item.traceName || item.inputPreview || item.traceId,
      workspace: item.workspaceId,
      status: taskStatus(item.businessStatus || item.status),
      startTime: dateText(item.startedAt),
      duration: item.latencyMs ? `${Math.round(item.latencyMs / 1000)} 秒` : "未返回",
      cost: money(item.costEstimate?.amount ?? item.billing?.exactCost ?? item.billing?.pendingCost),
      outputFiles: item.linkedOutputFiles?.length || item.outputFiles?.length || item.files?.linkedOutputCount || 0,
      outputFileNames: (item.linkedOutputFiles || item.outputFiles || []).map((file) => file.name),
      resourceUsage: item.serverPlanId || item.resourceUsage?.status || "Portal trace",
    })),
  };
}

export async function loadBillingAuditModel() {
  const [summary, details] = await Promise.all([fetchBillingSummary(), fetchBillingDetails()]);
  return {
    balance: money(summary.wallet.balance),
    availableBalance: money(summary.wallet.availableBalance ?? summary.wallet.balance),
    frozenAmount: money(summary.wallet.activeFreeze ?? summary.wallet.frozen),
    todayCost: money(summary.todayCost),
    totalCost: money(summary.totals.totalCost),
    pendingCost: money(summary.summary.pendingCost),
    exactCost: money(summary.summary.exactCost),
    computeCost: money(summary.breakdown.cpuCost + summary.breakdown.gpuCost),
    storageCost: money(summary.breakdown.storageCost),
    supportBoundary: summary.supportBoundary,
    workspaceCosts: details.taskCosts.map((item) => ({
      workspace: item.title,
      tasks: item.runCount,
      compute: item.cpuCost + item.gpuCost,
      storage: item.storageCost,
      total: item.totalCost,
    })),
    taskCosts: details.runCosts.map((item) => ({
      id: item.runId,
      name: item.workspaceId,
      workspace: item.workspaceId,
      cost: item.totalCost,
      time: item.endedAt ? `${dateText(item.startedAt)} - ${dateText(item.endedAt)}` : dateText(item.startedAt),
      status: item.runStatus,
    })),
    billingRecords: details.ledger.map((item) => ({
      id: item.id || item.createdAt,
      date: dateText(item.createdAt),
      type: item.type,
      description: item.reason || item.type,
      amount: money(item.amount),
      status: "已核对",
    })),
  };
}

export async function loadOplEntryModel() {
  try {
    const params = new URLSearchParams(window.location.search);
    const existingLaunchId = params.get("launchId");
    const launch = existingLaunchId
      ? { launchId: existingLaunchId, openUrl: "", oplWebUrl: "", launchStatus: "preparing", ok: true, workspaceId: "", providerBound: false, providerKeyRef: "" }
      : await createOplLaunch({});
    const [status, bootstrap] = await Promise.all([
      fetchOplLaunchStatus(launch.launchId),
      fetchOplBootstrap(launch.launchId),
    ]);
    await bindOplSession({
      launchId: launch.launchId,
      oplSessionId: bootstrap.identity.oplSessionId,
      clientSessionState: { source: "figma_make_zip_portal_ui" },
    });
    return {
      launchId: launch.launchId,
      pageState: status.status === "ready" ? "ready" : status.status === "failed" ? "failed" : "preparing",
      userVisibleState: status.userVisibleState,
      oplWebUrl: status.oplWebUrl || launch.oplWebUrl || launch.openUrl,
      stages: status.stages,
    } as const;
  } catch {
    throw new PortalDisplayError(OPL_GATEWAY_UNAVAILABLE_MESSAGE);
  }
}
