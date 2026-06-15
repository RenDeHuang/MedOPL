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
  assertTargetEnv,
  defaultKubectlExecutor,
  kubeconfigSummary,
  parseEnv,
  redactedCommand,
  redactionAudit,
  summarizeCommandResult,
} from "./package-d-kubernetes-api-preflight-runner.js";

export const PACKAGE_D_RUN_SCOPED_JOB_COMMAND = "node tests/support/cloud-prework/package-d-run-scoped-job-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --mode preflight-job";

const DEFAULT_EVIDENCE_ROOT = ".runtime/package-d-run-scoped-job-preflight";
const CLEANUP_POLICY = "delete-on-success-retain-on-failure";
const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,29}$/u;
const RUNNER_IMAGE_REF_SOURCE_KEY = "PACKAGE_D_RUNNER_IMAGE_REF";
const REDACTED_RUNNER_IMAGE_REF = "REDACTED_PACKAGE_D_RUNNER_IMAGE_REF";
const FORBIDDEN_ARGS = Object.freeze(new Set([
  "--deploy",
  "--build",
  "--push",
  "--tencent-mutation",
  "--package-c-live",
  "--patch",
  "--scale",
  "--apply",
]));

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`package_d_run_scoped_job_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`package_d_run_scoped_job_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`package_d_run_scoped_job_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertRunId(runId = "") {
  if (!runId) throw new Error("package_d_run_scoped_job_runid_required");
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("package_d_run_scoped_job_runid_invalid");
}

function text(value = "") {
  return String(value ?? "").trim();
}

function jobNameForRunId(runId = "") {
  assertRunId(runId);
  return `medopl-platform-runner-preflight-${runId}`;
}

function assertRunnerImageRef({ imageRef, deployEnv }) {
  const value = text(imageRef);
  if (!value) throw new Error("package_d_runner_image_ref_missing");
  if (value.startsWith("REDACTED_")) throw new Error("package_d_runner_image_ref_redacted_value_forbidden");
  if (/\s/u.test(value) || value.includes("://")) throw new Error("package_d_runner_image_ref_malformed");
  const slashParts = value.split("/");
  if (slashParts.length < 3) throw new Error("package_d_runner_image_ref_malformed");
  const registry = slashParts[0];
  const namespace = slashParts[1];
  const imageNameWithTag = slashParts.slice(2).join("/");
  const tagSeparator = imageNameWithTag.lastIndexOf(":");
  if (tagSeparator <= 0 || tagSeparator === imageNameWithTag.length - 1) {
    throw new Error("package_d_runner_image_ref_malformed");
  }
  const repository = imageNameWithTag.slice(0, tagSeparator);
  const tag = imageNameWithTag.slice(tagSeparator + 1);
  if (!repository || !tag || tag === "latest") throw new Error("package_d_runner_image_ref_malformed");
  if (registry !== deployEnv.TENCENT_TCR_REGISTRY) throw new Error("package_d_runner_image_ref_registry_mismatch");
  if (namespace !== deployEnv.TENCENT_TCR_NAMESPACE) throw new Error("package_d_runner_image_ref_namespace_mismatch");
  return {
    value,
    sourceKey: RUNNER_IMAGE_REF_SOURCE_KEY,
    registry,
    namespace,
    repository,
    tagPresent: true,
  };
}

function refList(names = [], key) {
  return names.map((name) => ({ [key]: { name } }));
}

function imagePullSecretRefs(names = []) {
  return names.map((name) => ({ name }));
}

function materializeRunScopedJobManifest({ runId, runnerImageRef }) {
  const shape = PACKAGE_D_IN_CLUSTER_PLATFORM_RUNNER_SHAPE;
  const namespace = shape.namespace;
  const jobName = jobNameForRunId(runId);
  const [deploySecretName, runtimeSecretName] = shape.podTemplate.secretRefs;
  const pack = materializePackageDInClusterRunnerPack(shape);
  return {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: jobName,
      namespace,
      labels: {
        "app.kubernetes.io/name": "medopl-platform-runner",
        "app.kubernetes.io/component": "package-d-preflight",
        "medopl.io/run-id": runId,
        "medopl.io/scope": "package-d-run-scoped-preflight",
      },
    },
    spec: {
      backoffLimit: 0,
      template: {
        metadata: {
          labels: {
            "app.kubernetes.io/name": "medopl-platform-runner",
            "app.kubernetes.io/component": "package-d-preflight",
            "medopl.io/run-id": runId,
          },
        },
        spec: {
          serviceAccountName: shape.serviceAccountName,
          restartPolicy: shape.podTemplate.restartPolicy,
          nodeSelector: shape.scheduling.nodeSelector,
          imagePullSecrets: imagePullSecretRefs(shape.podTemplate.imagePullSecrets),
          containers: [{
            name: "medopl-package-d-runner",
            image: runnerImageRef,
            imagePullPolicy: "IfNotPresent",
            args: ["preflight"],
            envFrom: [
              ...refList(shape.podTemplate.configMapRefs, "configMapRef"),
              { secretRef: { name: deploySecretName } },
              { secretRef: { name: runtimeSecretName } },
            ],
            env: [
              { name: "RUN_SCOPED_JOB_ID", value: runId },
              { name: "PACKAGE_D_RUNNER_COMMAND", value: "preflight" },
              { name: "EXPECTED_NAMESPACE", value: namespace },
              { name: "EXPECTED_SERVICE_ACCOUNT", value: shape.serviceAccountName },
              { name: "TARGET_CLUSTER_ID", value: FIXED_CLUSTER_ID },
              { name: "TARGET_PLATFORM_NODE_POOL_ID", value: shape.scheduling.nodePoolId },
              { name: "POSTGRES_ENDPOINT", value: FIXED_POSTGRES_ENDPOINT },
              { name: "EVIDENCE_SINK", value: ".runtime" },
            ],
          }],
        },
      },
    },
    packageDJobLifecycle: pack.jobLifecycle,
  };
}

function redactedJobManifest(manifest = {}) {
  const redacted = JSON.parse(JSON.stringify(manifest));
  if (redacted.spec?.template?.spec?.containers?.[0]) {
    redacted.spec.template.spec.containers[0].image = REDACTED_RUNNER_IMAGE_REF;
  }
  return redacted;
}

function assertJobManifestBoundary(manifest = {}, { allowRedactedImage = false } = {}) {
  const serialized = JSON.stringify(manifest);
  if (serialized.includes("medopl-tenant-")) throw new Error("package_d_run_scoped_job_references_tenant_pool");
  if (serialized.includes("postgresql://")) throw new Error("package_d_run_scoped_job_exposes_db_url");
  if (serialized.includes("client-key-data") || serialized.includes("client-certificate-data")) {
    throw new Error("package_d_run_scoped_job_embeds_kubeconfig");
  }
  if (manifest.kind !== "Job") throw new Error("package_d_run_scoped_job_kind_mismatch");
  if (manifest.metadata?.namespace !== FIXED_NAMESPACE) throw new Error("package_d_run_scoped_job_namespace_mismatch");
  if (!String(manifest.metadata?.name || "").startsWith("medopl-platform-runner-preflight-")) {
    throw new Error("package_d_run_scoped_job_name_mismatch");
  }
  const podSpec = manifest.spec?.template?.spec || {};
  if (podSpec.serviceAccountName !== "medopl-platform-runner") throw new Error("package_d_run_scoped_job_service_account_mismatch");
  if (podSpec.nodeSelector?.["node.tke.cloud.tencent.com/machineset"] !== FIXED_PLATFORM_NODE_POOL_ID) {
    throw new Error("package_d_run_scoped_job_scheduling_mismatch");
  }
  if (Object.hasOwn(podSpec.nodeSelector || {}, "medopl.io/nodepool-role")) {
    throw new Error("package_d_run_scoped_job_uses_retired_custom_nodepool_label");
  }
  const container = podSpec.containers?.[0] || {};
  if (!allowRedactedImage && String(container.image || "").startsWith("REDACTED_")) {
    throw new Error("package_d_run_scoped_job_live_manifest_redacted_image_forbidden");
  }
  if (JSON.stringify(container.args) !== JSON.stringify(["preflight"])) {
    throw new Error("package_d_run_scoped_job_command_must_be_preflight");
  }
}

function plannedCommands({ jobName }) {
  return [
    { name: "kubectl_client_available", args: ["kubectl", "version", "--client"], kind: "readonly" },
    { name: "current_context", args: ["kubectl", "config", "current-context"], kind: "readonly" },
    { name: "namespace_read", args: ["kubectl", "get", "namespace", FIXED_NAMESPACE, "-o", "json"], kind: "readonly" },
    { name: "job_create", args: ["kubectl", "create", "-f", "-"], kind: "job_create" },
    { name: "job_wait_complete", args: ["kubectl", "wait", "--for=condition=complete", `job/${jobName}`, "-n", FIXED_NAMESPACE, "--timeout=300s"], kind: "job_observe" },
    { name: "job_status_read", args: ["kubectl", "get", "job", jobName, "-n", FIXED_NAMESPACE, "-o", "json"], kind: "job_observe" },
    { name: "job_logs_collect", args: ["kubectl", "logs", `job/${jobName}`, "-n", FIXED_NAMESPACE], kind: "job_evidence" },
    { name: "job_cleanup", args: ["kubectl", "delete", "job", jobName, "-n", FIXED_NAMESPACE, "--wait=false"], kind: "job_cleanup" },
  ];
}

function assertKubectlCommandAllowed(args = [], kind = "", jobName = "") {
  const joined = ` ${args.join(" ")} `;
  if (args[0] !== "kubectl") throw new Error("package_d_run_scoped_job_command_must_be_kubectl");
  for (const forbidden of [" apply ", " patch ", " scale ", " rollout ", " exec ", " cp "]) {
    if (joined.includes(forbidden)) throw new Error(`package_d_run_scoped_job_kubectl_forbidden:${forbidden.trim()}`);
  }
  if (kind === "job_create" && JSON.stringify(args) !== JSON.stringify(["kubectl", "create", "-f", "-"])) {
    throw new Error("package_d_run_scoped_job_create_must_use_stdin");
  }
  if (kind === "job_cleanup") {
    const expected = ["kubectl", "delete", "job", jobName, "-n", FIXED_NAMESPACE, "--wait=false"];
    if (JSON.stringify(args) !== JSON.stringify(expected)) throw new Error("package_d_run_scoped_job_cleanup_scope_mismatch");
  }
  if (args.includes("delete") && kind !== "job_cleanup") throw new Error("package_d_run_scoped_job_unscoped_delete_forbidden");
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

function parseJobStatus(stdout = "", status = 1) {
  if (status !== 0) return "unknown";
  try {
    const parsed = JSON.parse(stdout);
    if (parsed?.status?.succeeded > 0) return "complete";
    if (parsed?.status?.failed > 0) return "failed";
    return "running";
  } catch {
    return "unknown";
  }
}

function summarizeJobCommand(command, result) {
  return {
    ...summarizeCommandResult(command, result),
    command: redactedCommand(command.args).replace(" -f -", " -f REDACTED_STDIN_JOB_MANIFEST"),
  };
}

async function writeEvidence({ evidenceDir, filename, payload }) {
  await mkdir(evidenceDir, { recursive: true });
  const target = path.join(evidenceDir, filename);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildPackageDRunScopedJobPlan({
  deployEnvPath,
  runtimeEnvPath,
  kubeconfigPath,
  evidenceDir,
  runId,
  argv = [],
} = {}) {
  parseArgs(argv);
  assertRunId(runId);
  assertFile(deployEnvPath, "package_d_deploy_env_missing");
  assertFile(runtimeEnvPath, "package_d_runtime_env_missing");
  assertFile(kubeconfigPath, "package_d_kubeconfig_missing");

  const deployEnv = parseEnv(await readFile(deployEnvPath, "utf8"), DEPLOY_ENV_KEYS);
  const runtimeEnv = parseEnv(await readFile(runtimeEnvPath, "utf8"), RUNTIME_ENV_KEYS);
  assertTargetEnv({ deployEnv, runtimeEnv, kubeconfigPath });
  const runnerImage = assertRunnerImageRef({ imageRef: deployEnv[RUNNER_IMAGE_REF_SOURCE_KEY], deployEnv });
  const clusterAuth = kubeconfigSummary(await readFile(kubeconfigPath, "utf8"));
  const manifestWithLifecycle = materializeRunScopedJobManifest({ runId, runnerImageRef: runnerImage.value });
  const { packageDJobLifecycle, ...liveJobManifest } = manifestWithLifecycle;
  assertJobManifestBoundary(liveJobManifest);
  const jobManifest = redactedJobManifest(liveJobManifest);
  assertJobManifestBoundary(jobManifest, { allowRedactedImage: true });
  const jobName = jobNameForRunId(runId);
  const commands = plannedCommands({ jobName }).map((command) => {
    assertKubectlCommandAllowed(command.args, command.kind, jobName);
    return command;
  });
  const scopedEvidenceDir = evidenceDir || path.join(DEFAULT_EVIDENCE_ROOT, runId);

  const plan = {
    ok: true,
    contract: "package_d_run_scoped_job_runner",
    mode: "preflight-job",
    command: PACKAGE_D_RUN_SCOPED_JOB_COMMAND,
    runId,
    jobName,
    cleanupPolicy: CLEANUP_POLICY,
    target: {
      clusterId: FIXED_CLUSTER_ID,
      namespace: FIXED_NAMESPACE,
      serviceAccount: "medopl-platform-runner",
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
      runnerImageRefSourceKey: runnerImage.sourceKey,
      runnerImageRef: "redacted",
      runnerImageRepository: runnerImage.repository,
      runnerImageTagPresent: runnerImage.tagPresent,
    },
    clusterAuth,
    preflightChecks: [
      "in_cluster_identity_namespace_service_account_sanity",
      "postgres_10_66_0_21_5432_connectivity_smoke",
      "package_d_secretref_env_availability_smoke",
      "tcr_imagepullsecret_image_pull_readiness_shape",
      "evidence_redaction_audit",
    ],
    jobManifest,
    commands,
    evidence: {
      sink: ".runtime",
      path: path.join(scopedEvidenceDir, "preflight-job-redacted.json"),
      redactedManifestPath: path.join(scopedEvidenceDir, "job-manifest-redacted.json"),
    },
    boundary: {
      runTencentDeployExecution: deployEnv.RUN_TENCENT_DEPLOY_EXECUTION,
      realDeployAllowed: false,
      buildPushAllowed: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      tenantPoolMutationAllowed: false,
      platformPoolModificationAllowed: false,
      businessDeploymentRolloutAllowed: false,
      sameNameTemplateUpdateAllowed: false,
      evidenceSink: ".runtime",
    },
    jobLifecycle: {
      ...packageDJobLifecycle,
      runScopedName: jobName,
      cleanupPolicy: CLEANUP_POLICY,
      allowedActionsAfterAuthorization: [
        "create unique Job",
        "observe Job",
        "collect redacted evidence",
        "delete only that unique successful Job",
        "retain failed Job for manual evidence unless separately cleaned",
      ],
    },
    realExecutionReady: false,
  };
  Object.defineProperty(plan, "liveJobManifest", {
    value: liveJobManifest,
    enumerable: false,
  });
  return plan;
}

export async function runPackageDRunScopedJobPreflight({
  deployEnvPath,
  runtimeEnvPath,
  kubeconfigPath,
  evidenceDir,
  runId,
  kubectl = defaultKubectlExecutor,
} = {}) {
  const plan = await buildPackageDRunScopedJobPlan({ deployEnvPath, runtimeEnvPath, kubeconfigPath, evidenceDir, runId });
  const scopedEvidenceDir = evidenceDir || path.join(DEFAULT_EVIDENCE_ROOT, runId);
  await mkdir(scopedEvidenceDir, { recursive: true });
  await writeFile(plan.evidence.redactedManifestPath, `${JSON.stringify(plan.jobManifest, null, 2)}\n`);

  const manifestStdin = `${JSON.stringify(plan.liveJobManifest, null, 2)}\n`;
  const commandResults = [];
  let namespaceStatus = "not_checked";
  let jobObserved = "not_checked";
  let logsClass = "not_collected";
  let cleanup = "not_attempted";
  for (const command of plan.commands) {
    if (command.kind === "job_cleanup" && jobObserved !== "complete") {
      cleanup = "retained_on_failure_or_unknown";
      continue;
    }
    const stdin = command.kind === "job_create" ? manifestStdin : undefined;
    const result = await kubectl({ args: command.args, env: { [KUBE_ENV_NAME]: kubeconfigPath }, stdin });
    commandResults.push(summarizeJobCommand(command, result));
    if (command.name === "current_context" && result.status === 0 && !String(result.stdout || "").includes(FIXED_CLUSTER_ID)) {
      throw new Error("package_d_run_scoped_job_context_mismatch");
    }
    if (command.name === "namespace_read") namespaceStatus = parseNamespaceStatus(result.stdout, result.status);
    if (command.name === "job_wait_complete" && result.status === 0) jobObserved = "complete";
    if (command.name === "job_status_read") jobObserved = parseJobStatus(result.stdout, result.status);
    if (command.name === "job_logs_collect") logsClass = result.stdout ? "present_redacted" : "empty";
    if (command.name === "job_cleanup" && result.status === 0) cleanup = "deleted_on_success";
    if (result.status !== 0) break;
  }
  const failed = commandResults.find((result) => result.status !== 0);
  const jobCreate = commandResults.find((result) => result.name === "job_create");
  const summary = {
    ok: !failed && namespaceStatus === "present" && jobCreate?.status === 0 && jobObserved === "complete",
    contract: plan.contract,
    mode: plan.mode,
    runId,
    jobName: plan.jobName,
    target: plan.target,
    kubernetesApiConnected: commandResults.some((result) => result.name === "namespace_read" && result.status === 0),
    namespaceStatus,
    jobCreate: jobCreate?.status === 0 ? "created" : "not_created",
    jobObserved,
    logsClass,
    cleanup,
    cleanupPolicy: plan.cleanupPolicy,
    failedStep: failed?.name || "",
    commands: commandResults,
    preflightChecks: plan.preflightChecks,
    realExecutionReady: false,
  };
  const evidence = {
    ...summary,
    command: plan.command,
    env: plan.env,
    clusterAuth: plan.clusterAuth,
    boundary: plan.boundary,
    jobLifecycle: plan.jobLifecycle,
    jobManifest: plan.jobManifest,
  };
  const audit = redactionAudit(JSON.stringify(evidence));
  const evidenceWithAudit = { ...evidence, redactionAudit: audit };
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_run_scoped_job_redaction_audit_failed");
  const evidencePath = await writeEvidence({
    evidenceDir: scopedEvidenceDir,
    filename: "preflight-job-redacted.json",
    payload: evidenceWithAudit,
  });
  if (!summary.ok) throw new Error(`package_d_run_scoped_job_failed:${summary.failedStep || summary.jobObserved || summary.namespaceStatus}`);
  return { ...summary, evidencePath, redactedManifestPath: plan.evidence.redactedManifestPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode !== "preflight-job") throw new Error("package_d_run_scoped_job_mode_required");
  const summary = await runPackageDRunScopedJobPreflight({
    deployEnvPath: args["deploy-env"],
    runtimeEnvPath: args["runtime-env"],
    kubeconfigPath: args.kubeconfig,
    runId: args["run-id"],
    evidenceDir: args["evidence-dir"],
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
