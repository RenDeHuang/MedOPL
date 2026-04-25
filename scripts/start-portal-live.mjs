import { spawn, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const repo = process.cwd();
const runtime = path.join(repo, ".runtime");
fs.mkdirSync(runtime, { recursive: true });

const portsToClear = [
  Number(process.env.PORTAL_PORT || 17080),
  Number(process.env.PORTAL_OPL_ADAPTER_PORT || 8788),
  Number(process.env.MED_AUTOSCIENCE_RUNNER_PORT || 18890),
  Number(process.env.OPL_PRODUCT_API_FIXTURE_PORT || 18910),
];

const portalPort = Number(process.env.PORTAL_PORT || 17080);
const adapterPort = Number(process.env.PORTAL_OPL_ADAPTER_PORT || 8788);
const runnerPort = Number(process.env.MED_AUTOSCIENCE_RUNNER_PORT || 18890);
const oplFixturePort = Number(process.env.OPL_PRODUCT_API_FIXTURE_PORT || 18910);
const useOplFixture = String(process.env.START_OPL_PRODUCT_API_FIXTURE || "1") === "1";
const oplWebUrl = process.env.OPL_WEB_URL || "";
const oplProductApiUrl = process.env.OPL_PRODUCT_API_URL || (useOplFixture ? `http://127.0.0.1:${oplFixturePort}` : "");

function taskkillPort(port) {
  try {
    const output = execSync(
      `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
      { encoding: "utf8" }
    );
    const pids = output
      .split(/\s+/)
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } catch {}
    }
  } catch {}
}

function openLog(name) {
  return fs.openSync(path.join(runtime, name), "a");
}

function spawnDetached(label, cwd, args, env, logName) {
  const logFd = openLog(logName);
  const child = spawn("node", args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  return { label, pid: child.pid, log: path.join(runtime, logName) };
}

for (const port of portsToClear) {
  taskkillPort(port);
}

const started = [];

if (useOplFixture) {
  started.push(
    spawnDetached(
      "opl-product-api-fixture",
      repo,
      ["scripts/fixtures/opl-product-api-fixture.mjs"],
      {
        ...process.env,
        OPL_PRODUCT_API_FIXTURE_PORT: String(oplFixturePort),
      },
      "opl-product-api-fixture-live.log"
    )
  );
}

started.push(
  spawnDetached(
    "med-autoscience-runner",
    path.join(repo, "adapters", "med-autoscience-runner"),
    ["src/server.mjs"],
    {
      ...process.env,
      MED_AUTOSCIENCE_RUNNER_PORT: String(runnerPort),
    },
    "med-autoscience-runner-live.log"
  )
);

started.push(
  spawnDetached(
    "portal-opl-adapter",
    path.join(repo, "services", "opl-runtime-bridge"),
    ["src/server.mjs"],
    {
      ...process.env,
      PORT: String(adapterPort),
      PORTAL_OPL_ADAPTER_PUBLIC_URL: process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL || `http://127.0.0.1:${adapterPort}`,
      PORTAL_OPL_ADAPTER_STATE_ROOT: process.env.PORTAL_OPL_ADAPTER_STATE_ROOT || "",
      OPL_PRODUCT_API_URL: oplProductApiUrl,
      OPL_WEB_URL: oplWebUrl,
      OPL_RUNTIME_MODE: process.env.OPL_RUNTIME_MODE || "",
      OPL_ACP_RUNTIME_DIR: process.env.OPL_ACP_RUNTIME_DIR || process.env.OPL_UPSTREAM_DIR || "",
      OPL_ACP_RUNTIME_COMMAND_JSON: process.env.OPL_ACP_RUNTIME_COMMAND_JSON || "",
      OPL_ACP_RUNTIME_TIMEOUT_MS: process.env.OPL_ACP_RUNTIME_TIMEOUT_MS || "",
      MED_AUTOSCIENCE_RUNNER_URL: process.env.MED_AUTOSCIENCE_RUNNER_URL || `http://127.0.0.1:${runnerPort}`,
    },
    "portal-opl-adapter-live.log"
  )
);

started.push(
  spawnDetached(
    "portal",
    path.join(repo, "services", "portal"),
    ["src/server.mjs"],
    {
      ...process.env,
      PORT: String(portalPort),
      PORTAL_OPL_ADAPTER_URL: process.env.PORTAL_OPL_ADAPTER_URL || `http://127.0.0.1:${adapterPort}`,
      OPL_WEB_URL: oplWebUrl,
      LANGFUSE_URL: process.env.LANGFUSE_URL || "http://127.0.0.1:13000",
      OPENCOST_UI_URL: process.env.OPENCOST_UI_URL || "http://127.0.0.1:30090",
      RANCHER_URL: process.env.RANCHER_URL || "https://127.0.0.1:30443",
      KUBESPHERE_URL: process.env.KUBESPHERE_URL || "http://127.0.0.1:30080",
      HARBOR_URL: process.env.HARBOR_URL || "http://127.0.0.1:30095",
      MINIO_CONSOLE_URL: process.env.MINIO_CONSOLE_URL || "http://127.0.0.1:30092",
      SHOW_LEGACY_KUBESPHERE: process.env.SHOW_LEGACY_KUBESPHERE || "0",
      BILLING_SERVICE_URL: process.env.BILLING_SERVICE_URL || "http://127.0.0.1:3311",
      PORTAL_STORAGE_MODE: process.env.PORTAL_STORAGE_MODE || "postgres_redis",
      PORTAL_POSTGRES_URL: process.env.PORTAL_POSTGRES_URL || "postgres://postgres:postgres@127.0.0.1:5432/med_meta",
      PORTAL_REDIS_URL: process.env.PORTAL_REDIS_URL || "redis://127.0.0.1:6379",
      PORTAL_DB_NAMESPACE: process.env.PORTAL_DB_NAMESPACE || "portal",
      NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || "0",
      PORTAL_ADMIN_EMAIL: process.env.PORTAL_ADMIN_EMAIL || "zitadel-admin@zitadel.localhost",
      PORTAL_ADMIN_PASSWORD: process.env.PORTAL_ADMIN_PASSWORD || "Password1!",
      PORTAL_ADMIN_NAME: process.env.PORTAL_ADMIN_NAME || "ZITADEL Admin",
      PORTAL_OIDC_ENABLED: process.env.PORTAL_OIDC_ENABLED ?? "0",
      PORTAL_IDENTITY_SYNC_MODE: process.env.PORTAL_IDENTITY_SYNC_MODE || "local",
      PORTAL_OIDC_ISSUER: process.env.PORTAL_OIDC_ISSUER || "https://auth.localhost:18443",
      PORTAL_OIDC_CLIENT_ID: process.env.PORTAL_OIDC_CLIENT_ID || "368843754573922307",
      PORTAL_OIDC_CLIENT_SECRET: process.env.PORTAL_OIDC_CLIENT_SECRET || "ddulXe78YePwKC2fYyVATNutBJS50BPhnSJutOxmplWm4chYeOiyusvwxUbx8iFM",
      PORTAL_OIDC_REDIRECT_URI: process.env.PORTAL_OIDC_REDIRECT_URI || `http://127.0.0.1:${portalPort}/auth/oidc/callback`,
      PORTAL_OIDC_SCOPE: process.env.PORTAL_OIDC_SCOPE || "openid profile email",
    },
    "portal-live.log"
  )
);

console.log(JSON.stringify({
  ok: true,
  started,
  entrypoints: {
    portal: `http://127.0.0.1:${portalPort}`,
    portalOplAdapter: `http://127.0.0.1:${adapterPort}`,
    runner: `http://127.0.0.1:${runnerPort}`,
    oplWeb: oplWebUrl,
    oplProductApi: oplProductApiUrl,
  },
}, null, 2));
