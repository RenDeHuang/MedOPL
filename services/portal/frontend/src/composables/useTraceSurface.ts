import { computed, reactive, ref, watch } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { SessionTracesPayload } from "@/api/portal/traces";
import { fetchSessionTraces } from "@/api/portal/traces";

type SessionTraceItem = SessionTracesPayload["items"][number];

function errorMessage(error: unknown, fallback: string) {
  const value = (error as { businessMessage?: unknown; message?: unknown })?.businessMessage
    || (error as { message?: unknown })?.message;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function useTraceSurface(route: RouteLocationNormalizedLoaded, router: Router) {
  const loading = ref(true);
  const error = ref("");
  const payload = ref<SessionTracesPayload | null>(null);
  const filters = reactive({ workspaceId: "", sessionId: "", status: "" });

  const traceItems = computed<SessionTraceItem[]>(() => payload.value?.items || []);
  const runCount = computed(() => new Set(traceItems.value.map((item) => item.runId).filter(Boolean)).size);
  const outputCount = computed(() => traceItems.value.reduce((sum, item) => sum + Number(item.files?.linkedOutputCount || item.files?.outputsCount || 0), 0));
  const totalEstimatedCost = computed(() => traceItems.value.reduce((sum, item) => sum + Number(item.costEstimate?.amount || 0), 0));

  function linkedOutputFiles(item: SessionTraceItem) {
    return item.linkedOutputFiles || item.files?.linkedOutputFiles || [];
  }

  function money(value?: number, currency = "CNY") {
    return `${Number(value || 0).toFixed(2)} ${currency}`;
  }

  function costEstimateText(item: SessionTraceItem) {
    return money(item.costEstimate?.amount, item.costEstimate?.currency || "CNY");
  }

  function rechargeStatusText(value?: string) {
    return value === "display_only" ? "仅展示" : "待估算";
  }

  function routeQueryObject() {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(route.query)) {
      const normalized = Array.isArray(value) ? value[0] : value;
      if (normalized != null) query[key] = String(normalized);
    }
    return query;
  }

  function readQueryValue(key: string) {
    const value = route.query[key];
    const normalized = Array.isArray(value) ? value[0] : value;
    return normalized ?? undefined;
  }

  function traceQuery(updates: Record<string, string | number | undefined>) {
    const query = routeQueryObject();
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null || value === "") delete query[key];
      else query[key] = String(value);
    }
    return { path: route.path, query };
  }

  function previousPage(page: number) {
    return Math.max(1, Number(page || 1) - 1);
  }

  function nextPage(page: number, totalPages: number) {
    return Math.min(Number(totalPages || 1), Number(page || 1) + 1);
  }

  function displayIndex(index: number) {
    return String(Number(index || 0) + 1);
  }

  function statusBadge(status = "") {
    const normalized = String(status || "").toLowerCase();
    if (["completed", "success", "settled"].includes(normalized)) return "badge-success";
    if (["failed", "error"].includes(normalized)) return "badge-danger";
    if (["running", "active"].includes(normalized)) return "badge-primary";
    return "badge-warning";
  }

  function humanizeStatus(status = "") {
    const normalized = String(status || "").toLowerCase();
    if (["completed", "success", "settled"].includes(normalized)) return "已完成";
    if (["failed", "error"].includes(normalized)) return "失败";
    if (["running", "active"].includes(normalized)) return "运行中";
    if (normalized === "released") return "已释放";
    return status || "已记录";
  }

  function applyFilters() {
    router.push({
      path: route.path,
      query: {
        ...routeQueryObject(),
        workspaceId: filters.workspaceId || undefined,
        sessionId: filters.sessionId || undefined,
        status: filters.status || undefined,
        page: undefined,
      },
    });
  }

  function resetFilters() {
    filters.workspaceId = "";
    filters.sessionId = "";
    filters.status = "";
    router.push({ path: route.path, query: {} });
  }

  let requestId = 0;

  async function load() {
    const current = ++requestId;
    loading.value = true;
    error.value = "";
    try {
      const data = await fetchSessionTraces({
        workspaceId: readQueryValue("workspaceId"),
        sessionId: readQueryValue("sessionId"),
        status: readQueryValue("status"),
        page: readQueryValue("page"),
        page_size: 10,
        limit: 100,
      });
      if (current !== requestId) return;
      payload.value = data;
      filters.workspaceId = String(readQueryValue("workspaceId") || "");
      filters.sessionId = String(readQueryValue("sessionId") || "");
      filters.status = String(readQueryValue("status") || "");
    } catch (err) {
      if (current !== requestId) return;
      error.value = errorMessage(err, "会话轨迹加载失败");
    } finally {
      if (current === requestId) loading.value = false;
    }
  }

  watch(() => route.fullPath, () => {
    void load();
  }, { immediate: true });

  return {
    applyFilters,
    costEstimateText,
    displayIndex,
    error,
    filters,
    humanizeStatus,
    linkedOutputFiles,
    loading,
    money,
    nextPage,
    outputCount,
    payload,
    previousPage,
    rechargeStatusText,
    resetFilters,
    runCount,
    statusBadge,
    totalEstimatedCost,
    traceQuery,
  };
}
