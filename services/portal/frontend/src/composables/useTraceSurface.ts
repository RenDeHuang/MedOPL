import { computed, reactive, ref, watch } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { SessionTracesPayload } from "@/api/portal/traces";
import { fetchSessionTraces } from "@/api/portal/traces";
import {
  costEstimateText,
  displayIndex,
  humanizeStatus,
  money,
  rechargeStatusText,
  statusBadge,
} from "@/composables/traceFormatters";

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

  function updateFilter(key: "workspaceId" | "sessionId" | "status", value: string) {
    filters[key] = value;
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
    updateFilter,
  };
}
