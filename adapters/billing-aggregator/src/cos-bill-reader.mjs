import { createHash, createHmac } from "node:crypto";

function hmacSha1(key, value, encoding = "hex") {
  return createHmac("sha1", key).update(value).digest(encoding);
}

function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

function encodeCos(value) {
  return encodeURIComponent(String(value || ""))
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .toLowerCase();
}

function normalizeEndpoint({ bucket, region, endpoint }) {
  if (endpoint) return String(endpoint).replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `${bucket}.cos.${region}.myqcloud.com`;
}

function canonicalQuery(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [String(key).toLowerCase(), String(value)])
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeCos(key)}=${encodeCos(value)}`)
    .join("&");
}

function signedUrlParamList(params = {}) {
  return Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key]) => String(key).toLowerCase())
    .sort()
    .join(";");
}

function signedHttpString({ method, pathname, params, host }) {
  const headerString = `host=${encodeCos(host)}`;
  return [
    String(method || "GET").toLowerCase(),
    pathname || "/",
    canonicalQuery(params),
    headerString,
    "",
  ].join("\n");
}

function cosSignature({ method, pathname, params, host, secretKey, signTime }) {
  const httpString = signedHttpString({ method, pathname, params, host });
  const stringToSign = ["sha1", signTime, sha1(httpString), ""].join("\n");
  const signKey = hmacSha1(secretKey, signTime);
  return hmacSha1(signKey, stringToSign);
}

function cosAuthorization({ method, pathname, params, host, secretId, secretKey, now = Math.floor(Date.now() / 1000) }) {
  const signTime = `${now};${now + 600}`;
  const headerList = "host";
  return [
    "q-sign-algorithm=sha1",
    `q-ak=${secretId}`,
    `q-sign-time=${signTime}`,
    `q-key-time=${signTime}`,
    `q-header-list=${headerList}`,
    `q-url-param-list=${signedUrlParamList(params)}`,
    `q-signature=${cosSignature({ method, pathname, params, host, secretKey, signTime })}`,
  ].join("&");
}

function textBetween(text, tag) {
  const match = String(text || "").match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function parseListObjectsXml(xml) {
  const contents = [...String(xml || "").matchAll(/<Contents>([\s\S]*?)<\/Contents>/gi)];
  return contents.map((match) => ({
    key: textBetween(match[1], "Key"),
    lastModified: textBetween(match[1], "LastModified"),
    etag: textBetween(match[1], "ETag").replace(/^"|"$/g, ""),
    size: Number(textBetween(match[1], "Size") || 0),
    storageClass: textBetween(match[1], "StorageClass"),
  })).filter((item) => item.key);
}

function parseDelimitedRows(text) {
  const rows = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const separator = rows[0].includes("\t") ? "\t" : ",";
  const headers = rows[0].split(separator).map((item) => item.trim());
  return rows.slice(1).map((line) => {
    const values = line.split(separator);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function normalizeReaderConfig(config = {}) {
  const bucket = String(config.bucket || "").trim();
  const region = String(config.region || "").trim();
  const prefix = String(config.prefix || "daily/").trim();
  return {
    bucket,
    region,
    prefix,
    secretId: String(config.secretId || "").trim(),
    secretKey: String(config.secretKey || "").trim(),
    endpoint: normalizeEndpoint({ bucket, region, endpoint: config.endpoint }),
    maxKeys: Number(config.maxKeys || 20),
    timeoutMs: Number(config.timeoutMs || 30000),
  };
}

function isReaderConfigured(readerConfig) {
  return Boolean(
    readerConfig.bucket &&
    readerConfig.region &&
    readerConfig.prefix &&
    readerConfig.secretId &&
    readerConfig.secretKey,
  );
}

function ensureReaderConfigured(readerConfig) {
  if (isReaderConfigured(readerConfig)) return;
  const error = new Error("cos_bill_reader_not_configured");
  error.code = "COS_NOT_CONFIGURED";
  throw error;
}

async function requestCosObject(readerConfig, { pathname = "/", params = {} } = {}) {
  ensureReaderConfigured(readerConfig);
  const query = canonicalQuery(params);
  const url = `https://${readerConfig.endpoint}${pathname}${query ? `?${query}` : ""}`;
  const authorization = cosAuthorization({
    method: "GET",
    pathname,
    params,
    host: readerConfig.endpoint,
    secretId: readerConfig.secretId,
    secretKey: readerConfig.secretKey,
  });
  const response = await fetch(url, {
    headers: {
      authorization,
      host: readerConfig.endpoint,
    },
    signal: AbortSignal.timeout(readerConfig.timeoutMs),
  });
  const text = await response.text();
  if (response.ok) return text;
  const error = new Error(`cos_bill_request_failed:${response.status}`);
  error.status = response.status;
  error.body = text.slice(0, 500);
  throw error;
}

function latestNonEmptyFile(files = []) {
  return files
    .filter((item) => item.size > 0)
    .sort((a, b) => String(b.lastModified || "").localeCompare(String(a.lastModified || "")))[0] || null;
}

function parseBillRows(key, body) {
  if (String(key || "").endsWith(".json") || String(body || "").trim().startsWith("[")) {
    const rows = JSON.parse(body);
    return Array.isArray(rows) ? rows : [];
  }
  return parseDelimitedRows(body);
}

export function buildCosBillReader(config = {}) {
  const readerConfig = normalizeReaderConfig(config);

  function configured() {
    return isReaderConfigured(readerConfig);
  }

  async function listFiles({ maxKeys = 20 } = {}) {
    const xml = await requestCosObject(readerConfig, {
      params: {
        prefix: readerConfig.prefix,
        "max-keys": String(maxKeys),
      },
    });
    return parseListObjectsXml(xml);
  }

  async function readFile(key) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey || !normalizedKey.startsWith(readerConfig.prefix)) {
      const error = new Error("cos_bill_key_outside_prefix");
      error.status = 422;
      throw error;
    }
    return requestCosObject(readerConfig, { pathname: `/${normalizedKey.split("/").map(encodeURIComponent).join("/")}` });
  }

  async function parseLatestFile() {
    const files = await listFiles({ maxKeys: readerConfig.maxKeys });
    const latest = latestNonEmptyFile(files);
    if (!latest) return { files, latest: null, rows: [] };
    const body = await readFile(latest.key);
    return { files, latest, rows: parseBillRows(latest.key, body) };
  }

  return {
    configured,
    endpoint: readerConfig.endpoint,
    bucket: readerConfig.bucket,
    region: readerConfig.region,
    prefix: readerConfig.prefix,
    listFiles,
    readFile,
    parseLatestFile,
  };
}
