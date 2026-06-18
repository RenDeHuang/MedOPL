import { FIXED_NAMESPACE } from "./package-d-kubernetes-api-preflight-runner.js";
import { externalHttpsSmokeCurlArgs, FIXED_PORTAL_EDGE_SERVICE_NAME } from "./package-d-external-access-edge-nodeport-contract.js";
import {
  FIXED_EXTERNAL_SMOKE_URL,
  FIXED_INGRESS_CLASS,
  FIXED_PORTAL_HOST,
  FIXED_PORTAL_SERVICE_NAME,
  FIXED_PORTAL_SERVICE_PORT,
  portalIngressManifest,
} from "./package-d-external-access-ingress-contract.js";

export const QCLOUD_HEALTHCHECK_DRY_RUN_MODE = "qcloud-healthcheck-dry-run";
export const QCLOUD_HEALTHCHECK_APPLY_MODE = "qcloud-healthcheck-apply";
export const PACKAGE_D_EXTERNAL_ACCESS_HEALTHCHECK_DRY_RUN_COMMAND = "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-healthcheck-dry-run --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1";
export const PACKAGE_D_EXTERNAL_ACCESS_HEALTHCHECK_APPLY_COMMAND = "RUN_TENCENT_DEPLOY_EXECUTION=external-access node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-healthcheck-apply --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id gap08h-qcloud-healthcheck-apply-001 --authorized 1";

export const QCLOUD_TKE_SERVICE_CONFIG_API_VERSION = "cloud.tencent.com/v1alpha1";
export const QCLOUD_TKE_SERVICE_CONFIG_KIND = "TkeServiceConfig";
export const QCLOUD_TKE_SERVICE_CONFIG_CRD_NAME = "tkeserviceconfigs.cloud.tencent.com";
export const QCLOUD_TKE_SERVICE_CONFIG_NAME = "portal-frontend-edge-healthcheck";
export const QCLOUD_TKE_SERVICE_CONFIG_INGRESS_ANNOTATION = "ingress.cloud.tencent.com/tke-service-config";

export function qcloudHealthcheckTkeServiceConfigManifest() {
  return {
    apiVersion: QCLOUD_TKE_SERVICE_CONFIG_API_VERSION,
    kind: QCLOUD_TKE_SERVICE_CONFIG_KIND,
    metadata: {
      name: QCLOUD_TKE_SERVICE_CONFIG_NAME,
      namespace: FIXED_NAMESPACE,
      labels: {
        "app.kubernetes.io/name": QCLOUD_TKE_SERVICE_CONFIG_NAME,
        "app.kubernetes.io/part-of": "medopl-package-d",
        "medopl.io/edge-for": FIXED_PORTAL_EDGE_SERVICE_NAME,
      },
    },
    spec: {
      loadBalancer: {
        l7Listeners: [{
          protocol: "HTTPS",
          port: 443,
          domains: [{
            domain: FIXED_PORTAL_HOST,
            rules: [{
              url: "/",
              forwardType: "HTTP",
              healthCheck: {
                enable: true,
                intervalTime: 10,
                timeout: 5,
                healthNum: 2,
                unHealthNum: 2,
                httpCheckPath: "/",
                httpCheckDomain: FIXED_PORTAL_HOST,
                httpCheckMethod: "GET",
                httpCode: 6,
                sourceIpType: 1,
                checkType: "HTTP",
              },
              scheduler: "WRR",
            }],
          }],
        }],
      },
    },
  };
}

export function qcloudHealthcheckIngressManifest() {
  const ingress = portalIngressManifest({ backendServiceName: FIXED_PORTAL_EDGE_SERVICE_NAME });
  ingress.metadata.annotations[QCLOUD_TKE_SERVICE_CONFIG_INGRESS_ANNOTATION] = QCLOUD_TKE_SERVICE_CONFIG_NAME;
  return ingress;
}

export function assertQcloudHealthcheckManifestBoundary({ tkeServiceConfig, ingress } = {}) {
  if (tkeServiceConfig?.apiVersion !== QCLOUD_TKE_SERVICE_CONFIG_API_VERSION || tkeServiceConfig?.kind !== QCLOUD_TKE_SERVICE_CONFIG_KIND) {
    throw new Error("package_d_external_access_healthcheck_kind_mismatch");
  }
  if (tkeServiceConfig.metadata?.name !== QCLOUD_TKE_SERVICE_CONFIG_NAME) throw new Error("package_d_external_access_healthcheck_name_mismatch");
  if (tkeServiceConfig.metadata?.namespace !== FIXED_NAMESPACE) throw new Error("package_d_external_access_healthcheck_namespace_mismatch");
  const listener = tkeServiceConfig.spec?.loadBalancer?.l7Listeners?.[0] || {};
  const domain = listener.domains?.[0] || {};
  const rule = domain.rules?.[0] || {};
  const healthCheck = rule.healthCheck || {};
  if (listener.protocol !== "HTTPS" || listener.port !== 443) throw new Error("package_d_external_access_healthcheck_listener_mismatch");
  if (domain.domain !== FIXED_PORTAL_HOST) throw new Error("package_d_external_access_healthcheck_domain_mismatch");
  if (rule.url !== "/" || rule.forwardType !== "HTTP") throw new Error("package_d_external_access_healthcheck_rule_mismatch");
  if (healthCheck.enable !== true) throw new Error("package_d_external_access_healthcheck_must_be_enabled");
  if (healthCheck.httpCheckPath !== "/" || healthCheck.httpCheckDomain !== FIXED_PORTAL_HOST) {
    throw new Error("package_d_external_access_healthcheck_probe_target_mismatch");
  }
  if (!["GET", "HEAD"].includes(healthCheck.httpCheckMethod)) throw new Error("package_d_external_access_healthcheck_method_mismatch");
  if (healthCheck.httpCode !== 6) throw new Error("package_d_external_access_healthcheck_http_code_mismatch");
  if (healthCheck.checkType !== "HTTP") throw new Error("package_d_external_access_healthcheck_check_type_mismatch");
  if (healthCheck.timeout >= healthCheck.intervalTime) throw new Error("package_d_external_access_healthcheck_timeout_mismatch");
  if (ingress?.metadata?.annotations?.[QCLOUD_TKE_SERVICE_CONFIG_INGRESS_ANNOTATION] !== QCLOUD_TKE_SERVICE_CONFIG_NAME) {
    throw new Error("package_d_external_access_healthcheck_ingress_annotation_mismatch");
  }
  const pathRule = ingress?.spec?.rules?.[0]?.http?.paths?.[0] || {};
  if (ingress?.metadata?.name !== FIXED_PORTAL_SERVICE_NAME || ingress?.metadata?.namespace !== FIXED_NAMESPACE) {
    throw new Error("package_d_external_access_healthcheck_ingress_identity_mismatch");
  }
  if (ingress?.spec?.ingressClassName !== FIXED_INGRESS_CLASS || ingress?.spec?.rules?.[0]?.host !== FIXED_PORTAL_HOST) {
    throw new Error("package_d_external_access_healthcheck_ingress_target_mismatch");
  }
  if (pathRule.backend?.service?.name !== FIXED_PORTAL_EDGE_SERVICE_NAME || pathRule.backend?.service?.port?.number !== FIXED_PORTAL_SERVICE_PORT) {
    throw new Error("package_d_external_access_healthcheck_ingress_backend_mismatch");
  }
  const serialized = JSON.stringify({ tkeServiceConfig, ingress });
  for (const forbidden of ["medopl-tenant-", "LoadBalancer", "kubernetes.io/tls", "tls.crt", "tls.key", "qcloud_cert_id", "SecretId", "SecretKey"]) {
    if (serialized.includes(forbidden)) throw new Error(`package_d_external_access_healthcheck_forbidden_manifest_content:${forbidden}`);
  }
}

export function qcloudHealthcheckStrategy() {
  return {
    kind: QCLOUD_TKE_SERVICE_CONFIG_KIND,
    apiVersion: QCLOUD_TKE_SERVICE_CONFIG_API_VERSION,
    crdName: QCLOUD_TKE_SERVICE_CONFIG_CRD_NAME,
    crdRequired: true,
    failClosedWhenCrdMissing: true,
    bindingAnnotationKey: QCLOUD_TKE_SERVICE_CONFIG_INGRESS_ANNOTATION,
    configName: QCLOUD_TKE_SERVICE_CONFIG_NAME,
    backend: `${FIXED_PORTAL_EDGE_SERVICE_NAME}:${FIXED_PORTAL_SERVICE_PORT}`,
    healthCheck: {
      path: "/",
      domain: FIXED_PORTAL_HOST,
      method: "GET",
      acceptedCodes: ["2xx", "3xx"],
      checkType: "HTTP",
    },
  };
}

export function qcloudHealthcheckCommandPlan({
  commandRecord,
  readonly = [],
  applyMode = false,
  fixedNamespace = FIXED_NAMESPACE,
  fixedPortalHost = FIXED_PORTAL_HOST,
  fixedPortalServiceName = FIXED_PORTAL_SERVICE_NAME,
  fixedExternalSmokeUrl = FIXED_EXTERNAL_SMOKE_URL,
} = {}) {
  const healthcheckReads = [
    commandRecord({ name: "tke_service_config_crd_read", kind: "readonly", args: ["kubectl", "get", "crd", QCLOUD_TKE_SERVICE_CONFIG_CRD_NAME, "-o", "json"] }),
    commandRecord({ name: "portal_edge_service_read", kind: "readonly", args: ["kubectl", "get", "service", FIXED_PORTAL_EDGE_SERVICE_NAME, "-n", fixedNamespace, "-o", "json"] }),
    commandRecord({ name: "describe_portal_edge_service", kind: "readonly", args: ["kubectl", "describe", "service", FIXED_PORTAL_EDGE_SERVICE_NAME, "-n", fixedNamespace] }),
  ];
  const dryRuns = [
    commandRecord({
      name: "dry_run_tke_service_config",
      kind: "server_side_dry_run",
      args: ["kubectl", "apply", "--server-side", "--dry-run=server", "-f", "-", "-o", "yaml"],
      stdinManifest: "tkeServiceConfig",
    }),
    commandRecord({
      name: "dry_run_portal_ingress_healthcheck_binding",
      kind: "server_side_dry_run",
      args: ["kubectl", "apply", "--server-side", "--dry-run=server", "-f", "-", "-o", "yaml"],
      stdinManifest: "ingress",
    }),
  ];
  if (!applyMode) return [...readonly, ...healthcheckReads, ...dryRuns];
  return [
    ...readonly,
    ...healthcheckReads,
    ...dryRuns,
    commandRecord({ name: "apply_tke_service_config", kind: "apply_tke_service_config", args: ["kubectl", "apply", "--server-side", "-f", "-"], stdinManifest: "tkeServiceConfig" }),
    commandRecord({ name: "verify_tke_service_config", kind: "readonly", args: ["kubectl", "get", QCLOUD_TKE_SERVICE_CONFIG_CRD_NAME, QCLOUD_TKE_SERVICE_CONFIG_NAME, "-n", fixedNamespace, "-o", "json"] }),
    commandRecord({ name: "describe_tke_service_config", kind: "readonly", args: ["kubectl", "describe", QCLOUD_TKE_SERVICE_CONFIG_CRD_NAME, QCLOUD_TKE_SERVICE_CONFIG_NAME, "-n", fixedNamespace] }),
    commandRecord({ name: "apply_portal_ingress_healthcheck_binding", kind: "apply_ingress", args: ["kubectl", "apply", "--server-side", "-f", "-"], stdinManifest: "ingress" }),
    commandRecord({ name: "verify_portal_ingress", kind: "readonly", args: ["kubectl", "get", "ingress", fixedPortalServiceName, "-n", fixedNamespace, "-o", "json"] }),
    commandRecord({ name: "describe_portal_ingress", kind: "readonly", args: ["kubectl", "describe", "ingress", fixedPortalServiceName, "-n", fixedNamespace] }),
    commandRecord({ name: "dns_post_apply_validation", kind: "dns_readonly", args: ["getent", "hosts", fixedPortalHost] }),
    commandRecord({ name: "curl_fail_with_body_capability_probe", kind: "curl_capability", args: ["curl", "--help", "all"] }),
    commandRecord({ name: "https_external_smoke", kind: "https_smoke", args: externalHttpsSmokeCurlArgs({ fixedExternalSmokeUrl }) }),
  ];
}
