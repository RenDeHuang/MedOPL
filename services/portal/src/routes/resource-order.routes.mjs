import {
  quoteResourceOrderFromPlan,
  upsertQuotedResourceOrder,
} from "../domain/resource-orders.mjs";
import {
  buildServerPlansFallback,
  buildServerPlansSummary,
} from "../domain/server-plans.mjs";
import { createResourceOrderInternalRoutes } from "./resource-order-internal.routes.mjs";
import { createResourceOrderPublicRoutes } from "./resource-order-public.routes.mjs";
import { createResourceOrderProvisioningService } from "./resource-order-provisioning-service.mjs";
import {
  idempotencyKeyFor,
  selectServerPlan,
} from "./resource-order-route-support.mjs";

export function createResourceOrderRoutes({
  defaultTaskTitle,
  ensureTaskSpace,
  fetchServerPlans,
  logPortalEvent,
  normalizeAuthEmail,
  portalInternalAuthAllowed,
  readJsonBody,
  resourceProvisionerClient,
  sendJson,
  slugify,
  writeDb,
}) {
  async function resolveResourceOrderPlan(taskSpace, payload = {}) {
    const requestedPlanId = String(payload.planId || payload.serverPlanId || taskSpace?.serverPlanId || "").trim();
    const plansPayload = await fetchServerPlans() || buildServerPlansFallback();
    let plan = selectServerPlan(plansPayload, requestedPlanId);
    if (!plan && taskSpace?.serverPlanSnapshot) {
      plan = taskSpace.serverPlanSnapshot;
    }
    if (!plan && Array.isArray(plansPayload.items) && plansPayload.items.length === 1) {
      plan = plansPayload.items[0];
    }
    return { plan, plansPayload };
  }

  async function createQuotedResourceOrder(db, user, req, payload = {}, options = {}) {
    const taskSlug = slugify(payload.task || payload.taskSlug || payload.workspaceId || user.currentTaskSlug || "default");
    const taskSpace = await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    const { plan, plansPayload } = await resolveResourceOrderPlan(taskSpace, payload);
    if (!plan) {
      return {
        ok: false,
        status: 409,
        error: "server_plan_unavailable",
        message: "当前任务空间还没有可用服务器规格，请先在服务器与费用页选择规格。",
        plansSummary: buildServerPlansSummary(plansPayload),
      };
    }
    const idempotencyKey = idempotencyKeyFor(req, options.idempotencyPrefix || "resource-order-quote", user, taskSpace.slug, {
      ...payload,
      serverPlanId: plan.id || payload.serverPlanId || payload.planId || "",
    });
    const quotedOrder = quoteResourceOrderFromPlan({
      user,
      workspace: taskSpace,
      serverPlan: plan,
      input: {
        ...payload,
        serverPlanId: plan.id || payload.serverPlanId || payload.planId || "",
        workspaceSessionId: payload.workspaceSessionId || payload.workspace_session_id || "",
        runId: payload.runId || payload.run_id || "",
      },
      idempotencyKey,
    });
    const upserted = upsertQuotedResourceOrder(db, quotedOrder);
    return {
      ok: true,
      order: upserted.order,
      created: upserted.created,
      taskSpace,
      plan,
      plansSummary: buildServerPlansSummary(plansPayload),
    };
  }

  const { provisionResourceOrder } = createResourceOrderProvisioningService({
    fetchServerPlans,
    resourceProvisionerClient,
  });

  const handleResourceOrderInternalRoutes = createResourceOrderInternalRoutes({
    createQuotedResourceOrder,
    logPortalEvent,
    normalizeAuthEmail,
    portalInternalAuthAllowed,
    provisionResourceOrder,
    readJsonBody,
    sendJson,
    writeDb,
  });

  const handleResourceOrderPublicRoutes = createResourceOrderPublicRoutes({
    createQuotedResourceOrder,
    provisionResourceOrder,
    readJsonBody,
    resourceProvisionerClient,
    sendJson,
    writeDb,
  });

  return async function handleResourceOrderRoutes(context) {
    if (await handleResourceOrderInternalRoutes(context)) return true;
    if (!context.user) return false;
    if (await handleResourceOrderPublicRoutes(context)) return true;
    return false;
  };
}
