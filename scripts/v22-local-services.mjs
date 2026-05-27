#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const RUNTIME_DIR = ".runtime/local-services";
const runtimeRoot = path.join(repoRoot, RUNTIME_DIR);
const inheritedEnv = globalThis.process["env"];
const LOCAL_SERVICE_PLAN = Object.freeze([
  {
    id: "portal-frontend",
    owner: "Product Plane",
    cwd: ".",
    command: "npm --prefix services/portal run start",
    env: {
      VITE_MEDOPL_GO_BACKEND_URL: "http://127.0.0.1:8789",
    },
    url: "http://127.0.0.1:17180/",
    healthUrl: "http://127.0.0.1:17180/",
    expectedStatus: [200],
    canClaim: "Portal frontend dev surface is reachable locally.",
    cannotClaim: "production deploy or real cloud readiness",
  },
  {
    id: "go-backend",
    owner: "Product Plane / Operations Plane",
    cwd: "services/medopl-go-backend",
    command: "go run ./cmd/server",
    env: {
      MEDOPL_BACKEND_PORT: "8789",
      PORTAL_OPL_PROVIDER_SECRET_ROOT: ".runtime/local-services/provider-secret-boundary",
    },
    url: "http://127.0.0.1:8789/",
    healthUrl: "http://127.0.0.1:8789/healthz",
    readyUrl: "http://127.0.0.1:8789/readyz",
    expectedStatus: [200],
    canClaim: "Go local pre-cloud SaaS backend health is reachable locally.",
    cannotClaim: "production backend replacement or real cloud readiness",
  },
  {
    id: "opl-web-gateway",
    owner: "Integration Plane",
    cwd: ".",
    command: "npm --prefix services/opl-web-gateway run start",
    env: {
      OPL_UPSTREAM_URL: "http://127.0.0.1:18130",
      OPL_WEB_GATEWAY_PORT: "18789",
      PORTAL_PUBLIC_URL: "http://127.0.0.1:17180",
      PORTAL_RUNTIME_BRIDGE_URL: "http://127.0.0.1:8788",
    },
    url: "http://127.0.0.1:18789/",
    healthUrl: "http://127.0.0.1:18789/healthz",
    expectedStatus: [200],
    requiredEnv: ["OPL_UPSTREAM_URL"],
    canClaim: "Gateway health and clean upstream configuration are visible locally.",
    cannotClaim: "upstream OPL production availability or provider capability",
  },
  {
    id: "runtime-bridge",
    owner: "Runtime Plane",
    cwd: ".",
    command: "npm --prefix services/opl-runtime-bridge run start",
    env: {
      OPL_RUNTIME_MODE: "local",
      OPL_WEB_URL: "http://127.0.0.1:18789",
      PORT: "8788",
      PORTAL_RUNTIME_BRIDGE_STATE_ROOT: ".runtime/local-services/runtime-bridge-state",
    },
    url: "http://127.0.0.1:8788/",
    healthUrl: "http://127.0.0.1:8788/healthz",
    expectedStatus: [200],
    canClaim: "Runtime Bridge health is reachable locally.",
    cannotClaim: "production runtime, live provider or real cloud evidence",
  },
  {
    id: "clean-opl-webui",
    owner: "OPL upstream",
    external: true,
    cwd: "external",
    command: "run clean one-person-lab upstream outside MedOPL source",
    url: "http://127.0.0.1:18130/",
    healthUrl: "http://127.0.0.1:18130/",
    expectedStatus: [200, 302, 401],
    canClaim: "The external clean OPL WebUI endpoint is reachable locally.",
    cannotClaim: "MedOPL owns upstream source or upstream internals",
  },
]);

const FORBIDDEN_OPS = Object.freeze([
  "secret",
  "live-cloud",
  "true-cloud-mutation",
  "deploy",
  "kubectl",
  "build-push",
  "live-test",
  "upstream-write",
]);

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const options = { json: false, dryRun: false, timeoutMs: 2500, lines: 80 };
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (item === "--json") options.json = true;
    else if (item === "--dry-run") options.dryRun = true;
    else if (item === "--timeout-ms") {
      options.timeoutMs = Number(rest[index + 1] || options.timeoutMs);
      index += 1;
    } else if (item === "--lines") {
      options.lines = Number(rest[index + 1] || options.lines);
      index += 1;
    }
  }
  return { mode, options };
}

function printUsage() {
  process.stderr.write([
    "Usage:",
    "  node scripts/v22-local-services.mjs plan [--json]",
    "  node scripts/v22-local-services.mjs check [--dry-run] [--timeout-ms 2500] [--json]",
    "  node scripts/v22-local-services.mjs start [--dry-run] [--json]",
    "  node scripts/v22-local-services.mjs stop [--dry-run] [--json]",
    "  node scripts/v22-local-services.mjs status [--json]",
    "  node scripts/v22-local-services.mjs logs [--dry-run] [--lines 80] [--json]",
    "  node scripts/v22-local-services.mjs verify [--dry-run] [--timeout-ms 2500] [--json]",
    "",
  ].join("\n"));
}

function publicService(service) {
  return Object.fromEntries(Object.entries(service).filter(([, value]) => value !== undefined));
}

function servicePaths(service) {
  return {
    pidFile: path.join(runtimeRoot, `${service.id}.pid.json`),
    logFile: path.join(runtimeRoot, `${service.id}.log`),
    publicLogFile: `${RUNTIME_DIR}/${service.id}.log`,
  };
}

function ensureRuntimeRoot() {
  mkdirSync(runtimeRoot, { recursive: true });
}

function commandToSpawn(command) {
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map((part) => part.replace(/^"|"$/g, ""));
}

function readPid(service) {
  const { pidFile } = servicePaths(service);
  if (!existsSync(pidFile)) return null;
  try {
    return JSON.parse(readFileSync(pidFile, "utf8"));
  } catch {
    return null;
  }
}

function removePid(service) {
  const { pidFile } = servicePaths(service);
  if (existsSync(pidFile)) unlinkSync(pidFile);
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function statusForService(service) {
  if (service.external) {
    return {
      id: service.id,
      ok: true,
      status: "external",
      url: service.url,
      canClaim: "external clean upstream endpoint remains outside MedOPL process control",
      cannotClaim: service.cannotClaim,
    };
  }
  const pidRecord = readPid(service);
  if (!pidRecord?.pid) {
    return {
      id: service.id,
      ok: true,
      status: "stopped",
      command: service.command,
      logFile: servicePaths(service).publicLogFile,
      canClaim: "service is not running under repo-local orchestration",
      cannotClaim: service.cannotClaim,
    };
  }
  const alive = isAlive(pidRecord.pid);
  return {
    id: service.id,
    ok: alive,
    status: alive ? "running" : "exited",
    pid: pidRecord.pid,
    command: pidRecord.command,
    startedAt: pidRecord.startedAt,
    logFile: pidRecord.logFile,
    canClaim: alive ? service.canClaim : "service pid file exists but the process is not alive",
    cannotClaim: service.cannotClaim,
  };
}

function startService(service, options) {
  const paths = servicePaths(service);
  if (service.external) {
    return {
      id: service.id,
      ok: true,
      status: "external_not_started",
      url: service.url,
      canClaim: "clean OPL WebUI remains external to MedOPL orchestration",
      cannotClaim: service.cannotClaim,
    };
  }
  const current = statusForService(service);
  if (current.status === "running") return { ...current, status: "already_running" };
  if (options.dryRun) {
    return {
      id: service.id,
      ok: true,
      status: "would_start",
      command: service.command,
      cwd: service.cwd,
      logFile: paths.publicLogFile,
      envKeys: Object.keys(service["env"] || {}).sort(),
      canClaim: "start command is registered; no process was spawned",
      cannotClaim: service.cannotClaim,
    };
  }
  ensureRuntimeRoot();
  const [bin, ...args] = commandToSpawn(service.command);
  if (!bin) {
    return { id: service.id, ok: false, status: "empty_command", cannotClaim: service.cannotClaim };
  }
  const logFd = openSync(paths.logFile, "a");
  try {
    const child = spawn(bin, args, {
      cwd: path.resolve(repoRoot, service.cwd),
      detached: true,
      env: { ...inheritedEnv, ...(service["env"] || {}) },
      stdio: ["ignore", logFd, logFd],
    });
    child.unref();
    writeFileSync(paths.pidFile, `${JSON.stringify({
      id: service.id,
      pid: child.pid,
      command: service.command,
      cwd: service.cwd,
      logFile: paths.publicLogFile,
      startedAt: new Date().toISOString(),
    }, null, 2)}\n`);
    return {
      id: service.id,
      ok: true,
      status: "started",
      pid: child.pid,
      command: service.command,
      logFile: paths.publicLogFile,
      canClaim: service.canClaim,
      cannotClaim: service.cannotClaim,
    };
  } finally {
    closeSync(logFd);
  }
}

function stopService(service, options) {
  if (service.external) {
    return {
      id: service.id,
      ok: true,
      status: "external_not_stopped",
      url: service.url,
      canClaim: "clean OPL WebUI remains outside MedOPL process control",
      cannotClaim: service.cannotClaim,
    };
  }
  const current = statusForService(service);
  if (options.dryRun) {
    return {
      id: service.id,
      ok: true,
      status: "would_stop_if_running",
      pid: current.pid,
      command: service.command,
      logFile: servicePaths(service).publicLogFile,
      canClaim: "stop command is registered; no signal was sent",
      cannotClaim: service.cannotClaim,
    };
  }
  if (!current.pid || !isAlive(current.pid)) {
    removePid(service);
    return {
      id: service.id,
      ok: true,
      status: "stopped",
      command: service.command,
      logFile: servicePaths(service).publicLogFile,
      canClaim: "service was already stopped",
      cannotClaim: service.cannotClaim,
    };
  }
  try {
    process.kill(process.platform === "win32" ? current.pid : -current.pid, "SIGTERM");
  } catch {
    process.kill(current.pid, "SIGTERM");
  }
  removePid(service);
  return {
    id: service.id,
    ok: true,
    status: "stopped",
    pid: current.pid,
    command: service.command,
    logFile: servicePaths(service).publicLogFile,
    canClaim: "repo-local service stop signal was sent",
    cannotClaim: service.cannotClaim,
  };
}

function logsForService(service, options) {
  const paths = servicePaths(service);
  if (service.external) {
    return {
      id: service.id,
      ok: true,
      status: "external_no_log",
      url: service.url,
      lines: [],
      canClaim: "MedOPL does not own clean OPL WebUI process logs",
      cannotClaim: service.cannotClaim,
    };
  }
  if (options.dryRun) {
    return {
      id: service.id,
      ok: true,
      status: "log_plan",
      logFile: paths.publicLogFile,
      lines: [],
      canClaim: "log path is registered; log file was not read",
      cannotClaim: service.cannotClaim,
    };
  }
  if (!existsSync(paths.logFile)) {
    return {
      id: service.id,
      ok: true,
      status: "missing_log",
      logFile: paths.publicLogFile,
      lines: [],
      canClaim: "no local log has been emitted yet",
      cannotClaim: service.cannotClaim,
    };
  }
  const lines = readFileSync(paths.logFile, "utf8").split("\n").filter(Boolean).slice(-Math.max(1, options.lines));
  return {
    id: service.id,
    ok: true,
    status: "log_tail",
    logFile: paths.publicLogFile,
    lines,
    canClaim: "repo-local service log tail is available",
    cannotClaim: service.cannotClaim,
  };
}

async function probeUrl(url, expectedStatus, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    return {
      ok: expectedStatus.includes(response.status),
      httpStatus: response.status,
      url,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.name === "AbortError" ? "timeout" : String(error.message || error),
      url,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probeService(service, timeoutMs) {
  const health = await probeUrl(service.healthUrl, service.expectedStatus, timeoutMs);
  const ready = service.readyUrl ? await probeUrl(service.readyUrl, service.expectedStatus, timeoutMs) : null;
  const ok = health.ok && (ready ? ready.ok : true);
  return {
    id: service.id,
    ok,
    status: ok ? "reachable" : "unreachable",
    httpStatus: health.httpStatus,
    readyHttpStatus: ready?.httpStatus,
    error: health.error || ready?.error,
    url: service.healthUrl,
    readyUrl: service.readyUrl,
    canClaim: ok ? service.canClaim : "nothing; service was not reachable",
    cannotClaim: service.cannotClaim,
  };
}

async function checkPayload(options) {
  const results = options.dryRun
    ? LOCAL_SERVICE_PLAN.map((service) => ({
        id: service.id,
        ok: true,
        status: "not_checked_dry_run",
        url: service.healthUrl,
        readyUrl: service.readyUrl,
        canClaim: "local service check plan is registered",
        cannotClaim: service.cannotClaim,
      }))
    : await Promise.all(LOCAL_SERVICE_PLAN.map((service) => probeService(service, options.timeoutMs)));
  return {
    ok: results.every((result) => result.ok),
    mode: "check",
    dryRun: Boolean(options.dryRun),
    runtimeDir: RUNTIME_DIR,
    forbiddenOps: [...FORBIDDEN_OPS],
    services: LOCAL_SERVICE_PLAN.map(publicService),
    results,
  };
}

function dryRunStatusForService(service) {
  if (service.external) return statusForService(service);
  return {
    id: service.id,
    ok: true,
    status: "stopped",
    command: service.command,
    logFile: servicePaths(service).publicLogFile,
    canClaim: "service status shape is registered; local process table was not read",
    cannotClaim: service.cannotClaim,
  };
}

async function statusPayload(options) {
  const results = LOCAL_SERVICE_PLAN.map((service) => (options.dryRun ? dryRunStatusForService(service) : statusForService(service)));
  return {
    ok: results.every((result) => result.ok),
    mode: "status",
    dryRun: Boolean(options.dryRun),
    runtimeDir: RUNTIME_DIR,
    forbiddenOps: [...FORBIDDEN_OPS],
    services: LOCAL_SERVICE_PLAN.map(publicService),
    results,
  };
}

async function buildLifecyclePayload(mode, options) {
  const operation = {
    start: startService,
    stop: stopService,
    logs: logsForService,
  }[mode];
  const results = LOCAL_SERVICE_PLAN.map((service) => operation(service, options));
  return {
    ok: results.every((result) => result.ok),
    mode,
    dryRun: Boolean(options.dryRun),
    runtimeDir: RUNTIME_DIR,
    forbiddenOps: [...FORBIDDEN_OPS],
    services: LOCAL_SERVICE_PLAN.map(publicService),
    results,
  };
}

async function verifyPayload(options) {
  const plan = await buildPayload("plan", options);
  const check = await checkPayload(options);
  const status = await statusPayload(options);
  return {
    ok: plan.ok && check.ok && status.ok,
    mode: "verify",
    dryRun: Boolean(options.dryRun),
    runtimeDir: RUNTIME_DIR,
    forbiddenOps: [...FORBIDDEN_OPS],
    steps: ["plan", "check", "status"],
    plan,
    check,
    status,
  };
}

async function buildPayload(mode, options) {
  if (mode === "plan") {
    return {
      ok: true,
      mode: "plan",
      dryRun: false,
      runtimeDir: RUNTIME_DIR,
      forbiddenOps: [...FORBIDDEN_OPS],
      services: LOCAL_SERVICE_PLAN.map(publicService),
    };
  }
  if (mode === "check") return checkPayload(options);
  if (mode === "status") return statusPayload(options);
  if (mode === "start" || mode === "stop" || mode === "logs") return buildLifecyclePayload(mode, options);
  if (mode === "verify") return verifyPayload(options);
  throw new Error(`unknown_mode:${mode || "(missing)"}`);
}

function renderHuman(payload) {
  const lines = [`mode: ${payload.mode}`, `ok: ${payload.ok}`];
  for (const service of payload.services || []) {
    lines.push(`- ${service.id}: ${service.command} (${service.healthUrl})`);
  }
  for (const result of payload.results || []) {
    lines.push(`  ${result.id}: ${result.status}${result.httpStatus ? ` ${result.httpStatus}` : ""}`);
  }
  return `${lines.join("\n")}\n`;
}

const { mode, options } = parseArgs(process.argv.slice(2));
try {
  if (!mode) {
    printUsage();
    process.exitCode = 2;
  } else {
    const payload = await buildPayload(mode, options);
    process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
    if (!payload.ok) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${String(error.message || error)}\n`);
  process.exitCode = 1;
}
