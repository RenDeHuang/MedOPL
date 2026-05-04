export const RUN_STAGES = Object.freeze({
  RESOURCE_ORDER_PREPARE: "resource_order_prepare",
  RUNNER_WORKSPACE_CREATE: "runner_workspace_create",
  RUNNER_SUBMIT: "runner_submit",
  K8S_APPLY: "k8s_apply",
  RUNNER_STATUS_SYNC: "runner_status_sync",
});

export const RUN_ERROR_CODES = Object.freeze({
  RESOURCE_ORDER_PREPARE_FAILED: "RESOURCE_ORDER_PREPARE_FAILED",
  RUNNER_WORKSPACE_CREATE_FAILED: "RUNNER_WORKSPACE_CREATE_FAILED",
  RUNNER_K8S_APPLY_FAILED: "RUNNER_K8S_APPLY_FAILED",
  RUNNER_NAMESPACE_NOT_FOUND: "RUNNER_NAMESPACE_NOT_FOUND",
  RUNNER_K8S_RBAC_DENIED: "RUNNER_K8S_RBAC_DENIED",
  RUNNER_MANIFEST_INVALID: "RUNNER_MANIFEST_INVALID",
  RUNNER_UPSTREAM_5XX: "RUNNER_UPSTREAM_5XX",
  LAUNCH_TOKEN_INVALID: "LAUNCH_TOKEN_INVALID",
});

const ALLOWED_STAGES = new Set(Object.values(RUN_STAGES));
const ALLOWED_ERROR_CODES = new Set(Object.values(RUN_ERROR_CODES));

export function buildRunError(input = {}) {
  const code = String(input.code || "");
  const stage = String(input.stage || "");
  if (!ALLOWED_ERROR_CODES.has(code)) throw new Error(`unknown_run_error_code:${code}`);
  if (!ALLOWED_STAGES.has(stage)) throw new Error(`unknown_run_stage:${stage}`);
  return {
    code,
    stage,
    message: String(input.message || "任务服务器启动失败，管理员可以用错误编号定位原因。"),
    retryable: Boolean(input.retryable),
    details: input.details && typeof input.details === "object" ? input.details : {},
    correlationId: String(input.correlationId || ""),
  };
}
