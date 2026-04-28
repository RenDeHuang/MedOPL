import { createHash, createHmac } from "node:crypto";
import {
  TENCENT_CLOUD_REGION,
  TENCENT_CLOUD_SECRET_ID,
  TENCENT_CLOUD_SECRET_KEY,
  TENCENT_CLOUD_TOKEN,
  TENCENT_CVM_ENDPOINT,
  TENCENT_CVM_VERSION,
  TENCENT_TKE_ENDPOINT,
  TENCENT_TKE_VERSION,
  tencentCloudConfigured,
} from "./config.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

export function sanitizeTencentError(error) {
  return {
    message: String(error?.message || error || "tencent_cloud_error")
      .replace(/(SecretId|SecretKey|TENCENT_CLOUD_SECRET_ID|TENCENT_CLOUD_SECRET_KEY)\s*[:=]\s*[^,\s"}]+/gi, "$1=[redacted]"),
    code: String(error?.code || "").trim(),
    status: Number(error?.status || 0) || undefined,
  };
}

export async function callTencentCloud({ endpoint, service, action, version, region = TENCENT_CLOUD_REGION, payload = {} }) {
  if (!tencentCloudConfigured()) {
    const error = new Error("tencent_cloud_credentials_not_configured");
    error.status = 503;
    throw error;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${endpoint}\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, sha256(body)].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = ["TC3-HMAC-SHA256", String(timestamp), credentialScope, sha256(canonicalRequest)].join("\n");
  const secretDate = hmac(`TC3${TENCENT_CLOUD_SECRET_KEY}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = hmac(secretSigning, stringToSign, "hex");
  const authorization = `TC3-HMAC-SHA256 Credential=${TENCENT_CLOUD_SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    authorization,
    "content-type": "application/json; charset=utf-8",
    host: endpoint,
    "x-tc-action": action,
    "x-tc-region": region,
    "x-tc-timestamp": String(timestamp),
    "x-tc-version": version,
  };
  if (TENCENT_CLOUD_TOKEN) headers["x-tc-token"] = TENCENT_CLOUD_TOKEN;

  const response = await fetch(`https://${endpoint}`, { method: "POST", headers, body });
  const result = await response.json().catch(() => ({}));
  const apiError = result?.Response?.Error;
  if (!response.ok || apiError) {
    const error = new Error(apiError?.Message || `tencent_cloud_${action}_failed:${response.status}`);
    error.status = response.status;
    error.code = apiError?.Code || "";
    throw error;
  }
  return result.Response || {};
}

export function callTke(action, payload = {}, region = TENCENT_CLOUD_REGION) {
  return callTencentCloud({
    endpoint: TENCENT_TKE_ENDPOINT,
    service: "tke",
    action,
    version: TENCENT_TKE_VERSION,
    region,
    payload,
  });
}

export function callCvm(action, payload = {}, region = TENCENT_CLOUD_REGION) {
  return callTencentCloud({
    endpoint: TENCENT_CVM_ENDPOINT,
    service: "cvm",
    action,
    version: TENCENT_CVM_VERSION,
    region,
    payload,
  });
}

export function callTag(action, payload = {}) {
  return callTencentCloud({
    endpoint: "tag.intl.tencentcloudapi.com",
    service: "tag",
    action,
    version: "2018-08-13",
    region: "",
    payload,
  });
}
