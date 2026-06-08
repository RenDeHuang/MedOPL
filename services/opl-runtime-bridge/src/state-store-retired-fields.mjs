export function dropRetiredStateFields(state = {}) {
  const { costRecords: _retiredCostRecords, ...runtimeState } = state;
  return runtimeState;
}
