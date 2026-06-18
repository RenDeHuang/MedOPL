import { FIXED_NAMESPACE } from "./package-d-kubernetes-api-preflight-runner.js";
import {
  FIXED_PORTAL_EDGE_SERVICE_NAME,
  assertPortalEdgeNodePortManifestBoundary,
} from "./package-d-external-access-edge-nodeport-contract.js";

export const FIXED_PORTAL_HOST = "portal.medopl.cn";
export const FIXED_INGRESS_CLASS = "qcloud";
export const FIXED_TLS_SECRET_NAME = "medopl-portal-tls";
export const FIXED_EXTERNAL_SMOKE_URL = "https://portal.medopl.cn/";
export const FIXED_PORTAL_SERVICE_NAME = "portal-frontend";
export const FIXED_PORTAL_SERVICE_PORT = 8080;
export const PEM_CERT_BEGIN = ["-----BEGIN", "CERTIFICATE-----"].join(" ");
export const PEM_CERT_END = ["-----END", "CERTIFICATE-----"].join(" ");
export const PEM_PRIVATE_KEY_LABEL = ["PRIVATE", "KEY"].join(" ");
export const PEM_PRIVATE_KEY_BEGIN = ["-----BEGIN", `${PEM_PRIVATE_KEY_LABEL}-----`].join(" ");
export const PEM_PRIVATE_KEY_END = ["-----END", `${PEM_PRIVATE_KEY_LABEL}-----`].join(" ");
export const PEM_RSA_PRIVATE_KEY_BEGIN = ["-----BEGIN RSA", `${PEM_PRIVATE_KEY_LABEL}-----`].join(" ");
export const PEM_RSA_PRIVATE_KEY_END = ["-----END RSA", `${PEM_PRIVATE_KEY_LABEL}-----`].join(" ");

function text(value = "") {
  return String(value ?? "").trim();
}

export function qcloudCertSecret({ certId, redacted = true } = {}) {
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

export function portalIngressManifest({ backendServiceName = FIXED_PORTAL_SERVICE_NAME } = {}) {
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

export function assertPackageDExternalAccessManifestBoundary({ secret, ingress, edgeService, edgeBackendRequired = false } = {}) {
  if (secret) {
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
  const expectedBackendServiceName = edgeService || edgeBackendRequired ? FIXED_PORTAL_EDGE_SERVICE_NAME : FIXED_PORTAL_SERVICE_NAME;
  if (pathRule.backend?.service?.name !== expectedBackendServiceName) throw new Error("package_d_external_access_ingress_backend_mismatch");
  if (pathRule.backend?.service?.port?.number !== FIXED_PORTAL_SERVICE_PORT) {
    throw new Error("package_d_external_access_ingress_backend_port_mismatch");
  }
  if (!edgeService) return;
  assertPortalEdgeNodePortManifestBoundary({ edgeService, fixedPortalServicePort: FIXED_PORTAL_SERVICE_PORT });
}
