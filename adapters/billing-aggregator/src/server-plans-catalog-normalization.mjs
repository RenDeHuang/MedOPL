export function parseJsonEnv(raw, fallback) {
  if (!String(raw || "").trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function serverPlanCatalog({ SERVER_PLAN_CATALOG_JSON }) {
  const parsed = parseJsonEnv(SERVER_PLAN_CATALOG_JSON, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function normalizeStringMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [String(key || "").trim(), String(entry ?? "").trim()])
      .filter(([key, entry]) => key && entry),
  );
}

export function normalizeTolerations(value, { firstString }) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      key: firstString(item.key),
      operator: firstString(item.operator, "Equal"),
      value: firstString(item.value),
      effect: firstString(item.effect),
    }))
    .filter((item) => item.key);
}
