import { FIXED_NAMESPACE } from "./package-d-kubernetes-api-preflight-runner.js";

export const QCLOUD_EDGE_NODEPORT_DRY_RUN_MODE = "qcloud-edge-nodeport-dry-run";
export const QCLOUD_EDGE_NODEPORT_APPLY_MODE = "qcloud-edge-nodeport-apply";
export const PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_DRY_RUN_COMMAND = "node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-edge-nodeport-dry-run --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --authorized 1";
export const PACKAGE_D_EXTERNAL_ACCESS_EDGE_NODEPORT_APPLY_COMMAND = "RUN_TENCENT_DEPLOY_EXECUTION=external-access node tests/support/cloud-prework/package-d-external-access-runner.js --mode qcloud-edge-nodeport-apply --env /home/dev/.secrets/medopl/v22/package-d-external-access.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id gap08e-qcloud-edge-nodeport-apply-001 --authorized 1";
export const CURL_FAIL_WITH_BODY_CAPABILITY_PROBE_ARGS = Object.freeze(["curl", "--help", "all"]);

export const FIXED_PORTAL_EDGE_SERVICE_NAME = "portal-frontend-edge";
export const FIXED_PORTAL_SERVICE_SELECTOR = Object.freeze({
  "app.kubernetes.io/name": "portal-frontend",
  "app.kubernetes.io/part-of": "medopl-package-d",
});

export function portalEdgeNodePortServiceManifest({
  serviceName = FIXED_PORTAL_EDGE_SERVICE_NAME,
  originServiceName = "portal-frontend",
  port = 8080,
} = {}) {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: serviceName,
      namespace: FIXED_NAMESPACE,
      labels: {
        "app.kubernetes.io/name": serviceName,
        "app.kubernetes.io/part-of": "medopl-package-d",
        "medopl.io/edge-for": originServiceName,
      },
    },
    spec: {
      type: "NodePort",
      selector: { ...FIXED_PORTAL_SERVICE_SELECTOR },
      ports: [{
        name: "http",
        port,
        protocol: "TCP",
        targetPort: port,
      }],
    },
  };
}

export function assertPortalEdgeNodePortManifestBoundary({
  edgeService,
  fixedNamespace = FIXED_NAMESPACE,
  fixedPortalServicePort = 8080,
} = {}) {
  if (edgeService?.apiVersion !== "v1" || edgeService?.kind !== "Service") {
    throw new Error("package_d_external_access_edge_service_kind_mismatch");
  }
  if (edgeService.metadata?.name !== FIXED_PORTAL_EDGE_SERVICE_NAME) throw new Error("package_d_external_access_edge_service_name_mismatch");
  if (edgeService.metadata?.namespace !== fixedNamespace) throw new Error("package_d_external_access_edge_service_namespace_mismatch");
  if (edgeService.spec?.type !== "NodePort") throw new Error("package_d_external_access_edge_service_type_mismatch");
  if (JSON.stringify(edgeService.spec?.selector || {}) !== JSON.stringify(FIXED_PORTAL_SERVICE_SELECTOR)) {
    throw new Error("package_d_external_access_edge_service_selector_mismatch");
  }
  const ports = edgeService.spec?.ports || [];
  if (ports.length !== 1) throw new Error("package_d_external_access_edge_service_port_count_mismatch");
  if (ports[0].name !== "http" || ports[0].port !== fixedPortalServicePort || ports[0].targetPort !== fixedPortalServicePort || ports[0].protocol !== "TCP") {
    throw new Error("package_d_external_access_edge_service_port_mismatch");
  }
  if (Object.hasOwn(ports[0], "nodePort")) throw new Error("package_d_external_access_edge_service_nodeport_literal_forbidden");
}

export function httpsSmokeWriteOut({
  service = "portal-frontend",
  fixedExternalSmokeUrl = "https://portal.medopl.cn/",
} = {}) {
  return `${JSON.stringify({
    service,
    url: fixedExternalSmokeUrl,
    http_code: "%{http_code}",
    ssl_verify_result: "%{ssl_verify_result}",
    time_total: "%{time_total}",
  })}\n`;
}

export function externalHttpsSmokeCurlArgs({
  failWithBody = false,
  fixedExternalSmokeUrl = "https://portal.medopl.cn/",
} = {}) {
  return [
    "curl",
    ...(failWithBody ? ["--fail-with-body"] : ["--fail"]),
    "--connect-timeout",
    "10",
    "--max-time",
    "30",
    "-sS",
    "-o",
    "/dev/null",
    "-w",
    httpsSmokeWriteOut({ fixedExternalSmokeUrl }),
    fixedExternalSmokeUrl,
  ];
}

export function qcloudEdgeNodePortCommandPlan({
  commandRecord,
  readonly = [],
  applyMode = false,
  fixedNamespace = FIXED_NAMESPACE,
  fixedPortalHost = "portal.medopl.cn",
  fixedPortalServiceName = "portal-frontend",
  fixedExternalSmokeUrl = "https://portal.medopl.cn/",
} = {}) {
  const dryRuns = [
    commandRecord({
      name: "dry_run_portal_edge_service",
      kind: "server_side_dry_run",
      args: ["kubectl", "apply", "--server-side", "--dry-run=server", "-f", "-", "-o", "yaml"],
      stdinManifest: "edgeService",
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
      name: "apply_portal_edge_service",
      kind: "apply_service",
      args: ["kubectl", "apply", "--server-side", "-f", "-"],
      stdinManifest: "edgeService",
    }),
    commandRecord({
      name: "verify_portal_edge_service",
      kind: "readonly",
      args: ["kubectl", "get", "service", FIXED_PORTAL_EDGE_SERVICE_NAME, "-n", fixedNamespace, "-o", "json"],
    }),
    commandRecord({
      name: "describe_portal_edge_service",
      kind: "readonly",
      args: ["kubectl", "describe", "service", FIXED_PORTAL_EDGE_SERVICE_NAME, "-n", fixedNamespace],
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
      args: ["kubectl", "get", "ingress", fixedPortalServiceName, "-n", fixedNamespace, "-o", "json"],
    }),
    commandRecord({
      name: "describe_portal_ingress",
      kind: "readonly",
      args: ["kubectl", "describe", "ingress", fixedPortalServiceName, "-n", fixedNamespace],
    }),
    commandRecord({
      name: "dns_post_apply_validation",
      kind: "dns_readonly",
      args: ["getent", "hosts", fixedPortalHost],
    }),
    commandRecord({
      name: "curl_fail_with_body_capability_probe",
      kind: "curl_capability",
      args: [...CURL_FAIL_WITH_BODY_CAPABILITY_PROBE_ARGS],
    }),
    commandRecord({
      name: "https_external_smoke",
      kind: "https_smoke",
      args: externalHttpsSmokeCurlArgs({ fixedExternalSmokeUrl }),
    }),
  ];
}
