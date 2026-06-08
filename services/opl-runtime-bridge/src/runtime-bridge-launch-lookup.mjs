export function runtimeSessionByLaunch(state = {}, launch = {}) {
  return (state.runtimeSessions || []).find((item) => item.runtimeSessionId === launch.runtimeSessionId) || null;
}

export function runBelongsToLaunch(run = {}, launch = {}) {
  return run.runtimeSessionId === launch.runtimeSessionId &&
    run.workspaceSessionId === launch.workspaceSessionId &&
    run.workspaceId === launch.workspaceId;
}
