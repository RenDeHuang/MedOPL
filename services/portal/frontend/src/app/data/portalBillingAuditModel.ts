import { fetchBillingDetails, fetchBillingSummary } from "../../api/portal/billing";
import { dateText, money } from "./portalFormatters";
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
  return typeof item.ownerScope === "string" && item.ownerScope.trim() ? item.ownerScope.trim() : "账户归属未返回";
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
      status: ledgerStatus(item.type),
      ownerScope: ledgerOwnerScope(item),
    })),
  };
}

export function useBillingAuditModel() {
  return usePortalQuery(loadBillingAuditModel, []);
}
