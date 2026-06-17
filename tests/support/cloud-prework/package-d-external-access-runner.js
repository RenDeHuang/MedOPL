#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  FIXED_CLUSTER_ID,
  FIXED_NAMESPACE,
  KUBE_ENV_NAME,
  assertFile,
  kubeconfigSummary,
  parseEnv,
} from "./package-d-kubernetes-api-preflight-runner.js";
import {
  FIXED_PORTAL_EDGE_SERVICE_NAME,
  PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_APPLY_COMMAND,
  PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_DRY_RUN_COMMAND,
  QCLOUD_EDGE_NODEPORT_APPLY_MODE,
  QCLOUD_EDGE_NODEPORT_DRY_RUN_MODE,
  assertPortalEdgeNodePortManifestBoundary,
  portalEdgeNodePortServiceManifest,
  qcloudEdgeNodePortCommandPlan,
} from "./package-d-external-access-edge-nodeport-contract.js";

export {
  PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_APPLY_COMMAND,
  PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_DRY_RUN_COMMAND,
} from "./package-d-external-access-edge-nodeport-contract.js";

export const PACKAGE_D_EXTERNAL_ACCESS_DRY_RUN_COMMAND = "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-ingress-dry-run --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1";
export const PACKAGE_D_EXTERNAL_ACCESS_APPLY_COMMAND = "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-ingress-apply --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-external-access-strategy";
const QCLOUD_INGRESS_DRY_RUN_MODE = "qcloud-ingress-dry-run";
const QCLOUD_INGRESS_APPLY_MODE = "qcloud-ingress-apply";
const EXTERNAL_ACCESS_MODES = Object.freeze(new Set([
  QCLOUD_INGRESS_DRY_RUN_MODE,
  QCLOUD_INGRESS_APPLY_MODE,
  QCLOUD_EDGE_NODEPORT_DRY_RUN_MODE,
  QCLOUD_EDGE_NODEPORT_APPLY_MODE,
]));
const EXTERNAL_ACCESS_ENV_KEYS = Object.freeze([
  "PORTAL_HOST_DOMAIN",
  "INGRESS_CLASS",
  "TLS_SECRET_NAME",
  "TENCENT_SSL_CERT_ID",
  "EXTERNAL_SMOKE_URL",
]);
const REQUIRED_EXTERNAL_ACCESS_ENV_KEYS = EXTERNAL_ACCESS_ENV_KEYS;
const RUN_GATE_ENV_KEYS = Object.freeze(["RUN_TENCENT_DEPLOY_EXECUTION"]);
const FIXED_PORTAL_HOST = "portal.medopl.cn";
const FIXED_INGRESS_CLASS = "qcloud";
const FIXED_TLS_SECRET_NAME = "medopl-portal-tls";
const FIXED_EXTERNAL_SMOKE_URL = "https://portal.medopl.cn/";
const FIXED_PORTAL_SERVICE_NAME = "portal-frontend";
const FIXED_PORTAL_SERVICE_PORT = 8080;
const APPLY_GATE_VALUE = "external-access";
const DRY_RUN_GATE_VALUE = "0";
const EVIDENCE_FILE = "real-mutation-redacted.json";
const PEM_CERT_BEGIN = ["-----BEGIN", "CERTIFICATE-----"].join(" ");
const PEM_CERT_END = ["-----END", "CERTIFICATE-----"].join(" ");
const PEM_PRIVATE_KEY_LABEL = ["PRIVATE", "KEY"].join(" ");
const PEM_PRIVATE_KEY_BEGIN = ["-----BEGIN", `${PEM_PRIVATE_KEY_LABEL}-----`].join(" ");
const PEM_PRIVATE_KEY_END = ["-----END", `${PEM_PRIVATE_KEY_LABEL}-----`].join(" ");
const PEM_RSA_PRIVATE_KEY_BEGIN = ["-----BEGIN RSA", `${PEM_PRIVATE_KEY_LABEL}-----`].join(" ");
const PEM_RSA_PRIVATE_KEY_END = ["-----END RSA", `${PEM_PRIVATE_KEY_LABEL}-----`].join(" ");
const FORBIDDEN_ARGS = Object.freeze(new Set([
  "--deploy",
  "--rollout",
  "--rollback",
  "--build",
  "--push",
  "--tencent-mutation",
  "--package-c-live",
  "--delete",
  "--patch",
  "--scale",
  "--loadbalancer",
  "--dns-mutation",
  "--tls-cert",
  "--tls-key",
  "--secret-file",
]));

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
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

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("package_d_external_access_not_authorized");
}

function assertRunId(runId = "") {
  const safeRunId = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(safeRunId)) throw new Error("package_d_external_access_run_id_required");
  return safeRunId;
}

function assertMode(mode = "") {
  const normalized = text(mode);
  if (!EXTERNAL_ACCESS_MODES.has(normalized)) throw new Error("package_d_external_access_mode_required");
  return normalized;
}

function isDryRunMode(mode = "") {
  return mode === QCLOUD_INGRESS_DRY_RUN_MODE || mode === QCLOUD_EDGE_NODEPORT_DRY_RUN_MODE;
}

function isApplyMode(mode = "") {
  return mode === QCLOUD_INGRESS_APPLY_MODE || mode === QCLOUD_EDGE_NODEPORT_APPLY_MODE;
}

function isEdgeNodePortMode(mode = "") {
  return mode === QCLOUD_EDGE_NODEPORT_DRY_RUN_MODE || mode === QCLOUD_EDGE_NODEPORT_APPLY_MODE;
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

function cleanExternalAccessEnv({ externalAccessEnv = {}, externalAccessEnvContent = "" } = {}) {
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

function cleanRunGateEnv({ runGateEnv = {}, runGateEnvContent = "" } = {}) {
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

function assertRunGateEnv(runGateEnv = {}, mode = "") {
  if (isDryRunMode(mode) && runGateEnv.RUN_TENCENT_DEPLOY_EXECUTION !== DRY_RUN_GATE_VALUE) {
    throw new Error("package_d_external_access_dry_run_gate_must_remain_zero");
  }
  if (isApplyMode(mode) && runGateEnv.RUN_TENCENT_DEPLOY_EXECUTION !== APPLY_GATE_VALUE) {
    throw new Error("package_d_external_access_apply_gate_not_authorized");
  }
}

function assertExternalAccessEnv(env = {}) {
  if (env.PORTAL_HOST_DOMAIN !== FIXED_PORTAL_HOST) throw new Error("package_d_external_access_host_mismatch");
  if (env.INGRESS_CLASS !== FIXED_INGRESS_CLASS) throw new Error("package_d_external_access_ingress_class_mismatch");
  if (env.TLS_SECRET_NAME !== FIXED_TLS_SECRET_NAME) throw new Error("package_d_external_access_tls_secret_mismatch");
  if (env.EXTERNAL_SMOKE_URL !== FIXED_EXTERNAL_SMOKE_URL) throw new Error("package_d_external_access_external_smoke_url_mismatch");
  if (!/^[A-Za-z0-9_-]{4,128}$/u.test(env.TENCENT_SSL_CERT_ID)) {
    throw new Error("package_d_external_access_tencent_ssl_cert_id_invalid");
  }
}

function qcloudCertSecret({ certId, redacted = true } = {}) {
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: FIXED_TLS_SECRET_NAME,
      namespace: FIXED_NAMESPACE,
      labels: {
        "app.kubernetes.io/name": FIXED_TLS_SECRET_NAME,
        "app.kubernetes.io/part-of": "medopl-package-d",
      },
    },
    type: "Opaque",
    stringData: {
      qcloud_cert_id: redacted ? "<redacted-env:TENCENT_SSL_CERT_ID>" : certId,
    },
  };
}

function portalIngressManifest({ backendServiceName = FIXED_PORTAL_SERVICE_NAME } = {}) {
  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name: FIXED_PORTAL_SERVICE_NAME,
      namespace: FIXED_NAMESPACE,
      labels: {
        "app.kubernetes.io/name": FIXED_PORTAL_SERVICE_NAME,
        "app.kubernetes.io/part-of": "medopl-package-d",
      },
      annotations: {
        "kubernetes.io/ingress.class": FIXED_INGRESS_CLASS,
      },
    },
    spec: {
      ingressClassName: FIXED_INGRESS_CLASS,
      tls: [{
        hosts: [FIXED_PORTAL_HOST],
        secretName: FIXED_TLS_SECRET_NAME,
      }],
      rules: [{
        host: FIXED_PORTAL_HOST,
        http: {
          paths: [{
            path: "/",
            pathType: "Prefix",
            backend: {
              service: {
                name: backendServiceName,
                port: { number: FIXED_PORTAL_SERVICE_PORT },
              },
            },
          }],
        },
      }],
    },
  };
}

export function assertPackageDExternalAccessManifestBoundary({ secret, ingress, edgeService } = {}) {
  if (!edgeService || secret) {
    if (secret?.apiVersion !== "v1" || secret?.kind !== "Secret") throw new Error("package_d_external_access_secret_kind_mismatch");
    if (secret?.metadata?.name !== FIXED_TLS_SECRET_NAME) throw new Error("package_d_external_access_tls_secret_name_mismatch");
    if (secret?.metadata?.namespace !== FIXED_NAMESPACE) throw new Error("package_d_external_access_tls_secret_namespace_mismatch");
    if (secret?.type !== "Opaque") throw new Error("package_d_external_access_tls_secret_type_mismatch");
    if (Object.hasOwn(secret, "data")) throw new Error("package_d_external_access_tls_secret_data_forbidden");
    const secretKeys = Object.keys(secret?.stringData || {});
    if (secretKeys.length !== 1 || secretKeys[0] !== "qcloud_cert_id") {
      throw new Error("package_d_external_access_tls_secret_key_mismatch");
    }
    if (!text(secret.stringData.qcloud_cert_id)) throw new Error("package_d_external_access_tls_secret_cert_id_required");
  }

  const serialized = JSON.stringify({ secret, ingress, edgeService });
  for (const forbidden of [
    "kubernetes.io/tls",
    "tls.crt",
    "tls.key",
    PEM_CERT_BEGIN,
    PEM_PRIVATE_KEY_BEGIN,
    PEM_RSA_PRIVATE_KEY_BEGIN,
    "client-key-data",
    "client-certificate-data",
    "DATABASE_URL",
    "PORTAL_POSTGRES_PASSWORD",
    "PORTAL_ADMIN_PASSWORD",
    "TCR_SECRET",
    "SecretId",
    "SecretKey",
    "medopl-tenant-",
    "LoadBalancer",
  ]) {
    if (serialized.includes(forbidden)) throw new Error(`package_d_external_access_forbidden_manifest_content:${forbidden}`);
  }

  if (ingress?.apiVersion !== "networking.k8s.io/v1" || ingress?.kind !== "Ingress") {
    throw new Error("package_d_external_access_ingress_kind_mismatch");
  }
  if (ingress?.metadata?.name !== FIXED_PORTAL_SERVICE_NAME) throw new Error("package_d_external_access_ingress_name_mismatch");
  if (ingress?.metadata?.namespace !== FIXED_NAMESPACE) throw new Error("package_d_external_access_ingress_namespace_mismatch");
  if (ingress?.spec?.ingressClassName !== FIXED_INGRESS_CLASS) throw new Error("package_d_external_access_ingress_class_mismatch");
  if (ingress?.metadata?.annotations?.["kubernetes.io/ingress.class"] !== FIXED_INGRESS_CLASS) {
    throw new Error("package_d_external_access_ingress_annotation_mismatch");
  }
  if (ingress?.spec?.tls?.length !== 1 || ingress.spec.tls[0].secretName !== FIXED_TLS_SECRET_NAME) {
    throw new Error("package_d_external_access_ingress_tls_secret_mismatch");
  }
  if (ingress.spec.tls[0].hosts?.[0] !== FIXED_PORTAL_HOST) throw new Error("package_d_external_access_ingress_tls_host_mismatch");
  const pathRule = ingress?.spec?.rules?.[0]?.http?.paths?.[0] || {};
  if (ingress?.spec?.rules?.length !== 1 || ingress.spec.rules[0].host !== FIXED_PORTAL_HOST) {
    throw new Error("package_d_external_access_ingress_host_mismatch");
  }
  if (pathRule.path !== "/" || pathRule.pathType !== "Prefix") throw new Error("package_d_external_access_ingress_path_mismatch");
  const expectedBackendServiceName = edgeService ? FIXED_PORTAL_EDGE_SERVICE_NAME : FIXED_PORTAL_SERVICE_NAME;
  if (pathRule.backend?.service?.name !== expectedBackendServiceName) throw new Error("package_d_external_access_ingress_backend_mismatch");
  if (pathRule.backend?.service?.port?.number !== FIXED_PORTAL_SERVICE_PORT) {
    throw new Error("package_d_external_access_ingress_backend_port_mismatch");
  }
  if (!edgeService) return;
  assertPortalEdgeNodePortManifestBoundary({ edgeService, fixedPortalServicePort: FIXED_PORTAL_SERVICE_PORT });
}

function commandRecord({ name, kind, args, stdinManifest = "" }) {
  return {
    name,
    kind,
    args,
    stdinManifest,
    command: redactCommand(args),
  };
}

function commandPlan({ mode }) {
  const edgeMode = isEdgeNodePortMode(mode);
  const applyMode = isApplyMode(mode);
  const readonly = [
    commandRecord({ name: "kubectl_client_available", kind: "readonly", args: ["kubectl", "version", "--client"] }),
    commandRecord({ name: "current_context", kind: "readonly", args: ["kubectl", "config", "current-context"] }),
    commandRecord({ name: "namespace_read", kind: "readonly", args: ["kubectl", "get", "namespace", FIXED_NAMESPACE, "-o", "json"] }),
    commandRecord({ name: "portal_service_read", kind: "readonly", args: ["kubectl", "get", "service", FIXED_PORTAL_SERVICE_NAME, "-n", FIXED_NAMESPACE, "-o", "json"] }),
    commandRecord({ name: "qcloud_ingressclass_read", kind: "readonly", args: ["kubectl", "get", "ingressclass", FIXED_INGRESS_CLASS, "-o", "json"] }),
  ];
  if (edgeMode) {
    return qcloudEdgeNodePortCommandPlan({
      commandRecord,
      readonly,
      applyMode,
      fixedPortalHost: FIXED_PORTAL_HOST,
      fixedPortalServiceName: FIXED_PORTAL_SERVICE_NAME,
      fixedExternalSmokeUrl: FIXED_EXTERNAL_SMOKE_URL,
    });
  }
  const dryRuns = [
    commandRecord({
      name: "dry_run_qcloud_cert_secret",
      kind: "server_side_dry_run",
      args: ["kubectl", "apply", "--server-side", "--dry-run=server", "-f", "-", "-o", "yaml"],
      stdinManifest: "secret",
    }),
    commandRecord({
      name: "dry_run_portal_ingress",
      kind: "server_side_dry_run",
      args: ["kubectl", "apply", "--server-side", "--dry-run=server", "-f", "-", "-o", "yaml"],
      stdinManifest: "ingress",
    }),
  ];
  if (!applyMode) return [...readonly, ...dryRuns];
  return [
    ...readonly,
    ...dryRuns,
    commandRecord({
      name: "apply_qcloud_cert_secret",
      kind: "apply_secret",
      args: ["kubectl", "apply", "--server-side", "-f", "-"],
      stdinManifest: "secret",
    }),
    commandRecord({
      name: "verify_qcloud_cert_secret",
      kind: "readonly",
      args: ["kubectl", "get", "secret", FIXED_TLS_SECRET_NAME, "-n", FIXED_NAMESPACE, "-o", "json"],
    }),
    commandRecord({
      name: "describe_qcloud_cert_secret",
      kind: "readonly",
      args: ["kubectl", "describe", "secret", FIXED_TLS_SECRET_NAME, "-n", FIXED_NAMESPACE],
    }),
    commandRecord({
      name: "apply_portal_ingress",
      kind: "apply_ingress",
      args: ["kubectl", "apply", "--server-side", "-f", "-"],
      stdinManifest: "ingress",
    }),
    commandRecord({
      name: "verify_portal_ingress",
      kind: "readonly",
      args: ["kubectl", "get", "ingress", FIXED_PORTAL_SERVICE_NAME, "-n", FIXED_NAMESPACE, "-o", "json"],
    }),
    commandRecord({
      name: "describe_portal_ingress",
      kind: "readonly",
      args: ["kubectl", "describe", "ingress", FIXED_PORTAL_SERVICE_NAME, "-n", FIXED_NAMESPACE],
    }),
    commandRecord({
      name: "dns_post_apply_validation",
      kind: "dns_readonly",
      args: ["getent", "hosts", FIXED_PORTAL_HOST],
    }),
    commandRecord({
      name: "https_external_smoke",
      kind: "https_smoke",
      args: ["curl", "--fail-with-body", "--connect-timeout", "10", "--max-time", "30", "--silent", "--show-error", "--output", "-", FIXED_EXTERNAL_SMOKE_URL],
    }),
  ];
}

function redactCommand(args = []) {
  return args.map((arg, index) => {
    if (args[index - 1] !== "-f") return arg;
    return arg === "-" ? "REDACTED_STDIN_EXTERNAL_ACCESS_MANIFEST" : "REDACTED_EXTERNAL_ACCESS_MANIFEST";
  }).join(" ");
}

function assertCommandAllowed(command = {}) {
  const args = command.args || [];
  const joined = ` ${args.join(" ")} `;
  if (joined.includes(" medopl-tenant-")) throw new Error("package_d_external_access_tenant_resource_forbidden");
  for (const forbidden of [" delete ", " patch ", " scale ", " rollout ", " exec ", " cp ", " create ", " replace "]) {
    if (joined.includes(forbidden)) throw new Error(`package_d_external_access_command_forbidden:${forbidden.trim()}`);
  }
  if (args[0] === "kubectl") {
    if (args.includes("--all-namespaces")) throw new Error("package_d_external_access_all_namespaces_forbidden");
    if (command.kind === "readonly") {
      const allowed = new Set([
        "kubectl version --client",
        "kubectl config current-context",
        `kubectl get namespace ${FIXED_NAMESPACE} -o json`,
        `kubectl get service ${FIXED_PORTAL_SERVICE_NAME} -n ${FIXED_NAMESPACE} -o json`,
        `kubectl get service ${FIXED_PORTAL_EDGE_SERVICE_NAME} -n ${FIXED_NAMESPACE} -o json`,
        `kubectl describe service ${FIXED_PORTAL_EDGE_SERVICE_NAME} -n ${FIXED_NAMESPACE}`,
        `kubectl get ingressclass ${FIXED_INGRESS_CLASS} -o json`,
        `kubectl get secret ${FIXED_TLS_SECRET_NAME} -n ${FIXED_NAMESPACE} -o json`,
        `kubectl describe secret ${FIXED_TLS_SECRET_NAME} -n ${FIXED_NAMESPACE}`,
        `kubectl get ingress ${FIXED_PORTAL_SERVICE_NAME} -n ${FIXED_NAMESPACE} -o json`,
        `kubectl describe ingress ${FIXED_PORTAL_SERVICE_NAME} -n ${FIXED_NAMESPACE}`,
      ]);
      if (!allowed.has(args.join(" "))) throw new Error("package_d_external_access_readonly_command_not_allowlisted");
      return;
    }
    if (command.kind === "server_side_dry_run") {
      if (!(args.includes("apply") && args.includes("--server-side") && args.includes("--dry-run=server"))) {
        throw new Error("package_d_external_access_dry_run_must_be_server_side");
      }
      return;
    }
    if (["apply_secret", "apply_ingress", "apply_service"].includes(command.kind)) {
      if (!(args.includes("apply") && args.includes("--server-side") && args.includes("-f") && args[args.indexOf("-f") + 1] === "-")) {
        throw new Error("package_d_external_access_apply_must_use_stdin");
      }
      if (args.includes("--dry-run=server")) throw new Error("package_d_external_access_apply_must_not_be_dry_run");
      return;
    }
    throw new Error("package_d_external_access_kubectl_command_kind_not_allowlisted");
  }
  if (command.kind === "dns_readonly" && args.join(" ") === `getent hosts ${FIXED_PORTAL_HOST}`) return;
  if (command.kind === "https_smoke" && args.join(" ") === `curl --fail-with-body --connect-timeout 10 --max-time 30 --silent --show-error --output - ${FIXED_EXTERNAL_SMOKE_URL}`) return;
  throw new Error("package_d_external_access_command_not_allowlisted");
}

function redactionAudit(serialized = "", { certId = "" } = {}) {
  const content = String(serialized || "");
  const privateKeyMaterialPattern = new RegExp(`${PEM_PRIVATE_KEY_BEGIN}|${PEM_RSA_PRIVATE_KEY_BEGIN}|tlsPrivateKeyPem"\\s*:|tls-private-key-that-must-not-leak`, "u");
  return {
    tencentSslCertIdExposed: Boolean(certId && content.includes(certId)),
    tlsCertificateMaterialExposed: new RegExp(`${PEM_CERT_BEGIN}|tlsCertificatePem"\\s*:|tls-cert-that-must-not-leak`, "u").test(content),
    tlsPrivateKeyMaterialExposed: privateKeyMaterialPattern.test(content),
    kubeconfigExposed: /client-certificate-data|client-key-data|certificate-authority-data|current-context:/u.test(content),
    dbPasswordExposed: /postgres-password|PORTAL_POSTGRES_PASSWORD|DATABASE_URL/u.test(content),
    tcrSecretExposed: /TCR_SECRET|tcr-secret-that-must-not-be-read/u.test(content),
    portalAdminPasswordExposed: /PORTAL_ADMIN_PASSWORD|portal-admin-password/u.test(content),
    tencentSecretExposed: /TENCENT_(?:MUTATION_|READONLY_)?SECRET(?:_ID|_KEY)?|"SecretId"\s*:|"SecretKey"\s*:/u.test(content),
    tenantResourceExposed: /medopl-tenant-/u.test(content),
  };
}

function failedAuditKeys(audit = {}) {
  return Object.entries(audit)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key)
    .join(",");
}

function redactOutput(value = "", { certId = "" } = {}) {
  return String(value || "")
    .replaceAll(certId, "<redacted-env:TENCENT_SSL_CERT_ID>")
    .replaceAll(new RegExp(`${PEM_CERT_BEGIN}[\\s\\S]*?${PEM_CERT_END}`, "gu"), "<redacted-certificate-material>")
    .replaceAll(new RegExp(`${PEM_PRIVATE_KEY_BEGIN}[\\s\\S]*?${PEM_PRIVATE_KEY_END}`, "gu"), "<redacted-private-key-material>")
    .replaceAll(new RegExp(`${PEM_RSA_PRIVATE_KEY_BEGIN}[\\s\\S]*?${PEM_RSA_PRIVATE_KEY_END}`, "gu"), "<redacted-private-key-material>")
    .replaceAll(/client-certificate-data:\s*\S+/gu, "client-certificate-data: <redacted>")
    .replaceAll(/client-key-data:\s*\S+/gu, "client-key-data: <redacted>")
    .replaceAll(/certificate-authority-data:\s*\S+/gu, "certificate-authority-data: <redacted>");
}

export async function buildPackageDExternalAccessPlan({
  runId = "",
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  mode = "",
  externalAccessEnv = {},
  externalAccessEnvContent = "",
  runGateEnv = {},
  runGateEnvContent = "",
  kubeconfigPath = "",
  argv = [],
} = {}) {
  parseArgs(argv);
  assertAuthorized(authorized);
  const safeRunId = assertRunId(runId);
  const normalizedMode = assertMode(mode);
  const env = cleanExternalAccessEnv({ externalAccessEnv, externalAccessEnvContent });
  const cleanedRunGateEnv = cleanRunGateEnv({ runGateEnv, runGateEnvContent });
  assertRunGateEnv(cleanedRunGateEnv, normalizedMode);
  assertExternalAccessEnv(env);

  const edgeMode = isEdgeNodePortMode(normalizedMode);
  const applyMode = isApplyMode(normalizedMode);
  const redactedSecret = edgeMode ? undefined : qcloudCertSecret({ certId: env.TENCENT_SSL_CERT_ID, redacted: true });
  const liveSecret = edgeMode ? undefined : qcloudCertSecret({ certId: env.TENCENT_SSL_CERT_ID, redacted: false });
  const backendServiceName = edgeMode ? FIXED_PORTAL_EDGE_SERVICE_NAME : FIXED_PORTAL_SERVICE_NAME;
  const ingress = portalIngressManifest({ backendServiceName });
  const edgeService = edgeMode ? portalEdgeNodePortServiceManifest() : undefined;
  assertPackageDExternalAccessManifestBoundary({ secret: redactedSecret, ingress, edgeService });
  assertPackageDExternalAccessManifestBoundary({ secret: liveSecret, ingress, edgeService });

  const runEvidenceDir = path.join(evidenceDir, safeRunId);
  const secretManifestPath = edgeMode ? "" : path.join(runEvidenceDir, "qcloud-cert-secret-redacted.json");
  const ingressManifestPath = path.join(runEvidenceDir, "portal-ingress-redacted.json");
  const edgeServiceManifestPath = edgeMode ? path.join(runEvidenceDir, "portal-frontend-edge-service-redacted.json") : "";
  const commands = commandPlan({ mode: normalizedMode }).map((command) => {
    assertCommandAllowed(command);
    return {
      name: command.name,
      kind: command.kind,
      stdinManifest: command.stdinManifest,
      command: command.command,
      args: command.args,
    };
  });

  const backendTarget = `${backendServiceName}:${FIXED_PORTAL_SERVICE_PORT}`;
  const mutations = edgeMode
    ? applyMode
      ? [
          "apply Service/portal-frontend-edge type NodePort in medopl-platform",
          "apply Ingress/portal-frontend in medopl-platform for portal.medopl.cn -> portal-frontend-edge:8080",
        ]
      : [
          "server-side dry-run Service/portal-frontend-edge type NodePort in medopl-platform",
          "server-side dry-run Ingress/portal-frontend in medopl-platform for portal.medopl.cn -> portal-frontend-edge:8080",
        ]
    : applyMode
      ? [
          "apply Secret/medopl-portal-tls in medopl-platform, type Opaque, stringData.qcloud_cert_id",
          "apply Ingress/portal-frontend in medopl-platform for portal.medopl.cn -> portal-frontend:8080",
        ]
      : [
          "server-side dry-run Secret/medopl-portal-tls in medopl-platform, type Opaque, stringData.qcloud_cert_id",
          "server-side dry-run Ingress/portal-frontend in medopl-platform for portal.medopl.cn -> portal-frontend:8080",
        ];
  const plan = {
    ok: true,
    contract: edgeMode
      ? "production_launch_gap_08e_qcloud_edge_nodeport_backend_contract_local_gate"
      : "production_launch_gap_08d_qcloud_external_access_runner_contract_local_gate",
    mode: normalizedMode,
    command: edgeMode
      ? applyMode
        ? PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_APPLY_COMMAND
        : PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_DRY_RUN_COMMAND
      : applyMode
        ? PACKAGE_D_EXTERNAL_ACCESS_APPLY_COMMAND
        : PACKAGE_D_EXTERNAL_ACCESS_DRY_RUN_COMMAND,
    runId: safeRunId,
    target: {
      clusterId: FIXED_CLUSTER_ID,
      namespace: FIXED_NAMESPACE,
      portalHost: FIXED_PORTAL_HOST,
      ingressClass: FIXED_INGRESS_CLASS,
      tlsSecretName: FIXED_TLS_SECRET_NAME,
      backendService: backendServiceName,
      originClusterIpService: FIXED_PORTAL_SERVICE_NAME,
      backendPort: FIXED_PORTAL_SERVICE_PORT,
      externalSmokeUrl: FIXED_EXTERNAL_SMOKE_URL,
    },
    env: {
      source: "authorized_external_access_env",
      allowedKeys: [...EXTERNAL_ACCESS_ENV_KEYS],
      redactedKeys: ["TENCENT_SSL_CERT_ID"],
      runTencentDeployExecution: cleanedRunGateEnv.RUN_TENCENT_DEPLOY_EXECUTION,
      runTencentDeployExecutionSource: "process_or_deploy_run_gate_env",
      runTencentDeployExecutionApplyValue: APPLY_GATE_VALUE,
      kubeconfigPath: kubeconfigPath ? "authorized_kubeconfig_ref" : "not_loaded_in_local_gate",
    },
    manifests: {
      ...(redactedSecret ? { secret: redactedSecret } : {}),
      ingress,
      ...(edgeService ? { edgeService } : {}),
    },
    manifestBoundary: {
      qcloudSecretType: "Opaque",
      qcloudCertIdDataKey: "qcloud_cert_id",
      kubernetesTlsSecretForbidden: true,
      legacyTlsDataKeysForbidden: true,
      tlsPrivateKeyReadAllowed: false,
      backend: backendTarget,
      originalClusterIpServiceMutationAllowed: false,
      edgeNodePortServiceRequired: edgeMode,
      loadBalancerServiceForbidden: true,
      namespace: FIXED_NAMESPACE,
    },
    allowedOperations: {
      mutations,
      verification: [
        ...(edgeMode ? [] : ["get/describe Secret medopl-portal-tls in medopl-platform without printing qcloud_cert_id value"]),
        "get/describe Ingress portal-frontend in medopl-platform",
        "get Service portal-frontend in medopl-platform",
        ...(edgeMode ? ["get/describe Service portal-frontend-edge in medopl-platform"] : []),
        "get IngressClass qcloud",
        "DNS post-apply validation for portal.medopl.cn without DNS mutation",
        "HTTPS smoke for https://portal.medopl.cn/",
      ],
    },
    forbiddenOperations: [
      "legacy Kubernetes TLS Secret shape",
      "legacy TLS certificate/key data keys",
      "TLS private key read",
      edgeMode
        ? "Deployment/original ClusterIP Service/ConfigMap/RBAC/Namespace mutation"
        : "Deployment/Service/ConfigMap/RBAC/Namespace mutation",
      "DNS mutation",
      "LoadBalancer Service creation",
      "Package C or tenant resource mutation",
      "Tencent API mutation",
      "build/push",
      "deploy/rollout/rollback",
      "public access completion claim before evidence closeout",
    ],
    commands: commands.map((command) => ({
      name: command.name,
      kind: command.kind,
      command: command.command,
    })),
    rollbackCleanupPlan: {
      rollbackRequiresSeparateAuthorization: true,
      deleteIngress: "delete only Ingress/portal-frontend if created by this run and rollback is separately authorized",
      deleteTlsSecret: edgeMode
        ? "keep existing Secret/medopl-portal-tls unless a separately authorized rollback explicitly targets it"
        : "delete only Secret/medopl-portal-tls if created by this run and rollback is separately authorized",
      deleteEdgeService: edgeMode
        ? "delete only Service/portal-frontend-edge if created by this run and rollback is separately authorized"
        : "not_applicable",
      restoreOrDeleteIngress: edgeMode
        ? "restore/delete only Ingress/portal-frontend as needed and only with separate authorization"
        : "delete only Ingress/portal-frontend if created by this run and rollback is separately authorized",
      deploymentServiceRollbackAllowed: false,
      dnsMutationAllowed: false,
      evidencePath: path.join(runEvidenceDir, "rollback-cleanup-redacted.json"),
    },
    dnsPlan: {
      cnameHost: FIXED_PORTAL_HOST,
      cnameTargetSource: edgeMode
        ? "qcloud Ingress status load balancer hostname after Ready"
        : "qcloud Ingress status load balancer hostname after apply",
      lastObservedNewLoadBalancerHostname: edgeMode
        ? "lb-b33auprw-h1bv86yx9nswdtfj.clb.usw-tencentclb.com"
        : "not_recorded_in_local_gate",
      dnsMutationAllowed: false,
      requiredAfterIngressReady: "portal.medopl.cn CNAME must be updated outside this runner by separate DNS authorization",
    },
    smokePlan: {
      dnsPostApplyValidation: "resolve portal.medopl.cn and compare with qcloud Ingress status without DNS mutation",
      externalHttpsSmoke: `GET ${FIXED_EXTERNAL_SMOKE_URL}`,
      publicAccessClaimAllowedOnlyAfterSmokeEvidence: true,
      redactionAuditRequired: true,
    },
    stopConditions: [
      "RUN_TENCENT_DEPLOY_EXECUTION is not external-access from process/deploy run gate source for apply mode",
      "context or cluster does not match cls-fi097sy4",
      "namespace is not medopl-platform",
      "portal-frontend Service 8080 is missing",
      ...(edgeMode ? [
        "Service/portal-frontend-edge manifest is not type NodePort",
        "edge Service selector does not match portal-frontend",
        "Ingress manifest does not target portal.medopl.cn -> portal-frontend-edge:8080",
      ] : []),
      "IngressClass qcloud is missing or controller mismatches",
      "Secret manifest is not Opaque with stringData.qcloud_cert_id only",
      edgeMode
        ? "Ingress manifest targets the original ClusterIP backend instead of portal-frontend-edge:8080"
        : "Ingress manifest does not target portal.medopl.cn -> portal-frontend:8080",
      "unexpected existing conflicting Secret or Ingress",
      "DNS target invalid or unauthorized",
      "HTTPS smoke fails",
      "any secret leakage",
      "any command outside allowlist",
    ],
    evidence: {
      sink: ".runtime",
      path: path.join(runEvidenceDir, EVIDENCE_FILE),
      ...(secretManifestPath ? { secretManifestPath } : {}),
      ingressManifestPath,
      ...(edgeServiceManifestPath ? { edgeServiceManifestPath } : {}),
      redacted: true,
    },
    boundary: {
      localGateOnly: false,
      realMutationAllowedNow: applyMode,
      kubectlExecutedByBuildPlan: false,
      secretMutationScope: edgeMode ? "not mutated in Gap 08e; existing Secret/medopl-portal-tls only referenced" : "Secret/medopl-portal-tls only",
      ingressMutationScope: "Ingress/portal-frontend only",
      edgeServiceMutationScope: edgeMode ? "Service/portal-frontend-edge only" : "not_applicable",
      deploymentServiceMutationAllowed: false,
      originalClusterIpServiceMutationAllowed: false,
      dnsMutationAllowed: false,
      loadBalancerMutationAllowed: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      buildPushAllowed: false,
      publicAccessClaimAllowed: false,
    },
    nextGap: {
      id: edgeMode
        ? "production-launch-gap-08e-qcloud-edge-nodeport-apply"
        : "production-launch-gap-08d-qcloud-tls-secret-ingress-real-mutation-apply",
      title: edgeMode
        ? "Production launch Gap 08e: qcloud Ingress backend NodePort edge Service apply"
        : "Production launch Gap 08d: qcloud Opaque cert-id Secret + Portal Ingress real apply",
      boundary: edgeMode
        ? "cloud runner may apply only Service/portal-frontend-edge type NodePort and update Ingress/portal-frontend backend to portal-frontend-edge:8080; DNS mutation remains separate"
        : "cloud runner must place the five external access env keys into an authorized env file; apply mode requires RUN_TENCENT_DEPLOY_EXECUTION=external-access from process/deploy run gate source",
    },
    realExecutionReady: applyMode,
  };
  Object.defineProperty(plan, "liveManifests", {
    value: { ...(liveSecret ? { secret: liveSecret } : {}), ingress, ...(edgeService ? { edgeService } : {}) },
    enumerable: false,
  });
  Object.defineProperty(plan, "liveCommands", {
    value: commands,
    enumerable: false,
  });
  const audit = redactionAudit(JSON.stringify(plan), { certId: env.TENCENT_SSL_CERT_ID });
  const failedAudit = failedAuditKeys(audit);
  if (failedAudit) throw new Error(`package_d_external_access_plan_redaction_audit_failed:${failedAudit}`);
  return plan;
}

async function writeEvidence({ evidenceDir, filename, payload }) {
  await mkdir(evidenceDir, { recursive: true });
  const target = path.join(evidenceDir, filename);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function writePackageDExternalAccessPlanEvidence({ plan } = {}) {
  if (!plan?.evidence?.path) throw new Error("package_d_external_access_plan_required");
  const evidenceDir = path.dirname(plan.evidence.path);
  await writePackageDExternalAccessManifestEvidence({ plan });
  const payload = {
    ...plan,
    commands: plan.commands.map((command) => ({
      name: command.name,
      kind: command.kind,
      command: command.command,
    })),
  };
  const audit = redactionAudit(JSON.stringify(payload));
  const evidence = { ...payload, redactionAudit: audit };
  const failedAudit = failedAuditKeys(audit);
  if (failedAudit) throw new Error(`package_d_external_access_redaction_audit_failed:${failedAudit}`);
  const target = await writeEvidence({ evidenceDir, filename: path.basename(plan.evidence.path), payload: evidence });
  return { path: target, report: evidence };
}

export async function writePackageDExternalAccessManifestEvidence({ plan } = {}) {
  if (!plan?.evidence?.path) throw new Error("package_d_external_access_plan_required");
  const evidenceDir = path.dirname(plan.evidence.path);
  if (plan.evidence.secretManifestPath && plan.manifests.secret) {
    await writeEvidence({ evidenceDir, filename: path.basename(plan.evidence.secretManifestPath), payload: plan.manifests.secret });
  }
  await writeEvidence({ evidenceDir, filename: path.basename(plan.evidence.ingressManifestPath), payload: plan.manifests.ingress });
  if (plan.evidence.edgeServiceManifestPath && plan.manifests.edgeService) {
    await writeEvidence({ evidenceDir, filename: path.basename(plan.evidence.edgeServiceManifestPath), payload: plan.manifests.edgeService });
  }
  const audit = redactionAudit(JSON.stringify(plan.manifests));
  const failedAudit = failedAuditKeys(audit);
  if (failedAudit) throw new Error(`package_d_external_access_manifest_redaction_audit_failed:${failedAudit}`);
  return {
    ...(plan.evidence.secretManifestPath ? { secretManifestPath: plan.evidence.secretManifestPath } : {}),
    ingressManifestPath: plan.evidence.ingressManifestPath,
    ...(plan.evidence.edgeServiceManifestPath ? { edgeServiceManifestPath: plan.evidence.edgeServiceManifestPath } : {}),
  };
}

function defaultCommandExecutor({ args, stdin = "", env = {} }) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    input: stdin,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || result.error?.message || "",
  };
}

function manifestTextForCommand(command = {}, liveManifests = {}) {
  if (command.stdinManifest === "secret") return `${JSON.stringify(liveManifests.secret, null, 2)}\n`;
  if (command.stdinManifest === "ingress") return `${JSON.stringify(liveManifests.ingress, null, 2)}\n`;
  if (command.stdinManifest === "edgeService") return `${JSON.stringify(liveManifests.edgeService, null, 2)}\n`;
  return "";
}

function processRunGateEnv() {
  return {
    RUN_TENCENT_DEPLOY_EXECUTION: text(process.env.RUN_TENCENT_DEPLOY_EXECUTION),
  };
}

function executionContractForMode(mode = "") {
  return isEdgeNodePortMode(mode)
    ? "production_launch_gap_08e_qcloud_edge_nodeport_execution"
    : "production_launch_gap_08d_qcloud_external_access_execution";
}

async function runCommand({ command, executor, kubeconfigPath, liveManifests, certId }) {
  assertCommandAllowed(command);
  const result = await executor({
    args: command.args,
    stdin: manifestTextForCommand(command, liveManifests),
    env: command.args?.[0] === "kubectl" ? { [KUBE_ENV_NAME]: kubeconfigPath } : {},
  });
  const status = Number.isInteger(result?.status) ? result.status : 1;
  const record = {
    name: command.name,
    kind: command.kind,
    command: command.command,
    exitCode: status,
    stdout: redactOutput(result?.stdout || "", { certId }),
    stderr: redactOutput(result?.stderr || "", { certId }),
  };
  if (status !== 0) {
    const error = new Error(`package_d_external_access_command_failed:${command.name}`);
    error.record = record;
    throw error;
  }
  if (command.name === "current_context" && !String(result?.stdout || "").includes(FIXED_CLUSTER_ID)) {
    const error = new Error("package_d_external_access_current_context_mismatch");
    error.record = record;
    throw error;
  }
  return record;
}

export async function runPackageDExternalAccessExecution({
  envPath,
  kubeconfigPath,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  mode = QCLOUD_INGRESS_DRY_RUN_MODE,
  runId = "",
  commandExecutor = defaultCommandExecutor,
} = {}) {
  const normalizedMode = assertMode(mode);
  assertFile(envPath, "package_d_external_access_env_missing");
  const envContent = await readFile(envPath, "utf8");
  const env = cleanExternalAccessEnv({ externalAccessEnvContent: envContent });
  const plan = await buildPackageDExternalAccessPlan({
    runId,
    evidenceDir,
    authorized,
    mode: normalizedMode,
    externalAccessEnv: env,
    runGateEnv: processRunGateEnv(),
    kubeconfigPath,
  });
  await writePackageDExternalAccessManifestEvidence({ plan });
  assertFile(kubeconfigPath, "package_d_external_access_kubeconfig_missing");
  const kubeconfig = await readFile(kubeconfigPath, "utf8");
  const clusterAuth = kubeconfigSummary(kubeconfig);
  const records = [];
  try {
    for (const command of plan.liveCommands) {
      records.push(await runCommand({
        command,
        executor: commandExecutor,
        kubeconfigPath,
        liveManifests: plan.liveManifests,
        certId: env.TENCENT_SSL_CERT_ID,
      }));
    }
  } catch (error) {
    if (error?.record) records.push(error.record);
    const evidencePayload = {
      ok: false,
      contract: executionContractForMode(normalizedMode),
      mode: normalizedMode,
      runId: plan.runId,
      target: plan.target,
      clusterAuth,
      commands: records,
      error: String(error?.message || error),
      redactionAudit: {},
    };
    evidencePayload.redactionAudit = redactionAudit(JSON.stringify(evidencePayload), { certId: env.TENCENT_SSL_CERT_ID });
    const failedAudit = failedAuditKeys(evidencePayload.redactionAudit);
    if (failedAudit) throw new Error(`package_d_external_access_failure_redaction_audit_failed:${failedAudit}`);
    await writeEvidence({ evidenceDir: path.dirname(plan.evidence.path), filename: path.basename(plan.evidence.path), payload: evidencePayload });
    throw error;
  }
  const evidencePayload = {
    ok: true,
    contract: executionContractForMode(normalizedMode),
    mode: normalizedMode,
    runId: plan.runId,
    target: plan.target,
    clusterAuth,
    commands: records,
    manifests: plan.manifests,
    rollbackCleanupPlan: plan.rollbackCleanupPlan,
    smokePlan: plan.smokePlan,
    redactionAudit: {},
    publicAccessClaimAllowedNow: false,
  };
  evidencePayload.redactionAudit = redactionAudit(JSON.stringify(evidencePayload), { certId: env.TENCENT_SSL_CERT_ID });
  const failedAudit = failedAuditKeys(evidencePayload.redactionAudit);
  if (failedAudit) throw new Error(`package_d_external_access_execution_redaction_audit_failed:${failedAudit}`);
  const evidencePath = await writeEvidence({ evidenceDir: path.dirname(plan.evidence.path), filename: path.basename(plan.evidence.path), payload: evidencePayload });
  return {
    ok: true,
    contract: evidencePayload.contract,
    mode: normalizedMode,
    runId: plan.runId,
    evidencePath,
    publicAccessClaimAllowedNow: false,
  };
}

async function runPlanOnlyFromCli(args) {
  const envPath = args.env;
  if (!envPath || !existsSync(envPath)) throw new Error("package_d_external_access_env_missing");
  const envContent = await readFile(envPath, "utf8");
  const plan = await buildPackageDExternalAccessPlan({
    runId: args["run-id"],
    evidenceDir: args["evidence-dir"] || DEFAULT_EVIDENCE_DIR,
    authorized: args.authorized === "1" || args.authorized === "true",
    mode: args.mode,
    externalAccessEnvContent: envContent,
    runGateEnv: processRunGateEnv(),
    kubeconfigPath: args.kubeconfig,
  });
  const evidence = await writePackageDExternalAccessPlanEvidence({ plan });
  return {
    ok: true,
    contract: plan.contract,
    mode: plan.mode,
    runId: plan.runId,
    evidencePath: evidence.path,
    realExecutionReady: plan.realExecutionReady,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = assertMode(args.mode);
  if (args["plan-only"] === "1") {
    const summary = await runPlanOnlyFromCli(args);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }
  const summary = await runPackageDExternalAccessExecution({
    envPath: args.env,
    kubeconfigPath: args.kubeconfig,
    evidenceDir: args["evidence-dir"] || DEFAULT_EVIDENCE_DIR,
    authorized: args.authorized === "1" || args.authorized === "true",
    mode,
    runId: args["run-id"],
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
