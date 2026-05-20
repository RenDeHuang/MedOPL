import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";

const root = new URL("../../../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, root), "utf8");
}

async function listProjectFiles(path, results = []) {
  const dir = new URL(path, root);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const childPath = `${path}/${entry.name}`;
    if (entry.isDirectory()) {
      await listProjectFiles(childPath, results);
      continue;
    }
    if (/\.(ts|vue)$/.test(entry.name)) results.push(childPath);
  }
  return results;
}

const helperPath = "services/portal/src/app/portal-admin-api-payload-helpers.mjs";
const apiPayloadPath = "services/portal/src/app/portal-admin-api-payloads.mjs";
const runtimeOverviewPath = "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs";
const retiredOverviewViewPath = "services/portal/src/app/portal-admin-overview-payloads.mjs";

const helperSource = await readProjectFile(helperPath);
const apiPayloadSource = await readProjectFile(apiPayloadPath);
const runtimeOverviewSource = await readProjectFile(runtimeOverviewPath);

const sharedFunctionNames = [
  "userTenantId",
  "customerSegment",
  "includeAdminSegment",
  "commercialCustomers",
  "commercialResourceBindings",
  "managedResourceBindingRow",
  "managedResourceBindingRows",
];

for (const name of sharedFunctionNames) {
  assert.match(helperSource, new RegExp(`export function ${name}\\b`), `${helperPath}:missing_export:${name}`);
  assert.equal(apiPayloadSource.includes(`function ${name}`), false, `${apiPayloadPath}:duplicate_shared_helper:${name}`);
  assert.equal(runtimeOverviewSource.includes(`function ${name}`), false, `${runtimeOverviewPath}:duplicate_shared_helper:${name}`);
}

const apiPayloadHelperUsages = [
  "userTenantId",
  "customerSegment",
  "commercialCustomers",
  "managedResourceBindingRows",
];

const runtimeOverviewHelperUsages = [
  "commercialCustomers",
  "managedResourceBindingRows",
];

for (const name of apiPayloadHelperUsages) {
  assert(apiPayloadSource.includes(name), `${apiPayloadPath}:missing_shared_helper_usage:${name}`);
}

for (const name of runtimeOverviewHelperUsages) {
  assert(runtimeOverviewSource.includes(name), `${runtimeOverviewPath}:missing_shared_helper_usage:${name}`);
}

assert.match(
  runtimeOverviewSource,
  /export function createPortalAdminOverviewPayloadBuilder\b/,
  `${runtimeOverviewPath}:missing_overview_builder_factory`,
);
assert.match(
  apiPayloadSource,
  /createPortalAdminOverviewPayloadBuilder/,
  `${apiPayloadPath}:must_delegate_overview_builder`,
);
assert.equal(
  /async function buildAdminOverviewPayload\b/.test(apiPayloadSource),
  false,
  `${apiPayloadPath}:duplicate_inline_overview_builder`,
);

await assert.rejects(
  access(new URL(retiredOverviewViewPath, root), constants.F_OK),
  `${retiredOverviewViewPath}:dead_overview_projection_module_must_be_retired`,
);

for (const path of await listProjectFiles("services/portal/frontend/src")) {
  const source = await readProjectFile(path);
  assert.equal(
    /from\s+["']@\/api\/portal["']/.test(source),
    false,
    `${path}:must_import_portal_api_domain_module`,
  );
}

console.log(JSON.stringify({
  ok: true,
  checked: [helperPath, apiPayloadPath, runtimeOverviewPath],
  sharedFunctionCount: sharedFunctionNames.length,
}, null, 2));
