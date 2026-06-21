import { fetchBillingDetails, fetchBillingSummary } from "../../api/portal/billing";
import { dateText, money, statusText } from "./portalFormatters";
import { usePortalQuery } from "./portalQuery";

function ledgerStatus(type: string) {
  if (type === "pending_usage") return "等待 T+1 精确账单";
  if (type === "preauth_hold" || type === "subscription_weekly_freeze") return "冻结中";
  if (type === "preauth_release" || type === "subscription_freeze_release") return "已释放冻结";
  if (type === "exact_resource_charge" || type === "subscription_daily_charge") return "已入账";
  if (type === "refund") return "已退款";
  if (type === "makeup_charge") return "已补扣";
  return "已记录";
}

function ledgerOwnerScope(item: {
  ownerScope?: string;
}) {
  const labels: Record<string, string> = {
    workspace: "工作空间",
    account: "账户",
    resource: "资源",
  };
  const value = typeof item.ownerScope === "string" && item.ownerScope.trim() ? item.ownerScope.trim() : "";
  return value ? labels[value] || statusText(value) : "账户归属未返回";
}

function billingSupportState(value: unknown) {
  return statusText(value, "本地账本");
}

function supportCopy(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "以 Portal 账本投影为准";
  if (/[A-Za-z_]/u.test(raw)) return "以 Portal 账本投影为准";
  return raw;
}

function ledgerReason(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "账本记录";
  if (raw === "local_rc_environment_open") return "计算环境开通预授权";
  if (/[A-Za-z_]/u.test(raw)) return statusText(raw, "账本记录");
  return raw;
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
    supportBoundary: summary.supportBoundary
      ? {
          ...summary.supportBoundary,
          supportStatus: billingSupportState(summary.supportBoundary.supportStatus),
          fundingStatus: billingSupportState(summary.supportBoundary.fundingStatus),
          graceStatus: billingSupportState(summary.supportBoundary.graceStatus),
          fileRetentionStatus: billingSupportState(summary.supportBoundary.fileRetentionStatus),
          failedRunBillingStatus: billingSupportState(summary.supportBoundary.failedRunBillingStatus),
          billingCopy: supportCopy(summary.supportBoundary.billingCopy),
          userCopy: supportCopy(summary.supportBoundary.userCopy),
        }
      : undefined,
    workspaceCosts: details.taskCosts.map((item) => ({
      workspace: item.title && !/[A-Za-z]/u.test(item.title) ? item.title : "工作空间",
      tasks: item.runCount,
      compute: item.cpuCost + item.gpuCost,
      storage: item.storageCost,
      total: item.totalCost,
    })),
    taskCosts: details.runCosts.map((item) => ({
      id: item.taskRef,
      name: "任务记录",
      workspace: "工作空间",
      cost: item.totalCost,
      time: item.endedAt ? `${dateText(item.startedAt)} - ${dateText(item.endedAt)}` : dateText(item.startedAt),
      status: item.runStatus,
    })),
    billingRecords: details.ledger.map((item) => ({
      id: item.id || item.createdAt,
      date: dateText(item.createdAt),
      type: statusText(item.type),
      description: ledgerReason(item.reason || item.type),
      amount: money(item.amount),
      status: ledgerStatus(item.type),
      ownerScope: ledgerOwnerScope(item),
    })),
  };
}

export function useBillingAuditModel() {
  return usePortalQuery(loadBillingAuditModel, []);
}
