#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEPLOY_ENV_KEYS,
  FIXED_CLUSTER_ID,
  parseEnv,
  redactionAudit,
  summarizeCommandResult,
} from "./package-d-kubernetes-api-preflight-runner.js";

export const PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND = "node tests/support/cloud-prework/package-d-runner-image-publish-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --image-ref uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001 --mode publish-image";
const PACKAGE_D_RUNNER_IMAGE_PUBLISH_REDACTED_COMMAND = "node tests/support/cloud-prework/package-d-runner-image-publish-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --image-ref REDACTED_PACKAGE_D_RUNNER_IMAGE_REF --mode publish-image";

const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-runner-image-publish";
const FIXED_REGISTRY = "uswccr.ccs.tencentyun.com";
const FIXED_NAMESPACE = "medopl";
const ALLOWED_REPOSITORY = "medopl-platform-runner";
const FIXED_IMAGE_REF = `${FIXED_REGISTRY}/${FIXED_NAMESPACE}/${ALLOWED_REPOSITORY}:v22-package-d-20260615-001`;
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

function assertImageContract({ requestedImageRef, deployEnv }) {
  const parsed = parseImageRef(requestedImageRef);
  if (parsed.value !== deployEnv.PACKAGE_D_RUNNER_IMAGE_REF) throw new Error("package_d_runner_image_ref_env_mismatch");
  if (parsed.value !== FIXED_IMAGE_REF) throw new Error("package_d_runner_image_ref_not_fixed_package_d_runner_image");
  if (parsed.registry !== deployEnv.TENCENT_TCR_REGISTRY || parsed.registry !== FIXED_REGISTRY) {
    throw new Error("package_d_runner_image_ref_registry_mismatch");
  }
  if (parsed.namespace !== deployEnv.TENCENT_TCR_NAMESPACE || parsed.namespace !== FIXED_NAMESPACE) {
    throw new Error("package_d_runner_image_ref_namespace_mismatch");
  }
  if (parsed.repository !== ALLOWED_REPOSITORY) throw new Error("package_d_runner_image_ref_repository_not_allowlisted");
  return parsed;
}

function assertDeployEnv(deployEnv = {}) {
  if (deployEnv.RUN_TENCENT_DEPLOY_EXECUTION !== "0") throw new Error("package_d_deploy_run_gate_must_remain_zero");
  if (deployEnv.TENCENT_DEPLOY_CLUSTER_ID !== FIXED_CLUSTER_ID) throw new Error("package_d_deploy_cluster_mismatch");
  if (!text(deployEnv.TCR_ID) || !text(deployEnv.TCR_SECRET)) throw new Error("package_d_tcr_credentials_missing");
  if (deployEnv.TENCENT_TCR_REGION !== "na-siliconvalley") throw new Error("package_d_tcr_region_mismatch");
}

function plannedCommands({ registry, imageRef }) {
  return [
    { name: "registry_auth", kind: "docker_login", args: ["docker", "login", registry, "--username", "REDACTED_TCR_ID", "--password-stdin"] },
    { name: "image_build", kind: "docker_build", args: ["docker", "build", "-t", imageRef, "."] },
    { name: "image_publish", kind: "docker_push", args: ["docker", "push", imageRef] },
  ];
}

function assertDockerCommandAllowed(args = [], kind = "", imageRef = "") {
  const joined = ` ${args.join(" ")} `;
  if (args[0] !== "docker") throw new Error("package_d_runner_image_publish_command_must_be_docker");
  for (const forbidden of [" kubectl ", " apply ", " deploy ", " helm ", " tencent ", " CreateNodePool ", " pull "]) {
    if (joined.includes(forbidden)) throw new Error(`package_d_runner_image_publish_command_forbidden:${forbidden.trim()}`);
  }
  if (kind === "docker_login" && !args.includes("--password-stdin")) {
    throw new Error("package_d_runner_image_publish_login_must_use_password_stdin");
  }
  if (kind === "docker_build" && args[args.indexOf("-t") + 1] !== imageRef) {
    throw new Error("package_d_runner_image_publish_build_image_mismatch");
  }
  if (kind === "docker_push" && args.at(-1) !== imageRef) {
    throw new Error("package_d_runner_image_publish_push_image_mismatch");
  }
}

function defaultDockerExecutor({ args, stdin }) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    input: stdin,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || result.error?.message || "",
  };
}

function redactedArgs(args = [], { registry, imageRef }) {
  return args.map((arg, index) => {
    if (arg === imageRef) return "REDACTED_PACKAGE_D_RUNNER_IMAGE_REF";
    if (arg === registry) return registry;
    if (args[index - 1] === "--username") return "REDACTED_TCR_ID";
    return arg;
  });
}

function summarizeDockerCommand(command, result, context) {
  return {
    ...summarizeCommandResult(command, result),
    command: command.kind,
    args: redactedArgs(command.args, context),
  };
}

async function writeEvidence({ evidenceDir, filename, payload }) {
  await mkdir(evidenceDir, { recursive: true });
  const target = path.join(evidenceDir, filename);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function buildPackageDRunnerImagePublishPlan({
  deployEnvPath,
  imageRef = FIXED_IMAGE_REF,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  argv = [],
} = {}) {
  parseArgs(argv);
  assertAuthorized(authorized);
  const deployEnv = parseEnv(await readFile(deployEnvPath, "utf8"), DEPLOY_ENV_KEYS);
  assertDeployEnv(deployEnv);
  const image = assertImageContract({ requestedImageRef: imageRef, deployEnv });
  const commands = plannedCommands({ registry: image.registry, imageRef: image.value }).map((command) => {
    assertDockerCommandAllowed(command.args, command.kind, image.value);
    return {
      name: command.name,
      kind: command.kind,
      args: redactedArgs(command.args, { registry: image.registry, imageRef: image.value }),
    };
  });
  return {
    ok: true,
    contract: "package_d_runner_image_publish_runner",
    mode: "publish-image",
    command: PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
    target: {
      clusterId: FIXED_CLUSTER_ID,
      imagePublishBoundary: true,
      deployBoundary: false,
    },
    image: {
      ref: "redacted",
      registry: image.registry,
      namespace: image.namespace,
      repository: image.repository,
      tag: image.tag,
      floatingTagAllowed: false,
    },
    env: {
      deployEnvPath: "authorized_package_d_deploy_env",
      requiredKeys: [
        "RUN_TENCENT_DEPLOY_EXECUTION",
        "TCR_ID",
        "TCR_SECRET",
        "TENCENT_TCR_REGISTRY",
        "TENCENT_TCR_NAMESPACE",
        "TENCENT_TCR_REGION",
        "PACKAGE_D_RUNNER_IMAGE_REF",
      ],
      tcrSecret: "redacted",
    },
    commands,
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, "image-publish-redacted.json"),
    },
    boundary: {
      runTencentDeployExecution: deployEnv.RUN_TENCENT_DEPLOY_EXECUTION,
      imagePublishAllowed: true,
      deployAllowed: false,
      clusterCommandAllowed: false,
      buildPushAllowed: true,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      tenantPoolMutationAllowed: false,
      evidenceSink: ".runtime",
    },
    realExecutionReady: false,
  };
}

export async function runPackageDRunnerImagePublish({
  deployEnvPath,
  imageRef = FIXED_IMAGE_REF,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  docker = defaultDockerExecutor,
} = {}) {
  const plan = await buildPackageDRunnerImagePublishPlan({ deployEnvPath, imageRef, evidenceDir, authorized });
  const deployEnv = parseEnv(await readFile(deployEnvPath, "utf8"), DEPLOY_ENV_KEYS);
  const image = assertImageContract({ requestedImageRef: imageRef, deployEnv });
  const commandResults = [];
  const liveCommands = plannedCommands({ registry: image.registry, imageRef: image.value });
  for (const command of liveCommands) {
    const liveArgs = command.kind === "docker_login"
      ? ["docker", "login", image.registry, "--username", deployEnv.TCR_ID, "--password-stdin"]
      : command.args;
    assertDockerCommandAllowed(liveArgs, command.kind, image.value);
    const result = await docker({
      args: liveArgs,
      stdin: command.kind === "docker_login" ? deployEnv.TCR_SECRET : undefined,
    });
    commandResults.push(summarizeDockerCommand({ ...command, args: liveArgs }, result, { registry: image.registry, imageRef: image.value }));
    if (result.status !== 0) break;
  }
  const failed = commandResults.find((result) => result.status !== 0);
  const summary = {
    ok: !failed && commandResults.length === plan.commands.length,
    contract: plan.contract,
    mode: plan.mode,
    imageRef: "redacted",
    image: plan.image,
    commands: commandResults,
    failedStep: failed?.name || "",
    realExecutionReady: false,
  };
  const evidence = {
    ...summary,
    command: PACKAGE_D_RUNNER_IMAGE_PUBLISH_REDACTED_COMMAND,
    target: plan.target,
    env: plan.env,
    boundary: plan.boundary,
  };
  const auditSource = JSON.stringify(evidence);
  const audit = {
    ...redactionAudit(auditSource),
    tcrSecretExposed: auditSource.includes(deployEnv.TCR_SECRET) || auditSource.includes("TCR_SECRET="),
    fullImageRefExposed: auditSource.includes(image.value),
  };
  const evidenceWithAudit = { ...evidence, redactionAudit: audit };
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_runner_image_publish_redaction_audit_failed");
  const evidencePath = await writeEvidence({
    evidenceDir,
    filename: "image-publish-redacted.json",
    payload: evidenceWithAudit,
  });
  if (!summary.ok) throw new Error(`package_d_runner_image_publish_failed:${summary.failedStep}`);
  return { ...summary, evidencePath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode !== "publish-image") throw new Error("package_d_runner_image_publish_mode_required");
  const summary = await runPackageDRunnerImagePublish({
    deployEnvPath: args["deploy-env"],
    imageRef: args["image-ref"],
    evidenceDir: args["evidence-dir"],
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
