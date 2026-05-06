import { apiClient } from "../client";
import type { PortalPagination, PortalAdminActionValue, PortalActionErrorShape } from "./common";
import type { SessionTracesPayload } from "./traces";

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

function readPortalActionError(html: string, fallback: string) {
  if (!html) return fallback;
  if (typeof DOMParser === "undefined") return fallback;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const cardText = doc.querySelector(".card")?.textContent?.trim();
  const titleText = doc.querySelector("title")?.textContent?.trim();
  return cardText || titleText || fallback;
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

  if (response.ok) {
    return;
  }

  const html = await response.text().catch(() => "");
  const fallback = `请求失败（${response.status}）`;
  const error = new Error(readPortalActionError(html, fallback)) as Error & PortalActionErrorShape;
  error.message = readPortalActionError(html, fallback);
  throw error;
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
    redirectTo: input.redirectTo || "/portal/app/admin/users",
  });
}

export async function updateAdminRegistrationSettings(input: {
  allowRegistration: boolean;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/settings", {
    allowRegistration: input.allowRegistration,
    redirectTo: input.redirectTo || "/portal/app/admin/users",
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
    redirectTo: input.redirectTo || "/portal/app/admin/users",
  });
}

export async function toggleAdminUser(input: {
  userId: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/toggle-user", {
    userId: input.userId,
    redirectTo: input.redirectTo || "/portal/app/admin/users",
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
    redirectTo: input.redirectTo || "/portal/app/admin/users",
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
    redirectTo: input.redirectTo || "/portal/app/admin/users",
  });
}

export async function deleteAdminUser(input: {
  userId: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/delete-user", {
    userId: input.userId,
    redirectTo: input.redirectTo || "/portal/app/admin/users",
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
  const { data } = await apiClient.get("/admin/system");
  return data;
}

export async function fetchAdminOps() {
  const { data } = await apiClient.get("/admin/ops");
  return data;
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
