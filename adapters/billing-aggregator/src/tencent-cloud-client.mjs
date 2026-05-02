import { createHash, createHmac } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

export function tencentCloudConfigured(config = {}) {
  return Boolean(config.secretId && config.secretKey);
}

function scrubCloudErrorText(value) {
  return String(value || "")
    .replace(/AKID[A-Za-z0-9]+/g, "[redacted-secret-id]")
    .replace(/(SecretId|SecretKey|TENCENT_CLOUD_SECRET_ID|TENCENT_CLOUD_SECRET_KEY)\s*[:=]\s*[^,\s"}]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

export function sanitizeCloudError(error) {
  if (!error) return null;
  return {
    message: scrubCloudErrorText(error.message || error),
    code: scrubCloudErrorText(error.code || ""),
    status: Number(error.status || 0),
  };
}

export function cloudErrorMessage(error) {
  const sanitized = sanitizeCloudError(error);
  if (!sanitized) return "";
  return sanitized.code ? `${sanitized.code}:${sanitized.message}` : sanitized.message;
}

export function createTencentCloudClient(config = {}) {
  const secretId = String(config.secretId || "").trim();
  const secretKey = String(config.secretKey || "").trim();
  const token = String(config.token || "").trim();

  async function callTencentCloud({ endpoint, service, action, version, region, payload = {} }) {
    if (!tencentCloudConfigured({ secretId, secretKey })) {
      const error = new Error("tencent_cloud_credentials_not_configured");
      error.status = 503;
      throw error;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const body = JSON.stringify(payload);
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${endpoint}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = "content-type;host;x-tc-action";
    const canonicalRequest = [
      "POST",
      "/",
      "",
      canonicalHeaders,
      signedHeaders,
      sha256(body),
    ].join("\n");
    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = [
      "TC3-HMAC-SHA256",
      String(timestamp),
      credentialScope,
      sha256(canonicalRequest),
    ].join("\n");
    const secretDate = hmac(`TC3${secretKey}`, date);
    const secretService = hmac(secretDate, service);
    const secretSigning = hmac(secretService, "tc3_request");
    const signature = hmac(secretSigning, stringToSign, "hex");
    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = {
      authorization,
      "content-type": "application/json; charset=utf-8",
      host: endpoint,
      "x-tc-action": action,
      "x-tc-region": region,
      "x-tc-timestamp": String(timestamp),
      "x-tc-version": version,
    };
    if (token) headers["x-tc-token"] = token;

    const response = await fetch(`https://${endpoint}`, {
      method: "POST",
      headers,
      body,
    });
    const result = await response.json().catch(() => ({}));
    const apiError = result?.Response?.Error;
    if (!response.ok || apiError) {
      const error = new Error(apiError?.Message || `tencent_cloud_${action}_failed:${response.status}`);
      error.status = response.status;
      error.code = apiError?.Code || "";
      error.payload = result;
      throw error;
    }
    return result.Response || result;
  }

  return {
    callTencentCloud,
    configured: () => tencentCloudConfigured({ secretId, secretKey }),
  };
}
