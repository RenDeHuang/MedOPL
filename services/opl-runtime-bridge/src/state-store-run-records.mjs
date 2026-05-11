import { randomUUID } from "node:crypto";

import { ownerIdFrom, tenantIdFrom } from "./state-store-identity.mjs";
import {
  providerKeyRefFields,
  runtimeDispatchFields,
  runExecutionFields,
  runtimeOwnershipFields,
  runtimeResourceFields,
} from "./state-store-record-field-groups.mjs";
import { nowIso } from "./state-store-record-time.mjs";

export function buildRunRecord(input = {}) {
  const ownerId = ownerIdFrom(input);
  return {
    runId: input.runId || input.run_id || randomUUID(),
    ...runtimeOwnershipFields(input, ownerId),
    workspaceId: input.workspaceId || input.workspace_id || "default",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    traceId: input.traceId || input.trace_id || "",
    kind: input.kind || "med-autoscience",
    agentId: input.agentId || input.agent_id || "mas",
    toolName: input.toolName || input.tool_name || "med-autoscience",
    resourceOrderId: input.resourceOrderId || input.resource_order_id || "",
    ...runtimeResourceFields(input),
    ...runtimeDispatchFields(input),
    runnerImage: input.runnerImage || input.runner_image || "",
    namespace: input.namespace || "",
    jobName: input.jobName || input.job_name || "",
    billingMetadataRef: input.billingMetadataRef || input.billing_metadata_ref || "",
    usageMetadataRef: input.usageMetadataRef || input.usage_metadata_ref || "",
    manifestPath: input.manifestPath || input.manifest_path || "",
    ...runExecutionFields(input),
    ...providerKeyRefFields(input),
  };
}

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
    resourceOrderId: input.resourceOrderId || input.resource_order_id || "",
    actionType: input.actionType || input.action_type || "runtime_action",
    summary: input.summary || "",
    status: input.status || "recorded",
    startedAt: input.startedAt || input.started_at || nowIso(),
    finishedAt: input.finishedAt || input.finished_at || "",
    createdAt: nowIso(),
  };
}
