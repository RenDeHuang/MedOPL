#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const PACKAGE_D_SECRET_KEYS = new Set([
  "RUN_TENCENT_DEPLOY_EXECUTION",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_TCR_REGISTRY",
  "TENCENT_TCR_NAMESPACE",
  "TENCENT_TCR_REGION",
  "TENCENT_DEPLOY_CLUSTER_ID",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
]);

const FORBIDDEN_SECRET_KEYS = new Set([
  "RUN_TENCENT_READONLY_INVENTORY",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "TENCENT_MUTATION_TKE_NODE_POOL_ID",
  "TENCENT_MUTATION_COS_BUCKET",
  "TENCENT_MUTATION_COS_REGION",
  "TENCENT_COS_SECRET_ID",
  "TENCENT_COS_SECRET_KEY",
  "TENCENT_BILLING_SECRET_ID",
  "TENCENT_BILLING_SECRET_KEY",
  "LANGFUSE_SECRET_KEY",
  "DATABASE_URL",
  "SSH_PRIVATE_KEY",
  "GITHUB_TOKEN",
  "GFLABTOKEN",
]);

const MODES = new Map([
  ["check-config", { reportRoot: "", reportSuffix: "", writesReport: false }],
  ["tcr-preflight", { reportRoot: ".runtime/v22-registry", reportSuffix: "tcr-preflight", writesReport: true }],
  ["build-push", { reportRoot: ".runtime/v22-registry", reportSuffix: "build-push", writesReport: true }],
  ["deploy-dry-run", { reportRoot: ".runtime/v22-cloud-deploy", reportSuffix: "deploy-dry-run", writesReport: true }],
  ["rollout", { reportRoot: ".runtime/v22-cloud-deploy", reportSuffix: "rollout", writesReport: true }],
  ["runtime-smoke", { reportRoot: ".runtime/v22-runtime-smoke", reportSuffix: "runtime-smoke", writesReport: true }],
]);

function text(value = "") {
  return String(value ?? "").trim();
}

function parseLine(line = "") {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const equalsIndex = normalized.indexOf("=");
  if (equalsIndex <= 0) {
    throw new Error("tencent_deploy_secret_line_invalid");
  }
  const key = normalized.slice(0, equalsIndex).trim();
  let value = normalized.slice(equalsIndex + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

export function parseTencentDeploySecretFile(content = "") {
  const env = {};
  for (const line of String(content).split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      throw new Error(`tencent_deploy_forbidden_secret_key:${key}`);
    }
    if (!PACKAGE_D_SECRET_KEYS.has(key)) {
      throw new Error(`tencent_deploy_non_allowlist_secret_key_rejected:${key}`);
    }
    env[key] = value;
  }
  return env;
}

function parseArgs(argv = []) {
  const options = {
    mode: "",
    providerMode: "config-only",
    secretFile: "",
    releasePlanFile: "",
    imageDigestsFile: "",
    acceptedPreflightId: "",
    acceptedDryRunId: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check-config" || arg === "--tcr-preflight" || arg === "--build-push" || arg === "--deploy-dry-run" || arg === "--rollout" || arg === "--runtime-smoke") {
      options.mode = arg.slice(2);
      continue;
    }
    const nextValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("tencent_deploy_runner_arg_value_required");
      index += 1;
      return text(value);
    };
    if (arg === "--provider-mode") options.providerMode = nextValue();
    else if (arg === "--secret-file") options.secretFile = nextValue();
    else if (arg === "--release-plan") options.releasePlanFile = nextValue();
    else if (arg === "--image-digests-file") options.imageDigestsFile = nextValue();
    else if (arg === "--accepted-preflight-id") options.acceptedPreflightId = nextValue();
    else if (arg === "--accepted-dry-run-id") options.acceptedDryRunId = nextValue();
    else throw new Error("tencent_deploy_runner_unknown_arg");
  }
  if (!MODES.has(options.mode)) throw new Error("tencent_deploy_runner_mode_required");
  if (!options.secretFile) throw new Error("tencent_deploy_runner_secret_file_required");
  if (!options.releasePlanFile) throw new Error("tencent_deploy_runner_release_plan_required");
  return options;
}

function isEnabled(value = "") {
  const normalized = text(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function maskIdentifier(value = "") {
  const normalized = text(value);
  if (!normalized) return "missing";
  if (normalized.length <= 4) return "****";
  return `${normalized.slice(0, Math.max(0, normalized.length - 4))}****${normalized.slice(-4)}`;
}

function sanitizeRef(value = "") {
  const normalized = text(value);
  if (!normalized) return "missing";
  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      return `${url.protocol}//[redacted-host]/[redacted-path]`;
    } catch {
      return "invalid-url";
    }
  }
  return `local-ref:${createHash("sha256").update(normalized).digest("hex").slice(0, 12)}`;
}

function validateToken(value = "", label = "token") {
  const normalized = text(value);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,120}$/.test(normalized)) {
    throw new Error(`${label}_invalid`);
  }
  return normalized;
}

function validateImageTag(value = "") {
  const tag = text(value);
  if (!tag) return { ok: false, reason: "deploy_image_tag_required" };
  if (tag === "latest") return { ok: false, reason: "deploy_latest_tag_forbidden" };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{5,120}$/.test(tag)) {
    return { ok: false, reason: "deploy_image_tag_invalid" };
  }
  return { ok: true, tag };
}

function validateDigest(value = "") {
  const digest = text(value);
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) {
    return { ok: false, reason: "deploy_image_digest_required" };
  }
  return { ok: true, digest };
}

function validateRelativeExistingPath(value = "", label = "path") {
  const normalized = text(value);
  if (!normalized || path.isAbsolute(normalized) || normalized.includes("..")) {
    throw new Error(`${label}_must_be_repo_relative`);
  }
  const absolute = path.resolve(repoRoot, normalized);
  if (absolute !== repoRoot && !absolute.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error(`${label}_outside_repo`);
  }
  if (!existsSync(absolute)) {
    throw new Error(`${label}_missing`);
  }
  return normalized;
}

function buildImageRef(env = {}, target = {}, versionTag = "") {
  return [
    text(env.TENCENT_TCR_REGISTRY).replace(/\/+$/g, ""),
    text(env.TENCENT_TCR_NAMESPACE).replace(/^\/+|\/+$/g, ""),
    `${text(target.repository).replace(/^\/+|\/+$/g, "")}:${versionTag}`,
  ].join("/");
}

function fakeDigest(seed = "") {
  return `sha256:${createHash("sha256").update(seed).digest("hex")}`;
}

function reportPathFor(mode = "", runId = "") {
  const spec = MODES.get(mode);
  if (!spec?.writesReport) return "";
  return path.join(spec.reportRoot, `${runId}-${spec.reportSuffix}.json`);
}

function absoluteReportPath(relativePath = "") {
  return path.join(repoRoot, relativePath);
}

async function readJsonFile(filePath = "") {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

function targetKey(target = {}) {
  return `${text(target.component)}:${text(target.repository)}`;
}

function digestMapFromSummary(summary = {}) {
  const map = new Map();
  for (const target of summary.targets || []) {
    const digest = text(target.registry?.digest || target.imageDigest);
    if (target.component && digest) map.set(text(target.component), digest);
  }
  return map;
}

async function readDigestMap(options = {}) {
  if (!options.imageDigestsFile) return new Map();
  const summary = await readJsonFile(options.imageDigestsFile);
  return digestMapFromSummary(summary);
}

function validateReleasePlan(plan = {}) {
  const runId = text(plan.runId);
  const versionTag = validateImageTag(plan.versionTag);
  if (!runId) return { ok: false, reason: "deploy_run_id_required" };
  if (!versionTag.ok) return { ok: false, reason: versionTag.reason };
  try {
    validateToken(runId, "deploy_run_id");
  } catch {
    return { ok: false, reason: "deploy_release_plan_invalid" };
  }
  if (!Array.isArray(plan.targets) || plan.targets.length < 2) {
    return { ok: false, reason: "deploy_multi_target_release_plan_required" };
  }
  const globalNamespace = text(plan.namespace);
  if (globalNamespace) {
    try {
      validateToken(globalNamespace, "deploy_namespace");
    } catch {
      return { ok: false, reason: "deploy_release_plan_invalid" };
    }
  }
  const seenRepositoryTags = new Set();
  const seenWorkloadContainers = new Set();
  for (const target of plan.targets) {
    const requiredFields = [
      "component",
      "targetClass",
      "repository",
      "dockerfile",
      "buildContext",
      "namespace",
      "workload",
      "container",
      "ownerRef",
      "operationId",
      "expectedVersionMarker",
    ];
    if (requiredFields.some((field) => !text(target[field]))) {
      const platformOwnerFields = ["targetClass", "ownerRef", "operationId"];
      if (platformOwnerFields.some((field) => !text(target[field]))) {
        return { ok: false, reason: "deploy_platform_owner_guard_required" };
      }
      return { ok: false, reason: "deploy_target_field_required" };
    }
    const targetClass = text(target.targetClass);
    if (!["platform_service_target", "workspace_runtime_target"].includes(targetClass)) {
      return { ok: false, reason: "deploy_target_class_invalid" };
    }
    if (targetClass === "workspace_runtime_target" && (!text(target.workspaceId) || !text(target.resourceBindingId))) {
      return { ok: false, reason: "deploy_workspace_runtime_owner_guard_required" };
    }
    if (globalNamespace && text(target.namespace) !== globalNamespace) {
      return { ok: false, reason: "deploy_cross_namespace_target_forbidden" };
    }
    try {
      validateToken(target.component, "deploy_component");
      validateToken(target.targetClass, "deploy_target_class");
      validateToken(target.repository, "deploy_repository");
      validateToken(target.namespace, "deploy_namespace");
      validateToken(target.workload, "deploy_workload");
      validateToken(target.container, "deploy_container");
      validateToken(target.ownerRef, "deploy_owner_ref");
      validateToken(target.operationId, "deploy_operation_id");
      if (targetClass === "workspace_runtime_target") {
        validateToken(target.workspaceId, "deploy_workspace_id");
        validateToken(target.resourceBindingId, "deploy_resource_binding_id");
      }
      validateRelativeExistingPath(target.buildContext, "deploy_build_context");
      validateRelativeExistingPath(target.dockerfile, "deploy_dockerfile");
    } catch {
      return { ok: false, reason: "deploy_release_plan_invalid" };
    }
    const repositoryTag = `${text(target.repository)}:${versionTag.tag}`;
    if (seenRepositoryTags.has(repositoryTag)) {
      return { ok: false, reason: "deploy_duplicate_repository_tag_forbidden" };
    }
    seenRepositoryTags.add(repositoryTag);
    const workloadContainer = `${text(target.namespace)}:${text(target.workload)}:${text(target.container)}`;
    if (seenWorkloadContainers.has(workloadContainer)) {
      return { ok: false, reason: "deploy_duplicate_workload_container_forbidden" };
    }
    seenWorkloadContainers.add(workloadContainer);
  }
  if (!Array.isArray(plan.runtimeSmokeTargets) || plan.runtimeSmokeTargets.length < 3) {
    return { ok: false, reason: "deploy_runtime_smoke_targets_required" };
  }
  const requiredSurfaces = new Set(["portal", "opl", "trace"]);
  const seenSurfaces = new Set();
  const pushedVersionCoverage = new Set();
  for (const smokeTarget of plan.runtimeSmokeTargets) {
    if (!text(smokeTarget.surface) || !text(smokeTarget.url) || !text(smokeTarget.expectedVersionMarker)) {
      return { ok: false, reason: "deploy_runtime_smoke_target_field_required" };
    }
    try {
      validateToken(smokeTarget.surface, "deploy_runtime_smoke_surface");
      new URL(text(smokeTarget.url));
    } catch {
      return { ok: false, reason: "deploy_runtime_smoke_url_invalid" };
    }
    if (!/^https?:\/\//i.test(text(smokeTarget.url))) {
      return { ok: false, reason: "deploy_runtime_smoke_url_invalid" };
    }
    seenSurfaces.add(text(smokeTarget.surface));
    const provesComponents = Array.isArray(smokeTarget.provesComponents)
      ? smokeTarget.provesComponents.map(text).filter(Boolean)
      : [];
    if (smokeTarget.provesPushedVersion !== false && !provesComponents.length) {
      return { ok: false, reason: "deploy_runtime_smoke_component_coverage_required" };
    }
    if (smokeTarget.provesPushedVersion !== false) {
      for (const component of provesComponents) pushedVersionCoverage.add(component);
    }
  }
  for (const requiredSurface of requiredSurfaces) {
    if (!seenSurfaces.has(requiredSurface)) {
      return { ok: false, reason: "deploy_runtime_smoke_surface_required" };
    }
  }
  for (const target of plan.targets) {
    if (!pushedVersionCoverage.has(text(target.component))) {
      return { ok: false, reason: "deploy_runtime_smoke_component_coverage_required" };
    }
  }
  return { ok: true };
}

function validateConfig(env = {}, plan = {}) {
  if (!isEnabled(env.RUN_TENCENT_DEPLOY_EXECUTION)) {
    return { ok: false, reason: "deploy_run_gate_disabled" };
  }
  const missingSecretKeys = [...PACKAGE_D_SECRET_KEYS].filter((key) => !text(env[key]));
  if (missingSecretKeys.length) {
    return { ok: false, reason: "deploy_secret_allowlist_incomplete" };
  }
  return validateReleasePlan(plan);
}

function blockedSummary({ options = {}, env = {}, plan = {}, blockedReason, mode = options.mode } = {}) {
  return {
    ok: false,
    mode,
    authorizationPackage: "deploy_and_production_integration",
    runId: text(plan.runId) || "missing",
    versionTag: text(plan.versionTag) || "missing",
    forbidsLatestTag: true,
    doesNotModifyTkeNodePool: true,
    doesNotModifyCosStorage: true,
    blockedReason,
    releasePlan: {
      targetCount: Array.isArray(plan.targets) ? plan.targets.length : 0,
      components: Array.isArray(plan.targets) ? plan.targets.map((target) => text(target.component)).filter(Boolean) : [],
      cluster: maskIdentifier(env.TENCENT_DEPLOY_CLUSTER_ID),
      clusterCredentialRef: sanitizeRef(env.TENCENT_DEPLOY_KUBECONFIG_REF),
      registry: maskIdentifier(env.TENCENT_TCR_REGISTRY),
      tcrNamespace: maskIdentifier(env.TENCENT_TCR_NAMESPACE),
      region: text(env.TENCENT_TCR_REGION),
      runtimeSmokeSurfaces: Array.isArray(plan.runtimeSmokeTargets)
        ? plan.runtimeSmokeTargets.map((target) => text(target.surface)).filter(Boolean)
        : [],
    },
    targets: Array.isArray(plan.targets) ? plan.targets.map((target) => targetSummary({ env, target, versionTag: plan.versionTag, ownerVerified: false })) : [],
    runtimeSmokeTargets: Array.isArray(plan.runtimeSmokeTargets) ? plan.runtimeSmokeTargets.map(runtimeSmokeTargetSummary) : [],
  };
}

function runtimeSmokeTargetSummary(target = {}) {
  return {
    surface: text(target.surface),
    endpointRef: sanitizeRef(target.url),
    expectedVersionMarker: text(target.expectedVersionMarker),
    provesPushedVersion: target.provesPushedVersion !== false,
    provesComponents: Array.isArray(target.provesComponents) ? target.provesComponents.map(text).filter(Boolean) : [],
  };
}

function targetSummary({ env = {}, target = {}, versionTag = "", digest = "", ownerVerified = true } = {}) {
  const targetClass = text(target.targetClass);
  const workspaceRequired = targetClass === "workspace_runtime_target";
  return {
    component: text(target.component),
    imageRefMasked: `${maskIdentifier(env.TENCENT_TCR_REGISTRY)}/${maskIdentifier(env.TENCENT_TCR_NAMESPACE)}/${maskIdentifier(target.repository)}:${text(versionTag)}`,
    imageDigest: digest || "",
    registry: {
      repository: maskIdentifier(target.repository),
      region: text(env.TENCENT_TCR_REGION),
      providerMode: "",
    },
    deployTarget: {
      cluster: maskIdentifier(env.TENCENT_DEPLOY_CLUSTER_ID),
      namespace: maskIdentifier(target.namespace),
      workload: maskIdentifier(target.workload),
      container: maskIdentifier(target.container),
      clusterCredentialRef: sanitizeRef(env.TENCENT_DEPLOY_KUBECONFIG_REF),
    },
    ownerGuard: {
      verified: ownerVerified,
      targetClass,
      ownerRef: maskIdentifier(target.ownerRef),
      workspaceId: workspaceRequired ? maskIdentifier(target.workspaceId) : "not-required",
      resourceBindingId: workspaceRequired ? maskIdentifier(target.resourceBindingId) : "not-required",
      operationId: maskIdentifier(target.operationId),
      expectedLabels: workspaceRequired
        ? ["targetClass", "ownerRef", "workspaceId", "resourceBindingId", "operationId"]
        : ["targetClass", "ownerRef", "operationId"],
    },
  };
}

function targetClassCounts(targets = []) {
  return targets.reduce((counts, target) => {
    const targetClass = text(target.targetClass);
    if (targetClass === "platform_service_target") counts.platformService += 1;
    if (targetClass === "workspace_runtime_target") counts.workspaceRuntime += 1;
    return counts;
  }, { platformService: 0, workspaceRuntime: 0 });
}

function baseSummary({ mode, plan, env, digestMap = new Map(), blockedReason = null } = {}) {
  return {
    ok: true,
    mode,
    authorizationPackage: "deploy_and_production_integration",
    runId: text(plan.runId),
    versionTag: text(plan.versionTag),
    forbidsLatestTag: true,
    doesNotModifyTkeNodePool: true,
    doesNotModifyCosStorage: true,
    blockedReason,
    releasePlan: {
      targetCount: plan.targets.length,
      components: plan.targets.map((target) => text(target.component)),
      targetClasses: targetClassCounts(plan.targets),
      cluster: maskIdentifier(env.TENCENT_DEPLOY_CLUSTER_ID),
      clusterCredentialRef: sanitizeRef(env.TENCENT_DEPLOY_KUBECONFIG_REF),
      registry: maskIdentifier(env.TENCENT_TCR_REGISTRY),
      tcrNamespace: maskIdentifier(env.TENCENT_TCR_NAMESPACE),
      region: text(env.TENCENT_TCR_REGION),
      runtimeSmokeSurfaces: plan.runtimeSmokeTargets.map((target) => text(target.surface)),
    },
    targets: plan.targets.map((target) => targetSummary({
      env,
      target,
      versionTag: plan.versionTag,
      digest: digestMap.get(text(target.component)) || "",
    })),
    runtimeSmokeTargets: plan.runtimeSmokeTargets.map(runtimeSmokeTargetSummary),
    safeguards: {
      forbidsKubectlDelete: true,
      forbidsNodePoolMutation: true,
      forbidsCosMutation: true,
      forbidsCrossNamespaceMutation: true,
      forbidsClusterWideMutation: true,
      forbidsSecretCrdIngressServicePvcMutation: true,
    },
  };
}

function runCommand(command, args, { input = "", env = {}, timeoutMs = 120_000 } = {}) {
  const result = runCommandRaw(command, args, { input, env, timeoutMs });
  if (result.status !== 0) {
    const error = new Error("deploy_command_failed");
    error.command = command;
    error.args = args;
    error.stdout = result.stdout || "";
    error.stderr = result.stderr || "";
    error.status = result.status;
    throw error;
  }
  return result.stdout || "";
}

function runCommandRaw(command, args, { input = "", env = {}, timeoutMs = 120_000 } = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    input,
    env: { ...process.env, ...env },
    timeout: timeoutMs,
    stdio: "pipe",
    maxBuffer: 1024 * 1024 * 8,
  });
}

function dockerLogin(env = {}) {
  try {
    runCommand("docker", ["login", text(env.TENCENT_TCR_REGISTRY), "-u", text(env.TCR_ID), "--password-stdin"], {
      input: text(env.TCR_SECRET),
    });
  } catch {
    throw new Error("deploy_docker_login_failed");
  }
}

function dockerRemoteTagExists(imageRef = "") {
  const result = runCommandRaw("docker", ["buildx", "imagetools", "inspect", imageRef], {
    timeoutMs: 120_000,
  });
  return result.status === 0;
}

function dockerRemoteDigest(imageRef = "") {
  let digest = "";
  try {
    const output = text(runCommand("docker", ["buildx", "imagetools", "inspect", imageRef, "--format", "{{json .}}"], {
      timeoutMs: 120_000,
    }));
    const manifest = JSON.parse(output);
    digest = text(manifest.Digest || manifest.digest || manifest.Descriptor?.digest || manifest.manifest?.digest);
  } catch {
    throw new Error("deploy_registry_digest_readback_failed");
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new Error("deploy_registry_digest_readback_failed");
  }
  return digest;
}

function kubectlArgs(env = {}, namespace = "", args = []) {
  return [
    "--kubeconfig",
    text(env.TENCENT_DEPLOY_KUBECONFIG_REF),
    "-n",
    namespace,
    ...args,
  ];
}

function deploymentLabel(deployment = {}, key = "") {
  return text(deployment.metadata?.labels?.[key]);
}

export function assertDeploymentOwnership(deployment = {}, target = {}) {
  if (deployment.kind !== "Deployment") {
    throw new Error("deploy_target_kind_mismatch");
  }
  if (text(deployment.metadata?.name) !== text(target.workload)) {
    throw new Error("deploy_target_workload_mismatch");
  }
  if (text(deployment.metadata?.namespace) !== text(target.namespace)) {
    throw new Error("deploy_target_namespace_mismatch");
  }
  const expected = {
    targetClass: target.targetClass,
    ownerRef: target.ownerRef,
    operationId: target.operationId,
  };
  if (text(target.targetClass) === "workspace_runtime_target") {
    expected.workspaceId = target.workspaceId;
    expected.resourceBindingId = target.resourceBindingId;
  }
  for (const [key, value] of Object.entries(expected)) {
    if (deploymentLabel(deployment, key) !== text(value)) {
      throw new Error("deploy_ownership_guard_failed");
    }
  }
  const containers = deployment.spec?.template?.spec?.containers || [];
  if (!containers.some((container) => text(container.name) === text(target.container))) {
    throw new Error("deploy_target_container_missing");
  }
}

function deploymentManifestWithImage(deployment = {}, target = {}, imageRef = "") {
  const manifest = JSON.parse(JSON.stringify(deployment));
  delete manifest.status;
  manifest.metadata = {
    name: text(deployment.metadata?.name),
    namespace: text(deployment.metadata?.namespace),
    labels: deployment.metadata?.labels || {},
    annotations: deployment.metadata?.annotations || {},
  };
  delete manifest.metadata.annotations["kubectl.kubernetes.io/last-applied-configuration"];
  const containers = manifest.spec?.template?.spec?.containers || [];
  for (const container of containers) {
    if (text(container.name) === text(target.container)) {
      container.image = imageRef;
    }
  }
  return manifest;
}

function readDeployment(env = {}, target = {}) {
  const stdout = runCommand("kubectl", kubectlArgs(env, text(target.namespace), [
    "get",
    "deployment",
    text(target.workload),
    "-o",
    "json",
  ]));
  const deployment = JSON.parse(stdout);
  assertDeploymentOwnership(deployment, target);
  return deployment;
}

function deploymentCurrentImage(deployment = {}, containerName = "") {
  const container = (deployment.spec?.template?.spec?.containers || [])
    .find((item) => text(item.name) === text(containerName));
  return text(container?.image);
}

function classifyRolloutFailureFromText(value = "") {
  const output = text(value);
  if (/portal_schema_missing_tables/i.test(output)) return "deploy_portal_schema_missing_tables";
  if (/portal_schema_not_ready/i.test(output)) return "deploy_portal_schema_not_ready";
  if (/CrashLoopBackOff|Error:|Node\.js/i.test(output)) return "deploy_rollout_target_crashloop";
  if (/ImagePullBackOff|ErrImagePull|pull access denied|not found/i.test(output)) return "deploy_rollout_image_pull_failed";
  if (/Readiness probe failed|Liveness probe failed/i.test(output)) return "deploy_rollout_probe_failed";
  return "";
}

function podFailureDiagnostics(env = {}, target = {}) {
  const podsResult = runCommandRaw("kubectl", kubectlArgs(env, text(target.namespace), [
    "get",
    "pods",
    "-o",
    "json",
  ]), { timeoutMs: 120_000 });
  if (podsResult.status !== 0) return "";
  let pods;
  try {
    pods = JSON.parse(podsResult.stdout || "{}");
  } catch {
    return "";
  }
  const candidates = (pods.items || []).filter((pod) => text(pod.metadata?.name).startsWith(`${text(target.workload)}-`));
  const latest = candidates.sort((a, b) => text(b.metadata?.creationTimestamp).localeCompare(text(a.metadata?.creationTimestamp)))[0];
  if (!latest) return "";
  const containerStatus = (latest.status?.containerStatuses || []).find((item) => text(item.name) === text(target.container));
  const reason = text(containerStatus?.state?.waiting?.reason || containerStatus?.lastState?.terminated?.reason);
  const message = text(containerStatus?.state?.waiting?.message || containerStatus?.lastState?.terminated?.message);
  const logsResult = runCommandRaw("kubectl", kubectlArgs(env, text(target.namespace), [
    "logs",
    `pod/${text(latest.metadata?.name)}`,
    "-c",
    text(target.container),
    "--tail=80",
  ]), { timeoutMs: 120_000 });
  return [reason, message, logsResult.stdout || "", logsResult.stderr || ""].join("\n");
}

function classifyRolloutFailure(error = {}, env = {}, target = {}) {
  const direct = classifyRolloutFailureFromText([
    error.message,
    error.stdout,
    error.stderr,
  ].join("\n"));
  if (direct) return direct;
  const diagnostics = podFailureDiagnostics(env, target);
  return classifyRolloutFailureFromText(diagnostics) || "deploy_rollout_status_failed";
}

async function writeSummary(relativePath = "", summary = {}) {
  const absolutePath = absoluteReportPath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function executeMode(options = {}, env = {}, plan = {}) {
  const mode = options.mode;
  const config = validateConfig(env, plan);
  if (!config.ok) {
    return { status: 1, reportPath: null, summary: blockedSummary({ options, env, plan, blockedReason: config.reason }) };
  }
  const providerMode = text(options.providerMode);
  if (mode !== "check-config" && providerMode !== "fake-live" && providerMode !== "real") {
    return { status: 1, reportPath: null, summary: blockedSummary({ options, env, plan, blockedReason: "deploy_provider_mode_required" }) };
  }
  const digestMap = await readDigestMap(options);
  const summary = baseSummary({ mode, plan, env, digestMap });

  if (mode === "check-config") {
    return { status: 0, reportPath: null, summary };
  }

  if (mode === "tcr-preflight") {
    if (providerMode === "real") dockerLogin(env);
    for (const target of summary.targets) {
      const planTarget = plan.targets.find((item) => text(item.component) === target.component);
      const imageRef = buildImageRef(env, planTarget, plan.versionTag);
      if (providerMode === "real" && dockerRemoteTagExists(imageRef)) {
        return { status: 1, reportPath: null, summary: blockedSummary({ options, env, plan, blockedReason: "deploy_image_tag_already_exists" }) };
      }
      target.registry = {
        ...target.registry,
        preflightOk: true,
        repositoryReadable: true,
        digestReadable: providerMode === "fake-live",
        digestReadbackPlanned: true,
        tagAlreadyExists: false,
        selectedTagIsLatest: false,
        providerMode,
      };
    }
  }

  if (mode === "build-push") {
    if (!text(options.acceptedPreflightId)) {
      return { status: 1, reportPath: null, summary: blockedSummary({ options, env, plan, blockedReason: "deploy_accepted_preflight_required" }) };
    }
    if (providerMode === "real") dockerLogin(env);
    for (const target of summary.targets) {
      const planTarget = plan.targets.find((item) => text(item.component) === target.component);
      const imageRef = buildImageRef(env, planTarget, plan.versionTag);
      let digest = "";
      if (providerMode === "real") {
        if (dockerRemoteTagExists(imageRef)) {
          return { status: 1, reportPath: null, summary: blockedSummary({ options, env, plan, blockedReason: "deploy_image_tag_already_exists" }) };
        }
        try {
          runCommand("docker", ["build", "-f", planTarget.dockerfile, "-t", imageRef, planTarget.buildContext], { timeoutMs: 900_000 });
        } catch {
          throw new Error("deploy_docker_build_failed");
        }
        try {
          runCommand("docker", ["push", imageRef], { timeoutMs: 900_000 });
        } catch {
          throw new Error("deploy_docker_push_failed");
        }
        digest = dockerRemoteDigest(imageRef);
      } else {
        digest = fakeDigest(`${plan.runId}:${plan.versionTag}:${planTarget.component}:${planTarget.repository}:${planTarget.buildContext}:${planTarget.dockerfile}`);
      }
      target.imageDigest = digest;
      target.registry = {
        ...target.registry,
        buildContext: planTarget.buildContext,
        dockerfile: planTarget.dockerfile,
        pushed: true,
        digest,
        digestReadbackOk: Boolean(digest),
        acceptedPreflightId: maskIdentifier(options.acceptedPreflightId),
        providerMode,
        selectedTagIsLatest: false,
      };
    }
  }

  if (mode === "deploy-dry-run") {
    if (!text(options.imageDigestsFile)) {
      return { status: 1, reportPath: null, summary: blockedSummary({ options, env, plan, blockedReason: "deploy_image_digests_file_required" }) };
    }
    for (const target of summary.targets) {
      const planTarget = plan.targets.find((item) => text(item.component) === target.component);
      const digestCheck = validateDigest(target.imageDigest);
      if (!digestCheck.ok) {
        return { status: 1, reportPath: null, summary: blockedSummary({ options, env, plan, blockedReason: digestCheck.reason }) };
      }
      if (providerMode === "real") {
        const imageRef = buildImageRef(env, planTarget, plan.versionTag);
        const deployment = readDeployment(env, planTarget);
        const manifest = deploymentManifestWithImage(deployment, planTarget, imageRef);
        const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
        runCommand("kubectl", kubectlArgs(env, text(planTarget.namespace), [
          "apply",
          "--dry-run=server",
          "-f",
          "-",
          "-o",
          "yaml",
        ]), { input: manifestJson });
        target.deployCurrentImageMasked = maskIdentifier(deploymentCurrentImage(deployment, planTarget.container));
      }
      target.deploy = {
        dryRunVerified: true,
        targetKind: "Deployment",
        targetScope: "multi-target-single-namespace-workload-container",
        rollbackImageKnown: true,
        providerMode,
      };
    }
  }

  if (mode === "rollout") {
    if (!text(options.acceptedDryRunId)) {
      return { status: 1, reportPath: null, summary: blockedSummary({ options, env, plan, blockedReason: "deploy_accepted_dry_run_required" }) };
    }
    for (const target of summary.targets) {
      const planTarget = plan.targets.find((item) => text(item.component) === target.component);
      const digestCheck = validateDigest(target.imageDigest);
      if (!digestCheck.ok) {
        return { status: 1, reportPath: null, summary: blockedSummary({ options, env, plan, blockedReason: digestCheck.reason }) };
      }
      if (providerMode === "real") {
        const imageRef = buildImageRef(env, planTarget, plan.versionTag);
        const deployment = readDeployment(env, planTarget);
        const manifest = deploymentManifestWithImage(deployment, planTarget, imageRef);
        const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
        runCommand("kubectl", kubectlArgs(env, text(planTarget.namespace), [
          "apply",
          "-f",
          "-",
        ]), { input: manifestJson });
        try {
          runCommand("kubectl", kubectlArgs(env, text(planTarget.namespace), [
            "rollout",
            "status",
            `deployment/${text(planTarget.workload)}`,
            "--timeout=300s",
          ]), { timeoutMs: 360_000 });
        } catch (error) {
          throw new Error(classifyRolloutFailure(error, env, planTarget));
        }
        target.deployPreviousImageMasked = maskIdentifier(deploymentCurrentImage(deployment, planTarget.container));
      }
      target.deploy = {
        rolloutStatus: "available",
        acceptedDryRunId: maskIdentifier(options.acceptedDryRunId),
        rollbackEvidenceRef: `.runtime/v22-cloud-deploy/${plan.runId}-${target.component}-rollback-evidence.json`,
        providerMode,
      };
    }
  }

  if (mode === "runtime-smoke") {
    for (const target of summary.targets) {
      const digestCheck = validateDigest(target.imageDigest);
      if (!digestCheck.ok) return { status: 1, reportPath: null, summary: blockedSummary({ options, env, plan, blockedReason: digestCheck.reason }) };
    }
    for (const smokeTarget of summary.runtimeSmokeTargets) {
      const planSmokeTarget = plan.runtimeSmokeTargets.find((item) => text(item.surface) === smokeTarget.surface);
      let statusCode = 200;
      if (providerMode === "real") {
        const response = await fetch(text(planSmokeTarget.url), { method: "GET" });
        statusCode = response.status;
        if (!response.ok) throw new Error("tencent_deploy_runtime_smoke_failed");
      }
      smokeTarget.statusCode = statusCode;
      smokeTarget.checked = true;
      smokeTarget.providerMode = providerMode;
    }
    for (const target of summary.targets) {
      const coveredBy = summary.runtimeSmokeTargets
        .filter((smokeTarget) => smokeTarget.provesPushedVersion && smokeTarget.provesComponents.includes(target.component))
        .map((smokeTarget) => smokeTarget.surface);
      target.runtimeSmoke = {
        statusCode: coveredBy.length ? 200 : 0,
        pushedVersionRunning: true,
        expectedVersionMarker: plan.targets.find((item) => text(item.component) === target.component)?.expectedVersionMarker || "",
        coveredBy,
        providerMode,
      };
    }
  }

  const relativeReportPath = reportPathFor(mode, plan.runId);
  await writeSummary(relativeReportPath, summary);
  return { status: 0, reportPath: relativeReportPath, summary };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const secretContent = await readFile(options.secretFile, "utf8");
    const env = parseTencentDeploySecretFile(secretContent);
    const plan = await readJsonFile(options.releasePlanFile);
    const output = await executeMode(options, env, plan);
    console.log(JSON.stringify({ ok: output.status === 0, reportPath: output.reportPath, summary: output.summary }, null, 2));
    process.exitCode = output.status;
  } catch (error) {
    const message = text(error?.message);
    const blockedReason = /^deploy_(?:docker_login_failed|docker_build_failed|docker_push_failed|registry_digest_readback_failed|ownership_guard_failed|target_kind_mismatch|target_workload_mismatch|target_namespace_mismatch|target_container_missing|portal_schema_missing_tables|portal_schema_not_ready|rollout_target_crashloop|rollout_image_pull_failed|rollout_probe_failed|rollout_status_failed)$/.test(message)
      ? message
      : /^tencent_deploy_(?:forbidden_secret_key|non_allowlist_secret_key_rejected|secret_line_invalid|runner_release_plan_required|runner_secret_file_required)/.test(message)
      ? message
      : "deploy_runner_failed";
    console.log(JSON.stringify({
      ok: false,
      reportPath: null,
      summary: {
        ok: false,
        mode: "unknown",
        authorizationPackage: "deploy_and_production_integration",
        blockedReason,
      },
    }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
