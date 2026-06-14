#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE,
  materializePackageDInClusterRunnerPack,
} from "./package-d-in-cluster-platform-runner-shape.js";
import {
  DEPLOY_ENV_KEYS,
  FIXED_CLUSTER_ID,
  FIXED_NAMESPACE,
  FIXED_PLATFORM_NODE_POOL_ID,
  FIXED_POSTGRES_ENDPOINT,
  KUBE_ENV_NAME,
  RUNTIME_ENV_KEYS,
  assertFile,
  assertManifestBoundary,
  assertTargetEnv,
  defaultKubectlExecutor,
  kubeconfigSummary,
  parseEnv,
  redactedCommand,
  redactionAudit,
  runPackageDKubernetesApiPreflight,
  summarizeCommandResult,
} from "./package-d-kubernetes-api-preflight-runner.js";

export const PACKAGE_D_BOOTSTRAP_APPLY_COMMAND = "node tests/support/cloud-prework/package-d-bootstrap-apply-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode bootstrap-apply";

const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-bootstrap-apply";
const BOOTSTRAP_IMAGE_TAG = "bootstrap-apply";
const FORBIDDEN_ARGS = Object.freeze(new Set([
  "--deploy",
  "--build",
  "--push",
  "--tencent-mutation",
  "--package-c-live",
  "--delete",
  "--patch",
  "--scale",
]));
const ALLOWED_RESOURCES = Object.freeze([
  "Namespace/medopl-platform",
  "ServiceAccount/medopl-platform-runner",
  "Role/medopl-platform-runner",
  "RoleBinding/medopl-platform-runner",
  "ClusterRole/medopl-platform-runner-node-reader",
  "ClusterRoleBinding/medopl-platform-runner-node-reader",
  "ConfigMap/medopl-package-d-runner-config",
  "Secret/medopl-package-d-deploy-env",
  "Secret/medopl-portal-runtime-env",
  "Secret/medopl-tcr-pull-secret",
  "Job/medopl-platform-runner",
]);

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`package_d_bootstrap_apply_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`package_d_bootstrap_apply_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`package_d_bootstrap_apply_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function realSecretData(env = {}, keys = []) {
  return Object.fromEntries(keys.map((key) => [key, text(env[key])]));
}

function imagePullSecretData({ registry, username, password }) {
  return {
    ".dockerconfigjson": JSON.stringify({
      auths: {
        [registry]: {
          username,
          password,
          auth: Buffer.from(`${username}:${password}`).toString("base64"),
        },
      },
    }),
  };
}

function materializeBootstrapApplyManifests({ deployEnv, runtimeEnv }) {
  const pack = materializePackageDInClusterRunnerPack(PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE);
  const manifests = pack.manifests;
  const imageRef = `${deployEnv.TENCENT_TCR_REGISTRY}/${deployEnv.TENCENT_TCR_NAMESPACE}/medopl-package-d-runner:${BOOTSTRAP_IMAGE_TAG}`;
  const items = [
    manifests.namespace,
    manifests.serviceAccount,
    manifests.configMap,
    {
      ...manifests.secretTemplates.deployEnvSecret,
      stringData: realSecretData(deployEnv, Object.keys(manifests.secretTemplates.deployEnvSecret.stringData)),
    },
    {
      ...manifests.secretTemplates.portalRuntimeSecret,
      stringData: realSecretData(runtimeEnv, Object.keys(manifests.secretTemplates.portalRuntimeSecret.stringData)),
    },
    {
      ...manifests.secretTemplates.imagePullSecret,
      stringData: imagePullSecretData({
        registry: deployEnv.TENCENT_TCR_REGISTRY,
        username: deployEnv.TCR_ID,
        password: deployEnv.TCR_SECRET,
      }),
    },
    manifests.role,
    manifests.roleBinding,
    manifests.clusterRole,
    manifests.clusterRoleBinding,
    {
      ...manifests.job,
      spec: {
        ...manifests.job.spec,
        template: {
          ...manifests.job.spec.template,
          spec: {
            ...manifests.job.spec.template.spec,
            containers: manifests.job.spec.template.spec.containers.map((container) => ({
              ...container,
              image: imageRef,
            })),
          },
        },
      },
    },
  ];
  return { apiVersion: "v1", kind: "List", items };
}

function redactedManifestList(manifests) {
  return {
    ...manifests,
    items: manifests.items.map((item) => {
      if (item.kind !== "Secret") return item;
      const stringData = Object.fromEntries(Object.keys(item.stringData || {}).map((key) => [key, "REDACTED_APPLY_TIME_VALUE"]));
      return { ...item, stringData };
    }),
  };
}

function resourceId(item = {}) {
  return `${item.kind}/${item.metadata?.name || ""}`;
}

function assertAllowedResourceSet(manifests) {
  const allowed = new Set(ALLOWED_RESOURCES);
  const seen = manifests.items.map(resourceId);
  const disallowed = seen.filter((id) => !allowed.has(id));
  if (disallowed.length > 0) throw new Error(`package_d_bootstrap_apply_resource_not_allowlisted:${disallowed.join(",")}`);
  const missing = ALLOWED_RESOURCES.filter((id) => !seen.includes(id));
  if (missing.length > 0) throw new Error(`package_d_bootstrap_apply_missing_resource:${missing.join(",")}`);
}

function assertBootstrapManifestBoundary(manifests) {
  assertAllowedResourceSet(manifests);
  const serialized = JSON.stringify(manifests);
  if (serialized.includes("medopl-tenant-")) throw new Error("package_d_bootstrap_apply_manifest_references_tenant_pool");
  if (serialized.includes("client-key-data") || serialized.includes("client-certificate-data")) {
    throw new Error("package_d_bootstrap_apply_manifest_embeds_kubeconfig");
  }
  for (const item of manifests.items) {
    const namespace = item.metadata?.namespace;
    if (item.kind !== "Namespace" && !["ClusterRole", "ClusterRoleBinding"].includes(item.kind) && namespace !== FIXED_NAMESPACE) {
      throw new Error(`package_d_bootstrap_apply_namespace_mismatch:${resourceId(item)}`);
    }
    if (["Deployment", "Service"].includes(item.kind)) throw new Error(`package_d_bootstrap_apply_business_rollout_forbidden:${item.kind}`);
  }
}

function assertRedactedManifestBoundary(manifests) {
  assertManifestBoundary(manifests);
  assertAllowedResourceSet(manifests);
  const serialized = JSON.stringify(manifests);
  if (serialized.includes("medopl-tenant-")) throw new Error("package_d_bootstrap_apply_redacted_manifest_references_tenant_pool");
  if (serialized.includes("postgresql://")) throw new Error("package_d_bootstrap_apply_redacted_manifest_exposes_db_url");
}

function plannedCommands() {
  return [
    { name: "kubectl_client_available", args: ["kubectl", "version", "--client"], kind: "readonly" },
    { name: "current_context", args: ["kubectl", "config", "current-context"], kind: "readonly" },
    { name: "namespace_read_before_apply", args: ["kubectl", "get", "namespace", FIXED_NAMESPACE, "-o", "json"], kind: "readonly" },
    { name: "bootstrap_apply", args: ["kubectl", "apply", "--server-side", "-f", "-"], kind: "bootstrap_apply" },
  ];
}

function assertKubectlCommandAllowed(args = [], kind = "") {
  const joined = ` ${args.join(" ")} `;
  if (args[0] !== "kubectl") throw new Error("package_d_bootstrap_apply_command_must_be_kubectl");
  for (const forbidden of [" delete ", " patch ", " scale ", " rollout ", " exec ", " cp "]) {
    if (joined.includes(forbidden)) throw new Error(`package_d_bootstrap_apply_kubectl_forbidden:${forbidden.trim()}`);
  }
  if (args.includes("apply")) {
    if (!args.includes("--server-side")) throw new Error("package_d_bootstrap_apply_must_be_server_side");
    if (!args.includes("-f") || args[args.indexOf("-f") + 1] !== "-") {
      throw new Error("package_d_bootstrap_apply_must_use_stdin");
    }
    if (kind === "bootstrap_apply" && args.includes("--dry-run=server")) {
      throw new Error("package_d_bootstrap_apply_must_not_be_dry_run");
    }
  }
}

function parseNamespaceStatus(stdout = "", status = 1) {
  if (status !== 0) return "missing";
  try {
    const parsed = JSON.parse(stdout);
    return parsed?.metadata?.name === FIXED_NAMESPACE ? "present" : "mismatch";
  } catch {
    return "unknown";
  }
}

function summarizeApplyCommand(command, result) {
  const summary = summarizeCommandResult(command, result);
  return {
    ...summary,
    command: redactedCommand(command.args).replace(" -f -", " -f REDACTED_STDIN_MANIFEST"),
  };
}

async function writeEvidence({ evidenceDir, filename, payload }) {
  await mkdir(evidenceDir, { recursive: true });
  const target = path.join(evidenceDir, filename);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildPackageDBootstrapApplyPlan({
  deployEnvPath,
  runtimeEnvPath,
  kubeconfigPath,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  argv = [],
} = {}) {
  parseArgs(argv);
  assertFile(deployEnvPath, "package_d_deploy_env_missing");
  assertFile(runtimeEnvPath, "package_d_runtime_env_missing");
  assertFile(kubeconfigPath, "package_d_kubeconfig_missing");

  const deployEnv = parseEnv(await readFile(deployEnvPath, "utf8"), DEPLOY_ENV_KEYS);
  const runtimeEnv = parseEnv(await readFile(runtimeEnvPath, "utf8"), RUNTIME_ENV_KEYS);
  assertTargetEnv({ deployEnv, runtimeEnv, kubeconfigPath });
  const clusterAuth = kubeconfigSummary(await readFile(kubeconfigPath, "utf8"));
  const applyManifests = materializeBootstrapApplyManifests({ deployEnv, runtimeEnv });
  assertBootstrapManifestBoundary(applyManifests);
  const manifestsRedacted = redactedManifestList(applyManifests);
  assertRedactedManifestBoundary(manifestsRedacted);
  const commands = plannedCommands().map((command) => {
    assertKubectlCommandAllowed(command.args, command.kind);
    return command;
  });

  return {
    ok: true,
    contract: "package_d_bootstrap_apply_runner",
    mode: "bootstrap-apply",
    command: PACKAGE_D_BOOTSTRAP_APPLY_COMMAND,
    target: {
      clusterId: FIXED_CLUSTER_ID,
      namespace: FIXED_NAMESPACE,
      platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
      postgresEndpoint: FIXED_POSTGRES_ENDPOINT,
    },
    env: {
      deployEnvPath: "authorized_package_d_deploy_env",
      runtimeEnvPath: "authorized_portal_runtime_env",
      kubeconfigPath: "authorized_kubeconfig_ref",
      tcrRegistry: deployEnv.TENCENT_TCR_REGISTRY,
      tcrNamespace: deployEnv.TENCENT_TCR_NAMESPACE,
      tcrRegion: deployEnv.TENCENT_TCR_REGION,
    },
    clusterAuth,
    allowedResources: [...ALLOWED_RESOURCES],
    manifestsRedacted,
    commands,
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, "bootstrap-apply-redacted.json"),
      redactedManifestPath: path.join(evidenceDir, "bootstrap-manifests-apply-redacted.json"),
    },
    boundary: {
      runTencentDeployExecution: deployEnv.RUN_TENCENT_DEPLOY_EXECUTION,
      bootstrapApplyAllowed: true,
      realDeployAllowed: false,
      buildPushAllowed: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      tenantPoolMutationAllowed: false,
      platformPoolModificationAllowed: false,
      evidenceSink: ".runtime",
    },
    realExecutionReady: false,
  };
}

export async function runPackageDBootstrapApply({
  deployEnvPath,
  runtimeEnvPath,
  kubeconfigPath,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  kubectl = defaultKubectlExecutor,
} = {}) {
  const plan = await buildPackageDBootstrapApplyPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir });
  const deployEnv = parseEnv(await readFile(deployEnvPath, "utf8"), DEPLOY_ENV_KEYS);
  const runtimeEnv = parseEnv(await readFile(runtimeEnvPath, "utf8"), RUNTIME_ENV_KEYS);
  assertTargetEnv({ deployEnv, runtimeEnv, kubeconfigPath });
  const applyManifests = materializeBootstrapApplyManifests({ deployEnv, runtimeEnv });
  assertBootstrapManifestBoundary(applyManifests);
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(plan.evidence.redactedManifestPath, `${JSON.stringify(plan.manifestsRedacted, null, 2)}\n`);

  const applyStdin = `${JSON.stringify(applyManifests, null, 2)}\n`;
  const commandResults = [];
  let namespaceBeforeApply = "not_checked";
  for (const command of plan.commands) {
    const stdin = command.kind === "bootstrap_apply" ? applyStdin : undefined;
    const result = await kubectl({ args: command.args, env: { [KUBE_ENV_NAME]: kubeconfigPath }, stdin });
    commandResults.push(summarizeApplyCommand(command, result));
    if (command.name === "namespace_read_before_apply") namespaceBeforeApply = parseNamespaceStatus(result.stdout, result.status);
    if (command.name === "current_context" && result.status === 0 && !String(result.stdout || "").includes(FIXED_CLUSTER_ID)) {
      throw new Error("package_d_bootstrap_apply_context_mismatch");
    }
    if (command.name !== "namespace_read_before_apply" && result.status !== 0) break;
  }
  const failed = commandResults.find((result) => result.name !== "namespace_read_before_apply" && result.status !== 0);
  const bootstrapApply = commandResults.find((result) => result.name === "bootstrap_apply");
  let postApplyPreflight = null;
  if (!failed && bootstrapApply?.status === 0) {
    postApplyPreflight = await runPackageDKubernetesApiPreflight({
      deployEnvPath,
      runtimeEnvPath,
      kubeconfigPath,
      evidenceDir: path.join(evidenceDir, "post-apply-server-side-dry-run"),
      kubectl,
    });
  }
  const summary = {
    ok: !failed && bootstrapApply?.status === 0 && postApplyPreflight?.serverSideDryRun === "pass",
    contract: plan.contract,
    mode: plan.mode,
    target: plan.target,
    namespaceBeforeApply,
    bootstrapApply: bootstrapApply?.status === 0 ? "applied" : "not_applied",
    serverSideDryRunAfterApply: postApplyPreflight?.serverSideDryRun || "not_passed",
    failedStep: failed?.name || "",
    commands: commandResults,
    allowedResources: plan.allowedResources,
    postApplyPreflight: postApplyPreflight ? {
      evidencePath: postApplyPreflight.evidencePath,
      serverSideDryRun: postApplyPreflight.serverSideDryRun,
      namespaceStatus: postApplyPreflight.namespaceStatus,
      realExecutionReady: postApplyPreflight.realExecutionReady,
    } : null,
    realExecutionReady: false,
  };
  const evidence = {
    ...summary,
    command: plan.command,
    env: plan.env,
    clusterAuth: plan.clusterAuth,
    boundary: plan.boundary,
    manifestsRedacted: plan.manifestsRedacted,
  };
  const audit = redactionAudit(JSON.stringify(evidence));
  const evidenceWithAudit = { ...evidence, redactionAudit: audit };
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_bootstrap_apply_redaction_audit_failed");
  const evidencePath = await writeEvidence({
    evidenceDir,
    filename: "bootstrap-apply-redacted.json",
    payload: evidenceWithAudit,
  });
  if (!summary.ok) throw new Error(`package_d_bootstrap_apply_failed:${summary.failedStep || summary.bootstrapApply}`);
  return { ...summary, evidencePath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode !== "bootstrap-apply") throw new Error("package_d_bootstrap_apply_mode_required");
  const summary = await runPackageDBootstrapApply({
    deployEnvPath: args["deploy-env"],
    runtimeEnvPath: args["runtime-env"],
    kubeconfigPath: args.kubeconfig,
    evidenceDir: args["evidence-dir"] || DEFAULT_EVIDENCE_DIR,
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
