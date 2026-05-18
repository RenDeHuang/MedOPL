import {
  buildCommercialProfile,
} from "../domain/commercial-state.mjs";
import {
  buildServerPlansFallback,
  buildTaskSpaceServerPlanSelection,
  currentServerPlanSelection,
} from "../domain/server-plans.mjs";

function stringValue(value = "") {
  return String(value ?? "").trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanPlanValue(plan = {}, primaryKey = "isPurchasable") {
  if (typeof plan[primaryKey] === "boolean") return plan[primaryKey];
  return false;
}

function publicCatalogSource(value = "") {
  const normalized = stringValue(value).toLowerCase();
  if (normalized.includes("provider") || normalized.includes("tencent_cloud")) return "provider_catalog_snapshot";
  return "platform_catalog";
}

function publicPriceOrigin(value = "") {
  const normalized = stringValue(value).toLowerCase();
  if (normalized.includes("quote") || normalized.includes("inquiry")) return "provider_quote";
  if (normalized.includes("provider") || normalized.includes("tencent_cloud")) return "provider_catalog_snapshot";
  return "catalog_price";
}

function isServerPlanPurchasable(plan = {}) {
  return booleanPlanValue(plan, "isPurchasable");
}

function sanitizeServerPlanPublicItem(plan = {}) {
  const isPurchasable = booleanPlanValue(plan, "isPurchasable");
  const isSelectable = typeof plan.isSelectable === "boolean" ? plan.isSelectable : isPurchasable;
  return {
    id: stringValue(plan.id || plan.serverPlanId),
    name: stringValue(plan.name || plan.id || plan.serverPlanId),
    cpu: numberValue(plan.cpu, 0),
    memoryGb: numberValue(plan.memoryGb ?? plan.memory, 0),
    gpu: numberValue(plan.gpu ?? plan.gpuCount, 0),
    gpuCount: numberValue(plan.gpuCount ?? plan.gpu, 0),
    storageRequest: stringValue(plan.storageRequest),
    storageLimit: stringValue(plan.storageLimit),
    minBillableHours: Math.max(1, numberValue(plan.minBillableHours, 1)),
    riskFactor: numberValue(plan.riskFactor, 1),
    reservationFloor: numberValue(plan.reservationFloor, 0),
    currency: stringValue(plan.currency || "CNY") || "CNY",
    basePrice: null,
    pendingProductApproval: true,
    priceLabel: "正式售价未定价",
    priceOrigin: publicPriceOrigin(plan.priceOrigin || plan.pricingSource || "catalog_price"),
    catalogSource: publicCatalogSource(plan.catalogSource || plan.source || "platform_catalog"),
    availabilityCategory: stringValue(plan.availabilityCategory || plan.availabilityStatus || plan.statusCategory),
    unavailableReason: isPurchasable ? "" : stringValue(plan.unavailableReason || plan.reason || plan.soldOutReason),
    isPurchasable,
    isSelectable,
    provisioningMode: stringValue(plan.provisioningMode || "platform_provisioned_runtime"),
    selectionNote: stringValue(plan.selectionNote || "平台根据套餐开通客户专属运行环境、文件空间与计费绑定。"),
    priceUpdatedAt: stringValue(plan.priceUpdatedAt),
  };
}

function sanitizeSelectedServerPlanPublic(selection = null) {
  if (!selection || typeof selection !== "object") return null;
  return sanitizeServerPlanPublicItem({
    ...selection,
    isPurchasable: true,
    isSelectable: true,
  });
}

function buildPublicServerPlansSummary(payload = {}, items = []) {
  return {
    catalogSource: stringValue(payload.catalogSource || "platform_catalog"),
    catalogCount: numberValue(payload.catalogCount ?? payload.catalogRuntimeStatus?.catalogCount ?? items.length, items.length),
    candidateCount: numberValue(payload.candidateCount ?? items.length, items.length),
    purchasableCount: items.filter((item) => item.isPurchasable).length,
    selectableCount: items.filter((item) => item.isSelectable).length,
    availabilitySnapshotCount: numberValue(payload.availabilitySnapshotCount, 0),
    priceStatus: "pending_product_approval",
    pricingStatus: "pending_product_approval",
    basePrice: null,
    pendingProductApproval: true,
    note: "套餐目录由平台维护；正式售卖价等待产品审批，保护金和后台对账按平台规则校准。",
  };
}

function sanitizeServerPlansCommercialProfile(commercial = {}) {
  if (!commercial || typeof commercial !== "object") return commercial;
  return {
    ...commercial,
    priceTransparency: "套餐价格由平台后台价格源、保护金规则与对账记录校准。",
  };
}

function sanitizeServerPlansPublicPayload(payload = {}, {
  commercial,
  selectedServerPlan,
  workspaceId,
} = {}) {
  const items = (Array.isArray(payload.items) ? payload.items : [])
    .map(sanitizeServerPlanPublicItem)
    .filter((item) => item.id);
  const catalogRuntimeStatus = payload.catalogRuntimeStatus && typeof payload.catalogRuntimeStatus === "object"
    ? {
        status: stringValue(payload.catalogRuntimeStatus.status || "ready"),
        catalogCount: numberValue(payload.catalogRuntimeStatus.catalogCount ?? payload.catalogCount ?? items.length, items.length),
        candidateCount: numberValue(payload.catalogRuntimeStatus.candidateCount ?? items.length, items.length),
      }
    : {
        status: items.length > 0 ? "ready" : "empty",
        catalogCount: numberValue(payload.catalogCount ?? items.length, items.length),
        candidateCount: items.length,
      };
  const pricingSourceStatus = payload.pricingSourceStatus && typeof payload.pricingSourceStatus === "object"
    ? {
        status: stringValue(payload.pricingSourceStatus.status || "catalog_price"),
        priceOrigin: stringValue(payload.pricingSourceStatus.priceOrigin || "catalog_price"),
        quotedCount: numberValue(payload.pricingSourceStatus.quotedCount, 0),
        pendingSource: stringValue(payload.pricingSourceStatus.pendingSource || "platform_provisioned_local_metering"),
      }
    : {
        status: "catalog_price",
        priceOrigin: "catalog_price",
        quotedCount: 0,
        pendingSource: "platform_provisioned_local_metering",
      };
  return {
    ok: payload.ok !== false,
    catalogSource: stringValue(payload.catalogSource || "platform_catalog"),
    catalogRuntimeStatus,
    pricingSourceStatus,
    availabilitySyncEnabled: Boolean(payload.availabilitySyncEnabled),
    availabilitySnapshotCount: numberValue(payload.availabilitySnapshotCount, 0),
    catalogCount: catalogRuntimeStatus.catalogCount,
    candidateCount: items.length,
    purchasableCount: items.filter((item) => item.isPurchasable).length,
    selectableCount: items.filter((item) => item.isSelectable).length,
    items,
    summary: buildPublicServerPlansSummary(payload, items),
    commercial: sanitizeServerPlansCommercialProfile(commercial),
    selectedServerPlan: sanitizeSelectedServerPlanPublic(selectedServerPlan),
    workspaceId,
    freezePolicy: {
      source: "platform_pricing_source",
      basis: "平台套餐价格源、保护金规则与最小计费单元。",
      finalBilling: "最终扣费以平台后台对账记录校准。",
      minBillableHoursDefault: 1,
      pendingCostIntervalSeconds: 60,
      pendingSource: "platform_provisioned_local_metering",
    },
  };
}

export function createPortalServerPlanRuntimeHandler({
  defaultTaskTitle,
  ensureTaskSpace,
  evaluateUserPolicy,
  fetchBillingStatus,
  fetchServerPlans,
  findTaskSpace,
  logPortalEvent,
  readBody,
  sendJson,
  slugify,
  writeDb,
}) {
  return async function handleServerPlanRoutes({ req, res, url, db, user }) {
    if (req.method === "POST" && url.pathname === "/portal/api/server-plans/select") {
      let payload = {};
      try {
        payload = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      } catch {
        sendJson(res, { ok: false, error: "invalid_json_body" }, 400);
        return true;
      }
      const requestedTask = stringValue(payload.task || user.currentTaskSlug);
      const taskSlug = requestedTask ? slugify(requestedTask) : "";
      if (!taskSlug) {
        sendJson(res, {
          ok: false,
          error: "workspace_id_required",
          message: "必须指定要调整套餐的工作空间。",
        }, 422);
        return true;
      }
      const planId = String(payload.planId || payload.serverPlanId || "").trim();
      if (!planId) {
        sendJson(res, { ok: false, error: "server_plan_id_required" }, 400);
        return true;
      }
      const plansPayload = await fetchServerPlans() || buildServerPlansFallback();
      const plan = (Array.isArray(plansPayload.items) ? plansPayload.items : []).find((item) => String(item.id || "").trim() === planId);
      if (!plan) {
        sendJson(res, { ok: false, error: "server_plan_not_found" }, 404);
        return true;
      }
      if (!isServerPlanPurchasable(plan)) {
        sendJson(res, { ok: false, error: "server_plan_not_purchasable", reason: plan.unavailableReason || plan.availabilityCategory || plan.reason || plan.priceStatus || "" }, 409);
        return true;
      }
      const taskSpace = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
      const selection = buildTaskSpaceServerPlanSelection({
        ...plan,
        isSelectable: true,
        priceOrigin: plan.priceOrigin,
        priceStatus: plan.pricingSourceStatus?.status || plan.priceStatus,
      });
      taskSpace.serverPlanId = selection?.id || "";
      taskSpace.serverPlanRegion = selection?.region || "";
      taskSpace.serverPlanSnapshot = selection;
      taskSpace.updatedAt = new Date().toISOString();
      user.currentTaskSlug = taskSpace.slug;
      await logPortalEvent({
        type: "server_plan_selected",
        userId: user.id,
        workspaceId: taskSpace.slug,
        detail: { serverPlanId: taskSpace.serverPlanId, region: taskSpace.serverPlanRegion },
      });
      await writeDb(db);
      sendJson(res, {
        ok: true,
        workspaceId: taskSpace.slug,
        selectedServerPlan: sanitizeSelectedServerPlanPublic(currentServerPlanSelection(taskSpace)),
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/portal/api/server-plans") {
      const payload = await fetchServerPlans() || buildServerPlansFallback();
      await fetchBillingStatus();
      const policy = await evaluateUserPolicy(db, user);
      const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
      const commercial = buildCommercialProfile(db, user, { wallet, policy });
      const requestedTask = stringValue(url.searchParams.get("task") || user.currentTaskSlug);
      const taskSlug = requestedTask ? slugify(requestedTask) : "";
      const taskSpace = taskSlug ? findTaskSpace(db, user.id, taskSlug) || null : null;
      sendJson(res, sanitizeServerPlansPublicPayload(payload, {
        commercial,
        selectedServerPlan: currentServerPlanSelection(taskSpace),
        workspaceId: taskSpace?.slug || taskSlug || "",
      }));
      return true;
    }

    return false;
  };
}
