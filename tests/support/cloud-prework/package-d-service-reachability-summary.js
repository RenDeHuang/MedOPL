import { redactionAudit } from "./package-d-kubernetes-api-preflight-runner.js";

export function redactedCommand(args = []) {
  return args.map((arg, index) => (args[index - 1] === "-f" ? "REDACTED_STDIN_SMOKE_JOB_MANIFEST" : arg)).join(" ");
}

export function redactCommandOutput(value = "") {
  return String(value || "")
    .replaceAll(/postgresql:\/\/[^\s"']+/gu, "REDACTED_POSTGRES_URL")
    .replaceAll(/uswccr\.ccs\.tencentyun\.com\/medopl\/[A-Za-z0-9._-]+:[A-Za-z0-9._-]+/gu, "REDACTED_IMAGE_REF")
    .replaceAll(/(token|password|secret)["':=][^,\s"']+/giu, "$1=REDACTED");
}

export function messageSummary(value = "", limit = 420) {
  const redacted = redactCommandOutput(value || "")
    .replaceAll(/\s+/gu, " ")
    .trim();
  return redacted ? redacted.slice(0, limit) : "";
}

export function parseNamespaceName(stdout = "") {
  try {
    return JSON.parse(stdout)?.metadata?.name || "";
  } catch {
    return "";
  }
}

export function parseDeploymentReady(stdout = "") {
  try {
    const status = JSON.parse(stdout)?.status || {};
    return Number(status.readyReplicas || 0) >= 1 && Number(status.availableReplicas || 0) >= 1;
  } catch {
    return false;
  }
}

export function parseServiceShape(stdout = "") {
  try {
    const service = JSON.parse(stdout);
    const port = service?.spec?.ports?.[0] || {};
    return service?.spec?.type === "ClusterIP" && port.name === "http" && port.port === 8080;
  } catch {
    return false;
  }
}

export function parseHttpStatus(stdout = "") {
  const match = String(stdout || "").match(/(?:HTTP_STATUS:|http_code=)(\d{3})/u);
  return match ? Number(match[1]) : 0;
}

export function parseCurlField(stdout = "", field = "") {
  const escaped = field.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = String(stdout || "").match(new RegExp(`^${escaped}=([^\\r\\n]*)`, "mu"));
  return match ? match[1].trim() : "";
}

export function parseCurlExitCode(stdout = "") {
  const value = parseCurlField(stdout, "exit_code");
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function curlErrorClassForExitCode(exitCode) {
  if (exitCode === null || exitCode === undefined) return "";
  if (exitCode === 0) return "";
  if (exitCode === 6) return "dns_resolution_failed";
  if (exitCode === 7) return "connection_failed";
  if (exitCode === 22) return "http_status_failed";
  if (exitCode === 28) return "timeout_or_connection_failed";
  if (exitCode === 35 || exitCode === 60) return "tls_error";
  return `curl_exit_${exitCode}`;
}

export function parseCurlErrorClass(stdout = "", stderr = "") {
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

export function structuredCurlBody(stdout = "") {
  return String(stdout || "")
    .split(/\r?\n/u)
    .filter((line) => !/^(HTTP_STATUS:\d{3}|service=|url=|http_code=|exit_code=|total_time=|error_class=)/u.test(line))
    .join("\n")
    .trim();
}

export function bodySummaryClass(stdout = "") {
  const body = structuredCurlBody(stdout);
  return body ? "present_redacted" : "empty";
}

export function curlTotalTimeClass(stdout = "") {
  return parseCurlField(stdout, "total_time") ? "present_redacted" : "empty";
}

export function parseJson(stdout = "", fallback = {}) {
  try {
    return JSON.parse(stdout);
  } catch {
    return fallback;
  }
}

export function summarizeJobGet(stdout = "") {
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

export function summarizeEvents(stdout = "") {
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

export function imagePullStatusForContainer(status = {}) {
  const reason = status.state?.waiting?.reason || status.lastState?.waiting?.reason || "";
  if (["ImagePullBackOff", "ErrImagePull", "InvalidImageName"].includes(reason)) return reason;
  return reason ? "not_image_pull_related" : "";
}

export function summarizeContainerState(state = {}) {
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

export function summarizePods(stdout = "") {
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

export function summarizeKubectlResult(command = {}, result = {}) {
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

export function assertNoPlaintextEvidence(payload = {}) {
  const audit = redactionAudit(JSON.stringify(payload));
  if (Object.values(audit).some(Boolean)) throw new Error("package_d_service_reachability_redaction_audit_failed");
  return audit;
}
