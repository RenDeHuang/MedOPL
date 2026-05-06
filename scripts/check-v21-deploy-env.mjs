#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnvFileContent, sanitizeText } from "./lib/v21-cloud-live-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const DEFAULT_EXPECTED_TAG = "opl-v21";
const DEFAULT_ENV_FILE = "/home/dev/.secrets/medopl/tke-v21.env";

const REQUIRED_KEYS = [
  "NAMESPACE",
  "RUNTIME_NAMESPACE",
  "INGRESS_CLASS",
  "PORTAL_TLS_SECRET_NAME",
  "OPL_TLS_SECRET_NAME",
  "PORTAL_QCLOUD_CERT_ID",
  "OPL_QCLOUD_CERT_ID",
  "PORTAL_HOST",
  "OPL_HOST",
  "BUILD_SHA",
  "PRODUCT_RUNTIME_MODE",
  "PRODUCT_OPS_PROFILE",
  "IMAGE_PULL_SECRET",
  "IMAGE_PULL_POLICY",
  "PORTAL_IMAGE",
  "OPL_ADAPTER_IMAGE",
  "OPL_WEB_GATEWAY_IMAGE",
  "OPL_WEB_IMAGE",
  "BILLING_IMAGE",
  "V21_CLOUD_PROVISIONER_URL",
  "CLOUD_PROVISIONER_IMAGE_TAG",
  "RUNTIME_STORAGE_CLASS",
  "RUNTIME_STORAGE_SIZE",
  "CLOUD_PROVISIONER_CPU_REQUEST",
  "CLOUD_PROVISIONER_CPU_LIMIT",
  "CLOUD_PROVISIONER_MEMORY_REQUEST",
  "CLOUD_PROVISIONER_MEMORY_LIMIT",
  "PORTAL_STORAGE_MODE",
  "PORTAL_DB_NAMESPACE",
  "PORTAL_POSTGRES_URL",
  "PORTAL_REDIS_URL",
  "PORTAL_ADMIN_EMAIL",
  "PORTAL_ADMIN_NAME",
  "PORTAL_ADMIN_PASSWORD",
  "PORTAL_INTERNAL_AUTH_TOKEN",
  "PORTAL_OIDC_ENABLED",
  "PORTAL_IDENTITY_SYNC_MODE",
  "OPL_LAUNCH_SECRET",
  "OPL_RUNTIME_MODE",
  "OPL_ACP_RUNTIME_DIR",
  "OPL_ACP_RUNTIME_TIMEOUT_MS",
  "OPL_WEB_UPSTREAM_URL",
  "OPL_WEBUI_AUTH_MODE",
  "TENCENT_BILLING_ENABLED",
  "TENCENT_BILLING_REQUIRED",
  "TENCENT_PRICE_ENABLED",
  "TENCENT_CLOUD_REGION",
  "TENCENT_COS_BILL_BUCKET",
  "TENCENT_COS_BILL_REGION",
  "TENCENT_COS_BILL_PREFIX",
  "TENCENT_COS_BILL_ENDPOINT",
  "BILLING_RECONCILE_SCHEDULE",
];

const IMAGE_KEYS = [
  "PORTAL_IMAGE",
  "OPL_ADAPTER_IMAGE",
  "OPL_WEB_GATEWAY_IMAGE",
  "OPL_WEB_IMAGE",
  "BILLING_IMAGE",
  "CLOUD_PROVISIONER_IMAGE",
];

const RETIRED_KEYS = [
  "TLS_SECRET_NAME",
  "RESOURCE_PROVISIONER_IMAGE",
  "RUNNER_ORCHESTRATOR_IMAGE",
  "MED_AUTOSCIENCE_RUNNER_IMAGE",
  "RESOURCE_PROVISIONING_ENABLED",
  "TENCENT_TKE_ENDPOINT",
  "TENCENT_TKE_VERSION",
  "TENCENT_TKE_CLUSTER_ID",
  "TENCENT_TKE_ZONE",
  "TENCENT_VPC_ID",
  "TENCENT_SUBNET_IDS",
  "TENCENT_SECURITY_GROUP_ID",
  "TENCENT_TKE_NODE_IMAGE_ID",
  "OPENCOST_BASE_URL",
  "OPENCOST_UI_URL",
  "MINIO_API_URL",
  "MINIO_CONSOLE_URL",
  "HARBOR_URL",
  "HARBOR_API_URL",
  "HARBOR_ENABLED",
  "HARBOR_USERNAME",
  "HARBOR_PASSWORD",
  "LANGFUSE_URL",
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "LANGFUSE_PROJECT_ID",
  "LANGFUSE_STORAGE_CLASS",
  "LANGFUSE_NEXTAUTH_SECRET",
  "LANGFUSE_SALT",
  "LANGFUSE_ENCRYPTION_KEY",
  "LANGFUSE_POSTGRES_PASSWORD",
  "LANGFUSE_DATABASE_URL",
  "LANGFUSE_CLICKHOUSE_PASSWORD",
  "LANGFUSE_INIT_USER_PASSWORD",
  "MED_AUTOSCIENCE_RUNNER_TOKEN",
  "MED_AUTOSCIENCE_RUNNER_COMMAND",
  "RANCHER_URL",
  "KUBESPHERE_URL",
  "SHOW_LEGACY_KUBESPHERE",
];

const PLACEHOLDER_PATTERNS = [
  /example\.com/i,
  /example\.internal/i,
  /your-namespace/i,
  /^replace-/i,
  /^replace_me$/i,
  /^replace-me$/i,
  /^changeme$/i,
  /^password$/i,
  /^<.*>$/i,
];

const SENSITIVE_KEY_PATTERN = /password|secret|token|postgres_url|redis_url|key$/i;

function parseArgs(argv = process.argv.slice(2)) {
  const parsed = {
    envFile: process.env.V21_DEPLOY_ENV_FILE || process.env.V21_ENV_FILE || DEFAULT_ENV_FILE,
    secretsEnvFile: process.env.V21_SECRETS_ENV_FILE || "",
    expectedTag: process.env.V21_EXPECTED_BUILD_TAG || DEFAULT_EXPECTED_TAG,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--deploy-env-file") {
      parsed.envFile = next || "";
      index += 1;
    } else if (token === "--deploy-secrets-env-file") {
      parsed.secretsEnvFile = next || "";
      index += 1;
    } else if (token === "--expected-tag") {
      parsed.expectedTag = next || DEFAULT_EXPECTED_TAG;
      index += 1;
    } else if (token === "--json") {
      parsed.json = true;
    }
  }
  return parsed;
}

function absolutePath(filePath = "") {
  if (!filePath) return "";
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function readEnvFile(filePath, label, violations) {
  const absolute = absolutePath(filePath);
  if (!absolute || !existsSync(absolute)) {
    violations.push({ code: `${label}_missing`, path: absolute || filePath });
    return {};
  }
  return parseEnvFileContent(readFileSync(absolute, "utf8"));
}

function trackedByGit(absolute) {
  if (!absolute.startsWith(`${repoRoot}${path.sep}`)) return false;
  try {
    const relative = path.relative(repoRoot, absolute);
    execFileSync("git", ["ls-files", "--error-unmatch", relative], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function hasValue(values, key) {
  return String(values[key] || "").trim() !== "";
}

function valueLooksPlaceholder(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function addMissingKeyViolations(values, violations) {
  for (const key of REQUIRED_KEYS) {
    if (!hasValue(values, key)) violations.push({ code: "missing_required_key", key });
  }
  if (values.TENCENT_BILLING_ENABLED === "1") {
    for (const key of ["TENCENT_BILLING_SECRET_ID", "TENCENT_BILLING_SECRET_KEY", "TENCENT_COS_SECRET_ID", "TENCENT_COS_SECRET_KEY"]) {
      if (!hasValue(values, key)) violations.push({ code: "missing_billing_secret", key });
    }
  }
  if (values.PORTAL_OIDC_ENABLED === "1" && !hasValue(values, "PORTAL_OIDC_CLIENT_SECRET")) {
    violations.push({ code: "missing_oidc_secret", key: "PORTAL_OIDC_CLIENT_SECRET" });
  }
}

function addRetiredKeyViolations(values, violations) {
  for (const key of RETIRED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(values, key) && String(values[key] || "").trim() !== "") {
      violations.push({ code: "retired_key_present", key });
    }
  }
}

function addValuePolicyViolations(values, expectedTag, violations) {
  if (values.BUILD_SHA && values.BUILD_SHA !== expectedTag) {
    violations.push({ code: "build_sha_not_v21", key: "BUILD_SHA" });
  }
  if (values.PRODUCT_RUNTIME_MODE && values.PRODUCT_RUNTIME_MODE !== "platform_provisioned") {
    violations.push({ code: "runtime_mode_not_platform_provisioned", key: "PRODUCT_RUNTIME_MODE" });
  }
  if (values.PORTAL_STORAGE_MODE && values.PORTAL_STORAGE_MODE !== "postgres_redis") {
    violations.push({ code: "storage_mode_not_cloud_persistent", key: "PORTAL_STORAGE_MODE" });
  }
  for (const key of ["NAMESPACE", "RUNTIME_NAMESPACE", "PORTAL_DB_NAMESPACE"]) {
    const value = String(values[key] || "");
    if (/\bv(?:19|20)[._-]?/i.test(value) || /v20|v19/i.test(value)) {
      violations.push({ code: "old_version_namespace", key });
    }
  }
  for (const key of ["PORTAL_HOST", "OPL_HOST"]) {
    const value = String(values[key] || "");
    if (value && !/(^|\.)medopl\.cn$/i.test(value)) violations.push({ code: "host_not_medopl", key });
  }
  for (const key of IMAGE_KEYS) {
    if (key === "CLOUD_PROVISIONER_IMAGE") {
      const tagValue = String(values.CLOUD_PROVISIONER_IMAGE_TAG || "").trim();
      if (tagValue && tagValue !== expectedTag) violations.push({ code: "image_tag_not_v21", key: "CLOUD_PROVISIONER_IMAGE_TAG" });
      continue;
    }
    const value = String(values[key] || "").trim();
    if (value && !value.endsWith(`:${expectedTag}`)) violations.push({ code: "image_tag_not_v21", key });
  }
  for (const key of Object.keys(values)) {
    if (valueLooksPlaceholder(values[key])) violations.push({ code: "placeholder_value", key });
  }
}

function sanitizedEnvFile(pathname) {
  return pathname ? path.relative(repoRoot, pathname).startsWith("..") ? pathname : path.relative(repoRoot, pathname) : "";
}

function summarizeValueKeys(values) {
  return Object.keys(values)
    .filter((key) => !SENSITIVE_KEY_PATTERN.test(key))
    .sort();
}

export function checkV21DeployEnv(options = parseArgs()) {
  const violations = [];
  const envFile = absolutePath(options.envFile);
  const secretsEnvFile = absolutePath(options.secretsEnvFile);
  const envValues = readEnvFile(envFile, "env_file", violations);
  const secretValues = secretsEnvFile ? readEnvFile(secretsEnvFile, "secrets_env_file", violations) : {};
  const values = { ...envValues, ...secretValues };
  if (envFile && trackedByGit(envFile)) {
    violations.push({ code: "tracked_env_file", path: sanitizedEnvFile(envFile) });
  }
  addMissingKeyViolations(values, violations);
  addRetiredKeyViolations(values, violations);
  addValuePolicyViolations(values, options.expectedTag || DEFAULT_EXPECTED_TAG, violations);
  return {
    ok: violations.length === 0,
    contract: "v21_deploy_env",
    envFile: sanitizedEnvFile(envFile),
    secretsEnvFile: sanitizedEnvFile(secretsEnvFile),
    expectedTag: options.expectedTag || DEFAULT_EXPECTED_TAG,
    imageKeys: IMAGE_KEYS,
    requiredKeys: REQUIRED_KEYS,
    tcrUsernameAvailable: hasValue(values, "TCR_ID") || hasValue(values, "TCR_USERNAME"),
    tcrPasswordAvailable: hasValue(values, "TCR_PASSWORD") || hasValue(values, "TCR_SECRET"),
    visibleValueKeys: summarizeValueKeys(values),
    violations,
  };
}

function printPayload(payload, json) {
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`v21 deploy env: ${payload.ok ? "ok" : "failed"}`);
  console.log(`envFile: ${payload.envFile}`);
  if (payload.secretsEnvFile) console.log(`secretsEnvFile: ${payload.secretsEnvFile}`);
  if (payload.violations.length) {
    for (const violation of payload.violations) {
      console.log(`- ${violation.code}${violation.key ? `:${violation.key}` : ""}${violation.path ? `:${sanitizeText(violation.path)}` : ""}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs();
  const payload = checkV21DeployEnv(options);
  printPayload(payload, options.json);
  if (!payload.ok) process.exitCode = 1;
}
