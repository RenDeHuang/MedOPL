import assert from "node:assert/strict";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const reportPath = path.join(repoRoot, ".runtime", "portal-surface-eval", "report.json");
const appRoot = "services/portal/frontend/src/app";
const figmaAppRoot = "/tmp/medopl-figma-make-source/src/app";
const expectedRoutes = ["/overview", "/resources", "/workspace", "/trace", "/billing", "/opl-launch"];
const retiredRouteFragments = ["/packages", "/advanced/servers", "/admin/", "/__portal-harness/components"];
const expectedPages = {
  overview: "Overview.tsx",
  resources: "RuntimeEnvironment.tsx",
  workspace: "Workspace.tsx",
  trace: "TasksResults.tsx",
  billing: "BillingAudit.tsx",
  "opl-launch": "OPLEntry.tsx",
};
const requiredPageLoaders = {
  "Overview.tsx": "loadOverviewModel",
  "RuntimeEnvironment.tsx": "loadRuntimeEnvironmentModel",
  "Workspace.tsx": "loadWorkspaceModel",
  "TasksResults.tsx": "loadTasksResultsModel",
  "BillingAudit.tsx": "loadBillingAuditModel",
  "OPLEntry.tsx": "loadOplEntryModel",
};
const requiredAdapterCalls = [
  "fetchOverview",
  "fetchMyResources",
  "fetchWorkspace",
  "fetchSessionTraces",
  "fetchBillingSummary",
  "fetchBillingDetails",
  "fetchOplLaunchStatus",
  "fetchOplBootstrap",
  "bindOplSession",
];
const forbiddenPublicStateKeys = [
  "rawApiKey",
  "launchToken",
  "runtimeToken",
  "objectKey",
  "localPath",
  "signedUrl",
  "presignedUrl",
  "SecretId",
  "SecretKey",
  "kubeconfig",
];
const forbiddenCopy = [
  "客户工作台",
  "平台管理台",
  "商业化",
  "SaaS 总览",
  "运营总台",
  "告警中心",
  "使用统一账号登录",
  "30 天保护期",
  "30天保护期",
];

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
  return files.sort();
}

async function listRelativeFiles(root, suffixes) {
  const files = await listFiles(root, suffixes);
  return files.map((filePath) => path.relative(root, filePath).replaceAll(path.sep, "/")).sort();
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const routesSource = await source(`${appRoot}/routes.tsx`);
const layoutSource = await source(`${appRoot}/components/Layout.tsx`);
const adapterSource = await source(`${appRoot}/data/portalAdapters.ts`);
const packageJson = JSON.parse(await source("services/portal/frontend/package.json"));
const viteSource = await source("services/portal/frontend/vite.config.ts");
const contractMarkdown = await source("docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md");

assert.equal(await exists(figmaAppRoot), true, "figma_make_extracted_app_source_missing");
assert.deepEqual(
  await listRelativeFiles(appRoot, [".ts", ".tsx"]),
  (await listRelativeFiles(figmaAppRoot, [".ts", ".tsx"])).concat(["data/portalAdapters.ts"]).sort(),
  "app_file_tree_must_match_figma_zip_plus_portal_adapter",
);

assertIncludes(routesSource, "createBrowserRouter", "routes_must_use_react_router");
assertIncludes(routesSource, 'from "react-router"', "routes_must_use_zip_react_router");
assertExcludes(routesSource, "react-router-dom", "routes_must_not_use_non_zip_react_router_dom");
assertExcludes(routesSource, "AdminConsole", "admin_console_must_not_be_mounted");

for (const [routeId, pageFile] of Object.entries(expectedPages)) {
  assertIncludes(routesSource, `path: "${routeId}"`, `route_path_missing:${routeId}`);
  assertIncludes(routesSource, pageFile.replace(".tsx", ""), `route_component_missing:${routeId}`);
  assert.equal(await exists(`${appRoot}/pages/${pageFile}`), true, `page_file_missing:${pageFile}`);
}

for (const route of expectedRoutes) {
  assertIncludes(layoutSource, `path: "${route}"`, `layout_nav_route_missing:${route}`);
}
for (const label of ["总览", "运行环境", "工作空间", "任务与结果", "账单与审计", "进入 OPL"]) {
  assertIncludes(layoutSource, `name: "${label}"`, `layout_nav_label_missing:${label}`);
}
for (const retired of retiredRouteFragments) {
  assertExcludes(routesSource, retired, "react_routes_retired_path");
  assertExcludes(layoutSource, retired, "layout_retired_path");
}

assert.equal(packageJson.dependencies.vue, undefined, "package_must_not_depend_on_vue");
assert.equal(packageJson.dependencies.pinia, undefined, "package_must_not_depend_on_pinia");
assert.equal(packageJson.dependencies["vue-router"], undefined, "package_must_not_depend_on_vue_router");
assert.equal(packageJson.dependencies["react-router-dom"], undefined, "package_must_not_depend_on_react_router_dom");
assert(packageJson.dependencies.react, "package_must_depend_on_react");
assert(packageJson.dependencies["react-router"], "package_must_depend_on_zip_react_router");
assert(packageJson.dependencies["lucide-react"], "package_must_depend_on_lucide");
assert(packageJson.dependencies["@radix-ui/react-dialog"], "package_must_depend_on_radix_dialog");
assertIncludes(viteSource, "@vitejs/plugin-react", "vite_must_use_react_plugin");
assertIncludes(viteSource, "@tailwindcss/vite", "vite_must_use_tailwind_v4_plugin");
assertExcludes(viteSource, "@vitejs/plugin-vue", "vite_must_not_use_vue_plugin");

for (const [pageFile, loader] of Object.entries(requiredPageLoaders)) {
  const pageSource = await source(`${appRoot}/pages/${pageFile}`);
  assertIncludes(pageSource, loader, `page_must_use_portal_api_loader:${pageFile}`);
  assertIncludes(pageSource, "usePortalQuery", `page_must_use_portal_query:${pageFile}`);
}
for (const apiFunction of requiredAdapterCalls) {
  assertIncludes(adapterSource, apiFunction, `portal_adapter_must_call:${apiFunction}`);
}

const frontendSources = [];
for (const filePath of await listFiles("services/portal/frontend/src", [".ts", ".tsx", ".css"])) {
  frontendSources.push(await source(filePath));
}
const visibleText = frontendSources.join("\n");
for (const forbidden of forbiddenCopy) assertExcludes(visibleText, forbidden, "frontend_forbidden_copy");
for (const forbidden of forbiddenPublicStateKeys) assertExcludes(visibleText, forbidden, "frontend_forbidden_sensitive_public_key");
assertIncludes(visibleText, "7 天保护期", "storage_protection_copy_missing");
assertIncludes(visibleText, "释放计算资源", "compute_release_copy_missing");
assertIncludes(visibleText, "托管科研工作台", "service_truth_copy_missing");
assertIncludes(visibleText, "余额", "balance_copy_missing");
assertIncludes(visibleText, "冻结金额", "frozen_amount_copy_missing");
assertIncludes(visibleText, "进入 OPL", "opl_entry_copy_missing");

assertIncludes(contractMarkdown, "Figma Make ZIP", "contract_must_name_zip_source");
assertIncludes(contractMarkdown, "唯一 Portal UI source-of-truth", "contract_must_define_zip_source_of_truth");
assertIncludes(contractMarkdown, "复制为 ZIP 源文件残留", "contract_must_allow_admin_residue_copy");
assertIncludes(contractMarkdown, "不得挂载 active route", "contract_must_forbid_admin_route_mount");

await mkdir(path.dirname(reportPath), { recursive: true });
const report = {
  ok: true,
  contract: "v22_portal_frontend_surface_eval",
  sourceOfTruth: "figma_make_zip",
  coverage: {
    routes: expectedRoutes.length,
    pages: Object.keys(expectedPages).length,
    requiredAdapterCalls: requiredAdapterCalls.length,
  },
  checked: [
    "figma_zip_file_tree_parity",
    "react_router_user_routes",
    "retired_routes_removed_from_active_frontend",
    "admin_console_copied_but_unrouted",
    "page_api_loader_wiring",
    "portal_adapter_api_calls",
    "forbidden_copy",
    "secret_browser_hygiene_static",
  ],
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
