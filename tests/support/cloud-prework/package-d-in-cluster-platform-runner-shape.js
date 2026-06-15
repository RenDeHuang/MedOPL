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
      "node.tke.cloud.tencent.com/machineset": "np-cbk784r8",
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

function refList(names = [], key) {
  return names.map((name) => ({ [key]: { name } }));
}

function imagePullSecretRefs(names = []) {
  return names.map((name) => ({ name }));
}

const PACKAGE_D_DEPLOY_SECRET_KEYS = Object.freeze([
  "RUN_TENCENT_DEPLOY_EXECUTION",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_TCR_REGISTRY",
  "TENCENT_TCR_NAMESPACE",
  "TENCENT_TCR_REGION",
  "TENCENT_DEPLOY_CLUSTER_ID",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
]);

const PORTAL_RUNTIME_SECRET_KEYS = Object.freeze([
  "PORTAL_ADMIN_EMAIL",
  "PORTAL_ADMIN_NAME",
  "PORTAL_ADMIN_PASSWORD",
  "PORTAL_POSTGRES_URL",
  "PORTAL_POSTGRES_PASSWORD",
]);
const RUN_SCOPED_JOB_NAME_PATTERN = "medopl-platform-runner-preflight-<runid>";

function redactedStringData(keys = []) {
  return Object.fromEntries(keys.map((key) => [key, "REDACTED_REQUIRED_AT_APPLY_TIME"]));
}

export function materializePackageDInClusterRunnerPack(shape = PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE) {
  const containerName = "medopl-package-d-runner";
  const namespace = shape.namespace;
  const serviceAccount = shape.serviceAccountName;
  const configMapName = shape.podTemplate.configMapRefs[0];
  const [deploySecretName, runtimeSecretName] = shape.podTemplate.secretRefs;
  const imagePullSecretName = shape.podTemplate.imagePullSecrets[0];

  return {
    ok: true,
    contract: "package_d_in_cluster_platform_runner_manifest_materialization",
    manifests: {
      namespace: {
        apiVersion: "v1",
        kind: "Namespace",
        metadata: { name: namespace },
      },
      serviceAccount: {
        apiVersion: "v1",
        kind: "ServiceAccount",
        metadata: { name: serviceAccount, namespace },
      },
      configMap: {
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: { name: configMapName, namespace },
        data: {
          PACKAGE_D_RUNNER_COMMAND_ALLOWLIST: shape.commandAllowlist.allowed.join(","),
          PACKAGE_D_RUNNER_COMMAND: "preflight",
          RUN_TENCENT_DEPLOY_EXECUTION: "0",
          TARGET_CLUSTER_ID: "cls-fi097sy4",
          TARGET_PLATFORM_NODE_POOL_ID: shape.scheduling.nodePoolId,
          TARGET_NAMESPACE: namespace,
          POSTGRES_ENDPOINT: "10.66.0.21:5432",
          EVIDENCE_SINK: ".runtime",
        },
      },
      secretTemplates: {
        deployEnvSecret: {
          apiVersion: "v1",
          kind: "Secret",
          metadata: { name: deploySecretName, namespace },
          type: "Opaque",
          stringData: redactedStringData(PACKAGE_D_DEPLOY_SECRET_KEYS),
        },
        portalRuntimeSecret: {
          apiVersion: "v1",
          kind: "Secret",
          metadata: { name: runtimeSecretName, namespace },
          type: "Opaque",
          stringData: redactedStringData(PORTAL_RUNTIME_SECRET_KEYS),
        },
        imagePullSecret: {
          apiVersion: "v1",
          kind: "Secret",
          metadata: { name: imagePullSecretName, namespace },
          type: "kubernetes.io/dockerconfigjson",
          stringData: {
            ".dockerconfigjson": "REDACTED_IMAGE_PULL_SECRET_REQUIRED_AT_APPLY_TIME",
          },
        },
      },
      role: {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "Role",
        metadata: { name: "medopl-platform-runner", namespace },
        rules: shape.rbac.namespaceRules,
      },
      roleBinding: {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "RoleBinding",
        metadata: { name: "medopl-platform-runner", namespace },
        subjects: [{ kind: "ServiceAccount", name: serviceAccount, namespace }],
        roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: "Role", name: "medopl-platform-runner" },
      },
      clusterRole: {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "ClusterRole",
        metadata: { name: "medopl-platform-runner-node-reader" },
        rules: shape.rbac.clusterRules,
      },
      clusterRoleBinding: {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "ClusterRoleBinding",
        metadata: { name: "medopl-platform-runner-node-reader" },
        subjects: [{ kind: "ServiceAccount", name: serviceAccount, namespace }],
        roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: "ClusterRole", name: "medopl-platform-runner-node-reader" },
      },
    },
    jobLifecycle: {
      kind: "run_scoped_job_lifecycle",
      namePattern: RUN_SCOPED_JOB_NAME_PATTERN,
      authorizationRequired: true,
      includedInBootstrapApply: false,
      includedInServerSideDryRun: false,
      sameNameTemplateUpdateAllowed: false,
      allowedActions: [
        "create unique Job",
        "observe Job",
        "collect redacted evidence",
        "cleanup only that unique Job",
      ],
      forbiddenActions: [
        "update existing Job spec.template",
        "delete Package D bootstrap resources as part of Job cleanup",
        "business Deployment rollout",
        "tenant pool mutation",
        "platform pool modification",
      ],
      template: {
        apiVersion: "batch/v1",
        kind: "Job",
        metadata: { name: RUN_SCOPED_JOB_NAME_PATTERN, namespace },
        spec: {
          template: {
            spec: {
              serviceAccountName: serviceAccount,
              restartPolicy: shape.podTemplate.restartPolicy,
              nodeSelector: shape.scheduling.nodeSelector,
              imagePullSecrets: imagePullSecretRefs(shape.podTemplate.imagePullSecrets),
              containers: [{
                name: containerName,
                image: "REDACTED_PACKAGE_D_RUNNER_IMAGE_REF",
                imagePullPolicy: "IfNotPresent",
                args: ["$(PACKAGE_D_RUNNER_COMMAND)"],
                envFrom: [
                  ...refList(shape.podTemplate.configMapRefs, "configMapRef"),
                  ...refList(shape.podTemplate.secretRefs, "secretRef"),
                ],
              }],
            },
          },
        },
      },
    },
    rbac: shape.rbac,
    authorizationPack: {
      requiredAuthorizations: [
        "read kubeconfig content",
        "connect Kubernetes API",
        "kubectl server-side dry-run",
        "kubectl apply Package D runner manifests",
        "run Package D preflight from platform runner",
      ],
      forbiddenUntilAuthorized: [
        "kubectl apply/delete/patch/scale",
        "deploy workload",
        "build/push image",
        "Tencent mutation",
        "Package C live",
        "tenant pool mutation",
      ],
    },
    bootstrapAuthorizationPack: {
      status: "authorization_pack_only",
      recommendedExecutionEnvironments: [
        "Tencent CloudShell with target TKE API reachability",
        "Tencent Cloud Assistant session on a VPC-reachable host",
        "VPC internal runner with TKE API reachability",
      ],
      discouragedExecutionEnvironments: [
        "local WSL without TKE API reachability",
      ],
      target: {
        clusterId: "cls-fi097sy4",
        namespace,
        platformNodePoolId: shape.scheduling.nodePoolId,
        schedulingClass: shape.scheduling.class,
      },
      resourceTypesToCreateOrValidate: [
        "Namespace",
        "ServiceAccount",
        "RBAC",
        "ConfigMap",
        "SecretRef",
        "imagePullSecret",
      ],
      jobLifecycleBoundary: {
        status: "separate_authorization_required",
        namePattern: RUN_SCOPED_JOB_NAME_PATTERN,
        reason: "Kubernetes Job spec.template is immutable; bootstrap apply must not reapply a same-name Job template.",
        allowedOnlyAfterBootstrapDryRunPasses: true,
      },
      forbiddenScope: [
        "medopl-tenant- tenant pool",
        "Package C live",
        "build/push",
        "formal deploy",
        "Tencent mutation",
      ],
      rollbackPlan: [
        "If server-side dry-run fails, do not create resources and keep evidence only.",
        "If bootstrap apply is separately authorized later and fails, remove only Package D idempotent bootstrap resources in medopl-platform.",
        "If a run-scoped Job is created in a later authorization and fails, collect redacted logs/events, delete only that unique Job, and leave existing bootstrap resources and platform pool untouched.",
        "Never delete, scale or modify platform node pool np-cbk784r8 or any medopl-tenant- pool.",
      ],
      stopConditions: [
        "kubeconfig context or cluster does not match cls-fi097sy4",
        "namespace target is not medopl-platform",
        "scheduling target is not platform pool np-cbk784r8",
        "manifest references medopl-tenant-",
        "manifest embeds plaintext secret or raw kubeconfig",
        "RBAC requests cluster-admin or broad wildcard",
        "server-side dry-run is rejected",
        "requested operation includes deploy, build/push, Tencent mutation or Package C live",
      ],
      redactedEvidencePath: ".runtime/package-d-in-cluster-platform-runner-bootstrap-authorization/authorization-pack-redacted.json",
      nextAuthorizationPrompt: [
        "Authorize execution from a Tencent CloudShell, Cloud Assistant session, or VPC internal runner that can reach the TKE API for cls-fi097sy4.",
        "Allow reading the Package D kubeconfig and env files only in that environment.",
        "Allow kubectl server-side dry-run for the Package D bootstrap manifests.",
        "Do not authorize real deploy, build/push, Tencent mutation, Package C live, tenant pool mutation or platform pool modification.",
        "If dry-run passes, request a separate authorization before applying bootstrap resources.",
        "Request another separate authorization before creating a run-scoped in-cluster runner Job.",
      ],
    },
    executionBoundary: shape.executionBoundary,
    realExecutionReady: false,
  };
}

export function writePackageDRunnerManifestPack({ reportRoot, pack } = {}) {
  mkdirSync(reportRoot, { recursive: true });
  const report = {
    ok: true,
    contract: "package_d_in_cluster_platform_runner_manifest_materialization",
    manifests: pack.manifests,
    jobLifecycle: pack.jobLifecycle,
    authorizationPack: pack.authorizationPack,
    bootstrapAuthorizationPack: pack.bootstrapAuthorizationPack,
    executionBoundary: pack.executionBoundary,
    redactionAudit: {
      tcrSecretExposed: false,
      portalAdminPasswordExposed: false,
      portalPostgresPasswordExposed: false,
      fullDbUrlExposed: false,
      kubeconfigExposed: false,
      rawProviderSecretExposed: false,
    },
  };
  const target = new URL("manifest-pack-redacted.json", reportRoot);
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  return { path: target.pathname, report };
}

export function writePackageDRunnerBootstrapAuthorizationPack({ reportRoot, pack } = {}) {
  mkdirSync(reportRoot, { recursive: true });
  const report = {
    ok: true,
    contract: "package_d_in_cluster_platform_runner_bootstrap_authorization_pack",
    bootstrapAuthorizationPack: pack.bootstrapAuthorizationPack,
    jobLifecycle: pack.jobLifecycle,
    executionBoundary: pack.executionBoundary,
    redactionAudit: {
      tcrSecretExposed: false,
      portalAdminPasswordExposed: false,
      portalPostgresPasswordExposed: false,
      fullDbUrlExposed: false,
      kubeconfigExposed: false,
      rawProviderSecretExposed: false,
    },
  };
  const target = new URL("authorization-pack-redacted.json", reportRoot);
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  return { path: target.pathname, report };
}
