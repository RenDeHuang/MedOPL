#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { redactionAudit } from "./package-d-kubernetes-api-preflight-runner.js";

export const PACKAGE_D_RUNNER_IMAGE_PUBLISH_WORKFLOW = ".github/workflows/package-d-runner-image-publish.yml";
export const PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND = "node tests/support/cloud-prework/package-d-runner-image-publish-runner.js --mode private-build-push --env /home/dev/.secrets/medopl/v22/package-d-deploy.env --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-runner-image-publish";
const FIXED_REGISTRY = "uswccr.ccs.tencentyun.com";
const FIXED_NAMESPACE = "medopl";
const FIXED_REGION = "na-siliconvalley";
const ALLOWED_REPOSITORY = "medopl-platform-runner";
const FIXED_TAG = "v22-package-d-20260615-001";
const FIXED_IMAGE_REF = `${FIXED_REGISTRY}/${FIXED_NAMESPACE}/${ALLOWED_REPOSITORY}:${FIXED_TAG}`;
const FIXED_PLATFORM = "linux/amd64";
const ALLOWED_PRIVATE_BUILD_ENV_KEYS = Object.freeze(["TCR_ID", "TCR_SECRET", "PACKAGE_D_RUNNER_IMAGE_REF"]);
const FORBIDDEN_PRIVATE_BUILD_ENV_KEYS = Object.freeze([
  "KUBECONFIG",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
  "PORTAL_POSTGRES_PASSWORD",
  "PORTAL_POSTGRES_URL",
  "PORTAL_ADMIN_PASSWORD",
  "PORTAL_ADMIN_EMAIL",
  "PORTAL_ADMIN_NAME",
  "TENCENT_SECRET_ID",
  "TENCENT_SECRET_KEY",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
]);
const FORBIDDEN_ARGS = Object.freeze(new Set([
  "--deploy",
  "--kubectl",
  "--tencent-mutation",
  "--package-c-live",
  "--pull",
  "--latest",
  "--delete",
  "--patch",
  "--scale",
  "--github-actions",
  "--gh-workflow",
]));

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`package_d_runner_image_publish_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`package_d_runner_image_publish_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`package_d_runner_image_publish_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("package_d_runner_image_publish_not_authorized");
}

function parseEnvText(source = "") {
  const parsed = {};
  for (const rawLine of String(source || "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) throw new Error("package_d_runner_image_publish_env_line_invalid");
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    if (!/^[A-Z0-9_]+$/u.test(key)) throw new Error(`package_d_runner_image_publish_env_key_invalid:${key}`);
    parsed[key] = value;
  }
  return parsed;
}

function assertPrivateBuildEnv(env = {}) {
  for (const forbidden of FORBIDDEN_PRIVATE_BUILD_ENV_KEYS) {
    if (Object.hasOwn(env, forbidden)) throw new Error(`package_d_runner_image_publish_forbidden_env_key:${forbidden}`);
  }
  const keys = Object.keys(env).sort();
  const allowed = [...ALLOWED_PRIVATE_BUILD_ENV_KEYS].sort();
  for (const key of keys) {
    if (!allowed.includes(key)) throw new Error(`package_d_runner_image_publish_non_allowlist_env_key:${key}`);
  }
  for (const key of ALLOWED_PRIVATE_BUILD_ENV_KEYS) {
    if (!text(env[key])) throw new Error(`package_d_runner_image_publish_required_env_missing:${key}`);
  }
  assertImageContract(env.PACKAGE_D_RUNNER_IMAGE_REF);
  return {
    TCR_ID: text(env.TCR_ID),
    TCR_SECRET: String(env.TCR_SECRET ?? ""),
    PACKAGE_D_RUNNER_IMAGE_REF: text(env.PACKAGE_D_RUNNER_IMAGE_REF),
  };
}

function parseImageRef(imageRef = "") {
  const value = text(imageRef);
  if (!value || /\s/u.test(value) || value.includes("://")) throw new Error("package_d_runner_image_ref_malformed");
  const slashParts = value.split("/");
  if (slashParts.length !== 3) throw new Error("package_d_runner_image_ref_malformed");
  const [registry, namespace, imageNameWithTag] = slashParts;
  const tagSeparator = imageNameWithTag.lastIndexOf(":");
  if (tagSeparator <= 0 || tagSeparator === imageNameWithTag.length - 1) {
    throw new Error("package_d_runner_image_ref_malformed");
  }
  const repository = imageNameWithTag.slice(0, tagSeparator);
  const tag = imageNameWithTag.slice(tagSeparator + 1);
  if (!repository || !tag) throw new Error("package_d_runner_image_ref_malformed");
  if (tag === "latest") throw new Error("package_d_runner_image_ref_latest_forbidden");
  return { value, registry, namespace, repository, tag };
}

function assertImageContract(imageRef = FIXED_IMAGE_REF) {
  const parsed = parseImageRef(imageRef);
  if (parsed.value !== FIXED_IMAGE_REF) throw new Error("package_d_runner_image_ref_not_fixed_package_d_runner_image");
  if (parsed.registry !== FIXED_REGISTRY) throw new Error("package_d_runner_image_ref_registry_mismatch");
  if (parsed.namespace !== FIXED_NAMESPACE) throw new Error("package_d_runner_image_ref_namespace_mismatch");
  if (parsed.repository !== ALLOWED_REPOSITORY) throw new Error("package_d_runner_image_ref_repository_not_allowlisted");
  if (parsed.tag !== FIXED_TAG) throw new Error("package_d_runner_image_ref_tag_mismatch");
  return parsed;
}

function dockerCommands() {
  return [
    ["docker", "login", FIXED_REGISTRY, "--username", "$TCR_ID", "--password-stdin"],
    ["docker", "buildx", "build", "--platform", FIXED_PLATFORM, "-f", "tests/support/cloud-prework/package-d-platform-runner.Dockerfile", "-t", FIXED_IMAGE_REF, "."],
    ["docker", "push", FIXED_IMAGE_REF],
  ];
}

function executionArgs(command, privateEnv) {
  if (command.kind !== "docker_login") return command.args;
  return command.args.map((arg) => (arg === "$TCR_ID" ? privateEnv.TCR_ID : arg));
}

function defaultDockerExecutor({ args, env, stdin = "" }) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    input: stdin,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || result.error?.message || "",
  };
}

async function writeEvidence({ evidenceDir, filename, payload }) {
  await mkdir(evidenceDir, { recursive: true });
  const target = path.join(evidenceDir, filename);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildPackageDRunnerImagePublishPlan({
  imageRef = FIXED_IMAGE_REF,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  deployEnvPath = "",
  deployEnvText = "",
  argv = [],
} = {}) {
  parseArgs(argv);
  const envText = deployEnvText || (deployEnvPath ? await readFile(deployEnvPath, "utf8") : "");
  const env = assertPrivateBuildEnv(parseEnvText(envText));
  const image = assertImageContract(imageRef);
  if (env.PACKAGE_D_RUNNER_IMAGE_REF !== image.value) throw new Error("package_d_runner_image_ref_env_mismatch");
  const commands = dockerCommands();
  return {
    ok: true,
    contract: "package_d_runner_image_publish_private_build_runner_boundary",
    route: "private_build_runner",
    mode: "private-build-push",
    command: PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
    target: {
      imagePublishBoundary: true,
      deployBoundary: false,
      tkeRunnerBuildBoundary: false,
      publicRepoStoresCodeOnly: true,
    },
    image: {
      ref: "redacted",
      registry: image.registry,
      namespace: image.namespace,
      repository: image.repository,
      tag: image.tag,
      platform: FIXED_PLATFORM,
      floatingTagAllowed: false,
    },
    privateBuildRunner: {
      secretSource: "package-d-deploy.env",
      allowedEnvKeys: [...ALLOWED_PRIVATE_BUILD_ENV_KEYS],
      forbiddenSecretClasses: ["kubeconfig", "DB password", "Portal admin password", "Tencent SecretId/SecretKey"],
      platform: FIXED_PLATFORM,
      holdsKubeconfig: false,
      holdsDbPassword: false,
      holdsPortalAdminPassword: false,
      holdsTencentMutationKeys: false,
    },
    githubActions: {
      status: "removed_from_current_live_path",
      currentLivePath: false,
      optionalFutureOnly: true,
    },
    commands: commands.map((args, index) => ({
      name: ["tcr_login", "runner_image_build", "runner_image_push"][index],
      kind: ["docker_login", "docker_build", "docker_push"][index],
      args,
    })),
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, "private-build-push-redacted.json"),
      dockerOutput: "redacted_private_build_runner_output",
    },
    boundary: {
      imagePublishAllowedAfterAuthorization: true,
      deployAllowed: false,
      clusterCommandAllowed: false,
      tkeRunnerDockerAllowed: false,
      implicitHostPlatformAllowed: false,
      publicGitHubSecretsAllowed: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      tenantPoolMutationAllowed: false,
      evidenceSink: ".runtime",
    },
    realExecutionReady: false,
  };
}

export async function runPackageDRunnerImagePublishPrivateBuild({
  imageRef = FIXED_IMAGE_REF,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  deployEnvPath = "",
  deployEnvText = "",
  authorized = false,
  docker = defaultDockerExecutor,
} = {}) {
  assertAuthorized(authorized);
  const plan = await buildPackageDRunnerImagePublishPlan({ imageRef, evidenceDir, deployEnvPath, deployEnvText });
  const envText = deployEnvText || (deployEnvPath ? await readFile(deployEnvPath, "utf8") : "");
  const privateEnv = assertPrivateBuildEnv(parseEnvText(envText));
  const results = [];
  for (const command of plan.commands) {
    const stdin = command.kind === "docker_login" ? privateEnv.TCR_SECRET : "";
    const result = await docker({ args: executionArgs(command, privateEnv), env: privateEnv, stdin });
    results.push({
      kind: command.kind,
      status: result.status,
      stdoutClass: result.stdout ? "present_redacted" : "empty",
      stderrClass: result.stderr ? "present_redacted" : "empty",
    });
    if (result.status !== 0) throw new Error(`package_d_runner_image_publish_private_build_failed:${command.kind}`);
  }
  const summary = {
    ok: true,
    contract: plan.contract,
    route: plan.route,
    mode: plan.mode,
    command: plan.command,
    imageRef: "redacted",
    privateBuild: results,
    target: plan.target,
    image: plan.image,
    privateBuildRunner: plan.privateBuildRunner,
    githubActions: plan.githubActions,
    boundary: plan.boundary,
    realExecutionReady: false,
  };
  const auditSource = JSON.stringify(summary);
  const audit = {
    ...redactionAudit(auditSource),
    tcrSecretValueExposed: false,
    fullImageRefExposed: auditSource.includes(FIXED_IMAGE_REF),
  };
  const evidenceWithAudit = { ...summary, redactionAudit: audit };
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_runner_image_publish_redaction_audit_failed");
  const evidencePath = await writeEvidence({
    evidenceDir,
    filename: "private-build-push-redacted.json",
    payload: evidenceWithAudit,
  });
  return { ...summary, evidencePath };
}

export const runPackageDRunnerImagePublishDispatch = runPackageDRunnerImagePublishPrivateBuild;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "plan") {
    const plan = await buildPackageDRunnerImagePublishPlan({
      imageRef: args["image-ref"] || FIXED_IMAGE_REF,
      evidenceDir: args["evidence-dir"] || DEFAULT_EVIDENCE_DIR,
      deployEnvPath: args.env || "",
    });
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  if (args.mode !== "private-build-push") throw new Error("package_d_runner_image_publish_mode_required");
  const summary = await runPackageDRunnerImagePublishPrivateBuild({
    imageRef: args["image-ref"] || FIXED_IMAGE_REF,
    evidenceDir: args["evidence-dir"] || DEFAULT_EVIDENCE_DIR,
    deployEnvPath: args.env || "",
    authorized: args.authorized === "1" || args.authorized === "true",
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
