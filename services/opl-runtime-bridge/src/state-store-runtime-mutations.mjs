import { addEvent } from "./state-store-events.mjs";
import { buildRuntimeSessionRecord } from "./state-store-runtime-records.mjs";

export function createRuntimeSession(state, input = {}) {
  const runtimeSession = buildRuntimeSessionRecord(input);
  state.runtimeSessions.push(runtimeSession);
  addEvent(state, "runtime_session_warmed", runtimeSession);
  return runtimeSession;
}
