export const API_VERSIONS = Object.freeze({
  GetCallerIdentity: "v20180813",
  DescribeClusters: "v20220501",
  DescribeNodePools: "v20220501",
  CreateNodePool: "v20220501",
  ScaleNodePool: "v20220501",
  DeleteNodePool: "v20220501",
  TagResources: "v20180813",
  GetResources: "v20180813",
});

function normalizeRequestId(response = {}) {
  const value = response?.RequestId;
  return value ? String(value).slice(0, 96) : "";
}

export function sanitizedStep(api, status, response = {}, extra = {}) {
  return {
    api,
    action: api,
    ...(API_VERSIONS[api] ? { apiVersion: API_VERSIONS[api] } : {}),
    status,
    ...(extra.nodePoolId ? { nodePoolId: extra.nodePoolId } : {}),
    ...(extra.nodePoolName ? { nodePoolName: extra.nodePoolName } : {}),
    ...(Number.isInteger(extra.replicas) ? { replicas: extra.replicas } : {}),
    ...(extra.region ? { region: extra.region } : {}),
    ...(normalizeRequestId(response) ? { requestId: normalizeRequestId(response) } : {}),
  };
}

function redactedText(value = "") {
  const placeholder = "[redacted-sensitive-value]";
  return String(value || "")
    .replace(/SecretId/gu, placeholder)
    .replace(/SecretKey/gu, placeholder)
    .replace(/Authorization/giu, placeholder)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, `Bearer ${placeholder}`)
    .replace(/\btoken\s*[:=]\s*[^,\s;]+/giu, placeholder)
    .replace(/\btoken\b/giu, placeholder)
    .replace(/\bkubeconfig\b/giu, placeholder)
    .slice(0, 512);
}

function errorRequestId(error = {}) {
  if (error?.requestId) return String(error.requestId).slice(0, 96);
  if (error?.RequestId) return String(error.RequestId).slice(0, 96);
  if (error?.response?.RequestId) return String(error.response.RequestId).slice(0, 96);
  if (error?.response?.requestId) return String(error.response.requestId).slice(0, 96);
  if (typeof error?.getRequestId === "function") return String(error.getRequestId() || "").slice(0, 96);
  return "";
}

export function sanitizedErrorPayload(error) {
  const requestId = errorRequestId(error);
  return {
    code: String(error?.code || error?.Code || error?.name || "tencent_sdk_call_failed").replace(/[^A-Za-z0-9_.:-]/gu, "_").slice(0, 96),
    message: redactedText(error?.message || error?.Message || ""),
    requestId,
  };
}

export function sanitizedTencentError(api, error, extra = {}) {
  const errorPayload = sanitizedErrorPayload(error);
  return {
    error: errorPayload,
    code: errorPayload.code,
    message: errorPayload.message,
    ...(errorPayload.requestId ? { requestId: errorPayload.requestId } : {}),
    ...(API_VERSIONS[api] ? { apiVersion: API_VERSIONS[api] } : {}),
    action: api,
    ...(extra.region ? { region: extra.region } : {}),
    ...(extra.nodePoolName ? { nodePoolName: extra.nodePoolName } : {}),
  };
}

export function sanitizedFailureStep(api, error, extra = {}) {
  const sanitizedError = sanitizedTencentError(api, error, extra);
  return {
    api,
    action: api,
    ...(sanitizedError.apiVersion ? { apiVersion: sanitizedError.apiVersion } : {}),
    status: "failed",
    error: sanitizedError.error,
    code: sanitizedError.code,
    message: sanitizedError.message,
    ...(sanitizedError.requestId ? { requestId: sanitizedError.requestId } : {}),
    ...(extra.nodePoolId ? { nodePoolId: extra.nodePoolId } : {}),
    ...(extra.nodePoolName ? { nodePoolName: extra.nodePoolName } : {}),
    ...(Number.isInteger(extra.replicas) ? { replicas: extra.replicas } : {}),
    ...(extra.region ? { region: extra.region } : {}),
  };
}

export function skippedUnsupportedServiceStep(api, error, extra = {}) {
  return {
    ...sanitizedFailureStep(api, error, extra),
    status: "skipped_unsupported_service",
    continuesCanary: true,
  };
}
