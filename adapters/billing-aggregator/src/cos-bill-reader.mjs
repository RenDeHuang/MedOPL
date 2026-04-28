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

function cosAuthorization({ method, pathname, params, host, secretId, secretKey, now = Math.floor(Date.now() / 1000) }) {
  const signTime = `${now};${now + 600}`;
  const headerList = "host";
  const urlParamList = Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key]) => String(key).toLowerCase())
    .sort()
    .join(";");
  const headerString = `host=${encodeCos(host)}`;
  const httpString = [
    String(method || "GET").toLowerCase(),
    pathname || "/",
    canonicalQuery(params),
    headerString,
    "",
  ].join("\n");
  const stringToSign = ["sha1", signTime, sha1(httpString), ""].join("\n");
  const signKey = hmacSha1(secretKey, signTime);
  const signature = hmacSha1(signKey, stringToSign);
  return [
    "q-sign-algorithm=sha1",
    `q-ak=${secretId}`,
    `q-sign-time=${signTime}`,
    `q-key-time=${signTime}`,
    `q-header-list=${headerList}`,
    `q-url-param-list=${urlParamList}`,
    `q-signature=${signature}`,
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

export function buildCosBillReader(config = {}) {
  const bucket = String(config.bucket || "").trim();
  const region = String(config.region || "").trim();
  const prefix = String(config.prefix || "daily/").trim();
  const secretId = String(config.secretId || "").trim();
  const secretKey = String(config.secretKey || "").trim();
  const endpoint = normalizeEndpoint({ bucket, region, endpoint: config.endpoint });

  function configured() {
    return Boolean(bucket && region && prefix && secretId && secretKey);
  }

  async function requestCos({ pathname = "/", params = {} } = {}) {
    if (!configured()) {
      const error = new Error("cos_bill_reader_not_configured");
      error.code = "COS_NOT_CONFIGURED";
      throw error;
    }
    const query = canonicalQuery(params);
    const url = `https://${endpoint}${pathname}${query ? `?${query}` : ""}`;
    const authorization = cosAuthorization({
      method: "GET",
      pathname,
      params,
      host: endpoint,
      secretId,
      secretKey,
    });
    const response = await fetch(url, {
      headers: {
        authorization,
        host: endpoint,
      },
      signal: AbortSignal.timeout(Number(config.timeoutMs || 30000)),
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`cos_bill_request_failed:${response.status}`);
      error.status = response.status;
      error.body = text.slice(0, 500);
      throw error;
    }
    return text;
  }

  async function listFiles({ maxKeys = 20 } = {}) {
    const xml = await requestCos({
      params: {
        prefix,
        "max-keys": String(maxKeys),
      },
    });
    return parseListObjectsXml(xml);
  }

  async function readFile(key) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey || !normalizedKey.startsWith(prefix)) {
      const error = new Error("cos_bill_key_outside_prefix");
      error.status = 422;
      throw error;
    }
    return requestCos({ pathname: `/${normalizedKey.split("/").map(encodeURIComponent).join("/")}` });
  }

  async function parseLatestFile() {
    const files = await listFiles({ maxKeys: Number(config.maxKeys || 20) });
    const latest = files
      .filter((item) => item.size > 0)
      .sort((a, b) => String(b.lastModified || "").localeCompare(String(a.lastModified || "")))[0];
    if (!latest) return { files, latest: null, rows: [] };
    const body = await readFile(latest.key);
    const rows = latest.key.endsWith(".json") || body.trim().startsWith("[")
      ? JSON.parse(body)
      : parseDelimitedRows(body);
    return { files, latest, rows: Array.isArray(rows) ? rows : [] };
  }

  return {
    configured,
    endpoint,
    bucket,
    region,
    prefix,
    listFiles,
    readFile,
    parseLatestFile,
  };
}
