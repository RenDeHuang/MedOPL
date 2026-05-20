import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_SMOKE_CATEGORIES,
  SMOKE_CLASSIFICATION,
  listClassifiedSmokeScripts,
} from "../../scripts/v22-test-classification.mjs";
import {
  retiredFigmaZipResidue,
  retiredFrontendRoutes,
  retiredFrontendSurface,
  retiredTruthTokens,
} from "../../scripts/v22-retired-surface-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const physicallyRetiredArchiveMarkdown = Object.freeze([
  "docs/plan",
  "docs/reports",
  "docs/releases",
  "docs/logs",
  "docs/operations",
  "docs/superpowers",
  "OPL-v20-商业化产品套餐开发方案.md",
  "docs/recovery/physical-legacy-file-retirement-goal.md",
  "docs/recovery/physical-legacy-file-retirement-inventory.md",
  "docs/recovery/physical-legacy-file-retirement-run-manifest.json",
]);

const retiredSmokeScriptPaths = Object.freeze([
  "scripts/smoke-test-v22-agent-workflow-orchestrator.mjs",
  "scripts/smoke-test-v22-cleanup-completion-truth.mjs",
  "scripts/smoke-test-v22-legacy-script-archive-boundary.mjs",
  "scripts/smoke-test-v22-opl-legacy-paths-retired.mjs",
  "scripts/smoke-test-v22-physical-delete-user-owned-retired-domain-store.mjs",
  "scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
  "scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
  "scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
  "scripts/smoke-test-v22-portal-retired-frontend-surface-gate.mjs",
  "scripts/smoke-test-v22-portal-ui-truth-convergence.mjs",
  "scripts/smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop.mjs",
  "scripts/smoke-test-v22-retire-portal-provider-key-entry.mjs",
  "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
  "scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs",
  "scripts/smoke-test-v22-system-domain-truth-layer-zero-old-context-gate.mjs",
]);

const legacySmokeNamePatterns = Object.freeze([
  /^smoke-test-v1[3-9]-/u,
  /^smoke-test-v20/u,
  /^smoke-test-v21-/u,
  /^check-v18-/u,
  /^check-v20/u,
  /^check-v21-/u,
  /^daily-check-v19-/u,
  /^live-prepare-v19-/u,
  /^live-test-/u,
]);

const residueCarrierFiles = Object.freeze([
  "tests/contract/contract-test-v22-product-goal-harness.mjs",
  "tests/regression/portal/regression-test-v22-portal-structure-failure-isolation-contract.mjs",
  "tests/regression/portal/regression-test-v22-portal-package-surface-isolation.mjs",
  "tests/regression/portal/regression-test-v22-portal-mobile-usability.mjs",
  "tests/regression/portal/regression-test-v22-portal-mobile-table-usability.mjs",
  "tests/regression/portal/regression-test-v22-retire-legacy-resource-user-surface.mjs",
  "tests/contract/contract-test-v22-default-entry-narrative-gate.mjs",
  "docs/recovery/v22-agent-verify-manifest.json",
  "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  "DESIGN.md",
]);

const currentTruthFiles = Object.freeze([
  "DESIGN.md",
  "docs/specs/README.md",
  "docs/specs/README.md",
  "docs/specs/README.md",
  "docs/recovery/v22-goal-current.json",
  "docs/recovery/v22-goal-state.md",
  "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  "docs/recovery/v22-agent-verify-manifest.json",
  "docs/recovery/mvp-contract-acceptance.md",
  "docs/recovery/status-matrix.md",
  "docs/recovery/portal-figma-make-ui-convergence-plan.md",
  "docs/recovery/portal-ui-design-prd.md",
]);

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function source(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function gitLsFiles(prefix = "") {
  const args = prefix ? ["ls-files", prefix] : ["ls-files"];
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_ls_files_failed:${result.stderr || result.stdout}`);
  return result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

async function assertArchiveMarkdownPhysicallyRetired() {
  for (const repoPath of physicallyRetiredArchiveMarkdown) {
    assert.equal(await exists(repoPath), false, `archive_markdown_surface_must_be_physically_retired:${repoPath}`);
  }
  const trackedArchiveDocs = gitLsFiles()
    .filter((file) => /^docs\/(?:plan|reports|releases|logs|operations|superpowers)\//u.test(file)
      || file === "OPL-v20-商业化产品套餐开发方案.md");
  assert.deepEqual(trackedArchiveDocs, [], `archive_markdown_must_not_be_tracked:${trackedArchiveDocs.join(",")}`);
}

async function assertRetiredSmokeScriptsPhysicallyRetired() {
  for (const repoPath of retiredSmokeScriptPaths) {
    assert.equal(await exists(repoPath), false, `archive_retired_smoke_must_be_physically_retired:${repoPath}`);
    assert.equal(Object.hasOwn(SMOKE_CLASSIFICATION, repoPath), false, `retired_smoke_must_not_be_classified:${repoPath}`);
  }

  const retiredEntries = Object.entries(SMOKE_CLASSIFICATION).filter(([, category]) => category === "archive/retired");
  assert.deepEqual(retiredEntries, [], `archive_retired_smoke_category_must_be_empty:${retiredEntries.map(([file]) => file).join(",")}`);

  const scripts = await readdir(path.join(repoRoot, "scripts"));
  const legacyScripts = scripts.filter((name) => legacySmokeNamePatterns.some((pattern) => pattern.test(name))).sort();
  assert.deepEqual(legacyScripts, [], `legacy_version_smoke_scripts_must_be_deleted:${legacyScripts.join(",")}`);
}

function assertDefaultSuiteStaysLocal() {
  const defaultScripts = listClassifiedSmokeScripts({ categories: DEFAULT_SMOKE_CATEGORIES });
  for (const scriptPath of defaultScripts) {
    const category = SMOKE_CLASSIFICATION[scriptPath];
    assert.notEqual(category, "cloud-future-authorized", `default_suite_must_not_include_cloud_future:${scriptPath}`);
    assert.notEqual(category, "archive/retired", `default_suite_must_not_include_archive_retired:${scriptPath}`);
    assert.equal(/(?:cloud|tencent|authorized|deploy|package-d|live)/iu.test(path.basename(scriptPath)), false, `default_suite_must_not_run_future_authorized_or_live:${scriptPath}`);
  }
}

async function assertRetiredFrontendSurfaceStillGuarded() {
  const trackedFrontendFiles = gitLsFiles("services/portal/frontend");
  const matches = (predicate) => trackedFrontendFiles.filter(predicate);

  assert.deepEqual(matches((file) => file.endsWith(".vue")), [], "old_vue_files_must_not_be_tracked");
  assert.deepEqual(matches((file) => file.includes("/src/components/")), [], "old_src_components_must_not_be_tracked");
  assert.deepEqual(matches((file) => file.includes("/src/harness/")), [], "old_src_harness_must_not_be_tracked");
  assert.deepEqual(matches((file) => file.includes("portal-ui-evalset")), [], "old_portal_ui_evalset_must_not_be_tracked");
  assert.deepEqual(matches((file) => file.includes("__portal-harness")), [], "old_portal_harness_route_must_not_be_tracked");
  assert.deepEqual(matches((file) => file.endsWith("/AdminConsole.tsx")), [], "old_admin_console_must_not_be_tracked");
  assert.deepEqual(matches((file) => /(?:snapshot|baseline)/iu.test(file)), [], "old_screenshot_snapshot_baseline_must_not_be_tracked");

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
    if (!(await exists(filePath))) continue;
    const fileSource = await source(filePath);
    for (const retiredPath of retiredFrontendSurface) {
      assert.equal(
        fileSource.includes(retiredPath),
        false,
        `retired_frontend_path_must_only_live_in_retirement_data:${filePath}:${retiredPath}`,
      );
    }
  }

  for (const filePath of currentTruthFiles) {
    if (!(await exists(filePath))) continue;
    const fileSource = await source(filePath);
    for (const token of retiredTruthTokens) {
      assert.equal(
        fileSource.includes(token),
        false,
        `retired_frontend_truth_token_must_not_be_current_truth:${filePath}:${token}`,
      );
    }
  }
}

await assertArchiveMarkdownPhysicallyRetired();
await assertRetiredSmokeScriptsPhysicallyRetired();
assertDefaultSuiteStaysLocal();
await assertRetiredFrontendSurfaceStillGuarded();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_archive_smoke_contract_physical_retirement_gate",
  archiveMarkdownRetired: physicallyRetiredArchiveMarkdown.length,
  retiredSmokeScripts: retiredSmokeScriptPaths.length,
  defaultSmokeCount: listClassifiedSmokeScripts({ categories: DEFAULT_SMOKE_CATEGORIES }).length,
}, null, 2));
