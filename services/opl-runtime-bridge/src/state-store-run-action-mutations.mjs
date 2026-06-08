import { buildRunActionRecord } from "./state-store-run-action-records.mjs";

export function addRunAction(state, input = {}) {
  const action = buildRunActionRecord(input);
  state.runActions.push(action);
  return action;
}
