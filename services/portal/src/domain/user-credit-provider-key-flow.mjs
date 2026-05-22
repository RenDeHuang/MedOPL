import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createGflabProviderConfig } from "./provider-config.mjs";
import { appendLedgerEntry, ensureWallet, moneyAmount } from "./wallet-ledger.mjs";

const domainRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(domainRoot, "../../../");
const medWorkspaceRoot = path.join(repoRoot, ".runtime", "med-autoscience", "workspaces");

function text(value) {
  return String(value ?? "").trim();
}

function lowerText(value) {
  return text(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function workspacePathFor(userId = "", workspaceId = "") {
  const workspaceSlug = text(workspaceId);
  return workspaceSlug ? path.join(medWorkspaceRoot, text(userId), workspaceSlug) : "";
}

function userTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function publicUser(user = {}) {
  return {
    id: text(user.id),
    userId: text(user.id),
    tenantId: userTenantId(user),
    email: text(user.email),
    name: text(user.name),
    role: text(user.role || "user"),
    status: text(user.status || "active"),
  };
}

function publicTenant(tenant = {}, tenantId = "") {
  return {
    id: text(tenant.id || tenant.tenantId || tenantId),
    tenantId: text(tenant.id || tenant.tenantId || tenantId),
    slug: text(tenant.slug || tenant.name || tenantId),
    status: text(tenant.status || "active"),
    runtimeOwnership: "platform_provisioned",
    isolationMode: "customer_dedicated",
  };
}

function publicBalance(wallet = {}) {
  const balance = moneyAmount(wallet.balance, 0);
  return {
    balance,
    balanceCents: Math.round(balance * 100),
    currency: text(wallet.currency || "CNY") || "CNY",
    updatedAt: text(wallet.updatedAt),
  };
}

function ensureArrayField(db, key) {
  db[key] = Array.isArray(db[key]) ? db[key] : [];
  return db[key];
}

export function ensureV22PortalUser(db = {}, input = {}) {
  const requestedUserId = text(input.userId || input.id);
  const email = lowerText(input.email);
  const name = text(input.name || email || requestedUserId);
  const tenantId = text(input.tenantId || requestedUserId || email);
  const workspaceId = text(input.workspaceId || input.workspaceSlug);

  if (!requestedUserId) return { ok: false, status: 422, error: "user_id_required" };
  if (!tenantId) return { ok: false, status: 422, error: "tenant_id_required" };
  if (!email) return { ok: false, status: 422, error: "email_required" };
  if (!name) return { ok: false, status: 422, error: "name_required" };
  if (!workspaceId) return { ok: false, status: 422, error: "workspace_id_required" };

  const users = ensureArrayField(db, "users");
  const tenants = ensureArrayField(db, "tenants");
  const taskSpaces = ensureArrayField(db, "taskSpaces");
  ensureArrayField(db, "wallets");

  const duplicateEmail = users.find((item) => lowerText(item.email) === email && text(item.id) !== requestedUserId);
  if (duplicateEmail) return { ok: false, status: 409, error: "email_already_exists" };

  let tenant = tenants.find((item) => text(item.id || item.tenantId) === tenantId);
  let tenantCreated = false;
  if (!tenant) {
    tenant = {
      id: tenantId,
      slug: text(input.tenantSlug || tenantId),
      status: "active",
      runtimeOwnership: "platform_provisioned",
      isolationMode: "customer_dedicated",
      createdAt: nowIso(),
    };
    tenants.push(tenant);
    tenantCreated = true;
  }

  let user = users.find((item) => text(item.id) === requestedUserId);
  let userCreated = false;
  if (!user) {
    user = {
      id: requestedUserId,
      tenantId,
      email,
      name,
      role: "user",
      status: "active",
      currentTaskSlug: workspaceId,
      preferences: { theme: "light" },
      createdAt: nowIso(),
      authSource: "portal_prepared_user",
    };
    users.push(user);
    userCreated = true;
  } else {
    user.tenantId = userTenantId(user) || tenantId;
    user.email = email || user.email;
    user.name = name || user.name;
    user.role = text(user.role || "user");
    user.status = text(user.status || "active");
    user.currentTaskSlug = text(user.currentTaskSlug || workspaceId);
  }

  const wallet = ensureWallet(db, user.id);
  wallet.currency = text(wallet.currency || "CNY") || "CNY";
  wallet.updatedAt = text(wallet.updatedAt || nowIso());

  let taskSpace = taskSpaces.find((item) => text(item.userId || item.ownerUserId) === user.id && text(item.slug || item.workspaceId || item.id) === workspaceId);
  let workspaceCreated = false;
  if (!taskSpace) {
    taskSpace = {
      id: workspaceId,
      slug: workspaceId,
      workspaceId,
      userId: user.id,
      ownerUserId: user.id,
      ownerTenantId: userTenantId(user),
      title: text(input.workspaceTitle || workspaceId),
      path: workspacePathFor(user.id, workspaceId),
      status: "active",
      serverPlanId: "starter_2c4g_10gb",
      createdAt: nowIso(),
    };
    taskSpaces.push(taskSpace);
    workspaceCreated = true;
  }

  return {
    ok: true,
    created: userCreated || tenantCreated || workspaceCreated,
    user: publicUser(user),
    tenant: publicTenant(tenant, tenantId),
    balance: publicBalance(wallet),
    workspace: {
      id: text(taskSpace.id || taskSpace.slug || workspaceId),
      workspaceId: text(taskSpace.workspaceId || taskSpace.slug || workspaceId),
      slug: text(taskSpace.slug || workspaceId),
      status: text(taskSpace.status || "active"),
    },
  };
}

export function creditV22PortalUser(db = {}, input = {}, actor = {}) {
  const userId = text(input.userId || actor?.id);
  const user = ensureArrayField(db, "users").find((item) => text(item.id) === userId);
  if (!user) return { ok: false, status: 404, error: "user_not_found" };

  const amount = moneyAmount(input.amount, 0);
  if (amount <= 0) return { ok: false, status: 422, error: "credit_amount_required" };

  const wallet = ensureWallet(db, user.id);
  const idempotencyKey = text(input.idempotencyKey || `v22-credit:${user.id}:${amount}:${randomUUID()}`);
  db.ledger = Array.isArray(db.ledger) ? db.ledger : [];
  const existing = db.ledger.find((entry) => text(entry.idempotencyKey || entry.idempotency_key) === idempotencyKey);
  if (existing) {
    return {
      ok: true,
      user: publicUser(user),
      balance: publicBalance(wallet),
      ledgerEntry: {
        id: existing.id,
        type: existing.type,
        amount: existing.amount,
        currency: existing.currency,
        created: false,
      },
    };
  }

  wallet.balance = moneyAmount(wallet.balance + amount, 0);
  wallet.currency = text(wallet.currency || input.currency || "CNY") || "CNY";
  wallet.updatedAt = nowIso();

  const ledger = appendLedgerEntry(db, {
    tenantId: userTenantId(user),
    userId: user.id,
    billingAccountId: text(input.billingAccountId || userTenantId(user) || user.id),
    type: "topup",
    amount,
    currency: wallet.currency,
    sourceType: "v22_portal_credit",
    sourceId: text(input.sourceId || actor?.id || "platform"),
    idempotencyKey,
    reason: text(input.reason || "v22_user_credit"),
    operatorId: text(actor?.id || input.operatorId || "platform"),
    createdAt: nowIso(),
  });

  return {
    ok: true,
    user: publicUser(user),
    balance: publicBalance(wallet),
    ledgerEntry: {
      id: ledger.entry.id,
      type: ledger.entry.type,
      amount: ledger.entry.amount,
      currency: ledger.entry.currency,
      created: ledger.created,
    },
  };
}

export async function bindV22GflabProviderKey(db = {}, user = {}, input = {}, { providerSecretStore } = {}) {
  const provider = text(input.provider || "gflabtoken");
  if (provider !== "gflabtoken") return { ok: false, status: 422, error: "provider_must_be_gflabtoken" };
  const apiKey = text(input.apiKey || input.providerApiKey);
  const created = createGflabProviderConfig({
    userId: text(user.id),
    workspaceId: text(input.workspaceId || user.currentTaskSlug || ""),
    apiKey,
  });
  if (!created.ok) return { ok: false, status: 422, error: created.error || "provider_api_key_required" };
  if (!providerSecretStore || typeof providerSecretStore.writeProviderSecret !== "function") {
    return { ok: false, status: 503, error: "provider_secret_store_required" };
  }

  await providerSecretStore.writeProviderSecret(created.providerKeyRef, created.providerSecret);

  const bindings = ensureArrayField(db, "providerKeyBindings");
  const binding = {
    id: `provider-binding-${randomUUID()}`,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(input.workspaceId || user.currentTaskSlug || ""),
    provider: "gflabtoken",
    providerKeyRef: created.providerKeyRef,
    providerConfigSecretRef: created.providerConfigSecretRef,
    boundStatus: "bound",
    providerConfigStatus: "configured",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  bindings.push(binding);

  return {
    ok: true,
    provider: "gflabtoken",
    providerBound: true,
    providerKeyRef: binding.providerKeyRef,
    boundStatus: binding.boundStatus,
  };
}

export function managedEnvironmentReadinessFromState(state = {}) {
  if (!state.providerBound || !text(state.providerKeyRef)) {
    return {
      ok: false,
      status: 409,
      error: "provider_key_required",
      code: "provider_key_required",
      readyForManagedEnvironment: false,
      providerBound: false,
      providerKeyRef: "",
    };
  }
  return {
    ok: true,
    status: 200,
    readyForManagedEnvironment: true,
    providerMode: "user_gflabtoken",
    providerBound: true,
    providerKeyRef: text(state.providerKeyRef),
  };
}
