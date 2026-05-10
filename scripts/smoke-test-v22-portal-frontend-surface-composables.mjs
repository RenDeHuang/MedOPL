import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const surfaceSpecs = [
  {
    name: "billing",
    viewPath: "services/portal/frontend/src/views/billing/BillingView.vue",
    composablePath: "services/portal/frontend/src/composables/useBillingSurface.ts",
    importLine: 'import { useBillingSurface } from "@/composables/useBillingSurface"',
    forbiddenViewApiImports: ["@/api/portal/billing", "@/api/portal/common"],
    forbiddenViewFragments: [
      "async function load(",
      "async function loadBillingDetails",
      "function applyFilter(",
      "function resetFilter(",
    ],
    requiredComposableFragments: [
      "fetchBillingSummary",
      "fetchBillingDetails",
      "summaryLoading",
      "detailsLoading",
      "billingQuery",
      "applyFilter",
      "resetFilter",
      "detailsError",
    ],
  },
  {
    name: "workspace",
    viewPath: "services/portal/frontend/src/views/workspace/WorkspaceView.vue",
    composablePath: "services/portal/frontend/src/composables/useWorkspaceSurface.ts",
    importLine: 'import { useWorkspaceSurface } from "@/composables/useWorkspaceSurface"',
    forbiddenViewApiImports: ["@/api/portal/workspace"],
    forbiddenViewFragments: [
      "async function load(",
      "function workspaceQuery(",
      "function triggerUpload(",
      "function submitUpload(",
    ],
    requiredComposableFragments: [
      "fetchWorkspace",
      "disabledStorageEntitlement",
      "workspaceQuery",
      "triggerUpload",
      "submitUpload",
      "fileSpaceUsageText",
    ],
  },
  {
    name: "overview",
    viewPath: "services/portal/frontend/src/views/overview/OverviewView.vue",
    composablePath: "services/portal/frontend/src/composables/useOverviewSurface.ts",
    importLine: 'import { useOverviewSurface } from "@/composables/useOverviewSurface"',
    forbiddenViewApiImports: ["@/api/portal/overview", "@/api/portal/resources"],
    forbiddenViewFragments: [
      "async function load(",
      "async function loadPlatformProvisionedResources",
      "function overviewQuery(",
    ],
    requiredComposableFragments: [
      "fetchOverview",
      "fetchMyResources",
      "overviewQuery",
      "recentBindings",
      "resourcePanelLoading",
    ],
  },
  {
    name: "resources",
    viewPath: "services/portal/frontend/src/views/resources/ResourcesView.vue",
    composablePath: "services/portal/frontend/src/composables/useResourcesSurface.ts",
    importLine: 'import { useResourcesSurface } from "@/composables/useResourcesSurface"',
    forbiddenViewApiImports: ["@/api/portal/resources"],
    forbiddenViewFragments: [
      "async function reload(",
      "function setAdjustmentPlan(",
    ],
    requiredComposableFragments: [
      "fetchMyResources",
      "resourcesLoading",
      "setAdjustmentPlan",
      "reload",
      "planCards",
    ],
  },
  {
    name: "trace",
    viewPath: "services/portal/frontend/src/views/trace/TraceView.vue",
    composablePath: "services/portal/frontend/src/composables/useTraceSurface.ts",
    importLine: 'import { useTraceSurface } from "@/composables/useTraceSurface"',
    forbiddenViewApiImports: ["@/api/portal/traces"],
    forbiddenViewFragments: [
      "async function load(",
      "function traceQuery(",
      "function applyFilters(",
      "function resetFilters(",
    ],
    requiredComposableFragments: [
      "fetchSessionTraces",
      "traceQuery",
      "applyFilters",
      "resetFilters",
      "totalEstimatedCost",
    ],
  },
  {
    name: "admin_users",
    viewPath: "services/portal/frontend/src/views/admin/AdminUsersView.vue",
    composablePath: "services/portal/frontend/src/composables/useAdminUsersSurface.ts",
    importLine: 'import { useAdminUsersSurface } from "@/composables/useAdminUsersSurface"',
    forbiddenViewApiImports: ["@/api/portal/admin"],
    forbiddenViewFragments: [
      "async function load(",
      "async function runAction(",
      "async function submitCreateUser(",
      "async function submitDeleteUser(",
      "function usersQuery(",
    ],
    requiredComposableFragments: [
      "fetchAdminUsers",
      "createAdminUser",
      "deleteAdminUser",
      "usersQuery",
      "runAction",
      "submitCreateUser",
      "submitDeleteUser",
    ],
  },
];

for (const spec of surfaceSpecs) {
  const view = await readFile(spec.viewPath, "utf8");
  const composable = await readFile(spec.composablePath, "utf8").catch(() => "");
  assert(composable, `surface_composable_missing:${spec.name}`);
  assert(view.includes(spec.importLine), `surface_view_must_import_composable:${spec.name}`);
  for (const forbidden of spec.forbiddenViewApiImports) {
    assert.equal(view.includes(forbidden), false, `surface_view_must_not_import_api:${spec.name}:${forbidden}`);
  }
  for (const forbidden of spec.forbiddenViewFragments) {
    assert.equal(view.includes(forbidden), false, `surface_view_must_not_own_logic:${spec.name}:${forbidden}`);
  }
  for (const required of spec.requiredComposableFragments) {
    assert(composable.includes(required), `surface_composable_missing_fragment:${spec.name}:${required}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_frontend_surface_composables",
  surfaces: surfaceSpecs.map((spec) => spec.name),
}, null, 2));
