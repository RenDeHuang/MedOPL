import {
  buildCommercialProfile,
} from "../domain/commercial-state.mjs";
import {
  buildServerPlansFallback,
  buildServerPlansSummary,
  buildTaskSpaceServerPlanSelection,
  currentServerPlanSelection,
} from "../domain/server-plans.mjs";

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
      const taskSlug = slugify(payload.task || user.currentTaskSlug || "default");
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
      if (!plan.salable) {
        sendJson(res, { ok: false, error: "server_plan_not_salable", reason: plan.reason || plan.priceStatus || "" }, 409);
        return true;
      }
      const taskSpace = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
      const selection = buildTaskSpaceServerPlanSelection(plan);
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
        selectedServerPlan: currentServerPlanSelection(taskSpace),
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/portal/api/server-plans") {
      const payload = await fetchServerPlans() || buildServerPlansFallback();
      const billingStatus = await fetchBillingStatus();
      const cloudStatus = payload.cloudStatus || billingStatus?.cloudStatus || null;
      const enrichedPayload = { ...payload, cloudStatus };
      const policy = await evaluateUserPolicy(db, user);
      const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
      const commercial = buildCommercialProfile(db, user, { wallet, policy });
      const taskSlug = slugify(url.searchParams.get("task") || user.currentTaskSlug || "default");
      const taskSpace = findTaskSpace(db, user.id, taskSlug) || null;
      sendJson(res, {
        ...enrichedPayload,
        summary: buildServerPlansSummary(enrichedPayload),
        commercial,
        selectedServerPlan: currentServerPlanSelection(taskSpace),
        workspaceId: taskSpace?.slug || taskSlug,
        freezePolicy: {
          source: "tencent_cloud_price",
          basis: "腾讯云 InquiryPriceRunInstances 实时报价 + 平台规格目录 + 最小计费单元",
          finalBilling: "腾讯云账单明细 DescribeBillDetail 回补为最终真实扣费依据",
          minBillableHoursDefault: 1,
          pendingCostIntervalSeconds: 60,
          opencostRole: "仅用于运行中近实时分摊观测，不作为最终扣费账单。",
        },
      });
      return true;
    }

    return false;
  };
}
