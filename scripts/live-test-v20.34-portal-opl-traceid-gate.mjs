import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.34-portal-opl-traceid-gate");

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

function requestNodeJson(url, options = {}) {
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  const timeoutMs = options.timeoutMs || 30_000;
  const method = options.method || "GET";
  const body = options.body || "";
  const headers = { ...(options.headers || {}) };
  if (body && !headers["content-length"]) {
    headers["content-length"] = String(Buffer.byteLength(body));
  }
  return new Promise((resolve, reject) => {
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
            headers: res.headers,
            text,
            json,
          });
        });
      },
    );
    req.on("error", (error) => reject(error));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("request_timeout")));
    if (body) req.write(body);
    req.end();
  });
}

function authHeaderOrCookie() {
  const sessionCookie = env("PORTAL_SESSION_COOKIE");
  const bearerToken = env("PORTAL_BEARER_TOKEN");
  if (sessionCookie) return { cookie: sessionCookie };
  if (bearerToken) return { authorization: `Bearer ${bearerToken}` };
  return null;
}

function extractTraceId(obj) {
  if (!obj || typeof obj !== "object") return "";
  const direct = String(obj.traceId || obj.trace_id || obj.sessionTraceId || "").trim();
  if (direct) return direct;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const nested = extractTraceId(item);
      if (nested) return nested;
    }
    return "";
  }
  for (const value of Object.values(obj)) {
    const nested = extractTraceId(value);
    if (nested) return nested;
  }
  return "";
}

async function run() {
  const startedAt = nowIso();
  const config = traceGateConfig();
  const auth = authHeaderOrCookie();
  const requiredMissing = missingTraceGateConfig(config, auth);

  if (requiredMissing.length > 0) {
    const evidencePath = await writeEvidence({
      gate: "v20.34_portal_opl_traceid_gate",
      ok: true,
      skipped: true,
      startedAt,
      endedAt: nowIso(),
      reason: "missing_required_env_or_gate_closed",
      requiredMissing,
      env: {
        enabled: config.enabled,
        portalBaseUrl: config.portalBaseUrl || "",
      },
    });
    process.stdout.write(`${JSON.stringify({ ok: true, skipped: true, evidencePath })}\n`);
    return;
  }

  const headers = {
    accept: "application/json",
    "content-type": "application/json",
    ...(auth.cookie ? { cookie: auth.cookie } : {}),
    ...(auth.authorization ? { authorization: auth.authorization } : {}),
  };

  const steps = [];
  const recordStep = (name, result) => {
    steps.push({
      name,
      at: nowIso(),
      status: result.status || 0,
      ok: Boolean(result.ok),
      preview: sanitizeText(result.preview || ""),
      traceId: result.traceId || "",
      runId: result.runId || "",
    });
  };

  try {
    const launchResult = await requestNodeJson(`${config.portalBaseUrl}${config.launchPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ source: "v20.34_live_gate", mode: "traceid_gate" }),
      timeoutMs: config.requestTimeoutMs,
    });
    const launchTraceId = extractTraceId(launchResult.json);
    const runId = String(launchResult.json?.runId || launchResult.json?.run_id || "").trim();
    recordStep("launch", {
      status: launchResult.status,
      ok: launchResult.status >= 200 && launchResult.status < 300,
      preview: launchResult.text.slice(0, 160),
      traceId: launchTraceId,
      runId,
    });
    if (launchResult.status < 200 || launchResult.status >= 300) {
      throw new Error(`launch_failed:${launchResult.status}`);
    }

    const messageResult = await requestNodeJson(`${config.portalBaseUrl}${config.messagePath}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: config.message, runId }),
      timeoutMs: config.requestTimeoutMs,
    });
    const messageTraceId = extractTraceId(messageResult.json) || launchTraceId;
    recordStep("message", {
      status: messageResult.status,
      ok: messageResult.status >= 200 && messageResult.status < 300,
      preview: messageResult.text.slice(0, 160),
      traceId: messageTraceId,
      runId,
    });
    if (messageResult.status < 200 || messageResult.status >= 300) {
      throw new Error(`message_failed:${messageResult.status}`);
    }

    const deadlineAtMs = Date.now() + config.deadlineMs;
    let statusResult = null;
    while (Date.now() <= deadlineAtMs) {
      const probe = await requestNodeJson(`${config.portalBaseUrl}${config.statusPath}?runId=${encodeURIComponent(runId)}`, {
        method: "GET",
        headers,
        timeoutMs: config.requestTimeoutMs,
      });
      const state = String(probe.json?.status || probe.json?.state || "").toLowerCase();
      const done = ["done", "succeeded", "success", "completed", "finished"].includes(state);
      const failed = ["failed", "error", "timeout", "cancelled", "canceled"].includes(state);
      statusResult = { ...probe, state };
      recordStep("status_poll", {
        status: probe.status,
        ok: probe.status >= 200 && probe.status < 300 && !failed,
        preview: `state=${state};${probe.text.slice(0, 120)}`,
        traceId: extractTraceId(probe.json) || messageTraceId,
        runId,
      });
      if (failed) throw new Error(`status_failed:${state}`);
      if (done) break;
      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
    }
    if (!statusResult) throw new Error("status_missing");
    if (!["done", "succeeded", "success", "completed", "finished"].includes(statusResult.state)) {
      throw new Error(`status_deadline_exceeded:${statusResult.state || "unknown"}`);
    }

    const traceId = extractTraceId(statusResult.json) || extractTraceId(messageResult.json) || extractTraceId(launchResult.json);
    if (!traceId) throw new Error("traceid_missing");
    const traceResult = await requestNodeJson(
      `${config.portalBaseUrl}${config.traceQueryPath}?traceId=${encodeURIComponent(traceId)}&page_size=10`,
      { method: "GET", headers, timeoutMs: config.requestTimeoutMs },
    );
    recordStep("trace_query", {
      status: traceResult.status,
      ok: traceResult.status >= 200 && traceResult.status < 300,
      preview: traceResult.text.slice(0, 200),
      traceId,
      runId,
    });
    if (traceResult.status < 200 || traceResult.status >= 300) {
      throw new Error(`trace_query_failed:${traceResult.status}`);
    }

    const evidencePath = await writeEvidence({
      gate: "v20.34_portal_opl_traceid_gate",
      ok: true,
      skipped: false,
      startedAt,
      endedAt: nowIso(),
      config: {
        portalBaseUrl: config.portalBaseUrl,
        launchPath: config.launchPath,
        messagePath: config.messagePath,
        statusPath: config.statusPath,
        traceQueryPath: config.traceQueryPath,
        pollIntervalMs: config.pollIntervalMs,
        deadlineMs: config.deadlineMs,
        requestTimeoutMs: config.requestTimeoutMs,
      },
      steps,
    });
    process.stdout.write(`${JSON.stringify({ ok: true, skipped: false, evidencePath })}\n`);
  } catch (error) {
    const evidencePath = await writeEvidence({
      gate: "v20.34_portal_opl_traceid_gate",
      ok: false,
      skipped: false,
      startedAt,
      endedAt: nowIso(),
      error: sanitizeText(String(error?.message || error)),
      config: {
        portalBaseUrl: config.portalBaseUrl,
        pollIntervalMs: config.pollIntervalMs,
        deadlineMs: config.deadlineMs,
        requestTimeoutMs: config.requestTimeoutMs,
      },
      steps,
    });
    process.stderr.write(`${JSON.stringify({ ok: false, skipped: false, evidencePath, error: sanitizeText(String(error?.message || error)) })}\n`);
    process.exitCode = 1;
  }
}

function traceGateConfig() {
  return {
    enabled: boolEnv("RUN_V20_34_OPL_TRACEID_GATE"),
    portalBaseUrl: env("PORTAL_BASE_URL"),
    message: env("OPL_TEST_MESSAGE"),
    launchPath: env("V20_34_OPL_LAUNCH_PATH", "/portal/api/opl/launch"),
    messagePath: env("V20_34_OPL_MESSAGE_PATH", "/portal/api/opl/message"),
    statusPath: env("V20_34_OPL_STATUS_PATH", "/portal/api/opl/status"),
    traceQueryPath: env("V20_34_TRACE_QUERY_PATH", "/portal/api/session-traces"),
    pollIntervalMs: intEnv("V20_34_OPL_POLL_INTERVAL_MS", 1500),
    deadlineMs: intEnv("V20_34_OPL_DEADLINE_MS", 120000),
    requestTimeoutMs: intEnv("V20_34_OPL_REQUEST_TIMEOUT_MS", 30000),
  };
}

function missingTraceGateConfig(config, auth) {
  const missing = [];
  if (!config.enabled) missing.push("RUN_V20_34_OPL_TRACEID_GATE=1");
  if (!config.portalBaseUrl) missing.push("PORTAL_BASE_URL");
  if (!config.message) missing.push("OPL_TEST_MESSAGE");
  if (!auth) missing.push("PORTAL_SESSION_COOKIE 或 PORTAL_BEARER_TOKEN");
  return missing;
}

await run();
