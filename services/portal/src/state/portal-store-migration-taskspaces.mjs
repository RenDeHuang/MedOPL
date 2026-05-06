import { randomUUID } from "node:crypto";
import path from "node:path";

function legacyWorkspaceTaskSpace(item, { getTaskPath, sanitizeTaskTitle }) {
  return {
    id: item.id || randomUUID(),
    userId: item.userId,
    slug: item.slug || "default",
    title: sanitizeTaskTitle(item.slug || "default", item.title || item.workspace_name || "Default Task"),
    path: item.path || item.workspace_root || getTaskPath(item.userId, item.slug || "default"),
    status: "active",
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
    updatedAt: item.updatedAt || item.updated_at || new Date().toISOString(),
  };
}

export function migrateTaskSpaces({
  db,
  getTaskPath,
  normalizeServerPlanSelection,
  sanitizeTaskTitle,
}) {
  let changed = false;
  if (!Array.isArray(db.taskSpaces)) {
    db.taskSpaces = (db.workspaces || []).map((item) => legacyWorkspaceTaskSpace(item, { getTaskPath, sanitizeTaskTitle }));
    changed = true;
  }
  for (const taskSpace of db.taskSpaces) {
    const sanitizedTitle = sanitizeTaskTitle(taskSpace.slug, taskSpace.title);
    if (taskSpace.title !== sanitizedTitle) {
      taskSpace.title = sanitizedTitle;
      changed = true;
    }
    if (!taskSpace.status) {
      taskSpace.status = "active";
      changed = true;
    }
    if (!taskSpace.path) {
      taskSpace.path = getTaskPath(taskSpace.userId, taskSpace.slug || "default");
      changed = true;
    }
    const expectedTaskPath = getTaskPath(taskSpace.userId, taskSpace.slug || "default");
    if (path.normalize(String(taskSpace.path || "")) !== path.normalize(expectedTaskPath)) {
      taskSpace.path = expectedTaskPath;
      changed = true;
    }
    if (!taskSpace.createdAt) {
      taskSpace.createdAt = new Date().toISOString();
      changed = true;
    }
    if (!taskSpace.updatedAt) {
      taskSpace.updatedAt = taskSpace.createdAt;
      changed = true;
    }
    const normalizedServerPlan = normalizeServerPlanSelection(taskSpace.serverPlanSnapshot);
    if (JSON.stringify(normalizedServerPlan) !== JSON.stringify(taskSpace.serverPlanSnapshot || null)) {
      taskSpace.serverPlanSnapshot = normalizedServerPlan;
      changed = true;
    }
    const serverPlanId = normalizedServerPlan?.id || "";
    const serverPlanRegion = normalizedServerPlan?.region || "";
    if (String(taskSpace.serverPlanId || "") !== serverPlanId) {
      taskSpace.serverPlanId = serverPlanId;
      changed = true;
    }
    if (String(taskSpace.serverPlanRegion || "") !== serverPlanRegion) {
      taskSpace.serverPlanRegion = serverPlanRegion;
      changed = true;
    }
  }
  delete db.workspaces;
  return changed;
}
