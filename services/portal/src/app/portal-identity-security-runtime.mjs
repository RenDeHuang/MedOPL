export function createPortalIdentitySecurityRuntime({
  env = {},
  deps = {},
} = {}) {
  const {
    adminSeed = {},
    HARBOR_PASSWORD = "",
    PORTAL_IDENTITY_SYNC_MODE = "local",
    PORTAL_OIDC_CLIENT_ID = "",
    PORTAL_OIDC_CLIENT_SECRET = "",
    PORTAL_OIDC_ISSUER = "",
    PORTAL_OIDC_REDIRECT_URI = "",
    PORTAL_OIDC_SCOPE = "",
    ZITADEL_ADMIN_USER_SCRIPT = "",
  } = env;
  const {
    access,
    execFileAsync,
    repoRoot,
  } = deps;

  if (typeof access !== "function") throw new Error("access is required");
  if (typeof execFileAsync !== "function") throw new Error("execFileAsync is required");

  async function runZitadelAdminUser(args = []) {
    if (PORTAL_IDENTITY_SYNC_MODE === "local") {
      return { synced: false, source: "portal_local_identity" };
    }
    if (PORTAL_IDENTITY_SYNC_MODE !== "zitadel") {
      throw new Error(`Unsupported PORTAL_IDENTITY_SYNC_MODE: ${PORTAL_IDENTITY_SYNC_MODE}`);
    }
    await access(ZITADEL_ADMIN_USER_SCRIPT);
    await execFileAsync("node", [ZITADEL_ADMIN_USER_SCRIPT, ...args], {
      cwd: repoRoot,
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 4,
    });
    return { synced: true, source: "zitadel_portal_sync" };
  }

  async function curlJson(args = []) {
    const { stdout } = await execFileAsync("curl.exe", ["-k", "-sS", ...args], {
      cwd: repoRoot,
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 4,
    });
    return JSON.parse(String(stdout || "{}"));
  }

  async function exchangeOidcCode(code) {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: PORTAL_OIDC_REDIRECT_URI,
    }).toString();
    return curlJson([
      "-u", `${PORTAL_OIDC_CLIENT_ID}:${PORTAL_OIDC_CLIENT_SECRET}`,
      "-H", "content-type: application/x-www-form-urlencoded",
      "-d", form,
      `${PORTAL_OIDC_ISSUER}/oauth/v2/token`,
    ]);
  }

  async function fetchOidcUserInfo(accessToken) {
    return curlJson([
      "-H", `Authorization: Bearer ${accessToken}`,
      `${PORTAL_OIDC_ISSUER}/oidc/v1/userinfo`,
    ]);
  }

  function securityConfigSummary() {
    const checks = [
      {
        key: "PORTAL_ADMIN_PASSWORD",
        healthy: adminSeed.password !== "Password1!",
        detail: adminSeed.password !== "Password1!" ? "已覆盖默认管理员密码" : "仍在使用默认管理员密码",
      },
      {
        key: "PORTAL_OIDC_CLIENT_SECRET",
        healthy: PORTAL_OIDC_CLIENT_SECRET !== "ddulXe78YePwKC2fYyVATNutBJS50BPhnSJutOxmplWm4chYeOiyusvwxUbx8iFM",
        detail: PORTAL_OIDC_CLIENT_SECRET !== "ddulXe78YePwKC2fYyVATNutBJS50BPhnSJutOxmplWm4chYeOiyusvwxUbx8iFM" ? "OIDC client secret 已覆盖默认值" : "OIDC client secret 仍为默认值",
      },
      {
        key: "HARBOR_PASSWORD",
        healthy: HARBOR_PASSWORD !== "HarborAdmin123!",
        detail: HARBOR_PASSWORD !== "HarborAdmin123!" ? "Harbor 密码已覆盖默认值" : "Harbor 密码仍为默认值",
      },
      {
        key: "JWT_REFRESH_SECRET",
        healthy: String(process.env.JWT_REFRESH_SECRET || "").trim() !== "" && String(process.env.JWT_REFRESH_SECRET || "").trim() !== "replace-this-jwt-refresh-secret-64chars",
        detail: String(process.env.JWT_REFRESH_SECRET || "").trim() && String(process.env.JWT_REFRESH_SECRET || "").trim() !== "replace-this-jwt-refresh-secret-64chars" ? "JWT refresh secret 已配置" : "JWT refresh secret 缺失或仍为默认值",
      },
    ];
    const unhealthy = checks.filter((item) => !item.healthy);
    return {
      healthy: unhealthy.length === 0,
      failedCount: unhealthy.length,
      checks,
    };
  }

  return {
    buildAdminSecuritySummary: securityConfigSummary,
    exchangeOidcCode,
    fetchOidcUserInfo,
    runZitadelAdminUser,
    securityConfigSummary,
  };
}
