function joinedMessage(error) {
  return [
    String(error?.message || ""),
    String(error?.stdout || ""),
    String(error?.stderr || ""),
  ].join("\n").toLowerCase();
}

const KUBECTL_ERROR_RULES = Object.freeze([
  Object.freeze({
    code: "RUNNER_K8S_RBAC_DENIED",
    patterns: [/forbidden|cannot|permission|rbac|serviceaccount/],
  }),
  Object.freeze({
    code: "RUNNER_NAMESPACE_NOT_FOUND",
    patterns: [/namespace/, /not found|notfound/],
  }),
  Object.freeze({
    code: "RUNNER_MANIFEST_INVALID",
    patterns: [/dry-run|validation|invalid|error validating/],
  }),
]);

function baseDetailsFor(error, context = {}) {
  return {
    namespace: String(context.namespace || ""),
    jobName: String(context.jobName || ""),
    manifestPath: String(context.manifestPath || ""),
    exitCode: Number(error?.code ?? error?.exitCode ?? 1),
    stdout: String(error?.stdout || ""),
    stderr: String(error?.stderr || ""),
    correlationId: String(context.correlationId || ""),
  };
}

function ruleMatches(message, rule) {
  return rule.patterns.every((pattern) => pattern.test(message));
}

function errorCodeForMessage(message) {
  return KUBECTL_ERROR_RULES.find((rule) => ruleMatches(message, rule))?.code || "RUNNER_K8S_APPLY_FAILED";
}

export function classifyKubectlError(error, context = {}) {
  const message = joinedMessage(error);
  return {
    code: errorCodeForMessage(message),
    stage: "k8s_apply",
    retryable: false,
    details: baseDetailsFor(error, context),
  };
}
