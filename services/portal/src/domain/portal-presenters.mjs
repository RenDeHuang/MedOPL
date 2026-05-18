import { randomUUID } from "node:crypto";

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "task";
}

function looksLikeCorruptedTitle(value) {
  const text = String(value || "");
  const markers = new Set(["\u934a", "\u934f", "\u93c3", "\u6d60", "\u7eef", "\u9425", "\u6ae4", "\u9473", "\u95ab", "\u95c2", "\u7490", "\u5a23", "\u6769", "\u7ff1"]);
  let hits = 0;
  for (const char of text) {
    if (markers.has(char)) hits += 1;
    if (hits >= 2) return true;
  }
  return false;
}

export function sanitizeTaskTitle(slug, title) {
  const normalizedSlug = slugify(slug);
  const raw = String(title || "").trim();
  const normalizedRaw = raw.toLowerCase();
  if (["dup validation", "dup-validation", "mas"].includes(normalizedRaw)) {
    return "MAS";
  }
  if (!raw || raw === "????" || raw.includes("Workspace") || looksLikeCorruptedTitle(raw)) {
    return normalizedSlug;
  }
  return raw;
}

export function defaultTaskTitle(slug = "") {
  return slugify(slug);
}

export function taskStatusLabel(status = "active") {
  const normalized = String(status || "active").toLowerCase();
  if (normalized === "archived") return "已归档";
  if (normalized === "deleted") return "已删除";
  if (normalized === "deleting") return "删除中";
  return "运行中";
}

export function taskStatusClass(status = "active") {
  const normalized = String(status || "active").toLowerCase();
  if (normalized === "archived") return "warn";
  if (normalized === "deleted" || normalized === "deleting") return "danger";
  return "ok";
}

export function sandboxStatusLabel(status = "unknown") {
  const normalized = String(status || "unknown").toLowerCase();
  if (normalized === "running") return "运行中";
  if (normalized === "idle") return "空闲";
  if (normalized === "hibernated") return "休眠";
  if (normalized === "terminated") return "已回收";
  if (normalized === "error") return "异常";
  if (normalized === "provisioning") return "启动中";
  return "未知";
}

export function humanizeStatus(status = "unknown") {
  const normalized = String(status || "unknown").toLowerCase();
  if (["completed", "success", "finished"].includes(normalized)) return "已完成";
  if (normalized === "running") return "运行中";
  if (normalized === "active") return "活跃";
  if (normalized === "failed" || normalized === "error") return "失败";
  if (normalized === "archived") return "已归档";
  if (normalized === "disabled") return "已禁用";
  return String(status || "未知");
}

export function userTheme(user) {
  const theme = String(user?.preferences?.theme || "light").toLowerCase();
  return ["dark", "light"].includes(theme) ? theme : "light";
}

function normalizeAnnouncementScope(scope = "all") {
  const normalized = String(scope || "all").toLowerCase();
  return ["all", "user", "admin"].includes(normalized) ? normalized : "all";
}

function normalizeAnnouncementStatus(status = "active") {
  const normalized = String(status || "active").toLowerCase();
  return ["active", "inactive"].includes(normalized) ? normalized : "active";
}

export function normalizeAnnouncementRecord(record) {
  if (!record || typeof record !== "object") return null;
  const title = String(record.title || "").trim();
  const content = String(record.content || "").trim();
  if (!title || !content) return null;
  const updatedAt = String(record.updatedAt || record.createdAt || new Date().toISOString());
  return {
    id: String(record.id || randomUUID()),
    title,
    content,
    scope: normalizeAnnouncementScope(record.scope),
    status: normalizeAnnouncementStatus(record.status),
    pinned: Boolean(record.pinned),
    createdAt: String(record.createdAt || updatedAt),
    updatedAt,
    operatorId: String(record.operatorId || ""),
  };
}

export function announcementRows(db, viewer = null) {
  const rows = Array.isArray(db?.settings?.announcements)
    ? db.settings.announcements.map(normalizeAnnouncementRecord).filter(Boolean)
    : [];
  const viewerRole = String(viewer?.role || "user").toLowerCase();
  return rows
    .filter((item) => {
      if (!viewer) return true;
      if (viewerRole === "admin") {
        return item.scope === "all" || item.scope === "admin";
      }
      return item.scope === "all" || item.scope === "user";
    })
    .sort((a, b) => {
      if (Number(b.pinned) !== Number(a.pinned)) return Number(b.pinned) - Number(a.pinned);
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
}

export function visibleAnnouncementRows(db, viewer = null) {
  return announcementRows(db, viewer).filter((item) => item.status === "active");
}

export function formatDateTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDateOnly(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
