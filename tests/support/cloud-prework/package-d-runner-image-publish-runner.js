#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { redactionAudit } from "./package-d-kubernetes-api-preflight-runner.js";

export const PACKAGE_D_RUNNER_IMAGE_PUBLISH_WORKFLOW = ".github/workflows/package-d-runner-image-publish.yml";
export const PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND = "gh workflow run package-d-runner-image-publish.yml --ref recovery/platform-v22-trunk";

const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-runner-image-publish";
const FIXED_BRANCH = "recovery/platform-v22-trunk";
const FIXED_REGISTRY = "uswccr.ccs.tencentyun.com";
const FIXED_NAMESPACE = "medopl";
const FIXED_REGION = "na-siliconvalley";
const ALLOWED_REPOSITORY = "medopl-platform-runner";
const FIXED_TAG = "v22-package-d-20260615-001";
const FIXED_IMAGE_REF = `${FIXED_REGISTRY}/${FIXED_NAMESPACE}/${ALLOWED_REPOSITORY}:${FIXED_TAG}`;
const GITHUB_ENVIRONMENT = "package-d-image-publish";
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
  "--docker-build",
  "--docker-push",
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

function assertImageContract(imageRef = FIXED_IMAGE_REF) {
  const parsed = parseImageRef(imageRef);
  if (parsed.value !== FIXED_IMAGE_REF) throw new Error("package_d_runner_image_ref_not_fixed_package_d_runner_image");
  if (parsed.registry !== FIXED_REGISTRY) throw new Error("package_d_runner_image_ref_registry_mismatch");
  if (parsed.namespace !== FIXED_NAMESPACE) throw new Error("package_d_runner_image_ref_namespace_mismatch");
  if (parsed.repository !== ALLOWED_REPOSITORY) throw new Error("package_d_runner_image_ref_repository_not_allowlisted");
  if (parsed.tag !== FIXED_TAG) throw new Error("package_d_runner_image_ref_tag_mismatch");
  return parsed;
}

function assertWorkflowText(workflowText = "") {
  const required = [
    "workflow_dispatch:",
    `environment: ${GITHUB_ENVIRONMENT}`,
    "github.ref_name != 'recovery/platform-v22-trunk'",
    `TENCENT_TCR_REGISTRY: ${FIXED_REGISTRY}`,
    `TENCENT_TCR_NAMESPACE: ${FIXED_NAMESPACE}`,
    `TENCENT_TCR_REGION: ${FIXED_REGION}`,
    `PACKAGE_D_RUNNER_IMAGE_REPOSITORY: ${ALLOWED_REPOSITORY}`,
    `PACKAGE_D_RUNNER_IMAGE_TAG: ${FIXED_TAG}`,
    `PACKAGE_D_RUNNER_IMAGE_REF: ${FIXED_IMAGE_REF}`,
    "secrets.TCR_ID",
    "secrets.TCR_SECRET",
    "--password-stdin",
    "docker build",
    "docker push",
    "tests/support/cloud-prework/package-d-platform-runner.Dockerfile",
  ];
  for (const item of required) {
    if (!workflowText.includes(item)) throw new Error(`package_d_runner_image_publish_workflow_missing:${item}`);
  }
  for (const forbidden of [
    ":latest",
    "PACKAGE_D_RUNNER_IMAGE_TAG: latest",
    "kubectl",
    "helm",
    "CreateNodePool",
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
    "TENCENT_MUTATION_SECRET_ID",
    "TENCENT_MUTATION_SECRET_KEY",
    "KUBECONFIG",
    "kubeconfig-package-d-deploy",
    "PORTAL_POSTGRES_PASSWORD",
    "PORTAL_ADMIN_PASSWORD",
    "PORTAL_POSTGRES_URL",
    "package-d-deploy.env",
    "portal-runtime.env",
    "medopl-tenant-",
  ]) {
    if (workflowText.includes(forbidden)) throw new Error(`package_d_runner_image_publish_workflow_forbidden:${forbidden}`);
  }
}

function dispatchCommand() {
  return ["gh", "workflow", "run", "package-d-runner-image-publish.yml", "--ref", FIXED_BRANCH];
}

function assertDispatchCommandAllowed(args = []) {
  const joined = ` ${args.join(" ")} `;
  if (JSON.stringify(args) !== JSON.stringify(dispatchCommand())) {
    throw new Error("package_d_runner_image_publish_dispatch_command_mismatch");
  }
  for (const forbidden of [" kubectl ", " docker ", " deploy ", " tencent ", " CreateNodePool ", " pull "]) {
    if (joined.includes(forbidden)) throw new Error(`package_d_runner_image_publish_dispatch_forbidden:${forbidden.trim()}`);
  }
}

function defaultGhExecutor({ args }) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
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
  workflowPath = PACKAGE_D_RUNNER_IMAGE_PUBLISH_WORKFLOW,
  imageRef = FIXED_IMAGE_REF,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  argv = [],
} = {}) {
  parseArgs(argv);
  const workflowText = await readFile(workflowPath, "utf8");
  assertWorkflowText(workflowText);
  const image = assertImageContract(imageRef);
  const command = dispatchCommand();
  assertDispatchCommandAllowed(command);
  return {
    ok: true,
    contract: "package_d_runner_image_publish_github_actions_boundary",
    route: "github_actions_workflow_dispatch",
    mode: "dispatch-github-actions",
    command: PACKAGE_D_RUNNER_IMAGE_PUBLISH_COMMAND,
    workflow: workflowPath,
    target: {
      branch: FIXED_BRANCH,
      imagePublishBoundary: true,
      deployBoundary: false,
      tkeRunnerBuildBoundary: false,
    },
    image: {
      ref: "redacted",
      registry: image.registry,
      namespace: image.namespace,
      repository: image.repository,
      tag: image.tag,
      floatingTagAllowed: false,
    },
    githubActions: {
      environment: GITHUB_ENVIRONMENT,
      protectedEnvironmentRequired: true,
      branchRestriction: FIXED_BRANCH,
      requiredSecrets: ["TCR_ID", "TCR_SECRET"],
      forbiddenSecretClasses: [
        "cluster credential",
        "portal runtime database credential",
        "portal admin credential",
        "Tencent mutation credential",
      ],
      allowedWorkflowSteps: [
        "branch guard",
        "checkout",
        "fixed image boundary validation",
        "TCR login",
        "docker build fixed runner image",
        "docker push fixed runner image",
      ],
    },
    commands: [{
      name: "github_actions_workflow_dispatch",
      kind: "gh_workflow_dispatch",
      args: command,
    }],
    evidence: {
      sink: ".runtime",
      path: path.join(evidenceDir, "github-actions-dispatch-redacted.json"),
      githubActionsRunLog: "redacted_github_actions_run",
    },
    boundary: {
      imagePublishAllowedAfterAuthorization: true,
      deployAllowed: false,
      clusterCommandAllowed: false,
      tkeRunnerDockerAllowed: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      tenantPoolMutationAllowed: false,
      evidenceSink: ".runtime",
    },
    realExecutionReady: false,
  };
}

export async function runPackageDRunnerImagePublishDispatch({
  workflowPath = PACKAGE_D_RUNNER_IMAGE_PUBLISH_WORKFLOW,
  imageRef = FIXED_IMAGE_REF,
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  gh = defaultGhExecutor,
} = {}) {
  assertAuthorized(authorized);
  const plan = await buildPackageDRunnerImagePublishPlan({ workflowPath, imageRef, evidenceDir });
  const command = plan.commands[0];
  const result = await gh({ args: command.args });
  const summary = {
    ok: result.status === 0,
    contract: plan.contract,
    route: plan.route,
    mode: plan.mode,
    command: plan.command,
    workflow: plan.workflow,
    imageRef: "redacted",
    dispatch: {
      status: result.status,
      stdoutClass: result.stdout ? "present_redacted" : "empty",
      stderrClass: result.stderr ? "present_redacted" : "empty",
    },
    target: plan.target,
    image: plan.image,
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
    filename: "github-actions-dispatch-redacted.json",
    payload: evidenceWithAudit,
  });
  if (!summary.ok) throw new Error("package_d_runner_image_publish_dispatch_failed");
  return { ...summary, evidencePath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "plan") {
    const plan = await buildPackageDRunnerImagePublishPlan({
      workflowPath: args.workflow || PACKAGE_D_RUNNER_IMAGE_PUBLISH_WORKFLOW,
      imageRef: args["image-ref"] || FIXED_IMAGE_REF,
      evidenceDir: args["evidence-dir"] || DEFAULT_EVIDENCE_DIR,
    });
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  if (args.mode !== "dispatch-github-actions") throw new Error("package_d_runner_image_publish_mode_required");
  const summary = await runPackageDRunnerImagePublishDispatch({
    workflowPath: args.workflow || PACKAGE_D_RUNNER_IMAGE_PUBLISH_WORKFLOW,
    imageRef: args["image-ref"] || FIXED_IMAGE_REF,
    evidenceDir: args["evidence-dir"] || DEFAULT_EVIDENCE_DIR,
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
