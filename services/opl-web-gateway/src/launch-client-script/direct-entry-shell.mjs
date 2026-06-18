export const DIRECT_ENTRY_SHELL_SECTION = `function updateDirectEntryState(overrides = {}) {
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

function stripRetiredRuntimeBridgeQuery() {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of ["portal_runtime_bridge_url"]) {
      if (!url.searchParams.has(key)) continue;
      url.searchParams.delete(key);
      changed = true;
    }
    if (!changed) return;
    window.history.replaceState({}, document.title, url.toString());
  } catch {}
}`;
