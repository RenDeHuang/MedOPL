import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("../../../services/portal/frontend/node_modules/typescript");

const repoRoot = process.cwd();
const runtimePagePath = path.join(repoRoot, "services", "portal", "frontend", "src", "app", "pages", "RuntimeEnvironment.tsx");
const adapterPath = path.join(repoRoot, "services", "portal", "frontend", "src", "app", "data", "portalAdapters.ts");
const apiPath = path.join(repoRoot, "services", "portal", "frontend", "src", "api", "portal", "lab.ts");
const oplEntryPath = path.join(repoRoot, "services", "portal", "frontend", "src", "app", "pages", "OPLEntry.tsx");
const oplApiPath = path.join(repoRoot, "services", "portal", "frontend", "src", "api", "portal", "opl.ts");
const clientPath = path.join(repoRoot, "services", "portal", "frontend", "src", "api", "client.ts");
const viteConfigPath = path.join(repoRoot, "services", "portal", "frontend", "vite.config.ts");
const sourceTruthPath = path.join(repoRoot, "docs", "source", "README.md");
const runtimeTruthPath = path.join(repoRoot, "docs", "runtime", "README.md");
const apiAlignmentPath = path.join(repoRoot, "tests", "regression", "portal", "regression-test-v22-portal-frontend-api-surface-alignment.mjs");

function readSource(filePath) {
  return readFileSync(filePath, "utf8");
}

function sourceFile(filePath) {
  return ts.createSourceFile(filePath, readSource(filePath), ts.ScriptTarget.Latest, true, filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function listFrontendSourceFiles(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const childPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) return listFrontendSourceFiles(childPath);
    if (entry.isFile() && /\.(ts|tsx)$/u.test(entry.name)) return [childPath];
    return [];
  });
}

function collectImportsFrom(filePath, expectedModuleSuffix) {
  const parsed = sourceFile(filePath);
  const imports = new Set();
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!statement.moduleSpecifier.text.endsWith(expectedModuleSuffix)) continue;
    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;
    for (const item of namedBindings.elements) imports.add(item.name.text);
  }
  return imports;
}

function assertImports(filePath, expectedModuleSuffix, expectedNames, label) {
  const imported = collectImportsFrom(filePath, expectedModuleSuffix);
  for (const name of expectedNames) assert(imported.has(name), `${label}_missing_import:${name}`);
}

function assertIncludes(source, phrase, label) {
  assert(source.includes(phrase), `${label}_missing:${phrase}`);
}

function assertNotIncludes(source, phrase, label) {
  assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
}

const runtimeSource = readSource(runtimePagePath);
const adapterSource = readSource(adapterPath);
const apiSource = readSource(apiPath);
const oplEntrySource = readSource(oplEntryPath);
const oplApiSource = readSource(oplApiPath);
const clientSource = readSource(clientPath);
const viteConfigSource = readSource(viteConfigPath);
const sourceTruth = readSource(sourceTruthPath);
const runtimeTruth = readSource(runtimeTruthPath);
const alignmentSource = readSource(apiAlignmentPath);

assertImports(adapterPath, "../../api/portal/lab", [
  "fetchLabEntitlement",
  "fetchLabPackages",
  "fetchLabSubscription",
], "runtime_adapter_must_read_lab_api");
assertImports(runtimePagePath, "../../api/portal/lab", [
  "upgradeLabPackage",
], "runtime_page_must_use_lab_upgrade_api");

for (const apiName of [
  "fetchLabPackages",
  "fetchLabSubscription",
  "fetchLabEntitlement",
  "upgradeLabPackage",
]) {
  assertNotIncludes(alignmentSource, `"lab.ts:${apiName}":`, "api_alignment_must_not_keep_active_missing_ui_adjudication");
}
assertNotIncludes(alignmentSource, "active-missing-ui", "api_alignment_must_not_have_active_missing_ui_status");

assertIncludes(adapterSource, "fetchLabPackages()", "runtime_adapter_must_call_fetch_lab_packages");
assertIncludes(adapterSource, "fetchLabSubscription({ workspaceId })", "runtime_adapter_must_call_fetch_lab_subscription");
assertIncludes(adapterSource, "fetchLabEntitlement({ workspaceId })", "runtime_adapter_must_call_fetch_lab_entitlement");
assertIncludes(runtimeSource, "upgradeLabPackage(", "runtime_page_must_call_upgrade_lab_package");
assertIncludes(runtimeSource, "model.plans", "runtime_page_must_render_model_plans");
assertIncludes(runtimeSource, "model.entitlement", "runtime_page_must_render_entitlement");
assertIncludes(runtimeSource, "model.subscription", "runtime_page_must_render_subscription");
assertIncludes(apiSource, "LabPackagesPayload", "lab_api_contract_must_keep_packages_payload");
assertIncludes(apiSource, "LabSubscriptionPayload", "lab_api_contract_must_keep_subscription_payload");
assertIncludes(apiSource, "LabEntitlementPayload", "lab_api_contract_must_keep_entitlement_payload");
assertIncludes(apiSource, "goControlPlaneClient", "lab_api_must_use_go_control_plane_client");
assertNotIncludes(apiSource, "apiClient", "lab_api_must_not_import_node_portal_client");
assertNotIncludes(apiSource, "/portal/api", "lab_api_must_not_name_node_portal_base");
assertIncludes(clientSource, 'baseURL: "/api"', "go_control_plane_client_must_use_api_base");
assert.match(clientSource, /export const goControlPlaneClient = axios\.create\(\{\s*baseURL: "\/api"/u, "go_control_plane_client_base_must_be_api");
assert.match(clientSource, /export const apiClient = axios\.create\(\{\s*baseURL: "\/portal\/api"/u, "portal_api_client_base_must_remain_portal_api");
assertIncludes(viteConfigSource, '"/api": goControlPlaneTarget', "vite_must_proxy_go_control_plane_api");
assertIncludes(sourceTruth, "services/portal/src/routes/lab-package.routes.mjs", "source_truth_must_name_node_lab_route_retirement_shell");
assertIncludes(sourceTruth, "lab package routes remain a retirement shell/local eval dependency", "source_truth_must_demote_node_lab_route");
assertIncludes(runtimeTruth, "local control-plane implementation is Go-owned for lab typed APIs", "runtime_truth_must_name_go_lab_api_ownership");
assertNotIncludes(apiSource, "apiClient.get<LabPackagesPayload>", "lab_packages_must_not_use_node_portal_client");
assertNotIncludes(apiSource, "apiClient.get<LabSubscriptionPayload>", "lab_subscription_must_not_use_node_portal_client");
assertNotIncludes(apiSource, "apiClient.get<LabEntitlementPayload>", "lab_entitlement_must_not_use_node_portal_client");
assertNotIncludes(apiSource, "apiClient.post", "lab_mutations_must_not_use_node_portal_client");
assertIncludes(oplApiSource, "bindProviderKeyForOplEntry", "opl_api_must_expose_go_provider_key_binding_action");
assertIncludes(oplApiSource, "goControlPlaneClient.post", "opl_api_provider_key_binding_must_use_go_control_plane_client");
assertIncludes(oplApiSource, '"/v22/provider-key"', "opl_api_provider_key_binding_must_call_go_v22_provider_key");
assertIncludes(oplEntrySource, "bindProviderKeyForOplEntry", "opl_entry_must_import_provider_key_binding_action");
assertIncludes(oplEntrySource, "providerKeyInput", "opl_entry_must_keep_provider_key_as_one_time_input_state");
assertIncludes(oplEntrySource, "handleProviderKeyBind", "opl_entry_must_have_explicit_provider_key_bind_handler");
assertIncludes(oplEntrySource, "type=\"password\"", "opl_entry_provider_key_input_must_be_password_field");
assertIncludes(oplEntrySource, "绑定后进入 OPL", "opl_entry_provider_key_cta_must_be_visible");
assertIncludes(oplEntrySource, "window.location.reload()", "opl_entry_must_reload_projection_after_provider_key_bind");
assertIncludes(adapterSource, "providerBound: status.providerBound", "opl_entry_adapter_must_still_forward_go_provider_bound");

for (const forbidden of [
  "localStorage",
  "sessionStorage",
  "document.cookie",
  "URLSearchParams(providerKeyInput",
  "launchToken",
  "runtimeToken",
  "bearerToken",
]) {
  assertNotIncludes(oplEntrySource, forbidden, "opl_entry_provider_key_ui_must_not_persist_or_expose_secret");
}

for (const filePath of listFrontendSourceFiles(path.join(repoRoot, "services", "portal", "frontend", "src"))) {
  const source = readSource(filePath);
  const label = path.relative(repoRoot, filePath);
  assertNotIncludes(source, "/portal/api/lab-", `frontend_must_not_call_node_lab_api_directly:${label}`);
  assertNotIncludes(source, "/portal/api/lab_", `frontend_must_not_call_node_lab_api_directly:${label}`);
}

for (const hardcodedPlan of [
  "const plans = [",
  "id: \"basic\"",
  "id: \"standard\"",
]) {
  assertNotIncludes(runtimeSource, hardcodedPlan, "runtime_page_must_not_construct_plan_business_truth_locally");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_runtime_real_api_data_closure",
  checked: [
    "runtime_page_uses_model_plans_subscription_entitlement",
    "runtime_adapter_reads_lab_package_subscription_entitlement_api",
    "runtime_page_uses_upgrade_api",
    "lab_typed_api_uses_go_control_plane_client",
    "opl_entry_provider_key_binding_uses_go_control_plane_client",
    "node_lab_route_demoted_to_retirement_shell",
    "active_missing_ui_adjudications_removed",
  ],
}, null, 2));
