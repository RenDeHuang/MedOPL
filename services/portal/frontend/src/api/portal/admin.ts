import { apiClient } from "../client";
import axios from "axios";
import type { PortalPagination, PortalAdminActionValue, PortalActionErrorShape } from "./common";
import type { SessionTracesPayload } from "./traces";
import type { PublicSettingsPayload } from "./public";

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

export async function fetchAdminAgentTraces(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<SessionTracesPayload>("/admin/agent-traces", { params });
  return data;
}

export async function fetchAdminOverview() {
  const { data } = await apiClient.get("/admin/overview");
  return data;
}

export async function fetchAdminUsers(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<AdminUsersPayload>("/admin/users", { params });
  return data;
}

function buildPortalAdminFormPayload(fields: Record<string, PortalAdminActionValue>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    body.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  return body;
}

const PORTAL_ADMIN_ACTION_FAILED_MESSAGE = "Portal 管理动作未完成，请稍后重试；如持续失败，请联系管理员。";
const PORTAL_ADMIN_AUTH_EXPIRED_MESSAGE = "登录状态已失效，请重新登录后再操作。";

function portalAdminActionError(message: string, status?: number) {
  const error = new Error(message) as Error & PortalActionErrorShape;
  error.businessMessage = message;
  if (status) (error as Error & PortalActionErrorShape & { status: number }).status = status;
  return error;
}

async function postPortalAdminAction(path: string, fields: Record<string, PortalAdminActionValue>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: buildPortalAdminFormPayload(fields),
  });

  const responseUrl = new URL(response.url || path, window.location.origin);
  if (response.redirected && responseUrl.pathname === "/login") {
    throw portalAdminActionError(PORTAL_ADMIN_AUTH_EXPIRED_MESSAGE, 401);
  }

  if (response.ok) {
    return;
  }

  throw portalAdminActionError(PORTAL_ADMIN_ACTION_FAILED_MESSAGE, response.status);
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/create-user", {
    name: input.name,
    email: input.email,
    password: input.password,
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function updateAdminRegistrationSettings(input: {
  allowRegistration: boolean;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/settings", {
    allowRegistration: input.allowRegistration,
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function updateAdminSiteSettings(input: PublicSettingsPayload & {
  allowRegistration: boolean;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/settings", {
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
  await postPortalAdminAction("/portal/admin/update-user", {
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
  await postPortalAdminAction("/portal/admin/toggle-user", {
    userId: input.userId,
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function rechargeAdminUser(input: {
  userId: string;
  amount: number;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/recharge", {
    userId: input.userId,
    amount: input.amount,
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function refundAdminUser(input: {
  userId: string;
  amount: number;
  reason: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/ledger-adjust", {
    userId: input.userId,
    amount: input.amount,
    reason: input.reason,
    actionType: "refund",
    redirectTo: input.redirectTo || "/admin/users",
  });
}

export async function deleteAdminUser(input: {
  userId: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/delete-user", {
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
  await postPortalAdminAction("/portal/admin/announcements/save", {
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
  await postPortalAdminAction("/portal/admin/announcements/toggle", {
    id: input.id,
    actionType: input.actionType,
    redirectTo: input.redirectTo || "/admin/alerts",
  });
}

export async function deleteAdminAnnouncement(input: {
  id: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/announcements/delete", {
    id: input.id,
    redirectTo: input.redirectTo || "/admin/alerts",
  });
}

export async function fetchAdminGroups() {
  const { data } = await apiClient.get("/admin/groups");
  return data;
}

export async function fetchAdminBillingOps() {
  const { data } = await apiClient.get("/admin/billing-ops");
  return data;
}

export async function fetchAdminUsage(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get("/admin/usage", { params });
  return data;
}

export async function fetchAdminSystem() {
  const { data } = await apiClient.get<AdminSystemPayload>("/admin/system");
  return data;
}

export async function fetchAdminOps() {
  try {
    const { data } = await apiClient.get("/admin/ops");
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
  const { data } = await apiClient.get("/admin/sandboxes");
  return data;
}

export async function fetchAdminAudit(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get("/admin/audit", { params });
  return data;
}

export async function fetchAdminAlerts() {
  const { data } = await apiClient.get("/admin/alerts");
  return data;
}

export async function fetchAdminUserPortrait(userId: string) {
  const { data } = await apiClient.get("/admin/user", { params: { userId } });
  return data;
}

export async function fetchAdminWorkspacePortrait(userId: string, workspaceId: string) {
  const { data } = await apiClient.get("/admin/workspace", { params: { userId, workspaceId } });
  return data;
}

export async function fetchAdminRunPortrait(runId: string) {
  const { data } = await apiClient.get("/admin/run", { params: { runId } });
  return data;
}
