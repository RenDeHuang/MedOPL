import type { CustomerComputeResource, CustomerStorageResource, WeeklyProtectionFreeze } from "@/api/portal/resources";

export function money(value: number | undefined) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

export function displayOrdinalFromId(value?: string) {
  const text = String(value || "").trim();
  const match = /(\d+)(?!.*\d)/.exec(text);
  return match ? match[1] : "";
}

export function workspaceDisplayName(value?: string) {
  const ordinal = displayOrdinalFromId(value);
  return ordinal ? `工作空间 ${ordinal}` : "工作空间";
}

export function resourceStatusBadge(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["active", "done", "matched", "released"].includes(normalized)) return "badge-success";
  if (["pending", "inactive"].includes(normalized)) return "badge-warning";
  if (["failed", "error", "deleted"].includes(normalized)) return "badge-danger";
  return "badge-primary";
}

export function resourceStatusText(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    active: "可用",
    inactive: "已停用",
    deleted: "已删除",
    released: "已释放",
    pending: "待处理",
    done: "已完成",
    matched: "已核对",
    skipped: "已跳过",
  };
  return labels[normalized] || status || "-";
}

export function auditStatusText(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    pending: "待处理",
    done: "已完成",
    matched: "已核对",
    released: "已释放",
    skipped: "已跳过",
  };
  return labels[normalized] || "待处理";
}

export function planLabel(planId?: string) {
  const normalized = String(planId || "").trim();
  const labels: Record<string, string> = {
    starter_2c4g_10gb: "基础套餐",
    pro_8c16g_100gb: "Pro 套餐",
  };
  return labels[normalized] || "基础套餐";
}

export function computeSpecText(row?: Partial<CustomerComputeResource> | null) {
  const planId = String(row?.serverPlanId || "").trim();
  if (planId === "pro_8c16g_100gb") return "8 核 16GB";
  if (planId === "starter_2c4g_10gb") return "2 核 4GB";
  return String(row?.instanceType || "").trim().replace(/\s*\/\s*/g, " ") || "2 核 4GB";
}

export function storageCapacityText(row?: Partial<CustomerStorageResource> | null) {
  const value = Number(row?.storageCapacityGb || 0);
  if (value >= 100) return "100GB 文件空间";
  if (value > 0) return `${value}GB 文件空间`;
  return "10GB 文件空间";
}

export function concurrencyText(planId?: string) {
  return String(planId || "").trim() === "pro_8c16g_100gb" ? "2 个任务" : "1 个任务";
}

export function protectionEstimateText(protection?: WeeklyProtectionFreeze | null) {
  return money(protection?.weeklyAmount || protection?.frozenAmount || 0);
}
