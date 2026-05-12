import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const evalsetPath = "services/portal/frontend/src/harness/portal-ui-evalset.json";
const surfaceRegistryPath = "services/portal/frontend/src/harness/portal-ui-surfaces.ts";
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");
const reportPath = path.join(repoRoot, ".runtime", "portal-surface-eval", "report.json");
const adminEmail = "zitadel-admin@zitadel.localhost";
const adminPassword = "Password1!";
const report = {
  ok: false,
  contract: "v22_portal_frontend_surface_eval",
  schemaVersion: null,
  evalset: evalsetPath,
  baseUrl: null,
  coverage: {
    routes: { total: 0, done: 0, partial: 0, missing: 0 },
    layouts: { total: 0, done: 0, partial: 0, missing: 0 },
    surfaces: { total: 0, done: 0, partial: 0, missing: 0 },
    apiShapes: { total: 0, checked: 0 },
    browserDom: { routes: [], surfaces: [] },
  },
  partials: [],
  checked: [],
  error: null,
};

async function source(filePath) {
  return readFile(filePath, "utf8");
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, suffixes) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath, suffixes));
      continue;
    }
    if (suffixes.some((suffix) => entry.name.endsWith(suffix))) files.push(fullPath);
  }
  return files;
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function visibleVueText(sourceText) {
  return sourceText
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/{{[\s\S]*?}}/g, " ")
    .replace(/<[^>]+>/g, " ");
}

function assertUnique(items, key, label) {
  const seen = new Set();
  for (const item of items) {
    const value = item[key];
    assert(!seen.has(value), `${label}_duplicate:${value}`);
    seen.add(value);
  }
}

function assertValidStatus(value, label) {
  assert(["done", "partial", "missing"].includes(value), `${label}_invalid_status:${value}`);
}

function countStatuses(items) {
  return {
    total: items.length,
    done: items.filter((item) => item.status === "done").length,
    partial: items.filter((item) => item.status === "partial").length,
    missing: items.filter((item) => item.status === "missing").length,
  };
}

function valueAtPath(value, pathExpression) {
  return pathExpression.split(".").reduce((current, segment) => {
    if (current == null) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    return current[segment];
  }, value);
}

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(url, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    assert.equal(child.exitCode, null, `portal_process_exited:${child.exitCode}`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0 && response.status < 500) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    sleep(1500).then(() => false),
  ]);
  if (!exited) child.kill("SIGKILL");
}

async function withIsolatedPortalRuntime(fn) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-frontend-surface-eval-"));
  const backupRoot = path.join(tempRoot, "portal-runtime-backup");
  const hadRuntime = await exists(portalRuntimeRoot);
  if (hadRuntime) await rename(portalRuntimeRoot, backupRoot);
  try {
    await mkdir(path.dirname(portalRuntimeRoot), { recursive: true });
    return await fn();
  } finally {
    await rm(portalRuntimeRoot, { recursive: true, force: true }).catch(() => {});
    if (hadRuntime && await exists(backupRoot)) await rename(backupRoot, portalRuntimeRoot);
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function postForm(url, form, { cookie = "" } = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(form).toString(),
    redirect: "manual",
  });
}

function cookieHeaderFrom(response, name) {
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  assert(match, `${name}_cookie_required`);
  assert(setCookie.includes("HttpOnly"), `${name}_cookie_must_be_http_only`);
  return `${name}=${match[1]}`;
}

async function getJson(url, { cookie = "" } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_ENTRY,
    path.join(repoRoot, ".runtime", "browser-test", "node_modules", "playwright", "index.js"),
    path.join(repoRoot, "node_modules", "playwright", "index.js"),
    path.join(os.homedir(), ".codex", "skills", "gstack", "browse", "node_modules", "playwright", "index.js"),
    path.join("/home/dev/projects/gstack", "node_modules", "playwright", "index.js"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      const loaded = await import(pathToFileURL(candidate).href);
      return loaded.default || loaded;
    }
  }
  throw new Error(`playwright_not_found:${candidates.join(",")}`);
}

async function writeReport(nextReport) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(nextReport, null, 2)}\n`);
}

function runCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-12000);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-12000);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${label}_failed:${code}\n${stdout}\n${stderr}`));
    });
  });
}

function assertNoForbiddenKey(value, forbiddenKeys, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKey(item, forbiddenKeys, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert(!forbiddenKeys.includes(key), `${label}_forbidden_key:${key}`);
    assertNoForbiddenKey(child, forbiddenKeys, `${label}.${key}`);
  }
}

const evalset = JSON.parse(await source(evalsetPath));
const routerSource = await source("services/portal/frontend/src/router/index.ts");
const surfaceRegistrySource = await source(surfaceRegistryPath);
const portalPackage = JSON.parse(await source("services/portal/package.json"));
const frontendPackage = JSON.parse(await source("services/portal/frontend/package.json"));
const runtimeSuiteSource = await source("scripts/smoke-test-v22-portal-runtime-suite.mjs");

report.schemaVersion = evalset.schemaVersion || null;
report.coverage.routes = countStatuses(evalset.routes);
report.coverage.layouts = countStatuses(evalset.layouts);
report.coverage.surfaces = countStatuses(evalset.surfaces);
report.coverage.apiShapes.total = evalset.apiShapes.length;
report.partials = [
  ...evalset.routes.filter((item) => item.status !== "done").map((item) => ({
    kind: "route",
    id: item.id,
    nextRequiredChange: item.nextRequiredChange,
  })),
  ...evalset.surfaces.filter((item) => item.status !== "done").map((item) => ({
    kind: "surface",
    id: item.componentId,
    nextRequiredChange: item.nextRequiredChange,
  })),
  ...evalset.pageTasks.filter((item) => item.status !== "done").map((item) => ({
    kind: "pageTask",
    id: item.routeId,
    nextRequiredChange: item.nextRequiredChange,
  })),
];

assert.equal(evalset.version, 2, "evalset_version_mismatch");
assert.equal(evalset.schemaVersion, "2026-05-harness-native", "evalset_schema_version_mismatch");
assert.equal(evalset.model, "gpt-5.4", "evalset_model_mismatch");
assert.equal(evalset.owners.contract, "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md", "evalset_contract_owner_mismatch");
assert.equal(evalset.owners.runner, "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs", "evalset_runner_owner_mismatch");
assert.equal(evalset.owners.surfaceRegistry, surfaceRegistryPath, "evalset_surface_registry_owner_mismatch");
assert.equal(evalset.acceptance.unifiedRuntimeSuite, "node scripts/smoke-test-v22-portal-runtime-suite.mjs --group all", "evalset_unified_suite_mismatch");
assert.equal(evalset.artifactPolicy.runtimeReportPath, ".runtime/portal-surface-eval/report.json", "evalset_report_path_mismatch");
assert.equal(evalset.artifactPolicy.commitReports, false, "evalset_reports_must_not_be_committed");
assert.equal(evalset.coverage.doneRoutesMustHaveBrowserPath, true, "evalset_route_browser_coverage_required");
assert.equal(evalset.coverage.doneSurfacesMustHaveDomAnchor, true, "evalset_surface_anchor_coverage_required");
assert.equal(evalset.coverage.apiShapesUseNestedRequiredPaths, true, "evalset_api_shape_required_paths_required");
assert.equal(evalset.coverage.partialItemsMustDeclareNextRequiredChange, true, "evalset_partial_next_change_required");
assert.equal(evalset.scope.portalOnly, true, "evalset_must_be_portal_only");
assert.equal(evalset.scope.sourceOfExecutableUiTruth, true, "evalset_must_be_executable_ui_truth");
assert.equal(evalset.scope.callsRealCloud, false, "evalset_must_not_call_real_cloud");
assert.equal(evalset.scope.readsSecrets, false, "evalset_must_not_read_secrets");
assert.deepEqual(evalset.requiredDomAnchors, ["data-route-id", "data-component-id", "data-layout-id"], "required_dom_anchors_mismatch");

for (const key of ["routes", "layouts", "surfaces", "apiShapes", "forbiddenCopy", "pageTasks"]) {
  assert(Array.isArray(evalset[key]), `evalset_${key}_must_be_array`);
}
assertUnique(evalset.routes, "id", "evalset_routes");
assertUnique(evalset.layouts, "layoutId", "evalset_layouts");
assertUnique(evalset.surfaces, "componentId", "evalset_surfaces");
assertUnique(evalset.apiShapes, "id", "evalset_api_shapes");
const routeIds = new Set(evalset.routes.map((route) => route.id));

for (const route of evalset.routes) {
  assertValidStatus(route.status, `route_${route.id}`);
  assert(await exists(route.owner), `route_owner_missing:${route.owner}`);
  if (route.renderedBy === "spa") {
    assertIncludes(routerSource, `path: "${route.path}"`, `route_${route.id}`);
  } else {
    assertIncludes(await source(route.owner), route.path, `backend_route_${route.id}`);
  }
  if (route.status === "partial") {
    assert(route.nextRequiredChange, `route_partial_next_required_change_missing:${route.id}`);
  }
}

for (const layout of evalset.layouts) {
  assertValidStatus(layout.status, `layout_${layout.layoutId}`);
  assert(await exists(layout.owner), `layout_owner_missing:${layout.owner}`);
  const layoutSource = await source(layout.owner);
  assertIncludes(layoutSource, "data-layout-id", `layout_anchor_${layout.layoutId}`);
  assertIncludes(surfaceRegistrySource, `layoutId: "${layout.layoutId}"`, `layout_registry_${layout.layoutId}`);
}

for (const surface of evalset.surfaces) {
  assertValidStatus(surface.status, `surface_${surface.componentId}`);
  assert(routeIds.has(surface.routeId), `surface_route_id_missing:${surface.componentId}:${surface.routeId}`);
  assert(await exists(surface.owner), `surface_owner_missing:${surface.owner}`);
  if (surface.status === "done") {
    const surfaceSource = await source(surface.owner);
    assertIncludes(surfaceSource, `data-route-id="${surface.routeId}"`, `surface_route_anchor_${surface.componentId}`);
    assertIncludes(surfaceSource, `data-component-id="${surface.componentId}"`, `surface_component_anchor_${surface.componentId}`);
    assertIncludes(surfaceRegistrySource, `componentId: "${surface.componentId}"`, `surface_registry_${surface.componentId}`);
  } else {
    assert(surface.nextRequiredChange, `surface_partial_next_required_change_missing:${surface.componentId}`);
  }
}

for (const pageTask of evalset.pageTasks) {
  assertValidStatus(pageTask.status, `page_task_${pageTask.routeId}`);
  assert(routeIds.has(pageTask.routeId), `page_task_route_id_missing:${pageTask.routeId}`);
  if (pageTask.status !== "done") {
    assert(pageTask.nextRequiredChange, `page_task_next_required_change_missing:${pageTask.routeId}`);
  }
}

for (const apiShape of evalset.apiShapes) {
  assert(routeIds.has(apiShape.routeId), `api_shape_route_id_missing:${apiShape.id}:${apiShape.routeId}`);
  assert.equal(apiShape.method, "GET", `api_shape_method_must_be_get:${apiShape.id}`);
  assert(apiShape.path.startsWith("/portal/api/"), `api_shape_path_must_be_portal_api:${apiShape.id}`);
  assert(await exists(apiShape.owner), `api_shape_owner_missing:${apiShape.owner}`);
  const ownerSource = await source(apiShape.owner);
  assert(apiShape.requiredKeys.length > 0, `api_shape_required_keys_missing:${apiShape.id}`);
  assert(apiShape.requiredPaths.length > 0, `api_shape_required_paths_missing:${apiShape.id}`);
  assert(apiShape.forbiddenKeys.length > 0, `api_shape_forbidden_keys_missing:${apiShape.id}`);
  assert(ownerSource.includes(apiShape.path.replace("/portal/api", "")) || ownerSource.includes(apiShape.path), `api_shape_frontend_path_missing:${apiShape.id}`);
}

const visibleSources = [];
for (const dir of [
  "services/portal/frontend/src/views",
  "services/portal/frontend/src/components",
  "services/portal/frontend/src/layouts",
]) {
  for (const filePath of await listFiles(dir, [".vue"])) {
    visibleSources.push(visibleVueText(await source(filePath)));
  }
}
visibleSources.push(await source("services/portal/src/app/portal-auth-runtime-handler.mjs"));
visibleSources.push(await source("services/portal/src/app/portal-public-home.mjs"));
const visibleText = visibleSources.join("\n");
for (const forbidden of evalset.forbiddenCopy) {
  assertExcludes(visibleText, forbidden, "frontend_surface_forbidden_copy");
}

assert.equal(frontendPackage.scripts.test, "vitest run", "frontend_test_entry_must_be_vitest");
assert.equal(portalPackage.scripts["frontend:test"], "npm --prefix frontend run test", "portal_frontend_test_entry_missing");
assert(await exists("services/portal/frontend/src/harness/portal-ui-evalset.test.ts"), "portal_frontend_evalset_test_missing");
assertIncludes(runtimeSuiteSource, '"surface"', "runtime_suite_surface_group_missing");
assertIncludes(runtimeSuiteSource, "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs", "runtime_suite_surface_eval_missing");

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
report.baseUrl = baseUrl;
let portal = null;
let browser = null;
let stdout = "";
let stderr = "";

try {
  await runCommand("npm", ["--prefix", "services/portal", "run", "frontend:build"], "portal_frontend_build");
  report.checked.push("frontend_build_before_browser");
  await withIsolatedPortalRuntime(async () => {
    portal = spawn(process.execPath, [portalEntrypoint], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        PORTAL_STORAGE_MODE: "json",
        PORTAL_OIDC_ENABLED: "0",
        PORTAL_IDENTITY_SYNC_MODE: "local",
        PORTAL_ALLOW_REGISTRATION: "1",
        PORTAL_ADMIN_EMAIL: adminEmail,
        PORTAL_ADMIN_PASSWORD: adminPassword,
        PORTAL_ADMIN_NAME: "Portal Admin",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    portal.stdout.setEncoding("utf8");
    portal.stderr.setEncoding("utf8");
    portal.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-8000);
    });
    portal.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-8000);
    });

    await waitFor(`${baseUrl}/healthz`, portal);
    const login = await postForm(`${baseUrl}/login`, { email: adminEmail, password: adminPassword });
    assert.equal(login.status, 302, "surface_eval_login_must_redirect");
    const cookie = cookieHeaderFrom(login, "portal_session");

    for (const apiShape of evalset.apiShapes) {
      const { response, json } = await getJson(`${baseUrl}${apiShape.path}`, {
        cookie: apiShape.id === "public_settings" ? "" : cookie,
      });
      assert.equal(response.status, 200, `api_shape_status_mismatch:${apiShape.id}`);
      for (const key of apiShape.requiredKeys) {
        assert(key in json, `api_shape_required_key_missing:${apiShape.id}:${key}`);
      }
      for (const requiredPath of apiShape.requiredPaths) {
        assert.notEqual(valueAtPath(json, requiredPath), undefined, `api_shape_required_path_missing:${apiShape.id}:${requiredPath}`);
      }
      assertNoForbiddenKey(json, apiShape.forbiddenKeys, `api_shape_${apiShape.id}`);
      report.coverage.apiShapes.checked += 1;
    }

    const { chromium } = await loadPlaywright();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/home`, { waitUntil: "domcontentloaded" });
    assert(await page.locator("body").innerText().then((text) => text.includes("登录")), "browser_home_login_link_missing");
    report.coverage.browserDom.routes.push("/home");
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="email"]').waitFor({ timeout: 10000 });
    report.coverage.browserDom.routes.push("/login");
    await page.locator('input[name="email"]').fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await Promise.all([
      page.waitForURL(/\/overview$/, { timeout: 30000 }),
      page.locator('button[type="submit"]').click(),
    ]);
    report.coverage.browserDom.routes.push("/overview");
    await page.waitForSelector('[data-layout-id="layout.dashboard_page"]', { timeout: 30000 });
    for (const surface of evalset.surfaces.filter((item) => item.status === "done" && item.routeId === "overview")) {
      await page.locator(surface.selector).waitFor({ timeout: 30000 });
      report.coverage.browserDom.surfaces.push(surface.componentId);
    }
    await page.goto(`${baseUrl}/admin/system`, { waitUntil: "networkidle" });
    report.coverage.browserDom.routes.push("/admin/system");
    for (const surface of evalset.surfaces.filter((item) => item.status === "done" && item.routeId === "admin.system")) {
      await page.locator(surface.selector).waitFor({ timeout: 30000 });
      report.coverage.browserDom.surfaces.push(surface.componentId);
    }
  });

  report.ok = true;
  report.checked = [
    "harness_native_schema",
    "routes",
    "layouts",
    "surface_dom_anchors",
    "surface_registry",
    "forbidden_copy",
    "frontend_test_entry",
    "api_shapes_required_paths",
    "browser_dom_anchors",
    "runtime_report",
  ];
  await writeReport(report);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.ok = false;
  report.error = String(error.message || error);
  report.stdout = stdout;
  report.stderr = stderr;
  await writeReport(report).catch(() => {});
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopChild(portal);
}
