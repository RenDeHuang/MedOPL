import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("../../../services/portal/frontend/node_modules/typescript");

const repoRoot = process.cwd();
const runtimePagePath = path.join(repoRoot, "services", "portal", "frontend", "src", "app", "pages", "RuntimeEnvironment.tsx");
const adapterPath = path.join(repoRoot, "services", "portal", "frontend", "src", "app", "data", "portalAdapters.ts");
const apiPath = path.join(repoRoot, "services", "portal", "frontend", "src", "api", "portal", "lab.ts");
const apiAlignmentPath = path.join(repoRoot, "tests", "regression", "portal", "regression-test-v22-portal-frontend-api-surface-alignment.mjs");

function readSource(filePath) {
  return readFileSync(filePath, "utf8");
}

function sourceFile(filePath) {
  return ts.createSourceFile(filePath, readSource(filePath), ts.ScriptTarget.Latest, true, filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
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
    "active_missing_ui_adjudications_removed",
  ],
}, null, 2));
