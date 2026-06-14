import { mkdirSync, writeFileSync } from "node:fs";

export const PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE = Object.freeze({
  status: "shape_gate_only",
  workloadKind: "Job",
  namespace: "medopl-platform",
  serviceAccountName: "medopl-platform-runner",
  scheduling: Object.freeze({
    class: "platform_service_pool",
    nodePoolId: "np-cbk784r8",
    tenantPoolAllowed: false,
    forbiddenNodePoolPrefix: "medopl-tenant-",
    nodeSelector: Object.freeze({
      "medopl.io/nodepool-role": "platform-service",
    }),
  }),
  podTemplate: Object.freeze({
    restartPolicy: "Never",
    configMapRefs: Object.freeze(["medopl-package-d-runner-config"]),
    secretRefs: Object.freeze(["medopl-package-d-deploy-env", "medopl-portal-runtime-env"]),
    imagePullSecrets: Object.freeze(["medopl-tcr-pull-secret"]),
    plainSecretValuesAllowed: false,
    rawKubeconfigAllowed: false,
  }),
  rbac: Object.freeze({
    serviceAccount: "medopl-platform-runner",
    preferredScope: "namespace",
    clusterAdminAllowed: false,
    broadWildcardAllowed: false,
    clusterScopeRequired: true,
    clusterScopeReasons: Object.freeze([
      "read nodes to verify scheduling target and platform pool visibility",
    ]),
    namespaceRules: Object.freeze([
      Object.freeze({
        apiGroups: Object.freeze([""]),
        resources: Object.freeze(["configmaps", "services"]),
        verbs: Object.freeze(["get", "list", "watch", "create", "update", "patch"]),
      }),
      Object.freeze({
        apiGroups: Object.freeze([""]),
        resources: Object.freeze(["secrets"]),
        verbs: Object.freeze(["get"]),
      }),
      Object.freeze({
        apiGroups: Object.freeze([""]),
        resources: Object.freeze(["pods"]),
        verbs: Object.freeze(["get", "list", "watch"]),
      }),
      Object.freeze({
        apiGroups: Object.freeze(["apps"]),
        resources: Object.freeze(["deployments"]),
        verbs: Object.freeze(["get", "list", "watch", "create", "update", "patch"]),
      }),
      Object.freeze({
        apiGroups: Object.freeze(["batch"]),
        resources: Object.freeze(["jobs"]),
        verbs: Object.freeze(["get", "list", "watch", "create", "update", "patch"]),
      }),
    ]),
    clusterRules: Object.freeze([
      Object.freeze({
        apiGroups: Object.freeze([""]),
        resources: Object.freeze(["nodes"]),
        verbs: Object.freeze(["get", "list"]),
      }),
    ]),
  }),
  commandAllowlist: Object.freeze({
    allowed: Object.freeze(["preflight", "deploy", "smoke", "rollback"]),
    forbidden: Object.freeze(["arbitrary shell", "package-c live", "Tencent mutation", "tenant pool mutation"]),
  }),
  runtimeEnv: Object.freeze({
    portalPostgresUrlSource: "secretRef",
    tcrSecretSource: "imagePullSecret_or_secretRef",
    portalAdminSecretSource: "secretRef",
    plaintextSecretsAllowed: false,
  }),
  evidence: Object.freeze({
    sink: ".runtime",
    commitRuntimeEvidence: false,
    redactionAuditRequired: true,
  }),
  executionBoundary: Object.freeze({
    callsKubectlNow: false,
    connectsClusterNow: false,
    deploysNow: false,
    buildsOrPushesNow: false,
    executesTencentMutationNow: false,
    readsKubeconfigNow: false,
    packageCLiveAllowed: false,
  }),
  realExecutionReady: false,
});

export function packageDRunnerShapeReport(shape = PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE) {
  return {
    ok: true,
    contract: "package_d_in_cluster_platform_runner_shape_gate",
    shape,
    redactionAudit: {
      tcrSecretExposed: false,
      portalAdminPasswordExposed: false,
      portalPostgresPasswordExposed: false,
      fullDbUrlExposed: false,
      kubeconfigExposed: false,
      rawProviderSecretExposed: false,
    },
    forbiddenNow: [
      "kubectl",
      "deploy",
      "build/push",
      "Tencent mutation",
      "Package C live",
      "kubeconfig read",
    ],
  };
}

export function writePackageDRunnerShapeReport({ reportRoot, shape } = {}) {
  const report = packageDRunnerShapeReport(shape);
  mkdirSync(reportRoot, { recursive: true });
  writeFileSync(new URL("shape-report-redacted.json", reportRoot), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
