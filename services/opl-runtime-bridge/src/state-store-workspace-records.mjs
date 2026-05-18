import { randomUUID } from "node:crypto";

import { ownerIdFrom, slugify, storageOwnerIdFrom, tenantIdFrom } from "./state-store-identity.mjs";
import { nowIso } from "./state-store-record-time.mjs";

export function buildWorkspaceRecord(input = {}, existing = null) {
  const portalUserId = input.portalUserId || input.portal_user_id || "";
  const workspaceId = slugify(input.workspaceId || input.workspace_id || "");
  const tenantId = tenantIdFrom(input) || portalUserId;
  const ownerId = ownerIdFrom(input) || portalUserId;
  const storageOwnerId = storageOwnerIdFrom(input) || ownerId;
  if (!existing) {
    return {
      workspaceId,
      tenantId,
      portalUserId,
      ownerId,
      title: input.workspaceTitle || input.workspace_title || workspaceId,
      workspacePath: input.workspacePath || input.workspace_path || "",
      projectId: input.projectId || input.project_id || input.moduleId || input.module_id || "",
      inputOwner: input.inputOwner || input.input_owner || ownerId,
      outputOwner: input.outputOwner || input.output_owner || ownerId,
      storageOwner: input.storageOwner || input.storage_owner || storageOwnerId,
      storageOwnerId,
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  return {
    ...existing,
    tenantId,
    ownerId,
    title: input.workspaceTitle || input.workspace_title || existing.title,
    workspacePath: input.workspacePath || input.workspace_path || existing.workspacePath || "",
    projectId: input.projectId || input.project_id || input.moduleId || input.module_id || existing.projectId || "",
    inputOwner: input.inputOwner || input.input_owner || existing.inputOwner || ownerId,
    outputOwner: input.outputOwner || input.output_owner || existing.outputOwner || ownerId,
    storageOwner: input.storageOwner || input.storage_owner || existing.storageOwner || storageOwnerId,
    storageOwnerId,
    updatedAt: nowIso(),
  };
}

export function buildWorkspaceSessionRecord(input = {}, workspace = {}) {
  const ownerId = ownerIdFrom(input) || workspace.ownerId || workspace.portalUserId;
  return {
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || randomUUID(),
    tenantId: tenantIdFrom(input) || workspace.tenantId || workspace.portalUserId,
    portalUserId: input.portalUserId || input.portal_user_id || "",
    ownerId,
    sessionOwnerId: input.sessionOwnerId || input.session_owner_id || ownerId,
    workspaceId: workspace.workspaceId,
    workspacePath: input.workspacePath || input.workspace_path || workspace.workspacePath || "",
    projectId: input.projectId || input.project_id || workspace.projectId || "",
    sourceSurface: input.sourceSurface || input.source_surface || "portal-control-plane",
    status: "active",
    createdAt: nowIso(),
    lastActiveAt: nowIso(),
  };
}
