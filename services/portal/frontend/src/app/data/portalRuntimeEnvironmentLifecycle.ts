import type { LabPackagePlan } from "../../api/portal/types";
import type { PlatformProvisionedResourcesPayload } from "../../api/portal/types";

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown, fallback = "未返回") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function dateText(value: unknown) {
  return typeof value === "string" && value ? value.replace("T", " ").slice(0, 16) : "未返回";
}

function lifecycleStatusText(status: unknown) {
  const value = stringValue(status, "not_started");
  const labels: Record<string, string> = {
    active_billing: "计费中",
    not_released: "未释放",
    release_requested: "已发起释放",
    billing_stop_confirming: "停费核对中",
    billing_stopped: "已停止计费",
    audit_pending: "T+1 审计中",
    audit_ready: "T+1 审计就绪",
    not_started: "未开始",
  };
  return labels[value] || value;
}

export function runtimeReleaseLifecycle(resources: PlatformProvisionedResourcesPayload) {
  const binding = resources.items.find((item) => item.status === "active") || resources.items[0] || null;
  const releasePolicy = binding?.releasePolicy || null;
  const stopBilling = binding?.stopBilling || null;
  const auditStatus = binding?.auditStatus || null;
  const stopBillingConfirmBy = stringValue(stopBilling?.billingStopConfirmBy || releasePolicy?.billingStopConfirmBy, "");
  const auditReadyAt = stringValue(auditStatus?.auditReadyAt, "");
  return {
    releaseStatus: lifecycleStatusText(releasePolicy?.status),
    stopBillingStatus: lifecycleStatusText(stopBilling?.status),
    stopBillingConfirmBy: stopBillingConfirmBy ? dateText(stopBillingConfirmBy) : "释放后 120 分钟内核对",
    stopBillingWindow: `${numberValue(releasePolicy?.stopBillingConfirmWithinMinutes || stopBilling?.confirmWithinMinutes, 120)} 分钟`,
    auditStatus: lifecycleStatusText(auditStatus?.status),
    auditReadyAt: auditReadyAt ? dateText(auditReadyAt) : "T+1 审计后返回",
    auditPolicy: stringValue(auditStatus?.policy, "T+1"),
    fileSpacePolicy: stringValue(releasePolicy?.protection, "文件空间独立保留"),
  };
}

export function packageCpu(plan: LabPackagePlan) {
  return numberValue(plan.compute?.cores, numberValue(String(plan.computePower || "").match(/\d+/u)?.[0]));
}

export function packageMemory(plan: LabPackagePlan) {
  return numberValue(plan.memoryGb, numberValue(plan.compute?.memoryGb));
}

export function packageConcurrent(plan: LabPackagePlan) {
  return numberValue(plan.compute?.maxConcurrentRuns);
}

export function packageStorage(plan: LabPackagePlan) {
  return numberValue(plan.storageCapacityGb, numberValue(plan.storage?.includedGb));
}

export function packageDisplayName(plan: LabPackagePlan) {
  if (plan.id === "starter_2c4g_10gb") return "基础版";
  if (plan.id === "pro_8c16g_100gb") return "标准版";
  return plan.name;
}
