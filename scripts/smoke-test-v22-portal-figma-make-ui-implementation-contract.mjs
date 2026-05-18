import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const contractPath = "docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md";
const readmePath = "docs/contracts/README.md";
const convergencePlanPath = "docs/recovery/portal-figma-make-ui-convergence-plan.md";
const repoFrontendPath = "services/portal/frontend";
const repoAppPath = `${repoFrontendPath}/src/app`;
const repoStylesPath = `${repoFrontendPath}/src/styles`;
const repoAdapterPath = `${repoFrontendPath}/src/app/data/portalAdapters.ts`;
const figmaSourceRoot = "/tmp/medopl-figma-make-source";
const start = "<!-- v22-portal-figma-make-ui-implementation-contract:start -->";
const end = "<!-- v22-portal-figma-make-ui-implementation-contract:end -->";

async function source(path) {
  return readFile(path, "utf8");
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listRelativeFiles(root, suffixes = [".ts", ".tsx", ".css"], baseRoot = root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listRelativeFiles(fullPath, suffixes, baseRoot));
      continue;
    }
    if (suffixes.some((suffix) => entry.name.endsWith(suffix))) {
      files.push(path.relative(baseRoot, fullPath).replaceAll(path.sep, "/"));
    }
  }
  return files.sort();
}

function extractJson(markdown) {
  const startIndex = markdown.indexOf(start);
  assert.notEqual(startIndex, -1, "figma_make_contract_start_marker_missing");
  const endIndex = markdown.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, "figma_make_contract_end_marker_missing");
  const block = markdown.slice(startIndex + start.length, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "figma_make_contract_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const markdown = await source(contractPath);
const readme = await source(readmePath);
const plan = await source(convergencePlanPath);
const packageJson = JSON.parse(await source(`${repoFrontendPath}/package.json`));
const routesSource = await source(`${repoAppPath}/routes.tsx`);
const adapterSource = await source(repoAdapterPath).catch(() => "");
const contract = extractJson(markdown);

assert.equal(contract.contract, "v22_portal_figma_make_ui_implementation_boundary", "contract_name_mismatch");
assert.equal(contract.version, 1, "contract_version_mismatch");
assert.equal(contract.model, "gpt-5.4", "model_mismatch");
assert.equal(contract.contractRole, "portal_frontend_stack_and_figma_make_implementation_leaf", "contract_role_mismatch");
assert.equal(contract.figmaMake.fileKey, "pjLYKml89XFsf8BMNOJ3CV", "figma_make_file_key_mismatch");
assert.equal(contract.figmaMake.singleUiSourceOfTruth, "figma_make_zip", "figma_zip_must_be_single_ui_source_of_truth");
assert.equal(contract.figmaMake.sourceArtifact.zipPath, "/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design.zip", "figma_zip_source_path_mismatch");
assert.equal(contract.figmaMake.sourceArtifact.extractedPath, figmaSourceRoot, "figma_zip_extracted_path_mismatch");
assert.equal(contract.figmaMake.currentCoverage, "user_portal_only", "figma_current_coverage_mismatch");
assert.equal(contract.figmaMake.adminConsoleCopiedAsUnroutedResidue, true, "admin_console_residue_must_be_copied_but_unrouted");
assert.equal(contract.figmaMake.activeAdminRouteMounted, false, "admin_console_must_not_be_active_route");
assert.equal(contract.portalFrontendStack.appliesToWholePortalFrontend, true, "react_stack_must_apply_to_whole_portal_frontend");
assert.deepEqual(contract.portalFrontendStack.required, [
  "React",
  "Vite",
  "TypeScript",
  "react-router",
  "shadcn/Radix",
  "lucide-react",
], "portal_frontend_stack_mismatch");
assert.deepEqual(contract.userRoutes, [
  "/overview",
  "/resources",
  "/workspace",
  "/trace",
  "/billing",
  "/opl-launch",
], "user_routes_mismatch");
assert.deepEqual(contract.retiredFrontendRoutes, [
  "/packages",
  "/advanced/servers",
  "/admin/*",
  "/runtime",
  "/tasks",
  "/opl",
], "retired_routes_mismatch");
assert.equal(contract.physicalRetirement.contractCurrentTruthRetired, true, "contract_current_truth_must_be_physically_retired");
assert.equal(contract.physicalRetirement.oldVueSpaFilesRemoved, true, "old_vue_spa_files_must_be_removed");
assert.equal(contract.physicalRetirement.oldVisualWorkbenchRemoved, true, "old_visual_workbench_must_be_removed");
assert.equal(contract.physicalRetirement.oldScreenshotBaselinesRemoved, true, "old_screenshot_baselines_must_be_removed");
assert.equal(contract.physicalRetirement.oldContractReorganizedReactUiRemoved, true, "old_contract_reorganized_react_ui_must_be_removed");
assert.equal(contract.physicalRetirement.replacementUi, "figma_make_zip_physical_source_absorption", "replacement_ui_must_be_figma_make_zip");
assert.equal(contract.apiIntegration.staticMockOnlyUiAllowed, false, "static_mock_only_ui_must_not_be_allowed");
assert.equal(contract.apiIntegration.baseUrl, "/portal/api", "api_base_url_mismatch");
assert.equal(contract.apiIntegration.adapterDirectory, "services/portal/frontend/src/api/portal", "api_adapter_directory_mismatch");
assert.deepEqual(contract.apiIntegration.requiredAdapters, [
  "overview",
  "resources",
  "workspace",
  "traces",
  "billing",
  "opl",
], "api_required_adapters_mismatch");
for (const route of contract.userRoutes) {
  assert(
    Array.isArray(contract.apiIntegration.userRouteApiCoverage[route]) &&
      contract.apiIntegration.userRouteApiCoverage[route].every((apiPath) => apiPath.startsWith("/portal/api/")),
    `api_route_coverage_missing:${route}`,
  );
}
assert.equal(contract.adminOpsUi.currentFigmaCoverage, false, "admin_figma_coverage_must_be_false");
assert.equal(contract.adminOpsUi.futureSameStack, true, "admin_future_same_stack_must_be_true");
assert.equal(contract.lifecycle.storageDeletionProtectionDays, 7, "storage_deletion_protection_days_mismatch");
assert.equal(contract.lifecycle.releaseComputeTriggersStorageProtection, false, "release_compute_must_not_trigger_storage_protection");
assert.equal(contract.browserSecretHygiene.rawApiKeyInPublicState, false, "raw_api_key_public_state_forbidden");
assert.equal(contract.browserSecretHygiene.launchOrRuntimeTokenInPublicState, false, "launch_runtime_token_public_state_forbidden");
assert.equal(contract.browserSecretHygiene.storagePathOrSignedUrlInPublicState, false, "storage_path_signed_url_public_state_forbidden");
assert.equal(contract.deployment.defaultMode, "local_preview_only", "deployment_default_mode_mismatch");
assert.equal(contract.deployment.trueProductionDeployRequiresSeparateAuthorization, true, "production_deploy_must_require_separate_authorization");

assert(await exists(figmaSourceRoot), "figma_extracted_source_missing");
assert(await exists("/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design.zip"), "figma_zip_source_missing");
assert(await exists(`${repoAppPath}/App.tsx`), "repo_app_source_missing");
assert(await exists(`${repoStylesPath}/index.css`), "repo_styles_source_missing");

const figmaAppFiles = await listRelativeFiles(`${figmaSourceRoot}/src/app`, [".ts", ".tsx"]);
const repoAppFiles = await listRelativeFiles(repoAppPath, [".ts", ".tsx"]);
assert.deepEqual(repoAppFiles, figmaAppFiles.concat(["data/portalAdapters.ts"]).sort(), "repo_app_files_must_match_figma_zip_plus_adapter");

const figmaStyleFiles = await listRelativeFiles(`${figmaSourceRoot}/src/styles`, [".css"]);
const repoStyleFiles = await listRelativeFiles(repoStylesPath, [".css"]);
assert.deepEqual(repoStyleFiles, figmaStyleFiles, "repo_style_files_must_match_figma_zip");

for (const staleRootFile of [
  "services/portal/frontend/src/App.tsx",
  "services/portal/frontend/src/routes.tsx",
  "services/portal/frontend/src/pages/Overview.tsx",
  "services/portal/frontend/src/components/Layout.tsx",
  "services/portal/frontend/src/styles.css",
]) {
  assert.equal(await exists(staleRootFile), false, `old_contract_reorganized_root_ui_must_be_removed:${staleRootFile}`);
}

assertIncludes(routesSource, 'from "react-router"', "figma_routes_must_use_react_router");
assertExcludes(routesSource, 'from "react-router-dom"', "figma_routes_must_not_use_react_router_dom");
assertExcludes(routesSource, "AdminConsole", "admin_console_must_not_be_mounted_in_routes");
for (const route of contract.userRoutes) {
  assertIncludes(routesSource, route.replace("/", ""), `figma_user_route_missing:${route}`);
}

assert(packageJson.dependencies.react, "package_must_keep_react_dependency");
assert(packageJson.dependencies["react-router"], "package_must_copy_figma_react_router_dependency");
assert.equal(packageJson.dependencies["react-router-dom"], undefined, "package_must_not_keep_non_zip_react_router_dom_dependency");
assert(packageJson.devDependencies["@tailwindcss/vite"], "package_must_copy_figma_tailwind_vite_dependency");
assert.equal(packageJson.devDependencies.tailwindcss?.startsWith("4."), true, "package_must_use_figma_tailwind_v4");

for (const apiFunction of [
  "fetchOverview",
  "fetchMyResources",
  "fetchWorkspace",
  "fetchSessionTraces",
  "fetchBillingSummary",
  "fetchBillingDetails",
  "fetchOplLaunchStatus",
  "fetchOplBootstrap",
  "bindOplSession",
]) {
  assertIncludes(adapterSource, apiFunction, `api_adapter_must_call:${apiFunction}`);
}
for (const [page, loader] of Object.entries({
  Overview: "loadOverviewModel",
  RuntimeEnvironment: "loadRuntimeEnvironmentModel",
  Workspace: "loadWorkspaceModel",
  TasksResults: "loadTasksResultsModel",
  BillingAudit: "loadBillingAuditModel",
  OPLEntry: "loadOplEntryModel",
})) {
  const pageSource = await source(`${repoAppPath}/pages/${page}.tsx`);
  assertIncludes(pageSource, loader, `page_must_use_portal_api_adapter:${page}`);
  assertIncludes(pageSource, "usePortalQuery", `page_must_use_portal_query:${page}`);
}

for (const phrase of [
  "Figma Make ZIP",
  "唯一 Portal UI source-of-truth",
  "React + Vite + TypeScript + react-router + shadcn/Radix + lucide",
  "AdminConsole.tsx",
  "7 天保护期",
  "本地可预览部署",
  "不是只做故事线清退",
  "物理清退",
  "API 接入边界",
]) {
  assertIncludes(markdown, phrase, `contract_copy_${phrase}`);
}

for (const forbidden of [
  "30 天保护期",
  "30天保护期",
  "Figma 不得引入 React",
  "回写 Vue",
]) {
  assertExcludes(markdown, forbidden, "figma_make_contract_copy");
}

assertIncludes(readme, "v22-portal-figma-make-ui-implementation-boundary.md", "contracts_readme_must_index_figma_make_contract");
assertIncludes(plan, "Step 1: Add And Align Contracts", "convergence_plan_must_define_step_1");
assertIncludes(plan, "Step 4: Absorb Figma Make UI And Connect APIs", "convergence_plan_must_define_step_4");
assertIncludes(plan, "Physically retire current-truth contract assertions", "convergence_plan_must_require_contract_physical_retirement");
assertIncludes(plan, "Physically delete old `.vue` frontend files", "convergence_plan_must_require_frontend_physical_retirement");
assertIncludes(plan, "Figma Make ZIP", "convergence_plan_must_name_zip_source");
assertIncludes(plan, "overview/resources/workspace/trace/billing/opl-launch all call", "convergence_plan_must_require_api_connection");

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  checked: [
    "portal_wide_react_stack",
    "figma_make_zip_single_source",
    "figma_zip_file_parity",
    "admin_console_copied_but_unrouted",
    "admin_future_same_stack",
    "storage_7_day_protection",
    "minimal_portal_api_adapter",
    "local_preview_only_deployment",
  ],
}, null, 2));
