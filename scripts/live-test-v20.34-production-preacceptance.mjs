import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.34-production-preacceptance");

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function intEnv(name, fallback) {
  const value = Number(env(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeText(value = "") {
  return String(value || "")
    .replace(/\b(cookie|authorization|token)\b[^,\n]*/gi, "$1=[redacted]")
    .replace(/\b(?:AKID|eyJ|sk-)[A-Za-z0-9._-]{12,}\b/g, "[redacted]");
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeEvidence(payload) {
  await ensureDir(evidenceDir);
  const filename = `${nowIso().replace(/[:.]/g, "-")}.json`;
  const outputPath = path.join(evidenceDir, filename);
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return outputPath;
}

function requestNode(url, options = {}) {
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  const timeoutMs = options.timeoutMs || 20_000;
  const method = options.method || "GET";
  const headers = { ...(options.headers || {}) };
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {}
          resolve({
            status: res.statusCode || 0,
            latencyMs: Date.now() - startedAt,
            text,
            json,
          });
        });
      },
    );
    req.on("error", (error) => reject(error));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("request_timeout")));
    req.end();
  });
}

function readConfig() {
  return {
    startedAt: nowIso(),
    enabled: boolEnv("RUN_V20_34_PRODUCTION_PREACCEPTANCE"),
    portalBaseUrl: env("PORTAL_BASE_URL"),
    oplBaseUrl: env("OPL_BASE_URL"),
    traceBaseUrl: env("TRACE_BASE_URL"),
    timeoutMs: intEnv("V20_34_PREACCEPTANCE_REQUEST_TIMEOUT_MS", 20_000),
  };
}

function missingConfig(config) {
  const missing = [];
  if (!config.enabled) missing.push("RUN_V20_34_PRODUCTION_PREACCEPTANCE=1");
  if (!config.portalBaseUrl) missing.push("PORTAL_BASE_URL");
  if (!config.oplBaseUrl) missing.push("OPL_BASE_URL");
  if (!config.traceBaseUrl) missing.push("TRACE_BASE_URL");
  return missing;
}

function buildChecks({ portalBaseUrl, oplBaseUrl, traceBaseUrl }) {
  const checks = [
    { name: "portal_base_reachable", url: `${portalBaseUrl}/`, expect: (status) => status >= 200 && status < 500 },
    { name: "opl_base_reachable", url: `${oplBaseUrl}/`, expect: (status) => status >= 200 && status < 500 },
    { name: "trace_base_reachable", url: `${traceBaseUrl}/`, expect: (status) => status >= 200 && status < 500 },
    { name: "portal_healthz", url: `${portalBaseUrl}/healthz`, expect: (status) => status >= 200 && status < 300 },
    { name: "portal_config", url: `${portalBaseUrl}/portal/api/config`, expect: (status) => status >= 200 && status < 300 },
    { name: "opl_health", url: `${oplBaseUrl}/api/health`, expect: (status) => status >= 200 && status < 300 },
    { name: "trace_health", url: `${traceBaseUrl}/api/public/health`, expect: (status) => status >= 200 && status < 300 },
  ];
  return checks;
}

async function runCheck(item, timeoutMs) {
  try {
    const response = await requestNode(item.url, {
      method: "GET",
      headers: { accept: "application/json,text/html" },
      timeoutMs,
    });
    return {
      name: item.name,
      url: item.url,
      status: response.status,
      latencyMs: response.latencyMs,
      ok: item.expect(response.status),
      preview: sanitizeText(response.text.slice(0, 200)),
    };
  } catch (error) {
    return {
      name: item.name,
      url: item.url,
      status: 0,
      latencyMs: 0,
      ok: false,
      error: sanitizeText(String(error?.message || error)),
    };
  }
}

async function writeSkipped(config, missing) {
  const evidencePath = await writeEvidence({
    gate: "v20.34_production_preacceptance",
    ok: true,
    skipped: true,
    startedAt: config.startedAt,
    endedAt: nowIso(),
    reason: "missing_required_env_or_gate_closed",
    requiredMissing: missing,
    env: {
      enabled: config.enabled,
      portalBaseUrl: config.portalBaseUrl || "",
      oplBaseUrl: config.oplBaseUrl || "",
      traceBaseUrl: config.traceBaseUrl || "",
    },
  });
  process.stdout.write(`${JSON.stringify({ ok: true, skipped: true, evidencePath })}\n`);
}

async function writeResult(config, results) {
  const ok = results.every((item) => item.ok);
  const evidencePath = await writeEvidence({
    gate: "v20.34_production_preacceptance",
    ok,
    skipped: false,
    startedAt: config.startedAt,
    endedAt: nowIso(),
    config: {
      portalBaseUrl: config.portalBaseUrl,
      oplBaseUrl: config.oplBaseUrl,
      traceBaseUrl: config.traceBaseUrl,
      timeoutMs: config.timeoutMs,
    },
    requiredEnv: [
      "RUN_V20_34_PRODUCTION_PREACCEPTANCE=1",
      "PORTAL_BASE_URL",
      "OPL_BASE_URL",
      "TRACE_BASE_URL",
    ],
    checks: results,
  });
  if (!ok) {
    process.stderr.write(`${JSON.stringify({ ok: false, skipped: false, evidencePath })}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify({ ok: true, skipped: false, evidencePath })}\n`);
}

async function run() {
  const config = readConfig();
  const missing = missingConfig(config);
  if (missing.length > 0) {
    await writeSkipped(config, missing);
    return;
  }
  const checks = buildChecks(config);
  const results = [];
  for (const item of checks) results.push(await runCheck(item, config.timeoutMs));
  await writeResult(config, results);
}

await run();
