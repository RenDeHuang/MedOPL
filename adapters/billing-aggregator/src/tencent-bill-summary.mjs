import { randomUUID } from "node:crypto";

export function firstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

export function firstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function normalizeTags(rawTags) {
  if (!rawTags) return {};
  if (Array.isArray(rawTags)) {
    return Object.fromEntries(rawTags.map((tag) => [
      firstString(tag.TagKey, tag.Key, tag.tagKey, tag.key),
      firstString(tag.TagValue, tag.Value, tag.tagValue, tag.value),
    ]).filter(([key]) => key));
  }
  if (typeof rawTags === "object") {
    return Object.fromEntries(Object.entries(rawTags).map(([key, value]) => [key, String(value ?? "")]));
  }
  return {};
}

export function zeroTotals() {
  return { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
}

export function buildUnattributedSummary(items, customerId = "", workspaceId = "") {
  const rows = Array.isArray(items) ? items : [];
  const totals = rows.reduce((acc, item) => {
    acc.cpuCost += Number(item.cpuCost || 0);
    acc.gpuCost += Number(item.gpuCost || 0);
    acc.pvCost += Number(item.pvCost || 0);
    acc.totalCost += Number(item.totalCost || 0);
    return acc;
  }, zeroTotals());

  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    source: "tencent_cloud_bill_unattributed",
    cloudSource: "tencent_cloud",
    itemCount: rows.length,
    totals,
    runs: rows,
    items: rows.map((item) => ({
      name: item.runId,
      start: item.start,
      end: item.end,
      cpuCost: item.cpuCost,
      gpuCost: item.gpuCost,
      pvCost: item.pvCost,
      totalCost: item.totalCost,
      pricingSource: item.pricingSource,
      properties: item.properties,
    })),
  };
}

export function normalizeTencentBillRow(row = {}) {
  const tags = normalizeTags(row.Tags || row.Tag || row.ResourceTags || row.TagSet);
  const resourceOrderId = firstString(tags.resource_order_id, tags.resourceOrderId, tags.resourceorderid, row.ResourceOrderId);
  const serverPlanId = firstString(tags.server_plan_id, tags.serverPlanId, tags.serverplanid, row.ServerPlanId);
  const tenantId = firstString(tags.tenant_id, tags.tenantId, tags.tenantid, tags.customer_id, tags.customerId, row.TenantId, row.CustomerId);
  const workspaceId = firstString(tags.workspace_id, tags.workspaceId, tags.workspaceid, row.WorkspaceId);
  const runId = firstString(tags.run_id, tags.runId, tags.runid, row.RunId);
  const hasExactRunAttribution = Boolean(resourceOrderId && serverPlanId && tenantId && workspaceId && runId);
  const resourceId = firstString(
    row.ResourceId,
    row.InstanceId,
    row.ResourceID,
    row["资源ID"],
    row["实例ID"],
    row["资源ID/实例ID"],
    row.ResourceName,
    row.ResourceIdName,
  );
  const product = firstString(row.BusinessCodeName, row.ProductCodeName, row.ProductName, row.BusinessCode);
  const component = firstString(row.ComponentCodeName, row.BillingItemCodeName, row.ComponentName, row.ItemName);
  const region = firstString(row.RegionName, row.Region, row.RegionId);
  const zone = firstString(row.ZoneName, row.Zone);
  const cost = firstNumber(
    row.RealTotalCost,
    row.RealCost,
    row.CashPayAmount,
    row.TotalCost,
    row.Cost,
    row.BillAmount,
  );

  return {
    runId: runId || resourceId || randomUUID(),
    resourceOrderId: resourceOrderId || "",
    serverPlanId: serverPlanId || "",
    workspaceId: workspaceId || "unattributed",
    customerId: tenantId || "",
    tenantId: tenantId || "",
    start: firstString(row.FeeBeginTime, row.BeginTime, row.SettleBeginTime, row.PayTime, row.CreatedTime),
    end: firstString(row.FeeEndTime, row.EndTime, row.SettleEndTime, row.PayTime, row.CreatedTime),
    cpuCost: 0,
    gpuCost: 0,
    pvCost: 0,
    totalCost: cost,
    pricingSource: hasExactRunAttribution ? "tencent_cloud_bill" : "tencent_cloud_bill_unattributed",
    hasExactRunAttribution,
    properties: {
      pricing_source: hasExactRunAttribution ? "tencent_cloud_bill" : "tencent_cloud_bill_unattributed",
      cloud_source: "tencent_cloud",
      attribution_state: hasExactRunAttribution ? "run_attributed" : "unattributed",
      resource_order_id: resourceOrderId,
      server_plan_id: serverPlanId,
      tenant_id: tenantId,
      customer_id: tenantId,
      workspace_id: workspaceId,
      run_id: runId,
      resource_id: resourceId,
      product,
      component,
      region,
      zone,
      tags,
      raw: row,
    },
  };
}

export function groupTencentBillRuns(rows) {
  const grouped = new Map();
  for (const item of rows) {
    const key = [item.resourceOrderId, item.runId].filter(Boolean).join("\u0000") || item.properties.resource_id || randomUUID();
    const current = grouped.get(key) || {
      runId: item.runId,
      resourceOrderId: item.resourceOrderId,
      serverPlanId: item.serverPlanId,
      workspaceId: item.workspaceId,
      customerId: item.customerId,
      tenantId: item.tenantId,
      start: item.start,
      end: item.end,
      cpuCost: 0,
      gpuCost: 0,
      pvCost: 0,
      totalCost: 0,
      sources: [],
      pricingSource: item.pricingSource,
      hasExactRunAttribution: item.hasExactRunAttribution,
      properties: {
        pricing_source: item.pricingSource,
        cloud_source: "tencent_cloud",
        attribution_state: item.hasExactRunAttribution ? "run_attributed" : "unattributed",
        resource_order_id: item.resourceOrderId,
        server_plan_id: item.serverPlanId,
        customer_id: item.customerId,
        tenant_id: item.tenantId,
        workspace_id: item.workspaceId,
        run_id: item.runId,
      },
    };
    current.totalCost += Number(item.totalCost || 0);
    current.sources.push(item.properties.resource_id || item.properties.product || "tencent_bill_detail");
    if (!current.start || String(item.start || "") < String(current.start)) current.start = item.start || current.start;
    if (!current.end || String(item.end || "") > String(current.end)) current.end = item.end || current.end;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0));
}

export function summaryFromTencentBillRows(rows, customerId = "", workspaceId = "") {
  const normalized = rows.map(normalizeTencentBillRow).filter((item) => {
    const customerOk = !customerId || item.customerId === customerId || item.properties.tags?.customer_id === customerId;
    const workspaceOk = !workspaceId || item.workspaceId === workspaceId || item.properties.tags?.workspace_id === workspaceId;
    return customerOk && workspaceOk;
  });

  const exactRuns = groupTencentBillRuns(normalized.filter((item) => item.hasExactRunAttribution));
  const unattributedRuns = groupTencentBillRuns(normalized.filter((item) => !item.hasExactRunAttribution));
  const totals = exactRuns.reduce((acc, item) => {
    acc.totalCost += Number(item.totalCost || 0);
    return acc;
  }, zeroTotals());
  const unattributed = buildUnattributedSummary(unattributedRuns, customerId, workspaceId);

  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    source: exactRuns.length > 0 ? "tencent_cloud_bill" : (unattributedRuns.length > 0 ? "tencent_cloud_bill_unattributed" : "tencent_cloud_bill"),
    cloudSource: "tencent_cloud",
    itemCount: exactRuns.length,
    exactRunCount: exactRuns.length,
    unattributedRunCount: unattributedRuns.length,
    totals,
    runs: exactRuns,
    items: exactRuns.map((item) => ({
      name: item.runId,
      start: item.start,
      end: item.end,
      cpuCost: item.cpuCost,
      gpuCost: item.gpuCost,
      pvCost: item.pvCost,
      totalCost: item.totalCost,
      pricingSource: item.pricingSource,
      properties: item.properties,
    })),
    unattributed,
  };
}
