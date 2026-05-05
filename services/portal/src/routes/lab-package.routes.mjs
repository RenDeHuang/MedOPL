import { labPackageCatalogPublicView, listLabPackages, packagePublicView } from "../domain/lab-packages.mjs";
import {
  activateLabSubscription,
  currentLabSubscription,
  purchaseLabStorageAddon,
  upgradeLabSubscription,
} from "../domain/lab-subscriptions.mjs";
import { resolveLabEntitlement } from "../domain/lab-entitlements.mjs";
import { ensureWallet } from "../domain/wallet-ledger.mjs";
import { labActiveFreezeAmount } from "../domain/lab-billing-policy.mjs";

function subscriptionPackageName(subscription) {
  if (!subscription) return null;
  return listLabPackages().find((item) => item.id === subscription.packageId)?.name || subscription.packageId;
}

function walletPayload(wallet, activeFreeze) {
  const balance = Number(wallet.balance || 0);
  return {
    balance,
    activeFreeze,
    availableBalance: Number((balance - activeFreeze).toFixed(2)),
    currency: "CNY",
  };
}

export function createLabPackageRoutes({
  readBody,
  sendJson,
  writeDb,
}) {
  async function readJsonBody(req, res) {
    try {
      return JSON.parse((await readBody(req)).toString("utf8") || "{}");
    } catch {
      sendJson(res, { ok: false, error: "invalid_json", businessMessage: "请求格式错误：请提交合法的 JSON。" }, 400);
      return null;
    }
  }

  function subscriptionPayload(db, user, subscription, workspaceId = "default") {
    const wallet = ensureWallet(db, user.id);
    const activeFreeze = subscription ? labActiveFreezeAmount(db, subscription.id) : 0;
    const walletView = walletPayload(wallet, activeFreeze);
    return {
      subscription,
      status: subscription?.status || "disabled",
      currentPackageId: subscription?.packageId || null,
      currentPackageName: subscriptionPackageName(subscription),
      balance: walletView.balance,
      frozenAmount: activeFreeze,
      currency: "CNY",
      wallet: walletView,
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
      catalog: labPackageCatalogPublicView(),
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
      customSpec: payload.customSpec || null,
      idempotencyKey: payload.idempotencyKey,
    });
    if (!result.ok) {
      sendJson(res, {
        ok: false,
        error: result.error,
        businessMessage: result.businessMessage || "套餐开通失败，请稍后重试。",
      }, result.status || 400);
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
      customSpec: payload.customSpec || null,
      idempotencyKey: payload.idempotencyKey,
    });
    if (!result.ok) {
      sendJson(res, {
        ok: false,
        error: result.error,
        businessMessage: result.businessMessage || "套餐升级失败，请稍后重试。",
      }, result.status || 400);
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
      sendJson(res, {
        ok: false,
        error: result.error,
        businessMessage: result.businessMessage || "扩容失败，请稍后重试。",
      }, result.status || 400);
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

  async function handleCustomPackage(context) {
    const { req, res, db, user } = context;
    const payload = await readJsonBody(req, res);
    if (!payload) return true;
    const workspaceId = String(payload.workspaceId || "default").trim() || "default";
    const subscription = currentLabSubscription(db, { user, workspaceId });
    const result = submitCustomLabPackage(db, { user, workspaceId, subscription, payload });
    if (!result.ok) {
      sendJson(res, {
        ok: false,
        error: result.error,
        businessMessage: result.businessMessage || "自定义套餐提交失败，请检查规格后重试。",
      }, result.status || 400);
      return true;
    }
    await persistLabBillingState(db, result);
    sendJson(res, {
      ok: true,
      action: subscription ? "upgrade" : "activate",
      created: result.created,
      ...subscriptionPayload(db, user, result.subscription, result.subscription.workspaceId),
    }, result.created ? 201 : 200);
    return true;
  }

  function submitCustomLabPackage(db, { user, workspaceId, subscription, payload }) {
    const input = {
      user,
      packageId: "custom",
      customSpec: payload.customSpec || payload,
      idempotencyKey: payload.idempotencyKey,
    };
    if (subscription) {
      return upgradeLabSubscription(db, { ...input, subscriptionId: subscription.id });
    }
    return activateLabSubscription(db, { ...input, workspaceId });
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
    if (req.method === "POST" && url.pathname === "/portal/api/lab-packages/custom") return handleCustomPackage(context);
    if (req.method === "POST" && url.pathname === "/portal/api/lab-storage/addons") return handleStorageAddon(context);
    return false;
  };
}
