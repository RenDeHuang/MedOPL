import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const evalsetPath = "services/portal/frontend/src/harness/portal-ui-evalset.json";
const surfaceRegistryPath = "services/portal/frontend/src/harness/portal-ui-surfaces.ts";
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
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
    primitives: { total: 0, checked: 0 },
    copyRegistry: { total: 0, checked: 0 },
    fixtures: { total: 0, checked: 0 },
    visualRoutes: { total: 0, checked: 0 },
    pageComposition: { total: 0, checked: 0 },
    surfaceStates: { total: 0, checked: 0 },
    componentFixtures: { total: 0, checked: 0 },
    designTokens: { total: 0, checked: 0 },
    presentationRules: { total: 0, checked: 0 },
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

function assertOrderedBefore(items, first, second, label) {
  const firstIndex = items.findIndex((item) => item.kind === first);
  const secondIndex = items.findIndex((item) => item.kind === second);
  if (firstIndex !== -1 && secondIndex !== -1) {
    assert(firstIndex < secondIndex, `${label}_${first}_must_precede_${second}`);
  }
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
  const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-frontend-surface-eval-"));
  try {
    return await fn(runtimeRoot);
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
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
report.coverage.primitives.total = evalset.primitives?.length || 0;
report.coverage.copyRegistry.total = evalset.copyRegistry?.length || 0;
report.coverage.fixtures.total = evalset.fixtures?.length || 0;
report.coverage.visualRoutes.total = evalset.visualRoutes?.length || 0;
report.coverage.pageComposition.total = evalset.pageComposition?.length || 0;
report.coverage.surfaceStates.total = evalset.surfaceStates?.length || 0;
report.coverage.componentFixtures.total = evalset.componentFixtures?.length || 0;
report.coverage.designTokens.total = evalset.designTokens?.length || 0;
report.coverage.presentationRules.total = evalset.presentationRules?.length || 0;
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

assert.equal(evalset.version, 4, "evalset_version_mismatch");
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
assert.equal(evalset.coverage.primitivesMustHaveDomAnchor, true, "evalset_primitive_anchor_coverage_required");
assert.equal(evalset.coverage.visualRoutesMustHaveNoHorizontalOverflow, true, "evalset_visual_overflow_coverage_required");
assert.equal(evalset.coverage.copyRegistryBlocksInternalTerms, true, "evalset_copy_registry_coverage_required");
assert.equal(evalset.coverage.fixturesMustCoverReadyAndEmpty, true, "evalset_fixture_coverage_required");
assert.equal(evalset.coverage.pageCompositionMustDeclareProductSections, true, "evalset_page_composition_coverage_required");
assert.equal(evalset.coverage.surfaceStatesMustMatchRegistry, true, "evalset_surface_state_registry_coverage_required");
assert.equal(evalset.coverage.componentFixturesMustCoverSurfaceStates, true, "evalset_component_fixture_coverage_required");
assert.equal(evalset.coverage.designTokensMustBeExecutable, true, "evalset_design_token_coverage_required");
assert.equal(evalset.coverage.presentationRulesMustBeExecutable, true, "evalset_presentation_rule_coverage_required");
assert.equal(evalset.scope.portalOnly, true, "evalset_must_be_portal_only");
assert.equal(evalset.scope.sourceOfExecutableUiTruth, true, "evalset_must_be_executable_ui_truth");
assert.equal(evalset.scope.callsRealCloud, false, "evalset_must_not_call_real_cloud");
assert.equal(evalset.scope.readsSecrets, false, "evalset_must_not_read_secrets");
assert.deepEqual(evalset.requiredDomAnchors, ["data-route-id", "data-component-id", "data-layout-id"], "required_dom_anchors_mismatch");

for (const key of ["routes", "layouts", "surfaces", "apiShapes", "forbiddenCopy", "pageTasks", "primitives", "copyRegistry", "fixtures", "visualRoutes", "pageComposition", "surfaceStates", "componentFixtures", "designTokens", "presentationRules"]) {
  assert(Array.isArray(evalset[key]), `evalset_${key}_must_be_array`);
}
assertUnique(evalset.routes, "id", "evalset_routes");
assertUnique(evalset.layouts, "layoutId", "evalset_layouts");
assertUnique(evalset.surfaces, "componentId", "evalset_surfaces");
assertUnique(evalset.apiShapes, "id", "evalset_api_shapes");
assertUnique(evalset.primitives, "primitiveId", "evalset_primitives");
assertUnique(evalset.copyRegistry, "key", "evalset_copy_registry");
assertUnique(evalset.surfaceStates, "componentId", "evalset_surface_states");
assertUnique(evalset.pageComposition, "routeId", "evalset_page_composition");
assertUnique(evalset.componentFixtures, "componentId", "evalset_component_fixtures");
assertUnique(evalset.designTokens, "tokenId", "evalset_design_tokens");
assertUnique(evalset.presentationRules, "ruleId", "evalset_presentation_rules");
const routeIds = new Set(evalset.routes.map((route) => route.id));
const surfaceIds = new Set(evalset.surfaces.map((surface) => surface.componentId));
const surfaceStatesByComponent = new Map(evalset.surfaceStates.map((state) => [state.componentId, state.states]));

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

for (const composition of evalset.pageComposition) {
  assertValidStatus(composition.status, `page_composition_${composition.routeId}`);
  assert(routeIds.has(composition.routeId), `page_composition_route_id_missing:${composition.routeId}`);
  assert(composition.task === evalset.pageTasks.find((item) => item.routeId === composition.routeId)?.task, `page_composition_task_mismatch:${composition.routeId}`);
  assert(composition.layoutId?.startsWith("layout."), `page_composition_layout_missing:${composition.routeId}`);
  assert(Array.isArray(composition.sections) && composition.sections.length > 0, `page_composition_sections_missing:${composition.routeId}`);
  const sectionKinds = composition.sections.map((section) => section.kind);
  assert(sectionKinds.includes("metrics"), `page_composition_metrics_missing:${composition.routeId}`);
  assert(sectionKinds.includes("actions"), `page_composition_actions_missing:${composition.routeId}`);
  assert(sectionKinds.some((kind) => ["primaryTable", "primaryList", "primaryPanel"].includes(kind)), `page_composition_primary_surface_missing:${composition.routeId}`);
  assertOrderedBefore(composition.sections, "filters", "primaryTable", `page_composition_${composition.routeId}`);
  for (const section of composition.sections) {
    assert(section.sectionId, `page_composition_section_id_missing:${composition.routeId}`);
    assert(section.display, `page_composition_display_missing:${composition.routeId}:${section.sectionId}`);
    assert(Array.isArray(section.componentIds) && section.componentIds.length > 0, `page_composition_component_ids_missing:${composition.routeId}:${section.sectionId}`);
    for (const componentId of section.componentIds) {
      assert(surfaceIds.has(componentId), `page_composition_unknown_component:${composition.routeId}:${componentId}`);
    }
  }
  report.coverage.pageComposition.checked += 1;
}

for (const state of evalset.surfaceStates) {
  assert(surfaceIds.has(state.componentId), `surface_state_unknown_component:${state.componentId}`);
  assert(routeIds.has(state.routeId), `surface_state_route_id_missing:${state.componentId}:${state.routeId}`);
  assert(state.question, `surface_state_question_missing:${state.componentId}`);
  assert(Array.isArray(state.states) && state.states.length > 0, `surface_state_states_missing:${state.componentId}`);
  assert(Array.isArray(state.invariants) && state.invariants.length > 0, `surface_state_invariants_missing:${state.componentId}`);
  assertIncludes(surfaceRegistrySource, `componentId: "${state.componentId}"`, `surface_state_registry_component_${state.componentId}`);
  report.coverage.surfaceStates.checked += 1;
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

for (const primitive of evalset.primitives) {
  assert.equal(primitive.status, "done", `primitive_must_be_done:${primitive.primitiveId}`);
  assert(await exists(primitive.owner), `primitive_owner_missing:${primitive.owner}`);
  assert(Array.isArray(primitive.states) && primitive.states.length > 0, `primitive_states_missing:${primitive.primitiveId}`);
  assertIncludes(await source(primitive.owner), `data-primitive-id="${primitive.primitiveId}"`, `primitive_anchor_${primitive.primitiveId}`);
  report.coverage.primitives.checked += 1;
}

for (const copyItem of evalset.copyRegistry) {
  assert(routeIds.has(copyItem.routeId), `copy_registry_route_id_missing:${copyItem.key}:${copyItem.routeId}`);
  assert(copyItem.key, `copy_registry_key_missing:${copyItem.routeId}`);
  assert(copyItem.text, `copy_registry_text_missing:${copyItem.key}`);
  assert(!copyItem.text.includes("/"), `copy_registry_slash_copy_forbidden:${copyItem.key}`);
  for (const forbidden of evalset.forbiddenCopy) {
    assertExcludes(copyItem.text, forbidden, `copy_registry_forbidden_copy:${copyItem.key}`);
  }
  report.coverage.copyRegistry.checked += 1;
}

for (const fixture of evalset.fixtures) {
  assert(routeIds.has(fixture.routeId), `fixture_route_id_missing:${fixture.routeId}`);
  assert(await exists(fixture.owner), `fixture_owner_missing:${fixture.owner}`);
  assert(fixture.states.includes("ready"), `fixture_ready_state_missing:${fixture.routeId}`);
  assert(fixture.states.includes("empty"), `fixture_empty_state_missing:${fixture.routeId}`);
  report.coverage.fixtures.checked += 1;
}

for (const fixture of evalset.componentFixtures) {
  assert(routeIds.has(fixture.routeId), `component_fixture_route_id_missing:${fixture.componentId}:${fixture.routeId}`);
  assert(surfaceIds.has(fixture.componentId), `component_fixture_unknown_surface:${fixture.componentId}`);
  assert(await exists(fixture.owner), `component_fixture_owner_missing:${fixture.owner}`);
  assertValidStatus(fixture.status, `component_fixture_${fixture.componentId}`);
  const fixtureJson = JSON.parse(await source(fixture.owner));
  assert(fixtureJson[fixture.componentId], `component_fixture_payload_missing:${fixture.componentId}`);
  assert(Array.isArray(fixture.requiredStates) && fixture.requiredStates.length > 0, `component_fixture_states_missing:${fixture.componentId}`);
  assert.deepEqual(fixture.requiredStates, surfaceStatesByComponent.get(fixture.componentId), `component_fixture_must_cover_all_surface_states:${fixture.componentId}`);
  for (const stateName of fixture.requiredStates) {
    assert(fixtureJson[fixture.componentId][stateName], `component_fixture_state_payload_missing:${fixture.componentId}:${stateName}`);
  }
  report.coverage.componentFixtures.checked += 1;
}

for (const token of evalset.designTokens) {
  assert(["tailwind", "style", "component"].includes(token.source), `design_token_source_invalid:${token.tokenId}`);
  assert(await exists(token.requiredIn), `design_token_owner_missing:${token.tokenId}:${token.requiredIn}`);
  assertIncludes(await source(token.requiredIn), token.assertion, `design_token_assertion_${token.tokenId}`);
  assertValidStatus(token.status, `design_token_${token.tokenId}`);
  report.coverage.designTokens.checked += 1;
}

for (const rule of evalset.presentationRules) {
  assert(rule.description, `presentation_rule_description_missing:${rule.ruleId}`);
  assert(rule.assertion, `presentation_rule_assertion_missing:${rule.ruleId}`);
  assert(["static", "browser", "static_and_browser"].includes(rule.enforcedBy), `presentation_rule_enforcer_invalid:${rule.ruleId}`);
  report.coverage.presentationRules.checked += 1;
}

for (const visualRoute of evalset.visualRoutes) {
  assert(routeIds.has(visualRoute.routeId), `visual_route_id_missing:${visualRoute.routeId}`);
  assert(visualRoute.path.startsWith("/"), `visual_route_path_invalid:${visualRoute.routeId}`);
  assert(Number(visualRoute.viewport?.width || 0) >= 390, `visual_route_width_invalid:${visualRoute.routeId}`);
  assert(Number(visualRoute.viewport?.height || 0) >= 760, `visual_route_height_invalid:${visualRoute.routeId}`);
  assert(Array.isArray(visualRoute.requiredSelectors) && visualRoute.requiredSelectors.length > 0, `visual_route_selectors_missing:${visualRoute.routeId}`);
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
  await withIsolatedPortalRuntime(async (runtimeRoot) => {
    portal = spawn(process.execPath, [portalEntrypoint], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        PORTAL_RUNTIME_ROOT: runtimeRoot,
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
    async function assertNoHorizontalOverflow(routeId) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(overflow <= 2, `visual_route_horizontal_overflow:${routeId}:${overflow}`);
    }

    await page.goto(`${baseUrl}/home`, { waitUntil: "domcontentloaded" });
    assert(await page.locator("body").innerText().then((text) => text.includes("登录")), "browser_home_login_link_missing");
    await assertNoHorizontalOverflow("home_public");
    report.coverage.browserDom.routes.push("/home");
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="email"]').waitFor({ timeout: 10000 });
    await assertNoHorizontalOverflow("login_public");
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
    await assertNoHorizontalOverflow("overview");
    await page.goto(`${baseUrl}/admin/system`, { waitUntil: "networkidle" });
    report.coverage.browserDom.routes.push("/admin/system");
    for (const surface of evalset.surfaces.filter((item) => item.status === "done" && item.routeId === "admin.system")) {
      await page.locator(surface.selector).waitFor({ timeout: 30000 });
      report.coverage.browserDom.surfaces.push(surface.componentId);
    }
    await assertNoHorizontalOverflow("admin.system");

    for (const visualRoute of evalset.visualRoutes.filter((item) => !["/home", "/login", "/overview", "/admin/system"].includes(item.path))) {
      await page.setViewportSize(visualRoute.viewport);
      await page.goto(`${baseUrl}${visualRoute.path}`, { waitUntil: "networkidle" });
      report.coverage.browserDom.routes.push(visualRoute.path);
      for (const selector of visualRoute.requiredSelectors) {
        await page.locator(selector).waitFor({ timeout: 30000 });
      }
      await assertNoHorizontalOverflow(visualRoute.routeId);
      report.coverage.visualRoutes.checked += 1;
    }
    report.coverage.visualRoutes.checked += evalset.visualRoutes.filter((item) => ["/home", "/login", "/overview", "/admin/system"].includes(item.path)).length;
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
    "primitive_dom_anchors",
    "copy_registry",
    "fixtures",
    "visual_routes",
    "page_composition",
    "surface_states",
    "component_fixtures",
    "design_tokens",
    "presentation_rules",
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
