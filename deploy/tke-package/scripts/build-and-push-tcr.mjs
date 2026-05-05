#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const defaultRepoRoot = path.resolve(packageRoot, "../..");

export const DEFAULT_TAG = "opl-v20.31";
export const DEFAULT_REGISTRY_NAMESPACE = "uswccr.ccs.tencentyun.com/gaofenglab";
export const DEFAULT_USERNAME = "100047070895";
export const DEFAULT_MANIFEST_TEMPLATE_DIR = "deploy/tke-package/manifests";
export const DEFAULT_ENV_FILE = "deploy/tke-package/env/tke.env";
export const DEFAULT_RENDER_PLAN_DIR = "deploy/tke-package/rendered-v20.31-plan";

export const REQUIRED_SYNC_SOURCES = Object.freeze([
  "services/portal",
  "services/opl-runtime-bridge",
  "services/opl-web-gateway",
  "adapters/resource-provisioner",
  "adapters/med-autoscience-runner",
  "adapters/shared",
  "adapters/billing-aggregator",
  "infra/kubernetes",
  "scripts",
  ".runtime/one-person-lab-upstream",
]);

export const REQUIRED_BUILD_IMAGE_KEYS = Object.freeze([
  "portal",
  "portal-opl-adapter",
  "opl-web-gateway",
  "billing-aggregator",
  "resource-provisioner",
  "med-autoscience-runner-orchestrator",
]);

export const SYNC_EXCLUDED_BASENAMES = Object.freeze([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "coverage",
  ".cache",
]);

const BUILD_IMAGE_SPECS = Object.freeze([
  {
    key: "portal",
    imageName: "portal-opl",
    dockerfile: "deploy/tke-package/build/dockerfiles/portal.Dockerfile",
    buildContext: "deploy/tke-package",
  },
  {
    key: "portal-opl-adapter",
    imageName: "portal-opl-adapter-opl",
    dockerfile: "deploy/tke-package/build/dockerfiles/opl-runtime-bridge.Dockerfile",
    buildContext: "deploy/tke-package",
  },
  {
    key: "opl-web-gateway",
    imageName: "opl-web-gateway-opl",
    dockerfile: "deploy/tke-package/build/dockerfiles/opl-web-gateway.Dockerfile",
    buildContext: "deploy/tke-package",
  },
  {
    key: "billing-aggregator",
    imageName: "billing-aggregator-opl",
    dockerfile: "deploy/tke-package/build/dockerfiles/billing-aggregator.Dockerfile",
    buildContext: "deploy/tke-package",
  },
  {
    key: "resource-provisioner",
    imageName: "resource-provisioner-opl",
    dockerfile: "deploy/tke-package/build/dockerfiles/resource-provisioner.Dockerfile",
    buildContext: "deploy/tke-package",
  },
  {
    key: "med-autoscience-runner-orchestrator",
    imageName: "med-autoscience-runner-orchestrator-opl",
    dockerfile: "deploy/tke-package/build/dockerfiles/med-autoscience-runner-orchestrator.Dockerfile",
    buildContext: "deploy/tke-package",
  },
]);

const MANIFEST_IMAGE_VAR_KEYS = Object.freeze([
  "PORTAL_IMAGE",
  "OPL_ADAPTER_IMAGE",
  "OPL_WEB_GATEWAY_IMAGE",
  "OPL_WEB_IMAGE",
  "BILLING_IMAGE",
  "RESOURCE_PROVISIONER_IMAGE",
  "RUNNER_ORCHESTRATOR_IMAGE",
  "MED_AUTOSCIENCE_RUNNER_IMAGE",
]);

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

export function parseEnvContent(source) {
  const vars = {};
  for (const rawLine of stripBom(source).split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    if (key) vars[key] = value;
  }
  return vars;
}

function parseBooleanFlag(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return value === "1" || value === "true";
}

function normalizeKey(token) {
  return token
    .replace(/^-+/, "")
    .split("-")
    .map((part, index) => (index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join("");
}

export function parseArgs(argv = process.argv.slice(2)) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("-")) continue;
    const key = normalizeKey(token);
    const next = argv[index + 1];
    if (!next || next.startsWith("-")) {
      parsed[key] = "1";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function absoluteFromRepoRoot(repoRoot, value) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(repoRoot, value);
}

function readGitTrackedPaths(repoRoot) {
  try {
    const output = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" });
    return new Set(output.split("\0").filter(Boolean).map((entry) => path.resolve(repoRoot, entry)));
  } catch {
    return new Set();
  }
}

function isGitTracked(repoRoot, absolutePath, trackedPaths = readGitTrackedPaths(repoRoot)) {
  return trackedPaths.has(path.resolve(absolutePath));
}

function isExampleEnvFile(absolutePath) {
  return /\.example(?:\.[^.]+)?$/i.test(path.basename(absolutePath));
}

function listYamlFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return listYamlFiles(file);
    return entry.isFile() && /\.ya?ml$/i.test(entry.name) ? [file] : [];
  });
}

function resolveBuildTime() {
  return new Date().toISOString();
}

function sanitizeForShell(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildImageRef(registryNamespace, imageName, tag) {
  return `${registryNamespace}/${imageName}:${tag}`;
}

function collectMissingPaths(entries) {
  return entries.filter((entry) => !existsSync(entry.absolutePath));
}

function resolveTrackedEnvPolicy({ repoRoot, envFile, allowTrackedEnv, trackedPaths }) {
  const absolutePath = absoluteFromRepoRoot(repoRoot, envFile);
  const tracked = isGitTracked(repoRoot, absolutePath, trackedPaths);
  const example = isExampleEnvFile(absolutePath);
  const allowed = !tracked || example || allowTrackedEnv;
  return {
    path: absolutePath,
    isTracked: tracked,
    isExample: example,
    allowTrackedEnv,
    allowed,
  };
}

function readEnvVars(envFilePath) {
  if (!existsSync(envFilePath)) {
    throw new Error(`Env file not found: ${envFilePath}`);
  }
  return parseEnvContent(readFileSync(envFilePath, "utf8"));
}

function resolveManifestOutDir(repoRoot, args) {
  return absoluteFromRepoRoot(repoRoot, args.manifestOutDir || DEFAULT_RENDER_PLAN_DIR);
}

function buildSyncOperations(repoRoot, oplRuntimeSourcePath = path.resolve(repoRoot, ".runtime/one-person-lab-upstream")) {
  return REQUIRED_SYNC_SOURCES.map((relative) => ({
    source: relative === ".runtime/one-person-lab-upstream"
      ? path.resolve(oplRuntimeSourcePath)
      : path.resolve(repoRoot, relative),
    target: path.resolve(repoRoot, "deploy/tke-package/source", relative),
    mode: "cpSync",
    excludeBasenames: [...SYNC_EXCLUDED_BASENAMES],
  }));
}

function resolveOplRuntime({ repoRoot, args }) {
  const sourcePath = absoluteFromRepoRoot(
    repoRoot,
    args.oplRuntimeSource || ".runtime/one-person-lab-upstream",
  );
  return {
    sourcePath,
    exists: existsSync(sourcePath),
  };
}

function resolveBuildImages({ repoRoot, registryNamespace, tag, buildSha, buildTime }) {
  return Object.fromEntries(
    BUILD_IMAGE_SPECS.map((spec) => {
      const dockerfile = absoluteFromRepoRoot(repoRoot, spec.dockerfile);
      const buildContext = absoluteFromRepoRoot(repoRoot, spec.buildContext);
      return [
        spec.key,
        {
          ...spec,
          dockerfile,
          buildContext,
          tag,
          image: buildImageRef(registryNamespace, spec.imageName, tag),
          buildArgs: {
            BUILD_SHA: buildSha,
            BUILD_TIME: buildTime,
          },
        },
      ];
    }),
  );
}

function resolveOplWeb({ repoRoot, args, registryNamespace, tag }) {
  const sourcePath = absoluteFromRepoRoot(
    repoRoot,
    args.oplWebSource || args.oplRuntimeSource || ".runtime/one-person-lab-upstream",
  );
  const dockerfile = absoluteFromRepoRoot(
    repoRoot,
    args.oplWebDockerfile || "deploy/tke-package/build/dockerfiles/opl-web-upstream.local-node.Dockerfile",
  );
  return {
    sourcePath,
    dockerfile,
    exists: existsSync(sourcePath),
    dockerfileExists: existsSync(dockerfile),
    requiredFiles: [
      "package.json",
      "bun.lock",
      "scripts/build-server.mjs",
    ].map((relative) => ({
      relative,
      absolutePath: path.join(sourcePath, relative),
      exists: existsSync(path.join(sourcePath, relative)),
    })),
    requiredDirs: [
      "patches",
    ].map((relative) => ({
      relative,
      absolutePath: path.join(sourcePath, relative),
      exists: existsSync(path.join(sourcePath, relative)),
    })),
    image: buildImageRef(registryNamespace, "opl-web-opl", tag),
    tag,
  };
}

function resolveRunnerWorkload({ repoRoot, args, registryNamespace, tag }) {
  const explicitImage = args.runnerWorkloadImage;
  const explicitDockerfile = args.runnerWorkloadDockerfile;
  const explicitRepo = args.runnerWorkloadImageRepo;
  if (explicitImage) {
    return {
      source: { type: "image" },
      image: explicitImage,
      tag,
      dockerfile: null,
      buildContext: null,
    };
  }
  if (explicitDockerfile) {
    return {
      source: { type: "dockerfile" },
      image: buildImageRef(
        registryNamespace,
        explicitRepo ? explicitRepo.replace(`${registryNamespace}/`, "") : "med-autoscience-runner-opl",
        tag,
      ),
      tag,
      dockerfile: absoluteFromRepoRoot(repoRoot, explicitDockerfile),
      buildContext: absoluteFromRepoRoot(repoRoot, path.dirname(explicitDockerfile)),
    };
  }
  return {
    source: { type: "missing" },
    image: null,
    tag,
    dockerfile: null,
    buildContext: null,
  };
}

function resolveLogin({ args, env, registryNamespace }) {
  const skipLogin = parseBooleanFlag(args.skipLogin, false);
  const passwordProvided = typeof env.TCR_PASSWORD === "string" && env.TCR_PASSWORD.length > 0;
  return {
    required: !skipLogin,
    skipLogin,
    passwordProvided,
    registryHost: registryNamespace.split("/")[0],
  };
}

function loadManifestTemplateStats(templateDir) {
  if (!existsSync(templateDir)) return [];
  return listYamlFiles(templateDir);
}

function resolveManifestPlan({
  repoRoot,
  manifestOutDir,
  manifestTemplateDir,
  envVars,
  trackedPaths,
  buildSha,
  buildTime,
  imageMap,
  runnerWorkloadImage,
}) {
  const outDirTracked = isGitTracked(repoRoot, manifestOutDir, trackedPaths);
  const renderedVars = {
    ...envVars,
    BUILD_SHA: buildSha,
    BUILD_TIME: buildTime,
    PRODUCT_RUNTIME_MODE: envVars.PRODUCT_RUNTIME_MODE || "user_owned",
    PRODUCT_OPS_PROFILE: envVars.PRODUCT_OPS_PROFILE || "0",
    PORTAL_IMAGE: imageMap.portal,
    OPL_ADAPTER_IMAGE: imageMap["portal-opl-adapter"],
    OPL_WEB_GATEWAY_IMAGE: imageMap["opl-web-gateway"],
    OPL_WEB_IMAGE: imageMap["opl-web-upstream"],
    BILLING_IMAGE: imageMap["billing-aggregator"],
    RESOURCE_PROVISIONER_IMAGE: imageMap["resource-provisioner"],
    RUNNER_ORCHESTRATOR_IMAGE: imageMap["med-autoscience-runner-orchestrator"],
    MED_AUTOSCIENCE_RUNNER_IMAGE: runnerWorkloadImage,
  };
  const allImagesUseReleaseTag = MANIFEST_IMAGE_VAR_KEYS.every((key) =>
    String(renderedVars[key] || "").endsWith(`:${buildSha}`),
  );
  return {
    templateDir: manifestTemplateDir,
    outDir: manifestOutDir,
    outDirTracked,
    templateFiles: loadManifestTemplateStats(manifestTemplateDir),
    buildSha,
    buildTime,
    vars: renderedVars,
    allImagesUseReleaseTag,
  };
}

function relativeToRepo(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath) || ".";
}

function appendValidationError(errors, condition, message) {
  if (condition) errors.push(message);
}

export function resolvePlan({ argv = [], repoRoot = defaultRepoRoot, env = process.env } = {}) {
  const args = parseArgs(argv);
  const trackedPaths = readGitTrackedPaths(repoRoot);
  const tag = args.tag || DEFAULT_TAG;
  const registryNamespace = args.registryNamespace || DEFAULT_REGISTRY_NAMESPACE;
  const username = args.username || DEFAULT_USERNAME;
  const buildSha = tag;
  const buildTime = args.buildTime || resolveBuildTime();
  const dryRun = parseBooleanFlag(args.dryRun, true);
  const syncSource = parseBooleanFlag(args.syncSource, false);
  const allowTrackedEnv = parseBooleanFlag(args.allowTrackedEnv, false);
  const envFile = args.envFile || DEFAULT_ENV_FILE;
  const manifestTemplateDir = absoluteFromRepoRoot(repoRoot, args.templateDir || DEFAULT_MANIFEST_TEMPLATE_DIR);
  const manifestOutDir = resolveManifestOutDir(repoRoot, args);
  const envPolicy = resolveTrackedEnvPolicy({ repoRoot, envFile, allowTrackedEnv, trackedPaths });
  const envVars = readEnvVars(envPolicy.path);
  const buildImages = resolveBuildImages({ repoRoot, registryNamespace, tag, buildSha, buildTime });
  const oplRuntime = resolveOplRuntime({ repoRoot, args });
  const oplWeb = resolveOplWeb({ repoRoot, args, registryNamespace, tag });
  const syncOperations = buildSyncOperations(repoRoot, oplRuntime.sourcePath);
  const runnerWorkload = resolveRunnerWorkload({ repoRoot, args, registryNamespace, tag });
  const login = resolveLogin({ args, env, registryNamespace });
  const imageMap = {
    portal: buildImages.portal.image,
    "portal-opl-adapter": buildImages["portal-opl-adapter"].image,
    "opl-web-gateway": buildImages["opl-web-gateway"].image,
    "opl-web-upstream": oplWeb.image,
    "billing-aggregator": buildImages["billing-aggregator"].image,
    "resource-provisioner": buildImages["resource-provisioner"].image,
    "med-autoscience-runner-orchestrator": buildImages["med-autoscience-runner-orchestrator"].image,
  };
  const manifest = resolveManifestPlan({
    repoRoot,
    manifestOutDir,
    manifestTemplateDir,
    envVars,
    trackedPaths,
    buildSha,
    buildTime,
    imageMap,
    runnerWorkloadImage: runnerWorkload.image,
  });

  const validationErrors = [];
  appendValidationError(
    validationErrors,
    envPolicy.isTracked && !envPolicy.isExample && !allowTrackedEnv,
    `Refusing git tracked env file: ${relativeToRepo(repoRoot, envPolicy.path)}. Pass --allow-tracked-env 1 only for local verification.`,
  );
  appendValidationError(
    validationErrors,
    path.resolve(envPolicy.path) === absoluteFromRepoRoot(repoRoot, DEFAULT_ENV_FILE) && !allowTrackedEnv,
    `Refusing git tracked env file policy for default secrets path: ${relativeToRepo(repoRoot, envPolicy.path)}.`,
  );
  appendValidationError(
    validationErrors,
    envPolicy.isTracked && !allowTrackedEnv,
    `Git tracked env file requires explicit --allow-tracked-env 1: ${relativeToRepo(repoRoot, envPolicy.path)}`,
  );
  appendValidationError(
    validationErrors,
    !oplRuntime.exists,
    `OPL runtime source must exist: ${relativeToRepo(repoRoot, oplRuntime.sourcePath)}`,
  );
  appendValidationError(
    validationErrors,
    !oplWeb.exists,
    `OPL web source must exist: ${relativeToRepo(repoRoot, oplWeb.sourcePath)}`,
  );
  for (const entry of oplWeb.requiredFiles) {
    validationErrors.push(
      ...collectMissingPaths([entry]).map(
        () => `OPL web source must contain ${entry.relative}: ${relativeToRepo(repoRoot, entry.absolutePath)}`,
      ),
    );
  }
  for (const entry of oplWeb.requiredDirs) {
    validationErrors.push(
      ...collectMissingPaths([entry]).map(
        () => `OPL web source must contain ${entry.relative}/: ${relativeToRepo(repoRoot, entry.absolutePath)}`,
      ),
    );
  }
  appendValidationError(
    validationErrors,
    !oplWeb.dockerfileExists,
    `OPL web Dockerfile must exist: ${relativeToRepo(repoRoot, oplWeb.dockerfile)}`,
  );
  appendValidationError(
    validationErrors,
    runnerWorkload.source.type === "missing",
    "Runner workload image requires explicit --runner-workload-image or --runner-workload-dockerfile with --runner-workload-image-repo; refusing implicit latest fallback.",
  );
  appendValidationError(
    validationErrors,
    runnerWorkload.source.type === "dockerfile" && !args.runnerWorkloadImageRepo,
    "Runner workload dockerfile mode requires --runner-workload-image-repo.",
  );
  appendValidationError(
    validationErrors,
    runnerWorkload.source.type === "dockerfile" && !existsSync(runnerWorkload.dockerfile),
    `Runner workload Dockerfile not found: ${runnerWorkload.dockerfile || "missing"}`,
  );
  appendValidationError(
    validationErrors,
    login.required && !login.passwordProvided,
    "docker login requires TCR_PASSWORD unless --skip-login 1 is set.",
  );
  appendValidationError(
    validationErrors,
    manifest.outDirTracked,
    `Manifest out dir must be untracked: ${relativeToRepo(repoRoot, manifest.outDir)}`,
  );
  appendValidationError(
    validationErrors,
    !manifest.allImagesUseReleaseTag,
    `Manifest render plan must point all image tags to ${tag}.`,
  );

  const missingSyncSources = collectMissingPaths(syncOperations.map((item) => ({ absolutePath: item.source })));
  for (const entry of missingSyncSources) {
    validationErrors.push(`Sync source missing: ${relativeToRepo(repoRoot, entry.absolutePath)}`);
  }

  return {
    repoRoot,
    releaseTag: tag,
    registryNamespace,
    username,
    options: {
      dryRun,
      syncSource,
      allowTrackedEnv,
      skipLogin: login.skipLogin,
    },
    envFile: envPolicy,
    sync: {
      enabled: syncSource,
      operations: syncOperations,
    },
    buildImages,
    oplRuntime,
    oplWeb,
    runnerWorkload,
    login,
    manifest,
    validationErrors,
    pushBlocked: validationErrors.length > 0,
  };
}

function renderDockerBuildCommand(imagePlan) {
  return [
    "docker build",
    `-f ${sanitizeForShell(imagePlan.dockerfile)}`,
    `--build-arg BUILD_SHA=${sanitizeForShell(imagePlan.buildArgs.BUILD_SHA)}`,
    `--build-arg BUILD_TIME=${sanitizeForShell(imagePlan.buildArgs.BUILD_TIME)}`,
    `-t ${sanitizeForShell(imagePlan.image)}`,
    sanitizeForShell(imagePlan.buildContext),
  ].join(" ");
}

function renderRunnerWorkloadCommand(plan) {
  if (plan.runnerWorkload.source.type === "image") {
    return `# push explicit runner workload image ${sanitizeForShell(plan.runnerWorkload.image)}`;
  }
  if (plan.runnerWorkload.source.type === "dockerfile") {
    return [
      "docker build",
      `-f ${sanitizeForShell(plan.runnerWorkload.dockerfile)}`,
      `--build-arg BUILD_SHA=${sanitizeForShell(plan.releaseTag)}`,
      `--build-arg BUILD_TIME=${sanitizeForShell(plan.manifest.buildTime)}`,
      `-t ${sanitizeForShell(plan.runnerWorkload.image)}`,
      sanitizeForShell(plan.runnerWorkload.buildContext),
    ].join(" ");
  }
  return "# runner workload blocked: explicit image or dockerfile required";
}

function renderManifestCommand(plan) {
  const command = [
    "node",
    sanitizeForShell(path.resolve(plan.repoRoot, "deploy/tke-package/scripts/render-tke-manifests.mjs")),
    `--env-file ${sanitizeForShell(plan.envFile.path)}`,
    `--template-dir ${sanitizeForShell(plan.manifest.templateDir)}`,
    `--out-dir ${sanitizeForShell(plan.manifest.outDir)}`,
  ];
  for (const key of ["BUILD_SHA", "BUILD_TIME", ...MANIFEST_IMAGE_VAR_KEYS]) {
    command.push(`--set ${sanitizeForShell(`${key}=${plan.manifest.vars[key]}`)}`);
  }
  return command.join(" ");
}

export function renderShellPlan(plan) {
  const lines = [];
  lines.push("set -euo pipefail");
  lines.push(`# release tag: ${plan.releaseTag}`);
  lines.push(`# dry-run: ${plan.options.dryRun ? "1" : "0"}`);
  lines.push(`# push blocked: ${plan.pushBlocked ? "1" : "0"}`);
  lines.push(`# env file: ${relativeToRepo(plan.repoRoot, plan.envFile.path)}`);
  if (plan.login.required) {
    lines.push(
      `echo '***' | docker login ${sanitizeForShell(plan.login.registryHost)} --username ${sanitizeForShell(plan.username)} --password-stdin`,
    );
  } else {
    lines.push("# docker login skipped by --skip-login 1");
  }
  lines.push(`# BUILD_SHA=${plan.manifest.buildSha}`);
  lines.push(`# BUILD_TIME=${plan.manifest.buildTime}`);
  if (plan.sync.enabled) {
    for (const operation of plan.sync.operations) {
      lines.push(
        `node -e ${sanitizeForShell(
          [
            `const fs = require("node:fs");`,
            `const path = require("node:path");`,
            `const excluded = new Set(${JSON.stringify(operation.excludeBasenames || [])});`,
            `fs.rmSync(${JSON.stringify(operation.target)}, { recursive: true, force: true });`,
            `fs.cpSync(${JSON.stringify(operation.source)}, ${JSON.stringify(operation.target)}, { recursive: true, force: true, filter: (src) => !excluded.has(path.basename(src)) });`,
          ].join(" "),
        )}`,
      );
    }
  } else {
    lines.push("# source sync disabled; pass --sync-source 1 to materialize deploy/tke-package/source");
    for (const operation of plan.sync.operations) {
      lines.push(`# sync ${relativeToRepo(plan.repoRoot, operation.source)} -> ${relativeToRepo(plan.repoRoot, operation.target)}`);
    }
  }
  for (const key of REQUIRED_BUILD_IMAGE_KEYS) {
    const imagePlan = plan.buildImages[key];
    lines.push(renderDockerBuildCommand(imagePlan));
    lines.push(`docker push ${sanitizeForShell(imagePlan.image)}`);
  }
  lines.push(
    [
      "docker build",
      `-f ${sanitizeForShell(plan.oplWeb.dockerfile)}`,
      `--build-arg BUILD_SHA=${sanitizeForShell(plan.manifest.buildSha)}`,
      `--build-arg BUILD_TIME=${sanitizeForShell(plan.manifest.buildTime)}`,
      `-t ${sanitizeForShell(plan.oplWeb.image)}`,
      sanitizeForShell(plan.oplWeb.sourcePath),
    ].join(" "),
  );
  lines.push(`docker push ${sanitizeForShell(plan.oplWeb.image)}`);
  lines.push(renderRunnerWorkloadCommand(plan));
  if (plan.runnerWorkload.image) {
    lines.push(`docker push ${sanitizeForShell(plan.runnerWorkload.image)}`);
  }
  lines.push(renderManifestCommand(plan));
  return `${lines.join("\n")}\n`;
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  try {
    const plan = resolvePlan({
      argv: process.argv.slice(2),
      repoRoot: process.cwd(),
    });
    const shellPlan = renderShellPlan(plan);
    process.stdout.write(shellPlan);
    if (plan.pushBlocked) {
      const scratch = mkdtempSync(path.join(tmpdir(), "tke-build-push-plan-"));
      process.stderr.write(`Blocked by validation errors. Scratch plan dir: ${scratch}\n`);
      for (const error of plan.validationErrors) {
        process.stderr.write(`- ${error}\n`);
      }
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
