export const PORT = Number(process.env.PORT || process.env.OPL_WEB_GATEWAY_PORT || 18789);
export const OPL_WEB_UPSTREAM_URL = String(process.env.OPL_WEB_UPSTREAM_URL || process.env.OPL_WEB_URL || "http://127.0.0.1:13030").replace(/\/$/, "");
export const PORTAL_OPL_ADAPTER_URL = String(process.env.PORTAL_OPL_ADAPTER_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
export const PORTAL_PUBLIC_URL = String(process.env.PORTAL_PUBLIC_URL || "").replace(/\/$/, "");
export const PORTAL_INTERNAL_URL = String(process.env.PORTAL_INTERNAL_URL || PORTAL_PUBLIC_URL || "http://127.0.0.1:17080").replace(/\/$/, "");
export const PORTAL_INTERNAL_AUTH_TOKEN = String(process.env.PORTAL_INTERNAL_AUTH_TOKEN || "").trim();
export const BASE_URL = String(process.env.OPL_WEB_GATEWAY_PUBLIC_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
export const BUILD_SHA = String(process.env.BUILD_SHA || "dev").trim() || "dev";
export const BUILD_TIME = String(process.env.BUILD_TIME || "unknown").trim() || "unknown";
export const OPL_WEBUI_AUTH_MODE = String(process.env.OPL_WEBUI_AUTH_MODE || "unknown").trim() || "unknown";
export const LAUNCH_SCRIPT_PATH = "/portal-launch.js";
export const ADAPTER_PREFIX = "/portal-adapter";
export const LAUNCH_COOKIE = "opl_portal_launch";
export const NATIVE_LOGIN_PATHS = String(process.env.OPL_NATIVE_LOGIN_PATHS || "/api/auth/signin,/api/auth/login,/api/v1/auths/signin,/api/v1/auths/login,/auth/login,/login")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
export const NATIVE_AUTH_USER_PATHS = new Set([
  "/api/auth/user",
  "/api/v1/auths/",
  "/api/v1/auths/me",
  "/api/v1/auths/user",
]);

export function buildPortalContinueUrl() {
  if (!PORTAL_PUBLIC_URL) return null;
  return `${PORTAL_PUBLIC_URL}/portal/opl`;
}

export function buildStatusPayload() {
  return {
    ok: true,
    service: "opl-web-gateway",
    build: {
      sha: BUILD_SHA,
      time: BUILD_TIME,
    },
    identity: {
      ssoMode: "portal-identity-bridge",
      upstreamAuthMode: OPL_WEBUI_AUTH_MODE,
      directEntryPolicy: "portal-native-login-or-launch",
      launchCookieName: LAUNCH_COOKIE,
      authUserWithoutLaunchStatus: 401,
      websocketProxy: true,
      openFromPortalUrl: buildPortalContinueUrl(),
      nativeLoginPaths: NATIVE_LOGIN_PATHS,
    },
    runtime: {
      gatewayPublicUrl: BASE_URL,
      upstreamUrl: OPL_WEB_UPSTREAM_URL,
      portalAdapterUrl: PORTAL_OPL_ADAPTER_URL,
      portalPublicUrl: PORTAL_PUBLIC_URL || null,
      portalInternalUrl: PORTAL_INTERNAL_URL || null,
    },
  };
}

export function buildDirectEntryState(overrides = {}) {
  return {
    active: true,
    authenticated: false,
    authMode: "portal-identity-bridge",
    portalLaunchRequired: true,
    launchCookieName: LAUNCH_COOKIE,
    portalPublicUrl: PORTAL_PUBLIC_URL || null,
    openFromPortalUrl: buildPortalContinueUrl(),
    reason: "portal_login_or_launch_required",
    message: "Sign in with your Portal account or open OPL from Portal.",
    ...overrides,
  };
}
