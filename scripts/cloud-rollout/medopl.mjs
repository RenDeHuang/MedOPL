#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const rollback = args.has("--rollback");
const availabilityProbe = args.has("--availability-probe");
const dryRun = !apply && !rollback && !availabilityProbe;

if (apply && rollback) throw new Error("--apply and --rollback are mutually exclusive");

const namespace = process.env.MEDOPL_NAMESPACE ?? "medopl";
const deployment = process.env.MEDOPL_DEPLOYMENT ?? "deployment/medopl-control-plane";
const container = process.env.MEDOPL_CONTAINER ?? "control-plane";
const podSelector = process.env.MEDOPL_POD_SELECTOR ?? "app.kubernetes.io/name=medopl";
const baseUrl = (process.env.MEDOPL_BASE_URL || "https://portal.medopl.cn").replace(/\/$/u, "");
const manifestFile = process.env.MEDOPL_KUBERNETES_MANIFEST ?? "deploy/medopl-cloud/medopl.k8s.json";
const kubeconfigPath = process.env.TENCENT_DEPLOY_KUBECONFIG_REF || process.env.KUBECONFIG || "";
const imageRepository = "uswccr.ccs.tencentyun.com/medopl/medopl-go-backend";
const allowedImagePattern = /^uswccr\.ccs\.tencentyun\.com\/medopl\/medopl-go-backend(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}|@sha256:[0-9a-f]{64})$/u;
const releaseShortTagPattern = /^[0-9a-f]{7,40}$/u;
const rolloutTimeoutSeconds = boundedInt(process.env.MEDOPL_KUBECTL_ROLLOUT_TIMEOUT_SECONDS, 150, 10, 600);
let image = normalizeImage(process.env.MEDOPL_IMAGE ?? `${imageRepository}:placeholder`);

if (args.has("--help")) {
  printUsage();
  process.exit(0);
}

if (availabilityProbe) {
  await runAvailabilityProbe();
  process.exit(process.exitCode || 0);
}

if (rollback) {
  requireKubeconfigRef();
  run("kubectl rollout undo", "kubectl", kubectlArgs(["rollout", "undo", deployment]));
  runRolloutStatus();
  runPostRolloutChecks();
  printReceiptSummary("manual_environment_approved_rollback");
  process.exit(0);
}

setValidatedImage(image);
if (dryRun) {
  printDryRun();
  process.exit(0);
}

requireKubeconfigRef();
requireEnv("MEDOPL_IMAGE");
setValidatedImage(process.env.MEDOPL_IMAGE);
run("kubectl apply", "kubectl", kubectlArgs(["apply", "-f", manifestFile]));
run("kubectl set image", "kubectl", kubectlArgs(["set", "image", deployment, `${container}=${image}`]));
runRolloutStatus();
runPostRolloutChecks();
printReceiptSummary("manual_environment_approved_apply");

function printUsage() {
  console.log([
    "Usage:",
    "  node scripts/v22-medopl-cloud-rollout.mjs",
    "  MEDOPL_IMAGE=<image> KUBECONFIG=<path> node scripts/v22-medopl-cloud-rollout.mjs --apply",
    "  KUBECONFIG=<path> node scripts/v22-medopl-cloud-rollout.mjs --rollback",
    "  node scripts/v22-medopl-cloud-rollout.mjs --availability-probe",
  ].join("\n"));
}

function boundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeImage(value) {
  const raw = String(value || "").trim();
  if (releaseShortTagPattern.test(raw)) return `${imageRepository}:${raw}`;
  return raw;
}

function setValidatedImage(value) {
  image = normalizeImage(value);
  if (!allowedImagePattern.test(image)) throw new Error("medopl_image_outside_allowed_registry");
}

function requireEnv(name) {
  if (!String(process.env[name] || "").trim()) throw new Error(`required_env_missing:${name}`);
}

function requireKubeconfigRef() {
  if (!String(kubeconfigPath || "").trim()) throw new Error("required_env_missing:TENCENT_DEPLOY_KUBECONFIG_REF");
}

function kubectlArgs(extraArgs = []) {
  return kubeconfigPath
    ? ["--kubeconfig", kubeconfigPath, "--namespace", namespace, ...extraArgs]
    : ["--namespace", namespace, ...extraArgs];
}

function run(label, command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) throw new Error(`${label}_failed`);
}

function capture(label, command, commandArgs) {
  const output = execFileSync(command, commandArgs, { encoding: "utf8", env: process.env }).trim();
  console.log(`[medopl-cloud-rollout] ${label}: ${redact(output)}`);
  return output;
}

function runRolloutStatus() {
  run("kubectl rollout status", "kubectl", kubectlArgs(["rollout", "status", deployment, `--timeout=${rolloutTimeoutSeconds}s`]));
}

function runPostRolloutChecks() {
  capture("deployment image", "kubectl", kubectlArgs(["get", deployment, "-o", `jsonpath={.spec.template.spec.containers[?(@.name=="${container}")].image}`]));
  run("pod status", "kubectl", kubectlArgs(["get", "pod", "-l", podSelector, "-o", "wide"]));
  runHealthProbe("healthz", `${baseUrl}/healthz`);
  runHealthProbe("readyz", `${baseUrl}/readyz`);
}

function runHealthProbe(label, url) {
  const result = spawnSync("curl", ["--http2", "-fsS", url], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) throw new Error(`${label}_probe_failed`);
  assertNoSecretText(result.stdout);
  let body = {};
  try {
    body = JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label}_health_probe_must_validate_go_backend_health_json`);
  }
  if (body.status !== "ok" || body.service !== "medopl-go-backend") {
    throw new Error(`${label}_health_probe_must_validate_go_backend_health_json`);
  }
}

async function runAvailabilityProbe() {
  const checks = [];
  for (const endpoint of ["healthz", "readyz"]) {
    const url = `${baseUrl}/${endpoint}`;
    const started = Date.now();
    try {
      const response = await fetch(url, { headers: { connection: "close" } });
      const text = await response.text();
      assertNoSecretText(text);
      let body = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
      checks.push({
        endpoint,
        status: response.status,
        durationMs: Date.now() - started,
        ok: response.status === 200 && body.status === "ok" && body.service === "medopl-go-backend",
      });
    } catch (error) {
      checks.push({
        endpoint,
        status: 0,
        durationMs: Date.now() - started,
        ok: false,
        errorCode: error.name || "FetchError",
      });
    }
  }
  const summary = {
    ok: checks.every((check) => check.ok),
    contract: "medopl_cloud_availability_probe",
    targetHost: baseUrl,
    checks,
    rawLogPolicy: { storesRawLogs: false, storesSecretValues: false },
  };
  console.log(JSON.stringify(summary));
  process.exitCode = summary.ok ? 0 : 1;
}

function printDryRun() {
  console.log(JSON.stringify({
    ok: true,
    contract: "medopl_cloud_rollout_dry_run",
    namespace,
    deployment,
    manifestFile,
    image,
    runnerRequired: "self-hosted,tencent-cloud,medopl",
    boundary: {
      callsKubectl: false,
      deploysWorkload: false,
      readsKubeconfig: false,
      writesReceiptManifest: false,
    },
    nextExternalActions: [
      "register GitHub self-hosted runner in Tencent VPC with labels self-hosted,tencent-cloud,medopl",
      "add GitHub production environment secret KUBECONFIG",
      "label TKE node np-6l4nkdto-2cdtm with medopl.cn/workload=medopl",
    ],
  }, null, 2));
}

function printReceiptSummary(mode) {
  const summary = {
    ok: true,
    contract: "medopl_cloud_rollout_receipt_pointer",
    mode,
    namespace,
    deployment,
    image,
    publicBaseUrl: baseUrl,
    receiptPolicy: "write detailed receipt through cloud:goal owner receipts and .runtime manifest",
    rawLogPolicy: { storesRawLogs: false, storesSecretValues: false },
  };
  assertNoSecretText(JSON.stringify(summary));
  console.log(JSON.stringify(summary));
}

function redact(value = "") {
  return String(value)
    .replace(/token/giu, "redacted_token_ref")
    .replace(/password/giu, "redacted_password_ref")
    .replace(/postgres(?:ql)?:\/\/[^\s"]+/giu, "DATABASE_URL_REF");
}

function assertNoSecretText(value = "") {
  if (/SecretId|SecretKey|BEGIN (?:OPENSSH|RSA).*PRIVATE KEY|postgres(?:ql)?:\/\/|sk-[A-Za-z0-9_-]{20,}/iu.test(String(value))) {
    throw new Error("rollout_output_contains_sensitive_material");
  }
}
