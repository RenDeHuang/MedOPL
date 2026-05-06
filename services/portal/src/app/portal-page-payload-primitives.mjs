function chartDateKey(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function seriesForRecentDays(days) {
  const labels = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    labels.push(d.toISOString().slice(0, 10));
  }
  return labels;
}

export function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizePageSize(value) {
  const parsed = parsePositiveInt(value, 5);
  return [5, 10, 20].includes(parsed) ? parsed : 5;
}

export function paginateRows(rows = [], pageValue = 1, pageSizeValue = 5) {
  const total = rows.length;
  const pageSize = normalizePageSize(pageSizeValue);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(parsePositiveInt(pageValue, 1), 1), totalPages);
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}

export function rangeBounds(rangeKey = "today", fromValue = "", toValue = "") {
  const now = new Date();
  if (rangeKey === "custom") {
    const from = new Date(String(fromValue || ""));
    const to = new Date(String(toValue || ""));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { start: null, end: null };
    to.setHours(23, 59, 59, 999);
    return { start: from, end: to };
  }
  if (rangeKey === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  if (rangeKey === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

export function withinDateRange(value, range) {
  if (!range?.start || !range?.end) return true;
  const ts = Date.parse(String(value || ""));
  if (!Number.isFinite(ts)) return false;
  return ts >= range.start.getTime() && ts <= range.end.getTime();
}

export function groupBillingByDay(items = [], days = 7) {
  const labels = seriesForRecentDays(days);
  const base = Object.fromEntries(labels.map((label) => [label, { total: 0, cpu: 0, gpu: 0, storage: 0 }]));
  for (const item of items) {
    const key = chartDateKey(item?.end || item?.start || item?.createdAt);
    if (!base[key]) continue;
    base[key].total += Number(item?.totalCost || 0);
    base[key].cpu += Number(item?.cpuCost || 0);
    base[key].gpu += Number(item?.gpuCost || 0);
    base[key].storage += Number(item?.pvCost || 0);
  }
  return {
    labels,
    total: labels.map((label) => Number(base[label].total.toFixed(5))),
    cpu: labels.map((label) => Number(base[label].cpu.toFixed(5))),
    gpu: labels.map((label) => Number(base[label].gpu.toFixed(5))),
    storage: labels.map((label) => Number(base[label].storage.toFixed(5))),
  };
}

export function createPayloadTimingRecorder() {
  const startedAt = Date.now();
  const marks = {};
  return {
    mark(name) {
      marks[name] = Date.now() - startedAt;
    },
    done() {
      return {
        totalMs: Date.now() - startedAt,
        breakdown: marks,
      };
    },
  };
}
