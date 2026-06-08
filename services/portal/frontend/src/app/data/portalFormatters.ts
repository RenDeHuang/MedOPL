export function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function money(value: unknown) {
  return `¥ ${numberValue(value).toFixed(2)}`;
}

export function gb(value: unknown) {
  return `${numberValue(value).toFixed(1)} GB`;
}

export function bytesToSize(value: unknown) {
  const bytes = numberValue(value);
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function dateText(value: unknown) {
  return typeof value === "string" && value ? value.replace("T", " ").slice(0, 16) : "未返回";
}

export function stringValue(value: unknown, fallback = "未返回") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function keyPart(value: unknown, fallback = "none") {
  if (typeof value === "string" && value.trim()) return value.trim().replace(/[^a-zA-Z0-9._:-]+/g, "_");
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return fallback;
}

export function arrayValue<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

export function downloadTargetUrl(url: string) {
  return url.startsWith("/") ? url : "/";
}

export function fileType(name: string) {
  const ext = name.split(".").pop();
  return ext ? ext.toLowerCase() : "file";
}

export function contentTypeFromName(name: string) {
  const ext = fileType(name);
  if (ext === "pdf") return "application/pdf";
  if (ext === "csv") return "text/csv";
  if (ext === "json") return "application/json";
  if (ext === "txt") return "text/plain";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export function latestEventText(events: Array<{ occurredAt?: string }>) {
  const latest = events
    .map((event) => stringValue(event.occurredAt, ""))
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0];
  return latest ? dateText(latest) : "未返回";
}
