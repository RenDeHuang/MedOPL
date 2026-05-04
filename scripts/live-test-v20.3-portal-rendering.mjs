import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { listPortalRequiredModuleSourcePayloads } from "../services/portal/src/app/portal-module-source-payloads.mjs";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.3-rendering");

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function baseUrl() {
  return env("V20_3_PORTAL_BASE_URL", env("PORTAL_BASE_URL", "https://portal.medopl.cn")).replace(/\/+$/, "");
}

function nowIso() {
  return new Date().toISOString();
}

async function writeEvidence(payload) {
  await mkdir(evidenceDir, { recursive: true });
  const filePath = path.join(evidenceDir, `${nowIso().replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

function sanitizeUrl(value = "") {
  const parsed = new URL(value);
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  return parsed.toString();
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
      signal: AbortSignal.timeout(Number(env("V20_3_LIVE_HTTP_TIMEOUT_MS", "15000"))),
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

function missingLoginReason() {
  return env("PORTAL_ADMIN_EMAIL") && env("PORTAL_ADMIN_PASSWORD")
    ? "portal_session_cookie_missing_or_login_failed"
    : "PORTAL_ADMIN_EMAIL_or_PORTAL_ADMIN_PASSWORD_missing";
}

async function portalLoginCookie(portalBaseUrl) {
  const email = env("PORTAL_ADMIN_EMAIL");
  const password = env("PORTAL_ADMIN_PASSWORD");
  if (!email || !password) return { cookie: "", login: { ok: false, reason: "PORTAL_ADMIN_EMAIL_or_PORTAL_ADMIN_PASSWORD_missing" } };
  const form = new URLSearchParams({ email, password });
  const response = await fetchWithTiming(`${portalBaseUrl}/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const setCookie = response.headers.get("set-cookie") || "";
  const portalSession = setCookie.split(/,\s*/).find((item) => item.startsWith("portal_session=")) || "";
  return {
    cookie: portalSession.split(";")[0],
    login: {
      ok: Boolean(portalSession),
      status: response.status,
      latencyMs: response.latencyMs,
      reason: response.reason || (portalSession ? "" : "portal_session_cookie_missing"),
    },
  };
}

async function probePortalApi(portalBaseUrl, cookie) {
  if (!cookie) {
    return { ok: false, reason: missingLoginReason() };
  }
  const response = await fetchWithTiming(`${portalBaseUrl}/portal/api/me`, {
    headers: { cookie },
  });
  let payload = {};
  try {
    payload = JSON.parse(response.body || "{}");
  } catch {}
  return {
    ok: response.ok && Boolean(payload?.id || payload?.user?.id),
    status: response.status,
    latencyMs: response.latencyMs,
    userVisible: Boolean(payload?.id || payload?.user?.id),
  };
}

function browserPageOk(content, errorText) {
  return content.trim().length > 0 && !/\b502\b|Bad Gateway|Cannot GET/i.test(content) && !errorText;
}

function consoleErrorCount(errorText) {
  return errorText ? errorText.split(/\r?\n/).filter(Boolean).length : 0;
}

function browseFailurePayload({ route, url, error }) {
  return {
    ok: false,
    route,
    url: sanitizeUrl(url),
    textLength: 0,
    containsLogin: false,
    consoleErrorCount: 0,
    reason: String(error.stderr || error.message || error).slice(0, 500),
  };
}

async function runBrowse(portalBaseUrl, route) {
  const browseBin = await resolveBrowseBin();
  if (!browseBin) {
    return { ok: false, route, reason: "gstack_browse_binary_not_found" };
  }
  const url = `${portalBaseUrl}${route}`;
  try {
    const goto = await execFileAsync(browseBin, ["goto", url], { timeout: 35_000 });
    const text = await execFileAsync(browseBin, ["text"], { timeout: 30_000 });
    const consoleErrors = await execFileAsync(browseBin, ["console", "--errors"], { timeout: 30_000 }).catch((error) => ({
      stdout: "",
      stderr: String(error.stderr || error.message || error),
    }));
    const content = String(text.stdout || "");
    const errorText = `${consoleErrors.stdout || ""}\n${consoleErrors.stderr || ""}`.trim();
    return {
      ok: browserPageOk(content, errorText),
      route,
      url: sanitizeUrl(url),
      textLength: content.trim().length,
      containsLogin: /登录|统一登录|邮箱|password/i.test(content),
      consoleErrorCount: consoleErrorCount(errorText),
      stderr: String(goto.stderr || "").trim(),
    };
  } catch (error) {
    return browseFailurePayload({ route, url, error });
  }
}

if (!boolEnv("RUN_V20_3_LIVE")) {
  console.log(JSON.stringify({
    ok: true,
    status: "skip",
    reason: "RUN_V20_3_LIVE_not_enabled",
    requiredModules: listPortalRequiredModuleSourcePayloads().map((item) => item.moduleSource),
  }, null, 2));
  process.exit(0);
}

const portalBaseUrl = baseUrl();
const health = await fetchWithTiming(`${portalBaseUrl}/healthz`);
let healthPayload = {};
try {
  healthPayload = JSON.parse(health.body || "{}");
} catch {}

const loginProbe = await portalLoginCookie(portalBaseUrl);
const cookie = loginProbe.cookie;
const api = await probePortalApi(portalBaseUrl, cookie);
const pages = [];
pages.push(await runBrowse(portalBaseUrl, "/login"));
if (cookie) {
  pages.push(await runBrowse(portalBaseUrl, "/portal/app/overview"));
  pages.push(await runBrowse(portalBaseUrl, "/portal/app/billing"));
  pages.push(await runBrowse(portalBaseUrl, "/portal/app/workspace"));
  pages.push(await runBrowse(portalBaseUrl, "/portal/app/trace"));
}

const moduleEvidence = listPortalRequiredModuleSourcePayloads().map((item) => ({
  moduleSource: item.moduleSource,
  apiSource: item.apiSource,
  buildTag: item.buildTag,
  rendered: pages.some((page) => page.ok),
}));

const payload = {
  ok: health.ok && String(healthPayload?.build?.sha || "") === "opl-v20.3" && api.ok && pages.every((page) => page.ok),
  status: "live",
  suite: "v20.3_portal_rendering",
  portalBaseUrl: sanitizeUrl(portalBaseUrl),
  health: {
    ok: health.ok,
    status: health.status,
    latencyMs: health.latencyMs,
    buildSha: String(healthPayload?.build?.sha || ""),
    reason: health.reason || "",
  },
  login: loginProbe.login,
  api,
  pages,
  evidence: {
    modules: moduleEvidence,
  },
};

const evidencePath = await writeEvidence(payload);
console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
assert.equal(payload.health.buildSha, "opl-v20.3", `portal_live_build_tag_mismatch:${payload.health.buildSha || "missing"}`);
assert.equal(payload.ok, true, "portal_rendering_live_gate_failed");
