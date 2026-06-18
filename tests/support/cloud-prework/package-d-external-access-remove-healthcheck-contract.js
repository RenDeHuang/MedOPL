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
import { QCLOUD_TKE_SERVICE_CONFIG_INGRESS_ANNOTATION } from "./package-d-external-access-healthcheck-contract.js";

export const QCLOUD_REMOVE_HEALTHCHECK_DRY_RUN_MODE = "qcloud-remove-healthcheck-annotation-dry-run";
export const QCLOUD_REMOVE_HEALTHCHECK_APPLY_MODE = "qcloud-remove-healthcheck-annotation-apply";
export const PACKAGE_D_EXTERNAL_ACCESS_REMOVE_HEALTHCHECK_DRY_RUN_COMMAND = "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-remove-healthcheck-annotation-dry-run --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1";
export const PACKAGE_D_EXTERNAL_ACCESS_REMOVE_HEALTHCHECK_APPLY_COMMAND = "RUN_TENCENT_DEPLOY_EXECUTION=external-access node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-remove-healthcheck-annotation-apply --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id gap08l-remove-healthcheck-annotation-apply-001 --authorized 1";

export function qcloudRemoveHealthcheckIngressManifest() {
  const ingress = portalIngressManifest({ backendServiceName: FIXED_PORTAL_EDGE_SERVICE_NAME });
  delete ingress.metadata.annotations[QCLOUD_TKE_SERVICE_CONFIG_INGRESS_ANNOTATION];
  return ingress;
}

export function assertQcloudRemoveHealthcheckManifestBoundary({ ingress } = {}) {
  if (ingress?.apiVersion !== "networking.k8s.io/v1" || ingress?.kind !== "Ingress") {
    throw new Error("package_d_external_access_remove_healthcheck_ingress_kind_mismatch");
  }
  if (ingress.metadata?.name !== FIXED_PORTAL_SERVICE_NAME || ingress.metadata?.namespace !== FIXED_NAMESPACE) {
    throw new Error("package_d_external_access_remove_healthcheck_ingress_identity_mismatch");
  }
  if (ingress.metadata?.annotations?.[QCLOUD_TKE_SERVICE_CONFIG_INGRESS_ANNOTATION]) {
    throw new Error("package_d_external_access_remove_healthcheck_annotation_still_present");
  }
  if (ingress.metadata?.annotations?.["kubernetes.io/ingress.class"] !== FIXED_INGRESS_CLASS) {
    throw new Error("package_d_external_access_remove_healthcheck_ingress_annotation_mismatch");
  }
  if (ingress.spec?.ingressClassName !== FIXED_INGRESS_CLASS || ingress.spec?.rules?.[0]?.host !== FIXED_PORTAL_HOST) {
    throw new Error("package_d_external_access_remove_healthcheck_ingress_target_mismatch");
  }
  if (ingress.spec?.tls?.[0]?.secretName !== "medopl-portal-tls" || ingress.spec.tls[0].hosts?.[0] !== FIXED_PORTAL_HOST) {
    throw new Error("package_d_external_access_remove_healthcheck_tls_mismatch");
  }
  const pathRule = ingress.spec?.rules?.[0]?.http?.paths?.[0] || {};
  if (pathRule.path !== "/" || pathRule.pathType !== "Prefix") throw new Error("package_d_external_access_remove_healthcheck_path_mismatch");
  if (pathRule.backend?.service?.name !== FIXED_PORTAL_EDGE_SERVICE_NAME || pathRule.backend?.service?.port?.number !== FIXED_PORTAL_SERVICE_PORT) {
    throw new Error("package_d_external_access_remove_healthcheck_backend_mismatch");
  }
  const serialized = JSON.stringify({ ingress });
  for (const forbidden of ["medopl-tenant-", "LoadBalancer", "kubernetes.io/tls", "tls.crt", "tls.key", "qcloud_cert_id", "SecretId", "SecretKey"]) {
    if (serialized.includes(forbidden)) throw new Error(`package_d_external_access_remove_healthcheck_forbidden_manifest_content:${forbidden}`);
  }
}

export function qcloudRemoveHealthcheckStrategy() {
  return {
    action: "remove_ingress_annotation_only",
    removedAnnotationKey: QCLOUD_TKE_SERVICE_CONFIG_INGRESS_ANNOTATION,
    preservedResources: [
      "Secret/medopl-portal-tls",
      "Service/portal-frontend-edge",
      "Ingress/portal-frontend",
      "TkeServiceConfig/portal-frontend-edge-healthcheck",
    ],
    backend: `${FIXED_PORTAL_EDGE_SERVICE_NAME}:${FIXED_PORTAL_SERVICE_PORT}`,
    host: FIXED_PORTAL_HOST,
    externalSmokeUrl: FIXED_EXTERNAL_SMOKE_URL,
    tkeServiceConfigDeletionAllowed: false,
    dnsMutationAllowed: false,
  };
}

export function qcloudRemoveHealthcheckCommandPlan({
  commandRecord,
  readonly = [],
  applyMode = false,
  fixedNamespace = FIXED_NAMESPACE,
  fixedPortalHost = FIXED_PORTAL_HOST,
  fixedPortalServiceName = FIXED_PORTAL_SERVICE_NAME,
  fixedExternalSmokeUrl = FIXED_EXTERNAL_SMOKE_URL,
} = {}) {
  const edgeReads = [
    commandRecord({ name: "portal_edge_service_read", kind: "readonly", args: ["kubectl", "get", "service", FIXED_PORTAL_EDGE_SERVICE_NAME, "-n", fixedNamespace, "-o", "json"] }),
    commandRecord({ name: "describe_portal_edge_service", kind: "readonly", args: ["kubectl", "describe", "service", FIXED_PORTAL_EDGE_SERVICE_NAME, "-n", fixedNamespace] }),
    commandRecord({ name: "portal_ingress_read", kind: "readonly", args: ["kubectl", "get", "ingress", fixedPortalServiceName, "-n", fixedNamespace, "-o", "json"] }),
    commandRecord({ name: "describe_portal_ingress", kind: "readonly", args: ["kubectl", "describe", "ingress", fixedPortalServiceName, "-n", fixedNamespace] }),
  ];
  const dryRuns = [commandRecord({
    name: "dry_run_portal_ingress_remove_healthcheck_annotation",
    kind: "server_side_dry_run",
    args: ["kubectl", "apply", "--server-side", "--dry-run=server", "-f", "-", "-o", "yaml"],
    stdinManifest: "ingress",
  })];
  if (!applyMode) return [...readonly, ...edgeReads, ...dryRuns];
  return [
    ...readonly,
    ...edgeReads,
    ...dryRuns,
    commandRecord({ name: "apply_portal_ingress_remove_healthcheck_annotation", kind: "apply_ingress", args: ["kubectl", "apply", "--server-side", "-f", "-"], stdinManifest: "ingress" }),
    commandRecord({ name: "verify_portal_ingress", kind: "readonly", args: ["kubectl", "get", "ingress", fixedPortalServiceName, "-n", fixedNamespace, "-o", "json"] }),
    commandRecord({ name: "describe_portal_ingress", kind: "readonly", args: ["kubectl", "describe", "ingress", fixedPortalServiceName, "-n", fixedNamespace] }),
    commandRecord({ name: "dns_post_apply_validation", kind: "dns_readonly", args: ["getent", "hosts", fixedPortalHost] }),
    commandRecord({ name: "curl_fail_with_body_capability_probe", kind: "curl_capability", args: ["curl", "--help", "all"] }),
    commandRecord({ name: "https_external_smoke", kind: "https_smoke", args: externalHttpsSmokeCurlArgs({ fixedExternalSmokeUrl }) }),
  ];
}
