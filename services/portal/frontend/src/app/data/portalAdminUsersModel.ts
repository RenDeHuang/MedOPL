import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  normalizePortalAdminActionError,
  rechargeAdminUser,
  refundAdminUser,
  toggleAdminUser,
  updateAdminUser,
} from "../../api/portal/admin";
import { dateText, numberValue } from "./portalFormatters";
import { usePortalQuery } from "./portalQuery";

export const adminLocalActionMessage = "已接入本地 Portal 用户创建、平台批准、启停、删除、充值、退款和公告管理动作。";

export {
  createAdminUser,
  deleteAdminUser,
  normalizePortalAdminActionError,
  rechargeAdminUser,
  refundAdminUser,
  toggleAdminUser,
  updateAdminUser,
};

export type AdminUserStatus = "active" | "restricted" | "disabled";

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  status: AdminUserStatus;
  balance: number;
  workspaces: number;
  plan: string;
  createdAt: string;
}

function adminUserStatus(status: unknown): "active" | "restricted" | "disabled" {
  const value = String(status || "").toLowerCase();
  if (["active", "ok", "success", "operational", "connected", "ready"].includes(value)) return "active";
  if (["disabled", "deleted", "blocked", "failed", "down"].includes(value)) return "disabled";
  return "restricted";
}

export function filterAdminUsers(users: AdminUserView[] = [], searchQuery = "", statusFilter = "all") {
  const search = searchQuery.trim().toLowerCase();
  return users.filter((user) => {
    const matchesSearch = !search ||
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search);
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
}

function positiveMoneyAmount(value: string, errorMessage: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(errorMessage);
  }
  return amount;
}

export function buildAdminUserRechargePayload(user: AdminUserView | null, amountInput: string) {
  if (!user) return null;
  return {
    userId: user.id,
    amount: positiveMoneyAmount(amountInput, "请输入大于 0 的充值金额。"),
    redirectTo: "/admin/users",
  };
}

export function buildAdminUserRefundPayload(user: AdminUserView | null, amountInput: string, reasonInput: string) {
  if (!user) return null;
  const reason = reasonInput.trim();
  if (!reason) {
    throw new Error("请输入退款原因。");
  }
  return {
    userId: user.id,
    amount: positiveMoneyAmount(amountInput, "请输入大于 0 的退款金额。"),
    reason,
    redirectTo: "/admin/users",
  };
}

export async function loadAdminUsersModel() {
  const users = await fetchAdminUsers();
  return {
    users: users.items.map((item): AdminUserView => ({
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

export function useAdminUsersModel(refreshVersion: number) {
  return usePortalQuery(loadAdminUsersModel, [refreshVersion]);
}
