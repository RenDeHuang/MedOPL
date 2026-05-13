import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(configDir, "..");

export const repoRoot = path.resolve(srcRoot, "../../../");
export const portalWorkdir = path.resolve(srcRoot, "..");
export const publicRoot = path.join(srcRoot, "public");
export const frontendDistRoot = path.join(portalWorkdir, "frontend", "dist");
export const runtimeRoot = path.resolve(String(process.env.PORTAL_RUNTIME_ROOT || path.join(repoRoot, ".runtime", "portal")).trim() || path.join(repoRoot, ".runtime", "portal"));
export const dataFile = path.join(runtimeRoot, "portal-db.json");
export const eventsFile = path.join(runtimeRoot, "events.jsonl");
export const PORTAL_OPL_PROVIDER_SECRET_ROOT = String(
  process.env.PORTAL_OPL_PROVIDER_SECRET_ROOT ||
  path.join(repoRoot, ".runtime", "portal-opl-adapter", "provider-secrets"),
).trim();
export const medWorkspaceRoot = path.join(repoRoot, ".runtime", "med-autoscience", "workspaces");
export const medRunsRoot = path.join(repoRoot, ".runtime", "med-autoscience", "runs");
export const codexRuntimeRoot = path.join(repoRoot, ".runtime", "codex-runtime-gateway");
export const codexRuntimeEventsFile = path.join(codexRuntimeRoot, "events.jsonl");
export const syncWorkspaceToMinioScriptRelative = path.join("..", "..", "scripts", "sync-workspace-file-to-minio.ps1");
export const mcBinary = path.join(repoRoot, ".runtime", "tools", "mc.exe");
export const ZITADEL_ADMIN_USER_SCRIPT = path.join(repoRoot, "scripts", "zitadel-admin-user.mjs");

export const PORT = Number(process.env.PORT || 17080);
export const PORTAL_STORAGE_MODE = String(process.env.PORTAL_STORAGE_MODE || "json").trim().toLowerCase();
export const PORTAL_POSTGRES_URL = String(process.env.PORTAL_POSTGRES_URL || "postgres://postgres:postgres@127.0.0.1:5432/med_meta").trim();
export const PORTAL_REDIS_URL = String(process.env.PORTAL_REDIS_URL || "redis://127.0.0.1:6379").trim();
export const PORTAL_DB_NAMESPACE = String(process.env.PORTAL_DB_NAMESPACE || "portal").trim() || "portal";
export const PORTAL_OPL_ADAPTER_URL = String(process.env.PORTAL_OPL_ADAPTER_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
export const PORTAL_OPL_RESOURCE_BINDING_ID = String(process.env.PORTAL_OPL_RESOURCE_BINDING_ID || "").trim();
export const PORTAL_OPL_COMPUTE_INSTANCE_ID = String(process.env.PORTAL_OPL_COMPUTE_INSTANCE_ID || "").trim();
export const PORTAL_OPL_STORAGE_BUCKET_ID = String(process.env.PORTAL_OPL_STORAGE_BUCKET_ID || "").trim();
export const PORTAL_OPL_RUNTIME_AGENT_ID = String(process.env.PORTAL_OPL_RUNTIME_AGENT_ID || "").trim();
export const PORTAL_OPL_RUNTIME_AGENT_ENDPOINT = String(process.env.PORTAL_OPL_RUNTIME_AGENT_ENDPOINT || "").trim().replace(/\/$/, "");
export const PORTAL_PUBLIC_URL = String(process.env.PORTAL_PUBLIC_URL || "").replace(/\/$/, "");
export const OPL_WEB_URL = String(process.env.OPL_WEB_URL || "").replace(/\/$/, "");
export const OPL_RUNTIME_MODE = String(process.env.OPL_RUNTIME_MODE || "unknown").trim() || "unknown";
export const OPL_WEBUI_AUTH_MODE = String(process.env.OPL_WEBUI_AUTH_MODE || "unknown").trim() || "unknown";
export const PRODUCT_RUNTIME_MODE = String(process.env.PRODUCT_RUNTIME_MODE || "platform_provisioned").trim().toLowerCase() || "platform_provisioned";
export const PRODUCT_OPS_PROFILE = String(process.env.PRODUCT_OPS_PROFILE || "").trim() === "1";
export const OPL_RUNTIME_TIMEOUT_MS = Number(process.env.OPL_RUNTIME_TIMEOUT_MS || 10000);
export const LANGFUSE_URL = process.env.LANGFUSE_URL || "http://127.0.0.1:13000";
export const LANGFUSE_PUBLIC_KEY = String(process.env.LANGFUSE_PUBLIC_KEY || "").trim();
export const LANGFUSE_SECRET_KEY = String(process.env.LANGFUSE_SECRET_KEY || "").trim();
export const LANGFUSE_PROJECT_ID = String(process.env.LANGFUSE_PROJECT_ID || "").trim();
export const OPENCOST_UI_URL = String(process.env.OPENCOST_UI_URL || "").trim();
export const KUBESPHERE_URL = process.env.KUBESPHERE_URL || "";
export const RANCHER_URL = String(process.env.RANCHER_URL || "").trim();
export const HARBOR_URL = String(process.env.HARBOR_URL || "").trim();
export const HARBOR_API_URL = process.env.HARBOR_API_URL || HARBOR_URL;
export const HARBOR_ENABLED = String(process.env.HARBOR_ENABLED || "").trim() === "1";
export const HARBOR_USERNAME = String(process.env.HARBOR_USERNAME || "").trim();
export const HARBOR_PASSWORD = String(process.env.HARBOR_PASSWORD || "").trim();
export const MINIO_CONSOLE_URL = String(process.env.MINIO_CONSOLE_URL || "").trim();
export const SHOW_LEGACY_KUBESPHERE = String(process.env.SHOW_LEGACY_KUBESPHERE || "").trim() === "1";
export const MINIO_API_URL = String(process.env.MINIO_API_URL || "").trim();
export const RETIRED_STORAGE_API_URL = MINIO_API_URL;
export const RETIRED_STORAGE_CONSOLE_URL = MINIO_CONSOLE_URL;
export const RETIRED_COST_UI_URL = OPENCOST_UI_URL;
export const RETIRED_REGISTRY_URL = HARBOR_URL;
export const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || "http://127.0.0.1:3311";
export const BILLING_SERVICE_TIMEOUT_MS = Number(process.env.BILLING_SERVICE_TIMEOUT_MS || 20000);
export const RESOURCE_PROVISIONER_URL = String(process.env.RESOURCE_PROVISIONER_URL || "").trim();
export const RESOURCE_PROVISIONER_TIMEOUT_MS = Number(process.env.RESOURCE_PROVISIONER_TIMEOUT_MS || 180000);
export const TENCENT_BILLING_ENABLED = String(process.env.TENCENT_BILLING_ENABLED || "").trim() === "1";
export const TENCENT_BILLING_REQUIRED = String(process.env.TENCENT_BILLING_REQUIRED || "").trim() === "1";
export const BUILD_SHA = String(process.env.BUILD_SHA || "dev").trim() || "dev";
export const BUILD_TIME = String(process.env.BUILD_TIME || "unknown").trim() || "unknown";
export const PORTAL_ENABLE_CLOUD_OPERATION_TEST_BRIDGE = String(process.env.PORTAL_ENABLE_CLOUD_OPERATION_TEST_BRIDGE || "").trim() === "1"
  && String(process.env.NODE_ENV || "").trim().toLowerCase() !== "production";
export const PORTAL_ENABLE_CLOUD_OPERATION_PRODUCTION_BRIDGE = String(process.env.PORTAL_ENABLE_CLOUD_OPERATION_PRODUCTION_BRIDGE || "").trim() === "1";
export const PORTAL_CLOUD_OPERATION_RUNNER_MODE = String(process.env.PORTAL_CLOUD_OPERATION_RUNNER_MODE || "fake-live").trim() || "fake-live";
export const PORTAL_CLOUD_OPERATION_PACKAGE_C_SECRET_FILE = String(process.env.PORTAL_CLOUD_OPERATION_PACKAGE_C_SECRET_FILE || "").trim();
export const PORTAL_CLOUD_OPERATION_RUNNER_SCRIPT = String(process.env.PORTAL_CLOUD_OPERATION_RUNNER_SCRIPT || "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs").trim()
  || "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs";
export const PORTAL_CLOUD_OPERATION_COMPUTE_NODE_POOL_REF = String(process.env.PORTAL_CLOUD_OPERATION_COMPUTE_NODE_POOL_REF || "").trim();
export const PORTAL_CLOUD_OPERATION_COMPUTE_POOL_BASELINE_CAPACITY = Number(process.env.PORTAL_CLOUD_OPERATION_COMPUTE_POOL_BASELINE_CAPACITY || 2);

export const adminSeed = {
  email: process.env.PORTAL_ADMIN_EMAIL || "zitadel-admin@zitadel.localhost",
  password: process.env.PORTAL_ADMIN_PASSWORD || "Password1!",
  name: process.env.PORTAL_ADMIN_NAME || "ZITADEL Admin",
};

export const PORTAL_ADMIN_SEED_BALANCE = Number(process.env.PORTAL_ADMIN_SEED_BALANCE || 100);
export const PORTAL_TRIAL_CREDIT_AMOUNT = Number(process.env.PORTAL_TRIAL_CREDIT_AMOUNT || 50);
export const PORTAL_TRIAL_VALID_DAYS = Number(process.env.PORTAL_TRIAL_VALID_DAYS || 14);

export const PORTAL_OIDC_ENABLED = String(process.env.PORTAL_OIDC_ENABLED || "1") !== "0";
export const PORTAL_OIDC_ISSUER = process.env.PORTAL_OIDC_ISSUER || "https://auth.localhost:18443";
export const PORTAL_OIDC_CLIENT_ID = process.env.PORTAL_OIDC_CLIENT_ID || "368843754573922307";
export const PORTAL_OIDC_CLIENT_SECRET = process.env.PORTAL_OIDC_CLIENT_SECRET || "ddulXe78YePwKC2fYyVATNutBJS50BPhnSJutOxmplWm4chYeOiyusvwxUbx8iFM";
export const PORTAL_OIDC_REDIRECT_URI = process.env.PORTAL_OIDC_REDIRECT_URI || "http://127.0.0.1:17080/auth/oidc/callback";
export const PORTAL_OIDC_SCOPE = process.env.PORTAL_OIDC_SCOPE || "openid profile email";
export const PORTAL_INTERNAL_AUTH_TOKEN = String(process.env.PORTAL_INTERNAL_AUTH_TOKEN || "").trim();
export const PORTAL_IDENTITY_SYNC_MODE = String(process.env.PORTAL_IDENTITY_SYNC_MODE || (PORTAL_OIDC_ENABLED ? "zitadel" : "local")).trim().toLowerCase();

function assertProductionSecret(name, value, defaults = []) {
  if (String(process.env.NODE_ENV || "").toLowerCase() !== "production") return;
  const normalized = String(value || "").trim();
  if (!normalized || defaults.includes(normalized)) {
    throw new Error(`production_config_invalid:${name}`);
  }
}

export function validateProductionConfig() {
  assertProductionSecret("PORTAL_ADMIN_PASSWORD", adminSeed.password, ["Password1!"]);
  if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    if (PORTAL_STORAGE_MODE !== "postgres_redis") {
      throw new Error("production_config_invalid:PORTAL_STORAGE_MODE_must_be_postgres_redis");
    }
    assertProductionSecret("PORTAL_POSTGRES_URL", PORTAL_POSTGRES_URL, [
      "postgres://postgres:postgres@127.0.0.1:5432/med_meta",
      "postgres://user:password@postgres.example.internal:5432/portal",
    ]);
    assertProductionSecret("PORTAL_REDIS_URL", PORTAL_REDIS_URL, [
      "redis://127.0.0.1:6379",
      "redis://redis.example.internal:6379",
    ]);
  }
  if (PORTAL_OIDC_ENABLED) {
    assertProductionSecret("PORTAL_OIDC_CLIENT_SECRET", PORTAL_OIDC_CLIENT_SECRET, ["ddulXe78YePwKC2fYyVATNutBJS50BPhnSJutOxmplWm4chYeOiyusvwxUbx8iFM"]);
  }
  if (HARBOR_ENABLED) {
    assertProductionSecret("HARBOR_PASSWORD", HARBOR_PASSWORD, ["HarborAdmin123!"]);
  }
}
