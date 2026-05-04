import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const allowedSubDomains = new Set(["portal", "opl", "trace"]);
const allowedRecordTypes = new Set(["A", "CNAME"]);
const endpoint = "dnspod.intl.tencentcloudapi.com";
const service = "dnspod";
const version = "2021-03-23";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function sanitizeCloudError(value = "") {
  return String(value || "")
    .replace(/AKID[A-Za-z0-9]+/g, "[redacted-secret-id]")
    .replace(/(SecretId|SecretKey|authorization|x-tc-token|TENCENT_[A-Z0-9_]+)\s*[:=]\s*[^,\s"}]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function parseEnvFileContent(source = "") {
  const values = {};
  for (const rawLine of String(source || "").replace(/^\uFEFF/, "").split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[=:]\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

async function loadEnvFile(filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const parsed = parseEnvFileContent(await readFile(absolute, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function readCredential() {
  const secretId = env("TENCENT_DNSPOD_SECRET_ID", env("TENCENT_BILLING_SECRET_ID", env("TENCENT_CLOUD_SECRET_ID", env("TENCENTCLOUD_SECRET_ID"))));
  const secretKey = env("TENCENT_DNSPOD_SECRET_KEY", env("TENCENT_BILLING_SECRET_KEY", env("TENCENT_CLOUD_SECRET_KEY", env("TENCENTCLOUD_SECRET_KEY"))));
  const token = env("TENCENT_DNSPOD_TOKEN", env("TENCENT_CLOUD_TOKEN"));
  return { secretId, secretKey, token };
}

function assertIpv4(value) {
  const parts = String(value || "").split(".");
  assert.equal(parts.length, 4, "invalid_ipv4_record_value");
  for (const part of parts) {
    assert(/^\d+$/.test(part), "invalid_ipv4_record_value");
    const octet = Number(part);
    assert(Number.isInteger(octet) && octet >= 0 && octet <= 255, "invalid_ipv4_record_value");
  }
}

function assertCname(value) {
  assert(/^[A-Za-z0-9._-]+$/.test(value), "invalid_cname_record_value");
  assert(value.includes("."), "invalid_cname_record_value");
}

export function parseRecordSpec(value = "") {
  const match = String(value || "").trim().match(/^([a-z0-9-]+)=([A-Za-z]+):(.+)$/i);
  assert(match, `invalid_record_spec:${value}`);
  const subDomain = match[1].toLowerCase();
  const recordType = match[2].toUpperCase();
  const recordValue = match[3].trim();
  assert(allowedSubDomains.has(subDomain), `subdomain_not_allowed:${subDomain}`);
  assert(allowedRecordTypes.has(recordType), `record_type_not_allowed:${recordType}`);
  if (recordType === "A") assertIpv4(recordValue);
  if (recordType === "CNAME") assertCname(recordValue);
  return {
    subDomain,
    recordType,
    value: recordValue,
  };
}

function recordName(record = {}) {
  return String(record.Name || record.SubDomain || record.name || "").trim().toLowerCase();
}

function recordType(record = {}) {
  return String(record.Type || record.RecordType || record.type || "").trim().toUpperCase();
}

function recordValue(record = {}) {
  return String(record.Value || record.value || "").trim();
}

function recordStatus(record = {}) {
  return String(record.Status || record.status || "ENABLE").trim().toUpperCase();
}

export function planRecordUpdate({ domain, target, records }) {
  const matching = records.filter((record) => recordName(record) === target.subDomain);
  assert(matching.length > 0, `record_missing:${target.subDomain}`);
  assert(matching.length === 1, `record_not_unique:${target.subDomain}:${matching.length}`);
  const record = matching[0];
  const currentType = recordType(record);
  const currentStatus = recordStatus(record);
  assert.equal(currentType, target.recordType, `record_type_mismatch:${target.subDomain}:${currentType}:${target.recordType}`);
  assert.equal(currentStatus, "ENABLE", `record_not_enabled:${target.subDomain}:${currentStatus}`);

  if (recordValue(record) === target.value) {
    return {
      action: "noop",
      subDomain: target.subDomain,
      recordType: target.recordType,
      currentValue: target.value,
      targetValue: target.value,
      recordId: record.RecordId,
    };
  }

  const modifyPayload = {
    Domain: domain,
    RecordId: record.RecordId,
    SubDomain: target.subDomain,
    RecordType: target.recordType,
    RecordLine: String(record.Line || "Default"),
    RecordLineId: String(record.LineId || "0"),
    Value: target.value,
    TTL: Number(record.TTL || 600),
    MX: Number(record.MX || 0),
    Status: currentStatus,
  };
  assert(modifyPayload.RecordId, `record_id_missing:${target.subDomain}`);

  return {
    action: "modify",
    subDomain: target.subDomain,
    recordType: target.recordType,
    currentValue: recordValue(record),
    targetValue: target.value,
    recordId: record.RecordId,
    modifyPayload,
  };
}

async function callTencentCloud({ secretId, secretKey, token, action, payload }) {
  assert(secretId && secretKey, "dnspod_credentials_required");

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${endpoint}\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, sha256(body)].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = ["TC3-HMAC-SHA256", String(timestamp), credentialScope, sha256(canonicalRequest)].join("\n");
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
    "x-tc-timestamp": String(timestamp),
    "x-tc-version": version,
  };
  if (token) headers["x-tc-token"] = token;

  const response = await fetch(`https://${endpoint}`, { method: "POST", headers, body });
  const result = await response.json().catch(() => ({}));
  const apiError = result?.Response?.Error;
  if (!response.ok || apiError) {
    const error = new Error(apiError?.Message || `dnspod_${action}_failed:${response.status}`);
    error.code = apiError?.Code || "";
    error.status = response.status;
    throw error;
  }
  return result.Response || {};
}

async function describeRecords({ credential, domain, subDomain }) {
  const response = await callTencentCloud({
    ...credential,
    action: "DescribeRecordList",
    payload: {
      Domain: domain,
      Subdomain: subDomain,
    },
  });
  return Array.isArray(response.RecordList) ? response.RecordList : [];
}

function parseArgs(argv) {
  const config = {
    domain: "medopl.cn",
    dryRun: true,
    envFiles: [],
    records: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--domain") config.domain = argv[++index];
    else if (arg === "--env-file") config.envFiles.push(argv[++index]);
    else if (arg === "--record") config.records.push(parseRecordSpec(argv[++index]));
    else if (arg === "--dry-run") config.dryRun = true;
    else if (arg === "--apply") config.dryRun = false;
    else if (arg === "--help" || arg === "-h") config.help = true;
    else throw new Error(`unknown_arg:${arg}`);
  }
  return config;
}

function printHelp() {
  console.log([
    "Usage:",
    "  node scripts/update-dnspod-records.mjs --env-file /home/dev/.secrets/medopl/secrets.env.txt --domain medopl.cn --dry-run --record portal=A:43.173.116.127",
    "",
    "Safety:",
    "  - default is dry-run",
    "  - only portal/opl/trace subdomains are accepted",
    "  - only existing A/CNAME records are modified",
    "  - missing, duplicate, disabled, or type-mismatched records fail",
    "  - no record creation or deletion path is available",
  ].join("\n"));
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  if (config.help) {
    printHelp();
    return;
  }
  assert(config.domain === "medopl.cn", `domain_not_allowed:${config.domain}`);
  assert(config.records.length > 0, "at_least_one_record_required");
  for (const filePath of config.envFiles) await loadEnvFile(filePath);

  const credential = readCredential();
  const plans = [];
  for (const target of config.records) {
    const records = await describeRecords({
      credential,
      domain: config.domain,
      subDomain: target.subDomain,
    });
    plans.push(planRecordUpdate({
      domain: config.domain,
      target,
      records,
    }));
  }

  if (!config.dryRun) {
    for (const plan of plans) {
      if (plan.action !== "modify") continue;
      await callTencentCloud({
        ...credential,
        action: "ModifyRecord",
        payload: plan.modifyPayload,
      });
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: config.dryRun,
    domain: config.domain,
    endpoint,
    plans: plans.map((plan) => ({
      action: plan.action,
      subDomain: plan.subDomain,
      recordType: plan.recordType,
      currentValue: plan.currentValue,
      targetValue: plan.targetValue,
      recordId: plan.recordId,
    })),
  }, null, 2));
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: sanitizeCloudError(error?.code ? `${error.code}:${error.message}` : error?.message || error),
    }, null, 2));
    process.exit(1);
  });
}
