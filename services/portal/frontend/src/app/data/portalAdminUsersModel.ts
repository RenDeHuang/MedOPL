import {
  approveAdminCommercialAccount,
  creditAdminCommercialAccount,
  deleteAdminUser,
  fetchAdminBillingStatement,
  fetchAdminRuntimeFreeze,
  fetchAdminRuntimeGate,
  fetchAdminUsers,
  normalizePortalAdminActionError,
  prepareAdminCommercialAccount,
  toggleAdminUser,
  updateAdminUser,
  type AdminBillingStatementPayload,
  type AdminCommercialAccountInput,
  type AdminRuntimeFreezePayload,
  type AdminRuntimeGatePayload,
} from "../../api/portal/admin";
import { dateText, keyPart, numberValue, objectValue, stringValue } from "./portalFormatters";
import { usePortalQuery } from "./portalQuery";

export const adminLocalActionMessage = "已接入 owner-created-or-approved MedOPL accounts 的 v22 商业账号准备、批准、授信、余额、冻结和 runtime gate。";

export {
  approveAdminCommercialAccount,
  creditAdminCommercialAccount,
  deleteAdminUser,
  normalizePortalAdminActionError,
  prepareAdminCommercialAccount,
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
  availableBalance: number;
  frozenAmount: number;
  workspaces: number;
  plan: string;
  tenantId: string;
  portalUserId: string;
  workspaceId: string;
  billingStatement: AdminBillingStatementPayload;
  runtimeFreeze: AdminRuntimeFreezePayload;
  runtimeGate: AdminRuntimeGatePayload;
  ledgerCount: number;
  runtimeGateDecision: "allowed" | "blocked" | "unknown";
  runtimeGateReason: string;
  runtimeState: string;
  storageState: string;
  ledgerError: string;
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

function workspaceKeyFromUser(user: Pick<AdminUserView, "id" | "email">) {
  return keyPart(user.email || user.id, "user").toLowerCase();
}

function commercialIdentityFromItem(item: any) {
  const id = stringValue(item.id, "user-local-rc");
  const email = typeof item.email === "string" && item.email.trim() ? item.email.trim() : "";
  const tenantId = stringValue(item.tenantId || item.tenantID || item.orgId, "tenant-local-rc");
  const portalUserId = stringValue(item.portalUserId || item.userId || id, id);
  if (portalUserId === "user-local-rc" || email === "local@medopl.test") {
    return { tenantId, portalUserId, workspaceId: "workspace-local-rc" };
  }
  const workspaceId = stringValue(
    item.workspaceId || item.workspaceID || item.primaryWorkspaceId || item.workspace?.id,
    `workspace-${workspaceKeyFromUser({ id, email })}`,
  );
  return { tenantId, portalUserId, workspaceId };
}

export function buildAdminCommercialAccountInput(user: AdminUserView | null): AdminCommercialAccountInput | null {
  if (!user) return null;
  return {
    tenantId: user.tenantId,
    portalUserId: user.portalUserId,
    workspaceId: user.workspaceId,
  };
}

export function buildAdminCommercialAccountDraftInput(nameInput: string, emailInput: string): AdminCommercialAccountInput {
  const name = nameInput.trim();
  const email = emailInput.trim();
  if (!name || !email) {
    throw new Error("请输入姓名和邮箱。");
  }
  if (email === "local@medopl.test") {
    return {
      tenantId: "tenant-local-rc",
      portalUserId: "user-local-rc",
      workspaceId: "workspace-local-rc",
    };
  }
  const identityKey = keyPart(email, "user").toLowerCase();
  return {
    tenantId: "tenant-local-rc",
    portalUserId: `user-${identityKey}`,
    workspaceId: `workspace-${identityKey}`,
  };
}

function adminCreditIdempotencyKey(workspaceId: string) {
  const operationId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `admin-credit:${workspaceId}:${operationId}`;
}

export function buildAdminCommercialCreditPayload(user: AdminUserView | null, amountInput: string) {
  if (!user) return null;
  const amount = positiveMoneyAmount(amountInput, "请输入大于 0 的授信金额。");
  return {
    tenantId: user.tenantId,
    portalUserId: user.portalUserId,
    workspaceId: user.workspaceId,
    amount,
    currency: "CNY",
    idempotencyKey: adminCreditIdempotencyKey(user.workspaceId),
  };
}

function walletFromStatement(statement: AdminBillingStatementPayload | null) {
  const wallet = objectValue(statement?.wallet);
  return {
    balance: numberValue(wallet.balance),
    availableBalance: numberValue(wallet.availableBalance),
    frozenAmount: numberValue(wallet.activeFreeze || wallet.frozen),
  };
}

function runtimeGateDecision(gate: AdminRuntimeGatePayload | null): "allowed" | "blocked" | "unknown" {
  const admission = objectValue(gate?.commercialAdmission);
  if (admission.allowed === true || stringValue(admission.decision, "") === "allowed") return "allowed";
  if (admission.allowed === false || stringValue(admission.decision, "") === "blocked") return "blocked";
  return "unknown";
}

function runtimeGateReason(gate: AdminRuntimeGatePayload | null, error = "") {
  const admission = objectValue(gate?.commercialAdmission);
  const primaryAction = objectValue(objectValue(gate?.actionContract).primaryAction);
  return stringValue(admission.reason || primaryAction.reason || (error ? "ledger_unavailable" : ""), "unknown");
}

export function adminRuntimeGateReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    account_not_approved: "账号未批准",
    insufficient_balance: "余额不足",
    runtime_storage_ready: "allowed",
    runtime_storage_not_opened: "待开通 runtime/storage",
    provider_key_required: "待绑定 providerKeyRef",
  };
  return labels[reason] || reason.replace(/_/g, " ");
}

async function loadLedgerState(identity: AdminCommercialAccountInput) {
  const [billingStatement, runtimeFreeze, runtimeGate] = await Promise.all([
    fetchAdminBillingStatement(identity.workspaceId),
    fetchAdminRuntimeFreeze(identity.workspaceId),
    fetchAdminRuntimeGate(identity),
  ]);
  return {
    billingStatement,
    runtimeFreeze,
    runtimeGate,
    ledgerError: "",
  };
}

export async function loadAdminUsersModel() {
  const users = await fetchAdminUsers();
  const userViews = await Promise.all(users.items.map(async (item): Promise<AdminUserView> => {
    const identity = commercialIdentityFromItem(item);
    const ledgerState = await loadLedgerState(identity);
    const wallet = walletFromStatement(ledgerState.billingStatement);
    const statement = objectValue(ledgerState.billingStatement);
    const gate = objectValue(ledgerState.runtimeGate);
    const freeze = objectValue(ledgerState.runtimeFreeze);
    const decision = runtimeGateDecision(ledgerState.runtimeGate);
    return {
      id: item.id,
      name: item.name || item.email || item.id,
      email: item.email || "",
      status: adminUserStatus(item.status),
      balance: wallet.balance,
      availableBalance: wallet.availableBalance,
      frozenAmount: wallet.frozenAmount || numberValue(freeze.amount),
      workspaces: numberValue((item as any).taskCount || (item as any).workspaceCount),
      plan: (item as any).groupName || item.role || "未分组",
      tenantId: identity.tenantId,
      portalUserId: identity.portalUserId,
      workspaceId: identity.workspaceId,
      billingStatement: ledgerState.billingStatement,
      runtimeFreeze: ledgerState.runtimeFreeze,
      runtimeGate: ledgerState.runtimeGate,
      ledgerCount: numberValue(statement.ledgerCount || (Array.isArray(statement.rows) ? statement.rows.length : 0)),
      runtimeGateDecision: decision,
      runtimeGateReason: runtimeGateReason(ledgerState.runtimeGate, ledgerState.ledgerError),
      runtimeState: stringValue(gate.runtimeState, "unknown"),
      storageState: stringValue(gate.storageState, "unknown"),
      ledgerError: ledgerState.ledgerError,
      createdAt: dateText(item.createdAt),
    };
  }));
  return {
    users: userViews,
  };
}

export function useAdminUsersModel(refreshVersion: number) {
  return usePortalQuery(loadAdminUsersModel, [refreshVersion]);
}
