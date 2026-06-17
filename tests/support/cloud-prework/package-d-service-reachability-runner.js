#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEPLOY_ENV_KEYS,
  FIXED_CLUSTER_ID,
  FIXED_NAMESPACE,
  FIXED_PLATFORM_NODE_POOL_ID,
  KUBE_ENV_NAME,
  REQUIRED_DEPLOY_ENV_KEYS,
  RUNTIME_ENV_KEYS,
  assertFile,
  assertTargetEnv,
  kubeconfigSummary,
  parseEnv,
  redactionAudit,
} from "./package-d-kubernetes-api-preflight-runner.js";

export const PACKAGE_D_SERVICE_REACHABILITY_COMMAND = "node tests/support/cloud-prework/package-d-service-reachability-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --mode in-cluster-http-smoke --authorized 1";

const MODE = "in-cluster-http-smoke";
const DEFAULT_EVIDENCE_ROOT = ".runtime/package-d-service-reachability";
const CLEANUP_POLICY = "delete-always-after-log-collection";
const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u;
const SMOKE_IMAGE = "curlimages/curl:8.8.0";

const SERVICES = Object.freeze([
  Object.freeze({
    name: "portal-frontend",
    path: "/",
    serviceDns: "portal-frontend.medopl-platform.svc.cluster.local",
    containerName: "smoke-portal-frontend",
  }),
  Object.freeze({
    name: "medopl-go-backend",
    path: "/readyz",
    serviceDns: "medopl-go-backend.medopl-platform.svc.cluster.local",
    containerName: "smoke-medopl-go-backend",
  }),
  Object.freeze({
    name: "opl-web-gateway",
    path: "/healthz",
    serviceDns: "opl-web-gateway.medopl-platform.svc.cluster.local",
    containerName: "smoke-opl-web-gateway",
  }),
  Object.freeze({
    name: "opl-runtime-bridge",
    path: "/healthz",
    serviceDns: "opl-runtime-bridge.medopl-platform.svc.cluster.local",
    containerName: "smoke-opl-runtime-bridge",
  }),
]);

const FORBIDDEN_ARGS = Object.freeze(new Set([
  "--deploy",
  "--rollback",
  "--build",
  "--push",
  "--tencent-mutation",
  "--package-c-live",
  "--exec",
  "--apply",
  "--delete",
  "--patch",
  "--scale",
  "--rollout",
  "--url",
]));

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`package_d_service_reachability_forbidden_arg:${item}`);
    if (!item.startsWith("--")) throw new Error(`package_d_service_reachability_unknown_arg:${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`package_d_service_reachability_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("package_d_service_reachability_not_authorized");
}

function assertRunId(runId = "") {
  if (!runId) throw new Error("package_d_service_reachability_run_id_required");
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("package_d_service_reachability_run_id_invalid");
  if (runId.includes("medopl-tenant-")) throw new Error("package_d_service_reachability_run_id_invalid");
}

function assertMode(mode = MODE) {
  const normalized = text(mode);
  if (normalized !== MODE) throw new Error("package_d_service_reachability_mode_required");
  return normalized;
}

function smokeJobNameForRunId(runId = "") {
  assertRunId(runId);
  return `medopl-service-smoke-${runId}`;
}

function endpointForService(service) {
  return {
    service: service.name,
    namespace: FIXED_NAMESPACE,
    serviceDns: service.serviceDns,
    port: 8080,
    path: service.path,
    url: `http://${service.serviceDns}:8080${service.path}`,
    containerName: service.containerName,
  };
}

function curlArgs(endpoint) {
  return [
    "--silent",
    "--show-error",
    "--location",
    "--connect-timeout",
    "3",
    "--max-time",
    "10",
    "--fail-with-body",
    "--output",
    "-",
    "--write-out",
    [
      "",
      `service=${endpoint.service}`,
      `url=${endpoint.url}`,
      "http_code=%{http_code}",
      "exit_code=%{exitcode}",
      "total_time=%{time_total}",
      "error_class=curl_exit_%{exitcode}",
      "",
    ].join("\n"),
    endpoint.url,
  ];
}

function materializeSmokeJobManifest({ runId }) {
  const name = smokeJobNameForRunId(runId);
  return {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name,
      namespace: FIXED_NAMESPACE,
      labels: {
        "app.kubernetes.io/name": "medopl-service-reachability-smoke",
        "app.kubernetes.io/part-of": "medopl-package-d",
        "medopl.io/run-id": runId,
        "medopl.io/scope": "package-d-service-reachability",
      },
    },
    spec: {
      backoffLimit: 0,
      template: {
        metadata: {
          labels: {
            "app.kubernetes.io/name": "medopl-service-reachability-smoke",
            "app.kubernetes.io/part-of": "medopl-package-d",
            "medopl.io/run-id": runId,
          },
        },
        spec: {
          restartPolicy: "Never",
          serviceAccountName: "medopl-platform-runner",
          nodeSelector: { "node.tke.cloud.tencent.com/machineset": FIXED_PLATFORM_NODE_POOL_ID },
          containers: SERVICES.map((service) => {
            const endpoint = endpointForService(service);
            return {
              name: service.containerName,
              image: SMOKE_IMAGE,
              imagePullPolicy: "IfNotPresent",
              command: ["curl"],
              args: curlArgs(endpoint),
              securityContext: {
                runAsNonRoot: true,
                runAsUser: 1000,
                runAsGroup: 1000,
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: true,
                capabilities: { drop: ["ALL"] },
              },
            };
          }),
        },
      },
    },
  };
}

function assertSmokeJobManifestBoundary(manifest = {}) {
  const serialized = JSON.stringify(manifest);
  if (serialized.includes("medopl-tenant-")) throw new Error("package_d_service_reachability_references_tenant_pool");
  if (serialized.includes("postgresql://")) throw new Error("package_d_service_reachability_exposes_db_url");
  if (serialized.includes("client-key-data") || serialized.includes("client-certificate-data")) {
    throw new Error("package_d_service_reachability_embeds_kubeconfig");
  }
  if (manifest.kind !== "Job") throw new Error("package_d_service_reachability_job_kind_mismatch");
  if (manifest.metadata?.namespace !== FIXED_NAMESPACE) throw new Error("package_d_service_reachability_namespace_mismatch");
  if (!String(manifest.metadata?.name || "").startsWith("medopl-service-smoke-")) {
    throw new Error("package_d_service_reachability_job_name_mismatch");
  }
  const podSpec = manifest.spec?.template?.spec || {};
  if (podSpec.serviceAccountName !== "medopl-platform-runner") throw new Error("package_d_service_reachability_service_account_mismatch");
  if (podSpec.nodeSelector?.["node.tke.cloud.tencent.com/machineset"] !== FIXED_PLATFORM_NODE_POOL_ID) {
    throw new Error("package_d_service_reachability_scheduling_mismatch");
  }
  if (Object.hasOwn(podSpec.nodeSelector || {}, "medopl.io/nodepool-role")) {
    throw new Error("package_d_service_reachability_uses_retired_selector");
  }
  const expectedEndpoints = SERVICES.map((service) => endpointForService(service).url);
  const containers = podSpec.containers || [];
  if (containers.length !== SERVICES.length) throw new Error("package_d_service_reachability_container_count_mismatch");
  for (const [index, service] of SERVICES.entries()) {
    const container = containers[index] || {};
    if (container.name !== service.containerName) throw new Error(`package_d_service_reachability_container_name_mismatch:${service.name}`);
    if (container.image !== SMOKE_IMAGE || container.image.endsWith(":latest")) {
      throw new Error("package_d_service_reachability_smoke_image_mismatch");
    }
    if (JSON.stringify(container.command) !== JSON.stringify(["curl"])) {
      throw new Error("package_d_service_reachability_arbitrary_shell_forbidden");
    }
    if (container.args?.at(-1) !== expectedEndpoints[index]) {
      throw new Error(`package_d_service_reachability_endpoint_mismatch:${service.name}`);
    }
    if (!container.args?.includes("--connect-timeout") || !container.args?.includes("--max-time") || !container.args?.includes("--fail-with-body")) {
      throw new Error(`package_d_service_reachability_curl_fail_fast_required:${service.name}`);
    }
    const securityContext = container.securityContext || {};
    if (securityContext.runAsNonRoot !== true || securityContext.runAsUser !== 1000 || securityContext.runAsGroup !== 1000) {
      throw new Error(`package_d_service_reachability_numeric_non_root_security_context_required:${service.name}`);
    }
    if (securityContext.allowPrivilegeEscalation !== false || securityContext.readOnlyRootFilesystem !== true) {
      throw new Error(`package_d_service_reachability_restricted_security_context_required:${service.name}`);
    }
    if (JSON.stringify(securityContext.capabilities?.drop || []) !== JSON.stringify(["ALL"])) {
      throw new Error(`package_d_service_reachability_capabilities_drop_all_required:${service.name}`);
    }
    const writeOut = container.args?.[container.args.indexOf("--write-out") + 1] || "";
    if (!writeOut.includes("service=")) throw new Error(`package_d_service_reachability_curl_summary_missing:${service.name}:service`);
    if (!writeOut.includes("url=")) throw new Error(`package_d_service_reachability_curl_summary_missing:${service.name}:url`);
    if (!writeOut.includes("http_code=")) throw new Error(`package_d_service_reachability_curl_summary_missing:${service.name}:http_code`);
    if (!writeOut.includes("exit_code=")) throw new Error(`package_d_service_reachability_curl_summary_missing:${service.name}:exit_code`);
    if (!writeOut.includes("total_time=")) throw new Error(`package_d_service_reachability_curl_summary_missing:${service.name}:total_time`);
    if (!writeOut.includes("error_class=")) throw new Error(`package_d_service_reachability_curl_summary_missing:${service.name}:error_class`);
  }
}

function plannedCommands({ smokeJobName }) {
  return [
    { name: "kubectl_client_available", args: ["kubectl", "version", "--client"], kind: "readonly" },
    { name: "current_context", args: ["kubectl", "config", "current-context"], kind: "readonly" },
    { name: "namespace_read", args: ["kubectl", "get", "namespace", FIXED_NAMESPACE, "-o", "json"], kind: "readonly" },
    ...SERVICES.flatMap((service) => [
      { name: `deployment_read_${service.name}`, args: ["kubectl", "get", "deployment", service.name, "-n", FIXED_NAMESPACE, "-o", "json"], kind: "readonly_service_shape", service: service.name },
      { name: `service_read_${service.name}`, args: ["kubectl", "get", "service", service.name, "-n", FIXED_NAMESPACE, "-o", "json"], kind: "readonly_service_shape", service: service.name },
      { name: `pod_read_${service.name}`, args: ["kubectl", "get", "pods", "-n", FIXED_NAMESPACE, "-l", `app.kubernetes.io/name=${service.name}`, "-o", "json"], kind: "readonly_service_shape", service: service.name },
    ]),
    { name: "smoke_job_create", args: ["kubectl", "create", "-f", "-"], kind: "smoke_job_create" },
    { name: "smoke_job_wait_complete", args: ["kubectl", "wait", "--for=condition=complete", `job/${smokeJobName}`, "-n", FIXED_NAMESPACE, "--timeout=120s"], kind: "smoke_job_observe" },
    ...SERVICES.map((service) => ({
      name: `smoke_logs_${service.name}`,
      args: ["kubectl", "logs", `job/${smokeJobName}`, "-n", FIXED_NAMESPACE, "-c", service.containerName],
      kind: "smoke_job_logs",
      service: service.name,
      endpoint: endpointForService(service),
    })),
    { name: "smoke_job_cleanup", args: ["kubectl", "delete", "job", smokeJobName, "-n", FIXED_NAMESPACE, "--ignore-not-found=true", "--wait=false"], kind: "smoke_job_cleanup" },
  ];
}

function diagnosticsBaseCommands({ smokeJobName }) {
  return [
    { name: "diagnostic_job_get", args: ["kubectl", "get", "job", smokeJobName, "-n", FIXED_NAMESPACE, "-o", "json"], kind: "smoke_job_diagnostics_job_get" },
    { name: "diagnostic_job_describe", args: ["kubectl", "describe", "job", smokeJobName, "-n", FIXED_NAMESPACE], kind: "smoke_job_diagnostics_job_describe" },
    { name: "diagnostic_pods_get", args: ["kubectl", "get", "pods", "-n", FIXED_NAMESPACE, "-l", `job-name=${smokeJobName}`, "-o", "json"], kind: "smoke_job_diagnostics_pods_get" },
    { name: "diagnostic_job_events", args: ["kubectl", "get", "events", "-n", FIXED_NAMESPACE, "--field-selector", `involvedObject.name=${smokeJobName}`, "-o", "json"], kind: "smoke_job_diagnostics_job_events" },
    ...SERVICES.map((service) => ({
      name: `diagnostic_logs_${service.name}`,
      args: ["kubectl", "logs", `job/${smokeJobName}`, "-n", FIXED_NAMESPACE, "-c", service.containerName],
      kind: "smoke_job_logs",
      service: service.name,
      endpoint: endpointForService(service),
    })),
  ];
}

function diagnosticPodEventCommand({ smokeJobName, podName }) {
  if (!podName.startsWith(`${smokeJobName}-`)) throw new Error("package_d_service_reachability_pod_event_scope_mismatch");
  return {
    name: `diagnostic_pod_events_${podName}`,
    args: ["kubectl", "get", "events", "-n", FIXED_NAMESPACE, "--field-selector", `involvedObject.name=${podName}`, "-o", "json"],
    kind: "smoke_job_diagnostics_pod_events",
    podName,
  };
}

function assertKubectlCommandAllowed(command = {}, smokeJobName = "") {
  const args = command.args || [];
  const joined = ` ${args.join(" ")} `;
  if (args[0] !== "kubectl") throw new Error("package_d_service_reachability_command_must_be_kubectl");
  for (const forbidden of [" apply ", " patch ", " scale ", " rollout ", " exec ", " cp ", " replace "]) {
    if (joined.includes(forbidden)) throw new Error(`package_d_service_reachability_kubectl_forbidden:${forbidden.trim()}`);
  }
  if (joined.includes(" medopl-tenant-")) throw new Error("package_d_service_reachability_tenant_pool_forbidden");
  if (args.includes("--all-namespaces")) throw new Error("package_d_service_reachability_all_namespaces_forbidden");

  if (command.kind === "readonly") {
    const allowedReadonly = new Set([
      "kubectl version --client",
      "kubectl config current-context",
      `kubectl get namespace ${FIXED_NAMESPACE} -o json`,
    ]);
    if (!allowedReadonly.has(args.join(" "))) throw new Error("package_d_service_reachability_readonly_command_not_allowlisted");
    return;
  }
  if (command.kind === "readonly_service_shape") {
    if (!(args.includes("-n") && args.includes(FIXED_NAMESPACE))) throw new Error("package_d_service_reachability_read_namespace_required");
    const serviceNames = new Set(SERVICES.map((service) => service.name));
    if (args[2] === "deployment" || args[2] === "service") {
      if (!serviceNames.has(args[3])) throw new Error("package_d_service_reachability_service_not_allowlisted");
      return;
    }
    if (args[2] === "pods") {
      const selector = args[args.indexOf("-l") + 1] || "";
      const serviceName = selector.slice("app.kubernetes.io/name=".length);
      if (!selector.startsWith("app.kubernetes.io/name=") || !serviceNames.has(serviceName)) {
        throw new Error("package_d_service_reachability_pod_selector_not_allowlisted");
      }
      return;
    }
    throw new Error("package_d_service_reachability_read_resource_not_allowlisted");
  }
  if (command.kind === "smoke_job_create") {
    if (JSON.stringify(args) !== JSON.stringify(["kubectl", "create", "-f", "-"])) {
      throw new Error("package_d_service_reachability_create_must_use_stdin");
    }
    return;
  }
  if (command.kind === "smoke_job_observe") {
    const expected = ["kubectl", "wait", "--for=condition=complete", `job/${smokeJobName}`, "-n", FIXED_NAMESPACE, "--timeout=120s"];
    if (JSON.stringify(args) !== JSON.stringify(expected)) throw new Error("package_d_service_reachability_wait_scope_mismatch");
    return;
  }
  if (command.kind === "smoke_job_logs") {
    const expectedContainers = new Set(SERVICES.map((service) => service.containerName));
    if (args[1] !== "logs" || args[2] !== `job/${smokeJobName}` || !args.includes("-n") || !args.includes(FIXED_NAMESPACE)) {
      throw new Error("package_d_service_reachability_logs_scope_mismatch");
    }
    if (!expectedContainers.has(args[args.indexOf("-c") + 1])) throw new Error("package_d_service_reachability_logs_container_not_allowlisted");
    return;
  }
  if (command.kind === "smoke_job_diagnostics_job_get") {
    const expected = ["kubectl", "get", "job", smokeJobName, "-n", FIXED_NAMESPACE, "-o", "json"];
    if (JSON.stringify(args) !== JSON.stringify(expected)) throw new Error("package_d_service_reachability_diagnostic_job_get_scope_mismatch");
    return;
  }
  if (command.kind === "smoke_job_diagnostics_job_describe") {
    const expected = ["kubectl", "describe", "job", smokeJobName, "-n", FIXED_NAMESPACE];
    if (JSON.stringify(args) !== JSON.stringify(expected)) throw new Error("package_d_service_reachability_diagnostic_job_describe_scope_mismatch");
    return;
  }
  if (command.kind === "smoke_job_diagnostics_pods_get") {
    const expected = ["kubectl", "get", "pods", "-n", FIXED_NAMESPACE, "-l", `job-name=${smokeJobName}`, "-o", "json"];
    if (JSON.stringify(args) !== JSON.stringify(expected)) throw new Error("package_d_service_reachability_diagnostic_pods_get_scope_mismatch");
    return;
  }
  if (command.kind === "smoke_job_diagnostics_job_events") {
    const expected = ["kubectl", "get", "events", "-n", FIXED_NAMESPACE, "--field-selector", `involvedObject.name=${smokeJobName}`, "-o", "json"];
    if (JSON.stringify(args) !== JSON.stringify(expected)) throw new Error("package_d_service_reachability_diagnostic_job_events_scope_mismatch");
    return;
  }
  if (command.kind === "smoke_job_diagnostics_pod_events") {
    const podName = command.podName || "";
    if (!podName.startsWith(`${smokeJobName}-`)) throw new Error("package_d_service_reachability_diagnostic_pod_events_scope_mismatch");
    const expected = ["kubectl", "get", "events", "-n", FIXED_NAMESPACE, "--field-selector", `involvedObject.name=${podName}`, "-o", "json"];
    if (JSON.stringify(args) !== JSON.stringify(expected)) throw new Error("package_d_service_reachability_diagnostic_pod_events_scope_mismatch");
    return;
  }
  if (command.kind === "smoke_job_cleanup") {
    const expected = ["kubectl", "delete", "job", smokeJobName, "-n", FIXED_NAMESPACE, "--ignore-not-found=true", "--wait=false"];
    if (JSON.stringify(args) !== JSON.stringify(expected)) throw new Error("package_d_service_reachability_cleanup_scope_mismatch");
    return;
  }
  throw new Error("package_d_service_reachability_kubectl_command_kind_not_allowlisted");
}

function defaultKubectlExecutor({ args, stdin = "", env = {} }) {
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

function redactedCommand(args = []) {
  return args.map((arg, index) => (args[index - 1] === "-f" ? "REDACTED_STDIN_SMOKE_JOB_MANIFEST" : arg)).join(" ");
}

function redactCommandOutput(value = "") {
  return String(value || "")
    .replaceAll(/postgresql:\/\/[^\s"']+/gu, "REDACTED_POSTGRES_URL")
    .replaceAll(/uswccr\.ccs\.tencentyun\.com\/medopl\/[A-Za-z0-9._-]+:[A-Za-z0-9._-]+/gu, "REDACTED_IMAGE_REF")
    .replaceAll(/(token|password|secret)["':=][^,\s"']+/giu, "$1=REDACTED");
}

function messageSummary(value = "", limit = 420) {
  const redacted = redactCommandOutput(value || "")
    .replaceAll(/\s+/gu, " ")
    .trim();
  return redacted ? redacted.slice(0, limit) : "";
}

function parseNamespaceName(stdout = "") {
  try {
    return JSON.parse(stdout)?.metadata?.name || "";
  } catch {
    return "";
  }
}

function parseDeploymentReady(stdout = "") {
  try {
    const status = JSON.parse(stdout)?.status || {};
    return Number(status.readyReplicas || 0) >= 1 && Number(status.availableReplicas || 0) >= 1;
  } catch {
    return false;
  }
}

function parseServiceShape(stdout = "") {
  try {
    const service = JSON.parse(stdout);
    const port = service?.spec?.ports?.[0] || {};
    return service?.spec?.type === "ClusterIP" && port.name === "http" && port.port === 8080;
  } catch {
    return false;
  }
}

function parseHttpStatus(stdout = "") {
  const match = String(stdout || "").match(/(?:HTTP_STATUS:|http_code=)(\d{3})/u);
  return match ? Number(match[1]) : 0;
}

function parseCurlField(stdout = "", field = "") {
  const escaped = field.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = String(stdout || "").match(new RegExp(`^${escaped}=([^\\r\\n]*)`, "mu"));
  return match ? match[1].trim() : "";
}

function parseCurlExitCode(stdout = "") {
  const value = parseCurlField(stdout, "exit_code");
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function curlErrorClassForExitCode(exitCode) {
  if (exitCode === null || exitCode === undefined) return "";
  if (exitCode === 0) return "";
  if (exitCode === 6) return "dns_resolution_failed";
  if (exitCode === 7) return "connection_failed";
  if (exitCode === 22) return "http_status_failed";
  if (exitCode === 28) return "timeout_or_connection_failed";
  if (exitCode === 35 || exitCode === 60) return "tls_error";
  return `curl_exit_${exitCode}`;
}

function parseCurlErrorClass(stdout = "", stderr = "") {
  const explicit = parseCurlField(stdout, "error_class");
  const exitCode = parseCurlExitCode(stdout);
  if (explicit && !/^curl_exit_0$/u.test(explicit)) {
    if (/^curl_exit_\d+$/u.test(explicit)) return curlErrorClassForExitCode(Number(explicit.slice("curl_exit_".length)));
    return messageSummary(explicit, 120) || curlErrorClassForExitCode(exitCode);
  }
  const stderrSummary = messageSummary(stderr, 120).toLowerCase();
  if (stderrSummary.includes("timed out") || stderrSummary.includes("timeout")) return "timeout_or_connection_failed";
  if (stderrSummary.includes("could not resolve")) return "dns_resolution_failed";
  if (stderrSummary.includes("connection refused") || stderrSummary.includes("failed to connect")) return "connection_failed";
  return curlErrorClassForExitCode(exitCode);
}

function structuredCurlBody(stdout = "") {
  return String(stdout || "")
    .split(/\r?\n/u)
    .filter((line) => !/^(HTTP_STATUS:\d{3}|service=|url=|http_code=|exit_code=|total_time=|error_class=)/u.test(line))
    .join("\n")
    .trim();
}

function bodySummaryClass(stdout = "") {
  const body = structuredCurlBody(stdout);
  return body ? "present_redacted" : "empty";
}

function curlTotalTimeClass(stdout = "") {
  return parseCurlField(stdout, "total_time") ? "present_redacted" : "empty";
}

function parseJson(stdout = "", fallback = {}) {
  try {
    return JSON.parse(stdout);
  } catch {
    return fallback;
  }
}

function summarizeJobGet(stdout = "") {
  const job = parseJson(stdout);
  const status = job.status || {};
  return {
    name: job.metadata?.name || "",
    namespace: job.metadata?.namespace || "",
    status: {
      active: Number(status.active || 0),
      succeeded: Number(status.succeeded || 0),
      failed: Number(status.failed || 0),
      conditions: (status.conditions || []).map((condition) => ({
        type: condition.type || "",
        status: condition.status || "",
        reason: condition.reason || "",
        messageSummary: messageSummary(condition.message || ""),
        messageClass: condition.message ? "present_redacted" : "empty",
      })),
    },
  };
}

function summarizeEvents(stdout = "") {
  const events = parseJson(stdout, { items: [] });
  return {
    items: (events.items || []).map((event) => ({
      type: event.type || "",
      reason: event.reason || "",
      involvedObjectKind: event.involvedObject?.kind || "",
      involvedObjectName: event.involvedObject?.name || "",
      messageSummary: messageSummary(event.message || ""),
      messageClass: event.message ? "present_redacted" : "empty",
      count: Number(event.count || event.series?.count || 0),
      firstTimestamp: event.firstTimestamp || event.eventTime || "",
      lastTimestamp: event.lastTimestamp || event.eventTime || "",
    })),
  };
}

function imagePullStatusForContainer(status = {}) {
  const reason = status.state?.waiting?.reason || status.lastState?.waiting?.reason || "";
  if (["ImagePullBackOff", "ErrImagePull", "InvalidImageName"].includes(reason)) return reason;
  return reason ? "not_image_pull_related" : "";
}

function summarizeContainerState(state = {}) {
  const summary = {};
  if (state.waiting) {
    summary.waiting = {
      reason: state.waiting.reason || "",
      messageSummary: messageSummary(state.waiting.message || ""),
    };
  }
  if (state.running) {
    summary.running = {
      startedAt: state.running.startedAt || "",
    };
  }
  if (state.terminated) {
    summary.terminated = {
      reason: state.terminated.reason || "",
      messageSummary: messageSummary(state.terminated.message || ""),
      exitCode: Number.isInteger(state.terminated.exitCode) ? state.terminated.exitCode : null,
      startedAt: state.terminated.startedAt || "",
      finishedAt: state.terminated.finishedAt || "",
    };
  }
  return summary;
}

function summarizePods(stdout = "") {
  const pods = parseJson(stdout, { items: [] });
  return {
    items: (pods.items || []).map((pod) => ({
      name: pod.metadata?.name || "",
      namespace: pod.metadata?.namespace || "",
      phase: pod.status?.phase || "",
      reason: pod.status?.reason || "",
      messageSummary: messageSummary(pod.status?.message || ""),
      nodeName: pod.status?.nodeName || "",
      hostIP: pod.status?.hostIP || "",
      containerStatuses: (pod.status?.containerStatuses || []).map((status) => ({
        name: status.name || "",
        image: status.image || "",
        ready: status.ready === true,
        restartCount: Number(status.restartCount || 0),
        state: summarizeContainerState(status.state || {}),
        lastState: summarizeContainerState(status.lastState || {}),
        waitingReason: status.state?.waiting?.reason || "",
        terminatedReason: status.state?.terminated?.reason || "",
        exitCode: Number.isInteger(status.state?.terminated?.exitCode) ? status.state.terminated.exitCode : null,
        imagePullStatus: imagePullStatusForContainer(status),
      })),
    })),
  };
}

async function writeEvidence({ evidenceDir, filename, payload }) {
  await mkdir(evidenceDir, { recursive: true });
  const target = path.join(evidenceDir, filename);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

function summarizeKubectlResult(command = {}, result = {}) {
  const status = Number.isInteger(result?.status) ? result.status : 1;
  const isSmokeLog = command.kind === "smoke_job_logs";
  const stdoutSummary = isSmokeLog
    ? `HTTP_STATUS:${parseHttpStatus(result.stdout || "") || "unknown"} EXIT_CODE:${parseCurlExitCode(result.stdout || "") ?? "unknown"}`
    : redactCommandOutput(result.stdout || "").slice(0, 240);
  return {
    name: command.name,
    kind: command.kind,
    service: command.service || "",
    command: redactedCommand(command.args),
    exitCode: status,
    stdoutClass: status === 0 && result.stdout ? "present_redacted" : "empty",
    stderrClass: result.stderr ? "present_redacted" : "empty",
    stdoutSummary,
    stderrSummary: redactCommandOutput(result.stderr || "").slice(0, 240),
  };
}

function assertNoPlaintextEvidence(payload = {}) {
  const audit = redactionAudit(JSON.stringify(payload));
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_service_reachability_redaction_audit_failed");
  return audit;
}

async function collectWaitFailureDiagnostics({
  plan,
  kubectlExecutor,
  kubeconfigPath,
  scopedEvidenceDir,
  commandRecords,
  failedStep,
}) {
  const smokeJobName = plan.smokeJob.name;
  const commands = diagnosticsBaseCommands({ smokeJobName }).map((command) => {
    assertKubectlCommandAllowed(command, smokeJobName);
    return command;
  });
  const diagnosticsResults = new Map();
  for (const command of commands) {
    const result = await kubectlExecutor({ args: command.args, stdin: "", env: { [KUBE_ENV_NAME]: kubeconfigPath } });
    commandRecords.push(summarizeKubectlResult(command, result));
    diagnosticsResults.set(command.name, result);
  }

  const pods = summarizePods(diagnosticsResults.get("diagnostic_pods_get")?.stdout || "");
  const podEvents = [];
  for (const pod of pods.items) {
    const podEventCommand = diagnosticPodEventCommand({ smokeJobName, podName: pod.name });
    assertKubectlCommandAllowed(podEventCommand, smokeJobName);
    const result = await kubectlExecutor({ args: podEventCommand.args, stdin: "", env: { [KUBE_ENV_NAME]: kubeconfigPath } });
    commandRecords.push(summarizeKubectlResult(podEventCommand, result));
    podEvents.push({
      podName: pod.name,
      ...summarizeEvents(result.stdout || ""),
    });
  }

  const diagnostics = {
    ok: true,
    contract: "package_d_service_reachability_wait_failure_diagnostics",
    runId: plan.runId,
    failedStep,
    target: plan.target,
    job: {
      name: smokeJobName,
      namespace: FIXED_NAMESPACE,
      get: summarizeJobGet(diagnosticsResults.get("diagnostic_job_get")?.stdout || ""),
      describe: summarizeKubectlResult(
        { name: "diagnostic_job_describe", args: ["kubectl", "describe", "job", smokeJobName, "-n", FIXED_NAMESPACE], kind: "smoke_job_diagnostics_job_describe" },
        diagnosticsResults.get("diagnostic_job_describe") || {},
      ),
    },
    pods,
    events: {
      job: summarizeEvents(diagnosticsResults.get("diagnostic_job_events")?.stdout || ""),
      pods: podEvents,
    },
    logs: SERVICES.map((service) => {
      const result = diagnosticsResults.get(`diagnostic_logs_${service.name}`) || {};
      const logsAvailable = Boolean(result.stdout);
      const exitCode = parseCurlExitCode(result.stdout || "");
      return {
        service: service.name,
        url: endpointForService(service).url,
        containerName: service.containerName,
        httpStatus: parseHttpStatus(result.stdout || ""),
        exitCode,
        totalTimeClass: curlTotalTimeClass(result.stdout || ""),
        errorClass: parseCurlErrorClass(result.stdout || "", result.stderr || ""),
        bodySummaryClass: bodySummaryClass(result.stdout || ""),
        logsAvailable,
        unavailableReason: logsAvailable ? "" : messageSummary(result.stderr || "logs_not_available"),
        stdoutClass: result.stdout ? "present_redacted" : "empty",
        stderrClass: result.stderr ? "present_redacted" : "empty",
        stderrSummary: redactCommandOutput(result.stderr || "").slice(0, 240),
      };
    }),
    redactionAudit: {},
  };
  diagnostics.redactionAudit = assertNoPlaintextEvidence(diagnostics);
  const diagnosticsPath = await writeEvidence({
    evidenceDir: scopedEvidenceDir,
    filename: "diagnostics-redacted.json",
    payload: diagnostics,
  });
  return { diagnosticsPath, diagnostics };
}

export async function buildPackageDServiceReachabilityPlan({
  deployEnvPath,
  runtimeEnvPath,
  kubeconfigPath,
  evidenceRoot = DEFAULT_EVIDENCE_ROOT,
  runId,
  mode = MODE,
  authorized = false,
  argv = [],
} = {}) {
  parseArgs(argv);
  const normalizedMode = assertMode(mode);
  assertAuthorized(authorized);
  assertRunId(runId);
  assertFile(deployEnvPath, "package_d_deploy_env_missing");
  assertFile(runtimeEnvPath, "package_d_runtime_env_missing");
  assertFile(kubeconfigPath, "package_d_kubeconfig_missing");

  const deployEnv = parseEnv(await readFile(deployEnvPath, "utf8"), DEPLOY_ENV_KEYS, REQUIRED_DEPLOY_ENV_KEYS);
  const runtimeEnv = parseEnv(await readFile(runtimeEnvPath, "utf8"), RUNTIME_ENV_KEYS);
  assertTargetEnv({ deployEnv, runtimeEnv, kubeconfigPath });
  const clusterAuth = kubeconfigSummary(await readFile(kubeconfigPath, "utf8"));
  const smokeJobName = smokeJobNameForRunId(runId);
  const smokeJobManifest = materializeSmokeJobManifest({ runId });
  assertSmokeJobManifestBoundary(smokeJobManifest);
  const commands = plannedCommands({ smokeJobName }).map((command) => {
    assertKubectlCommandAllowed(command, smokeJobName);
    return command;
  });
  const scopedEvidenceDir = path.join(evidenceRoot, runId);
  const endpoints = SERVICES.map(endpointForService);
  const plan = {
    ok: true,
    contract: "package_d_service_reachability_runner",
    mode: normalizedMode,
    command: PACKAGE_D_SERVICE_REACHABILITY_COMMAND,
    runId,
    target: {
      clusterId: FIXED_CLUSTER_ID,
      namespace: FIXED_NAMESPACE,
      platformNodePoolId: FIXED_PLATFORM_NODE_POOL_ID,
    },
    env: {
      deployEnvPath: "authorized_package_d_deploy_env",
      runtimeEnvPath: "authorized_portal_runtime_env",
      kubeconfigPath: "authorized_kubeconfig_ref",
      tcrRegistry: deployEnv.TENCENT_TCR_REGISTRY,
      tcrNamespace: deployEnv.TENCENT_TCR_NAMESPACE,
      tcrRegion: deployEnv.TENCENT_TCR_REGION,
    },
    clusterAuth,
    endpoints,
    smokeJob: {
      name: smokeJobName,
      namespace: FIXED_NAMESPACE,
      cleanupPolicy: CLEANUP_POLICY,
      manifest: smokeJobManifest,
    },
    commands,
    evidence: {
      sink: ".runtime",
      path: path.join(scopedEvidenceDir, "readonly-service-reachability-redacted.json"),
      smokeJobManifestPath: path.join(scopedEvidenceDir, "smoke-job-manifest-redacted.json"),
      diagnosticsPath: path.join(scopedEvidenceDir, "diagnostics-redacted.json"),
    },
    boundary: {
      runTencentDeployExecution: deployEnv.RUN_TENCENT_DEPLOY_EXECUTION,
      readonlyKubernetesChecksAllowed: true,
      temporarySmokeJobAllowed: true,
      productionDeployAllowed: false,
      rolloutAllowed: false,
      rollbackAllowed: false,
      buildPushAllowed: false,
      tencentMutationAllowed: false,
      packageCLiveAllowed: false,
      arbitraryUrlAllowed: false,
      arbitraryShellAllowed: false,
      kubectlExecAllowed: false,
      deploymentServiceSecretConfigMapMutationAllowed: false,
      tenantPoolMutationAllowed: false,
      evidenceSink: ".runtime",
    },
    cleanupPolicy: CLEANUP_POLICY,
    realExecutionReady: false,
  };
  return plan;
}

export async function runPackageDServiceReachabilitySmoke({
  deployEnvPath,
  runtimeEnvPath,
  kubeconfigPath,
  evidenceRoot = DEFAULT_EVIDENCE_ROOT,
  runId,
  mode = MODE,
  authorized = false,
  kubectlExecutor = defaultKubectlExecutor,
} = {}) {
  const plan = await buildPackageDServiceReachabilityPlan({
    deployEnvPath,
    runtimeEnvPath,
    kubeconfigPath,
    evidenceRoot,
    runId,
    mode,
    authorized,
  });
  const scopedEvidenceDir = path.join(evidenceRoot, runId);
  await mkdir(scopedEvidenceDir, { recursive: true });
  await writeFile(plan.evidence.smokeJobManifestPath, `${JSON.stringify(plan.smokeJob.manifest, null, 2)}\n`);
  const manifestStdin = `${JSON.stringify(plan.smokeJob.manifest, null, 2)}\n`;
  const commandRecords = [];
  const shapeResults = new Map();
  const serviceResults = [];
  let namespaceStatus = "not_checked";
  let smokeJob = "not_created";
  let cleanup = "not_attempted";
  let firstFailure = "";
  let diagnosticsPath = "";

  for (const command of plan.commands) {
    const stdin = command.kind === "smoke_job_create" ? manifestStdin : "";
    const result = await kubectlExecutor({ args: command.args, stdin, env: { [KUBE_ENV_NAME]: kubeconfigPath } });
    const record = summarizeKubectlResult(command, result);
    commandRecords.push(record);
    if (record.exitCode !== 0 && command.kind !== "smoke_job_cleanup") {
      firstFailure = command.name;
    }
    if (command.name === "current_context" && result.status === 0 && !String(result.stdout || "").includes(FIXED_CLUSTER_ID)) {
      throw new Error("package_d_service_reachability_context_mismatch");
    }
    if (command.name === "namespace_read") {
      namespaceStatus = result.status === 0 && parseNamespaceName(result.stdout || "") === FIXED_NAMESPACE ? "present" : "mismatch_or_missing";
    }
    if (command.kind === "readonly_service_shape") {
      const previous = shapeResults.get(command.service) || { deploymentReady: false, serviceShape: false, podRead: false };
      if (command.name.startsWith("deployment_read_")) previous.deploymentReady = result.status === 0 && parseDeploymentReady(result.stdout || "");
      if (command.name.startsWith("service_read_")) previous.serviceShape = result.status === 0 && parseServiceShape(result.stdout || "");
      if (command.name.startsWith("pod_read_")) previous.podRead = result.status === 0;
      shapeResults.set(command.service, previous);
    }
    if (command.kind === "smoke_job_create" && result.status === 0) smokeJob = "created";
    if (command.kind === "smoke_job_logs") {
      const exitCode = parseCurlExitCode(result.stdout || "");
      serviceResults.push({
        service: command.service,
        url: command.endpoint.url,
        httpStatus: parseHttpStatus(result.stdout || ""),
        exitCode,
        totalTimeClass: curlTotalTimeClass(result.stdout || ""),
        errorClass: parseCurlErrorClass(result.stdout || "", result.stderr || ""),
        bodySummaryClass: bodySummaryClass(result.stdout || ""),
      });
    }
    if (command.kind === "smoke_job_cleanup") cleanup = result.status === 0 ? "deleted_after_log_collection" : "cleanup_failed";
    if (firstFailure && command.kind !== "smoke_job_cleanup") {
      const shouldContinueToCleanup = smokeJob === "created" && command.kind !== "smoke_job_cleanup";
      if (!shouldContinueToCleanup) break;
      if (command.kind === "smoke_job_observe") {
        const diagnosticsResult = await collectWaitFailureDiagnostics({
          plan,
          kubectlExecutor,
          kubeconfigPath,
          scopedEvidenceDir,
          commandRecords,
          failedStep: command.name,
        });
        diagnosticsPath = diagnosticsResult.diagnosticsPath;
      }
      const cleanupCommand = plan.commands.find((item) => item.kind === "smoke_job_cleanup");
      if (!cleanupCommand || command === cleanupCommand) break;
      const cleanupResult = await kubectlExecutor({ args: cleanupCommand.args, stdin: "", env: { [KUBE_ENV_NAME]: kubeconfigPath } });
      commandRecords.push(summarizeKubectlResult(cleanupCommand, cleanupResult));
      cleanup = cleanupResult.status === 0 ? "deleted_after_log_collection" : "cleanup_failed";
      break;
    }
  }

  const allShapesPass = SERVICES.every((service) => {
    const shape = shapeResults.get(service.name);
    return shape?.deploymentReady === true && shape?.serviceShape === true && shape?.podRead === true;
  });
  const reachabilityPassed = serviceResults.length === SERVICES.length && serviceResults.every((result) => result.httpStatus >= 200 && result.httpStatus < 400);
  const summary = {
    ok: !firstFailure && namespaceStatus === "present" && smokeJob === "created" && allShapesPass && reachabilityPassed && cleanup === "deleted_after_log_collection",
    contract: plan.contract,
    mode: plan.mode,
    runId,
    target: plan.target,
    kubernetesApiConnected: commandRecords.some((record) => record.name === "namespace_read" && record.exitCode === 0),
    namespaceStatus,
    deploymentServiceShapeChecks: allShapesPass ? "pass" : "fail",
    smokeJob,
    reachabilityPassed,
    cleanup,
    cleanupPolicy: plan.cleanupPolicy,
    serviceResults,
    failedStep: firstFailure,
    diagnostics: {
      collected: Boolean(diagnosticsPath),
      path: diagnosticsPath,
    },
    realExecutionReady: false,
  };
  const evidence = {
    ...summary,
    command: plan.command,
    endpoints: plan.endpoints,
    commands: commandRecords,
    boundary: plan.boundary,
    smokeJob: {
      name: plan.smokeJob.name,
      namespace: plan.smokeJob.namespace,
      cleanupPolicy: plan.smokeJob.cleanupPolicy,
      manifest: plan.smokeJob.manifest,
    },
    redactionAudit: {},
  };
  evidence.redactionAudit = assertNoPlaintextEvidence(evidence);
  const evidencePath = await writeEvidence({
    evidenceDir: scopedEvidenceDir,
    filename: "readonly-service-reachability-redacted.json",
    payload: evidence,
  });
  if (!summary.ok) throw new Error(`package_d_service_reachability_failed:${firstFailure || namespaceStatus || cleanup}`);
  return { ...summary, evidencePath, smokeJobManifestPath: plan.evidence.smokeJobManifestPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await runPackageDServiceReachabilitySmoke({
    deployEnvPath: args["deploy-env"],
    runtimeEnvPath: args["runtime-env"],
    kubeconfigPath: args.kubeconfig,
    runId: args["run-id"],
    mode: args.mode,
    evidenceRoot: args["evidence-root"],
    authorized: args.authorized === "1",
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
