import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { REQUIRED_PORTAL_PAGES } from "./smoke-test-v20.31-portal-module-wiring-contract.mjs";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.31-rendering");

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function baseUrl() {
  return env("V20_31_PORTAL_BASE_URL", env("PORTAL_BASE_URL", "https://portal.medopl.cn")).replace(/\/+$/, "");
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeUrl(value = "") {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return String(value || "").replace(/[?#].*$/, "");
  }
}

function redactText(value = "") {
  return String(value || "")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/\b(?:X-Amz|x-amz|X-Goog|x-goog|signature|token|access_token|id_token|session|cookie)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]");
}

async function writeEvidence(payload) {
  await mkdir(evidenceDir, { recursive: true });
  const filePath = path.join(evidenceDir, `${nowIso().replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

async function resolveBrowseBin() {
  const candidates = [
    path.join(repoRoot, ".agents/skills/gstack/browse/dist/browse"),
    path.join(process.env.HOME || "", ".codex/skills/gstack/browse/dist/browse"),
    path.join(process.env.HOME || "", "projects/gstack/.agents/skills/gstack/browse/dist/browse"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  return "";
}

async function fetchWithTiming(url, options = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(Number(env("V20_31_LIVE_HTTP_TIMEOUT_MS", "15000"))),
      ...options,
    });
    const body = await response.text();
    return {
      ok: response.ok || response.status === 302,
      status: response.status,
      latencyMs: Date.now() - started,
      headers: response.headers,
      body,
      reason: "",
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      headers: new Headers(),
      body: "",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function pageStatus({ route, url, content, consoleErrors, goto }) {
  const text = redactText(content);
  const hasBlockingText = /\b502\b|Bad Gateway|Cannot GET|Application error|ReferenceError|TypeError/i.test(text);
  return {
    route,
    url: sanitizeUrl(url),
    ok: Boolean(text.trim().length > 0 && !hasBlockingText && !consoleErrors.length),
    textLength: text.trim().length,
    consoleErrorCount: consoleErrors.length,
    hasBlockingText,
    gotoStatus: goto.status,
  };
}

async function runBrowse(portalBaseUrl, route) {
  const browseBin = await resolveBrowseBin();
  const url = `${portalBaseUrl}${route}`;
  if (!browseBin) {
    return {
      route,
      url: sanitizeUrl(url),
      ok: false,
      textLength: 0,
      consoleErrorCount: 0,
      hasBlockingText: false,
      gotoStatus: 0,
      reason: "gstack_browse_binary_not_found",
    };
  }
  try {
    const goto = await execFileAsync(browseBin, ["goto", url], { timeout: 35_000 });
    const text = await execFileAsync(browseBin, ["text"], { timeout: 30_000 });
    const consoleErrors = await execFileAsync(browseBin, ["console", "--errors"], { timeout: 30_000 }).catch((error) => ({
      stdout: "",
      stderr: String(error.stderr || error.message || error),
    }));
    const content = String(text.stdout || "");
    const errors = `${consoleErrors.stdout || ""}\n${consoleErrors.stderr || ""}`.trim().split(/\r?\n/).filter(Boolean);
    return pageStatus({ route, url, content, consoleErrors: errors, goto: { status: goto.status || 0 } });
  } catch (error) {
    return {
      route,
      url: sanitizeUrl(url),
      ok: false,
      textLength: 0,
      consoleErrorCount: 0,
      hasBlockingText: false,
      gotoStatus: 0,
      reason: redactText(String(error.stderr || error.message || error)).slice(0, 500),
    };
  }
}

if (!boolEnv("RUN_V20_31_LIVE")) {
  console.log(JSON.stringify({
    ok: true,
    status: "skip",
    reason: "RUN_V20_31_LIVE_not_enabled",
    pages: REQUIRED_PORTAL_PAGES.map((page) => ({
      page: page.page,
      route: page.route,
      apiSource: page.apiSource,
      ok: false,
      textLength: 0,
      consoleErrorCount: 0,
      hasBlockingText: false,
      clickPlan: "goto_and_verify_main_content",
    })),
  }, null, 2));
  process.exit(0);
}

const portalBaseUrl = baseUrl();
const health = await fetchWithTiming(`${portalBaseUrl}/healthz`);
let healthPayload = {};
try {
  healthPayload = JSON.parse(health.body || "{}");
} catch {}

const pages = [];
for (const page of REQUIRED_PORTAL_PAGES) {
  pages.push({
    page: page.page,
    route: page.route,
    apiSource: page.apiSource,
    moduleSource: page.moduleSource,
    clickPlan: "goto_and_verify_main_content",
    ...await runBrowse(portalBaseUrl, page.route),
  });
}

const payload = {
  ok: health.ok && String(healthPayload?.build?.sha || "") === "opl-v20.31" && pages.every((page) => page.ok),
  status: "live",
  suite: "v20.31_portal_rendering",
  portalBaseUrl: sanitizeUrl(portalBaseUrl),
  health: {
    ok: health.ok,
    status: health.status,
    latencyMs: health.latencyMs,
    buildSha: String(healthPayload?.build?.sha || ""),
    reason: redactText(health.reason || ""),
  },
  pages,
  clickList: REQUIRED_PORTAL_PAGES.map((page) => ({
    page: page.page,
    route: page.route,
    apiSource: page.apiSource,
    clickPlan: "goto_and_verify_main_content",
  })),
};

const evidencePath = await writeEvidence(payload);
console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
assert.equal(payload.health.buildSha, "opl-v20.31", `portal_live_build_tag_mismatch:${payload.health.buildSha || "missing"}`);
assert.equal(payload.ok, true, "portal_rendering_live_gate_failed");
