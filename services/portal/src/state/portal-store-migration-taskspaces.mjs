import { randomUUID } from "node:crypto";
import path from "node:path";

function legacyWorkspaceTaskSpace(item, { getTaskPath, sanitizeTaskTitle }) {
  const slug = String(item.slug || item.workspaceId || item.workspace_id || "").trim();
  if (!slug) return null;
  return {
    id: item.id || randomUUID(),
    userId: item.userId,
    slug,
    title: sanitizeTaskTitle(slug, item.title || item.workspace_name || slug),
    path: item.path || item.workspace_root || getTaskPath(item.userId, slug),
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
    db.taskSpaces = (db.workspaces || [])
      .map((item) => legacyWorkspaceTaskSpace(item, { getTaskPath, sanitizeTaskTitle }))
      .filter(Boolean);
    changed = true;
  }
  const originalTaskSpaceCount = db.taskSpaces.length;
  db.taskSpaces = db.taskSpaces.filter((item) => String(item.slug || item.workspaceId || item.workspace_id || "").trim());
  if (db.taskSpaces.length !== originalTaskSpaceCount) {
    changed = true;
  }
  for (const taskSpace of db.taskSpaces) {
    const explicitSlug = String(taskSpace.slug || taskSpace.workspaceId || taskSpace.workspace_id || "").trim();
    if (taskSpace.slug !== explicitSlug) {
      taskSpace.slug = explicitSlug;
      changed = true;
    }
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
      taskSpace.path = getTaskPath(taskSpace.userId, taskSpace.slug);
      changed = true;
    }
    const expectedTaskPath = getTaskPath(taskSpace.userId, taskSpace.slug);
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
