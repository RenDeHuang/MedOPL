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
import { executePortalProductionCloudOperation } from "../domain/portal-cloud-operation-production.mjs";

const PACKAGE_CLOUD_PLANS = Object.freeze({
  starter: Object.freeze({
    planId: "starter_2c4g_10gb",
    fileSpaceGb: 10,
    computeUnits: 1,
    targetDesiredCapacity: 1,
  }),
  pro: Object.freeze({
    planId: "pro_8c16g_100gb",
    fileSpaceGb: 100,
    computeUnits: 2,
    targetDesiredCapacity: 2,
  }),
});

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
  enableCloudOperationProductionBridge = false,
  cloudOperationRunnerMode = "local-executor",
  cloudOperationRunnerScript = "",
  cloudOperationSecretFile = "",
  cloudOperationComputeNodePoolRef = "",
  cloudOperationComputePoolBaselineCapacity = 2,
  repoRoot = "",
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
    if (enableCloudOperationProductionBridge) {
      await writeDb(db);
      return;
    }
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

  function productionBridgeOptions(operationType) {
    return {
      repoRoot,
      operationType,
      runnerMode: cloudOperationRunnerMode,
      runnerScript: cloudOperationRunnerScript,
      secretFile: cloudOperationSecretFile,
      computeNodePoolRef: cloudOperationComputeNodePoolRef,
      computePoolBaselineCapacity: cloudOperationComputePoolBaselineCapacity,
    };
  }

  function cloudPlanForPackage(packageId = "") {
    return PACKAGE_CLOUD_PLANS[String(packageId || "").trim()] || null;
  }

  function currentFileSpaceGb(db = {}, resourceBindingId = "") {
    const bindingId = String(resourceBindingId || "").trim();
    const latest = (Array.isArray(db.fileSpaceEntitlements) ? db.fileSpaceEntitlements : [])
      .filter((item) => String(item.resourceBindingId || "").trim() === bindingId)
      .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
    return Number(latest?.capacityGb || 0);
  }

  function cloudOperationPublicView(result = {}) {
    return {
      operationId: String(result.operation?.operationId || result.operation?.id || ""),
      operationType: String(result.operation?.operationType || ""),
      status: String(result.operation?.status || ""),
      dryRunReportRef: String(result.operation?.dryRunReportRef || ""),
      executionReportRef: String(result.operation?.executionReportRef || ""),
    };
  }

  function packageCloudResult({ plan, resourceBindingId, operations }) {
    return {
      productionPortalConnected: true,
      planId: plan.planId,
      fileSpaceGb: plan.fileSpaceGb,
      computeUnits: plan.computeUnits,
      targetDesiredCapacity: plan.targetDesiredCapacity,
      resourceBindingId,
      operations: operations.map(cloudOperationPublicView),
    };
  }

  function cloudFailureResult(result = {}) {
    return {
      ok: false,
      status: result.status || 502,
      error: result.error || "package_cloud_operation_failed",
      businessMessage: "套餐资源开通失败，请稍后重试。",
    };
  }

  function runCloudOperation(db, user, payload = {}, operationType = "") {
    return executePortalProductionCloudOperation(db, user, payload, productionBridgeOptions(operationType));
  }

  function existingBindingForWorkspace(db = {}, user = {}, workspaceId = "") {
    const userId = String(user?.id || "").trim();
    const tenantId = String(user?.tenantId || user?.id || "").trim();
    return (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : [])
      .filter((item) => String(item.userId || item.ownerUserId || "").trim() === userId)
      .filter((item) => String(item.tenantId || item.ownerTenantId || "").trim() === tenantId)
      .filter((item) => String(item.workspaceId || "").trim() === String(workspaceId || "").trim())
      .filter((item) => !["retention_protected", "deleted"].includes(String(item.status || "").trim()))
      .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
  }

  function runPackageOpenCloudOperations(db = {}, user = {}, { workspaceId = "", packageId = "" } = {}) {
    const plan = cloudPlanForPackage(packageId);
    if (!plan) return { ok: false, status: 422, error: "unsupported_package_cloud_plan" };
    const existing = existingBindingForWorkspace(db, user, workspaceId);
    if (existing) {
      return runPackageUpgradeCloudOperations(db, user, { workspaceId, packageId });
    }
    const createStorage = runCloudOperation(db, user, {
      workspaceId,
      fileSpaceGb: plan.fileSpaceGb,
      planId: plan.planId,
    }, "create_storage");
    if (!createStorage.ok) return cloudFailureResult(createStorage);
    const resourceBindingId = String(createStorage.resourceBindingId || "");
    const createCompute = runCloudOperation(db, user, {
      workspaceId,
      resourceBindingId,
      computeUnits: plan.computeUnits,
      targetDesiredCapacity: plan.targetDesiredCapacity,
      planId: plan.planId,
    }, "create_compute");
    if (!createCompute.ok) return cloudFailureResult(createCompute);
    return {
      ok: true,
      cloudOperationPackage: packageCloudResult({
        plan,
        resourceBindingId,
        operations: [createStorage, createCompute],
      }),
    };
  }

  function runPackageUpgradeCloudOperations(db = {}, user = {}, { workspaceId = "", packageId = "" } = {}) {
    const plan = cloudPlanForPackage(packageId);
    if (!plan) return { ok: false, status: 422, error: "unsupported_package_cloud_plan" };
    const binding = existingBindingForWorkspace(db, user, workspaceId);
    const resourceBindingId = String(binding?.resourceBindingId || binding?.id || "");
    if (!resourceBindingId) return { ok: false, status: 409, error: "resource_binding_required", businessMessage: "请先开通套餐，再进行升级。" };
    const operations = [];
    const currentCapacityGb = currentFileSpaceGb(db, resourceBindingId) || Number(binding.fileSpaceGb || 0);
    if (currentCapacityGb < plan.fileSpaceGb) {
      const expandStorage = runCloudOperation(db, user, {
        workspaceId,
        resourceBindingId,
        fileSpaceGb: plan.fileSpaceGb,
        planId: plan.planId,
      }, "expand_storage");
      if (!expandStorage.ok) return cloudFailureResult(expandStorage);
      operations.push(expandStorage);
    }
    const expandCompute = runCloudOperation(db, user, {
      workspaceId,
      resourceBindingId,
      computeUnits: plan.computeUnits,
      targetDesiredCapacity: plan.targetDesiredCapacity,
      planId: plan.planId,
    }, "expand_compute");
    if (!expandCompute.ok) return cloudFailureResult(expandCompute);
    operations.push(expandCompute);
    return {
      ok: true,
      cloudOperationPackage: packageCloudResult({
        plan,
        resourceBindingId,
        operations,
      }),
    };
  }

  function runStorageAddonCloudOperation(db = {}, user = {}, { workspaceId = "", addStorageGb = 0 } = {}) {
    const binding = existingBindingForWorkspace(db, user, workspaceId);
    const resourceBindingId = String(binding?.resourceBindingId || binding?.id || "");
    if (!resourceBindingId) return { ok: false, status: 409, error: "resource_binding_required", businessMessage: "请先开通套餐，再进行扩容。" };
    const currentCapacityGb = currentFileSpaceGb(db, resourceBindingId) || Number(binding.fileSpaceGb || 0);
    const targetFileSpaceGb = currentCapacityGb + Math.max(0, Number(addStorageGb || 0));
    const plan = {
      planId: String(binding.planId || binding.serverPlanId || "starter_2c4g_10gb"),
      fileSpaceGb: targetFileSpaceGb,
      computeUnits: Number(binding.computeUnits || 0),
      targetDesiredCapacity: Number(binding.targetDesiredCapacity || 0),
    };
    const expandStorage = runCloudOperation(db, user, {
      workspaceId,
      resourceBindingId,
      fileSpaceGb: targetFileSpaceGb,
      planId: plan.planId,
    }, "expand_storage");
    if (!expandStorage.ok) return cloudFailureResult(expandStorage);
    return {
      ok: true,
      cloudOperationPackage: packageCloudResult({
        plan,
        resourceBindingId,
        operations: [expandStorage],
      }),
    };
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
    const labStateBefore = snapshotLabBillingState(db);
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
    let packageCloud = null;
    if (enableCloudOperationProductionBridge) {
      packageCloud = runPackageOpenCloudOperations(db, user, { workspaceId, packageId: payload.packageId });
      if (!packageCloud.ok) {
        rollbackLabBillingState(db, labStateBefore);
        sendJson(res, {
          ok: false,
          error: packageCloud.error,
          businessMessage: packageCloud.businessMessage || "套餐资源开通失败，请稍后重试。",
        }, packageCloud.status || 400);
        return true;
      }
    }
    await persistLabBillingState(db, result);
    sendJson(res, {
      ok: true,
      created: result.created,
      ...(packageCloud?.cloudOperationPackage ? { cloudOperationPackage: packageCloud.cloudOperationPackage } : {}),
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
    const labStateBefore = snapshotLabBillingState(db);
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
    let packageCloud = null;
    if (enableCloudOperationProductionBridge) {
      packageCloud = runPackageUpgradeCloudOperations(db, user, { workspaceId: result.subscription.workspaceId, packageId: payload.packageId });
      if (!packageCloud.ok) {
        rollbackLabBillingState(db, labStateBefore);
        sendJson(res, {
          ok: false,
          error: packageCloud.error,
          businessMessage: packageCloud.businessMessage || "套餐资源升级失败，请稍后重试。",
        }, packageCloud.status || 400);
        return true;
      }
    }
    await persistLabBillingState(db, result);
    sendJson(res, {
      ok: true,
      created: result.created,
      ...(packageCloud?.cloudOperationPackage ? { cloudOperationPackage: packageCloud.cloudOperationPackage } : {}),
      ...subscriptionPayload(db, user, result.subscription, result.subscription.workspaceId),
    });
    return true;
  }

  async function handleStorageAddon({ req, res, db, user }) {
    const payload = await readJsonBody(req, res);
    if (!payload) return true;
    const subscription = resolveTargetSubscription(db, user, payload);
    const labStateBefore = snapshotLabBillingState(db);
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
    let packageCloud = null;
    if (enableCloudOperationProductionBridge) {
      packageCloud = runStorageAddonCloudOperation(db, user, {
        workspaceId: result.subscription.workspaceId,
        addStorageGb: Number(payload.storageGb ?? payload.addStorageGb ?? 100),
      });
      if (!packageCloud.ok) {
        rollbackLabBillingState(db, labStateBefore);
        sendJson(res, {
          ok: false,
          error: packageCloud.error,
          businessMessage: packageCloud.businessMessage || "存储资源扩容失败，请稍后重试。",
        }, packageCloud.status || 400);
        return true;
      }
    }
    await persistLabBillingState(db, result);
    sendJson(res, {
      ok: true,
      created: result.created,
      addon: result.addon,
      ...(packageCloud?.cloudOperationPackage ? { cloudOperationPackage: packageCloud.cloudOperationPackage } : {}),
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

  function snapshotLabBillingState(db = {}) {
    return {
      labSubscriptions: JSON.parse(JSON.stringify(Array.isArray(db.labSubscriptions) ? db.labSubscriptions : [])),
      labPackageEvents: JSON.parse(JSON.stringify(Array.isArray(db.labPackageEvents) ? db.labPackageEvents : [])),
      labStorageAddons: JSON.parse(JSON.stringify(Array.isArray(db.labStorageAddons) ? db.labStorageAddons : [])),
      labDailyCharges: JSON.parse(JSON.stringify(Array.isArray(db.labDailyCharges) ? db.labDailyCharges : [])),
    };
  }

  function rollbackLabBillingState(db = {}, snapshot = {}) {
    db.labSubscriptions = JSON.parse(JSON.stringify(Array.isArray(snapshot.labSubscriptions) ? snapshot.labSubscriptions : []));
    db.labPackageEvents = JSON.parse(JSON.stringify(Array.isArray(snapshot.labPackageEvents) ? snapshot.labPackageEvents : []));
    db.labStorageAddons = JSON.parse(JSON.stringify(Array.isArray(snapshot.labStorageAddons) ? snapshot.labStorageAddons : []));
    db.labDailyCharges = JSON.parse(JSON.stringify(Array.isArray(snapshot.labDailyCharges) ? snapshot.labDailyCharges : []));
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
