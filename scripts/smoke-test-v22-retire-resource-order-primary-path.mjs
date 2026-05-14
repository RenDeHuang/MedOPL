import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const gatePath = "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs";
const allowedResourceOrderRouteTombstoneDiffPaths = new Set([
  gatePath,
  "services/portal/src/routes/resource-order.routes.mjs",
  "services/portal/src/routes/resource-order-public.routes.mjs",
  "services/portal/src/routes/resource-order-internal.routes.mjs",
  "services/portal/src/routes/resource-order-public-delete.routes.mjs",
  "services/portal/src/routes/resource-order-provisioning-service.mjs",
  "services/portal/src/routes/resource-order-route-support.mjs",
  "docs/recovery/legacy-cleanup-backlog.md",
  "docs/recovery/repo-zoning.md",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
]);

const allowedBillingPayloadRewriteDiffPaths = new Set([
  gatePath,
  "services/portal/src/domain/wallet-ledger.mjs",
  "services/portal/src/domain/user-resource-bindings.mjs",
  "services/portal/src/app/portal-page-overview-payloads.mjs",
  "services/portal/src/app/portal-page-payload-helpers.mjs",
  "services/portal/src/app/portal-page-runtime-payloads.mjs",
  "services/portal/src/app/portal-page-workspace-payloads.mjs",
  "services/portal/src/domain/portal-api-payloads.mjs",
  "services/portal/src/domain/lab-entitlements.mjs",
  "services/portal/src/domain/lab-billing-policy.mjs",
  "services/portal/src/domain/workspace-storage.mjs",
  "docs/recovery/legacy-cleanup-backlog.md",
  "docs/recovery/repo-zoning.md",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
]);

const allowedStoreAdminFrontendRewriteDiffPaths = new Set([
  gatePath,
  "services/portal/src/app/portal-admin-api-payload-helpers.mjs",
  "services/portal/src/app/portal-admin-api-payloads.mjs",
  "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs",
  "services/portal/src/app/portal-module-source-payloads.mjs",
  "services/portal/src/state/portal-store-health.mjs",
  "services/portal/frontend/src/api/portal/overview.ts",
  "services/portal/frontend/src/api/portal/resources.ts",
  "services/portal/frontend/src/api/portal/traces.ts",
  "services/portal/frontend/src/api/portal/workspace.ts",
  "services/portal/frontend/src/views/admin/AdminOpsView.vue",
  "services/portal/frontend/src/views/harness/PortalComponentFixtureRenderer.vue",
  "docs/recovery/legacy-cleanup-backlog.md",
  "docs/recovery/repo-zoning.md",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "scripts/smoke-test-v22-admin-ops-console-readonly-mvp.mjs",
  "scripts/smoke-test-v22-portal-admin-shared-helper-structure.mjs",
  "scripts/smoke-test-v22-portal-mobile-table-usability.mjs",
]);

const allowedStorePostgresSchemaEvalShellDiffPaths = new Set([
  gatePath,
  "docs/recovery/legacy-cleanup-backlog.md",
  "docs/recovery/repo-zoning.md",
  "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  "docs/recovery/v22-goal-state.md",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "scripts/smoke-test-v22-product-goal-harness.mjs",
  "scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs",
]);

const allowedStorePostgresSchemaImplementationDiffPaths = new Set([
  gatePath,
  "docs/recovery/legacy-cleanup-backlog.md",
  "docs/recovery/repo-zoning.md",
  "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  "docs/recovery/v22-goal-state.md",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "scripts/smoke-test-v22-product-goal-harness.mjs",
  "scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs",
  "services/portal/src/state/portal-resource-order-store.mjs",
  "services/portal/src/state/portal-store-db-delegates.mjs",
  "services/portal/src/state/portal-store-postgres-persistence.mjs",
  "services/portal/src/state/portal-store-runtime-connections.mjs",
  "services/portal/src/state/portal-store-storage-bootstrap.mjs",
  "services/portal/src/state/portal-store.mjs",
]);

const repoZoningPath = "docs/recovery/repo-zoning.md";
const legacyBacklogPath = "docs/recovery/legacy-cleanup-backlog.md";
const goalStatePath = "docs/recovery/v22-goal-state.md";
const gapMatrixPath = "docs/recovery/v22-current-vs-ideal-gap-matrix.md";
const activePortalFeatureRoutesPath = "services/portal/src/app/portal-feature-runtime-handlers.mjs";
const resourceOrderTombstoneRoutePath = "services/portal/src/routes/resource-order.routes.mjs";
const resourceOrderStorePath = "services/portal/src/state/portal-resource-order-store.mjs";
const portalStoreSchemaPath = "services/portal/src/state/portal-store-schema.mjs";
const portalStorePostgresPersistencePath = "services/portal/src/state/portal-store-postgres-persistence.mjs";
const portalStorePostgresWriteSnapshotHelpersPath = "services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs";
const portalStoreRuntimeConnectionsPath = "services/portal/src/state/portal-store-runtime-connections.mjs";
const portalStorePath = "services/portal/src/state/portal-store.mjs";
const portalStoreDbDelegatesPath = "services/portal/src/state/portal-store-db-delegates.mjs";
const portalStoreRuntimePath = "services/portal/src/app/portal-store-runtime.mjs";
const portalStoreMigrationsPath = "services/portal/src/state/portal-store-migrations.mjs";
const portalStoreMigrationCollectionsPath = "services/portal/src/state/portal-store-migration-collections.mjs";
const retiredResourceOrderRouteModulePaths = [
  "services/portal/src/routes/resource-order-public.routes.mjs",
  "services/portal/src/routes/resource-order-internal.routes.mjs",
  "services/portal/src/routes/resource-order-public-delete.routes.mjs",
  "services/portal/src/routes/resource-order-provisioning-service.mjs",
  "services/portal/src/routes/resource-order-route-support.mjs",
];
const defaultEntryPaths = [
  "README.md",
  "docs/product.md",
  "docs/architecture.md",
  "compose.product.yaml",
];

const activeBillingPayloadPaths = [
  "services/portal/src/domain/wallet-ledger.mjs",
  "services/portal/src/domain/user-resource-bindings.mjs",
  "services/portal/src/app/portal-page-overview-payloads.mjs",
  "services/portal/src/app/portal-page-runtime-payloads.mjs",
  "services/portal/src/app/portal-page-workspace-payloads.mjs",
  "services/portal/src/domain/portal-api-payloads.mjs",
  "services/portal/src/domain/lab-entitlements.mjs",
  "services/portal/src/domain/lab-billing-policy.mjs",
  "services/portal/src/domain/workspace-storage.mjs",
];

const activeStoreAdminFrontendPaths = [
  "services/portal/src/app/portal-admin-api-payload-helpers.mjs",
  "services/portal/src/app/portal-admin-api-payloads.mjs",
  "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs",
  "services/portal/src/app/portal-module-source-payloads.mjs",
  "services/portal/src/state/portal-store-health.mjs",
  "services/portal/frontend/src/api/portal/overview.ts",
  "services/portal/frontend/src/api/portal/resources.ts",
  "services/portal/frontend/src/api/portal/traces.ts",
  "services/portal/frontend/src/api/portal/workspace.ts",
  "services/portal/frontend/src/views/admin/AdminOpsView.vue",
  "services/portal/frontend/src/views/harness/PortalComponentFixtureRenderer.vue",
];

const retiredSuccessPathTokens = [
  "createQuotedResourceOrder",
  "freezeResourceOrder",
  "releaseResourceOrder",
  "transitionResourceOrder",
  "resourceProvisionerClient",
  "fetchCloudResources",
  "scaleToZero",
  "deleteNodePool",
  "resourceOrderProvisionInput",
  "collectResourceOrderAttribution",
  "resourceOrderResponse",
  "findUserResourceOrder",
  "resolveOrderNodePoolMutation",
  "/portal/api/resource-orders/quote",
  "/portal/api/resource-orders/freeze",
  "/portal/api/resource-orders/provision",
  "/portal/api/resource-orders/release",
  "/portal/api/resource-orders/delete-node-pool",
  "/portal/api/resource-orders/delete-resource",
  "/portal/internal/resource-orders/prepare-run",
  "/portal/internal/resource-orders/mark-running",
  "/portal/internal/resource-orders/provisioning-result",
  "/portal/internal/resource-orders/release",
];

const resourceOrderTokens = [
  /\bresource-order\b/iu,
  /\bresource_order\b/iu,
  /\bresourceOrderId\b/u,
  /\bresource order\b/iu,
];

const allowedRetirementContext = /不是|不得|不作为|退场|退役|清退|legacy|migration-only|只作|只作为|optional/iu;

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function readOptionalRepoFile(filePath) {
  try {
    return await readRepoFile(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertZoningRow(source, pathPattern, zone, action) {
  assertIncludes(
    source,
    `| \`${pathPattern}\` | ${zone} | ${action} |`,
    `repo_zoning_${pathPattern.replaceAll("*", "star").replaceAll("/", "_").replaceAll("-", "_")}`,
  );
}

function changedFilesFromBase() {
  const commands = [
    ["diff", "--name-only", "origin/recovery/platform-v22-trunk"],
    ["ls-files", "--others", "--exclude-standard"],
  ];

  const files = [];
  for (const args of commands) {
    const result = spawnSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    assert.equal(result.status, 0, `git_${args.join("_")}_failed:${result.stderr || result.stdout}`);
    files.push(...result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean));
  }
  return [...new Set(files)];
}

function assertOnlyGateChanged() {
  const branchName = currentBranchName();
  const allowedDiffPaths = allowedDiffPathsForBranch(branchName);
  for (const filePath of changedFilesFromBase()) {
    assert(
      allowedDiffPaths.has(filePath),
      `resource_order_retirement_branch_must_not_modify:${branchName}:${filePath}`,
    );
  }
}

function allowedDiffPathsForBranch(branchName = currentBranchName()) {
  const allowedDiffPathsByBranch = new Map([
    ["cleanup/v22-goal-control-plane-current-truth", new Set([
      gatePath,
      "docs/recovery/v22-codex-goal-loop.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-current.json",
      "docs/recovery/v22-goal-leaf-manifest.schema.json",
      "docs/recovery/v22-goal-state.md",
      "docs/recovery/v22-product-completion-scoreboard.json",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-goal-state-consistency.mjs",
      "scripts/smoke-test-v22-product-goal-execution-order.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["cleanup/v22-product-goal-dependency-ordering", new Set([
      gatePath,
      "docs/recovery/v22-codex-goal-loop.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-product-goal-execution-order.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["feat/v22-opl-productionization-local-implementation", new Set([
      gatePath,
      "docs/recovery/real-opl-file-run-artifact-validation-path.md",
      "docs/recovery/status-matrix.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
      "services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs",
    ])],
    ["test/v22-opl-productionization-eval-shell", new Set([
      gatePath,
      "docs/recovery/real-opl-file-run-artifact-validation-path.md",
      "docs/recovery/status-matrix.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
      "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["docs/v22-advance-opl-productionization-eval-shell-cursor", new Set([
      gatePath,
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
      "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["docs/v22-advance-opl-productionization-cursor", new Set([
      gatePath,
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
      "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["test/v22-frontend-product-evalset-gap", new Set([
      gatePath,
      "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["test/v22-backend-contract-eval-template", new Set([
      gatePath,
      "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["test/v22-billing-audit-characterization", new Set([
      gatePath,
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
      "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
    ])],
    ["test/v22-release-readiness-auth-boundary", new Set([
      gatePath,
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
      "scripts/smoke-test-v22-release-readiness-auth-boundary.mjs",
    ])],
    ["test/v22-release-readiness-authorized-blocker", new Set([
      gatePath,
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
      "scripts/smoke-test-v22-release-readiness-auth-boundary.mjs",
    ])],
    ["docs/v22-record-release-readiness-authorized-blocker-b-result", new Set([
      gatePath,
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["docs/v22-record-billing-audit-b-absorb", new Set([
      gatePath,
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["docs/v22-record-backend-template-b-absorb", new Set([
      gatePath,
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["docs/v22-advance-frontend-evalset-cursor", new Set([
      gatePath,
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["cleanup/v22-product-goal-harness", new Set([
      gatePath,
      "docs/recovery/v22-product-goal.md",
      "docs/recovery/v22-product-e2e-contract.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-codex-goal-loop.md",
      "docs/recovery/v22-ai-frontend-backend-development-framework.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    ])],
    ["cleanup/v22-product-goal-loop-budget-10", new Set([
      gatePath,
      "docs/recovery/v22-codex-goal-loop.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    ])],
    ["cleanup/v22-legacy-scripts-archive-eval-shell", new Set([
      gatePath,
      "docs/recovery/legacy-cleanup-backlog.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["refactor/v22-portal-layering-characterization-gate", new Set([
      gatePath,
      "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["contract/v22-opl-productionization-contract-refresh", new Set([
      gatePath,
      "docs/contracts/v22-portal-opl-connection-boundary.md",
      "docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md",
      "docs/recovery/mvp-contract-acceptance.md",
      "docs/recovery/real-opl-file-run-artifact-validation-path.md",
      "docs/recovery/status-matrix.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-mvp-contract-suite.mjs",
      "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
    ])],
    ["cleanup/v22-resource-order-store-postgres-schema-eval-shell", allowedStorePostgresSchemaEvalShellDiffPaths],
    ["cleanup/v22-resource-order-store-postgres-schema-implementation", allowedStorePostgresSchemaImplementationDiffPaths],
    ["recovery/platform-v22-trunk", new Set([
      ...allowedStorePostgresSchemaImplementationDiffPaths,
      gatePath,
      "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
      "docs/contracts/v22-portal-opl-connection-boundary.md",
      "docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md",
      "docs/recovery/mvp-contract-acceptance.md",
      "docs/recovery/real-opl-file-run-artifact-validation-path.md",
      "docs/recovery/status-matrix.md",
      "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
      "docs/recovery/v22-goal-state.md",
      "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
      "scripts/smoke-test-v22-mvp-contract-suite.mjs",
      "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
      "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
      "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
      "scripts/smoke-test-v22-product-goal-harness.mjs",
      "scripts/smoke-test-v22-release-readiness-auth-boundary.mjs",
      "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
      "services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs",
    ])],
    ["cleanup/v22-retire-resource-order-billing-payloads", allowedBillingPayloadRewriteDiffPaths],
    ["cleanup/v22-retire-resource-order-store-admin-frontend", allowedStoreAdminFrontendRewriteDiffPaths],
  ]);
  return allowedDiffPathsByBranch.get(branchName) || allowedResourceOrderRouteTombstoneDiffPaths;
}

function currentBranchName() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_branch_show_current_failed:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function lineAt(source, offset) {
  const start = source.lastIndexOf("\n", offset) + 1;
  const end = source.indexOf("\n", offset);
  return source.slice(start, end === -1 ? source.length : end);
}

function assertNoDefaultResourceOrderPath(filePath, source) {
  for (const token of resourceOrderTokens) {
    for (const match of source.matchAll(new RegExp(token.source, token.flags.includes("g") ? token.flags : `${token.flags}g`))) {
      const line = lineAt(source, match.index ?? 0);
      assert(
        allowedRetirementContext.test(line),
        `${filePath}:${lineNumber(source, match.index ?? 0)}_must_not_make_resource_order_default_path:${line.trim()}`,
      );
    }
  }
}

async function listPortalSourceFiles(relativeDir = "services/portal/src") {
  const root = path.join(repoRoot, relativeDir);
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await listPortalSourceFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(entryPath);
  }
  return files.sort();
}

async function assertOnlyTombstoneRouteIsImported() {
  const portalFeatureRoutes = await readRepoFile(activePortalFeatureRoutesPath);
  assertIncludes(
    portalFeatureRoutes,
    "../routes/resource-order.routes.mjs",
    "portal_feature_runtime_resource_order_tombstone_route_import",
  );

  const forbiddenRouteImports = retiredResourceOrderRouteModulePaths.map((filePath) =>
    `../routes/${path.basename(filePath)}`);
  const importFindings = [];
  for (const filePath of await listPortalSourceFiles()) {
    const source = await readRepoFile(filePath);
    for (const forbiddenImport of forbiddenRouteImports) {
      if (source.includes(forbiddenImport)) {
        importFindings.push({ file: filePath, forbiddenImport });
      }
    }
  }
  assert.deepEqual(importFindings, [], JSON.stringify({
    ok: false,
    contract: "v22_retire_resource_order_primary_path",
    type: "retired_resource_order_route_module_import",
    importFindings,
  }, null, 2));
}

async function assertRetiredSuccessPathModulesRemoved() {
  const findings = [];
  for (const filePath of retiredResourceOrderRouteModulePaths) {
    const source = await readOptionalRepoFile(filePath);
    if (source === null) continue;
    findings.push({
      file: filePath,
      type: "retired_route_module_still_present",
    });
    for (const token of retiredSuccessPathTokens) {
      if (source.includes(token)) {
        findings.push({
          file: filePath,
          type: "retired_success_path_token_present",
          token,
        });
      }
    }
  }
  assert.deepEqual(findings, [], JSON.stringify({
    ok: false,
    contract: "v22_retire_resource_order_primary_path",
    type: "retired_resource_order_route_success_path",
    findings,
  }, null, 2));
}

function assertResourceOrderTombstoneRoute(source) {
  assertIncludes(source, "function isRetiredResourceOrderPath", "resource_order_tombstone_path_matcher");
  assertIncludes(source, "/portal/api/resource-orders", "resource_order_tombstone_public_prefix");
  assertIncludes(source, "/portal/internal/resource-orders", "resource_order_tombstone_internal_prefix");
  assertIncludes(source, "/portal/api/my/resources", "resource_order_tombstone_my_resources_route");
  assertIncludes(source, "resource_order_primary_path_retired", "resource_order_tombstone_error");
  assertIncludes(source, "managed environment", "resource_order_tombstone_managed_environment_replacement");
  assertIncludes(source, "resource binding", "resource_order_tombstone_resource_binding_replacement");
  assertIncludes(source, "410", "resource_order_tombstone_status_code");
  for (const forbidden of ["legacyUse", "user-owned", "user_owned", "/portal/api/user-owned-resources"]) {
    assert(
      !source.includes(forbidden),
      `resource_order_tombstone_must_not_point_to_user_owned:${forbidden}`,
    );
  }
}

function assertNoPrimaryResourceOrderAttribution(filePath, source) {
  const findings = [];
  const forbiddenPatterns = [
    /\bresourceOrderId\b/gu,
    /\bresource_order_id\b/giu,
    /\bresourceorderid\b/giu,
    /\borderId\b/gu,
    /\border_id\b/giu,
    /\bresource-order\b/giu,
    /\bresource_order\b/giu,
  ];
  for (const pattern of forbiddenPatterns) {
    for (const match of source.matchAll(pattern)) {
      const index = match.index ?? 0;
      const context = source.slice(Math.max(0, index - 180), Math.min(source.length, index + 220));
      if (context.includes("legacyResourceOrderId") && /optional|migration-only|legacy|retired|退场|迁移/iu.test(context)) continue;
      findings.push({
        file: filePath,
        line: lineNumber(source, index),
        token: match[0],
        lineText: lineAt(source, index).trim(),
      });
    }
  }
  assert.deepEqual(findings, [], JSON.stringify({
    ok: false,
    contract: "v22_retire_resource_order_primary_path",
    type: "active_billing_payload_resource_order_primary_attribution",
    detail: "Use resourceBindingId, billingAttributionId, workspaceId, accountId, and serverPlanId. Legacy identifiers must be legacyResourceOrderId optional/migration-only.",
    findings,
  }, null, 2));
}

function assertRequiredPrimaryFields(filePath, source, required = ["resourceBindingId", "billingAttributionId", "workspaceId"]) {
  const findings = required
    .filter((token) => !source.includes(token))
    .map((token) => ({ file: filePath, missing: token }));
  assert.deepEqual(findings, [], JSON.stringify({
    ok: false,
    contract: "v22_retire_resource_order_primary_path",
    type: "active_billing_payload_missing_v22_attribution",
    findings,
  }, null, 2));
}

function assertNoRetiredPayloadShape(filePath, source) {
  const retiredPayloadTokens = [
    "latestResourceOrders",
    "resourceOrderCount",
    "resourceOrderPublicView",
    "resourceOrdersForUser",
    "resourceorderid",
  ];
  const findings = retiredPayloadTokens
    .filter((token) => source.includes(token))
    .map((token) => ({ file: filePath, token }));
  assert.deepEqual(findings, [], JSON.stringify({
    ok: false,
    contract: "v22_retire_resource_order_primary_path",
    type: "active_payload_must_not_expose_resource_order_shape",
    findings,
  }, null, 2));
}

function requiredPrimaryFieldsFor(filePath) {
  const fieldsByPath = new Map([
    ["services/portal/src/app/portal-page-runtime-payloads.mjs", []],
    ["services/portal/src/app/portal-page-payload-helpers.mjs", ["resourceBindingCount"]],
  ]);
  return fieldsByPath.get(filePath) || ["resourceBindingId", "billingAttributionId", "workspaceId"];
}

function assertRequiredRetirementDocs({ repoZoning, legacyBacklog }) {
  assertIncludes(
    repoZoning,
    "resource-order billing/payload second-slice cleanup completed",
    "repo_zoning_resource_order_billing_payload_second_slice",
  );
  assertIncludes(
    legacyBacklog,
    "第二刀 billing/payload 字段 rewrite",
    "legacy_backlog_resource_order_billing_payload_second_slice",
  );
  assertIncludes(
    legacyBacklog,
    "active ledger、binding 和 Portal payload 主归因迁到 `resourceBindingId`、`billingAttributionId`、`workspaceId`、`accountId` / `serverPlanId`",
    "legacy_backlog_resource_order_billing_payload_attribution",
  );
  assertIncludes(
    repoZoning,
    "resource-order store/admin/frontend third-slice cleanup completed",
    "repo_zoning_resource_order_store_admin_frontend_third_slice",
  );
  assertIncludes(
    legacyBacklog,
    "第三刀 store health / admin / frontend surface 清退",
    "legacy_backlog_resource_order_store_admin_frontend_third_slice",
  );
  assertIncludes(
    legacyBacklog,
    "active admin、module source、store health 和 frontend surface 不再把 resource-order 作为默认展示字段或主归因字段",
    "legacy_backlog_resource_order_store_admin_frontend_surface",
  );
}

function assertStoreHealthUsesResourceBindingSurface(source) {
  assertIncludes(source, "resourceBindings", "store_health_resource_binding_surface");
  assertIncludes(source, "billingAttributionId", "store_health_billing_attribution_surface");
  assertIncludes(source, "workspaceId", "store_health_workspace_surface");
  assertIncludes(source, "accountId", "store_health_account_surface");
  assertIncludes(source, "serverPlanId", "store_health_server_plan_surface");
  assert(!source.includes("resourceOrders"), "store_health_must_not_expose_resource_orders_surface");
  assert(!source.includes("exactBillingSource"), "store_health_must_not_retain_resource_order_billing_source");
}

function assertModuleSourceUsesResourceBindingSurface(source) {
  assertIncludes(source, "resource_bindings", "module_source_resource_bindings_module");
  assertIncludes(source, "/portal/api/platform-provisioned-resources", "module_source_platform_provisioned_resources_api");
  assertIncludes(source, "resource_binding_status", "module_source_resource_binding_capability");
  assert(!source.includes("resource_orders"), "module_source_must_not_expose_resource_orders_module");
  assert(!source.includes("/portal/api/resource-orders"), "module_source_must_not_point_to_resource_orders_api");
  assert(!source.includes("resource_order_status"), "module_source_must_not_expose_resource_order_capability");
}

function assertFrontendAdminUsesResourceBindingSurface(source) {
  assertIncludes(source, "item.resourceBindingId", "admin_ops_view_resource_binding_key");
  assertIncludes(source, "billingAttributionId", "admin_ops_view_billing_attribution");
  assert(!source.includes("item.resourceOrderId"), "admin_ops_view_must_not_display_resource_order_id");
}

function assertNoActiveStoreAdminFrontendResourceOrderSurface(filePath, source) {
  const allowedLegacyAlias = /\blegacyResourceOrderId\b/g;
  const allowedRanges = [];
  for (const match of source.matchAll(allowedLegacyAlias)) {
    const index = match.index ?? 0;
    const context = source.slice(Math.max(0, index - 220), Math.min(source.length, index + 260));
    assert(
      /optional|migration-only|legacy|retired|退场|迁移/iu.test(context),
      `${filePath}:${lineNumber(source, index)}_legacy_resource_order_id_must_be_optional_migration_only`,
    );
    allowedRanges.push([Math.max(0, index - 32), Math.min(source.length, index + "legacyResourceOrderId".length + 32)]);
  }

  const forbiddenPatterns = [
    /\bresourceOrderId\b/gu,
    /\bresource_order_id\b/giu,
    /\bresourceorderid\b/giu,
    /\bresourceOrders\b/gu,
    /\bresourceOrder\b/gu,
    /\bResourceOrder\b/gu,
    /\bResourceOrders\b/gu,
    /\bresource-order\b/giu,
    /\bresource_order\b/giu,
    /\bresource order\b/giu,
  ];
  const findings = [];
  for (const pattern of forbiddenPatterns) {
    for (const match of source.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (allowedRanges.some(([start, end]) => index >= start && index <= end)) continue;
      findings.push({
        file: filePath,
        line: lineNumber(source, index),
        token: match[0],
        lineText: lineAt(source, index).trim(),
      });
    }
  }
  assert.deepEqual(findings, [], JSON.stringify({
    ok: false,
    contract: "v22_retire_resource_order_primary_path",
    type: "active_store_admin_frontend_resource_order_surface",
    detail: "Admin/frontend/module source/store health must use resourceBindingId, billingAttributionId, workspaceId, accountId, and serverPlanId. Retained old identifiers must be legacyResourceOrderId optional/migration-only.",
    findings,
  }, null, 2));
}

function assertNoRequiredResourceOrderIdInContracts(filePath, source) {
  const findings = [];
  const requiredPrimaryPattern = /(?:fixed|required|mandatory|must|必须|固定|必填|主标签|主归因|primary|requiredTag|requiredTags|fixedTags)[^\n`|,[\]]{0,160}\bresourceOrderId\b|\bresourceOrderId\b[^\n`|,[\]]{0,160}(?:fixed|required|mandatory|must|必须|固定|必填|主标签|主归因|primary|requiredTag|requiredTags|fixedTags)/gu;
  for (const match of source.matchAll(requiredPrimaryPattern)) {
    findings.push({
      file: filePath,
      line: lineNumber(source, match.index ?? 0),
      match: match[0].replace(/\s+/g, " ").trim(),
      type: "resource_order_id_required_primary_tag",
    });
  }

  for (const match of source.matchAll(/\bresourceOrderId\b/g)) {
    const contextStart = Math.max(0, (match.index ?? 0) - 180);
    const contextEnd = Math.min(source.length, (match.index ?? 0) + 220);
    const context = source.slice(contextStart, contextEnd);
    if (!context.includes("legacyResourceOrderId")) {
      findings.push({
        file: filePath,
        line: lineNumber(source, match.index ?? 0),
        match: match[0],
        type: "resource_order_id_not_legacy_resource_order_id",
      });
    }
  }

  assert.deepEqual(findings, [], JSON.stringify({
    ok: false,
    contract: "v22_retire_resource_order_primary_path",
    findings,
  }, null, 2));
}

function assertFunctionExport(source, functionName, label) {
  assert(
    source.includes(`export function ${functionName}`) || source.includes(`export async function ${functionName}`),
    `${label}_${functionName}_export_missing:${functionName}`,
  );
}

function assertStorePostgresSchemaCharacterization({
  goalState,
  gapMatrix,
  legacyBacklog,
  repoZoning,
  resourceOrderStore,
  schema,
  postgresPersistence,
  snapshotHelpers,
  runtimeConnections,
  portalStore,
  dbDelegates,
  portalStoreRuntime,
  migrations,
  migrationCollections,
  activePortalFeatureRoutes,
}) {
  assertIncludes(goalState, "leaf-resource-order-store-postgres-schema-eval-shell completed", "goal_state_resource_order_store_postgres_eval_shell_completion");
  assertIncludes(goalState, "leaf-resource-order-store-postgres-schema-implementation completed", "goal_state_resource_order_store_postgres_implementation_completion");
  assertIncludes(goalState, "leaf-secret-hygiene-diff-scan-eval-shell", "goal_state_resource_order_store_postgres_next_cursor");
  assertIncludes(gapMatrix, "store/Postgres/schema retired-active-runtime facts are covered", "gap_matrix_resource_order_store_postgres_characterization_gate");
  assertIncludes(gapMatrix, "status: cleaned", "gap_matrix_resource_order_store_postgres_cleaned");
  assertIncludes(legacyBacklog, "第四刀 store/Postgres/schema characterization", "legacy_backlog_resource_order_store_postgres_characterization");
  assertIncludes(legacyBacklog, "第四刀 store/Postgres/schema implementation completed", "legacy_backlog_resource_order_store_postgres_implementation");
  assertIncludes(repoZoning, "resource-order store/Postgres/schema characterization gate completed", "repo_zoning_resource_order_store_postgres_characterization");
  assertIncludes(repoZoning, "resource-order store/Postgres/schema implementation completed", "repo_zoning_resource_order_store_postgres_implementation");

  assertFunctionExport(resourceOrderStore, "createPortalResourceOrderStore", "resource_order_store");
  for (const expected of [
    "RESOURCE_ORDER_STORE_RETIRED_ERROR",
    "portal_resource_order_store_retired",
    "retiredResourceOrderStoreOperation",
    "upsertResourceOrder",
    "appendResourceOrderEvent",
    "persistResourceOrderState",
  ]) {
    assertIncludes(resourceOrderStore, expected, "resource_order_store_retired_characterization");
  }
  for (const forbidden of [
    "pgTableName",
    "resource_orders",
    "resource_order_events",
    "ledger_entries",
    "pool.connect",
    "INSERT INTO",
  ]) {
    assert(!resourceOrderStore.includes(forbidden), `resource_order_store_must_not_keep_active_postgres_dependency:${forbidden}`);
  }

  for (const expected of [
    'CREATE TABLE IF NOT EXISTS ${pgTableName("resource_orders")}',
    'CREATE TABLE IF NOT EXISTS ${pgTableName("resource_order_events")}',
    "order_id text NOT NULL DEFAULT ''",
    "resource_binding_id text NOT NULL DEFAULT ''",
    'CREATE TABLE IF NOT EXISTS ${pgTableName("workspace_resource_bindings")}',
  ]) {
    assertIncludes(schema, expected, "resource_order_postgres_schema_characterization");
  }

  for (const expected of [
    "resourceBindingId: row.resource_binding_id",
    "workspaceResourceBindings:",
    "writeWorkspaceResourceBindings",
  ]) {
    assertIncludes(postgresPersistence, expected, "resource_binding_postgres_persistence_characterization");
  }
  for (const forbidden of [
    'pool.query(`SELECT * FROM ${pgTableName("resource_orders")}`)',
    'pool.query(`SELECT * FROM ${pgTableName("resource_order_events")}`)',
    "resourceOrdersRes",
    "resourceOrderEventsRes",
    "resourceOrders:",
    "resourceOrderEvents:",
    "writeResourceOrders",
    "writeResourceOrderEvents",
    "await writeResourceOrders({ client, pgTableName, db })",
    "await writeResourceOrderEvents({ client, pgTableName, db })",
  ]) {
    assert(!postgresPersistence.includes(forbidden), `postgres_persistence_must_not_use_resource_order_runtime_path:${forbidden}`);
  }

  assertFunctionExport(snapshotHelpers, "writeResourceOrders", "resource_order_snapshot_helper");
  assertFunctionExport(snapshotHelpers, "writeResourceOrderEvents", "resource_order_snapshot_helper");
  for (const expected of [
    'pgTableName("resource_orders")',
    'pgTableName("resource_order_events")',
  ]) {
    assertIncludes(snapshotHelpers, expected, "resource_order_snapshot_helper_characterization");
  }

  for (const expected of [
    "getAccountingStore",
    "getWorkspaceStore",
    "getLabBillingStore",
  ]) {
    assertIncludes(runtimeConnections, expected, "resource_order_runtime_connection_retired_characterization");
  }
  for (const forbidden of [
    'import { createPortalResourceOrderStore } from "./portal-resource-order-store.mjs";',
    "getResourceOrderStore",
    "let resourceOrderStore = null;",
    "portal_resource_order_store_requires_pg_pool",
    "createPortalResourceOrderStore({",
  ]) {
    assert(!runtimeConnections.includes(forbidden), `runtime_connections_must_not_create_resource_order_store:${forbidden}`);
  }

  for (const expected of [
    "ensureResourceOrderCollections",
    "persistResourceOrderState: dbFacade.persistResourceOrderState",
    "readPortalPostgresSnapshot",
    "writePortalPostgresSnapshot",
    'targetVersion: "v20.32"',
  ]) {
    assertIncludes(portalStore, expected, "resource_order_portal_store_characterization");
  }
  assert(!portalStore.includes("getResourceOrderStore"), "portal_store_must_not_wire_resource_order_runtime_store");

  for (const expected of [
    "RESOURCE_ORDER_STATE_RETIRED_ERROR",
    "persistResourceOrderState(params)",
    "portal_resource_order_state_retired",
  ]) {
    assertIncludes(dbDelegates, expected, "resource_order_db_delegate_retired_characterization");
  }
  for (const forbidden of [
    "return getResourceOrderStore().persistResourceOrderState(params)",
  ]) {
    assert(!dbDelegates.includes(forbidden), `db_delegate_must_not_call_resource_order_store:${forbidden}`);
  }

  assertIncludes(portalStoreRuntime, "ensureResourceOrderCollections", "resource_order_portal_store_runtime_characterization");
  assertIncludes(migrations, "resourceOrders: []", "resource_order_migrations_seed_collection");
  assertIncludes(migrations, "resourceOrderEvents: []", "resource_order_migrations_seed_collection");
  assertIncludes(migrationCollections, '"resourceOrders"', "resource_order_migration_collection_key");
  assertIncludes(migrationCollections, '"resourceOrderEvents"', "resource_order_migration_collection_key");
  assertIncludes(migrationCollections, 'runSnapshotMigration(db, ["ledger", "resourceOrders", "resourceOrderEvents"], ensureResourceOrderCollections)', "resource_order_migration_collection_snapshot");

  assertIncludes(activePortalFeatureRoutes, "../routes/resource-order.routes.mjs", "resource_order_active_app_tombstone_route_only");
  for (const forbiddenImport of [
    "../routes/resource-order-public.routes.mjs",
    "../routes/resource-order-internal.routes.mjs",
    "../routes/resource-order-public-delete.routes.mjs",
    "../routes/resource-order-provisioning-service.mjs",
    "../routes/resource-order-route-support.mjs",
  ]) {
    assert(!activePortalFeatureRoutes.includes(forbiddenImport), `resource_order_active_app_must_not_import_retired_success_route:${forbiddenImport}`);
  }
}

async function contractFiles() {
  const contractsDir = path.join(repoRoot, "docs/contracts");
  const names = await readdir(contractsDir);
  return [
    "docs/contracts/README.md",
    ...names
      .filter((name) => /^v22-.*\.md$/u.test(name))
      .sort()
      .map((name) => `docs/contracts/${name}`),
  ];
}

assertOnlyGateChanged();

const repoZoning = await readRepoFile(repoZoningPath);
const legacyBacklog = await readRepoFile(legacyBacklogPath);
const goalState = await readRepoFile(goalStatePath);
const gapMatrix = await readRepoFile(gapMatrixPath);

for (const [pathPattern, action] of [
  ["services/portal/src/domain/resource-orders.mjs", "tombstone/rewrite"],
  ["services/portal/src/domain/resource-order-*.mjs", "tombstone/rewrite"],
  ["services/portal/src/routes/resource-order*.mjs", "tombstone/delete"],
  ["services/portal/src/state/portal-resource-order-store.mjs", "tombstone/rewrite"],
]) {
  assertZoningRow(repoZoning, pathPattern, "Zone 2", action);
}

assertIncludes(repoZoning, "`resource-order` 不得作为 v22 主产品叙事", "repo_zoning_resource_order_retirement_reason");
assertIncludes(repoZoning, "managed environment/resource binding lifecycle", "repo_zoning_resource_order_replacement_lifecycle");
assertIncludes(repoZoning, "managed environment/resource binding routes", "repo_zoning_resource_order_replacement_routes");
assertIncludes(repoZoning, "managed environment/resource binding persistence", "repo_zoning_resource_order_replacement_persistence");

assertIncludes(legacyBacklog, "## Slice 3: resource-order Primary Path Retirement", "legacy_backlog_resource_order_slice");
assertIncludes(legacyBacklog, "`cleanup/v22-retire-resource-order-primary-path`", "legacy_backlog_resource_order_branch_record");
assertIncludes(legacyBacklog, "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs", "legacy_backlog_resource_order_gate_name");
assertIncludes(legacyBacklog, "Portal 导航不链接 `resource-order` 主路径", "legacy_backlog_resource_order_navigation_gate");
assertIncludes(legacyBacklog, "新开通路径走 managed environment / resource binding", "legacy_backlog_resource_binding_replacement");
assertIncludes(legacyBacklog, "旧 prepare-run 或 resource-order public flow 只能 tombstone 或 legacy internal fence", "legacy_backlog_resource_order_tombstone_scope");
assertIncludes(legacyBacklog, "第一刀 route success path 清退", "legacy_backlog_resource_order_route_tombstone_first_slice");
assertRequiredRetirementDocs({ repoZoning, legacyBacklog });

for (const filePath of defaultEntryPaths) {
  assertNoDefaultResourceOrderPath(filePath, await readRepoFile(filePath));
}

assertResourceOrderTombstoneRoute(await readRepoFile(resourceOrderTombstoneRoutePath));
await assertOnlyTombstoneRouteIsImported();
await assertRetiredSuccessPathModulesRemoved();

assertStorePostgresSchemaCharacterization({
  goalState,
  gapMatrix,
  legacyBacklog,
  repoZoning,
  resourceOrderStore: await readRepoFile(resourceOrderStorePath),
  schema: await readRepoFile(portalStoreSchemaPath),
  postgresPersistence: await readRepoFile(portalStorePostgresPersistencePath),
  snapshotHelpers: await readRepoFile(portalStorePostgresWriteSnapshotHelpersPath),
  runtimeConnections: await readRepoFile(portalStoreRuntimeConnectionsPath),
  portalStore: await readRepoFile(portalStorePath),
  dbDelegates: await readRepoFile(portalStoreDbDelegatesPath),
  portalStoreRuntime: await readRepoFile(portalStoreRuntimePath),
  migrations: await readRepoFile(portalStoreMigrationsPath),
  migrationCollections: await readRepoFile(portalStoreMigrationCollectionsPath),
  activePortalFeatureRoutes: await readRepoFile(activePortalFeatureRoutesPath),
});

for (const filePath of activeBillingPayloadPaths) {
  const source = await readRepoFile(filePath);
  assertRequiredPrimaryFields(filePath, source, requiredPrimaryFieldsFor(filePath));
  assertNoPrimaryResourceOrderAttribution(filePath, source);
  assertNoRetiredPayloadShape(filePath, source);
}

const payloadHelperSource = await readRepoFile("services/portal/src/app/portal-page-payload-helpers.mjs");
assertRequiredPrimaryFields("services/portal/src/app/portal-page-payload-helpers.mjs", payloadHelperSource, requiredPrimaryFieldsFor("services/portal/src/app/portal-page-payload-helpers.mjs"));
assertNoRetiredPayloadShape("services/portal/src/app/portal-page-payload-helpers.mjs", payloadHelperSource);

assertStoreHealthUsesResourceBindingSurface(await readRepoFile("services/portal/src/state/portal-store-health.mjs"));
assertModuleSourceUsesResourceBindingSurface(await readRepoFile("services/portal/src/app/portal-module-source-payloads.mjs"));
assertFrontendAdminUsesResourceBindingSurface(await readRepoFile("services/portal/frontend/src/views/admin/AdminOpsView.vue"));

for (const filePath of activeStoreAdminFrontendPaths) {
  assertNoActiveStoreAdminFrontendResourceOrderSurface(filePath, await readRepoFile(filePath));
}

const requiredLegacyAliasContracts = [
  "docs/contracts/v22-admin-ops-console-boundary.md",
  "docs/contracts/v22-portal-admin-ops-surface-boundary.md",
  "docs/contracts/v22-authorized-tencent-create-release-boundary.md",
];

for (const filePath of requiredLegacyAliasContracts) {
  const source = await readRepoFile(filePath);
  assertIncludes(
    source,
    "`legacyResourceOrderId` 仅可作为 optional、migration-only alias，不得作为 v22 fixed required tag",
    `${filePath}_legacy_resource_order_id_optional_migration_only`,
  );
}

for (const filePath of await contractFiles()) {
  assertNoRequiredResourceOrderIdInContracts(filePath, await readRepoFile(filePath));
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_retire_resource_order_primary_path",
  branchScope: {
    routeTombstoneFirstSlice: currentBranchName() === "cleanup/v22-retire-resource-order-route-tombstones",
    billingPayloadRewriteSlice: currentBranchName() === "cleanup/v22-retire-resource-order-billing-payloads",
    storeAdminFrontendRewriteSlice: currentBranchName() === "cleanup/v22-retire-resource-order-store-admin-frontend",
    storePostgresSchemaCharacterizationSlice: currentBranchName() === "cleanup/v22-resource-order-store-postgres-schema-eval-shell",
    storePostgresSchemaCharacterizationGate: "node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
    leavesStoreSchemaPostgresAndMigrationKeysForFourthSliceImplementation: true,
    allowedTrackedChanges: [...allowedDiffPathsForBranch()],
    deletedRetiredRouteModules: retiredResourceOrderRouteModulePaths,
  },
  checked: {
    repoZoning: repoZoningPath,
    legacyBacklog: legacyBacklogPath,
    activePortalFeatureRoutes: activePortalFeatureRoutesPath,
    resourceOrderTombstoneRoute: resourceOrderTombstoneRoutePath,
    retiredResourceOrderRouteModules: retiredResourceOrderRouteModulePaths,
    activeBillingPayloads: activeBillingPayloadPaths,
    activeStoreAdminFrontendPaths,
    storePostgresSchemaCharacterizationPaths: [
      resourceOrderStorePath,
      portalStoreSchemaPath,
      portalStorePostgresPersistencePath,
      portalStorePostgresWriteSnapshotHelpersPath,
      portalStoreRuntimeConnectionsPath,
      portalStorePath,
      portalStoreDbDelegatesPath,
      portalStoreRuntimePath,
      portalStoreMigrationsPath,
      portalStoreMigrationCollectionsPath,
    ],
    defaultEntrypoints: defaultEntryPaths,
    contractFiles: await contractFiles(),
  },
}, null, 2));
