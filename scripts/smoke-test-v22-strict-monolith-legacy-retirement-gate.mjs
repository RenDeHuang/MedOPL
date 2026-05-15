import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const modes = new Set(process.argv.slice(2).filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2)));
const runAll = modes.size === 0;

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function listScripts() {
  return readdir(path.join(repoRoot, "scripts"));
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

function assertNotMatches(source, forbiddenPattern, label) {
  assert(!forbiddenPattern.test(source), `${label}_forbidden:${forbiddenPattern}`);
}

async function assertMissing(repoPath, label) {
  assert.equal(await exists(repoPath), false, `${label}_must_be_deleted:${repoPath}`);
}

async function assertPresent(repoPath, label) {
  assert.equal(await exists(repoPath), true, `${label}_must_exist:${repoPath}`);
}

async function assertPolicyTruth() {
  const files = [
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "docs/recovery/status-matrix.md",
    "docs/recovery/repo-zoning.md",
    "docs/recovery/legacy-cleanup-backlog.md",
    "docs/recovery/physical-legacy-file-retirement-goal.md",
    "docs/recovery/physical-legacy-file-retirement-inventory.md",
    "docs/recovery/physical-legacy-file-retirement-run-manifest.json",
    "docs/contracts/README.md",
  ];
  const sources = await Promise.all(files.map(async (file) => [file, await readRepoFile(file)]));

  for (const [file, source] of sources) {
    for (const forbidden of [
      /\bkeep_tombstone\b/u,
      /\barchive_reference\b/u,
      /\btombstone_only\b/u,
      /\barchive_only\b/u,
      /\bblocked_without_auth\b/u,
      /\bforbidden_without_auth\b/u,
      /\bpublic_tombstone_delete_requires_user_confirmation\b/u,
      /\bschema_or_migration_delete_without_schema_drop_leaf\b/u,
    ]) {
      assertNotMatches(source, forbidden, `strict_policy:${file}`);
    }
  }

  const gapMatrix = await readRepoFile("docs/recovery/v22-current-vs-ideal-gap-matrix.md");
  for (const phrase of [
    "MedOPL 是 platform-provisioned / customer-dedicated 的 OPL SaaS 托管科研工作台",
    "Portal 是托管科研工作台 control plane",
    "用户购买套餐、算力、存储和运行环境",
    "平台负责开通、隔离、计费、审计和释放",
    "OPL runtime 负责科研工作区执行、文件、任务和结果",
    "后续 feature leaf 碰到过时模块、接口、测试或兼容面时，必须同 leaf 清理退役，或拆出 cleanup leaf 后再继续",
  ]) {
    assert(gapMatrix.includes(phrase), `strict_gap_truth_missing:${phrase}`);
  }
}

async function assertPortalCompatibilityDeleted() {
  for (const repoPath of [
    "services/portal/src/routes/user-owned-resource.routes.mjs",
    "services/portal/src/routes/resource-order.routes.mjs",
    "services/portal/src/state/portal-resource-order-store.mjs",
    "services/portal/src/domain/resource-orders.mjs",
    "services/portal/src/domain/resource-order-event-normalizer.mjs",
    "services/portal/src/domain/resource-order-lifecycle.mjs",
    "services/portal/src/domain/resource-order-normalizer-fields.mjs",
    "services/portal/src/domain/resource-order-normalizer-objects.mjs",
    "services/portal/src/domain/resource-order-normalizers.mjs",
    "services/portal/src/domain/resource-order-public-view.mjs",
    "services/portal/src/domain/resource-order-quote.mjs",
    "services/portal/src/domain/resource-order-statuses.mjs",
    "services/portal/src/integrations/resource-provisioner-client.mjs",
  ]) {
    await assertMissing(repoPath, "portal_legacy_compat_surface");
  }

  const portalApiRoutes = await readRepoFile("services/portal/src/routes/portal-api.routes.mjs");
  const featureRuntime = await readRepoFile("services/portal/src/app/portal-feature-runtime-handlers.mjs");
  for (const source of [portalApiRoutes, featureRuntime]) {
    for (const forbidden of [
      "user-owned-resource.routes.mjs",
      "createUserOwnedResourceRoutes",
      "resource-order.routes.mjs",
      "createResourceOrderRoutes",
      "handleRetiredUserOwnedResources",
      "handleResourceOrderRoutes",
    ]) {
      assertNotIncludes(source, forbidden, "portal_route_registration");
    }
  }

  const frontendFiles = [
    "services/portal/frontend/src/api/portal/resources.ts",
    "services/portal/frontend/src/api/portal/workspace.ts",
    "services/portal/frontend/src/views/harness/PortalComponentFixtureRenderer.vue",
    "services/portal/frontend/src/harness/portal-ui-evalset.json",
  ];
  for (const file of frontendFiles) {
    const source = await readRepoFile(file);
    for (const forbidden of ["legacyResourceOrderId", "resourceOrderId", "resource-order", "resource_orders", "user-owned"]) {
      assertNotIncludes(source, forbidden, `portal_frontend_legacy_copy:${file}`);
    }
  }
}

async function assertLegacyScriptsDeleted() {
  const scriptNames = await listScripts();
  const legacyNames = scriptNames.filter((name) =>
    /^smoke-test-v(?:19|20|21)/u.test(name)
    || /^check-v(?:18|19|20|21)/u.test(name)
    || /^daily-check-v(?:19|20|21)/u.test(name)
    || /^live-prepare-v(?:19|20|21)/u.test(name)
    || /^live-test-/u.test(name)
    || /^smoke-test-resource-provisioner/u.test(name)
    || /^smoke-test-billing-opencost/u.test(name)
    || /^install-opencost/u.test(name)
    || /^start-opencost/u.test(name)
  );
  assert.deepEqual(legacyNames, [], `legacy_scripts_must_be_deleted:${legacyNames.join(",")}`);

  const suite = await readRepoFile("scripts/smoke-test-v22-mvp-contract-suite.mjs");
  for (const forbidden of ["smoke-test-v19", "smoke-test-v20", "smoke-test-v21", "live-test-", "resource-provisioner", "opencost"]) {
    assertNotIncludes(suite, forbidden, "default_mvp_suite_legacy_reference");
  }
}

async function assertRetiredAssetsDeleted() {
  for (const repoPath of [
    "adapters/resource-provisioner",
    "adapters/med-autoscience-runner",
    "infra/opencost",
    "compose.langfuse.yaml",
    "deploy/local/dockerfiles/med-autoscience-runner.Dockerfile",
    "deploy/local/dockerfiles/resource-provisioner.Dockerfile",
    "deploy/tke-package",
  ]) {
    await assertMissing(repoPath, "retired_adapter_deploy_infra_asset");
  }

  for (const activeDeployPath of [
    "deploy/local/dockerfiles/portal.Dockerfile",
    "deploy/local/dockerfiles/opl-web-gateway.Dockerfile",
    "deploy/local/dockerfiles/opl-runtime-bridge.Dockerfile",
  ]) {
    await assertPresent(activeDeployPath, "active_v22_package_d_deploy_surface");
  }
}

async function assertSchemaStoreRetired() {
  const files = [
    "services/portal/src/state/portal-store-schema.mjs",
    "services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs",
    "services/portal/src/state/portal-store-migrations.mjs",
    "services/portal/src/state/portal-store-migration-collections.mjs",
    "services/portal/src/state/portal-store-storage-bootstrap.mjs",
    "services/portal/src/state/portal-store-db-auth.mjs",
    "services/portal/src/state/portal-accounting-store.mjs",
    "services/portal/src/app/portal-store-runtime.mjs",
  ];
  for (const file of files) {
    const source = await readRepoFile(file);
    for (const forbidden of [
      "resource_orders",
      "resource_order_events",
      "resourceOrders",
      "resourceOrderEvents",
      "ensureResourceOrderCollections",
      "persistResourceOrderState",
      "resourceOrderId",
      "resource_order_id",
    ]) {
      assertNotIncludes(source, forbidden, `resource_order_schema_store:${file}`);
    }
  }
}

if (runAll || modes.has("policy")) await assertPolicyTruth();
if (runAll || modes.has("portal")) await assertPortalCompatibilityDeleted();
if (runAll || modes.has("scripts")) await assertLegacyScriptsDeleted();
if (runAll || modes.has("assets")) await assertRetiredAssetsDeleted();
if (runAll || modes.has("schema")) await assertSchemaStoreRetired();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_strict_monolith_legacy_retirement",
  modes: runAll ? ["all"] : [...modes],
}, null, 2));
