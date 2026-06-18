export const LAUNCH_FLOW_SECTION = `async function completePortalLaunch(state, bootstrap) {
  const launch = bootstrap.launch || {};
  const portal = bootstrap.portal || {};
  const workspace = bootstrap.workspace || {};
  const sessionBind = await fetchJson(RUNTIME_BRIDGE_OPL_API_PATH + "/sessions/bind", {
    method: "POST",
    body: JSON.stringify({
      workspaceId: portal.workspaceId || launch.workspaceId || "",
      workspaceSessionId: portal.workspaceSessionId || launch.workspaceSessionId || "",
      runtimeSessionId: portal.runtimeSessionId || launch.runtimeSessionId || "",
      oplSessionId: "opl-web:" + (launch.launchId || portal.runtimeSessionId || Date.now()),
      workspacePath: workspace.workspacePath || launch.workspacePath || "",
      source: "opl-web-gateway",
      launchSource: "opl-web-gateway",
      userAgent: window.navigator.userAgent
    })
  });
  const refreshedBootstrap = bootstrap;
  writeStoredBootstrap(refreshedBootstrap);

  window.__OPL_PORTAL_LAUNCH__ = {
    state: publicLaunchState(state),
    bootstrap: publicBootstrapPayload(refreshedBootstrap),
    sessionBind: publicSessionBindPayload(sessionBind)
  };
  window.__OPL_PORTAL__ = window.__OPL_PORTAL__ || buildPortalApi();
  window.__OPL_PORTAL__.installNativeRunBridge = installNativeRunBridge;
  window.__OPL_PORTAL__.installNativeMessageBridge = installNativeMessageBridge;
  window.__OPL_PORTAL__.markFirstInteraction = markFirstInteraction;
  updateDirectEntryState({
    active: false,
    authenticated: true,
    reason: "portal_launch_active"
  });
  installNativeRunBridge();
  installNativeMessageBridge();
  markLaunchReady();
  window.dispatchEvent(new CustomEvent("opl:portal-launch-ready", {
    detail: { ready: true, state: window.__OPL_PORTAL_LAUNCH__.state }
  }));
  stripRetiredRuntimeBridgeQuery();
}

function pickFields(source = {}, keys = []) {
  const target = {};
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") target[key] = source[key];
  }
  return target;
}

async function initializePortalLaunch() {
  const injectedDirectEntry = resolveInjectedDirectEntryFlag();
  updateDirectEntryState({
    active: injectedDirectEntry,
    reason: injectedDirectEntry ? "portal_launch_required" : "portal_launch_pending"
  });
  let state = resolveLaunchState();
  if (!state) {
    state = await resolveCookieLaunchState();
  }
  if (!state) {
    updateDirectEntryState({
      active: true,
      reason: injectedDirectEntry ? "portal_launch_required" : "portal_launch_missing"
    });
    return;
  }
  const bootstrap = await fetchJson(RUNTIME_BRIDGE_OPL_API_PATH + "/bootstrap");
  writeStoredBootstrap(bootstrap);
  if (!ensureLaunchProviderPanel(state, bootstrap)) return;
  await completePortalLaunch(state, bootstrap);
}

initializePortalLaunch().catch((error) => {
  const message = safeErrorMessage(error, "Portal launch initialization failed");
  console.error("[opl-web-gateway] Portal launch initialization failed", message);
  window.__OPL_PORTAL_LAUNCH_ERROR__ = message;
  updateDirectEntryState({
    active: true,
    authenticated: false,
    reason: "portal_launch_error",
    error: window.__OPL_PORTAL_LAUNCH_ERROR__
  });
  window.dispatchEvent(new CustomEvent("opl:portal-launch-error", {
    detail: window.__OPL_PORTAL_LAUNCH_ERROR__
  }));
});`;
