import { listLabPackages, packagePublicView } from "../domain/lab-packages.mjs";
import {
  activateLabSubscription,
  currentLabSubscription,
  purchaseLabStorageAddon,
  upgradeLabSubscription,
} from "../domain/lab-subscriptions.mjs";
import { resolveLabEntitlement } from "../domain/lab-entitlements.mjs";
import { ensureWallet } from "../domain/wallet-ledger.mjs";
import { labActiveFreezeAmount } from "../domain/lab-billing-policy.mjs";

export function createLabPackageRoutes({
  readBody,
  sendJson,
  writeDb,
}) {
  async function readJsonBody(req, res) {
    try {
      return JSON.parse((await readBody(req)).toString("utf8") || "{}");
    } catch {
      sendJson(res, { ok: false, error: "invalid_json" }, 400);
      return null;
    }
  }

  function subscriptionPayload(db, user, subscription, workspaceId = "default") {
    const wallet = ensureWallet(db, user.id);
    const activeFreeze = subscription ? labActiveFreezeAmount(db, subscription.id) : 0;
    const packageName = subscription
      ? (listLabPackages().find((item) => item.id === subscription.packageId)?.name || subscription.packageId)
      : null;
    return {
      subscription,
      status: subscription?.status || "disabled",
      currentPackageId: subscription?.packageId || null,
      currentPackageName: packageName,
      balance: Number(wallet.balance || 0),
      frozenAmount: activeFreeze,
      currency: "CNY",
      wallet: {
        balance: Number(wallet.balance || 0),
        activeFreeze,
        availableBalance: Number((Number(wallet.balance || 0) - activeFreeze).toFixed(2)),
        currency: "CNY",
      },
      entitlement: resolveLabEntitlement(db, { user, workspaceId }),
    };
  }

  async function persistLabBillingState(db, result = {}) {
    if (typeof writeDb.persistLabBillingState === "function") {
      await writeDb.persistLabBillingState({
        db,
        subscription: result.subscription,
        subscriptionId: result.subscription?.id,
        addon: result.addon || null,
      });
      return;
    }
    await writeDb(db);
  }

  async function handleListPackages({ req, res, url }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/lab-packages") return false;
    sendJson(res, {
      ok: true,
      source: "lab_packages",
      items: listLabPackages().map(packagePublicView),
    });
    return true;
  }

  async function handleGetSubscription({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/lab-subscription") return false;
    const workspaceId = String(url.searchParams.get("workspaceId") || "default").trim() || "default";
    const subscription = currentLabSubscription(db, { user, workspaceId });
    sendJson(res, {
      ok: true,
      ...subscriptionPayload(db, user, subscription, workspaceId),
    });
    return true;
  }

  async function handleGetEntitlement({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/lab-entitlement") return false;
    const workspaceId = String(url.searchParams.get("workspaceId") || "default").trim() || "default";
    sendJson(res, {
      ok: true,
      workspaceId,
      entitlement: resolveLabEntitlement(db, { user, workspaceId }),
    });
    return true;
  }

  async function handleActivate({ req, res, db, user }) {
    const payload = await readJsonBody(req, res);
    if (!payload) return true;
    const workspaceId = String(payload.workspaceId || payload.task || "default").trim() || "default";
    const result = activateLabSubscription(db, {
      user,
      workspaceId,
      packageId: payload.packageId,
      idempotencyKey: payload.idempotencyKey,
    });
    if (!result.ok) {
      sendJson(res, { ok: false, error: result.error }, result.status || 400);
      return true;
    }
    await persistLabBillingState(db, result);
    sendJson(res, {
      ok: true,
      created: result.created,
      ...subscriptionPayload(db, user, result.subscription, workspaceId),
    }, result.created ? 201 : 200);
    return true;
  }

  async function handleUpgrade({ req, res, db, user }) {
    const payload = await readJsonBody(req, res);
    if (!payload) return true;
    const workspaceId = String(payload.workspaceId || "default").trim() || "default";
    const subscription = payload.subscriptionId
      ? { id: String(payload.subscriptionId) }
      : currentLabSubscription(db, { user, workspaceId });
    const result = upgradeLabSubscription(db, {
      user,
      subscriptionId: subscription?.id || "",
      packageId: payload.packageId,
      idempotencyKey: payload.idempotencyKey,
    });
    if (!result.ok) {
      sendJson(res, { ok: false, error: result.error }, result.status || 400);
      return true;
    }
    await persistLabBillingState(db, result);
    sendJson(res, {
      ok: true,
      created: result.created,
      ...subscriptionPayload(db, user, result.subscription, result.subscription.workspaceId),
    });
    return true;
  }

  async function handleStorageAddon({ req, res, db, user }) {
    const payload = await readJsonBody(req, res);
    if (!payload) return true;
    const subscription = resolveTargetSubscription(db, user, payload);
    const result = purchaseLabStorageAddon(db, {
      user,
      subscriptionId: subscription?.id || "",
      storageGb: Number(payload.storageGb ?? payload.addStorageGb ?? 100),
      idempotencyKey: payload.idempotencyKey,
    });
    if (!result.ok) {
      sendJson(res, { ok: false, error: result.error }, result.status || 400);
      return true;
    }
    await persistLabBillingState(db, result);
    sendJson(res, {
      ok: true,
      created: result.created,
      addon: result.addon,
      ...subscriptionPayload(db, user, result.subscription, result.subscription.workspaceId),
    }, result.created ? 201 : 200);
    return true;
  }

  function resolveTargetSubscription(db, user, payload = {}) {
    if (payload.subscriptionId) return { id: String(payload.subscriptionId) };
    const workspaceId = String(payload.workspaceId || "default").trim() || "default";
    return currentLabSubscription(db, { user, workspaceId });
  }

  return async function handleLabPackageRoutes(context) {
    const { req, url } = context;
    if (await handleListPackages(context)) return true;
    if (await handleGetSubscription(context)) return true;
    if (await handleGetEntitlement(context)) return true;
    if (req.method === "POST" && url.pathname === "/portal/api/lab-packages/activate") return handleActivate(context);
    if (req.method === "POST" && url.pathname === "/portal/api/lab-packages/upgrade") return handleUpgrade(context);
    if (req.method === "POST" && url.pathname === "/portal/api/lab-storage/addons") return handleStorageAddon(context);
    return false;
  };
}
