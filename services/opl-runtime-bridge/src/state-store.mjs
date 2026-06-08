export {
  emptyState,
  ensureRuntime,
  readState,
  updateState,
  writeState,
} from "./state-store-core.mjs";
import { buildCostRecord } from "./state-store-cost-records.mjs";
import { addEvent } from "./state-store-events.mjs";

export { nowIso } from "./state-store-record-time.mjs";
export { artifactsRoot, runtimeRoot, stateFile } from "./state-store-paths.mjs";
export { ownerIdFrom, slugify, storageOwnerIdFrom, tenantIdFrom } from "./state-store-identity.mjs";

export { addEvent } from "./state-store-events.mjs";

export {
  createWorkspaceSession,
  upsertWorkspace,
} from "./state-store-workspace-mutations.mjs";
export { createRuntimeSession } from "./state-store-runtime-mutations.mjs";

export { createRunRecord, updateRunStatus } from "./state-store-run-mutations.mjs";
export { addRunAction } from "./state-store-run-action-mutations.mjs";

export { upsertMessageRequestRecord } from "./state-store-message-requests.mjs";

export { addArtifactRecord } from "./state-store-artifact-trace-mutations.mjs";
export { addMessageReplyRecord } from "./state-store-message-reply-mutations.mjs";
export {
  addSessionLedgerEntry,
  listSessionLedgerEntries,
} from "./state-store-session-ledger.mjs";
export { addTraceRecord } from "./state-store-artifact-trace-mutations.mjs";

export function addCostRecord(state, input = {}) {
  const cost = buildCostRecord(input);
  state.costRecords.push(cost);
  addEvent(state, cost.status === "exact" ? "runner_cost_reconciled" : "runner_cost_pending", cost);
  return cost;
}
