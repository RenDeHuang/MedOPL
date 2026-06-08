import { RUN_ERROR_CODES, RUN_STAGES, buildRunError } from "./run-contract.mjs";

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

export function mapRunError(error, context = {}) {
  const source = asObject(error);
  const code = String(source.code || source.errorCode || "").trim();
  const stage = String(source.stage || "").trim();
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
        code: RUN_ERROR_CODES.RUNTIME_UPSTREAM_5XX,
        stage: RUN_STAGES.RUNTIME_SUBMIT,
        message: source.message || "任务服务器启动失败，管理员可以用错误编号定位原因。",
        retryable: true,
        details: { ...details, upstreamCode: code, upstreamStage: stage },
        correlationId,
      });
    }
  }

  if (code) {
    return buildRunError({
      code: code === "LAUNCH_TOKEN_INVALID" ? RUN_ERROR_CODES.LAUNCH_TOKEN_INVALID : RUN_ERROR_CODES.RUNTIME_UPSTREAM_5XX,
      stage: RUN_STAGES.RUNTIME_SUBMIT,
      message: source.message || "任务服务器启动失败，管理员可以用错误编号定位原因。",
      retryable: code !== "LAUNCH_TOKEN_INVALID",
      details: { ...details, upstreamCode: code },
      correlationId,
    });
  }

  const message = String(source.message || source.error || error || "");
  if (/workspace/i.test(message) && /runtime/i.test(message)) {
    return buildRunError({
      code: RUN_ERROR_CODES.RUNTIME_WORKSPACE_CREATE_FAILED,
      stage: RUN_STAGES.RUNTIME_WORKSPACE_CREATE,
      retryable: true,
      details,
      correlationId,
    });
  }

  return buildRunError({
    code: RUN_ERROR_CODES.RUNTIME_UPSTREAM_5XX,
    stage: RUN_STAGES.RUNTIME_SUBMIT,
    message: source.message || "任务服务器启动失败，管理员可以用错误编号定位原因。",
    retryable: true,
    details,
    correlationId,
  });
}
