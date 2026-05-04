import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { resolvePlan } from "../deploy/tke-package/scripts/build-and-push-tcr.mjs";
import { renderTkeManifests } from "../deploy/tke-package/scripts/render-tke-manifests.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const sensitivePattern = /cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token/i;

export const FORBIDDEN_MUTATING_KUBECTL_VERBS = Object.freeze([
  "apply",
  "create",
  "delete",
  "patch",
  "replace",
  "rollout",
  "scale",
  "set",
  "taint",
  "cordon",
  "uncordon",
  "drain",
]);

export const READ_ONLY_KUBECTL_COMMANDS = Object.freeze([
  Object.freeze(["version", "--client"]),
  Object.freeze(["config", "current-context"]),
  Object.freeze(["cluster-info"]),
  Object.freeze(["get", "ns"]),
  Object.freeze(["get", "nodes"]),
]);

const DEFAULT_PRODUCTION_HOSTS = Object.freeze([
  "portal.medopl.cn",
  "opl.medopl.cn",
  "trace.medopl.cn",
]);

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function sanitizeText(value = "") {
  return String(value || "")
    .replace(/\b(cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token)\b[^,\n]*/gi, "$1=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[redacted]");
}

function sanitizeEvidence(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeEvidence(item));
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? sanitizeText(value) : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    sensitivePattern.test(key) ? "[redacted]" : sanitizeEvidence(item),
  ]));
}

function parseEnvFileContent(source = "") {
  const values = {};
  for (const rawLine of String(source || "").replace(/^\uFEFF/, "").split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

async function readEnvFileValues(filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
  return parseEnvFileContent(await readFile(absolute, "utf8"));
}

async function gitTrackedSet() {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return new Set(stdout.split("\0").filter(Boolean).map((entry) => path.resolve(repoRoot, entry)));
  } catch {
    return new Set();
  }
}

async function isGitTracked(filePath) {
  const tracked = await gitTrackedSet();
  return tracked.has(path.resolve(filePath));
}

function isExampleEnvFile(filePath) {
  return /\.example(?:\.[^.]+)?$/i.test(path.basename(filePath));
}

async function assertEnvFilePolicy(filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
  const tracked = await isGitTracked(absolute);
  const example = isExampleEnvFile(absolute);
  return {
    path: absolute,
    tracked,
    example,
    ok: !tracked || example,
  };
}

function assertReadOnlyKubectlCommands(commands) {
  for (const args of commands) {
    const [verb, subcommand] = args;
    const mutating = FORBIDDEN_MUTATING_KUBECTL_VERBS.includes(String(verb || ""));
    if (mutating) {
      throw new Error(`mutating_kubectl_command_forbidden:${args.join(" ")}`);
    }
    if (verb === "auth" && subcommand !== "can-i") {
      throw new Error(`kubectl_auth_command_must_be_can_i:${args.join(" ")}`);
    }
  }
}

async function runCommand(bin, args, options = {}) {
  const startedAt = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: options.timeoutMs || 20_000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, ...(options.env || {}) },
    });
    return {
      ok: true,
      command: `${bin} ${args.join(" ")}`,
      stdout: sanitizeText(stdout).slice(0, 2000),
      stderr: sanitizeText(stderr).slice(0, 2000),
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      command: `${bin} ${args.join(" ")}`,
      stdout: sanitizeText(error?.stdout || "").slice(0, 2000),
      stderr: sanitizeText(error?.stderr || error?.message || error).slice(0, 2000),
      elapsedMs: Date.now() - startedAt,
    };
  }
}

function kubeconfigEnv() {
  const kubeconfig = env("V20_32_KUBECONFIG", env("KUBECONFIG"));
  return kubeconfig ? { KUBECONFIG: kubeconfig } : {};
}

function buildPlanArgs(envFile) {
  return [
    "--tag", "opl-v20.32",
    "--sync-source", "1",
    "--skip-login", "1",
    "--env-file", envFile,
    "--manifest-out-dir", "deploy/tke-package/rendered-v20.32-plan",
    "--runner-workload-image", env(
      "V20_32_RUNNER_WORKLOAD_IMAGE",
      "uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v20.32",
    ),
  ];
}

function hostsFromEnv() {
  const raw = env("V20_32_PRODUCTION_HOSTS", DEFAULT_PRODUCTION_HOSTS.join(","));
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function validateFixedHosts(hosts) {
  const expected = new Set(DEFAULT_PRODUCTION_HOSTS);
  return hosts.map((host) => ({
    host,
    ok: expected.has(host),
    expected: [...expected],
  }));
}

async function checkBuildPlan(envFile, tcrPassword) {
  try {
    const plan = resolvePlan({
      argv: buildPlanArgs(envFile),
      repoRoot,
      env: {
        ...process.env,
        TCR_PASSWORD: tcrPassword,
      },
    });
    return {
      ok: !plan.pushBlocked &&
        plan.releaseTag === "opl-v20.32" &&
        plan.manifest.allImagesUseReleaseTag === true &&
        String(plan.manifest.outDir || "").endsWith("deploy/tke-package/rendered-v20.32-plan") &&
        plan.runnerWorkload.source.type !== "missing",
      releaseTag: plan.releaseTag,
      manifestOutDir: path.relative(repoRoot, plan.manifest.outDir),
      allImagesUseReleaseTag: plan.manifest.allImagesUseReleaseTag,
      runnerWorkloadSource: plan.runnerWorkload.source.type,
      validationErrors: plan.validationErrors,
    };
  } catch (error) {
    return { ok: false, error: sanitizeText(error instanceof Error ? error.message : String(error)) };
  }
}

async function checkRender(envFile) {
  const outDir = await mkdtemp(path.join(tmpdir(), "v20-32-render-"));
  try {
    const result = renderTkeManifests({
      envFile,
      templateDir: path.resolve(repoRoot, "deploy/tke-package/manifests"),
      outDir,
    });
    return {
      ok: true,
      renderedFileCount: result.renderedFiles.length,
      outDir: path.basename(outDir),
    };
  } catch (error) {
    return {
      ok: false,
      outDir: path.basename(outDir),
      error: sanitizeText(error instanceof Error ? error.message : String(error)),
    };
  } finally {
    await rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function checkDocker() {
  return {
    version: await runCommand("docker", ["--version"]),
    info: await runCommand("docker", ["info"], { timeoutMs: 30_000 }),
  };
}

async function checkKubectl(platformNamespace, runtimeNamespace) {
  const commands = [
    ["version", "--client"],
    ["config", "current-context"],
    ["cluster-info"],
    ["get", "ns"],
    ["get", "nodes"],
    ["auth", "can-i", "create", "deployments", "-n", platformNamespace],
    ["auth", "can-i", "delete", "deployments", "-n", platformNamespace],
    ["auth", "can-i", "create", "jobs", "-n", runtimeNamespace],
  ];
  assertReadOnlyKubectlCommands(commands);
  const kubectlEnv = kubeconfigEnv();
  return {
    kubeconfigProvided: Boolean(kubectlEnv.KUBECONFIG),
    version: await runCommand("kubectl", ["version", "--client"], { env: kubectlEnv }),
    currentContext: await runCommand("kubectl", ["config", "current-context"], { env: kubectlEnv }),
    clusterInfo: await runCommand("kubectl", ["cluster-info"], { env: kubectlEnv }),
    namespaces: await runCommand("kubectl", ["get", "ns"], { timeoutMs: 30_000, env: kubectlEnv }),
    nodes: await runCommand("kubectl", ["get", "nodes"], { timeoutMs: 30_000, env: kubectlEnv }),
    canCreateDeployments: await runCommand("kubectl", ["auth", "can-i", "create", "deployments", "-n", platformNamespace], { env: kubectlEnv }),
    canDeleteDeployments: await runCommand("kubectl", ["auth", "can-i", "delete", "deployments", "-n", platformNamespace], { env: kubectlEnv }),
    canCreateJobs: await runCommand("kubectl", ["auth", "can-i", "create", "jobs", "-n", runtimeNamespace], { env: kubectlEnv }),
  };
}

function summarizeOk(value) {
  if (Array.isArray(value)) return value.every((item) => summarizeOk(item));
  if (!value || typeof value !== "object") return true;
  if (typeof value.ok === "boolean" && value.ok === false) return false;
  return Object.values(value).every((item) => summarizeOk(item));
}

async function main() {
  const envFile = env("V20_32_TKE_ENV_FILE", env("TKE_ENV_FILE", "/home/dev/.secrets/medopl/tke-v20.32.env"));
  const envValues = await readEnvFileValues(envFile).catch(() => ({}));
  const tcrPassword = env("TCR_PASSWORD", env("TCR_SECRET", envValues.TCR_PASSWORD || envValues.TCR_SECRET || ""));
  const platformNamespace = env("V20_32_PLATFORM_NAMESPACE", envValues.NAMESPACE || "portal-v20-32-staging");
  const runtimeNamespace = env("V20_32_RUNTIME_NAMESPACE", envValues.RUNTIME_NAMESPACE || "portal-runtime-v20-32-staging");
  const envPolicy = await assertEnvFilePolicy(envFile).catch((error) => ({
    path: path.resolve(repoRoot, envFile),
    tracked: false,
    example: false,
    ok: false,
    error: sanitizeText(error instanceof Error ? error.message : String(error)),
  }));

  const evidence = {
    checkedAt: new Date().toISOString(),
    status: "running",
    releaseTag: "opl-v20.32",
    envFile: envPolicy,
    credentials: {
      tcrPasswordPresent: Boolean(tcrPassword),
      tcrSecretMappedToPassword: Boolean(!env("TCR_PASSWORD") && (env("TCR_SECRET") || envValues.TCR_SECRET)),
    },
    fixedHosts: validateFixedHosts(hostsFromEnv()),
    buildPlan: await checkBuildPlan(envFile, tcrPassword),
    render: await checkRender(envFile),
    docker: await checkDocker(),
    kubectl: await checkKubectl(platformNamespace, runtimeNamespace),
  };
  evidence.status = summarizeOk(evidence) ? "ready" : "failed";
  const payload = {
    ok: evidence.status === "ready",
    contract: "v20.32_cloud_readiness",
    evidence,
  };
  console.log(JSON.stringify(sanitizeEvidence(payload), null, 2));
  if (!payload.ok) process.exitCode = 1;
}

await main().catch((error) => {
  console.log(JSON.stringify({
    ok: false,
    contract: "v20.32_cloud_readiness",
    error: sanitizeText(error instanceof Error ? error.message : String(error)),
  }, null, 2));
  process.exitCode = 1;
});
