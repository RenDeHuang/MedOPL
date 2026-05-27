#!/usr/bin/env node

const LOCAL_SERVICE_PLAN = Object.freeze([
  {
    id: "portal-frontend",
    owner: "Product Plane",
    cwd: ".",
    command: "npm --prefix services/portal run start",
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
  const options = { json: false, dryRun: false, timeoutMs: 2500 };
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (item === "--json") options.json = true;
    else if (item === "--dry-run") options.dryRun = true;
    else if (item === "--timeout-ms") {
      options.timeoutMs = Number(rest[index + 1] || options.timeoutMs);
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
    "",
  ].join("\n"));
}

function publicService(service) {
  return Object.fromEntries(Object.entries(service).filter(([, value]) => value !== undefined));
}

async function probeService(service, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(service.healthUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    const ok = service.expectedStatus.includes(response.status);
    return {
      id: service.id,
      ok,
      status: ok ? "reachable" : "unexpected_status",
      httpStatus: response.status,
      url: service.healthUrl,
      canClaim: service.canClaim,
      cannotClaim: service.cannotClaim,
    };
  } catch (error) {
    return {
      id: service.id,
      ok: false,
      status: "unreachable",
      error: error?.name === "AbortError" ? "timeout" : String(error.message || error),
      url: service.healthUrl,
      canClaim: "nothing; service was not reachable",
      cannotClaim: service.cannotClaim,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function buildPayload(mode, options) {
  if (mode === "plan") {
    return {
      ok: true,
      mode: "plan",
      forbiddenOps: [...FORBIDDEN_OPS],
      services: LOCAL_SERVICE_PLAN.map(publicService),
    };
  }
  if (mode === "check") {
    const results = options.dryRun
      ? LOCAL_SERVICE_PLAN.map((service) => ({
          id: service.id,
          ok: true,
          status: "not_checked_dry_run",
          url: service.healthUrl,
          canClaim: "local service check plan is registered",
          cannotClaim: service.cannotClaim,
        }))
      : await Promise.all(LOCAL_SERVICE_PLAN.map((service) => probeService(service, options.timeoutMs)));
    return {
      ok: results.every((result) => result.ok),
      mode: "check",
      dryRun: Boolean(options.dryRun),
      forbiddenOps: [...FORBIDDEN_OPS],
      services: LOCAL_SERVICE_PLAN.map(publicService),
      results,
    };
  }
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
