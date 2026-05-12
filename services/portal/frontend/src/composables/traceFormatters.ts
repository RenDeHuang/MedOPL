import type { SessionTracesPayload } from "@/api/portal/traces";

type SessionTraceItem = SessionTracesPayload["items"][number];

export function money(value?: number, currency = "CNY") {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

export function costEstimateText(item: SessionTraceItem) {
  return money(item.costEstimate?.amount, item.costEstimate?.currency || "CNY");
}

export function rechargeStatusText(value?: string) {
  return value === "display_only" ? "仅展示" : "待估算";
}

export function displayIndex(index: number) {
  return String(Number(index || 0) + 1);
}

export function statusBadge(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "settled"].includes(normalized)) return "badge-success";
  if (["failed", "error"].includes(normalized)) return "badge-danger";
  if (["running", "active"].includes(normalized)) return "badge-primary";
  return "badge-warning";
}

export function humanizeStatus(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "settled"].includes(normalized)) return "已完成";
  if (["failed", "error"].includes(normalized)) return "失败";
  if (["running", "active"].includes(normalized)) return "运行中";
  if (normalized === "released") return "已释放";
  return status || "已记录";
}
