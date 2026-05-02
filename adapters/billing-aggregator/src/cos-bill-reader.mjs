import { createHash, createHmac } from "node:crypto";
import { inflateRawSync } from "node:zlib";

function hmacSha1(key, value, encoding = "hex") {
  return createHmac("sha1", key).update(value).digest(encoding);
}

function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

function encodeCos(value) {
  return encodeURIComponent(String(value || ""))
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%[0-9a-f]{2}/gi, (encoded) => encoded.toUpperCase());
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

function cleanDelimitedCell(value = "") {
  const trimmed = String(value ?? "").replace(/^\uFEFF/, "").trim();
  if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).replace(/""/g, "\"").trim();
  }
  return trimmed;
}

function parseDelimitedLine(line = "", separator = ",") {
  if (separator !== ",") return String(line || "").split(separator).map(cleanDelimitedCell);
  const values = [];
  let current = "";
  let quoted = false;
  const text = String(line || "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      current += char;
      continue;
    }
    if (char === separator && !quoted) {
      values.push(cleanDelimitedCell(current));
      current = "";
      continue;
    }
    current += char;
  }
  values.push(cleanDelimitedCell(current));
  return values;
}

function parseDelimitedRows(text) {
  const rows = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const separator = rows[0].includes("\t") ? "\t" : ",";
  const headers = parseDelimitedLine(rows[0], separator);
  return rows.slice(1).map((line) => {
    const values = parseDelimitedLine(line, separator);
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
  const prefix = config.prefix === undefined || config.prefix === null
    ? "daily/"
    : String(config.prefix).trim();
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

async function requestCosObject(readerConfig, { pathname = "/", signedPathname = pathname, params = {}, responseType = "text" } = {}) {
  ensureReaderConfigured(readerConfig);
  const query = canonicalQuery(params);
  const url = `https://${readerConfig.endpoint}${pathname}${query ? `?${query}` : ""}`;
  const authorization = cosAuthorization({
    method: "GET",
    pathname: signedPathname,
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
  const body = responseType === "buffer"
    ? Buffer.from(await response.arrayBuffer())
    : await response.text();
  if (response.ok) return body;
  const error = new Error(`cos_bill_request_failed:${response.status}`);
  error.status = response.status;
  error.body = String(responseType === "buffer" ? body.toString("utf8") : body).slice(0, 500);
  throw error;
}

function latestNonEmptyFile(files = []) {
  return files
    .filter((item) => item.size > 0)
    .sort((a, b) => String(b.lastModified || "").localeCompare(String(a.lastModified || "")))[0] || null;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function supportedZipEntryType(key = "") {
  const normalized = String(key || "").toLowerCase();
  if (normalized.endsWith(".json")) return "json";
  if (normalized.endsWith(".csv")) return "csv";
  if (normalized.endsWith(".tsv")) return "tsv";
  return "";
}

function findZipEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  const error = new Error("cos_bill_zip_end_of_central_directory_missing");
  error.code = "COS_BILL_ZIP_EOCD_MISSING";
  throw error;
}

function readZipEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    const error = new Error("cos_bill_zip_invalid_buffer");
    error.code = "COS_BILL_ZIP_INVALID_BUFFER";
    throw error;
  }

  const eocdOffset = findZipEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0) {
    const error = new Error("cos_bill_zip_multidisk_not_supported");
    error.code = "COS_BILL_ZIP_MULTIDISK_NOT_SUPPORTED";
    throw error;
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > buffer.length) {
    const error = new Error("cos_bill_zip_central_directory_out_of_range");
    error.code = "COS_BILL_ZIP_CENTRAL_DIRECTORY_OUT_OF_RANGE";
    throw error;
  }

  const entries = [];
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > centralDirectoryEnd || buffer.readUInt32LE(offset) !== 0x02014b50) {
      const error = new Error("cos_bill_zip_central_directory_invalid");
      error.code = "COS_BILL_ZIP_CENTRAL_DIRECTORY_INVALID";
      throw error;
    }

    const generalPurposeBitFlag = buffer.readUInt16LE(offset + 8);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const checksum = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const name = buffer.subarray(fileNameStart, fileNameEnd).toString("utf8");
    entries.push({
      name,
      generalPurposeBitFlag,
      compressionMethod,
      checksum,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset = fileNameEnd + extraFieldLength + fileCommentLength;
  }
  return entries;
}

function extractZipEntry(buffer, entry) {
  const localHeaderOffset = Number(entry.localHeaderOffset || 0);
  if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    const error = new Error("cos_bill_zip_local_header_invalid");
    error.code = "COS_BILL_ZIP_LOCAL_HEADER_INVALID";
    throw error;
  }

  if ((Number(entry.generalPurposeBitFlag || 0) & 0x01) !== 0) {
    const error = new Error("cos_bill_zip_encrypted_entry_not_supported");
    error.code = "COS_BILL_ZIP_ENCRYPTED_ENTRY_NOT_SUPPORTED";
    throw error;
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const bodyOffset = localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const bodyEnd = bodyOffset + Number(entry.compressedSize || 0);
  if (bodyEnd > buffer.length) {
    const error = new Error("cos_bill_zip_entry_out_of_range");
    error.code = "COS_BILL_ZIP_ENTRY_OUT_OF_RANGE";
    throw error;
  }

  const compressedBody = buffer.subarray(bodyOffset, bodyEnd);
  let body;
  if (entry.compressionMethod === 0) body = compressedBody;
  else if (entry.compressionMethod === 8) body = inflateRawSync(compressedBody);
  else {
    const error = new Error(`cos_bill_zip_compression_unsupported:${entry.compressionMethod}`);
    error.code = "COS_BILL_ZIP_COMPRESSION_UNSUPPORTED";
    throw error;
  }

  if (body.length !== Number(entry.uncompressedSize || 0)) {
    const error = new Error("cos_bill_zip_uncompressed_size_mismatch");
    error.code = "COS_BILL_ZIP_UNCOMPRESSED_SIZE_MISMATCH";
    throw error;
  }

  if (crc32(body) !== Number(entry.checksum >>> 0)) {
    const error = new Error("cos_bill_zip_crc32_mismatch");
    error.code = "COS_BILL_ZIP_CRC32_MISMATCH";
    throw error;
  }

  return body;
}

function parseZipBillRows(key, body) {
  const entries = readZipEntries(body)
    .filter((entry) => !String(entry.name || "").endsWith("/"));
  if (!entries.length) {
    const error = new Error("cos_bill_zip_no_entries");
    error.code = "COS_BILL_ZIP_NO_ENTRIES";
    throw error;
  }

  const supported = entries.filter((entry) => supportedZipEntryType(entry.name));
  if (!supported.length) {
    const error = new Error("cos_bill_zip_no_supported_entries");
    error.code = "COS_BILL_ZIP_NO_SUPPORTED_ENTRIES";
    error.details = { key, entries: entries.map((entry) => entry.name) };
    throw error;
  }
  if (supported.length !== 1 || entries.length !== 1) {
    const error = new Error("cos_bill_zip_multiple_entries");
    error.code = "COS_BILL_ZIP_MULTIPLE_ENTRIES";
    error.details = { key, entries: entries.map((entry) => entry.name) };
    throw error;
  }

  const entry = supported[0];
  return parseBillRows(entry.name, extractZipEntry(body, entry));
}

function parseBillRows(key, body) {
  if (String(key || "").toLowerCase().endsWith(".zip")) {
    return parseZipBillRows(key, Buffer.isBuffer(body) ? body : Buffer.from(body || ""));
  }

  const text = Buffer.isBuffer(body) ? body.toString("utf8") : String(body || "");
  if (String(key || "").endsWith(".json") || text.trim().startsWith("[")) {
    const rows = JSON.parse(text);
    return Array.isArray(rows) ? rows : [];
  }
  return parseDelimitedRows(text);
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
    const responseType = normalizedKey.toLowerCase().endsWith(".zip") ? "buffer" : "text";
    return requestCosObject(readerConfig, {
      pathname: `/${normalizedKey.split("/").map(encodeCos).join("/")}`,
      signedPathname: `/${normalizedKey}`,
      responseType,
    });
  }

  async function parseLatestFile() {
    const files = await listFiles({ maxKeys: readerConfig.maxKeys });
    const latest = latestNonEmptyFile(files);
    if (!latest) return { files, latest: null, rows: [] };
    const body = await readFile(latest.key);
    return { files, latest, rows: parseBillRows(latest.key, body) };
  }

  async function parseFile(key) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) {
      const error = new Error("cos_bill_key_required");
      error.status = 422;
      throw error;
    }
    const body = await readFile(normalizedKey);
    return {
      files: [],
      latest: { key: normalizedKey },
      rows: parseBillRows(normalizedKey, body),
    };
  }

  return {
    configured,
    endpoint: readerConfig.endpoint,
    bucket: readerConfig.bucket,
    region: readerConfig.region,
    prefix: readerConfig.prefix,
    listFiles,
    readFile,
    parseFile,
    parseLatestFile,
  };
}
