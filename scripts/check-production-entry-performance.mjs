import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";

const defaultTargets = [
  { name: "portal-health", url: "https://portal.medopl.cn/healthz" },
  { name: "portal-page", url: "https://portal.medopl.cn/" },
  { name: "opl-health", url: "https://opl.medopl.cn/healthz" },
  { name: "opl-page", url: "https://opl.medopl.cn/" },
  { name: "trace-health", url: "https://trace.medopl.cn/api/public/health" },
  { name: "trace-page", url: "https://trace.medopl.cn/" },
];

function loadTargets() {
  const raw = process.env.ENTRY_PERF_TARGETS_JSON?.trim();
  if (!raw) return defaultTargets;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("ENTRY_PERF_TARGETS_JSON must be a non-empty JSON array");
  }
  return parsed.map((item, index) => {
    const name = String(item?.name || `target-${index + 1}`).trim();
    const url = String(item?.url || "").trim();
    if (!url) throw new Error(`target ${name} missing url`);
    return { name, url };
  });
}

async function measureDns(hostname) {
  const started = performance.now();
  const lookup = await dns.lookup(hostname);
  return {
    address: lookup.address,
    family: lookup.family,
    dnsMs: performance.now() - started,
  };
}

async function measureHttp(target) {
  const url = new URL(target.url);
  const agent = url.protocol === "https:" ? https : http;
  const result = {
    name: target.name,
    url: target.url,
    protocol: url.protocol.replace(":", ""),
    status: 0,
    dnsMs: null,
    tcpMs: null,
    tlsMs: null,
    ttfbMs: null,
    totalMs: null,
    sizeBytes: 0,
    ip: null,
    family: null,
    location: null,
    cacheControl: null,
    contentEncoding: null,
    contentType: null,
  };

  const dnsInfo = await measureDns(url.hostname);
  result.dnsMs = dnsInfo.dnsMs;
  result.ip = dnsInfo.address;
  result.family = dnsInfo.family;

  await new Promise((resolve, reject) => {
    const started = performance.now();
    let connectAt = null;
    let secureAt = null;
    let firstByteAt = null;

    const req = agent.request(
      url,
      {
        method: "GET",
        timeout: Number(process.env.ENTRY_PERF_TIMEOUT_MS || 15000),
        headers: {
          "user-agent": "opl-v17-entry-performance-check/1.0",
          accept: "*/*",
        },
      },
      (res) => {
        firstByteAt = performance.now();
        result.status = res.statusCode || 0;
        result.location = String(res.headers.location || "");
        result.cacheControl = String(res.headers["cache-control"] || "");
        result.contentEncoding = String(res.headers["content-encoding"] || "");
        result.contentType = String(res.headers["content-type"] || "");

        res.on("data", (chunk) => {
          result.sizeBytes += Buffer.byteLength(chunk);
        });
        res.on("end", () => {
          result.tcpMs = connectAt ? connectAt - started : null;
          result.tlsMs = secureAt && connectAt ? secureAt - connectAt : null;
          result.ttfbMs = firstByteAt ? firstByteAt - started : null;
          result.totalMs = performance.now() - started;
          resolve();
        });
      },
    );

    req.on("socket", (socket) => {
      socket.once("connect", () => {
        connectAt = performance.now();
      });
      if (url.protocol === "https:") {
        socket.once("secureConnect", () => {
          secureAt = performance.now();
        });
      }
    });
    req.on("timeout", () => {
      req.destroy(new Error("request_timeout"));
    });
    req.on("error", (error) => {
      reject(error);
    });
    req.end();
  });

  return result;
}

function round(value) {
  return value == null ? "" : Number(value).toFixed(1);
}

function printTable(results) {
  const lines = [
    "name\tstatus\tdns_ms\ttcp_ms\ttls_ms\tttfb_ms\ttotal_ms\tsize_bytes\tcache_control\tcontent_encoding\tlocation",
  ];
  for (const item of results) {
    lines.push(
      [
        item.name,
        item.status,
        round(item.dnsMs),
        round(item.tcpMs),
        round(item.tlsMs),
        round(item.ttfbMs),
        round(item.totalMs),
        item.sizeBytes,
        item.cacheControl || "-",
        item.contentEncoding || "-",
        item.location || "-",
      ].join("\t"),
    );
  }
  console.log(lines.join("\n"));
}

async function main() {
  const targets = loadTargets();
  const results = [];
  for (const target of targets) {
    try {
      results.push(await measureHttp(target));
    } catch (error) {
      results.push({
        name: target.name,
        url: target.url,
        status: 0,
        dnsMs: null,
        tcpMs: null,
        tlsMs: null,
        ttfbMs: null,
        totalMs: null,
        sizeBytes: 0,
        ip: null,
        family: null,
        location: "",
        cacheControl: "",
        contentEncoding: "",
        contentType: "",
        error: String(error.message || error),
      });
    }
  }

  const payload = {
    measuredAt: new Date().toISOString(),
    targets: results,
  };

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  printTable(results);
}

await main();
