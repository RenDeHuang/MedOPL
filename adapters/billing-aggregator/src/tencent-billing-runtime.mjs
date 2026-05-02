export function parseWindowHours(windowValue = "168h") {
  const raw = String(windowValue || "").trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)(h|d)$/);
  if (!match) return 168;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 168;
  return match[2] === "d" ? value * 24 : value;
}

const TENCENT_BILLING_TIME_ZONE = "Asia/Shanghai";

function partsForTencentBillingTime(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TENCENT_BILLING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

function numericTencentBillingParts(date) {
  const parts = partsForTencentBillingTime(date);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function localPartsEpoch(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function utcInstantForTencentBillingParts(parts) {
  const desiredLocal = localPartsEpoch(parts);
  let guess = desiredLocal;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actualLocal = localPartsEpoch(numericTencentBillingParts(new Date(guess)));
    const delta = desiredLocal - actualLocal;
    if (delta === 0) return new Date(guess);
    guess += delta;
  }
  return new Date(guess);
}

export function formatTencentTime(date) {
  const value = date instanceof Date ? date : new Date(date);
  const parts = partsForTencentBillingTime(value);
  return [
    parts.year,
    "-",
    parts.month,
    "-",
    parts.day,
    " ",
    parts.hour,
    ":",
    parts.minute,
    ":",
    parts.second,
  ].join("");
}

function nextTencentBillingMonthStart(date) {
  const parts = numericTencentBillingParts(date);
  const month = parts.month === 12 ? 1 : parts.month + 1;
  const year = parts.month === 12 ? parts.year + 1 : parts.year;
  return utcInstantForTencentBillingParts({ year, month, day: 1, hour: 0, minute: 0, second: 0 });
}

export function windowDateRange(windowValue = "168h", now = new Date()) {
  const end = now instanceof Date ? now : new Date(now);
  const begin = new Date(end.getTime() - parseWindowHours(windowValue) * 3_600_000);
  return { begin, end };
}

export function tencentMonthlyWindowRanges(windowValue = "168h", now = new Date()) {
  const { begin, end } = windowDateRange(windowValue, now);
  const ranges = [];
  let cursor = new Date(begin);

  while (cursor.getTime() <= end.getTime()) {
    const nextMonthStart = nextTencentBillingMonthStart(cursor);
    if (nextMonthStart.getTime() <= cursor.getTime()) {
      throw new Error("tencent_billing_month_boundary_invalid");
    }
    const rangeEnd = new Date(Math.min(end.getTime(), nextMonthStart.getTime() - 1000));
    ranges.push({
      beginTime: formatTencentTime(cursor),
      endTime: formatTencentTime(rangeEnd),
    });
    cursor = new Date(rangeEnd.getTime() + 1000);
  }

  return ranges;
}

export function tencentBillRows(response) {
  const rows =
    response?.DetailSet ||
    response?.DetailList ||
    response?.BillDetailSet ||
    response?.BillDetailList ||
    response?.Response?.DetailSet ||
    [];
  return Array.isArray(rows) ? rows : [];
}

export function createTencentBillingRuntime({
  env = {},
  deps = {},
} = {}) {
  const {
    TENCENT_BILLING_ENABLED = false,
    TENCENT_BILLING_ENDPOINT = "",
    TENCENT_BILLING_MAX_PAGES = 1,
    TENCENT_BILLING_PAGE_SIZE = 100,
    TENCENT_BILLING_VERSION = "",
    TENCENT_CLOUD_REGION = "",
    L3_EXACT_WAIT_MINUTES = 120,
  } = env;
  const {
    callTencentCloud,
    normalizeTencentBillRow,
    applyResourceAttributionToRows,
    fetchProvisionResourceMappings,
    summaryFromTencentBillRows,
  } = deps;

  if (typeof callTencentCloud !== "function") throw new Error("callTencentCloud is required");
  if (typeof summaryFromTencentBillRows !== "function") throw new Error("summaryFromTencentBillRows is required");
  if (applyResourceAttributionToRows && typeof applyResourceAttributionToRows !== "function") throw new Error("applyResourceAttributionToRows must be a function");
  if (fetchProvisionResourceMappings && typeof fetchProvisionResourceMappings !== "function") throw new Error("fetchProvisionResourceMappings must be a function");

  async function withResourceAttributionFallback(rows = []) {
    if (!applyResourceAttributionToRows || !normalizeTencentBillRow) return rows;
    const mappings = fetchProvisionResourceMappings ? await fetchProvisionResourceMappings() : [];
    if (!Array.isArray(mappings) || mappings.length === 0) return rows;

    const normalized = rows.map((row) => normalizeTencentBillRow(row));
    const attributionRows = normalized.map((item) => ({
      ResourceId: item.properties?.resource_id || "",
      InstanceId: item.properties?.resource_id || "",
      attributed: item.hasExactRunAttribution,
    }));
    const attributed = applyResourceAttributionToRows(attributionRows, mappings);
    return rows.map((row, index) => {
      const item = attributed[index] || {};
      if (!item.attributed) return row;
      const nextTags = {
        ...(row.Tags && typeof row.Tags === "object" ? row.Tags : {}),
        resource_order_id: item.resourceOrderId,
        run_id: item.runId,
        server_plan_id: item.serverPlanId,
        tenant_id: item.tenantId,
        workspace_id: item.workspaceId,
      };
      return {
        ...row,
        ResourceOrderId: row.ResourceOrderId || item.resourceOrderId,
        RunId: row.RunId || item.runId,
        ServerPlanId: row.ServerPlanId || item.serverPlanId,
        TenantId: row.TenantId || item.tenantId,
        WorkspaceId: row.WorkspaceId || item.workspaceId,
        Tags: nextTags,
      };
    });
  }

  async function fetchTencentBillSummary(customerId = "", workspaceId = "", windowValue = "168h", target = {}) {
    if (!TENCENT_BILLING_ENABLED) {
      const error = new Error("tencent_billing_disabled");
      error.status = 503;
      throw error;
    }
    const rows = [];
    let ranges = tencentMonthlyWindowRanges(windowValue);
    const beginTime = String(target?.queryBeginTime || target?.beginTime || "").trim();
    const endTime = String(target?.queryEndTime || target?.endTime || "").trim();
    if (beginTime && endTime) {
      ranges = [{ beginTime, endTime }];
    }
    for (const range of ranges) {
      let rangeRows = 0;
      for (let page = 0; page < TENCENT_BILLING_MAX_PAGES; page += 1) {
        const response = await callTencentCloud({
          endpoint: TENCENT_BILLING_ENDPOINT,
          service: "billing",
          action: "DescribeBillDetail",
          version: TENCENT_BILLING_VERSION,
          region: TENCENT_CLOUD_REGION,
          payload: {
            Offset: page * TENCENT_BILLING_PAGE_SIZE,
            Limit: TENCENT_BILLING_PAGE_SIZE,
            BeginTime: range.beginTime,
            EndTime: range.endTime,
          },
        });
        const billRows = tencentBillRows(response);
        rows.push(...billRows);
        rangeRows += billRows.length;
        const total = Number(response.Total || response.TotalCount || response?.Response?.Total || response?.Response?.TotalCount || 0);
        const hasAuthoritativeTotal = Number.isFinite(total) && total > 0;
        if (hasAuthoritativeTotal && rangeRows >= total) break;
        if (billRows.length < TENCENT_BILLING_PAGE_SIZE) break;
        if (page + 1 >= TENCENT_BILLING_MAX_PAGES && (!hasAuthoritativeTotal || rangeRows < total)) {
          const error = new Error(`tencent_billing_detail_truncated:${rangeRows}/${total}`);
          error.status = 502;
          throw error;
        }
      }
    }
    const attributedRows = await withResourceAttributionFallback(rows);
    return summaryFromTencentBillRows(attributedRows, customerId, workspaceId, {
      l3ExactWaitMinutes: L3_EXACT_WAIT_MINUTES,
      target,
    });
  }

  return {
    fetchTencentBillSummary,
  };
}
