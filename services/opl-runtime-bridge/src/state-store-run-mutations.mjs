import { buildRunRecord } from "./state-store-run-records.mjs";
import { nowIso } from "./state-store-record-time.mjs";
import { addEvent } from "./state-store-events.mjs";

export function createRunRecord(state, input = {}) {
  const run = buildRunRecord(input);
  state.runs.push(run);
  addEvent(state, "runtime_run_submitted", run);
  return run;
}

export function updateRunStatus(state, runId, patch = {}) {
  const run = state.runs.find((item) => item.runId === runId);
  if (!run) return null;
  Object.assign(run, {
    ...patch,
    updatedAt: nowIso(),
  });
  addEvent(state, "runtime_run_status_synced", run);
  return run;
}
