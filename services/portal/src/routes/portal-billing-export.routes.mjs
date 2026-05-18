import { randomUUID } from "node:crypto";

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function microMoney(value) {
  return Number(value || 0).toFixed(5);
}

function parseHourWindow(value) {
  const raw = String(value || "").trim();
  if (!/^\d+h$/.test(raw)) return null;
  const hours = Number(raw.slice(0, -1));
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

function withinHourWindow(isoString, hours) {
  if (!hours) return true;
  const ts = Date.parse(String(isoString || ""));
  if (!Number.isFinite(ts)) return false;
  return ts >= Date.now() - hours * 60 * 60 * 1000;
}

function labelKeyAliases(key = "") {
  const text = String(key || "").trim();
  const compact = text.replace(/_/g, "");
  const dashed = text.replace(/_/g, "-");
  if (!text) return [];
  return [...new Set([text, compact, dashed])];
}

function billingLabelValue(item = {}, key = "") {
  const props = item?.properties || {};
  const labels = props.labels || {};
  for (const alias of labelKeyAliases(key)) {
    const value = labels[alias] || props[`label:${alias}`] || props[alias] || labels[`gaofenglab/${alias}`] || props[`gaofenglab/${alias}`] || "";
    if (value) return value;
  }
  return "";
}

function billingItemMatchesRun(item = {}, runId = "") {
  const target = String(runId || "").trim();
  if (!target) return false;
  return billingLabelValue(item, "run_id") === target || String(item?.name || "").includes(target);
}

function billingItemMatchesUser(item = {}, userId = "") {
  const target = String(userId || "").trim();
  if (!target) return false;
  return billingLabelValue(item, "customer_id") === target || billingLabelValue(item, "tenant_id") === target;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function writeCsv(res, fileName, lines) {
  res.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${fileName}"`,
  });
  res.end(lines.join("\n"));
}

function adminForbidden({ res, user, sendHtml, layoutV2 }) {
  if (user.role === "admin") return false;
  sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
  return true;
}

export function createPortalBillingExportRoutes({
  buildBillingPayload,
  fetchBillingSummary,
  fetchPendingSummary,
  layoutV2,
  logPortalEvent,
  parseForm,
  readBillingRequestOptions,
  readBody,
  sendHtml,
  writeDb,
}) {
  async function readForm(req) {
    return parseForm((await readBody(req)).toString("utf8"));
  }

  async function handleBillingExport({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/billing/export.csv") return false;
    const payload = await buildBillingPayload(db, user, readBillingRequestOptions(url));
    const lines = [
      ["entryId", "type", "amount", "reason", "createdAt", "workspaceId", "runId", "resourceBindingId", "pricingSource"].join(","),
      ...payload.ledger.map((item) => [
        csvEscape(item.id),
        csvEscape(item.type),
        csvEscape(money(item.amount)),
        csvEscape(item.reason || item.type),
        csvEscape(item.createdAt || ""),
        csvEscape(item.workspaceId || ""),
        csvEscape(item.runId || ""),
        csvEscape(item.resourceBindingId || ""),
        csvEscape(item.type === "pending_usage" ? "platform_metering_projection" : "portal_billing_ledger"),
      ].join(",")),
    ];
    writeCsv(res, "portal-billing-export.csv", lines);
    return true;
  }

  async function handleTaskBillingExport({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/billing/tasks-export.csv") return false;
    const payload = await buildBillingPayload(db, user, readBillingRequestOptions(url));
    const lines = [
      ["workspaceSlug", "workspaceTitle", "runCount", "cpuCost", "gpuCost", "storageCost", "totalCost"].join(","),
      ...payload.taskCosts.map((item) => [
        csvEscape(item.slug),
        csvEscape(item.title),
        csvEscape(item.runCount),
        csvEscape(microMoney(item.cpuCost)),
        csvEscape(microMoney(item.gpuCost)),
        csvEscape(microMoney(item.storageCost)),
        csvEscape(microMoney(item.totalCost)),
      ].join(",")),
    ];
    writeCsv(res, "portal-billing-tasks-export.csv", lines);
    return true;
  }

  async function handleAdminLedgerExport({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/admin/ledger-export.csv") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const billing = await fetchBillingSummary("", "", "168h");
    const items = billing?.items || [];
    const windowHours = parseHourWindow(url.searchParams.get("window"));
    const lines = [
      ["entryId", "type", "userId", "userName", "userEmail", "runId", "workspaceId", "amount", "createdAt", "operatorId", "reason", "pricingSource"].join(","),
      ...db.ledger.filter((entry) => withinHourWindow(entry.createdAt, windowHours)).map((entry) => {
        const targetUser = db.users.find((item) => item.id === entry.userId) || {};
        const related = items.find((item) => billingItemMatchesRun(item, entry.runId));
        const pricingSource = related?.pricingSource || related?.properties?.pricing_source || (entry.type === "pending_usage" ? "platform_metering_projection" : "portal_billing_ledger");
        return [
          csvEscape(entry.id),
          csvEscape(entry.type),
          csvEscape(entry.userId),
          csvEscape(targetUser.name || ""),
          csvEscape(targetUser.email || ""),
          csvEscape(entry.runId || ""),
          csvEscape(entry.workspaceId || ""),
          csvEscape(entry.amount),
          csvEscape(entry.createdAt || ""),
          csvEscape(entry.operatorId || ""),
          csvEscape(entry.reason || ""),
          csvEscape(pricingSource),
        ].join(",");
      }),
    ];
    writeCsv(res, "portal-admin-ledger-export.csv", lines);
    return true;
  }

  async function handleAdminUserSummaryExport({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/admin/user-summary-export.csv") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const billing = await fetchBillingSummary("", "", "168h");
    const items = billing?.items || [];
    const windowHours = parseHourWindow(url.searchParams.get("window"));
    const users = db.users.filter((item) => item.role !== "admin");
    const lines = [
      ["userId", "name", "email", "status", "taskCount", "balance", "ledgerTopup", "ledgerResourceCharge", "projectedUsageTotalCost"].join(","),
      ...users.map((entry) => {
        const taskCount = db.taskSpaces.filter((item) => item.userId === entry.id && item.status !== "deleted").length;
        const balance = Number((db.wallets.find((wallet) => wallet.userId === entry.id)?.balance) || 0);
        const topup = db.ledger.filter((item) => item.userId === entry.id && item.type === "topup" && withinHourWindow(item.createdAt, windowHours)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const resourceCharge = db.ledger.filter((item) => item.userId === entry.id && item.type === "resource_charge" && withinHourWindow(item.createdAt, windowHours)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const projectedUsageTotal = items.filter((item) => {
          return billingItemMatchesUser(item, entry.id);
        }).filter((item) => withinHourWindow(item?.end || item?.start, windowHours)).reduce((sum, item) => sum + Number(item?.totalCost || 0), 0);
        return [
          csvEscape(entry.id),
          csvEscape(entry.name || ""),
          csvEscape(entry.email || ""),
          csvEscape(entry.status || "active"),
          csvEscape(taskCount),
          csvEscape(money(balance)),
          csvEscape(money(topup)),
          csvEscape(money(resourceCharge)),
          csvEscape(microMoney(projectedUsageTotal)),
        ].join(",");
      }),
    ];
    writeCsv(res, "portal-admin-user-summary-export.csv", lines);
    return true;
  }

  async function handleAdminPendingExport({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/admin/pending-export.csv") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const pending = await fetchPendingSummary("", "", "168h");
    const lines = [
      ["runId", "customerId", "userName", "userEmail", "workspaceId", "completedAt", "pendingHours", "pricingSource"].join(","),
      ...(pending?.runs || []).map((item) => {
        const targetUser = db.users.find((entry) => entry.id === item.customerId) || {};
        return [
          csvEscape(item.runId),
          csvEscape(item.customerId),
          csvEscape(targetUser.name || ""),
          csvEscape(targetUser.email || ""),
          csvEscape(item.workspaceId || ""),
          csvEscape(item.completedAt || item.createdAt || ""),
          csvEscape(Number(item.pendingHours || 0).toFixed(2)),
          csvEscape(item.pricingSource || "metering pending"),
        ].join(",");
      }),
    ];
    writeCsv(res, "portal-admin-pending-export.csv", lines);
    return true;
  }

  async function handleLedgerAdjust({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/ledger-adjust") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const actionType = String(form.actionType || "").trim();
    const targetUser = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const wallet = db.wallets.find((item) => item.userId === form.userId);
    const amount = Number(form.amount || 0);
    const reason = String(form.reason || "").trim();
    const redirectTo = String(form.redirectTo || "/portal/admin/billing-ops").trim();
    if (!targetUser || !wallet || !["refund", "makeup_charge"].includes(actionType) || !Number.isFinite(amount) || amount <= 0 || !reason) {
      sendHtml(res, layoutV2("账单调整失败", `<div class="card">参数错误，请检查用户、动作类型、金额和原因。</div>`, user), 400);
      return true;
    }
    const transactionHandler = actionType === "refund" ? writeDb.refundWallet : writeDb.makeupChargeWallet;
    if (typeof transactionHandler !== "function") {
      sendHtml(res, layoutV2("账单调整失败", `<div class="card">账单事务未启用</div>`, user), 503);
      return true;
    }
    const normalizedAmount = Math.abs(amount);
    const result = await transactionHandler({
      userId: targetUser.id,
      tenantId: targetUser.id,
      amount: normalizedAmount,
      operatorId: user.id,
      idempotencyKey: String(form.idempotencyKey || `admin-ledger-adjust:${actionType}:${targetUser.id}:${normalizedAmount}:${Date.now()}:${randomUUID()}`),
      reason,
      runId: String(form.runId || "").trim(),
      workspaceId: String(form.workspaceId || "").trim(),
      resourceBindingId: String(form.resourceBindingId || "").trim(),
      sourceId: String(form.sourceId || "").trim(),
      sourceType: "admin_adjustment",
      auditType: "ledger_adjusted",
      auditDetails: {
        actionType,
      },
    });
    wallet.balance = Number(result.balance || wallet.balance);
    wallet.updatedAt = new Date().toISOString();
    await logPortalEvent({
      type: "ledger_adjusted",
      userId: targetUser.id,
      operatorId: user.id,
      actionType,
      amount: actionType === "refund" ? normalizedAmount : -normalizedAmount,
      runId: String(form.runId || "").trim(),
      workspaceId: String(form.workspaceId || "").trim(),
      reason,
      ledgerId: result.ledgerId || "",
      auditEventId: result.auditEventId || "",
    });
    redirect(res, redirectTo);
    return true;
  }

  async function handleReconcileBilling({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/reconcile-billing") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const scopeType = String(form.scopeType || "all").trim();
    const windowValue = String(form.window || "24h").trim();
    const redirectTo = String(form.redirectTo || "/portal/admin/billing-ops").trim();
    const targetUser = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const workspace = db.taskSpaces.find((item) => item.slug === form.workspaceId);
    const requestScope = { window: windowValue };
    if (scopeType === "user" && targetUser) {
      requestScope.customerId = targetUser.id;
    }
    if (scopeType === "workspace" && workspace) {
      requestScope.customerId = workspace.userId;
      requestScope.workspaceId = workspace.slug;
    }
    const [summary, pending] = await Promise.all([
      fetchBillingSummary(requestScope.customerId || "", requestScope.workspaceId || "", windowValue),
      fetchPendingSummary(requestScope.customerId || "", requestScope.workspaceId || "", windowValue),
    ]);
    const reconciledCount = Number((summary?.items || []).length);
    const pendingCount = Number((pending?.runs || []).length || pending?.pendingCount || 0);
    await logPortalEvent({
      type: "billing_reconcile_triggered",
      userId: user.id,
      scopeType,
      targetUserId: targetUser?.id || "",
      workspaceId: workspace?.slug || "",
      window: windowValue,
      reconciledCount,
      pendingCount,
      source: "portal_billing_ledger",
    });
    redirect(res, redirectTo);
    return true;
  }

  return async function handlePortalBillingExportRoutes(context) {
    if (await handleBillingExport(context)) return true;
    if (await handleTaskBillingExport(context)) return true;
    if (await handleAdminLedgerExport(context)) return true;
    if (await handleAdminUserSummaryExport(context)) return true;
    if (await handleAdminPendingExport(context)) return true;
    if (await handleLedgerAdjust(context)) return true;
    if (await handleReconcileBilling(context)) return true;
    return false;
  };
}
