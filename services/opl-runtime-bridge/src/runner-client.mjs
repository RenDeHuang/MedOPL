const RUNNER_URL = String(process.env.MED_AUTOSCIENCE_RUNNER_URL || "").replace(/\/$/, "");
const RUNNER_TOKEN = String(process.env.MED_AUTOSCIENCE_RUNNER_TOKEN || "");

function requireRunnerUrl() {
  if (!RUNNER_URL) {
    throw new Error("MED_AUTOSCIENCE_RUNNER_URL is required for runtime runs");
  }
  return RUNNER_URL;
}

function authHeaders() {
  return RUNNER_TOKEN ? { authorization: `Bearer ${RUNNER_TOKEN}` } : {};
}

async function requestJson(path, options = {}) {
  const base = requireRunnerUrl();
  const response = await fetch(new URL(path, `${base}/`), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const runnerError = payload?.error && typeof payload.error === "object"
      ? payload.error
      : { message: payload?.error || payload?.message || `med_autoscience_runner_failed:${response.status}:${path}` };
    const sanitizedMessage = "任务服务器启动失败，管理员可以用错误编号定位原因。";
    const error = new Error(sanitizedMessage);
    error.code = String(runnerError.code || "RUNNER_UPSTREAM_5XX");
    error.stage = String(runnerError.stage || "runner_submit");
    error.retryable = Boolean(runnerError.retryable);
    error.details = runnerError.details && typeof runnerError.details === "object" ? runnerError.details : {};
    error.correlationId = String(runnerError.correlationId || "");
    error.status = response.status;
    error.payload = payload && typeof payload === "object" ? payload : {};
    throw error;
  }
  return payload;
}

function firstFrom(payload, key) {
  if (payload?.[key] && typeof payload[key] === "object" && !Array.isArray(payload[key])) {
    return payload[key];
  }
  return payload;
}

function arrayFrom(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.[key]?.items)) return payload[key].items;
  return [];
}

export function hasRunner() {
  return Boolean(RUNNER_URL);
}

export async function createWorkspace(context) {
  return firstFrom(await requestJson("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(context),
  }), "workspace");
}

export async function submitRun(context) {
  return firstFrom(await requestJson("/api/runs", {
    method: "POST",
    body: JSON.stringify(context),
  }), "run");
}

export async function getRunStatus(runId) {
  return firstFrom(await requestJson(`/api/runs/${encodeURIComponent(runId)}/status`), "run");
}

export async function getRunLogs(runId) {
  const payload = await requestJson(`/api/runs/${encodeURIComponent(runId)}/logs`);
  return payload.logs || payload.text || "";
}

export async function listOutputs(context) {
  const customerId = encodeURIComponent(context.customerId || context.portalUserId || context.userId || "");
  const workspaceId = encodeURIComponent(context.workspaceId || "");
  const payload = await requestJson(`/api/workspaces/${customerId}/${workspaceId}/outputs`);
  return arrayFrom(payload, "outputs");
}
