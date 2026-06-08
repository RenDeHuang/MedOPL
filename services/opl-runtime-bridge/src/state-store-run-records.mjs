import { randomUUID } from "node:crypto";

import { ownerIdFrom, tenantIdFrom } from "./state-store-identity.mjs";
import { providerKeyRefFields } from "./state-store-provider-key-ref.mjs";
import { runtimeDispatchFields } from "./state-store-runtime-dispatch-fields.mjs";
import {
  runExecutionFields,
  runtimeOwnershipFields,
  runtimeResourceFields,
} from "./state-store-record-field-groups.mjs";
import { nowIso } from "./state-store-record-time.mjs";
import { buildRunActionRecord } from "./state-store-run-action-records.mjs";

export function buildRunRecord(input = {}) {
  const ownerId = ownerIdFrom(input);
  return {
    runId: input.runId || input.run_id || randomUUID(),
    ...runtimeOwnershipFields(input, ownerId),
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    traceId: input.traceId || input.trace_id || "",
    kind: input.kind || "med-autoscience",
    agentId: input.agentId || input.agent_id || "mas",
    toolName: input.toolName || input.tool_name || "med-autoscience",
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

export { buildRunActionRecord } from "./state-store-run-action-records.mjs";
