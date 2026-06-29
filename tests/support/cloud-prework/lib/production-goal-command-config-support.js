import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const OPERATION_CONFIG = Object.freeze({
  tenant_runtime_provisioning: {
    requiredEnv: ["V22_TENCENT_MUTATION_SECRET_FILE", "V22_TENCENT_RUNTIME_PLAN_FILE"],
    requiredPaths: ["V22_TENCENT_MUTATION_SECRET_FILE", "V22_TENCENT_RUNTIME_PLAN_FILE"],
  },
  real_tke_runtime_node_lifecycle: {
    requiredEnv: ["V22_TENCENT_MUTATION_SECRET_FILE", "V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE"],
    requiredPaths: ["V22_TENCENT_MUTATION_SECRET_FILE", "V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE"],
  },
  storage_lifecycle: {
    requiredEnv: ["V22_TENCENT_MUTATION_SECRET_FILE", "V22_TENCENT_STORAGE_PLAN_FILE"],
    requiredPaths: ["V22_TENCENT_MUTATION_SECRET_FILE", "V22_TENCENT_STORAGE_PLAN_FILE"],
  },
  billing_audit_writeback: {
    requiredEnv: ["V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE", "DATABASE_URL"],
    requiredPaths: ["V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE"],
  },
  build_push: {
    requiredEnv: ["V22_CONTAINER_BUILD_CONTEXT", "V22_CONTAINER_DOCKERFILE", "V22_CONTAINER_IMAGE_REF", "TCR_ID", "TCR_SECRET"],
    requiredPaths: ["V22_CONTAINER_BUILD_CONTEXT", "V22_CONTAINER_DOCKERFILE"],
  },
  kubectl: {
    requiredEnv: ["TENCENT_DEPLOY_KUBECONFIG_REF", "V22_KUBERNETES_MANIFEST_DIR"],
    requiredPaths: ["V22_KUBERNETES_MANIFEST_DIR"],
  },
  deploy: {
    requiredEnv: ["TENCENT_DEPLOY_KUBECONFIG_REF", "V22_MEDOPL_DEPLOY_PLAN_FILE"],
    requiredPaths: ["V22_MEDOPL_DEPLOY_PLAN_FILE"],
  },
  live_test: {
    requiredEnv: ["V22_OPL_WEBUI_CONSUMER_CANARY_URL", "V22_MEDOPL_PUBLIC_BASE_URL", "MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256", "MEDOPL_WEBHOOK_SECRET"],
    requiredPaths: [],
  },
});

export function parseEnvFile(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equals = normalized.indexOf("=");
    if (equals <= 0) continue;
    const key = normalized.slice(0, equals).trim();
    let value = normalized.slice(equals + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

export function readJsonFile(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function diagnosticReceiptFromPayload(payload = {}) {
  if (!payload || typeof payload !== "object") return null;
  const allowed = "errorCategory correlationId operationId workspaceIdHash storageBindingIdHash runtimeBindingIdHash currentStorageState releaseState billingStopped destroyIntentState auditEventWritten providerRefPresent dbOperationStage handlerStage retryable runtimeState expectedReleaseTransition resourceBindingPresent billingAttributionPresent stopBillingState idempotencyKeyPresent alreadyReleased providerReleaseCategory migrationState workspaceBindingMatch authSessionMatch launchIdPresent launchLookupSucceeded resourceBindingIdHash providerKeyRefPresent storageState fileNamePresent relativePathHash fileRefHash objectRefHash saveFileStageSucceeded saveAuditEventStageSucceeded billingEventStageSucceeded duplicateCategory".split(" ");
  const receipt = Object.fromEntries(allowed.filter((key) => Object.hasOwn(payload, key)).map((key) => [key, payload[key]]));
  return receipt.errorCategory || receipt.correlationId ? receipt : null;
}

function operationConfig(operation, fail) {
  const config = OPERATION_CONFIG[operation];
  if (!config) fail("production_goal_command_operation_unsupported", { operationClass: operation }, 64);
  return config;
}

function missingEnv(config) {
  return config.requiredEnv.filter((key) => !String(process.env[key] || "").trim());
}

function missingPaths(config) {
  return config.requiredPaths.filter((key) => {
    const value = String(process.env[key] || "").trim();
    return !value || !existsSync(path.resolve(value));
  });
}

function directoryHasFile(dir, predicate = () => true) {
  if (!existsSync(dir)) return false;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isFile() && predicate(entry.name)) return true;
    if (entry.isDirectory() && directoryHasFile(child, predicate)) return true;
  }
  return false;
}

function semanticConfigMissing(operation) {
  const missing = [];
  if (operation === "build_push") {
    const dockerfile = path.resolve(process.env.V22_CONTAINER_DOCKERFILE || "");
    if (!existsSync(dockerfile) || !statSync(dockerfile).isFile()) missing.push("V22_CONTAINER_DOCKERFILE:Dockerfile");
  }
  if (operation === "kubectl" && !directoryHasFile(path.resolve(process.env.V22_KUBERNETES_MANIFEST_DIR || ""), (name) => /\.(?:ya?ml|json)$/u.test(name))) {
    missing.push("V22_KUBERNETES_MANIFEST_DIR:manifest");
  }
  return missing;
}

export function ensureConfig(operation, fail) {
  const config = operationConfig(operation, fail);
  const requiredEnvMissing = missingEnv(config);
  const requiredPathMissing = missingPaths(config);
  const requiredContentMissing = semanticConfigMissing(operation);
  if (requiredEnvMissing.length || requiredPathMissing.length || requiredContentMissing.length) {
    fail("production_goal_command_config_missing", {
      operationClass: operation,
      requiredEnvMissing,
      requiredPathMissing,
      requiredContentMissing,
    }, 65);
  }
  return config;
}

export function getConfigCheck(operation, fail) {
  const config = operationConfig(operation, fail);
  return {
    config,
    requiredEnvMissing: missingEnv(config),
    requiredPathMissing: missingPaths(config),
    requiredContentMissing: semanticConfigMissing(operation),
  };
}
