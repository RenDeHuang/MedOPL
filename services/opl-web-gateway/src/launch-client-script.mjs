import { buildDirectEntryState } from "./config.mjs";

export function portalLaunchClientScript() {
  return `
const STATE_KEY = "portal.opl.launch";
const BOOTSTRAP_KEY = "portal.opl.bootstrap";

const DIRECT_ENTRY_DISMISS_KEY = "portal.opl.directEntryDismissed";

const PROVIDER_KEY_SESSION_KEY = "portal.opl.providerApiKey";

const NATIVE_LOGIN_PATHS = [

  "/api/auth/signin",

  "/api/auth/login",

  "/api/v1/auths/signin",

  "/api/v1/auths/login",

  "/auth/login",

  "/login"

];

const OPL_MODULE_IDS = ["mas", "mag", "rca"];
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

function isNativeLoginUrl(input) {

  try {

    const value = typeof input === "string" ? input : input && input.url;

    if (!value) return false;

    const url = new URL(value, window.location.origin);

    return NATIVE_LOGIN_PATHS.includes(url.pathname);

  } catch {

    return false;

  }

}



function normalizeProviderKey(value) {

  return String(value || "").trim();

}



function writeProviderKey(value) {

  const normalized = normalizeProviderKey(value);

  try {

    if (normalized) window.sessionStorage.setItem(PROVIDER_KEY_SESSION_KEY, normalized);

  } catch {}

  return normalized;

}



function readProviderKey(container) {

  try {

    const root = container && typeof container.querySelector === "function" ? container : document;

    const input = root.querySelector('[name="apiKey"], [name="providerApiKey"], [name="experimentalBearerToken"], [name="gflabtoken"], [data-opl-provider-key]');

    const fromInput = normalizeProviderKey(input && input.value);

    if (fromInput) return writeProviderKey(fromInput);

    return normalizeProviderKey(window.sessionStorage.getItem(PROVIDER_KEY_SESSION_KEY));

  } catch {

    return "";

  }

}



function ensureProviderKeyInput(form) {

  try {

    if (!form || typeof form.querySelector !== "function") return;

    if (!form.querySelector('input[type="password"], input[name="password"]')) return;

    if (form.querySelector("[data-opl-provider-key-field]")) return;

    const passwordInput = form.querySelector('input[type="password"], input[name="password"]');

    if (!passwordInput || !passwordInput.parentNode) return;

    const field = document.createElement("div");

    field.className = "opl-portal-provider-key-field";

    field.setAttribute("data-opl-provider-key-field", "1");

    const label = document.createElement("label");

    label.textContent = "gflabtoken API key";

    const input = document.createElement("input");

    input.type = "password";

    input.name = "apiKey";

    input.autocomplete = "off";

    input.placeholder = "来源于 gflabtoken.cn";

    input.setAttribute("data-opl-provider-key", "1");

    input.value = readProviderKey() || "";

    input.addEventListener("input", () => writeProviderKey(input.value));

    field.appendChild(label);

    field.appendChild(input);

    const host = passwordInput.closest("label, div, fieldset") || passwordInput;

    host.insertAdjacentElement("afterend", field);

  } catch {}

}



function scanProviderKeyForms() {

  try {

    if (!document || typeof document.querySelectorAll !== "function") return;

    document.querySelectorAll("form").forEach((form) => ensureProviderKeyInput(form));

  } catch {}

}



function installProviderKeyFieldObserver() {

  scanProviderKeyForms();

  installProviderKeyInputHandler();

  installProviderKeySubmitGuard();

  installProviderKeyMutationObserver();

}



function installProviderKeyInputHandler() {

  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {

    document.addEventListener("input", (event) => {

      const target = event && event.target;

      if (target && typeof target.matches === "function" && target.matches("[data-opl-provider-key]")) {

        writeProviderKey(target.value);

      }

    }, true);

  }

}



function installProviderKeySubmitGuard() {

  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {

    document.addEventListener("submit", (event) => {

      const form = event && event.target;

      if (!form || typeof form.querySelector !== "function") return;

      if (!form.querySelector('input[type="password"], input[name="password"]')) return;

      const key = readProviderKey(form);

      if (key) return;

      const input = form.querySelector("[data-opl-provider-key]");

      if (input && typeof input.setCustomValidity === "function") {

        input.setCustomValidity("请输入 gflabtoken API key 后再进入 OPL。");

        if (typeof input.reportValidity === "function") input.reportValidity();

      }

      event.preventDefault();

      event.stopPropagation();

    }, true);

  }

}



function installProviderKeyMutationObserver() {

  try {

    if (typeof MutationObserver === "function" && document && document.documentElement) {

      const observer = new MutationObserver(() => scanProviderKeyForms());

      observer.observe(document.documentElement, { childList: true, subtree: true });

    }

  } catch {}

}



function appendProviderKeyToLoginRequest(init = {}, providerKey = "") {

  const key = normalizeProviderKey(providerKey);

  const next = { ...init };

  const headers = new Headers(init.headers || {});

  const body = init.body;

  if (body instanceof FormData) {

    return appendProviderKeyBody(next, body, key);

  }

  if (body instanceof URLSearchParams) {

    return appendProviderKeyBody(next, body, key);

  }

  if (typeof body === "string" && body.trim()) {

    return appendProviderKeyStringBody(next, headers, body, key);

  }

  return appendProviderKeyJsonBody(next, headers, {}, key);

}



function appendProviderKeyBody(next, body, key) {

  body.set("apiKey", key);

  body.set("providerApiKey", key);

  next.body = body;

  return next;

}



function appendProviderKeyStringBody(next, headers, body, key) {

  const contentType = String(headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/x-www-form-urlencoded")) {

    const params = new URLSearchParams(body);

    appendProviderKeyBody(next, params, key);

    next.body = params.toString();

    return next;

  }

  try {

    return appendProviderKeyJsonBody(next, headers, JSON.parse(body), key);

  } catch {

    return appendProviderKeyJsonBody(next, headers, {}, key);

  }

}



function appendProviderKeyJsonBody(next, headers, body, key) {

  next.body = JSON.stringify({ ...body, apiKey: key, providerApiKey: key, experimentalBearerToken: key });

  headers.set("content-type", "application/json");

  next.headers = headers;

  return next;
}



function installNativeLoginFetchBridge() {

  if (window.__OPL_PORTAL_NATIVE_LOGIN_FETCH_BRIDGE_INSTALLED__) return;

  if (typeof window.fetch !== "function") return;

  window.__OPL_PORTAL_NATIVE_LOGIN_FETCH_BRIDGE_INSTALLED__ = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {

    if (!isNativeLoginUrl(input)) return nativeFetch(input, init);

    const providerKey = readProviderKey(document);

    if (!providerKey) {

      return Promise.resolve(new Response(JSON.stringify({

        ok: false,

        error: "provider_api_key_required",

        message: "gflabtoken API key is required before entering OPL."

      }), {

        status: 400,

        headers: { "content-type": "application/json; charset=utf-8" }

      }));

    }


    return nativeFetch(input, appendProviderKeyToLoginRequest(init, providerKey));

  };

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
      return fetchJson(state.adapterUrl + "/api/opl-launch/messages", {
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
installDirectEntryDismissHandler();

installProviderKeyFieldObserver();

installNativeLoginFetchBridge();

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
