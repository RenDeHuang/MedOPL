import {
  buildWorkspaceRecord,
  buildWorkspaceSessionRecord,
} from "./state-store-workspace-records.mjs";
import { slugify } from "./state-store-identity.mjs";
import { addEvent } from "./state-store-events.mjs";

export function upsertWorkspace(state, input = {}) {
  const portalUserId = input.portalUserId || input.portal_user_id || "";
  const workspaceId = slugify(input.workspaceId || input.workspace_id || "");
  if (!workspaceId) {
    throw new Error("workspace_id_required");
  }
  const existing = state.workspaces.find((item) =>
    item.portalUserId === portalUserId &&
    item.workspaceId === workspaceId
  );
  const workspace = buildWorkspaceRecord(input, existing);
  if (!existing) {
    state.workspaces.push(workspace);
    addEvent(state, "workspace_registered", { portalUserId, workspaceId });
    return workspace;
  }
  Object.assign(existing, workspace);
  return existing;
}

export function createWorkspaceSession(state, input = {}) {
  const workspace = upsertWorkspace(state, input);
  const session = buildWorkspaceSessionRecord(input, workspace);
  state.workspaceSessions.push(session);
  addEvent(state, "workspace_session_created", session);
  return session;
}
