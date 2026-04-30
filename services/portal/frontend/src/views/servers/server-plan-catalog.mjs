export const SERVER_PLAN_PAGE_SIZE = 4;

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function planCanOrder(plan = {}) {
  if (typeof plan.canOrder === "boolean") return plan.canOrder;
  return Boolean(plan.salable);
}

export function planHourlyPrice(plan = {}) {
  const value = toFiniteNumber(plan.hourlyPrice ?? plan.discountPrice ?? plan.unitPrice ?? plan.originalPrice);
  return value > 0 ? value : 0;
}

export function planAvailabilityLabel(plan = {}) {
  return String(plan.availabilityStatus || plan.statusCategory || "").trim();
}

export function planDisabledReason(plan = {}) {
  return String(plan.soldOutReason || plan.reason || plan.statusCategory || plan.availabilityStatus || "").trim();
}

export function collectServerPlanFilterOptions(items = []) {
  const cpu = [...new Set(items.map((item) => toFiniteNumber(item.cpu)).filter((value) => value > 0))].sort((a, b) => a - b);
  const memoryGb = [...new Set(items.map((item) => toFiniteNumber(item.memoryGb)).filter((value) => value > 0))].sort((a, b) => a - b);
  return { cpu, memoryGb };
}

export function filterServerPlans(items = [], filters = {}) {
  const cpu = toFiniteNumber(filters.cpu);
  const memoryGb = toFiniteNumber(filters.memoryGb);
  return items.filter((item) => {
    if (cpu > 0 && toFiniteNumber(item.cpu) !== cpu) return false;
    if (memoryGb > 0 && toFiniteNumber(item.memoryGb) !== memoryGb) return false;
    return true;
  });
}

export function paginateServerPlans(items = [], page = 1, pageSize = SERVER_PLAN_PAGE_SIZE) {
  const safePageSize = Math.max(1, Math.trunc(pageSize) || SERVER_PLAN_PAGE_SIZE);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  const start = (currentPage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    pagination: {
      page: currentPage,
      pageSize: safePageSize,
      total,
      totalPages,
    },
  };
}
