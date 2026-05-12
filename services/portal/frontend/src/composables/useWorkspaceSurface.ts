import { computed, ref, watch } from "vue";
import type { RouteLocationNormalizedLoaded } from "vue-router";
import type { WorkspacePayload } from "@/api/portal/workspace";
import { disabledStorageEntitlement, fetchWorkspace } from "@/api/portal/workspace";

function errorMessage(error: unknown, fallback: string) {
  const value = (error as { businessMessage?: unknown; message?: unknown })?.businessMessage
    || (error as { message?: unknown })?.message;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function useWorkspaceSurface(route: RouteLocationNormalizedLoaded) {
  const loading = ref(true);
  const error = ref("");
  const payload = ref<WorkspacePayload | null>(null);

  const currentTask = computed(() => {
    const value = route.query.task;
    return Array.isArray(value) ? String(value[0] || "") : String(value || "default");
  });

  const isActiveWorkspace = computed(() => String(payload.value?.workspace.status || "").toLowerCase() === "active");
  const isArchivedWorkspace = computed(() => String(payload.value?.workspace.status || "").toLowerCase() === "archived");
  const uploadAction = computed(() => `/portal/workspace/upload?task=${encodeURIComponent(payload.value?.workspace.slug || currentTask.value || "default")}`);
  const emptyStorageEntitlement = computed(() => disabledStorageEntitlement());
  const storageEntitlement = computed(() => payload.value?.storageEntitlement || payload.value?.workspace.storageEntitlement || emptyStorageEntitlement.value);
  const totalEstimatedCost = computed(() => (payload.value?.outputs || []).reduce((sum, item) => sum + Number(item.costEstimate?.amount || 0), 0));
  const managedPlan = computed(() => payload.value?.managedResourceBindingPlan || null);
  const fileSpace = computed(() => payload.value?.fileSpace || null);
  const selectedFileCount = computed(() => fileSpace.value?.selectedFileRefs.length || 0);
  const currentFolderName = computed(() => {
    const current = fileSpace.value?.folders.find((folder) => folder.folderRef === fileSpace.value?.currentFolderRef);
    return current?.name || "全部文件";
  });
  const fileSpaceUsageText = computed(() => {
    if (!fileSpace.value) return storageEntitlement.value.enabled ? `${storageEntitlement.value.storageSizeGb}GB 文件空间` : "文件空间未开通";
    return `${fileSpace.value.usedGb}GB / ${fileSpace.value.capacityGb}GB`;
  });
  const ordinaryDeleteRequiresConfirmation = computed(() => Boolean(fileSpace.value?.deletePolicy.ordinaryDeleteRequiresConfirmation));
  const fileSpaceRetentionDays = computed(() => fileSpace.value?.deletePolicy.retentionDays || 7);

  function routeQueryObject() {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(route.query)) {
      const normalized = Array.isArray(value) ? value[0] : value;
      if (normalized != null) query[key] = String(normalized);
    }
    return query;
  }

  function workspaceQuery(updates: Record<string, string | number | undefined>) {
    const query = routeQueryObject();
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null || value === "") delete query[key];
      else query[key] = String(value);
    }
    return { path: route.path, query };
  }

  function readQueryValue(key: string) {
    const value = route.query[key];
    const normalized = Array.isArray(value) ? value[0] : value;
    return normalized ?? undefined;
  }

  function previousPage(page: number) {
    return Math.max(1, Number(page || 1) - 1);
  }

  function nextPage(page: number, totalPages: number) {
    return Math.min(Number(totalPages || 1), Number(page || 1) + 1);
  }

  function statusBadge(status?: string) {
    const normalized = String(status || "").toLowerCase();
    if (["active", "running", "completed", "success", "finished"].includes(normalized)) return "badge-success";
    if (["failed", "error", "deleted"].includes(normalized)) return "badge-danger";
    if (["archived", "deleting"].includes(normalized)) return "badge-warning";
    return "badge-primary";
  }

  function humanizeStatus(status?: string) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "active") return "运行中";
    if (normalized === "archived") return "已归档";
    if (normalized === "deleted") return "已删除";
    if (normalized === "deleting") return "删除中";
    if (["completed", "success", "finished"].includes(normalized)) return "已完成";
    return status || "未知";
  }

  function taskDisplayName(value?: string) {
    return value ? "已关联" : "已记录";
  }

  function hasLinkedTask(item: { runId?: string }) {
    return Boolean(item.runId);
  }

  function linkedTaskText(item: { runId?: string }) {
    return taskDisplayName(item.runId);
  }

  function money(value?: number, currency = "CNY") {
    return `${Number(value || 0).toFixed(2)} ${currency}`;
  }

  function costEstimateText(item: { costEstimate?: { amount?: number; currency?: string } }) {
    return money(item.costEstimate?.amount, item.costEstimate?.currency || "CNY");
  }

  function rechargeStatusText(value?: string) {
    return value === "display_only" ? "仅展示" : "待估算";
  }

  function fileKindText(value?: string) {
    return value === "output" ? "输出文件" : "输入文件";
  }

  function fileSourceText(file: { source?: string; artifactRef?: string }) {
    if (file.source === "runtime_output" || file.artifactRef) return "运行轨迹";
    return "上传文件";
  }

  function fileProtectionText(file: { status?: string; retentionUntil?: string }) {
    if (String(file.status || "").toLowerCase() === "retention_protected") return file.retentionUntil ? `保护期至 ${file.retentionUntil}` : "保护期";
    return humanizeStatus(file.status || "active");
  }

  function releasePolicyText(value?: string) {
    return value === "not_released" ? "未释放" : "释放处理中";
  }

  function auditStatusText(value?: string) {
    if (value === "audit_pending") return "待审计";
    if (value === "audit_ready") return "可审计";
    if (value === "audited") return "已审计";
    return "未开始";
  }

  function snapshotText(realResourceCreated?: boolean) {
    return realResourceCreated ? "已创建" : "计划快照";
  }

  function workspaceMasHref(task?: string) {
    const params = new URLSearchParams();
    if (task) params.set("task", task);
    return `/portal/opl${params.toString() ? `?${params}` : ""}`;
  }

  function downloadAllHref(kind: "inputs" | "outputs") {
    return `/portal/workspace/download-all?task=${encodeURIComponent(payload.value?.workspace.slug || currentTask.value || "default")}&kind=${encodeURIComponent(kind)}`;
  }

  function downloadFileHref(kind: "inputs" | "outputs", fileName: string) {
    return `/portal/workspace/download-file?task=${encodeURIComponent(payload.value?.workspace.slug || currentTask.value || "default")}&kind=${encodeURIComponent(kind)}&file=${encodeURIComponent(fileName)}`;
  }

  let requestId = 0;

  async function load() {
    const current = ++requestId;
    loading.value = true;
    error.value = "";
    try {
      const data = await fetchWorkspace({
        task: readQueryValue("task"),
        tasks_page: readQueryValue("tasks_page"),
        runs_page: readQueryValue("runs_page"),
        inputs_page: readQueryValue("inputs_page"),
        outputs_page: readQueryValue("outputs_page"),
      });
      if (current !== requestId) return;
      payload.value = data;
    } catch (err) {
      if (current !== requestId) return;
      error.value = errorMessage(err, "工作空间加载失败");
    } finally {
      if (current === requestId) loading.value = false;
    }
  }

  watch(() => route.fullPath, () => {
    void load();
  }, { immediate: true });

  return {
    auditStatusText,
    costEstimateText,
    currentFolderName,
    currentTask,
    downloadAllHref,
    downloadFileHref,
    error,
    fileKindText,
    fileProtectionText,
    fileSourceText,
    fileSpaceRetentionDays,
    fileSpaceUsageText,
    hasLinkedTask,
    humanizeStatus,
    isActiveWorkspace,
    isArchivedWorkspace,
    linkedTaskText,
    loading,
    managedPlan,
    money,
    nextPage,
    ordinaryDeleteRequiresConfirmation,
    payload,
    previousPage,
    rechargeStatusText,
    releasePolicyText,
    selectedFileCount,
    snapshotText,
    statusBadge,
    storageEntitlement,
    totalEstimatedCost,
    uploadAction,
    workspaceMasHref,
    workspaceQuery,
  };
}
