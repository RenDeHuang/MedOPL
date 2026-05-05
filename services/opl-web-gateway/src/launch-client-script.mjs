import { buildDirectEntryState } from "./config.mjs";

export function portalLaunchClientScript() {
  return `
const STATE_KEY = "portal.opl.launch";
const BOOTSTRAP_KEY = "portal.opl.bootstrap";

const DIRECT_ENTRY_DISMISS_KEY = "portal.opl.directEntryDismissed";

const OPL_MODULE_IDS = ["mas", "mag", "rca"];
const TIMING_MARKERS = ["portal_launch_ready_ms", "opl_dom_ready_ms", "opl_first_interaction_ms"];
const DIRECT_ENTRY_DEFAULT = ${JSON.stringify(buildDirectEntryState())};

const launchStartedAtMs = performance.now();

window.__OPL_PORTAL_TIMING__ = window.__OPL_PORTAL_TIMING__ || {
  portal_launch_ready_ms: null,
  opl_dom_ready_ms: null,
  opl_first_interaction_ms: null,
  markers: []
};

function elapsedMs() {
  return Math.round(performance.now() - launchStartedAtMs);
}

function markOplTelemetry(marker, details = {}) {
  if (!TIMING_MARKERS.includes(marker)) return null;
  const timing = window.__OPL_PORTAL_TIMING__;
  if (timing[marker] === null || timing[marker] === undefined) {
    timing[marker] = elapsedMs();
  }
  const entry = {
    marker,
    valueMs: timing[marker],
    details,
    recordedAt: new Date().toISOString()
  };
  timing.markers.push(entry);
  try {
    window.dispatchEvent(new CustomEvent("opl:portal-telemetry", { detail: entry }));
  } catch {}
  return entry;
}

function markDomReady() {
  markOplTelemetry("opl_dom_ready_ms", { readyState: document.readyState || "" });
}

function installDomReadyMarker() {
  if (document.readyState === "interactive" || document.readyState === "complete") {
    markDomReady();
    return;
  }
  document.addEventListener("DOMContentLoaded", markDomReady, { once: true });
}

function markLaunchReady() {
  markOplTelemetry("portal_launch_ready_ms", { source: "opl-web-gateway" });
}

function markFirstInteraction(details = {}) {
  markOplTelemetry("opl_first_interaction_ms", details);
}

function readStoredState() {
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStoredState(state) {
  try {
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {}
}

function readStoredBootstrap() {
  try {
    const raw = window.sessionStorage.getItem(BOOTSTRAP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredBootstrap(bootstrap) {
  try {
    window.sessionStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(bootstrap));
  } catch {}
}

function updateDirectEntryState(overrides = {}) {
  const next = {
    ...DIRECT_ENTRY_DEFAULT,
    ...window.__OPL_PORTAL_DIRECT_ENTRY__,
    ...overrides
  };
  window.__OPL_PORTAL_DIRECT_ENTRY__ = next;
  syncDirectEntryShell(next);
  return next;
}

function syncDirectEntryShell(state) {
  try {
    const shell = resolveDirectEntryShell();
    if (!shell) return;
    shell.style.display = state && state.active && shouldShowDirectEntryShell() && !isDirectEntryDismissed() ? "flex" : "none";
    updateDirectEntryContinueLink(shell, state);
  } catch {}
}

function resolveDirectEntryShell() {

  if (!document || typeof document.getElementById !== "function") return null;

  return document.getElementById("opl-portal-direct-entry");

}



function updateDirectEntryContinueLink(shell, state) {

  if (!shell || typeof shell.querySelector !== "function") return;

  const link = shell.querySelector("[data-opl-portal-continue-link]");

  if (link && state && state.openFromPortalUrl && typeof link.setAttribute === "function") {

    link.setAttribute("href", state.openFromPortalUrl);

  }

}



function isDirectEntryDismissed() {

  try {

    return window.sessionStorage.getItem(DIRECT_ENTRY_DISMISS_KEY) === "1";

  } catch {

    return false;

  }

}



function dismissDirectEntryShell() {

  try {

    window.sessionStorage.setItem(DIRECT_ENTRY_DISMISS_KEY, "1");

  } catch {}

  syncDirectEntryShell(window.__OPL_PORTAL_DIRECT_ENTRY__ || DIRECT_ENTRY_DEFAULT);

}



function installDirectEntryDismissHandler() {

  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;

  document.addEventListener("click", (event) => {

    const target = event && event.target;

    const dismiss = target && typeof target.closest === "function" ? target.closest("[data-opl-portal-dismiss]") : null;

    if (!dismiss) return;

    event.preventDefault();

    dismissDirectEntryShell();

  }, true);

}



function shouldShowDirectEntryShell() {
  const hash = safeLowerLocationValue(window.location && window.location.hash);

  const path = safeLowerLocationValue(window.location && window.location.pathname);

  return isEmptyRouteHash(hash) || hasAuthRouteMarker(hash, path);
}



function safeLowerLocationValue(value) {

  try {
    return String(value || "").toLowerCase();
  } catch {
    return "";
  }
}

function isEmptyRouteHash(hash) {

  return !hash || hash === "#" || hash === "#/";

}



function hasAuthRouteMarker(hash, path) {

  return hash.includes("login") || hash.includes("signin") || path.includes("login") || path.includes("auth");

}



function refreshDirectEntryShell() {
  syncDirectEntryShell(window.__OPL_PORTAL_DIRECT_ENTRY__ || DIRECT_ENTRY_DEFAULT);
}

function installDirectEntryRouteWatcher() {
  const refreshSoon = () => setTimeout(refreshDirectEntryShell, 0);
  try {
    if (window.history && typeof window.history.pushState === "function") {
      const pushState = window.history.pushState.bind(window.history);
      window.history.pushState = (...args) => {
        const result = pushState(...args);
        refreshSoon();
        return result;
      };
    }
    if (window.history && typeof window.history.replaceState === "function") {
      const replaceState = window.history.replaceState.bind(window.history);
      window.history.replaceState = (...args) => {
        const result = replaceState(...args);
        refreshSoon();
        return result;
      };
    }
  } catch {}
  if (typeof window.addEventListener === "function") {
    window.addEventListener("hashchange", refreshDirectEntryShell);
    window.addEventListener("popstate", refreshDirectEntryShell);
  }
  if (typeof window.setInterval === "function") {
    window.setInterval(refreshDirectEntryShell, 1000);
  }
}

function resolveInjectedDirectEntryFlag() {
  try {
    if (!document || typeof document.querySelector !== "function") return false;
    const meta = document.querySelector('meta[name="opl-portal-direct-entry"]');
    return Boolean(meta && typeof meta.getAttribute === "function" && meta.getAttribute("content") === "1");
  } catch {
    return false;
  }
}

function stripLaunchQuery() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("launch_token") && !url.searchParams.has("portal_adapter_url")) return;
    url.searchParams.delete("launch_token");
    url.searchParams.delete("portal_adapter_url");
    window.history.replaceState({}, document.title, url.toString());
  } catch {}
}

function resolveLaunchState() {
  const params = new URLSearchParams(window.location.search);
  const stored = readStoredState();
  const launchToken = params.get("launch_token") || stored.launchToken || "";
  const requestedAdapterUrl = params.get("portal_adapter_url") || stored.requestedAdapterUrl || "";
  if (!launchToken) return null;
  const state = {
    launchToken,
    requestedAdapterUrl,
    adapterUrl: "/portal-adapter",
    gatewayUrl: window.location.origin,
    receivedAt: new Date().toISOString()
  };
  writeStoredState(state);
  return state;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    },
    credentials: "same-origin"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(url + " failed " + response.status + ": " + JSON.stringify(payload));
  }
  return payload;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function pollPortalMessageStatus(statusUrl, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 180000);
  const intervalMs = Number(options.intervalMs || 2000);
  const startedAt = Date.now();
  let lastPayload = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastPayload = await fetchJson(statusUrl);
    if (lastPayload.status === "succeeded") return lastPayload;
    if (lastPayload.status === "failed") {
      throw new Error("OPL message failed: " + JSON.stringify(lastPayload));
    }
    await sleep(intervalMs);
  }
  throw new Error("OPL message status timeout: " + JSON.stringify(lastPayload));
}

function providerConfiguredFromBootstrap(bootstrap) {

  const provider = bootstrap && bootstrap.provider ? bootstrap.provider : {};

  return provider.providerConfigured === true || provider.providerConfigStatus === "configured";

}



function removeLaunchProviderConnectionPanel() {

  try {

    const panel = document.querySelector("[data-opl-launch-connection-panel]");

    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);

  } catch {}

}



function renderLaunchProviderConnectionPanel() {

  const existing = document.querySelector("[data-opl-launch-connection-panel]");

  if (existing) return existing;

  const panel = document.createElement("section");

  panel.setAttribute("data-opl-launch-connection-panel", "1");

  panel.style.position = "fixed";

  panel.style.inset = "0";

  panel.style.zIndex = "2147483647";

  panel.style.display = "flex";

  panel.style.alignItems = "center";

  panel.style.justifyContent = "center";

  panel.style.background = "rgba(15, 23, 42, 0.52)";

  const box = document.createElement("div");

  box.style.width = "min(420px, calc(100vw - 32px))";

  box.style.padding = "20px";

  box.style.borderRadius = "8px";

  box.style.background = "#ffffff";

  box.style.boxShadow = "0 20px 60px rgba(15, 23, 42, 0.25)";

  const title = document.createElement("h2");

  title.textContent = "OPL 服务未连接";

  title.style.margin = "0 0 12px";

  title.style.fontSize = "18px";

  const hint = document.createElement("p");

  hint.textContent = "请从 Portal 统一入口完成 OPL 连接后再进入。";

  hint.style.margin = "0 0 14px";

  hint.style.fontSize = "14px";

  hint.style.color = "#475569";

  const button = document.createElement("button");

  button.type = "button";

  button.textContent = "返回 Portal";

  button.style.width = "100%";

  button.style.height = "40px";

  button.style.marginTop = "14px";

  button.style.border = "0";

  button.style.borderRadius = "6px";

  button.style.background = "#111827";

  button.style.color = "#ffffff";

  button.style.cursor = "pointer";

  button.addEventListener("click", () => {

    const directEntry = window.__OPL_PORTAL_DIRECT_ENTRY__ || DIRECT_ENTRY_DEFAULT;

    const target = directEntry.openFromPortalUrl || directEntry.portalPublicUrl || "";

    if (target) window.location.href = target;

  });

  box.appendChild(title);

  box.appendChild(hint);

  box.appendChild(button);

  panel.appendChild(box);

  document.body.appendChild(panel);

  return panel;

}



function ensureLaunchProviderConnection(bootstrap) {

  if (providerConfiguredFromBootstrap(bootstrap)) {

    removeLaunchProviderConnectionPanel();

    return true;

  }

  renderLaunchProviderConnectionPanel();

  updateDirectEntryState({
    active: true,
    authenticated: false,
    reason: "provider_connection_required"
  });

  return false;
}



function requireLaunchState() {
  const state = readStoredState();
  if (!state.launchToken) {
    throw new Error("Portal launch token is not available. Open OPL Web from Portal.");
  }
  return state;
}

function buildPortalApi() {
  return {
    get state() {
      return readStoredState();
    },
    get bootstrap() {
      return readStoredBootstrap();
    },
    async refreshBootstrap() {
      const state = requireLaunchState();
      const bootstrap = await fetchJson(state.adapterUrl + "/api/opl-launch/bootstrap?launch_token=" + encodeURIComponent(state.launchToken));
      writeStoredBootstrap(bootstrap);
      return bootstrap;
    },
    async startRun(input = {}) {
      const state = requireLaunchState();
      return fetchJson(state.adapterUrl + "/api/opl-launch/runs", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          launchToken: input.launchToken || input.launch_token || state.launchToken
        })
      });
    },
    async sendMessage(input = {}) {
      const state = requireLaunchState();
      const accepted = await fetchJson(state.adapterUrl + "/api/opl-launch/messages", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          launchToken: input.launchToken || input.launch_token || state.launchToken
        })
      });
      if (accepted.status === "accepted" && accepted.statusUrl) {
        return pollPortalMessageStatus(accepted.statusUrl, {
          timeoutMs: input.statusTimeoutMs || input.status_timeout_ms,
          intervalMs: input.statusIntervalMs || input.status_interval_ms
        });
      }
      return accepted;
    },
    async getRunStatus(runId) {
      if (!runId) throw new Error("runId is required.");
      const state = requireLaunchState();
      return fetchJson(state.adapterUrl + "/api/opl-launch/runs/" + encodeURIComponent(runId) + "/status");
    },
    async getArtifacts(runId) {
      if (!runId) throw new Error("runId is required.");
      const state = requireLaunchState();
      return fetchJson(state.adapterUrl + "/api/opl-launch/runs/" + encodeURIComponent(runId) + "/artifacts");
    }
  };
}

window.__OPL_PORTAL__ = window.__OPL_PORTAL__ || buildPortalApi();
window.__OPL_PORTAL_REFRESH_DIRECT_ENTRY__ = refreshDirectEntryShell;
installDirectEntryDismissHandler();

installDirectEntryRouteWatcher();

function resolveOplModuleClickTarget(event) {
  const closest = resolveOplModuleElement(event);
  if (!closest || typeof closest.getAttribute !== "function") return null;
  const moduleId = resolveOplModuleId(closest);
  if (!OPL_MODULE_IDS.includes(moduleId)) return null;
  return {
    moduleId,
    label: String(closest.textContent || moduleId).trim()
  };
}

function resolveOplModuleElement(event) {

  const target = event && event.target;

  return target && typeof target.closest === "function"

    ? target.closest('[data-testid^="opl-module-pill-"], [data-opl-module-id]')

    : null;

}



function resolveOplModuleId(element) {

  const explicitId = element.getAttribute("data-opl-module-id");

  const testId = String(element.getAttribute("data-testid") || "").replace(/^opl-module-pill-/, "");

  return String(explicitId || testId).toLowerCase();

}



function dispatchPortalRunEvent(type, detail) {
  try {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  } catch {}
}

function dispatchPortalMessageEvent(type, detail) {
  try {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  } catch {}
}

function resolveNativeMessageText(target) {
  try {
    const root = target && typeof target.closest === "function" ? target.closest("main, form, section, div") : document;
    const inputSelector = "textarea, input[name='message'], input[name='prompt'], [contenteditable='true']";
    const scoped = root && typeof root.querySelectorAll === "function" ? Array.from(root.querySelectorAll(inputSelector)) : [];
    const global = typeof document !== "undefined" && typeof document.querySelectorAll === "function" ? Array.from(document.querySelectorAll(inputSelector)) : [];
    const inputs = [...scoped, ...global];
    for (const input of inputs) {
      const value = String(input && "value" in input ? input.value : input.textContent || "").trim();
      if (value) return value;
    }
  } catch {}
  return "";
}

function consumeNativeMessageEvent(event, target, message) {
  if (!event || !target || !message) return false;
  if (event.__OPL_PORTAL_MESSAGE_BRIDGED__) return false;
  if (target.dataset.oplPortalMessagePending === "1") return false;
  event.__OPL_PORTAL_MESSAGE_BRIDGED__ = true;
  markFirstInteraction({ source: "opl-web-native-ui-send" });
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  target.dataset.oplPortalMessagePending = "1";
  window.__OPL_PORTAL__.sendMessage({
    message,
    source: "opl-web-native-ui-send",
    toolName: "opl-native-ui",
  })
    .then((result) => dispatchPortalMessageEvent("opl:portal-message-sent", { message, result }))
    .catch((error) => dispatchPortalMessageEvent("opl:portal-message-error", {
      message,
      error: String(error && error.message ? error.message : error)
    }))
    .finally(() => {
      delete target.dataset.oplPortalMessagePending;
    });
  return true;
}

function resolveNativeMessageSendTarget(event) {
  const target = event && event.target;
  if (!target || typeof target.closest !== "function") return null;
  return target.closest("button.send-button-custom, [data-testid='send-button'], button[aria-label='Send'], button[aria-label='发送'], button[type='submit']");
}

function installNativeMessageBridge() {
  if (window.__OPL_PORTAL_NATIVE_MESSAGE_BRIDGE_INSTALLED__) return;
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  window.__OPL_PORTAL_NATIVE_MESSAGE_BRIDGE_INSTALLED__ = true;
  document.addEventListener("submit", (event) => {
    const form = event && event.target;
    if (!form || typeof form.querySelector !== "function") return;
    const message = resolveNativeMessageText(form);
    consumeNativeMessageEvent(event, form, message);
  }, true);
  document.addEventListener("click", (event) => {
    const sendTarget = resolveNativeMessageSendTarget(event);
    if (!sendTarget) return;
    const message = resolveNativeMessageText(sendTarget);
    consumeNativeMessageEvent(event, sendTarget, message);
  }, true);
}

function installNativeRunBridge() {
  if (window.__OPL_PORTAL_NATIVE_RUN_BRIDGE_INSTALLED__) return;
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  window.__OPL_PORTAL_NATIVE_RUN_BRIDGE_INSTALLED__ = true;
  document.addEventListener("click", (event) => {
    const module = resolveOplModuleClickTarget(event);
    if (!module) return;
    markFirstInteraction({ source: "opl-web-native-ui-click", moduleId: module.moduleId });
    window.__OPL_PORTAL__.startRun({
      agentId: module.moduleId,
      toolName: "opl-native-ui",
      source: "opl-web-native-ui-click",
      input: {
        moduleId: module.moduleId,
        label: module.label
      }
    })
      .then((run) => dispatchPortalRunEvent("opl:portal-run-started", { module, run }))
      .catch((error) => dispatchPortalRunEvent("opl:portal-run-error", {
        module,
        error: String(error && error.message ? error.message : error)
      }));
  }, true);
}

window.__OPL_PORTAL__.installNativeRunBridge = installNativeRunBridge;
window.__OPL_PORTAL__.installNativeMessageBridge = installNativeMessageBridge;
window.__OPL_PORTAL__.markFirstInteraction = markFirstInteraction;
installDomReadyMarker();

async function initializePortalLaunch() {
  const injectedDirectEntry = resolveInjectedDirectEntryFlag();
  updateDirectEntryState({
    active: injectedDirectEntry,
    reason: injectedDirectEntry ? "portal_launch_required" : "portal_launch_pending"
  });
  const state = resolveLaunchState();
  if (!state) {
    updateDirectEntryState({
      active: true,
      reason: injectedDirectEntry ? "portal_launch_required" : "portal_launch_missing"
    });
    return;
  }
  const bootstrapUrl = state.adapterUrl + "/api/opl-launch/bootstrap?launch_token=" + encodeURIComponent(state.launchToken);
  const bootstrap = await fetchJson(bootstrapUrl);
  writeStoredBootstrap(bootstrap);
  if (!ensureLaunchProviderConnection(bootstrap)) return;

  const launch = bootstrap.launch || {};
  const portal = bootstrap.portal || {};
  const workspace = bootstrap.workspace || {};
  const sessionBind = await fetchJson(state.adapterUrl + "/api/opl-launch/sessions/bind", {
    method: "POST",
    body: JSON.stringify({
      launchToken: state.launchToken,
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

  window.__OPL_PORTAL_LAUNCH__ = { state, bootstrap: refreshedBootstrap, sessionBind };
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
    detail: window.__OPL_PORTAL_LAUNCH__
  }));
  stripLaunchQuery();
}

initializePortalLaunch().catch((error) => {
  console.error("[opl-web-gateway] Portal launch initialization failed", error);
  window.__OPL_PORTAL_LAUNCH_ERROR__ = String(error && error.message ? error.message : error);
  updateDirectEntryState({
    active: true,
    authenticated: false,
    reason: "portal_launch_error",
    error: window.__OPL_PORTAL_LAUNCH_ERROR__
  });
  window.dispatchEvent(new CustomEvent("opl:portal-launch-error", {
    detail: window.__OPL_PORTAL_LAUNCH_ERROR__
  }));
});
`;
}
