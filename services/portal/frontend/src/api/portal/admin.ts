import { goControlPlaneClient } from "../client";
import axios from "axios";
import type { PortalPagination, PortalAdminActionValue, PortalActionErrorShape } from "./common";
import type { PublicSettingsPayload } from "./types";

export type { PublicSettingsPayload };

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  balance: number;
  lastActiveAt?: string;
  lastUsedAt?: string;
  createdAt?: string;
  deletedAt?: string;
}

export interface AdminUserFinanceRow {
  id: string;
  userId: string;
  userName: string;
  type: string;
  amount: number;
  createdAt?: string;
  reason?: string;
}

export interface AdminUsersPayload {
  items: AdminUserListItem[];
  pagination: PortalPagination;
  allowRegistration: boolean;
  financeRows: AdminUserFinanceRow[];
  groups: Array<{ id: string; name: string }>;
  kpis?: Record<string, unknown>;
}

export interface AdminSystemPayload {
  serviceStatuses: Array<Record<string, any>>;
  summaries: Record<string, any>;
  systemMetrics: Record<string, any>;
  productProfile: Record<string, any>;
  allowRegistration: boolean;
  publicSettings: PublicSettingsPayload;
}

export type AdminAuditEventsPayload = Record<string, any>;

export async function fetchAdminAuditEvents(params?: Record<string, string | number | undefined>) {
  const { data } = await goControlPlaneClient.get<AdminAuditEventsPayload>("/admin/audit-events", { params });
  return data;
}

export async function fetchAdminOverview() {
  const { data } = await goControlPlaneClient.get("/admin/overview");
  return data;
}

export async function fetchAdminUsers(params?: Record<string, string | number | undefined>) {
  const { data } = await goControlPlaneClient.get<AdminUsersPayload>("/admin/users", { params });
  return data;
}

const PORTAL_ADMIN_ACTION_FAILED_MESSAGE = "Portal 管理动作未完成，请稍后重试；如持续失败，请联系管理员。";

export function normalizePortalAdminActionError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const businessMessage = error.response?.data?.businessMessage;
    if (typeof businessMessage === "string" && businessMessage.trim()) {
      return businessMessage.trim();
    }
    return fallback;
  }
  if (error instanceof Error) {
    const message =
      typeof (error as PortalActionErrorShape).businessMessage === "string" &&
      (error as PortalActionErrorShape).businessMessage?.trim()
        ? (error as PortalActionErrorShape).businessMessage!.trim()
        : error.message?.trim();
    if (message) {
      return message;
    }
  }
  return fallback;
}

async function postPortalAdminAction(action: string, fields: Record<string, PortalAdminActionValue>) {
  try {
    await goControlPlaneClient.post(`/admin/actions/${encodeURIComponent(action)}`, fields);
  } catch (error) {
    throw normalizePortalAdminActionError(error, PORTAL_ADMIN_ACTION_FAILED_MESSAGE);
  }
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("create-user", {
    name: input.name,
    email: input.email,
    password: input.password,
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function updateAdminSiteSettings(input: PublicSettingsPayload & {
  allowRegistration: boolean;
  redirectTo?: string;
}) {
  await postPortalAdminAction("settings", {
    allowRegistration: input.allowRegistration,
    siteName: input.siteName,
    siteLogo: input.siteLogo,
    siteSubtitle: input.siteSubtitle,
    homeContent: input.homeContent,
    redirectTo: input.redirectTo || "/admin/system",
  });
}

export async function updateAdminUser(input: {
  userId: string;
  name: string;
  email: string;
  password?: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("update-user", {
    userId: input.userId,
    name: input.name,
    email: input.email,
    password: input.password || "",
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function toggleAdminUser(input: {
  userId: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("toggle-user", {
    userId: input.userId,
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function rechargeAdminUser(input: {
  userId: string;
  amount: number;
  redirectTo?: string;
}) {
  await postPortalAdminAction("recharge", {
    userId: input.userId,
    amount: input.amount,
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function refundAdminUser(input: {
  userId: string;
  amount: number;
  reason: string;
  idempotencyKey?: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("ledger-adjust", {
    userId: input.userId,
    amount: input.amount,
    reason: input.reason,
    actionType: "refund",
    idempotencyKey: input.idempotencyKey || "",
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function markAdminBillingOp(input: {
  itemId: string;
  status: "approved" | "rejected" | "pending";
  anomaly: boolean;
  note: string;
  reason: string;
  idempotencyKey?: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("billing-ops-mark", {
    itemId: input.itemId,
    status: input.status,
    anomaly: input.anomaly,
    note: input.note,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey || "",
    redirectTo: input.redirectTo || "/admin/billing-ops",
  });
}

export async function deleteAdminUser(input: {
  userId: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("delete-user", {
    userId: input.userId,
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function saveAdminAnnouncement(input: {
  id?: string;
  title: string;
  content: string;
  status: "active" | "inactive";
  pinned: boolean;
  redirectTo?: string;
}) {
  await postPortalAdminAction("announcements-save", {
    id: input.id || "",
    title: input.title,
    content: input.content,
    scope: "all",
    status: input.status,
    pinned: input.pinned,
    redirectTo: input.redirectTo || "/admin/alerts",
  });
}

export async function toggleAdminAnnouncement(input: {
  id: string;
  actionType: "pin" | "activate" | "deactivate";
  redirectTo?: string;
}) {
  await postPortalAdminAction("announcements-toggle", {
    id: input.id,
    actionType: input.actionType,
    redirectTo: input.redirectTo || "/admin/alerts",
  });
}

export async function deleteAdminAnnouncement(input: {
  id: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("announcements-delete", {
    id: input.id,
    redirectTo: input.redirectTo || "/admin/alerts",
  });
}

export async function fetchAdminGroups() {
  const { data } = await goControlPlaneClient.get("/admin/groups");
  return data;
}

export async function fetchAdminBillingOps() {
  const { data } = await goControlPlaneClient.get("/admin/billing-ops");
  return data;
}

export async function fetchAdminUsage(params?: Record<string, string | number | undefined>) {
  const { data } = await goControlPlaneClient.get("/admin/usage", { params });
  return data;
}

export async function fetchAdminSystem() {
  const { data } = await goControlPlaneClient.get<AdminSystemPayload>("/admin/system");
  return data;
}

export async function fetchAdminOps() {
  try {
    const { data } = await goControlPlaneClient.get("/admin/ops");
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404 && error.response.data?.error === "ops_surface_disabled") {
      return {
        ...error.response.data,
        opsSurfaceEnabled: false,
      };
    }
    throw error;
  }
}

export async function fetchAdminSandboxes() {
  const { data } = await goControlPlaneClient.get("/admin/sandboxes");
  return data;
}

export async function fetchAdminAudit(params?: Record<string, string | number | undefined>) {
  const { data } = await goControlPlaneClient.get("/admin/audit", { params });
  return data;
}

export async function fetchAdminAlerts() {
  const { data } = await goControlPlaneClient.get("/admin/alerts");
  return data;
}

export async function fetchAdminUserPortrait(userId: string) {
  const { data } = await goControlPlaneClient.get("/admin/user", { params: { userId } });
  return data;
}

export async function fetchAdminWorkspacePortrait(userId: string, workspaceId: string) {
  const { data } = await goControlPlaneClient.get("/admin/workspace", { params: { userId, workspaceId } });
  return data;
}

export async function fetchAdminRunPortrait(runId: string) {
  const { data } = await goControlPlaneClient.get("/admin/run", { params: { runId } });
  return data;
}
