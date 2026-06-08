import { randomUUID } from "node:crypto";

import { ownerIdFrom } from "./state-store-identity.mjs";
import { runtimeDispatchFields } from "./state-store-runtime-dispatch-fields.mjs";
import {
  providerConfigFields,
  runtimeOwnershipFields,
  runtimeResourceFields,
  workspaceSessionScopeFields,
} from "./state-store-record-field-groups.mjs";
import { nowIso } from "./state-store-record-time.mjs";

export function buildRuntimeSessionRecord(input = {}) {
  const ownerId = ownerIdFrom(input);
  const workspaceScope = workspaceSessionScopeFields(input);
  if (!workspaceScope.workspaceId) {
    throw new Error("workspace_id_required");
  }
  return {
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || randomUUID(),
    ...runtimeOwnershipFields(input, ownerId),
    sessionOwnerId: input.sessionOwnerId || input.session_owner_id || ownerId,
    ...workspaceScope,
    oplSessionId: input.oplSessionId || input.opl_session_id || "",
    traceId: input.traceId || input.trace_id || "",
    ...runtimeResourceFields(input),
    ...runtimeDispatchFields(input),
    engine: input.engine || "opl-codex-default",
    status: input.status || "ready",
    ...providerConfigFields(input),
    createdAt: nowIso(),
    warmedAt: nowIso(),
  };
}
