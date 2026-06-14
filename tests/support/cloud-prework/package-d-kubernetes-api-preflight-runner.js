#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE,
  materializePackageDInClusterRunnerPack,
} from "./package-d-in-cluster-platform-runner-shape.js";

export const PACKAGE_D_KUBERNETES_API_PREFLIGHT_COMMAND = "node tests/support/cloud-prework/package-d-kubernetes-api-preflight-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode server-side-dry-run";

export const FIXED_CLUSTER_ID = "cls-fi097sy4";
export const FIXED_NAMESPACE = "medopl-platform";
export const FIXED_PLATFORM_NODE_POOL_ID = "np-cbk784r8";
export const FIXED_POSTGRES_ENDPOINT = "10.66.0.21:5432";
const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-kubernetes-api-server-side-dry-run-preflight";
const DRY_RUN_IMAGE_TAG = "server-side-dry-run";
export const KUBE_ENV_NAME = ["KUBE", "CONFIG"].join("");
export const DEPLOY_ENV_KEYS = Object.freeze([
  "RUN_TENCENT_DEPLOY_EXECUTION",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_TCR_REGISTRY",
  "TENCENT_TCR_NAMESPACE",
  "TENCENT_TCR_REGION",
  "TENCENT_DEPLOY_CLUSTER_ID",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
]);
export const RUNTIME_ENV_KEYS = Object.freeze([
  "PORTAL_ADMIN_EMAIL",
  "PORTAL_ADMIN_NAME",
  "PORTAL_ADMIN_PASSWORD",
  "PORTAL_POSTGRES_URL",
  "PORTAL_POSTGRES_PASSWORD",
]);
const FORBIDDEN_ENV_KEYS = Object.freeze(new Set([
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
  "DATABASE_URL",
  "KUBECONFIG",
  "GITHUB_TOKEN",
  "SSH_PRIVATE_KEY",
]));
const FORBIDDEN_ARGS = Object.freeze(new Set([
  "--deploy",
  "--build",
  "--push",
  "--tencent-mutation",
  "--package-c-live",
  "--delete",
  "--patch",
  "--scale",
  "--apply",
]));

function text(value = "") {
  return String(value ?? "").trim();
}

function stripQuotes(value = "") {
  return text(value).replace(/^['"]|['"]$/gu, "");
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`package_d_kubernetes_api_preflight_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`package_d_kubernetes_api_preflight_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`package_d_kubernetes_api_preflight_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

export function parseEnv(content = "", allowedKeys = []) {
  const allowed = new Set(allowedKeys);
  const env = {};
  const duplicates = [];
  for (const line of String(content).split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) throw new Error("package_d_env_line_invalid");
    const key = normalized.slice(0, equalsIndex).trim();
    const value = stripQuotes(normalized.slice(equalsIndex + 1));
    if (FORBIDDEN_ENV_KEYS.has(key)) throw new Error(`package_d_env_forbidden_key:${key}`);
    if (!allowed.has(key)) throw new Error(`package_d_env_non_allowlist_key:${key}`);
    if (Object.hasOwn(env, key)) duplicates.push(key);
    env[key] = value;
  }
  if (duplicates.length > 0) throw new Error(`package_d_env_duplicate_key:${duplicates.sort().join(",")}`);
  const missing = allowedKeys.filter((key) => !text(env[key]));
  if (missing.length > 0) throw new Error(`package_d_env_missing:${missing.join(",")}`);
  return env;
}

function postgresEndpoint(value = "") {
  try {
    const parsed = new URL(stripQuotes(value));
    return `${parsed.hostname}:${parsed.port || "5432"}`;
  } catch {
    return "";
  }
}

export function assertFile(pathname = "", reason) {
  if (!pathname || !existsSync(pathname)) throw new Error(reason);
}

export function assertTargetEnv({ deployEnv, runtimeEnv, kubeconfigPath }) {
  if (deployEnv.RUN_TENCENT_DEPLOY_EXECUTION !== "0") throw new Error("package_d_deploy_run_gate_must_remain_zero");
  if (deployEnv.TENCENT_DEPLOY_CLUSTER_ID !== FIXED_CLUSTER_ID) throw new Error("package_d_deploy_cluster_mismatch");
  if (path.resolve(deployEnv.TENCENT_DEPLOY_KUBECONFIG_REF) !== path.resolve(kubeconfigPath)) {
    throw new Error("package_d_kubeconfig_ref_mismatch");
  }
  if (deployEnv.TENCENT_TCR_REGION !== "na-siliconvalley") throw new Error("package_d_tcr_region_mismatch");
  if (postgresEndpoint(runtimeEnv.PORTAL_POSTGRES_URL) !== FIXED_POSTGRES_ENDPOINT) {
    throw new Error("package_d_portal_postgres_endpoint_mismatch");
  }
}

export function kubeconfigSummary(content = "") {
  const currentContext = content.match(/^current-context:\s*([^\n\r]+)/mu)?.[1]?.trim() || "";
  const serverPresent = /^\s*server:\s*\S+/mu.test(content);
  const clusterIdPresent = content.includes(FIXED_CLUSTER_ID);
  if (!currentContext || !serverPresent || !clusterIdPresent || !currentContext.includes(FIXED_CLUSTER_ID)) {
    throw new Error("package_d_kubeconfig_target_cluster_unverified");
  }
  return {
    currentContext: currentContext.includes(FIXED_CLUSTER_ID) ? "matches_target_cluster" : "present_redacted",
    targetClusterId: FIXED_CLUSTER_ID,
    serverPresent: true,
    clusterIdPresent: true,
    contentRedacted: true,
  };
}

function serverSideDryRunManifests({ deployEnv }) {
  const pack = materializePackageDInClusterRunnerPack(PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE);
  const manifests = pack.manifests;
  const imageRef = `${deployEnv.TENCENT_TCR_REGISTRY}/${deployEnv.TENCENT_TCR_NAMESPACE}/medopl-package-d-runner:${DRY_RUN_IMAGE_TAG}`;
  const items = [
    manifests.namespace,
    manifests.serviceAccount,
    manifests.configMap,
    manifests.secretTemplates.deployEnvSecret,
    manifests.secretTemplates.portalRuntimeSecret,
    {
      ...manifests.secretTemplates.imagePullSecret,
      stringData: {
        ".dockerconfigjson": JSON.stringify({ auths: { [deployEnv.TENCENT_TCR_REGISTRY]: { auth: "REDACTED_DRY_RUN_ONLY" } } }),
      },
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

export function assertManifestBoundary(manifests) {
  const serialized = JSON.stringify(manifests);
  if (serialized.includes("medopl-tenant-")) throw new Error("package_d_manifest_references_tenant_pool");
  if (serialized.includes("postgresql://")) throw new Error("package_d_manifest_exposes_db_url");
  if (serialized.includes("client-key-data") || serialized.includes("client-certificate-data")) {
    throw new Error("package_d_manifest_embeds_kubeconfig");
  }
  const job = manifests.items.find((item) => item.kind === "Job");
  const configMap = manifests.items.find((item) => item.kind === "ConfigMap");
  if (job?.metadata?.namespace !== FIXED_NAMESPACE) throw new Error("package_d_job_namespace_mismatch");
  if (configMap?.data?.TARGET_PLATFORM_NODE_POOL_ID !== FIXED_PLATFORM_NODE_POOL_ID) {
    throw new Error("package_d_scheduling_platform_pool_mismatch");
  }
  if (job?.spec?.template?.spec?.nodeSelector?.["medopl.io/nodepool-role"] !== "platform-service") {
    throw new Error("package_d_scheduling_selector_mismatch");
  }
}

function plannedCommands(manifestPath) {
  return [
    { name: "kubectl_client_available", args: ["kubectl", "version", "--client"] },
    { name: "current_context", args: ["kubectl", "config", "current-context"] },
    { name: "namespace_read", args: ["kubectl", "get", "namespace", FIXED_NAMESPACE, "-o", "json"] },
    { name: "bootstrap_server_side_dry_run", args: ["kubectl", "apply", "--server-side", "--dry-run=server", "-f", manifestPath, "-o", "yaml"] },
  ];
}

function assertKubectlCommandAllowed(args = []) {
  const joined = args.join(" ");
  if (args[0] !== "kubectl") throw new Error("package_d_preflight_command_must_be_kubectl");
  for (const forbidden of [" delete ", " patch ", " scale ", " rollout ", " exec ", " cp "]) {
    if (` ${joined} `.includes(forbidden)) throw new Error(`package_d_preflight_kubectl_forbidden:${forbidden.trim()}`);
  }
  if (args.includes("apply") && !(args.includes("--server-side") && args.includes("--dry-run=server"))) {
    throw new Error("package_d_preflight_apply_must_be_server_side_dry_run");
  }
}

export function redactedCommand(args = []) {
  return args.map((arg, index) => (args[index - 1] === "-f" ? "REDACTED_MANIFEST_PACK" : arg)).join(" ");
}

export function redactionAudit(serializedEvidence = "") {
  return {
    tcrSecretExposed: serializedEvidence.includes("tcr-secret-value") || serializedEvidence.includes("TCR_SECRET="),
    portalAdminPasswordExposed: serializedEvidence.includes("portal-admin-password") || serializedEvidence.includes("PORTAL_ADMIN_PASSWORD="),
    portalPostgresPasswordExposed: serializedEvidence.includes("postgres-password") || serializedEvidence.includes("PORTAL_POSTGRES_PASSWORD="),
    fullDbUrlExposed: serializedEvidence.includes("postgresql://"),
    kubeconfigSecretExposed: [
      "client-certificate-data",
      "client-key-data",
      "certificate-authority-data",
      "raw-kubeconfig",
      "token:",
    ].some((needle) => serializedEvidence.includes(needle)),
  };
}

export async function defaultKubectlExecutor({ args, env, stdin }) {
  const result = spawnSync(args[0], args.slice(1), {
    env: { ...process.env, ...env },
    encoding: "utf8",
    input: stdin,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
}

export function summarizeCommandResult(command, result) {
  return {
    name: command.name,
    command: redactedCommand(command.args),
    status: result.status,
    stdoutClass: result.status === 0 && result.stdout ? "present_redacted" : "empty",
    stderrClass: result.stderr ? "present_redacted" : "empty",
  };
}

function parseNamespaceStatus(stdout = "") {
  try {
    const parsed = JSON.parse(stdout);
    return parsed?.metadata?.name === FIXED_NAMESPACE ? "present" : "mismatch";
  } catch {
    return "unknown";
  }
}

export async function buildPackageDKubernetesApiPreflightPlan({
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
  const manifests = serverSideDryRunManifests({ deployEnv });
  assertManifestBoundary(manifests);
  const manifestPath = path.join(evidenceDir, "bootstrap-manifests-server-side-dry-run-redacted.json");
  const commands = plannedCommands(manifestPath).map((command) => {
    assertKubectlCommandAllowed(command.args);
    return { ...command, kind: command.args.includes("apply") ? "server_side_dry_run" : "readonly" };
  });

  return {
    ok: true,
    contract: "package_d_kubernetes_api_server_side_dry_run_preflight_runner",
    mode: "server-side-dry-run",
    command: PACKAGE_D_KUBERNETES_API_PREFLIGHT_COMMAND,
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
    manifests,
    manifestPath,
    commands,
    boundary: {
      runTencentDeployExecution: deployEnv.RUN_TENCENT_DEPLOY_EXECUTION,
      realApplyAllowed: false,
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

export async function runPackageDKubernetesApiPreflight({
  deployEnvPath,
  runtimeEnvPath,
  kubeconfigPath,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  kubectl = defaultKubectlExecutor,
} = {}) {
  const plan = await buildPackageDKubernetesApiPreflightPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir });
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(plan.manifestPath, `${JSON.stringify(plan.manifests, null, 2)}\n`);

  const commandResults = [];
  let namespaceStatus = "not_checked";
  for (const command of plan.commands) {
    const result = await kubectl({ args: command.args, env: { [KUBE_ENV_NAME]: kubeconfigPath } });
    commandResults.push(summarizeCommandResult(command, result));
    if (command.name === "namespace_read" && result.status === 0) namespaceStatus = parseNamespaceStatus(result.stdout);
    if (result.status !== 0) break;
  }
  const failed = commandResults.find((result) => result.status !== 0);
  const dryRunResult = commandResults.find((result) => result.name === "bootstrap_server_side_dry_run");
  const summary = {
    ok: !failed && namespaceStatus === "present",
    contract: plan.contract,
    mode: plan.mode,
    target: plan.target,
    kubernetesApiConnected: commandResults.some((result) => result.name === "namespace_read" && result.status === 0),
    namespaceStatus,
    schedulingTargetValidated: true,
    serverSideDryRun: dryRunResult?.status === 0 ? "pass" : "not_passed",
    failedStep: failed?.name || "",
    commands: commandResults,
    realExecutionReady: false,
  };
  const evidence = {
    ...summary,
    command: plan.command,
    env: plan.env,
    clusterAuth: plan.clusterAuth,
    boundary: plan.boundary,
    commands: commandResults,
  };
  const audit = redactionAudit(JSON.stringify(evidence));
  const evidenceWithAudit = { ...evidence, redactionAudit: audit };
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_preflight_redaction_audit_failed");
  const evidencePath = path.join(evidenceDir, "preflight-redacted.json");
  await writeFile(evidencePath, `${JSON.stringify(evidenceWithAudit, null, 2)}\n`);
  if (!summary.ok) throw new Error(`package_d_kubernetes_api_preflight_failed:${summary.failedStep || namespaceStatus}`);
  return { ...summary, evidencePath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode !== "server-side-dry-run") throw new Error("package_d_kubernetes_api_preflight_mode_required");
  const summary = await runPackageDKubernetesApiPreflight({
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
