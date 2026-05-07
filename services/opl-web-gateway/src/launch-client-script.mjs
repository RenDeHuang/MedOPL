import { buildDirectEntryState } from "./config.mjs";

export function portalLaunchClientScript() {
  return `
const STATE_KEY = "portal.opl.launch";
const BOOTSTRAP_KEY = "portal.opl.bootstrap";
const PORTAL_ADAPTER_PATH = "/portal-adapter";

const DIRECT_ENTRY_DISMISS_KEY = "portal.opl.directEntryDismissed";

const OPL_MODULE_IDS = ["mas", "mag", "rca"];
const TIMING_MARKERS = ["portal_launch_ready_ms", "opl_dom_ready_ms", "opl_first_interaction_ms"];
const DIRECT_ENTRY_DEFAULT = ${JSON.stringify(buildDirectEntryState())};
const MODEL_SERVICE_SOURCE_COPY = "模型服务来源于 gflabtoken";

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
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(publicLaunchState(state)));
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
    window.sessionStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(publicBootstrapPayload(bootstrap)));
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

function stripPublicAdapterQuery() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("portal_adapter_url")) return;
    url.searchParams.delete("portal_adapter_url");
    window.history.replaceState({}, document.title, url.toString());
  } catch {}
}

function publicLaunchState(state = {}) {
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

function resolveLaunchState() {
  const stored = readStoredState();
  if (stored.launchStatus !== "ready") return null;
  return stored;
}

async function resolveCookieLaunchState() {
  try {
    const payload = await fetchJson("/api/v1/auths/");
    if (payload.success !== true) return null;
    const state = {
      workspaceId: payload.workspace && payload.workspace.workspaceId || payload.portal && payload.portal.workspaceId || "",
      sessionId: payload.portal && (payload.portal.oplSessionId || payload.portal.runtimeSessionId || payload.portal.workspaceSessionId) || "",
      providerBound: Boolean(payload.portal && payload.portal.providerKeyRef),
      providerKeyRef: payload.portal && payload.portal.providerKeyRef || "",
      portalReturnUrl: DIRECT_ENTRY_DEFAULT.openFromPortalUrl || DIRECT_ENTRY_DEFAULT.portalPublicUrl || "",
      launchStatus: "ready"
    };
    writeStoredState(state);
    return state;
  } catch {
    return null;
  }
}

function safeErrorUrl(value = "") {
  try {
    const url = new URL(String(value || ""), window.location.origin);
    url.search = "";
    return url.pathname + url.search;
  } catch {
    return "request";
  }
}

function safeErrorMessage(error, defaultMessage = "请求失败，请重试。") {
  const message = String(error && error.message ? error.message : defaultMessage);
  return message
    .replace(/token=[^&\s"']+/gi, "token=[redacted]")
    .replace(/apiKey["']?\s*[:=]\s*["'][^"']+["']/gi, "apiKey:[redacted]");
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
    throw new Error(safeErrorUrl(url) + " failed " + response.status);
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

function normalizeProviderKey(value) {
  try {
    return String(value || "").trim();
  } catch {
    return "";
  }
}

function createProviderKeyField() {
  const wrapper = document.createElement("div");
  wrapper.className = "opl-portal-provider-key-field";
  const label = document.createElement("label");
  label.textContent = "gflabtoken API Key";
  const input = document.createElement("input");
  input.setAttribute("type", "password");
  input.setAttribute("name", "oplProviderApiKey");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("placeholder", "来源于 gflabtoken");
  input.setAttribute("data-opl-provider-key", "1");
  const hint = document.createElement("div");
  hint.textContent = MODEL_SERVICE_SOURCE_COPY + "，请填写与当前 Portal 身份配套的 API Key，且不在页面回显明文。";
  hint.style.fontSize = "12px";
  hint.style.color = "#64748b";
  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(hint);
  return wrapper;
}

const PROVIDER_KEY_LOGIN_PATHS = ["/api/auth/signin", "/api/auth/login", "/api/v1/auths/signin", "/api/v1/auths/login", "/auth/login", "/login"];

function normalizedPath(value = "") {
  try {
    return new URL(String(value || ""), window.location.origin).pathname;
  } catch {
    return String(value || "").split("?")[0] || "";
  }
}

function isProviderKeyLoginPath(pathname = "") {
  return PROVIDER_KEY_LOGIN_PATHS.includes(String(pathname || ""));
}

function isProviderKeyLoginRoute() {
  const path = normalizedPath(window.location && window.location.href);
  const hash = String(window.location && window.location.hash || "").toLowerCase();
  return isProviderKeyLoginPath(path) || hash === "#/login" || hash === "#/signin" || hash === "#/auth/login";
}

function formTargetsProviderKeyLogin(form) {
  const action = form && typeof form.getAttribute === "function" ? form.getAttribute("action") : "";
  return isProviderKeyLoginPath(normalizedPath(action || window.location.href));
}

function isProviderKeyLoginForm(form) {
  if (!form || typeof form.querySelector !== "function") return false;
  if (form.getAttribute("data-opl-provider-key-form") === "1") return true;
  const method = String(form.getAttribute("method") || "post").toLowerCase();
  if (method && method !== "post") return false;
  const hasPassword = Boolean(form.querySelector('input[type="password"], input[name="password"]'));
  if (!hasPassword) return false;
  return formTargetsProviderKeyLogin(form) || isProviderKeyLoginRoute();
}

function injectGflabtokenApiKeyField(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  const forms = Array.from(root.querySelectorAll("form"));
  for (const form of forms) {
    if (!form || typeof form.querySelector !== "function") continue;
    if (form.querySelector("[data-opl-provider-key]")) continue;
    if (!isProviderKeyLoginForm(form)) continue;
    const passwordInputs = Array.from(form.querySelectorAll('input[type="password"], input[name="password"]'));
    if (!passwordInputs.length) continue;
    const passwordField = passwordInputs[passwordInputs.length - 1];
    const wrapper = createProviderKeyField();
    const anchor = passwordField.closest("p, div, label, section") || passwordField;
    if (anchor.parentNode && typeof anchor.parentNode.insertBefore === "function" && anchor.nextSibling) {
      anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);
      continue;
    }
    if (anchor.parentNode && typeof anchor.parentNode.appendChild === "function") {
      anchor.parentNode.appendChild(wrapper);
      continue;
    }
    if (typeof form.appendChild === "function") form.appendChild(wrapper);
  }
}

function installGflabtokenApiKeyFieldObserver() {
  injectGflabtokenApiKeyField(document);
  if (typeof MutationObserver === "function" && document && document.body) {
    const observer = new MutationObserver(() => injectGflabtokenApiKeyField(document));
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (typeof window.setInterval === "function") {
    window.setInterval(() => injectGflabtokenApiKeyField(document), 1000);
  }
}



function removeLaunchProviderConnectionPanel() {

  try {

    const panel = document.querySelector("[data-opl-launch-provider-panel]");

    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);

  } catch {}

}



async function bindLaunchProviderKey(state, bootstrap, providerKey) {
  const launch = bootstrap.launch || {};
  const portal = bootstrap.portal || {};
  const workspace = bootstrap.workspace || {};
  return fetchJson(PORTAL_ADAPTER_PATH + "/api/opl-launch/sessions/bind", {
    method: "POST",
    body: JSON.stringify({
      workspaceId: portal.workspaceId || launch.workspaceId || workspace.workspaceId || "",
      workspaceSessionId: portal.workspaceSessionId || launch.workspaceSessionId || "",
      runtimeSessionId: portal.runtimeSessionId || launch.runtimeSessionId || "",
      oplSessionId: "opl-web:" + (launch.launchId || portal.runtimeSessionId || Date.now()),
      workspacePath: workspace.workspacePath || launch.workspacePath || "",
      provider: "gflabtoken",
      source: "user_input",
      apiKey: providerKey,
      userAgent: window.navigator.userAgent
    })
  });
}

function updateLaunchProviderPanelMessage(panel, message, { error = false } = {}) {
  if (!panel || typeof panel.querySelector !== "function") return;
  const messageNode = panel.querySelector("[data-opl-provider-message]");
  if (!messageNode) return;
  messageNode.textContent = message || "";
  messageNode.style.color = error ? "#dc2626" : "#475569";
}

function renderLaunchProviderConnectionPanel(state, bootstrap) {

  const existing = document.querySelector("[data-opl-launch-provider-panel]");

  if (existing) return existing;

  const panel = document.createElement("section");

  panel.setAttribute("data-opl-launch-provider-panel", "1");

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

  title.textContent = "连接 gflabtoken";

  title.style.margin = "0 0 12px";

  title.style.fontSize = "18px";

  const hint = document.createElement("p");

  hint.textContent = "当前 OPL 会话需要 gflabtoken API Key。模型服务来源于 gflabtoken，请填写与当前 Portal 身份配套的 key。";

  hint.style.margin = "0 0 14px";

  hint.style.fontSize = "14px";

  hint.style.color = "#475569";

  const form = document.createElement("form");
  form.style.display = "grid";
  form.style.gap = "12px";

  const providerField = createProviderKeyField();
  const providerInput = providerField.querySelector("[data-opl-provider-key]");
  if (providerInput) providerInput.setAttribute("placeholder", "来源于 gflabtoken");

  const message = document.createElement("p");
  message.setAttribute("data-opl-provider-message", "1");
  message.style.margin = "0";
  message.style.fontSize = "12px";
  message.style.minHeight = "18px";
  message.style.color = "#475569";

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "grid";
  buttonRow.style.gap = "8px";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "继续进入 OPL";
  submit.style.width = "100%";
  submit.style.height = "40px";
  submit.style.border = "0";
  submit.style.borderRadius = "6px";
  submit.style.background = "#111827";
  submit.style.color = "#ffffff";
  submit.style.cursor = "pointer";

  const returnButton = document.createElement("button");
  returnButton.type = "button";
  returnButton.textContent = "返回 Portal";
  returnButton.style.width = "100%";
  returnButton.style.height = "40px";
  returnButton.style.border = "1px solid #cbd5e1";
  returnButton.style.borderRadius = "6px";
  returnButton.style.background = "#ffffff";
  returnButton.style.color = "#0f172a";
  returnButton.style.cursor = "pointer";
  returnButton.addEventListener("click", () => {
    const directEntry = window.__OPL_PORTAL_DIRECT_ENTRY__ || DIRECT_ENTRY_DEFAULT;
    const target = directEntry.openFromPortalUrl || directEntry.portalPublicUrl || "";
    if (target) window.location.href = target;
  });

  form.addEventListener("submit", (event) => {
    handleLaunchProviderPanelSubmit(event, state, bootstrap, panel);
  }, true);

  buttonRow.appendChild(submit);
  buttonRow.appendChild(returnButton);

  box.appendChild(title);

  box.appendChild(hint);

  form.appendChild(providerField);
  form.appendChild(message);
  form.appendChild(buttonRow);
  box.appendChild(form);

  panel.appendChild(box);

  document.body.appendChild(panel);

  return panel;

}



async function handleLaunchProviderPanelSubmit(event, state, bootstrap, panel) {
  event.preventDefault();
  const input = panel && typeof panel.querySelector === "function"
    ? panel.querySelector("[data-opl-provider-key]")
    : null;
  const providerKey = normalizeProviderKey(input && "value" in input ? input.value : "");
  if (!providerKey) {
    updateLaunchProviderPanelMessage(panel, "请输入来源于 gflabtoken 的 API Key。", { error: true });
    return;
  }
  if (input) input.disabled = true;
  const submit = panel && typeof panel.querySelector === "function"
    ? panel.querySelector('button[type="submit"]')
    : null;
  if (submit) submit.disabled = true;
  updateLaunchProviderPanelMessage(panel, "正在绑定 gflabtoken 凭证...");
  try {
    await bindLaunchProviderKey(state, bootstrap, providerKey);
    if (input && "value" in input) input.value = "";
    const refreshedBootstrap = await fetchJson(PORTAL_ADAPTER_PATH + "/api/opl-launch/bootstrap");
    writeStoredBootstrap(refreshedBootstrap);
    if (!providerConfiguredFromBootstrap(refreshedBootstrap)) {
      throw new Error("provider_connection_required");
    }
    removeLaunchProviderConnectionPanel();
    await completePortalLaunch(state, refreshedBootstrap);
  } catch (error) {
    updateLaunchProviderPanelMessage(panel, safeErrorMessage(error, "gflabtoken 绑定失败，请重试。"), { error: true });
  } finally {
    if (input && "value" in input) input.value = "";
    if (input) input.disabled = false;
    if (submit) submit.disabled = false;
  }
}

function ensureLaunchProviderPanel(state, bootstrap) {

  if (providerConfiguredFromBootstrap(bootstrap)) {

    removeLaunchProviderConnectionPanel();

    return true;

  }

  renderLaunchProviderConnectionPanel(state, bootstrap);

  updateDirectEntryState({
    active: true,
    authenticated: false,
    reason: "provider_connection_required"
  });

  return false;
}



function requireLaunchState() {
  const state = readStoredState();
  if (state.launchStatus !== "ready") {
    throw new Error("Portal launch session is not available. Open OPL Web from Portal.");
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
      const bootstrap = await fetchJson(PORTAL_ADAPTER_PATH + "/api/opl-launch/bootstrap");
      writeStoredBootstrap(bootstrap);
      return bootstrap;
    },
    async startRun(input = {}) {
      const state = requireLaunchState();
      return fetchJson(PORTAL_ADAPTER_PATH + "/api/opl-launch/runs", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    async sendMessage(input = {}) {
      const state = requireLaunchState();
      const accepted = await fetchJson(PORTAL_ADAPTER_PATH + "/api/opl-launch/messages", {
        method: "POST",
        body: JSON.stringify(input)
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
      return fetchJson(PORTAL_ADAPTER_PATH + "/api/opl-launch/runs/" + encodeURIComponent(runId) + "/status");
    },
    async getArtifacts(runId) {
      if (!runId) throw new Error("runId is required.");
      const state = requireLaunchState();
      return fetchJson(PORTAL_ADAPTER_PATH + "/api/opl-launch/runs/" + encodeURIComponent(runId) + "/artifacts");
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
installGflabtokenApiKeyFieldObserver();

async function completePortalLaunch(state, bootstrap) {
  const launch = bootstrap.launch || {};
  const portal = bootstrap.portal || {};
  const workspace = bootstrap.workspace || {};
  const sessionBind = await fetchJson(PORTAL_ADAPTER_PATH + "/api/opl-launch/sessions/bind", {
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
  stripPublicAdapterQuery();
}

function pickFields(source = {}, keys = []) {
  const target = {};
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") target[key] = source[key];
  }
  return target;
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
  const bootstrap = await fetchJson(PORTAL_ADAPTER_PATH + "/api/opl-launch/bootstrap");
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
});
`;
}
