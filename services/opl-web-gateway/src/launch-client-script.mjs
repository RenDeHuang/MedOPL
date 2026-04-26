import { buildDirectEntryState } from "./config.mjs";

export function portalLaunchClientScript() {
  return `
const STATE_KEY = "portal.opl.launch";
const BOOTSTRAP_KEY = "portal.opl.bootstrap";
const DIRECT_ENTRY_DEFAULT = ${JSON.stringify(buildDirectEntryState())};

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
    if (!document || typeof document.getElementById !== "function") return;
    const shell = document.getElementById("opl-portal-direct-entry");
    if (!shell) return;
    shell.style.display = state && state.active && shouldShowDirectEntryShell() ? "flex" : "none";
    if (typeof shell.querySelector !== "function") return;
    const link = shell.querySelector("[data-opl-portal-continue-link]");
    if (!link) return;
    if (state && state.openFromPortalUrl && typeof link.setAttribute === "function") {
      link.setAttribute("href", state.openFromPortalUrl);
    }
  } catch {}
}

function shouldShowDirectEntryShell() {
  try {
    const hash = String(window.location.hash || "").toLowerCase();
    const path = String(window.location.pathname || "").toLowerCase();
    if (!hash || hash === "#" || hash === "#/") return true;
    return hash.includes("login") || hash.includes("signin") || path.includes("login") || path.includes("auth");
  } catch {
    return true;
  }
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
installDirectEntryRouteWatcher();

function resolveOplModuleClickTarget(event) {
  const target = event && event.target;
  const closest = target && typeof target.closest === "function"
    ? target.closest('[data-testid^="opl-module-pill-"], [data-opl-module-id]')
    : null;
  if (!closest || typeof closest.getAttribute !== "function") return null;
  const moduleId = String(
    closest.getAttribute("data-opl-module-id") ||
    String(closest.getAttribute("data-testid") || "").replace(/^opl-module-pill-/, "")
  ).toLowerCase();
  if (!["mas", "mag", "rca"].includes(moduleId)) return null;
  return {
    moduleId,
    label: String(closest.textContent || moduleId).trim()
  };
}

function dispatchPortalRunEvent(type, detail) {
  try {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  } catch {}
}

function installNativeRunBridge() {
  if (window.__OPL_PORTAL_NATIVE_RUN_BRIDGE_INSTALLED__) return;
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  window.__OPL_PORTAL_NATIVE_RUN_BRIDGE_INSTALLED__ = true;
  document.addEventListener("click", (event) => {
    const module = resolveOplModuleClickTarget(event);
    if (!module) return;
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
      userAgent: window.navigator.userAgent
    })
  });

  window.__OPL_PORTAL_LAUNCH__ = { state, bootstrap, sessionBind };
  window.__OPL_PORTAL__ = window.__OPL_PORTAL__ || buildPortalApi();
  window.__OPL_PORTAL__.installNativeRunBridge = installNativeRunBridge;
  updateDirectEntryState({
    active: false,
    authenticated: true,
    reason: "portal_launch_active"
  });
  installNativeRunBridge();
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
