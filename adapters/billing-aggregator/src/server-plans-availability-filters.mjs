function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function commaList(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeServerPlanQuery(input = {}, { firstString }) {
  return {
    region: firstString(input.region),
    zone: firstString(input.zone),
    cpu: parseOptionalNumber(input.cpu),
    memoryGb: parseOptionalNumber(input.memoryGb ?? input.memory),
  };
}

export function buildTencentDiscoveryFilters(query = {}, {
  firstString,
  TENCENT_PLAN_DISCOVERY_CHARGE_TYPE,
  TENCENT_PLAN_DISCOVERY_ZONES,
}) {
  const filters = [
    {
      Name: "instance-charge-type",
      Values: [TENCENT_PLAN_DISCOVERY_CHARGE_TYPE],
    },
  ];
  const zones = commaList(firstString(query.zone, TENCENT_PLAN_DISCOVERY_ZONES));
  if (zones.length) filters.push({ Name: "zone", Values: zones });
  return filters;
}

export function planMatchesQuery(plan, query = {}, { firstString }) {
  const normalized = normalizeServerPlanQuery(query, { firstString });
  if (normalized.region && String(plan.region || "").trim() !== normalized.region) return false;
  if (normalized.zone && String(plan.zone || "").trim() !== normalized.zone) return false;
  if (normalized.cpu !== null && Number(plan.cpu || 0) !== normalized.cpu) return false;
  if (normalized.memoryGb !== null && Number(plan.memoryGb || plan.memory || 0) !== normalized.memoryGb) return false;
  return true;
}

export function filterServerPlansPayload(payload, query = {}, options = {}) {
  const {
    firstString,
    serverPlanCache,
    SERVER_PLAN_CACHE_TTL_MS,
  } = options;
  const normalized = normalizeServerPlanQuery(query, { firstString });
  const items = Array.isArray(payload?.items) ? payload.items.filter((item) => planMatchesQuery(item, normalized, { firstString })) : [];
  const selectableCount = items.filter((item) => item.isSelectable || item.isPurchasable || item.canOrder || item.salable).length;
  const purchasableCount = items.filter((item) => item.isPurchasable || item.canOrder || item.salable).length;
  const result = {
    ...payload,
    items,
    candidateCount: items.length,
    purchasableCount,
    selectableCount,
    filter: normalized,
  };
  if (options.cacheHit) {
    result.cache = {
      hit: true,
      ttlMs: SERVER_PLAN_CACHE_TTL_MS,
      expiresAt: new Date(serverPlanCache.expiresAt).toISOString(),
    };
  }
  return result;
}
