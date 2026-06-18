import { buildDirectEntryState } from "./config.mjs";
import { buildScriptTemplate } from "./launch-client-script/bootstrap.mjs";
import { buildLaunchClientConstants, TELEMETRY_SECTION } from "./launch-client-script/constants.mjs";
import { STORAGE_SECTION } from "./launch-client-script/storage.mjs";
import { DIRECT_ENTRY_SHELL_SECTION } from "./launch-client-script/direct-entry-shell.mjs";
import { PROVIDER_KEY_PANEL_SECTION } from "./launch-client-script/provider-key-panel.mjs";
import { PORTAL_API_CLIENT_SECTION } from "./launch-client-script/portal-api-client.mjs";
import { NATIVE_MESSAGE_RUN_BRIDGE_SECTION } from "./launch-client-script/native-message-run-bridge.mjs";
import { LAUNCH_FLOW_SECTION } from "./launch-client-script/launch-flow.mjs";

const PUBLIC_PAYLOAD_SECTION = `function publicLaunchState(state = {}) {
  const bootstrap = state.bootstrap || {};
  const launch = bootstrap.launch || {};
  const portal = bootstrap.portal || {};
  const workspace = bootstrap.workspace || {};
  const provider = bootstrap.provider || {};
  const sessionBind = state.sessionBind || {};
  const workspaceId = state.workspaceId || portal.workspaceId || launch.workspaceId || workspace.workspaceId || sessionBind.workspaceId || "";
  const sessionId = state.sessionId || sessionBind.sessionId || launch.sessionId || launch.oplSessionId || launch.runtimeSessionId || launch.workspaceSessionId || "";
  const providerKeyRef = state.providerKeyRef || provider.providerKeyRef || launch.providerKeyRef || sessionBind.providerKeyRef || "";
  const providerBound = state.providerBound === true || providerConfiguredFromBootstrap(bootstrap) || sessionBind.providerBound === true || Boolean(providerKeyRef);
  return {
    workspaceId,
    sessionId,
    launchStatus: state.launchStatus || (state.authenticated === true || state.hasLaunchCookie === true ? "ready" : "pending"),
    providerBound,
    providerKeyRef,
    portalReturnUrl: state.portalReturnUrl || DIRECT_ENTRY_DEFAULT.openFromPortalUrl || DIRECT_ENTRY_DEFAULT.portalPublicUrl || ""
  };
}

function publicBootstrapPayload(bootstrap = {}) {
  const launch = bootstrap.launch || {};
  const portal = bootstrap.portal || {};
  const workspace = bootstrap.workspace || {};
  const provider = bootstrap.provider || {};
  const workspaceId = portal.workspaceId || launch.workspaceId || workspace.workspaceId || "";
  const sessionId = launch.sessionId || launch.oplSessionId || launch.runtimeSessionId || launch.workspaceSessionId || portal.sessionId || portal.runtimeSessionId || portal.workspaceSessionId || "";
  const providerKeyRef = provider.providerKeyRef || launch.providerKeyRef || "";
  const providerBound = providerConfiguredFromBootstrap(bootstrap) || Boolean(providerKeyRef);
  return {
    launch: {
      workspaceId,
      sessionId,
      launchStatus: workspaceId || sessionId ? "ready" : "pending",
      providerBound,
      providerKeyRef,
      portalReturnUrl: DIRECT_ENTRY_DEFAULT.openFromPortalUrl || DIRECT_ENTRY_DEFAULT.portalPublicUrl || "",
    },
    workspace: {
      workspaceId,
    },
    provider: {
      providerBound,
      providerKeyRef,
    },
  };
}

function publicSessionBindPayload(sessionBind = {}) {
  const sessionId = sessionBind.sessionId || sessionBind.oplSessionId || sessionBind.runtimeSessionId || sessionBind.workspaceSessionId || "";
  const providerKeyRef = sessionBind.providerKeyRef || "";
  return {
    ok: sessionBind.ok === true,
    status: sessionBind.status || "",
    workspaceId: sessionBind.workspaceId || "",
    sessionId,
    launchStatus: sessionBind.status || (sessionId ? "ready" : "pending"),
    providerBound: sessionBind.providerBound === true || sessionBind.providerConfigured === true || Boolean(providerKeyRef),
    providerKeyRef,
    portalReturnUrl: DIRECT_ENTRY_DEFAULT.openFromPortalUrl || DIRECT_ENTRY_DEFAULT.portalPublicUrl || "",
  };
}`;

export function portalLaunchClientScript() {
  return buildScriptTemplate([
    buildLaunchClientConstants({
      directEntryDefaultJson: JSON.stringify(buildDirectEntryState()),
    }),
    TELEMETRY_SECTION,
    STORAGE_SECTION,
    DIRECT_ENTRY_SHELL_SECTION,
    PUBLIC_PAYLOAD_SECTION,
    PORTAL_API_CLIENT_SECTION,
    PROVIDER_KEY_PANEL_SECTION,
    NATIVE_MESSAGE_RUN_BRIDGE_SECTION,
    LAUNCH_FLOW_SECTION,
  ]);
}
