import { useEffect, useState } from "react";
import {
  fetchAdminAlerts,
  fetchAdminAudit,
  fetchAdminBillingOps,
  fetchAdminOps,
  fetchAdminOverview,
  fetchAdminSystem,
  fetchAdminUsers,
} from "../../api/portal/admin";
import { fetchBillingDetails, fetchBillingSummary } from "../../api/portal/billing";
import { fetchCurrentUser } from "../../api/portal/commercial";
import { fetchOverview } from "../../api/portal/overview";
import { bindOplSession, createOplLaunch, fetchOplBootstrap } from "../../api/portal/opl";
import { fetchMyResources, fetchOplLaunchStatus } from "../../api/portal/resources";
import { fetchAnnouncements } from "../../api/portal/sessions";
import { fetchSessionTraces } from "../../api/portal/traces";
import {
  createWorkspaceFileDownloadUrl,
  createWorkspaceFileUploadUrl,
  fetchStorageEntitlement,
  fetchWorkspace,
  fetchWorkspaceStorage,
} from "../../api/portal/workspace";
import type { ManagedFileSpaceResource, PlatformProvisionedResourcesPayload } from "../../api/portal/resources";
import type { SelectedServerPlan } from "../../api/portal/types";

export type QueryState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

const PORTAL_DATA_UNAVAILABLE_MESSAGE = "Portal 数据暂时不可用，请稍后重试。";
const OPL_GATEWAY_UNAVAILABLE_MESSAGE = "OPL 网关暂不可用，请稍后重试；如持续失败，请联系管理员。";
export const adminLocalActionMessage = "已接入本地 Portal 用户启停、删除、充值、退款和公告管理动作。";
export const adminReadOnlyMessage = "该管理面当前只展示已接入的只读数据；真实云资源、真实扣费或高风险设置仍需单独授权接口。";

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
  id: string;
  name: string;
  size: string;
  type: string;
  updated: string;
  kind: "inputs" | "outputs";
  relativePath: string;
  canDownload: boolean;
  downloadUnavailableReason?: string;
  taskId?: string;
  taskName?: string;
  fileRef?: string;
  sessionId?: string;
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

function stringValue(value: unknown, fallback = "未返回") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function keyPart(value: unknown, fallback = "none") {
  if (typeof value === "string" && value.trim()) return value.trim().replace(/[^a-zA-Z0-9._:-]+/g, "_");
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return fallback;
}

function arrayValue<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function downloadTargetUrl(url: string) {
  return url.startsWith("/") ? url : "/";
}

function fileType(name: string) {
  const ext = name.split(".").pop();
  return ext ? ext.toLowerCase() : "file";
}

function relativePathFromFile(value: { name?: string; fullPath?: string; relativePath?: string }) {
  return stringValue(value.relativePath || value.fullPath || value.name, "");
}

function latestEventText(events: Array<{ occurredAt?: string }>) {
  const latest = events
    .map((event) => stringValue(event.occurredAt, ""))
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0];
  return latest ? dateText(latest) : "未返回";
}

function taskStatus(status: string): TaskItem["status"] {
  if (["completed", "success", "succeeded", "done"].includes(status)) return "completed";
  if (["running", "active", "processing"].includes(status)) return "running";
  if (["failed", "error"].includes(status)) return "failed";
  return "waiting";
}

function firstFileSpace(resources: PlatformProvisionedResourcesPayload): ManagedFileSpaceResource | null {
  return resources.items.find((item) => item.fileSpace)?.fileSpace || resources.fileSpaces[0] || null;
}

function planSpec(plan: SelectedServerPlan | null | undefined) {
  if (!plan) return "";
  if (plan.cpu && plan.memoryGb) return `${plan.cpu} 核 ${plan.memoryGb} GB`;
  return plan.instanceType || "";
}

export async function loadOverviewModel() {
  const [overview, resources] = await Promise.all([fetchOverview(), fetchMyResources()]);
  const activeBinding = resources.items.find((item) => item.status === "active") || null;
  const fileSpace = firstFileSpace(resources);
  const storageCapacityGb = numberValue(fileSpace?.storageCapacityGb);
  const usedGb = Math.min(storageCapacityGb, numberValue(overview.kpis.runCount) * 1.2);
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
    pricingStatus: "价格待审批",
    priceLabel: "正式售价未定价",
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

export async function loadRuntimeEnvironmentModel() {
  const resources = await fetchMyResources();
  const activeBinding = resources.items.find((item) => item.status === "active") || null;
  const fileSpace = firstFileSpace(resources);
  const storageCapacityGb = numberValue(fileSpace?.storageCapacityGb);
  const protection = activeBinding?.protection || resources.protections[0] || null;
  return {
    serviceStatus: activeBinding ? "active" : "not_activated",
    workspaceId: activeBinding?.workspaceId || "",
    currentPlanName: "已开通托管套餐",
    computeSpec: activeBinding?.computeResource?.instanceType || "未返回",
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
  const workspaceId = workspace.workspace.slug;
  const sessionId = workspace.activeSession?.id || workspace.outputs.find((file) => file.sessionId)?.sessionId || "";
  const storageParams = {
    workspaceId,
    ...(sessionId ? { oplSessionId: sessionId } : {}),
  };
  const [storageProjection, entitlementProjection] = await Promise.all([
    fetchWorkspaceStorage(storageParams),
    fetchStorageEntitlement({ workspaceId }),
  ]);
  const entitlement = entitlementProjection.entitlement || storageProjection.entitlement || workspace.storageEntitlement;
  const metadataByRelativePath = new Map(
    arrayValue<NonNullable<typeof storageProjection.metadata>[number]>(storageProjection.metadata)
      .map((item) => [item.relativePath, item] as const),
  );
  const fileSpaceFiles = arrayValue(workspace.fileSpace?.files);
  const fileSpaceByRef = new Map(fileSpaceFiles.map((file) => [file.fileRef, file] as const));
  const canUseTransferActions = Boolean(entitlement?.enabled && sessionId);
  const downloadUnavailableReason = canUseTransferActions
    ? ""
    : !entitlement?.enabled
      ? "文件空间未开通"
      : !sessionId
        ? "当前没有可用 OPL 会话"
        : "托管运行环境未绑定";
  const files = workspace.files.map<FileItem>((file) => {
    const relativePath = relativePathFromFile(file);
    const metadata = metadataByRelativePath.get(relativePath);
    const fileSpaceFile = metadata?.fileRef ? fileSpaceByRef.get(metadata.fileRef) : undefined;
    return {
      id: metadata?.fileRef || relativePath || file.name,
      name: file.name,
      size: metadata ? bytesToSize(metadata.sizeBytes) : "Portal 文件",
      type: fileType(file.name),
      updated: dateText(metadata?.updatedAt || metadata?.createdAt || workspace.workspace.createdAt),
      kind: "inputs",
      relativePath,
      canDownload: Boolean(canUseTransferActions && relativePath),
      downloadUnavailableReason,
      fileRef: metadata?.fileRef || fileSpaceFile?.fileRef,
      sessionId,
    };
  });
  const outputs = workspace.outputs.map<FileItem>((file) => {
    const relativePath = relativePathFromFile(file);
    const metadata = metadataByRelativePath.get(relativePath);
    const fileSpaceFile = file.fileRef ? fileSpaceByRef.get(file.fileRef) : undefined;
    const outputSessionId = file.sessionId || fileSpaceFile?.sessionId || sessionId;
    return {
      id: file.fileRef || metadata?.fileRef || file.artifactRef || relativePath || file.name,
      name: file.name,
      size: bytesToSize(file.sizeBytes ?? metadata?.sizeBytes ?? fileSpaceFile?.sizeBytes),
      type: fileType(file.name),
      updated: dateText(file.updatedAt || file.createdAt || metadata?.updatedAt || fileSpaceFile?.retentionUntil),
      kind: "outputs",
      relativePath,
      canDownload: Boolean(entitlement?.enabled && outputSessionId && relativePath),
      downloadUnavailableReason: entitlement?.enabled
        ? outputSessionId ? "" : "当前结果缺少 OPL 会话"
        : "文件空间未开通",
      taskId: file.taskRef,
      taskName: file.sessionId || "会话输出",
      fileRef: file.fileRef || metadata?.fileRef || fileSpaceFile?.fileRef,
      sessionId: outputSessionId,
    };
  });
  const storageBytes = numberValue(storageProjection.storage.inputBytes) + numberValue(storageProjection.storage.outputBytes);
  const usedGb = Math.max(numberValue(workspace.fileSpace?.usedGb), storageBytes / 1024 ** 3);
  const capacityGb = numberValue(entitlement?.storageSizeGb, numberValue(workspace.fileSpace?.capacityGb));
  const pageState = workspace.workspace.archivedAt
    ? "archived"
    : !workspace.fileSpace || !entitlement?.enabled
      ? "file-space-unavailable"
      : files.length === 0
        ? "empty-inputs"
        : outputs.length === 0
          ? "empty-outputs"
          : "ready";

  async function createUploadIntent(fileName: string) {
    const cleanName = stringValue(fileName, "portal-upload-placeholder.txt");
    const transfer = await createWorkspaceFileUploadUrl({
      workspaceId,
      fileName: cleanName,
      relativePath: cleanName,
      kind: "inputs",
      ...(sessionId ? { oplSessionId: sessionId } : {}),
    });
    return {
      url: downloadTargetUrl(transfer.url),
      method: transfer.method,
      expiresAt: transfer.expiresAt,
      fileName: transfer.file.name,
    };
  }

  async function createDownloadIntent(file: FileItem) {
    const transfer = await createWorkspaceFileDownloadUrl({
      workspaceId,
      kind: file.kind,
      file: file.relativePath || file.name,
      relativePath: file.relativePath || file.name,
      ...(file.sessionId ? { oplSessionId: file.sessionId } : sessionId ? { oplSessionId: sessionId } : {}),
    });
    return {
      url: downloadTargetUrl(transfer.url),
      method: transfer.method,
      expiresAt: transfer.expiresAt,
      fileName: transfer.file.name,
    };
  }

  return {
    pageState,
    workspaceTitle: workspace.workspace.title,
    createdAt: dateText(workspace.workspace.createdAt),
    status: workspace.workspace.status,
    latestBackflow: latestEventText(workspace.eventTimeline),
    fileSpaceUsed: gb(usedGb),
    fileSpaceTotal: gb(capacityGb),
    fileSpaceAvailable: gb(Math.max(0, capacityGb - usedGb)),
    fileSpacePercent: capacityGb > 0 ? Math.min(100, Math.round((usedGb / capacityGb) * 100)) : 0,
    fileSpaceActionMessage: downloadUnavailableReason,
    uploadEnabled: Boolean(canUseTransferActions),
    inputFiles: files,
    outputFiles: outputs,
    inputsCount: storageProjection.storage.inputsCount || workspace.counts.inputs,
    outputsCount: storageProjection.storage.outputsCount || workspace.counts.outputs,
    createUploadIntent,
    createDownloadIntent,
  } as const;
}

export async function loadTasksResultsModel() {
  const traces = await fetchSessionTraces();
  return {
    tasks: traces.items.map<TaskItem>((item) => ({
      id: item.taskRef || item.traceId,
      name: item.title || item.traceName || item.inputPreview || "任务记录",
      workspace: item.workspaceId,
      status: taskStatus(item.businessStatus || item.status),
      startTime: dateText(item.startedAt),
      duration: item.latencyMs ? `${Math.round(item.latencyMs / 1000)} 秒` : "未返回",
      cost: money(item.costEstimate?.amount ?? item.billing?.exactCost ?? item.billing?.pendingCost),
      outputFiles: item.linkedOutputFiles?.length || item.outputFiles?.length || item.files?.linkedOutputCount || 0,
      outputFileNames: (item.linkedOutputFiles || item.outputFiles || []).map((file) => file.name),
      resourceUsage: item.resourceUsage?.status || "运行记录",
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
      id: item.taskRef,
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

export async function loadCurrentUserModel() {
  const user = await fetchCurrentUser();
  return {
    userName: user.name || user.email || "MedOPL 用户",
    userEmail: user.email || "",
    status: user.status === "disabled" ? "disabled" : user.status === "restricted" ? "restricted" : "active",
    initials: (user.initials || user.name || user.email || "用户").slice(0, 2),
  } as const;
}

export async function loadAnnouncementModel() {
  const announcements = await fetchAnnouncements();
  return {
    announcements: announcements.items.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      isPinned: Boolean(item.pinned),
      createdAt: dateText(item.createdAt),
      updatedAt: dateText(item.updatedAt),
    })),
  };
}

function adminAlertSeverity(severity: unknown): "error" | "warning" | "info" {
  const value = String(severity || "").toLowerCase();
  if (["danger", "error", "critical", "failed"].includes(value)) return "error";
  if (["warning", "warn", "pending"].includes(value)) return "warning";
  return "info";
}

function adminUserStatus(status: unknown): "active" | "restricted" | "disabled" {
  const value = String(status || "").toLowerCase();
  if (["active", "ok", "success", "operational", "connected", "ready"].includes(value)) return "active";
  if (["disabled", "deleted", "blocked", "failed", "down"].includes(value)) return "disabled";
  return "restricted";
}

function adminBillingType(row: Record<string, any>): "pending" | "anomaly" | "refund" {
  if (row.type === "refund") return "refund";
  if (row.severity) return "anomaly";
  return "pending";
}

function adminBillingStatus(status: unknown): "pending" | "approved" | "rejected" {
  const value = String(status || "").toLowerCase();
  if (value === "approved") return "approved";
  if (value === "rejected") return "rejected";
  return "pending";
}

function adminAuditStatus(type: unknown): "success" | "failed" | "warning" {
  const value = String(type || "");
  if (/fail|error|denied|blocked/i.test(value)) return "failed";
  if (/warning|pending/i.test(value)) return "warning";
  return "success";
}

function billingRowKey(source: string, row: Record<string, any>, index: number) {
  const type = adminBillingType(row);
  const event = keyPart(row.status || row.type || row.reason || row.title || row.detail, type);
  const primary = keyPart(row.runId || row.userId || row.workspaceId || row.createdAt || row.occurredAt || row.completedAt, "no-primary");
  return `billing:${source}:${type}:${event}:${primary}:${index}`;
}

function auditRowKey(row: Record<string, any>, index: number) {
  const type = stringValue(row.type, "audit");
  const detail = keyPart(row.detail || row.operation || row.action || row.type, type);
  const primary = keyPart(row.id || row.userId || row.operatorId || row.workspaceId || row.occurredAt, "no-primary");
  return `audit:items:${type}:${detail}:${primary}:${index}`;
}

function alertRowKey(row: Record<string, any>) {
  const type = stringValue(row.category || row.severity, "alert");
  const detail = keyPart(row.title || row.detail || row.message || row.category, type);
  const primary = keyPart(row.id || row.runId || row.userId || row.workspaceId || row.occurredAt || row.createdAt, "no-primary");
  const action = keyPart(row.action, "no-action");
  return `alert:items:${type}:${detail}:${primary}:${action}`;
}

function adminServiceRowKey(source: string, row: Record<string, any>, index: number) {
  const identity = keyPart(row.id || row.key || row.name || row.title || row.category || row.url, "service");
  const status = keyPart(row.status || row.mode || row.ok, "unknown");
  return `admin-service:${source}:${identity}:${status}:${index}`;
}

export async function loadAdminDashboardModel() {
  const overview = await fetchAdminOverview();
  const payload = objectValue(overview);
  const kpis = objectValue(payload.kpis);
  const pending = objectValue(payload.pending);
  const alerts = arrayValue(payload.alerts).slice(0, 5).map((item) => {
    const row = objectValue(item);
    return {
      rowKey: alertRowKey(row),
      id: stringValue(row.runId || row.userId || row.title || row.detail),
      type: stringValue(row.category || row.severity),
      user: stringValue(row.userName || row.userId, ""),
      workspace: stringValue(row.workspaceId, ""),
      message: stringValue(row.title || row.detail),
      severity: adminAlertSeverity(row.severity),
    };
  });
  return {
    stats: {
      activeUsers: numberValue(kpis.activeUsers),
      totalWorkspaces: numberValue(kpis.workspaceTotal),
      runningTasks: numberValue(kpis.todayRuns || kpis.totalRuns),
      todayRevenue: numberValue(kpis.todayTotalCost),
      frozenAmount: numberValue(payload.ledgerSummary?.frozenAmount || payload.pending?.oldestPendingHours),
      pendingItems: numberValue(pending.count || alerts.length),
    },
    pendingItems: alerts,
  };
}

export async function loadAdminUsersModel() {
  const users = await fetchAdminUsers();
  return {
    users: users.items.map((item) => ({
      id: item.id,
      name: item.name || item.email || item.id,
      email: item.email || "",
      status: adminUserStatus(item.status),
      balance: numberValue(item.balance),
      workspaces: numberValue((item as any).taskCount || (item as any).workspaceCount),
      plan: (item as any).groupName || item.role || "未分组",
      createdAt: dateText(item.createdAt),
    })),
  };
}

export async function loadAdminAlertsModel() {
  const [alertsPayload, announcementsPayload] = await Promise.all([fetchAdminAlerts(), fetchAnnouncements({ mode: "all" })]);
  const pendingItems = arrayValue(objectValue(alertsPayload).alerts).map((item) => {
    const row = objectValue(item);
    return {
      rowKey: alertRowKey(row),
      id: stringValue(row.runId || row.userId || row.title || row.detail),
      type: stringValue(row.category || row.severity),
      severity: adminAlertSeverity(row.severity),
      user: stringValue(row.userName || row.userId, ""),
      workspace: stringValue(row.workspaceId, ""),
      message: stringValue(row.title || row.detail),
      createdAt: dateText(row.occurredAt),
    };
  });
  return {
    announcements: announcementsPayload.items.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      isPinned: Boolean(item.pinned),
      isActive: item.status !== "inactive",
      createdAt: dateText(item.createdAt),
      publishedAt: dateText(item.updatedAt || item.createdAt),
    })),
    pendingItems,
  };
}

export async function loadAdminBillingOpsModel() {
  const billing = objectValue(await fetchAdminBillingOps());
  const pending = objectValue(billing.pending);
  const sync = objectValue(billing.billingSync);
  const warningEvents = arrayValue(billing.warningEvents);
  const pendingRuns = arrayValue(billing.pendingRuns);
  const adjustments = arrayValue(billing.adjustments);
  const billingItems = [
    { source: "pendingRuns", items: pendingRuns },
    { source: "warningEvents", items: warningEvents },
    { source: "adjustments", items: adjustments },
  ].flatMap(({ source, items }) => items.map((item, index) => {
    const row = objectValue(item);
    return {
      rowKey: billingRowKey(source, row, index),
      id: stringValue(row.id),
      source,
      userId: stringValue(row.userId, ""),
      type: adminBillingType(row),
      user: stringValue(row.userName || row.userId, "-"),
      workspace: stringValue(row.workspaceId, "-"),
      amount: numberValue(row.amount || row.totalCost || row.estimatedCost),
      status: adminBillingStatus(row.status),
      reason: stringValue(row.reason || row.title || row.detail || row.type),
      anomaly: Boolean(row.anomaly || row.severity),
      note: stringValue(row.note, ""),
      createdAt: dateText(row.createdAt || row.occurredAt || row.completedAt),
    };
  }));
  return {
    stats: {
      pendingCount: numberValue(pending.count || pendingRuns.length),
      t1ReconcileStatus: sync.lastError ? "failed" : sync.lastRunAt ? "completed" : "pending",
      frozenAnomalies: warningEvents.length,
      todayRefunds: adjustments.filter((item) => objectValue(item).type === "refund").length,
    },
    billingItems,
  };
}

export async function loadAdminAuditModel() {
  const audit = objectValue(await fetchAdminAudit());
  return {
    auditEvents: arrayValue(audit.items).map((item, index) => {
      const row = objectValue(item);
      const rawType = stringValue(row.type, "audit");
      return {
        rowKey: auditRowKey(row, index),
        id: stringValue(row.id || row.occurredAt, String(index)),
        type: rawType,
        operation: stringValue(row.action || rawType),
        user: stringValue(row.actor?.email || row.actor?.name || row.operatorId || row.userId, "-"),
        workspace: stringValue(row.workspaceId, ""),
        status: adminAuditStatus(rawType),
        details: stringValue(row.reason || row.detail || row.type),
        actor: stringValue(row.actor?.email || row.actor?.name || row.operatorId, "-"),
        target: stringValue(row.target?.id || row.target?.userId || row.target?.announcementId || row.target?.kind, "-"),
        reason: stringValue(row.reason || row.detail || row.type),
        idempotencyKey: stringValue(row.idempotencyKey, "-"),
        before: JSON.stringify(row.before ?? null),
        after: JSON.stringify(row.after ?? null),
        timestamp: dateText(row.createdAt || row.occurredAt),
      };
    }),
  };
}

export async function loadAdminSystemModel() {
  const system = objectValue(await fetchAdminSystem());
  const publicSettings = objectValue(system.publicSettings);
  const services = arrayValue(system.serviceStatuses);
  const metrics = objectValue(system.systemMetrics);
  const security = objectValue(system.summaries?.security);
  const failedServices = services.filter((item) => objectValue(item).ok === false).length;
  const degradedServices = services.filter((item) => ["degraded", "pending"].includes(String(objectValue(item).status || "").toLowerCase())).length;
  return {
    siteName: stringValue(publicSettings.siteName, "MedOPL Portal"),
    siteLogo: stringValue(publicSettings.siteLogo, ""),
    homeTitle: stringValue(publicSettings.siteSubtitle || publicSettings.homeContent, "托管 OPL 科研工作台"),
    siteSubtitle: stringValue(publicSettings.siteSubtitle || publicSettings.homeContent, "托管 OPL 科研工作台"),
    homeContent: stringValue(publicSettings.homeContent || publicSettings.siteSubtitle, "托管 OPL 科研工作台"),
    registrationEnabled: Boolean(system.allowRegistration),
    adminReadOnlyMessage,
    serviceStatus: {
      totalServices: services.length,
      failedServices,
      degradedServices,
      keyRoutes: services.slice(0, 6).map((item, index) => {
        const row = objectValue(item);
        return {
          rowKey: adminServiceRowKey("system", row, index),
          name: stringValue(row.name),
          status: row.ok === false ? "failed" : String(row.status || "operational"),
        };
      }),
      securityChecks: {
        total: arrayValue(security.checks).length,
        passed: arrayValue(security.checks).filter((item) => objectValue(item).healthy !== false).length,
        failed: arrayValue(security.checks).filter((item) => objectValue(item).healthy === false).length,
      },
      performance: {
        avgResponseTime: numberValue(metrics.averageResponseMs || metrics.masFirstReplyApproxMs),
        errorRate: numberValue(metrics.errorRate),
      },
    },
  };
}

export async function loadAdminOpsModel() {
  const ops = objectValue(await fetchAdminOps());
  if (ops.error === "ops_surface_disabled" || ops.opsSurfaceEnabled === false) {
    return {
      opsSurfaceEnabled: false,
      disabledTitle: "平台托管运维入口未启用",
      disabledMessage: stringValue(ops.message, "未启用平台托管运维入口。"),
      platformMetrics: {
        totalRequests: 0,
        avgResponseTime: 0,
        activeConnections: 0,
        errorRate: 0,
      },
      services: [],
      adminReadOnlyMessage,
    };
  }
  const systemMetrics = objectValue(ops.systemMetrics);
  const services = arrayValue(ops.serviceStatuses || ops.upstreamStatuses || ops.alerts);
  const summaries = objectValue(ops.summaries);
  return {
    opsSurfaceEnabled: true,
    platformMetrics: {
      totalRequests: numberValue(systemMetrics.totalRequests || systemMetrics.totalRuns || ops.summary?.runCount),
      avgResponseTime: numberValue(systemMetrics.averageResponseMs || systemMetrics.masFirstReplyApproxMs),
      activeConnections: numberValue(systemMetrics.activeWorkspaceSessions || systemMetrics.concurrentRuns),
      errorRate: numberValue(systemMetrics.errorRate),
    },
    services: services.map((item, index) => {
      const row = objectValue(item);
      return {
        rowKey: adminServiceRowKey("ops", row, index),
        name: stringValue(row.name || row.title || row.category),
        status: row.ok === false ? "down" : String(row.status || row.mode || "operational"),
        uptime: row.responseMs ? `${row.responseMs}ms` : stringValue(row.mode || summaries.billing?.mode, "状态可见"),
        lastCheck: dateText(row.occurredAt || row.updatedAt),
      };
    }),
    adminReadOnlyMessage,
  };
}
