import { RUN_ERROR_CODES, RUN_STAGES, buildRunError } from "./run-contract.mjs";

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function normalizeStage(stage = "") {
  const normalized = String(stage || "").trim();
  if (normalized === RUN_STAGES.USER_OWNED_RUNTIME_DISPATCH) return RUN_STAGES.PLATFORM_RUNTIME_DISPATCH;
  return normalized;
}

function normalizeCode(code = "") {
  const normalized = String(code || "").trim();
  if (normalized === RUN_ERROR_CODES.USER_OWNED_RUNTIME_AGENT_REQUIRED) {
    return RUN_ERROR_CODES.PLATFORM_RUNTIME_AGENT_REQUIRED;
  }
  return normalized;
}

export function mapRunError(error, context = {}) {
  const source = asObject(error);
  const code = normalizeCode(source.code || source.errorCode || "");
  const stage = normalizeStage(source.stage || "");
  const details = asObject(source.details);
  const correlationId = String(context.correlationId || source.correlationId || details.correlationId || "");

  if (code && stage) {
    try {
      return buildRunError({
        code,
        stage,
        message: source.message || "任务服务器启动失败，管理员可以用错误编号定位原因。",
        retryable: Boolean(source.retryable),
        details,
        correlationId,
      });
    } catch {
      return buildRunError({
        code: RUN_ERROR_CODES.RUNNER_UPSTREAM_5XX,
        stage: RUN_STAGES.RUNNER_SUBMIT,
        message: source.message || "任务服务器启动失败，管理员可以用错误编号定位原因。",
        retryable: true,
        details: { ...details, upstreamCode: code, upstreamStage: stage },
        correlationId,
      });
    }
  }

  if (code) {
    return buildRunError({
      code: code === "LAUNCH_TOKEN_INVALID" ? RUN_ERROR_CODES.LAUNCH_TOKEN_INVALID : RUN_ERROR_CODES.RUNNER_UPSTREAM_5XX,
      stage: code === "LAUNCH_TOKEN_INVALID" ? RUN_STAGES.RUNNER_SUBMIT : RUN_STAGES.RUNNER_SUBMIT,
      message: source.message || "任务服务器启动失败，管理员可以用错误编号定位原因。",
      retryable: code !== "LAUNCH_TOKEN_INVALID",
      details: { ...details, upstreamCode: code },
      correlationId,
    });
  }

  const message = String(source.message || source.error || error || "");
  if (/resource_order_prepare_failed/i.test(message)) {
    return buildRunError({
      code: RUN_ERROR_CODES.RESOURCE_ORDER_PREPARE_FAILED,
      stage: RUN_STAGES.RESOURCE_ORDER_PREPARE,
      retryable: false,
      details,
      correlationId,
    });
  }
  if (/workspace/i.test(message) && /runner/i.test(message)) {
    return buildRunError({
      code: RUN_ERROR_CODES.RUNNER_WORKSPACE_CREATE_FAILED,
      stage: RUN_STAGES.RUNNER_WORKSPACE_CREATE,
      retryable: true,
      details,
      correlationId,
    });
  }

  return buildRunError({
    code: RUN_ERROR_CODES.RUNNER_UPSTREAM_5XX,
    stage: RUN_STAGES.RUNNER_SUBMIT,
    message: source.message || "任务服务器启动失败，管理员可以用错误编号定位原因。",
    retryable: true,
    details,
    correlationId,
  });
}
