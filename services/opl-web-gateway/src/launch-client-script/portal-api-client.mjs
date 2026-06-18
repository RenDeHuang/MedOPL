export const PORTAL_API_CLIENT_SECTION = `function resolveLaunchState() {
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
    .replace(/token=[^&\\s"']+/gi, "token=[redacted]")
    .replace(/apiKey["']?\\s*[:=]\\s*["'][^"']+["']/gi, "apiKey:[redacted]");
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
      const bootstrap = await fetchJson(RUNTIME_BRIDGE_OPL_API_PATH + "/bootstrap");
      writeStoredBootstrap(bootstrap);
      return bootstrap;
    },
    async startRun(input = {}) {
      const state = requireLaunchState();
      return fetchJson(RUNTIME_BRIDGE_OPL_API_PATH + "/runs", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    async sendMessage(input = {}) {
      const state = requireLaunchState();
      const accepted = await fetchJson(RUNTIME_BRIDGE_OPL_API_PATH + "/messages", {
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
      return fetchJson(RUNTIME_BRIDGE_OPL_API_PATH + "/runs/" + encodeURIComponent(runId) + "/status");
    },
    async getArtifacts(runId) {
      if (!runId) throw new Error("runId is required.");
      const state = requireLaunchState();
      return fetchJson(RUNTIME_BRIDGE_OPL_API_PATH + "/runs/" + encodeURIComponent(runId) + "/artifacts");
    }
  };
}

window.__OPL_PORTAL__ = window.__OPL_PORTAL__ || buildPortalApi();
window.__OPL_PORTAL_REFRESH_DIRECT_ENTRY__ = refreshDirectEntryShell;
installDirectEntryDismissHandler();
installDirectEntryRouteWatcher();`;
