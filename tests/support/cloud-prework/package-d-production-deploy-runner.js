#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE,
} from "./package-d-in-cluster-platform-runner-shape.js";
import {
  DEPLOY_ENV_KEYS,
  FIXED_CLUSTER_ID,
  FIXED_NAMESPACE,
  FIXED_PLATFORM_NODE_POOL_ID,
  FIXED_POSTGRES_ENDPOINT,
  RUNTIME_ENV_KEYS,
  assertFile,
  kubeconfigSummary,
  parseEnv,
  redactionAudit,
} from "./package-d-kubernetes-api-preflight-runner.js";

export const PACKAGE_D_PRODUCTION_DEPLOY_COMMAND = "node tests/support/cloud-prework/package-d-production-deploy-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode production-deploy-plan --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-production-deploy";
const DEPLOY_SECRET_REF = "medopl-package-d-deploy-env";
const RUNTIME_SECRET_REF = "medopl-portal-runtime-env";
const IMAGE_PULL_SECRET = "medopl-tcr-pull-secret";
const DEPLOY_CONFIG_SUFFIX = "config";
const REQUIRED_PRODUCTION_DEPLOY_ENV_KEYS = Object.freeze([
  ...DEPLOY_ENV_KEYS,
]);
const SERVICE_TARGETS = Object.freeze([
  Object.freeze({
    name: "portal-frontend",
    imageKey: "PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF",
    repository: "portal-frontend",
    sourceRoot: "services/portal/frontend",
    port: 8080,
    smokePath: "/",
  }),
  Object.freeze({
    name: "medopl-go-backend",
    imageKey: "PACKAGE_D_GO_BACKEND_IMAGE_REF",
    repository: "medopl-go-backend",
    sourceRoot: "services/medopl-go-backend",
    port: 8080,
    smokePath: "/readyz",
  }),
  Object.freeze({
    name: "opl-web-gateway",
    imageKey: "PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF",
    repository: "opl-web-gateway",
    sourceRoot: "services/opl-web-gateway",
    port: 8080,
    smokePath: "/healthz",
  }),
  Object.freeze({
    name: "opl-runtime-bridge",
    imageKey: "PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF",
    repository: "opl-runtime-bridge",
    sourceRoot: "services/opl-runtime-bridge",
    port: 8080,
    smokePath: "/healthz",
  }),
]);
const FORBIDDEN_ARGS = Object.freeze(new Set([
  "--build",
  "--push",
  "--tencent-mutation",
  "--package-c-live",
  "--delete",
  "--patch",
  "--scale",
  "--arbitrary-shell",
  "--exec",
]));

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`package_d_production_deploy_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`package_d_production_deploy_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`package_d_production_deploy_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("package_d_production_deploy_not_authorized");
}

function postgresEndpoint(value = "") {
  try {
    const parsed = new URL(text(value));
    return `${parsed.hostname}:${parsed.port || "5432"}`;
  } catch {
    return "";
  }
}

function assertTargetEnvForDeploy({ deployEnv, runtimeEnv, kubeconfigPath }) {
  if (deployEnv.RUN_TENCENT_DEPLOY_EXECUTION !== "1") {
    throw new Error("package_d_production_deploy_run_gate_not_authorized");
  }
  if (deployEnv.TENCENT_DEPLOY_CLUSTER_ID !== FIXED_CLUSTER_ID) throw new Error("package_d_production_deploy_cluster_mismatch");
  if (path.resolve(deployEnv.TENCENT_DEPLOY_KUBECONFIG_REF) !== path.resolve(kubeconfigPath)) {
    throw new Error("package_d_production_deploy_kubeconfig_ref_mismatch");
  }
  if (deployEnv.TENCENT_TCR_REGION !== "na-siliconvalley") throw new Error("package_d_production_deploy_tcr_region_mismatch");
  if (postgresEndpoint(runtimeEnv.PORTAL_POSTGRES_URL) !== FIXED_POSTGRES_ENDPOINT) {
    throw new Error("package_d_production_deploy_postgres_endpoint_mismatch");
  }
}

function parseImageRef(imageRef = "", { deployEnv, expectedRepository }) {
  const value = text(imageRef);
  if (!value) throw new Error("package_d_production_image_ref_missing");
  if (value.startsWith("REDACTED_")) throw new Error("package_d_production_image_redacted_value_forbidden");
  if (/\s/u.test(value) || value.includes("://")) throw new Error("package_d_production_image_ref_malformed");
  const slashParts = value.split("/");
  if (slashParts.length !== 3) throw new Error("package_d_production_image_ref_malformed");
  const [registry, namespace, imageNameWithTag] = slashParts;
  const tagSeparator = imageNameWithTag.lastIndexOf(":");
  if (tagSeparator <= 0 || tagSeparator === imageNameWithTag.length - 1) {
    throw new Error("package_d_production_image_ref_malformed");
  }
  const repository = imageNameWithTag.slice(0, tagSeparator);
  const tag = imageNameWithTag.slice(tagSeparator + 1);
  if (tag === "latest") throw new Error("package_d_production_image_latest_forbidden");
  if (registry !== deployEnv.TENCENT_TCR_REGISTRY) throw new Error("package_d_production_image_registry_mismatch");
  if (namespace !== deployEnv.TENCENT_TCR_NAMESPACE) throw new Error("package_d_production_image_namespace_mismatch");
  if (repository !== expectedRepository) throw new Error(`package_d_production_image_repository_mismatch:${expectedRepository}`);
  return { value, registry, namespace, repository, tag };
}

function serviceConfigMap(service) {
  return {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      name: `${service.name}-${DEPLOY_CONFIG_SUFFIX}`,
      namespace: FIXED_NAMESPACE,
      labels: {
        "app.kubernetes.io/name": service.name,
        "app.kubernetes.io/part-of": "medopl-package-d",
      },
    },
    data: {
      MEDOPL_COMPONENT: service.name,
      TARGET_CLUSTER_ID: FIXED_CLUSTER_ID,
      TARGET_NAMESPACE: FIXED_NAMESPACE,
      TARGET_PLATFORM_NODE_POOL_ID: FIXED_PLATFORM_NODE_POOL_ID,
      POSTGRES_ENDPOINT: FIXED_POSTGRES_ENDPOINT,
      PACKAGE_D_DEPLOYMENT_MODE: "production",
    },
  };
}

function serviceDeployment({ service, imageRef }) {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: service.name,
      namespace: FIXED_NAMESPACE,
      labels: {
        "app.kubernetes.io/name": service.name,
        "app.kubernetes.io/part-of": "medopl-package-d",
      },
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          "app.kubernetes.io/name": service.name,
        },
      },
      template: {
        metadata: {
          labels: {
            "app.kubernetes.io/name": service.name,
            "app.kubernetes.io/part-of": "medopl-package-d",
          },
        },
        spec: {
          serviceAccountName: PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE.serviceAccountName,
          nodeSelector: PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE.scheduling.nodeSelector,
          imagePullSecrets: [{ name: IMAGE_PULL_SECRET }],
          containers: [{
            name: service.name,
            image: imageRef,
            imagePullPolicy: "IfNotPresent",
            ports: [{ name: "http", containerPort: service.port }],
            envFrom: [
              { configMapRef: { name: `${service.name}-${DEPLOY_CONFIG_SUFFIX}` } },
              { secretRef: { name: DEPLOY_SECRET_REF } },
              { secretRef: { name: RUNTIME_SECRET_REF } },
            ],
            readinessProbe: {
              httpGet: { path: service.smokePath, port: "http" },
              initialDelaySeconds: 5,
              periodSeconds: 10,
            },
          }],
        },
      },
    },
  };
}

function serviceService(service) {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: service.name,
      namespace: FIXED_NAMESPACE,
      labels: {
        "app.kubernetes.io/name": service.name,
        "app.kubernetes.io/part-of": "medopl-package-d",
      },
    },
    spec: {
      type: "ClusterIP",
      selector: {
        "app.kubernetes.io/name": service.name,
      },
      ports: [{ name: "http", port: service.port, targetPort: "http" }],
    },
  };
}

function materializeProductionManifests({ deployEnv, redacted = false }) {
  const services = SERVICE_TARGETS.map((service) => {
    const image = parseImageRef(deployEnv[service.imageKey], {
      deployEnv,
      expectedRepository: service.repository,
    });
    return {
      ...service,
      image,
      imageForManifest: redacted ? `REDACTED_${service.imageKey}` : image.value,
    };
  });
  const items = services.flatMap((service) => [
    serviceConfigMap(service),
    serviceDeployment({ service, imageRef: service.imageForManifest }),
    serviceService(service),
  ]);
  return {
    services,
    manifests: { apiVersion: "v1", kind: "List", items },
  };
}

function assertManifestBoundary(manifests = {}, { allowRedactedImages = false } = {}) {
  if (manifests.kind !== "List") throw new Error("package_d_production_manifest_must_be_list");
  const serialized = JSON.stringify(manifests);
  if (serialized.includes("medopl-tenant-")) throw new Error("package_d_production_manifest_references_tenant_pool");
  if (serialized.includes("postgresql://")) throw new Error("package_d_production_manifest_exposes_db_url");
  if (serialized.includes("client-key-data") || serialized.includes("client-certificate-data")) {
    throw new Error("package_d_production_manifest_embeds_kubeconfig");
  }
  for (const item of manifests.items || []) {
    if (item.metadata?.namespace !== FIXED_NAMESPACE) throw new Error(`package_d_production_manifest_namespace_mismatch:${item.kind}/${item.metadata?.name || ""}`);
    if (item.kind === "Secret") throw new Error("package_d_production_manifest_plaintext_secret_forbidden");
    if (!["ConfigMap", "Deployment", "Service"].includes(item.kind)) {
      throw new Error(`package_d_production_manifest_kind_not_allowlisted:${item.kind}`);
    }
    if (item.kind !== "Deployment") continue;
    const podSpec = item.spec?.template?.spec || {};
    if (podSpec.nodeSelector?.["node.tke.cloud.tencent.com/machineset"] !== FIXED_PLATFORM_NODE_POOL_ID) {
      throw new Error("package_d_production_manifest_scheduling_mismatch");
    }
    if (Object.hasOwn(podSpec.nodeSelector || {}, "medopl.io/nodepool-role")) {
      throw new Error("package_d_production_manifest_uses_retired_selector");
    }
    const container = podSpec.containers?.[0] || {};
    if (!allowRedactedImages && String(container.image || "").startsWith("REDACTED_")) {
      throw new Error("package_d_production_live_manifest_redacted_image_forbidden");
    }
    if (!Array.isArray(container.envFrom) || JSON.stringify(container.envFrom).includes("valueFrom")) {
      throw new Error("package_d_production_manifest_secretref_shape_mismatch");
    }
  }
}

function redactedServices(services = []) {
  return services.map((service) => ({
    name: service.name,
    repository: service.repository,
    sourceRoot: service.sourceRoot,
    namespace: FIXED_NAMESPACE,
    imageRef: "redacted",
    imageSourceKey: service.imageKey,
    imageTag: service.image.tag,
    secretRefs: [DEPLOY_SECRET_REF, RUNTIME_SECRET_REF],
    imagePullSecrets: [IMAGE_PULL_SECRET],
  }));
}

function plannedCommands({ manifestPath, services = [] }) {
  return [
    { name: "kubectl_client_available", args: ["kubectl", "version", "--client"], kind: "readonly" },
    { name: "current_context", args: ["kubectl", "config", "current-context"], kind: "readonly" },
    { name: "namespace_read", args: ["kubectl", "get", "namespace", FIXED_NAMESPACE, "-o", "json"], kind: "readonly" },
    { name: "production_server_side_dry_run", args: ["kubectl", "apply", "--server-side", "--dry-run=server", "-f", manifestPath, "-o", "yaml"], kind: "server_side_dry_run" },
    { name: "production_apply", args: ["kubectl", "apply", "--server-side", "-f", "-"], kind: "production_apply" },
    ...services.map((service) => ({
      name: `rollout_status_${service.name}`,
      args: ["kubectl", "rollout", "status", `deployment/${service.name}`, "-n", FIXED_NAMESPACE, "--timeout=300s"],
      kind: "rollout_observe",
    })),
    ...services.map((service) => ({
      name: `smoke_${service.name.replaceAll("-", "_")}`,
      args: ["kubectl", "get", "service", service.name, "-n", FIXED_NAMESPACE, "-o", "json"],
      kind: "smoke_shape",
    })),
  ];
}

function rollbackCommands(services = []) {
  return services.map((service) => ({
    name: `rollback_${service.name}`,
    args: ["kubectl", "rollout", "undo", `deployment/${service.name}`, "-n", FIXED_NAMESPACE],
    kind: "rollback",
  }));
}

function assertKubectlCommandAllowed(command = {}) {
  const joined = ` ${command.args.join(" ")} `;
  if (command.args[0] !== "kubectl") throw new Error("package_d_production_deploy_command_must_be_kubectl");
  for (const forbidden of [" delete ", " patch ", " scale ", " exec ", " cp "]) {
    if (joined.includes(forbidden)) throw new Error(`package_d_production_deploy_kubectl_forbidden:${forbidden.trim()}`);
  }
  if (command.kind === "server_side_dry_run" && !(command.args.includes("apply") && command.args.includes("--dry-run=server"))) {
    throw new Error("package_d_production_deploy_dry_run_must_be_server_side");
  }
  if (command.kind === "production_apply" && command.args.includes("--dry-run=server")) {
    throw new Error("package_d_production_deploy_apply_must_not_be_dry_run_boundary");
  }
  if (command.kind === "production_apply" && command.args[command.args.indexOf("-f") + 1] !== "-") {
    throw new Error("package_d_production_deploy_apply_must_use_stdin");
  }
  if (command.kind === "rollback" && !(command.args.includes("rollout") && command.args.includes("undo"))) {
    throw new Error("package_d_production_rollback_must_be_rollout_undo");
  }
}

function redactCommand(args = []) {
  return args.map((arg, index) => (args[index - 1] === "-f" ? "REDACTED_PRODUCTION_MANIFEST" : arg)).join(" ");
}

async function writeEvidence({ evidenceDir, filename, payload }) {
  await mkdir(evidenceDir, { recursive: true });
  const target = path.join(evidenceDir, filename);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildPackageDProductionDeployPlan({
  deployEnvPath,
  runtimeEnvPath,
  kubeconfigPath,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  argv = [],
} = {}) {
  parseArgs(argv);
  assertAuthorized(authorized);
  assertFile(deployEnvPath, "package_d_deploy_env_missing");
  assertFile(runtimeEnvPath, "package_d_runtime_env_missing");
  assertFile(kubeconfigPath, "package_d_kubeconfig_missing");

  const deployEnv = parseEnv(await readFile(deployEnvPath, "utf8"), DEPLOY_ENV_KEYS, REQUIRED_PRODUCTION_DEPLOY_ENV_KEYS);
  const runtimeEnv = parseEnv(await readFile(runtimeEnvPath, "utf8"), RUNTIME_ENV_KEYS);
  assertTargetEnvForDeploy({ deployEnv, runtimeEnv, kubeconfigPath });
  const clusterAuth = kubeconfigSummary(await readFile(kubeconfigPath, "utf8"));
  const live = materializeProductionManifests({ deployEnv, redacted: false });
  assertManifestBoundary(live.manifests);
  const redacted = materializeProductionManifests({ deployEnv, redacted: true });
  assertManifestBoundary(redacted.manifests, { allowRedactedImages: true });
  const manifestPath = path.join(evidenceDir, "production-manifests-redacted.json");
  const commands = plannedCommands({ manifestPath, services: live.services }).map((command) => {
    assertKubectlCommandAllowed(command);
    return {
      ...command,
      command: redactCommand(command.args).replace(" -f -", " -f REDACTED_STDIN_PRODUCTION_MANIFEST"),
    };
  });
  const rollback = rollbackCommands(live.services).map((command) => {
    assertKubectlCommandAllowed(command);
    return {
      ...command,
      command: redactCommand(command.args),
    };
  });

  const plan = {
    ok: true,
    contract: "package_d_production_deploy_runner_contract_local_gate",
    mode: "production-deploy-plan",
    command: PACKAGE_D_PRODUCTION_DEPLOY_COMMAND,
    target: {
      clusterId: FIXED_CLUSTER_ID,
      namespace: FIXED_NAMESPACE,
      platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
      postgresEndpoint: FIXED_POSTGRES_ENDPOINT,
      legacyProtectedPlatformNodePoolId: "np-cbk784r8",
    },
    env: {
      deployEnvPath: "authorized_package_d_deploy_env",
      runtimeEnvPath: "authorized_portal_runtime_env",
      kubeconfigPath: "authorized_kubeconfig_ref",
      tcrRegistry: deployEnv.TENCENT_TCR_REGISTRY,
      tcrNamespace: deployEnv.TENCENT_TCR_NAMESPACE,
      tcrRegion: deployEnv.TENCENT_TCR_REGION,
      serviceImageRefKeys: SERVICE_TARGETS.map((service) => service.imageKey),
    },
    clusterAuth,
    services: redactedServices(live.services),
    manifests: redacted.manifests,
    manifestPath,
    commands,
    rolloutPlan: {
      steps: [
        "confirm target cluster/namespace/runner pool and SecretRefs",
        "server-side dry-run generated Package D production manifests before apply",
        "apply only allowlisted Package D Deployment/Service/ConfigMap resources",
        "observe rollout status for portal-frontend, medopl-go-backend, opl-web-gateway and opl-runtime-bridge",
        "run Portal/backend/Gateway/Runtime Bridge/PostgreSQL smoke from inside TKE/VPC",
        "write redacted deploy and smoke evidence under .runtime",
      ],
    },
    smokePlan: {
      targets: [
        "PostgreSQL 10.66.0.21:5432 connectivity from deployed service boundary",
        "Portal frontend service reachable through expected service path",
        "medopl-go-backend health/config check without secret leakage",
        "opl-web-gateway health and upstream boundary check",
        "opl-runtime-bridge health and runtime boundary check",
        "redaction audit over logs and evidence",
      ],
    },
    rollback: {
      policy: "rollout-undo-only-for-allowlisted-package-d-deployments",
      commands: rollback,
      dbMigrationPolicy: "forward-only unless separately authorized",
      configRollback: "restore previous ConfigMap/SecretRef references only through repo-native rollback evidence",
    },
    stopConditions: [
      "RUN_TENCENT_DEPLOY_EXECUTION is not explicitly authorized for deploy execution",
      "context or cluster does not match cls-fi097sy4",
      "namespace is not medopl-platform",
      "scheduling target is not np-6l4nkdto",
      "manifest references a tenant pool prefix or tenant pool",
      "manifest contains plaintext secret, raw kubeconfig or full DB URL",
      "service image refs are missing, latest, malformed or outside medopl namespace",
      "server-side dry-run fails",
      "post-deploy smoke fails",
      "redaction audit fails",
    ],
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, "deploy-plan-redacted.json"),
      manifestPath,
      futureDeployEvidence: ".runtime/package-d-deploy/<runid>/deploy-redacted.json",
      futureSmokeEvidence: ".runtime/package-d-deploy/<runid>/smoke-redacted.json",
      futureRollbackEvidence: ".runtime/package-d-deploy/<runid>/rollback-redacted.json",
    },
    secretRefs: {
      deployEnvSecretRef: DEPLOY_SECRET_REF,
      portalRuntimeSecretRef: RUNTIME_SECRET_REF,
      imagePullSecret: IMAGE_PULL_SECRET,
      plaintextSecretsAllowed: false,
    },
    boundary: {
      runTencentDeployExecution: deployEnv.RUN_TENCENT_DEPLOY_EXECUTION,
      localGateOnlyThisRun: true,
      kubectlExecutedNow: false,
      deployExecutedNow: false,
      buildPushAllowed: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      tenantPoolMutationAllowed: false,
      platformPoolModificationAllowed: false,
      evidenceSink: ".runtime",
    },
    realExecutionReady: false,
  };
  Object.defineProperty(plan, "liveManifests", {
    value: live.manifests,
    enumerable: false,
  });
  return plan;
}

export async function writePackageDProductionDeployPlanEvidence({ plan } = {}) {
  if (!plan?.evidence?.path) throw new Error("package_d_production_deploy_plan_required");
  const evidenceDir = path.dirname(plan.evidence.path);
  await writeEvidence({ evidenceDir, filename: path.basename(plan.evidence.manifestPath), payload: plan.manifests });
  const payload = {
    ...plan,
    commands: plan.commands.map((command) => ({
      name: command.name,
      kind: command.kind,
      command: command.command,
    })),
    rollback: {
      ...plan.rollback,
      commands: plan.rollback.commands.map((command) => ({
        name: command.name,
        kind: command.kind,
        command: command.command,
      })),
    },
  };
  const audit = redactionAudit(JSON.stringify(payload));
  const evidence = { ...payload, redactionAudit: audit };
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_production_deploy_redaction_audit_failed");
  const target = await writeEvidence({ evidenceDir, filename: path.basename(plan.evidence.path), payload: evidence });
  return { path: target, report: evidence };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode !== "production-deploy-plan") throw new Error("package_d_production_deploy_mode_required");
  const plan = await buildPackageDProductionDeployPlan({
    deployEnvPath: args["deploy-env"],
    runtimeEnvPath: args["runtime-env"],
    kubeconfigPath: args.kubeconfig,
    evidenceDir: args["evidence-dir"],
    authorized: args.authorized === "1",
  });
  const evidence = await writePackageDProductionDeployPlanEvidence({ plan });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    contract: plan.contract,
    mode: plan.mode,
    evidencePath: evidence.path,
    realExecutionReady: false,
  }, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
