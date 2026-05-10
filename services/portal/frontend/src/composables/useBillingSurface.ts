import { computed, reactive, ref, watch } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { BillingDetailsPayload, BillingPayload, BillingSummaryPayload } from "@/api/portal/billing";
import { fetchBillingDetails, fetchBillingSummary } from "@/api/portal/billing";
import type { PortalPagination, PortalQueryValue } from "@/api/portal/common";

const emptyPagination: PortalPagination = { page: 1, pageSize: 5, total: 0, totalPages: 1 };
const emptyDetails: BillingDetailsPayload = {
  taskCosts: [],
  taskPagination: emptyPagination,
  runCosts: [],
  runPagination: emptyPagination,
  ledger: [],
  ledgerPagination: emptyPagination,
  trend: { labels: [], total: [], cpu: [], gpu: [], storage: [] },
};

function errorMessage(error: unknown, fallback: string) {
  const value = (error as { businessMessage?: unknown; message?: unknown })?.businessMessage
    || (error as { message?: unknown })?.message;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function useBillingSurface(route: RouteLocationNormalizedLoaded, router: Router) {
  const summaryLoading = ref(true);
  const detailsLoading = ref(false);
  const error = ref("");
  const detailsError = ref("");
  const summaryPayload = ref<BillingSummaryPayload | null>(null);
  const detailsPayload = ref<BillingDetailsPayload | null>(null);
  const filterDraft = reactive({ from: "", to: "" });

  const payload = computed<BillingPayload | null>(() => {
    if (!summaryPayload.value) return null;
    const details = detailsPayload.value || emptyDetails;
    return {
      ...summaryPayload.value,
      ...details,
    };
  });

  const componentCostHint = computed(() => {
    if (payload.value?.breakdown.cloudSource === "tencent_cloud") {
      return "总额来自账单核对，分项按消费组件回补";
    }
    return "运行中估算，等待账单核对回补";
  });
  const sourceBackfillHint = computed(() => payload.value?.breakdown.cloudSource === "tencent_cloud" ? "账单核对已接入，专项分项待回补" : "等待账单核对回补");
  const trendChartData = computed(() => {
    const trend = payload.value?.trend;
    if (!trend?.labels?.length) return null;
    return {
      labels: trend.labels,
      datasets: [
        { label: "总成本", data: trend.total, backgroundColor: "#0f766e" },
        { label: "CPU", data: trend.cpu, backgroundColor: "#0ea5e9" },
        { label: "GPU", data: trend.gpu, backgroundColor: "#8b5cf6" },
        { label: "存储", data: trend.storage, backgroundColor: "#10b981" },
      ],
    };
  });

  function money(value: number | undefined) {
    return `¥${Number(value || 0).toFixed(2)}`;
  }

  function microMoney(value: number | undefined) {
    return money(value);
  }

  function sourceBackfilledValue(value: number | undefined) {
    return payload.value?.breakdown.cloudSource === "tencent_cloud" ? microMoney(value) : "待回补";
  }

  function humanizeStatus(status?: string) {
    const normalized = String(status || "").toLowerCase();
    if (["completed", "success", "finished"].includes(normalized)) return "已完成";
    if (normalized === "running") return "运行中";
    if (normalized === "active") return "运行中";
    if (["failed", "error"].includes(normalized)) return "失败";
    return status || "未知";
  }

  function statusBadge(status?: string) {
    const normalized = String(status || "").toLowerCase();
    if (["completed", "success", "finished"].includes(normalized)) return "badge-success";
    if (["failed", "error"].includes(normalized)) return "badge-danger";
    if (["running", "active"].includes(normalized)) return "badge-primary";
    return "badge-warning";
  }

  function humanizeLedgerType(type = "") {
    if (type === "topup") return "充值";
    if (type === "resource_charge") return "托管运行环境消费";
    if (type === "refund") return "退款";
    if (type === "makeup_charge") return "补扣";
    return type || "-";
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

  function billingQuery(updates: Record<string, PortalQueryValue>) {
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

  function applyFilter() {
    router.push({
      path: route.path,
      query: {
        ...routeQueryObject(),
        from: filterDraft.from || undefined,
        to: filterDraft.to || undefined,
        tasks_page: undefined,
        runs_page: undefined,
        ledger_page: undefined,
      },
    });
  }

  function resetFilter() {
    filterDraft.from = "";
    filterDraft.to = "";
    router.push({ path: route.path, query: {} });
  }

  const billingExportHref = computed(() => {
    const params = new URLSearchParams();
    if (filterDraft.from) params.set("from", filterDraft.from);
    if (filterDraft.to) params.set("to", filterDraft.to);
    return `/portal/billing/export.csv${params.toString() ? `?${params}` : ""}`;
  });

  const taskExportHref = computed(() => {
    const params = new URLSearchParams();
    if (filterDraft.from) params.set("from", filterDraft.from);
    if (filterDraft.to) params.set("to", filterDraft.to);
    return `/portal/billing/tasks-export.csv${params.toString() ? `?${params}` : ""}`;
  });

  let requestId = 0;

  async function load() {
    const current = ++requestId;
    summaryLoading.value = true;
    detailsLoading.value = false;
    error.value = "";
    detailsError.value = "";
    try {
      const data = await fetchBillingSummary({
        from: readQueryValue("from"),
        to: readQueryValue("to"),
      });
      if (current !== requestId) return;
      summaryPayload.value = data;
      filterDraft.from = data.filter.from || "";
      filterDraft.to = data.filter.to || "";
      void loadBillingDetails(current);
    } catch (err) {
      if (current !== requestId) return;
      error.value = errorMessage(err, "账单加载失败");
    } finally {
      if (current === requestId) summaryLoading.value = false;
    }
  }

  async function loadBillingDetails(current: number) {
    detailsLoading.value = true;
    detailsError.value = "";
    try {
      const data = await fetchBillingDetails({
        from: readQueryValue("from"),
        to: readQueryValue("to"),
        tasks_page: readQueryValue("tasks_page"),
        runs_page: readQueryValue("runs_page"),
        ledger_page: readQueryValue("ledger_page"),
      });
      if (current !== requestId) return;
      detailsPayload.value = data;
    } catch (err) {
      if (current !== requestId) return;
      detailsError.value = errorMessage(err, "账单明细加载失败");
    } finally {
      if (current === requestId) detailsLoading.value = false;
    }
  }

  watch(() => route.fullPath, () => {
    void load();
  }, { immediate: true });

  return {
    billingExportHref,
    billingQuery,
    componentCostHint,
    detailsError,
    detailsLoading,
    detailsPayload,
    error,
    filterDraft,
    humanizeLedgerType,
    humanizeStatus,
    microMoney,
    money,
    nextPage,
    payload,
    previousPage,
    resetFilter,
    sourceBackfilledValue,
    sourceBackfillHint,
    statusBadge,
    summaryLoading,
    summaryPayload,
    taskExportHref,
    trendChartData,
    applyFilter,
  };
}
