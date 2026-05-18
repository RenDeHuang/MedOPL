import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const gatePath = "scripts/smoke-test-v22-portal-retired-frontend-surface-gate.mjs";

export const retiredFrontendSurface = [
  "services/portal/frontend/src/views/harness/PortalComponentFixtureRenderer.vue",
  "services/portal/frontend/src/harness/portal-ui-evalset.json",
  "services/portal/frontend/src/harness/portal-ui-surfaces.ts",
  "services/portal/frontend/src/views/packages/PackagesView.vue",
  "services/portal/frontend/src/views/resources/ResourcesView.vue",
  "services/portal/frontend/src/views/servers/ServersView.vue",
  "services/portal/frontend/src/views/admin/AdminOpsView.vue",
  "services/portal/frontend/src/views/billing/BillingView.vue",
  "services/portal/frontend/src/layouts/AppLayout.vue",
  "services/portal/frontend/src/layouts/AppHeader.vue",
  "services/portal/frontend/src/layouts/AppSidebar.vue",
  "services/portal/frontend/src/components/resources/ResourcesCurrentPanel.vue",
  "services/portal/frontend/src/components/billing/BillingWorkspaceCostPanel.vue",
  "services/portal/frontend/src/components/billing/BillingRunCostPanel.vue",
  "services/portal/frontend/src/app/pages/AdminConsole.tsx",
  "services/portal/frontend/tests/visual/portal-surfaces.visual.ts",
];

export const retiredFigmaZipResidue = [
  "pages/AdminConsole.tsx",
];

export const retiredFrontendRoutes = [
  "/__portal-harness/components",
  "/packages",
  "/advanced/servers",
  "/runtime",
  "/tasks",
  "/opl",
];

export const residueCarrierFiles = [
  "scripts/smoke-test-v22-product-goal-harness.mjs",
  "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
  "scripts/smoke-test-v22-portal-package-surface-isolation.mjs",
  "scripts/smoke-test-v22-portal-mobile-usability.mjs",
  "scripts/smoke-test-v22-portal-mobile-table-usability.mjs",
  "scripts/smoke-test-v22-retire-legacy-resource-user-surface.mjs",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "docs/recovery/physical-legacy-file-retirement-run-manifest.json",
  "docs/recovery/v22-agent-verify-manifest.json",
  "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  "DESIGN.md",
];

export const currentTruthFiles = [
  "DESIGN.md",
  "docs/contracts/README.md",
  "docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md",
  "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md",
  "docs/recovery/v22-goal-current.json",
  "docs/recovery/v22-goal-state.md",
  "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  "docs/recovery/v22-agent-verify-manifest.json",
  "docs/recovery/mvp-contract-acceptance.md",
  "docs/recovery/status-matrix.md",
  "docs/recovery/portal-figma-make-ui-convergence-plan.md",
  "docs/recovery/portal-ui-design-prd.md",
  "docs/recovery/physical-legacy-file-retirement-run-manifest.json",
];

export const retiredTruthTokens = [
  "PortalComponentFixtureRenderer.vue",
  "portal-ui-evalset",
  "portal-ui-surfaces",
  "__portal-harness",
  "AdminConsole.tsx",
  "Vue harness",
  "visual workbench",
  "screenshot baseline",
  "截图 baseline",
];

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function source(filePath) {
  return readFile(filePath, "utf8");
}

function gitLsFiles(prefix) {
  const result = spawnSync("git", ["ls-files", prefix], {
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_ls_files_failed:${result.stderr || result.stdout}`);
  return result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function assertNoMatches(files, predicate, label) {
  const matches = files.filter(predicate);
  assert.deepEqual(matches, [], label);
}

async function main() {
  const trackedFrontendFiles = gitLsFiles("services/portal/frontend");

  assertNoMatches(trackedFrontendFiles, (file) => file.endsWith(".vue"), "old_vue_files_must_not_be_tracked");
  assertNoMatches(trackedFrontendFiles, (file) => file.includes("/src/components/"), "old_src_components_must_not_be_tracked");
  assertNoMatches(trackedFrontendFiles, (file) => file.includes("/src/harness/"), "old_src_harness_must_not_be_tracked");
  assertNoMatches(trackedFrontendFiles, (file) => file.includes("portal-ui-evalset"), "old_portal_ui_evalset_must_not_be_tracked");
  assertNoMatches(trackedFrontendFiles, (file) => file.includes("__portal-harness"), "old_portal_harness_route_must_not_be_tracked");
  assertNoMatches(trackedFrontendFiles, (file) => file.endsWith("/AdminConsole.tsx"), "old_admin_console_must_not_be_tracked");
  assertNoMatches(trackedFrontendFiles, (file) => /(?:snapshot|baseline)/iu.test(file), "old_screenshot_snapshot_baseline_must_not_be_tracked");

  for (const retiredPath of retiredFrontendSurface) {
    assert.equal(await exists(retiredPath), false, `retired_frontend_surface_must_not_exist:${retiredPath}`);
  }

  const routesSource = await source("services/portal/frontend/src/app/routes.tsx");
  const layoutSource = await source("services/portal/frontend/src/app/components/Layout.tsx");
  const playwrightConfig = await source("services/portal/frontend/playwright.config.ts");
  for (const route of retiredFrontendRoutes) {
    assert.equal(routesSource.includes(`path: "${route.slice(1)}"`), false, `retired_route_must_not_be_active_route:${route}`);
    assert.equal(layoutSource.includes(`path: "${route}"`), false, `retired_route_must_not_be_active_nav:${route}`);
    assert.equal(playwrightConfig.includes(route), false, `retired_route_must_not_be_playwright_entry:${route}`);
  }
  assert.equal(routesSource.includes("AdminConsole"), false, "old_admin_console_must_not_be_mounted");

  for (const filePath of residueCarrierFiles) {
    if (filePath === gatePath) continue;
    const fileSource = await source(filePath);
    for (const retiredPath of retiredFrontendSurface) {
      assert.equal(
        fileSource.includes(retiredPath),
        false,
        `retired_frontend_path_must_only_live_in_central_gate:${filePath}:${retiredPath}`,
      );
    }
  }

  for (const filePath of currentTruthFiles) {
    if (filePath === gatePath) continue;
    const fileSource = await source(filePath);
    for (const token of retiredTruthTokens) {
      assert.equal(
        fileSource.includes(token),
        false,
        `retired_frontend_truth_token_must_not_be_current_truth:${filePath}:${token}`,
      );
    }
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_retired_frontend_surface_gate",
    retiredFrontendSurface,
    retiredFrontendRoutes,
    gatePath,
  }, null, 2));
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  await main();
}
