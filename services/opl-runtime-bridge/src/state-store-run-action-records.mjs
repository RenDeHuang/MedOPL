import { randomUUID } from "node:crypto";

import { ownerIdFrom, tenantIdFrom } from "./state-store-identity.mjs";
import { nowIso } from "./state-store-record-time.mjs";

export function buildRunActionRecord(input = {}) {
  const ownerId = ownerIdFrom(input);
  return {
    actionId: input.actionId || input.action_id || randomUUID(),
    runId: input.runId || input.run_id || "",
    traceId: input.traceId || input.trace_id || "",
    tenantId: tenantIdFrom(input),
    portalUserId: input.portalUserId || input.portal_user_id || "",
    ownerId,
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    actionType: input.actionType || input.action_type || "runtime_action",
    summary: input.summary || "",
    status: input.status || "recorded",
    startedAt: input.startedAt || input.started_at || nowIso(),
    finishedAt: input.finishedAt || input.finished_at || "",
    createdAt: nowIso(),
  };
}
