import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

const adapterSource = await readFile("services/portal/frontend/src/app/data/portalAdapters.ts", "utf8");

const pageSpecs = [
  ["overview", "services/portal/frontend/src/app/pages/Overview.tsx", "loadOverviewModel"],
  ["resources", "services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx", "loadRuntimeEnvironmentModel"],
  ["workspace", "services/portal/frontend/src/app/pages/Workspace.tsx", "loadWorkspaceModel"],
  ["trace", "services/portal/frontend/src/app/pages/TasksResults.tsx", "loadTasksResultsModel"],
  ["billing", "services/portal/frontend/src/app/pages/BillingAudit.tsx", "loadBillingAuditModel"],
  ["opl", "services/portal/frontend/src/app/pages/OPLEntry.tsx", "loadOplEntryModel"],
];

for (const retiredPath of [
  "services/portal/frontend/src/composables/useBillingSurface.ts",
  "services/portal/frontend/src/composables/useWorkspaceSurface.ts",
  "services/portal/frontend/src/composables/useOverviewSurface.ts",
  "services/portal/frontend/src/composables/useResourcesSurface.ts",
  "services/portal/frontend/src/composables/useTraceSurface.ts",
  "services/portal/frontend/src/composables/useAdminUsersSurface.ts",
]) {
  assert.equal(await exists(retiredPath), false, `retired_vue_composable_must_not_exist:${retiredPath}`);
}

for (const [name, pagePath, loader] of pageSpecs) {
  const pageSource = await readFile(pagePath, "utf8");
  assert(pageSource.includes("usePortalQuery"), `page_must_use_portal_query:${name}`);
  assert(pageSource.includes(loader), `page_must_use_zip_portal_loader:${name}:${loader}`);
  assert(adapterSource.includes(`function ${loader}`) || adapterSource.includes(`function ${loader}(`), `adapter_loader_missing:${loader}`);
}

for (const apiCall of [
  "fetchOverview",
  "fetchMyResources",
  "fetchWorkspace",
  "fetchSessionTraces",
  "fetchBillingSummary",
  "fetchBillingDetails",
  "createOplLaunch",
  "fetchOplBootstrap",
  "bindOplSession",
]) {
  assert(adapterSource.includes(apiCall), `portal_adapter_must_call_api:${apiCall}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_frontend_surface_composables",
  currentTruth: "portal_adapter_replaces_retired_vue_composables",
  surfaces: pageSpecs.map(([name]) => name),
}, null, 2));
