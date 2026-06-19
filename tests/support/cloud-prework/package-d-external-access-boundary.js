import { parseEnv } from "./package-d-kubernetes-api-preflight-runner.js";
import {
  QCLOUD_EDGE_NODEPORT_APPLY_MODE,
  QCLOUD_EDGE_NODEPORT_DRY_RUN_MODE,
} from "./package-d-external-access-edge-nodeport-contract.js";
import {
  QCLOUD_HEALTHCHECK_APPLY_MODE,
  QCLOUD_HEALTHCHECK_DRY_RUN_MODE,
} from "./package-d-external-access-healthcheck-contract.js";
import {
  QCLOUD_REMOVE_HEALTHCHECK_APPLY_MODE,
  QCLOUD_REMOVE_HEALTHCHECK_DRY_RUN_MODE,
} from "./package-d-external-access-remove-healthcheck-contract.js";
import {
  FIXED_EXTERNAL_SMOKE_URL,
  FIXED_INGRESS_CLASS,
  FIXED_PORTAL_HOST,
  FIXED_TLS_SECRET_NAME,
} from "./package-d-external-access-ingress-contract.js";

export const PACKAGE_D_EXTERNAL_ACCESS_DRY_RUN_COMMAND = "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-ingress-dry-run --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1";
export const PACKAGE_D_EXTERNAL_ACCESS_APPLY_COMMAND = "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-ingress-apply --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1";

export const QCLOUD_INGRESS_DRY_RUN_MODE = "qcloud-ingress-dry-run";
export const QCLOUD_INGRESS_APPLY_MODE = "qcloud-ingress-apply";

const EXTERNAL_ACCESS_MODES = Object.freeze(new Set([
  QCLOUD_INGRESS_DRY_RUN_MODE,
  QCLOUD_INGRESS_APPLY_MODE,
  QCLOUD_EDGE_NODEPORT_DRY_RUN_MODE,
  QCLOUD_EDGE_NODEPORT_APPLY_MODE,
  QCLOUD_HEALTHCHECK_DRY_RUN_MODE,
  QCLOUD_HEALTHCHECK_APPLY_MODE,
  QCLOUD_REMOVE_HEALTHCHECK_DRY_RUN_MODE,
  QCLOUD_REMOVE_HEALTHCHECK_APPLY_MODE,
]));
export const EXTERNAL_ACCESS_ENV_KEYS = Object.freeze(["PORTAL_HOST_DOMAIN", "INGRESS_CLASS", "TLS_SECRET_NAME", "TENCENT_SSL_CERT_ID", "EXTERNAL_SMOKE_URL"]);
const REQUIRED_EXTERNAL_ACCESS_ENV_KEYS = EXTERNAL_ACCESS_ENV_KEYS;
const RUN_GATE_ENV_KEYS = Object.freeze(["RUN_TENCENT_DEPLOY_EXECUTION"]);
export const APPLY_GATE_VALUE = "external-access";
const DRY_RUN_GATE_VALUE = "0";
const FORBIDDEN_ARGS = Object.freeze(new Set(["--deploy", "--rollout", "--rollback", "--build", "--push", "--tencent-mutation", "--package-c-live", "--delete", "--patch", "--scale", "--loadbalancer", "--dns-mutation", "--tls-cert", "--tls-key", "--secret-file"]));

export function text(value = "") {
  return String(value ?? "").trim();
}

export function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`package_d_external_access_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`package_d_external_access_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`package_d_external_access_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

export function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("package_d_external_access_not_authorized");
}

export function assertRunId(runId = "") {
  const safeRunId = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(safeRunId)) throw new Error("package_d_external_access_run_id_required");
  return safeRunId;
}

export function assertMode(mode = "") {
  const normalized = text(mode);
  if (!EXTERNAL_ACCESS_MODES.has(normalized)) throw new Error("package_d_external_access_mode_required");
  return normalized;
}

export function isDryRunMode(mode = "") {
  return mode === QCLOUD_INGRESS_DRY_RUN_MODE || mode === QCLOUD_EDGE_NODEPORT_DRY_RUN_MODE || mode === QCLOUD_HEALTHCHECK_DRY_RUN_MODE || mode === QCLOUD_REMOVE_HEALTHCHECK_DRY_RUN_MODE;
}

export function isApplyMode(mode = "") {
  return mode === QCLOUD_INGRESS_APPLY_MODE || mode === QCLOUD_EDGE_NODEPORT_APPLY_MODE || mode === QCLOUD_HEALTHCHECK_APPLY_MODE || mode === QCLOUD_REMOVE_HEALTHCHECK_APPLY_MODE;
}

export function isEdgeNodePortMode(mode = "") {
  return mode === QCLOUD_EDGE_NODEPORT_DRY_RUN_MODE || mode === QCLOUD_EDGE_NODEPORT_APPLY_MODE;
}

export function isHealthcheckMode(mode = "") {
  return mode === QCLOUD_HEALTHCHECK_DRY_RUN_MODE || mode === QCLOUD_HEALTHCHECK_APPLY_MODE;
}

export function isRemoveHealthcheckMode(mode = "") {
  return mode === QCLOUD_REMOVE_HEALTHCHECK_DRY_RUN_MODE || mode === QCLOUD_REMOVE_HEALTHCHECK_APPLY_MODE;
}

function parseExternalAccessEnvObject(externalAccessEnv = {}) {
  const allowed = new Set(REQUIRED_EXTERNAL_ACCESS_ENV_KEYS);
  const env = {};
  for (const [key, value] of Object.entries(externalAccessEnv || {})) {
    if (!allowed.has(key)) throw new Error(`package_d_external_access_env_non_allowlist_key:${key}`);
    env[key] = text(value);
  }
  const missing = REQUIRED_EXTERNAL_ACCESS_ENV_KEYS.filter((key) => !text(env[key]));
  if (missing.length > 0) throw new Error(`package_d_external_access_env_missing:${missing.join(",")}`);
  return env;
}

export function cleanExternalAccessEnv({ externalAccessEnv = {}, externalAccessEnvContent = "" } = {}) {
  if (text(externalAccessEnvContent)) {
    try {
      return parseEnv(externalAccessEnvContent, EXTERNAL_ACCESS_ENV_KEYS, REQUIRED_EXTERNAL_ACCESS_ENV_KEYS);
    } catch (error) {
      const message = String(error?.message || error);
      throw new Error(message.replace(/^package_d_env_/u, "package_d_external_access_env_"));
    }
  }
  return parseExternalAccessEnvObject(externalAccessEnv);
}

export function cleanRunGateEnv({ runGateEnv = {}, runGateEnvContent = "" } = {}) {
  if (text(runGateEnvContent)) {
    try {
      return parseEnv(runGateEnvContent, RUN_GATE_ENV_KEYS, RUN_GATE_ENV_KEYS);
    } catch (error) {
      const message = String(error?.message || error);
      throw new Error(message.replace(/^package_d_env_/u, "package_d_external_access_run_gate_env_"));
    }
  }
  const env = {};
  for (const [key, value] of Object.entries(runGateEnv || {})) {
    if (!RUN_GATE_ENV_KEYS.includes(key)) throw new Error(`package_d_external_access_run_gate_env_non_allowlist_key:${key}`);
    env[key] = text(value);
  }
  return env;
}

export function assertRunGateEnv(runGateEnv = {}, mode = "") {
  if (isDryRunMode(mode) && runGateEnv.RUN_TENCENT_DEPLOY_EXECUTION !== DRY_RUN_GATE_VALUE) {
    throw new Error("package_d_external_access_dry_run_gate_must_remain_zero");
  }
  if (isApplyMode(mode) && runGateEnv.RUN_TENCENT_DEPLOY_EXECUTION !== APPLY_GATE_VALUE) {
    throw new Error("package_d_external_access_apply_gate_not_authorized");
  }
}

export function assertExternalAccessEnv(env = {}) {
  if (env.PORTAL_HOST_DOMAIN !== FIXED_PORTAL_HOST) throw new Error("package_d_external_access_host_mismatch");
  if (env.INGRESS_CLASS !== FIXED_INGRESS_CLASS) throw new Error("package_d_external_access_ingress_class_mismatch");
  if (env.TLS_SECRET_NAME !== FIXED_TLS_SECRET_NAME) throw new Error("package_d_external_access_tls_secret_mismatch");
  if (env.EXTERNAL_SMOKE_URL !== FIXED_EXTERNAL_SMOKE_URL) throw new Error("package_d_external_access_external_smoke_url_mismatch");
  if (!/^[A-Za-z0-9_-]{4,128}$/u.test(env.TENCENT_SSL_CERT_ID)) {
    throw new Error("package_d_external_access_tencent_ssl_cert_id_invalid");
  }
}
