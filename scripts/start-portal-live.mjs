import { spawn, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const repo = process.cwd();
const runtime = path.join(repo, ".runtime");
fs.mkdirSync(runtime, { recursive: true });

function taskkillPort(port) {
  try {
    const output = execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`, { encoding: "utf8" });
    const pids = output.split(/\s+/).filter(Boolean).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } catch {}
    }
  } catch {}
}

taskkillPort(17080);
taskkillPort(8788);

const bridgeLog = fs.openSync(path.join(runtime, "opl-runtime-bridge-live.log"), "a");
const bridge = spawn("node", ["src/server.mjs"], {
  cwd: path.join(repo, "services", "opl-runtime-bridge"),
  env: {
    ...process.env,
    PORT: "8788",
    OPL_RUNTIME_BRIDGE_PUBLIC_URL: "http://127.0.0.1:8788",
  },
  detached: true,
  stdio: ["ignore", bridgeLog, bridgeLog]
});
bridge.unref();

const portalLog = fs.openSync(path.join(runtime, "portal-live.log"), "a");
const portal = spawn("node", ["src/server.mjs"], {
  cwd: path.join(repo, "services", "portal"),
  env: {
    ...process.env,
    PORT: "17080",
    OPL_RUNTIME_BRIDGE_URL: "http://127.0.0.1:8788",
    OPL_WORKBENCH_URL: "http://127.0.0.1:8788/workbench",
    LANGFUSE_URL: "http://127.0.0.1:13000",
    OPENCOST_UI_URL: "http://127.0.0.1:30090",
    RANCHER_URL: "https://127.0.0.1:30443",
    KUBESPHERE_URL: "http://127.0.0.1:30080",
    HARBOR_URL: "http://127.0.0.1:30095",
    MINIO_CONSOLE_URL: "http://127.0.0.1:30092",
    SHOW_LEGACY_KUBESPHERE: "0",
    BILLING_SERVICE_URL: "http://127.0.0.1:3311",
    PORTAL_STORAGE_MODE: "postgres_redis",
    PORTAL_POSTGRES_URL: "postgres://postgres:postgres@127.0.0.1:5432/med_meta",
    PORTAL_REDIS_URL: "redis://127.0.0.1:6379",
    PORTAL_DB_NAMESPACE: "portal",
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
    PORTAL_ADMIN_EMAIL: "zitadel-admin@zitadel.localhost",
    PORTAL_ADMIN_PASSWORD: "Password1!",
    PORTAL_ADMIN_NAME: "ZITADEL Admin",
    PORTAL_OIDC_ENABLED: "1",
    PORTAL_OIDC_ISSUER: "https://auth.localhost:18443",
    PORTAL_OIDC_CLIENT_ID: "368843754573922307",
    PORTAL_OIDC_CLIENT_SECRET: "ddulXe78YePwKC2fYyVATNutBJS50BPhnSJutOxmplWm4chYeOiyusvwxUbx8iFM",
    PORTAL_OIDC_REDIRECT_URI: "http://127.0.0.1:17080/auth/oidc/callback",
    PORTAL_OIDC_SCOPE: "openid profile email"
  },
  detached: true,
  stdio: ["ignore", portalLog, portalLog]
});
portal.unref();

console.log(JSON.stringify({ ok: true, portalPid: portal.pid, bridgePid: bridge.pid }, null, 2));
