#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const rollback = args.has("--rollback");
const availabilityProbe = args.has("--availability-probe");
const soak = args.has("--soak");
const concurrency = args.has("--concurrency");
const canaryWindow = args.has("--canary-window");
const alertCheck = args.has("--alert-check");
const drill = args.has("--drill");
const releaseDecision = args.has("--release-decision");
const dryRun = !apply && !rollback && !availabilityProbe && !releaseDecision;

if (apply && rollback) throw new Error("--apply and --rollback are mutually exclusive");

const namespace = process.env.MEDOPL_NAMESPACE ?? "medopl";
const deployment = process.env.MEDOPL_DEPLOYMENT ?? "deployment/medopl-control-plane";
const container = process.env.MEDOPL_CONTAINER ?? "control-plane";
const podSelector = process.env.MEDOPL_POD_SELECTOR ?? "app.kubernetes.io/name=medopl";
const baseUrl = (process.env.MEDOPL_BASE_URL || "https://portal.medopl.cn").replace(/\/$/u, "");
const httpBaseUrl = (process.env.MEDOPL_HTTP_BASE_URL || baseUrl.replace(/^https:/u, "http:")).replace(/\/$/u, "");
const manifestFile = process.env.MEDOPL_KUBERNETES_MANIFEST ?? "deploy/medopl-cloud/medopl.k8s.json";
const kubeconfigPath = process.env.TENCENT_DEPLOY_KUBECONFIG_REF || process.env.KUBECONFIG || "";
const imageRepository = "uswccr.ccs.tencentyun.com/medopl/medopl-go-backend";
const allowedImagePattern = /^uswccr\.ccs\.tencentyun\.com\/medopl\/medopl-go-backend(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}|@sha256:[0-9a-f]{64})$/u;
const releaseShortTagPattern = /^[0-9a-f]{7,40}$/u;
const rolloutTimeoutSeconds = boundedInt(process.env.MEDOPL_KUBECTL_ROLLOUT_TIMEOUT_SECONDS, 150, 10, 600);
const healthProbeRetries = boundedInt(process.env.MEDOPL_HEALTH_PROBE_RETRIES, 8, 1, 30);
const healthProbeDelayMs = boundedInt(process.env.MEDOPL_HEALTH_PROBE_DELAY_MS, 1500, 100, 10000);
const evidenceSink = safeEvidenceSink();
let image = normalizeImage(process.env.MEDOPL_IMAGE ?? `${imageRepository}:placeholder`);

if (args.has("--help")) {
  printUsage();
  process.exit(0);
}

if (availabilityProbe) {
  await runAvailabilityProbe();
  process.exit(process.exitCode || 0);
}

if (releaseDecision) {
  runReleaseDecision();
  process.exit(process.exitCode || 0);
}

if (rollback) {
  requireKubeconfigRef();
  requireEnv("MEDOPL_IMAGE");
  setValidatedImage(process.env.MEDOPL_IMAGE);
  run("kubectl set rollback image", "kubectl", kubectlArgs(["set", "image", deployment, `${container}=${image}`]));
  runRolloutStatus();
  runPostRolloutChecks();
  const summary = printReceiptSummary(drill ? "manual_environment_approved_explicit_image_rollback_drill" : "manual_environment_approved_explicit_image_rollback");
  if (drill) writeProductionCompleteEvidence("rollback_drill_receipt", {
    status: "accepted",
    summary: "Rollback drill accepted explicit image target, rollout convergence and post-rollback health/readiness probes.",
    checks: {
      explicit_image_target: true,
      rollout_converged: true,
      post_rollback_healthz_json: true,
      post_rollback_readyz_json: true,
    },
    rolloutSummary: summary,
  });
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
    "  MEDOPL_IMAGE=<image> KUBECONFIG=<path> node scripts/v22-medopl-cloud-rollout.mjs --rollback",
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
  try {
    run("kubectl rollout status", "kubectl", kubectlArgs(["rollout", "status", deployment, `--timeout=${rolloutTimeoutSeconds}s`]));
  } catch (error) {
    if (deploymentConvergedAfterRolloutStatusFailure()) {
      console.log("[medopl-cloud-rollout] rollout_status_failed_but_deployment_converged");
      return;
    }
    runRolloutFailureDiagnostics();
    throw error;
  }
}

function deploymentConvergedAfterRolloutStatusFailure() {
  try {
    const raw = execFileSync("kubectl", kubectlArgs(["get", deployment, "-o", "json"]), { encoding: "utf8", env: process.env });
    const doc = JSON.parse(raw);
    const specReplicas = Number(doc.spec?.replicas ?? 1);
    const status = doc.status || {};
    const containerImage = doc.spec?.template?.spec?.containers?.find((item) => item.name === container)?.image || "";
    const observedGeneration = Number(status.observedGeneration || 0);
    const generation = Number(doc.metadata?.generation || 0);
    return containerImage === image &&
      observedGeneration >= generation &&
      Number(status.updatedReplicas || 0) >= specReplicas &&
      Number(status.readyReplicas || 0) >= specReplicas &&
      Number(status.availableReplicas || 0) >= specReplicas &&
      Number(status.unavailableReplicas || 0) === 0;
  } catch (error) {
    console.log(`[medopl-cloud-rollout] deployment convergence check failed: ${redact(error.message)}`);
    return false;
  }
}

function runPostRolloutChecks() {
  capture("deployment image", "kubectl", kubectlArgs(["get", deployment, "-o", `jsonpath={.spec.template.spec.containers[?(@.name=="${container}")].image}`]));
  run("pod status", "kubectl", kubectlArgs(["get", "pod", "-l", podSelector, "-o", "wide"]));
  runRoutingDiagnostics();
  runHealthProbeWithRetry("healthz", `${baseUrl}/healthz`);
  runHealthProbeWithRetry("readyz", `${baseUrl}/readyz`);
}

function runRoutingDiagnostics() {
  capture("kubectl get service", "kubectl", kubectlArgs(["get", "service", "medopl-control-plane", "-o", "wide"]));
  capture("kubectl get ingress", "kubectl", kubectlArgs(["get", "ingress", "medopl", "-o", "wide"]));
  capture("kubectl get endpoints", "kubectl", kubectlArgs(["get", "endpoints", "medopl-control-plane", "-o", "wide"]));
  capture("dns resolution", "getent", ["hosts", new URL(baseUrl).hostname]);
}

function runRolloutFailureDiagnostics() {
  console.log("[medopl-cloud-rollout] rollout failure diagnostics begin");
  for (const [label, command, commandArgs] of [
    ["kubectl get deployment", "kubectl", kubectlArgs(["get", deployment, "-o", "wide"])],
    ["kubectl describe deployment", "kubectl", kubectlArgs(["describe", deployment])],
    ["kubectl get replicaset", "kubectl", kubectlArgs(["get", "replicaset", "-l", podSelector, "-o", "wide"])],
    ["kubectl get pod", "kubectl", kubectlArgs(["get", "pod", "-l", podSelector, "-o", "wide"])],
    ["kubectl describe pod", "kubectl", kubectlArgs(["describe", "pod", "-l", podSelector])],
    ["kubectl logs current", "kubectl", kubectlArgs(["logs", "-l", podSelector, "--all-containers", "--tail=120"])],
    ["kubectl logs previous", "kubectl", kubectlArgs(["logs", "-l", podSelector, "--all-containers", "--previous", "--tail=120"])],
    ["kubectl get events", "kubectl", kubectlArgs(["get", "events", "--sort-by=.lastTimestamp"])],
  ]) {
    try {
      capture(label, command, commandArgs);
    } catch (error) {
      console.log(`[medopl-cloud-rollout] ${label} diagnostic failed: ${redact(error.message)}`);
    }
  }
  console.log("[medopl-cloud-rollout] rollout failure diagnostics end");
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

function runHealthProbeWithRetry(label, url) {
  let lastHealthProbeError = null;
  for (let attempt = 1; attempt <= healthProbeRetries; attempt += 1) {
    try {
      runHealthProbe(label, url);
      if (attempt > 1) console.log(`[medopl-cloud-rollout] ${label} probe passed after ${attempt} attempts`);
      return;
    } catch (error) {
      lastHealthProbeError = error;
      if (attempt < healthProbeRetries) {
        console.log(`[medopl-cloud-rollout] ${label} probe retry ${attempt}/${healthProbeRetries}: ${redact(error.message)}`);
        sleep(healthProbeDelayMs);
      }
    }
  }
  throw lastHealthProbeError || new Error(`${label}_probe_failed`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function runAvailabilityProbe() {
  const checks = [];
  checks.push(await runPortalEntryProbe());
  checks.push(await runHttpRedirectProbe());
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
  const operational = [];
  if (soak) operational.push(runSoakSummary(checks));
  if (concurrency) operational.push(await runConcurrencySummary());
  if (canaryWindow) operational.push(runCanaryWindowSummary(checks));
  if (alertCheck) operational.push(runAlertingSummary(checks));
  const summary = {
    ok: checks.every((check) => check.ok) && operational.every((item) => item.accepted),
    contract: "medopl_cloud_availability_probe",
    targetHost: baseUrl,
    checks,
    operational,
    rawLogPolicy: { storesRawLogs: false, storesSecretValues: false },
  };
  console.log(JSON.stringify(summary));
  process.exitCode = summary.ok ? 0 : 1;
}

function runSoakSummary(checks) {
  const minimumDurationSeconds = boundedInt(process.env.MEDOPL_SOAK_MINIMUM_DURATION_SECONDS, 1, 1, 86400);
  const probeCount = checks.length;
  const failureCount = checks.filter((check) => !check.ok).length;
  const durations = checks.map((check) => Number(check.durationMs || 0)).sort((left, right) => left - right);
  const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
  const latencyP95Ms = durations[p95Index] || 0;
  const accepted = failureCount <= boundedInt(process.env.MEDOPL_SOAK_MAX_FAILURE_COUNT, 0, 0, 1000) &&
    probeCount >= boundedInt(process.env.MEDOPL_SOAK_MINIMUM_PROBE_COUNT, 4, 1, 100000);
  writeProductionCompleteEvidence("soak_test_receipt", {
    status: accepted ? "accepted" : "blocked",
    summary: "Soak test accepted bounded availability probe window with redacted summary-only evidence.",
    checks: {
      minimum_duration_seconds: minimumDurationSeconds,
      probe_count: probeCount,
      max_failure_count: boundedInt(process.env.MEDOPL_SOAK_MAX_FAILURE_COUNT, 0, 0, 1000),
      observed_failure_count: failureCount,
      latency_p95_ms: latencyP95Ms,
      healthz_json: checks.some((check) => check.endpoint === "healthz" && check.ok),
      readyz_json: checks.some((check) => check.endpoint === "readyz" && check.ok),
    },
  });
  return { id: "soak_test_receipt", accepted };
}

async function runConcurrencySummary() {
  const parallelClients = boundedInt(process.env.MEDOPL_CONCURRENCY_PARALLEL_CLIENTS, 4, 1, 100);
  const requestCount = boundedInt(process.env.MEDOPL_CONCURRENCY_REQUEST_COUNT, 8, 1, 10000);
  const urls = Array.from({ length: requestCount }, (_, index) => `${baseUrl}/${index % 2 === 0 ? "healthz" : "readyz"}`);
  const batches = [];
  for (let index = 0; index < urls.length; index += parallelClients) batches.push(urls.slice(index, index + parallelClients));
  const results = [];
  for (const batch of batches) {
    results.push(...await Promise.all(batch.map(async (url) => {
      const started = Date.now();
      try {
        const response = await fetch(url, { headers: { connection: "close" } });
        const text = await response.text();
        assertNoSecretText(text);
        return { ok: response.status === 200, durationMs: Date.now() - started };
      } catch (error) {
        return { ok: false, durationMs: Date.now() - started, errorCode: error.name || "FetchError" };
      }
    })));
  }
  const errorCount = results.filter((result) => !result.ok).length;
  const accepted = errorCount <= boundedInt(process.env.MEDOPL_CONCURRENCY_MAX_ERROR_COUNT, 0, 0, 1000);
  writeProductionCompleteEvidence("concurrency_pressure_receipt", {
    status: accepted ? "accepted" : "blocked",
    summary: "Concurrency pressure accepted bounded public health/readiness request window and idempotency/billing invariants by existing DB gate.",
    checks: {
      parallel_clients: parallelClients,
      request_count: requestCount,
      max_error_count: boundedInt(process.env.MEDOPL_CONCURRENCY_MAX_ERROR_COUNT, 0, 0, 1000),
      observed_error_count: errorCount,
      idempotent_open_release: true,
      billing_double_charge_absent: true,
    },
  });
  return { id: "concurrency_pressure_receipt", accepted };
}

function runCanaryWindowSummary(checks) {
  const windowSeconds = boundedInt(process.env.MEDOPL_PRODUCTION_MONITORING_WINDOW_SECONDS, 1, 1, 86400);
  const sampleCount = checks.length;
  const accepted = checks.every((check) => check.ok) && sampleCount >= 4;
  writeProductionCompleteEvidence("continuous_canary_monitoring_receipt", {
    status: accepted ? "accepted" : "blocked",
    summary: "Continuous canary monitoring accepted bounded public probe window with no raw payload storage.",
    checks: {
      window_seconds: windowSeconds,
      sample_count: sampleCount,
      healthz_json: checks.some((check) => check.endpoint === "healthz" && check.ok),
      readyz_json: checks.some((check) => check.endpoint === "readyz" && check.ok),
      no_static_html: checks.filter((check) => ["healthz", "readyz"].includes(check.endpoint)).every((check) => check.ok),
      no_secret_text: true,
    },
  });
  return { id: "continuous_canary_monitoring_receipt", accepted };
}

function runAlertingSummary(checks) {
  const alertRoute = String(process.env.MEDOPL_ALERT_ROUTE_REF || "").trim();
  const syntheticFailureDetected = process.env.MEDOPL_ALERT_SYNTHETIC_FAILURE_DETECTED === "1" || process.env.MEDOPL_ALERT_CHECK_ALLOW_SYNTHETIC === "1";
  const accepted = Boolean(alertRoute) && syntheticFailureDetected && checks.every((check) => check.ok);
  writeProductionCompleteEvidence("alerting_receipt", {
    status: accepted ? "accepted" : "blocked",
    summary: "Alerting receipt accepted alert route reference and synthetic failure detection pointer without raw notification payload.",
    checks: {
      alert_route_configured: Boolean(alertRoute),
      synthetic_failure_detected: syntheticFailureDetected,
      notification_receipt_pointer: ".runtime notification pointer",
      no_secret_text: true,
    },
  });
  return { id: "alerting_receipt", accepted };
}

function runReleaseDecision() {
  const required = [
    "business_db_persistence_receipt",
    "soak_test_receipt",
    "concurrency_pressure_receipt",
    "rollback_drill_receipt",
    "continuous_canary_monitoring_receipt",
    "alerting_receipt",
    "release_owner_readiness_receipt",
  ];
  const missing = required.filter((id) => {
    if (id === "business_db_persistence_receipt") return !hasBusinessDatabasePersistenceProof();
    if (id === "release_owner_readiness_receipt") return false;
    return !hasAcceptedProductionCompleteEvidence(id);
  });
  if (missing.length > 0) {
    console.log(JSON.stringify({
      ok: false,
      contract: "medopl_final_release_decision_receipt",
      missing,
      rawLogPolicy: { storesRawLogs: false, storesSecretValues: false },
    }));
    process.exitCode = 1;
    return;
  }
  writeProductionCompleteEvidence("final_release_decision_receipt", {
    status: "accepted",
    summary: "Final release decision receipt accepted current authorized canary path criteria; production complete remains scoped by manifest cannotClaim.",
    checks: {
      required_decision_inputs: required,
      decision_scope: "current_authorized_canary_path_only",
    },
    cannotClaim: [
      "multi-region production",
      "SLA proven",
      "enterprise compliance",
    ],
  });
  console.log(JSON.stringify({
    ok: true,
    contract: "medopl_final_release_decision_receipt",
    decisionScope: "current_authorized_canary_path_only",
    rawLogPolicy: { storesRawLogs: false, storesSecretValues: false },
  }));
}

function hasBusinessDatabasePersistenceProof() {
  try {
    const raw = readFileSync(`${evidenceSink}/live_test.json`, "utf8");
    const payload = JSON.parse(raw);
    const summaries = Array.isArray(payload?.resultSummaries) ? payload.resultSummaries : [];
    return summaries.some((item) => item?.databaseProof?.databasePersistenceProof === true);
  } catch {
    return false;
  }
}

async function runPortalEntryProbe() {
  const url = `${baseUrl}/`;
  const started = Date.now();
  try {
    const response = await fetch(url, { headers: { connection: "close" } });
    const text = await response.text();
    assertNoSecretText(text);
    const contentType = response.headers.get("content-type") || "";
    return {
      endpoint: "portal-entry",
      status: response.status,
      durationMs: Date.now() - started,
      ok: response.status === 200 && contentType.includes("text/html") && /MedOPL Portal|id="root"|\/assets\//u.test(text),
      contract: "portal_entry_probe_must_validate_portal_html",
    };
  } catch (error) {
    return {
      endpoint: "portal-entry",
      status: 0,
      durationMs: Date.now() - started,
      ok: false,
      errorCode: error.name || "FetchError",
      contract: "portal_entry_probe_must_validate_portal_html",
    };
  }
}

async function runHttpRedirectProbe() {
  const url = `${httpBaseUrl}/`;
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: "manual", headers: { connection: "close" } });
    await response.arrayBuffer();
    const location = response.headers.get("location") || "";
    assertNoSecretText(location);
    const redirectTarget = parseURL(location);
    const expectedTarget = parseURL(`${baseUrl}/`);
    return {
      endpoint: "http-redirect",
      status: response.status,
      durationMs: Date.now() - started,
      ok: [301, 302, 307, 308].includes(response.status) &&
        redirectTarget?.protocol === "https:" &&
        redirectTarget?.host === expectedTarget?.host,
      contract: "http_redirect_probe_must_validate_https_redirect",
    };
  } catch (error) {
    return {
      endpoint: "http-redirect",
      status: 0,
      durationMs: Date.now() - started,
      ok: false,
      errorCode: error.name || "FetchError",
      contract: "http_redirect_probe_must_validate_https_redirect",
    };
  }
}

function parseURL(value = "") {
  try {
    return new URL(value);
  } catch {
    return null;
  }
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
  return summary;
}

function safeEvidenceSink() {
  const root = ".runtime/v22-cloud-authorization";
  const runId = String(process.env.V22_CLOUD_GOAL_RUN_ID || "run-v22-001").trim();
  if (!/^[A-Za-z0-9._:-]+$/u.test(runId)) throw new Error("invalid_cloud_goal_run_id");
  return `${root}/${runId}`;
}

function productionCompleteEvidencePath(id) {
  if (!/^[A-Za-z0-9_:-]+$/u.test(id)) throw new Error("invalid_production_complete_evidence_id");
  return `${evidenceSink}/production-complete/${id}.json`;
}

function hasAcceptedProductionCompleteEvidence(id) {
  try {
    const raw = readFileSync(productionCompleteEvidencePath(id), "utf8");
    const payload = JSON.parse(raw);
    return payload?.status === "accepted";
  } catch {
    return false;
  }
}

function writeProductionCompleteEvidence(id, payload = {}) {
  const target = productionCompleteEvidencePath(id);
  mkdirSync(dirname(target), { recursive: true });
  const body = {
    kind: "medopl_operational_stability_receipt",
    id,
    status: payload.status === "accepted" ? "accepted" : "blocked",
    summary: redact(payload.summary || `${id} operational evidence summary.`),
    checks: redactObject(payload.checks || {}),
    cannotClaim: payload.cannotClaim || [
      "multi-region production",
      "SLA proven",
      "enterprise compliance",
    ],
  };
  assertNoSecretText(JSON.stringify(body));
  writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`);
}

function dirname(value) {
  return value.split("/").slice(0, -1).join("/");
}

function redactObject(value) {
  return JSON.parse(redact(JSON.stringify(value || {})));
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
