export function liveLabelValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || "unknown";
}

export function liveCloudTagValue(value) {
  return liveLabelValue(value).replace(/[^a-z0-9]+/g, "").slice(0, 24) || "unknown";
}
