export function normalizeObject(value) {
  if (!value) return {};
  if (typeof value === "string") return normalizeJsonObjectString(value);
  if (typeof value !== "object" || Array.isArray(value)) return {};
  return { ...value };
}

function normalizeJsonObjectString(value) {
  try {
    return normalizeObject(JSON.parse(value));
  } catch {
    return {};
  }
}

export function normalizeCloudResourceIds(value) {
  if (!value) return [];
  if (typeof value === "string") return normalizeCloudResourceIdString(value);
  if (Array.isArray(value)) return compactResourceIdValues(value);
  if (typeof value === "object") return compactResourceIdValues(Object.values(value));
  return [];
}

function normalizeCloudResourceIdString(value) {
  try {
    return normalizeCloudResourceIds(JSON.parse(value));
  } catch {
    return value ? [value] : [];
  }
}

function compactResourceIdValues(values = []) {
  return values.map((item) => String(item || "").trim()).filter(Boolean);
}
