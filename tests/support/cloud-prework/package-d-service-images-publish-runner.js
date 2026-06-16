#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { redactionAudit } from "./package-d-kubernetes-api-preflight-runner.js";

export const PACKAGE_D_SERVICE_IMAGES_PUBLISH_COMMAND = "node tests/support/cloud-prework/package-d-service-images-publish-runner.js --mode private-build-push --env /home/dev/.secrets/medopl/v22/package-d-service-images-publish.env --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-service-images-publish";
const FIXED_REGISTRY = "uswccr.ccs.tencentyun.com";
const FIXED_NAMESPACE = "medopl";
const FIXED_TAG = "v22-package-d-20260616-001";
const FIXED_PLATFORM = "linux/amd64";
const ALLOWED_PRIVATE_BUILD_ENV_KEYS = Object.freeze([
  "TCR_ID",
  "TCR_SECRET",
  "PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF",
  "PACKAGE_D_GO_BACKEND_IMAGE_REF",
  "PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF",
  "PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF",
]);
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
  "RUN_TENCENT_DEPLOY_EXECUTION",
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
const SERVICE_TARGETS = Object.freeze([
  Object.freeze({
    name: "portal-frontend",
    imageKey: "PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF",
    repository: "portal-frontend",
    context: "services/portal/frontend",
    dockerfile: "services/portal/frontend/Dockerfile",
    dockerignore: "services/portal/frontend/.dockerignore",
  }),
  Object.freeze({
    name: "medopl-go-backend",
    imageKey: "PACKAGE_D_GO_BACKEND_IMAGE_REF",
    repository: "medopl-go-backend",
    context: "services/medopl-go-backend",
    dockerfile: "services/medopl-go-backend/Dockerfile",
    dockerignore: "services/medopl-go-backend/.dockerignore",
  }),
  Object.freeze({
    name: "opl-web-gateway",
    imageKey: "PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF",
    repository: "opl-web-gateway",
    context: "services/opl-web-gateway",
    dockerfile: "services/opl-web-gateway/Dockerfile",
    dockerignore: "services/opl-web-gateway/.dockerignore",
  }),
  Object.freeze({
    name: "opl-runtime-bridge",
    imageKey: "PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF",
    repository: "opl-runtime-bridge",
    context: "services/opl-runtime-bridge",
    dockerfile: "services/opl-runtime-bridge/Dockerfile",
    dockerignore: "services/opl-runtime-bridge/.dockerignore",
  }),
]);

function text(value = "") {
  return String(value ?? "").trim();
}

function fixedImageRef(repository) {
  return `${FIXED_REGISTRY}/${FIXED_NAMESPACE}/${repository}:${FIXED_TAG}`;
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`package_d_service_images_publish_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`package_d_service_images_publish_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`package_d_service_images_publish_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("package_d_service_images_publish_not_authorized");
}

function parseEnvText(source = "") {
  const parsed = {};
  const duplicates = [];
  for (const rawLine of String(source || "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separator = normalized.indexOf("=");
    if (separator <= 0) throw new Error("package_d_service_images_publish_env_line_invalid");
    const key = normalized.slice(0, separator).trim();
    const value = normalized.slice(separator + 1);
    if (!/^[A-Z0-9_]+$/u.test(key)) throw new Error(`package_d_service_images_publish_env_key_invalid:${key}`);
    if (Object.hasOwn(parsed, key)) duplicates.push(key);
    parsed[key] = value;
  }
  if (duplicates.length > 0) throw new Error(`package_d_service_images_publish_env_duplicate_key:${duplicates.sort().join(",")}`);
  return parsed;
}

function parseImageRef(imageRef = "") {
  const value = text(imageRef);
  if (!value || /\s/u.test(value) || value.includes("://")) throw new Error("package_d_service_image_ref_malformed");
  const slashParts = value.split("/");
  if (slashParts.length !== 3) throw new Error("package_d_service_image_ref_malformed");
  const [registry, namespace, imageNameWithTag] = slashParts;
  const tagSeparator = imageNameWithTag.lastIndexOf(":");
  if (tagSeparator <= 0 || tagSeparator === imageNameWithTag.length - 1) {
    throw new Error("package_d_service_image_ref_malformed");
  }
  const repository = imageNameWithTag.slice(0, tagSeparator);
  const tag = imageNameWithTag.slice(tagSeparator + 1);
  if (!repository || !tag) throw new Error("package_d_service_image_ref_malformed");
  if (tag === "latest") throw new Error("package_d_service_image_ref_latest_forbidden");
  return { value, registry, namespace, repository, tag };
}

function assertImageContract({ imageRef, expectedRepository }) {
  const parsed = parseImageRef(imageRef);
  if (parsed.value !== fixedImageRef(expectedRepository)) throw new Error(`package_d_service_image_ref_not_fixed:${expectedRepository}`);
  if (parsed.registry !== FIXED_REGISTRY) throw new Error("package_d_service_image_ref_registry_mismatch");
  if (parsed.namespace !== FIXED_NAMESPACE) throw new Error("package_d_service_image_ref_namespace_mismatch");
  if (parsed.repository !== expectedRepository) throw new Error(`package_d_service_image_ref_repository_not_allowlisted:${expectedRepository}`);
  if (parsed.tag !== FIXED_TAG) throw new Error(`package_d_service_image_ref_tag_mismatch:${expectedRepository}`);
  return parsed;
}

function assertPrivateBuildEnv(env = {}) {
  for (const forbidden of FORBIDDEN_PRIVATE_BUILD_ENV_KEYS) {
    if (Object.hasOwn(env, forbidden)) throw new Error(`package_d_service_images_publish_forbidden_env_key:${forbidden}`);
  }
  const allowed = [...ALLOWED_PRIVATE_BUILD_ENV_KEYS].sort();
  for (const key of Object.keys(env).sort()) {
    if (!allowed.includes(key)) throw new Error(`package_d_service_images_publish_non_allowlist_env_key:${key}`);
  }
  for (const key of ALLOWED_PRIVATE_BUILD_ENV_KEYS) {
    if (!text(env[key])) throw new Error(`package_d_service_images_publish_required_env_missing:${key}`);
  }
  for (const service of SERVICE_TARGETS) {
    assertImageContract({ imageRef: env[service.imageKey], expectedRepository: service.repository });
  }
  return Object.fromEntries(ALLOWED_PRIVATE_BUILD_ENV_KEYS.map((key) => [key, key === "TCR_SECRET" ? String(env[key] ?? "") : text(env[key])]));
}

function dockerCommands(services = SERVICE_TARGETS) {
  return [
    {
      name: "tcr_login",
      kind: "docker_login",
      args: ["docker", "login", FIXED_REGISTRY, "--username", "$TCR_ID", "--password-stdin"],
    },
    ...services.flatMap((service) => [
      {
        name: `build_${service.name.replaceAll("-", "_")}`,
        kind: "docker_build",
        service: service.name,
        args: [
          "docker",
          "buildx",
          "build",
          "--platform",
          FIXED_PLATFORM,
          "-f",
          service.dockerfile,
          "-t",
          fixedImageRef(service.repository),
          service.context,
        ],
      },
      {
        name: `push_${service.name.replaceAll("-", "_")}`,
        kind: "docker_push",
        service: service.name,
        args: ["docker", "push", fixedImageRef(service.repository)],
      },
    ]),
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

function serviceReadiness(service, fileExists = existsSync) {
  const contextPresent = fileExists(service.context);
  const dockerfilePresent = fileExists(service.dockerfile);
  const dockerignorePresent = fileExists(service.dockerignore);
  return { contextPresent, dockerfilePresent, dockerignorePresent };
}

function redactedService(service, privateEnv, fileExists = existsSync) {
  const image = assertImageContract({
    imageRef: privateEnv[service.imageKey],
    expectedRepository: service.repository,
  });
  const readiness = serviceReadiness(service, fileExists);
  return {
    name: service.name,
    imageKey: service.imageKey,
    repository: service.repository,
    context: service.context,
    dockerfile: {
      path: service.dockerfile,
      present: readiness.dockerfilePresent,
    },
    dockerignore: {
      path: service.dockerignore,
      present: readiness.dockerignorePresent,
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
    buildContext: {
      path: service.context,
      present: readiness.contextPresent,
    },
  };
}

function readinessForServices(services = []) {
  const missingDockerfiles = services.filter((service) => !service.dockerfile.present).map((service) => service.dockerfile.path);
  const missingDockerignores = services.filter((service) => !service.dockerignore.present).map((service) => service.dockerignore.path);
  const missingContexts = services.filter((service) => !service.buildContext.present).map((service) => service.context);
  return {
    ready: missingDockerfiles.length === 0 && missingDockerignores.length === 0 && missingContexts.length === 0,
    missingDockerfiles,
    missingDockerignores,
    missingContexts,
    nextGap: missingDockerfiles.length > 0 || missingDockerignores.length > 0 || missingContexts.length > 0
      ? "package_d_service_dockerfile_build_context_materialization"
      : "package_d_service_images_private_build_push_authorization",
  };
}

async function writeEvidence({ evidenceDir, filename, payload }) {
  await mkdir(evidenceDir, { recursive: true });
  const target = path.join(evidenceDir, filename);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildPackageDServiceImagesPublishPlan({
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  envPath = "",
  envText = "",
  argv = [],
  fileExists = existsSync,
} = {}) {
  parseArgs(argv);
  const source = envText || (envPath ? await readFile(envPath, "utf8") : "");
  const privateEnv = assertPrivateBuildEnv(parseEnvText(source));
  const services = SERVICE_TARGETS.map((service) => redactedService(service, privateEnv, fileExists));
  const readiness = readinessForServices(services);
  const commands = dockerCommands();
  const plan = {
    ok: true,
    contract: "package_d_service_images_publish_private_build_runner_boundary",
    route: "private_build_runner",
    mode: "private-build-push",
    command: PACKAGE_D_SERVICE_IMAGES_PUBLISH_COMMAND,
    imagePublishBoundary: true,
    deployBoundary: false,
    target: {
      registry: FIXED_REGISTRY,
      namespace: FIXED_NAMESPACE,
      tag: FIXED_TAG,
      platform: FIXED_PLATFORM,
      publicRepoStoresCodeOnly: true,
      privateBuildRunnerHoldsTcrSecret: true,
      tkeVpcRunnerHoldsKubeconfigRuntimeSecretsOnly: true,
    },
    services,
    readiness,
    privateBuildRunner: {
      secretSource: "package-d-service-images-publish.env",
      allowedEnvKeys: [...ALLOWED_PRIVATE_BUILD_ENV_KEYS],
      forbiddenSecretClasses: ["kubeconfig", "DB password", "Portal admin password", "Tencent SecretId/SecretKey"],
      platform: FIXED_PLATFORM,
      holdsKubeconfig: false,
      holdsDbPassword: false,
      holdsPortalAdminPassword: false,
      holdsTencentMutationKeys: false,
    },
    commands,
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, "private-build-push-redacted.json"),
      dockerOutput: "redacted_private_build_runner_output",
    },
    boundary: {
      imagePublishAllowedAfterAuthorization: readiness.ready,
      deployAllowed: false,
      clusterCommandAllowed: false,
      tkeRunnerDockerAllowed: false,
      implicitHostPlatformAllowed: false,
      arbitraryImageRefAllowed: false,
      latestTagAllowed: false,
      nonMedoplNamespaceAllowed: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      tenantPoolMutationAllowed: false,
      evidenceSink: ".runtime",
    },
    realExecutionReady: false,
  };
  const audit = {
    ...redactionAudit(JSON.stringify(plan)),
    tcrSecretValueExposed: false,
    fixedImageRefInCommandPlanAllowed: false,
  };
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_service_images_publish_redaction_audit_failed");
  return plan;
}

export async function runPackageDServiceImagesPublishPrivateBuild({
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  envPath = "",
  envText = "",
  authorized = false,
  docker = defaultDockerExecutor,
  fileExists = existsSync,
} = {}) {
  assertAuthorized(authorized);
  const plan = await buildPackageDServiceImagesPublishPlan({ evidenceDir, envPath, envText, fileExists });
  if (plan.readiness.missingDockerfiles.length > 0) {
    throw new Error(`package_d_service_images_publish_dockerfile_missing:${plan.readiness.missingDockerfiles.join(",")}`);
  }
  if (plan.readiness.missingDockerignores.length > 0) {
    throw new Error(`package_d_service_images_publish_dockerignore_missing:${plan.readiness.missingDockerignores.join(",")}`);
  }
  if (plan.readiness.missingContexts.length > 0) {
    throw new Error(`package_d_service_images_publish_context_missing:${plan.readiness.missingContexts.join(",")}`);
  }
  const source = envText || (envPath ? await readFile(envPath, "utf8") : "");
  const privateEnv = assertPrivateBuildEnv(parseEnvText(source));
  const results = [];
  for (const command of plan.commands) {
    const stdin = command.kind === "docker_login" ? privateEnv.TCR_SECRET : "";
    const result = await docker({ args: executionArgs(command, privateEnv), env: privateEnv, stdin });
    results.push({
      kind: command.kind,
      service: command.service || "",
      status: result.status,
      stdoutClass: result.stdout ? "present_redacted" : "empty",
      stderrClass: result.stderr ? "present_redacted" : "empty",
    });
    if (result.status !== 0) throw new Error(`package_d_service_images_publish_private_build_failed:${command.kind}:${command.service || "registry"}`);
  }
  const summary = {
    ok: true,
    contract: plan.contract,
    route: plan.route,
    mode: plan.mode,
    command: plan.command,
    imagePublishBoundary: true,
    deployBoundary: false,
    services: plan.services,
    privateBuild: results,
    privateBuildRunner: plan.privateBuildRunner,
    boundary: plan.boundary,
    realExecutionReady: false,
  };
  const auditSource = JSON.stringify(summary);
  const audit = {
    ...redactionAudit(auditSource),
    tcrSecretValueExposed: false,
    fullImageRefExposed: SERVICE_TARGETS.some((service) => auditSource.includes(fixedImageRef(service.repository))),
  };
  const evidenceWithAudit = { ...summary, redactionAudit: audit };
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_service_images_publish_redaction_audit_failed");
  const evidencePath = await writeEvidence({
    evidenceDir,
    filename: "private-build-push-redacted.json",
    payload: evidenceWithAudit,
  });
  return { ...summary, evidencePath };
}

export const runPackageDServiceImagesPublishDispatch = runPackageDServiceImagesPublishPrivateBuild;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "plan") {
    const plan = await buildPackageDServiceImagesPublishPlan({
      evidenceDir: args["evidence-dir"] || DEFAULT_EVIDENCE_DIR,
      envPath: args.env || "",
    });
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  if (args.mode !== "private-build-push") throw new Error("package_d_service_images_publish_mode_required");
  const summary = await runPackageDServiceImagesPublishPrivateBuild({
    evidenceDir: args["evidence-dir"] || DEFAULT_EVIDENCE_DIR,
    envPath: args.env || "",
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
