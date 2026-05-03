export function usableServerPlanId(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized && normalized !== "default") return normalized;
  }
  return "";
}
