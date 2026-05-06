const PLATFORM_PROVISIONED_RUNTIME_DISPATCH = "platform_provisioned_runtime_dispatch";
const PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED = "PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED";

export const RUN_STAGES = Object.freeze({
  RESOURCE_ORDER_PREPARE: "resource_order_prepare",
  RUNNER_WORKSPACE_CREATE: "runner_workspace_create",
  RUNNER_SUBMIT: "runner_submit",
  K8S_APPLY: "k8s_apply",
  RUNNER_STATUS_SYNC: "runner_status_sync",
  PLATFORM_PROVISIONED_RUNTIME_DISPATCH,
  PLATFORM_RUNTIME_DISPATCH: PLATFORM_PROVISIONED_RUNTIME_DISPATCH,
  USER_OWNED_RUNTIME_DISPATCH: PLATFORM_PROVISIONED_RUNTIME_DISPATCH,
});

export const RUN_ERROR_CODES = Object.freeze({
  RESOURCE_ORDER_PREPARE_FAILED: "RESOURCE_ORDER_PREPARE_FAILED",
  RESOURCE_BINDING_REQUIRED: "RESOURCE_BINDING_REQUIRED",
  RUNNER_WORKSPACE_CREATE_FAILED: "RUNNER_WORKSPACE_CREATE_FAILED",
  RUNNER_K8S_APPLY_FAILED: "RUNNER_K8S_APPLY_FAILED",
  RUNNER_NAMESPACE_NOT_FOUND: "RUNNER_NAMESPACE_NOT_FOUND",
  RUNNER_K8S_RBAC_DENIED: "RUNNER_K8S_RBAC_DENIED",
  RUNNER_MANIFEST_INVALID: "RUNNER_MANIFEST_INVALID",
  RUNNER_UPSTREAM_5XX: "RUNNER_UPSTREAM_5XX",
  API_ONLY_RUN_UNSUPPORTED: "API_ONLY_RUN_UNSUPPORTED",
  LAUNCH_TOKEN_INVALID: "LAUNCH_TOKEN_INVALID",
  PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED,
  PLATFORM_RUNTIME_AGENT_REQUIRED: PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED,
  USER_OWNED_RUNTIME_AGENT_REQUIRED: PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED,
  RUNTIME_AGENT_RELAY_NOT_IMPLEMENTED: "RUNTIME_AGENT_RELAY_NOT_IMPLEMENTED",
});

const ALLOWED_STAGES = new Set(Object.values(RUN_STAGES));
const ALLOWED_ERROR_CODES = new Set(Object.values(RUN_ERROR_CODES));

function normalizeRunStage(value = "") {
  const stage = String(value || "");
  if (stage === "platform_runtime_dispatch" || stage === "user_owned_runtime_dispatch") {
    return PLATFORM_PROVISIONED_RUNTIME_DISPATCH;
  }
  return stage;
}

function normalizeRunErrorCode(value = "") {
  const code = String(value || "");
  if (code === "PLATFORM_RUNTIME_AGENT_REQUIRED" || code === "USER_OWNED_RUNTIME_AGENT_REQUIRED") {
    return PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED;
  }
  return code;
}

export function buildRunError(input = {}) {
  const code = normalizeRunErrorCode(input.code);
  const stage = normalizeRunStage(input.stage);
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
