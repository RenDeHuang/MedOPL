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
    "docs/recovery/active-surface.md",
    "docs/recovery/archive-policy.md",
    "docs/recovery/repo-zoning.md",
    "docs/recovery/legacy-cleanup-backlog.md",
    "docs/recovery/decisions.md",
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
      /deploy\/tke-package.*可以作为 v22 交付参考/u,
      /只能保留为 legacy alias/u,
    ]) {
      assertNotMatches(source, forbidden, `strict_policy:${file}`);
    }
  }

  const policyDirs = ["docs/contracts", "docs/recovery"];
  const positiveAliasPatterns = [
    /\blegacyResourceOrderId\b[^\n]{0,160}(?:optional|migration-only|alias|tag|field|required|固定|必填|可作为|可以为空|仅可|只可)/iu,
    /(?:optional|migration-only|alias|tag|field|required|固定|必填|可作为|可以为空|仅可|只可)[^\n]{0,160}\blegacyResourceOrderId\b/iu,
    /\blegacyresourceorderid\b[^\n]{0,160}(?:optional|migration-only|alias|fixed|required|tag|key)/iu,
    /\bresourceOrderId\b[^\n]{0,160}(?:optional|migration-only|alias|tag|field|required|固定|必填|可作为|可以为空|仅可|只可)/iu,
    /(?:optional|migration-only|alias|tag|field|required|固定|必填|可作为|可以为空|仅可|只可)[^\n]{0,160}\bresourceOrderId\b/iu,
    /\b(?:legacy|compatibility?)\s+alias\b/iu,
    /\bmigration-only alias\b/iu,
    /\boptional migration alias\b/iu,
    /"legacyResourceOrderId"\s*:/u,
    /"resourceOrderId"\s*:/u,
    /legacyresourceorderid_optional_migration_only/iu,
  ];
  const positiveAliasFindings = [];
  for (const policyDir of policyDirs) {
    const entries = await readdir(path.join(repoRoot, policyDir), { recursive: true });
    for (const entry of entries) {
      if (!String(entry).endsWith(".md") && !String(entry).endsWith(".json")) continue;
      const repoPath = path.join(policyDir, entry).replaceAll("\\", "/");
      const source = await readRepoFile(repoPath);
      for (const pattern of positiveAliasPatterns) {
        const match = pattern.exec(source);
        if (match) positiveAliasFindings.push(`${repoPath}:${pattern}:line_${source.slice(0, match.index).split("\n").length}`);
      }
    }
  }
  assert.deepEqual(positiveAliasFindings, [], `strict_policy_must_not_retain_positive_compat_aliases:${positiveAliasFindings.join(",")}`);

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
  const residualLegacyTestAnchors = [
    "smoke-test-billing-aggregator-dockerfile-deps.mjs",
    "smoke-test-billing-cloud-status.mjs",
    "smoke-test-billing-exact-only-settlement.mjs",
    "smoke-test-billing-server-entry-contract.mjs",
    "smoke-test-billing-server-runtime-contract.mjs",
    "smoke-test-portal-access-register.mjs",
    "smoke-test-portal-admin-api-payload-helpers-contract.mjs",
    "smoke-test-portal-admin-api-payloads-contract.mjs",
    "smoke-test-portal-admin-api-routes-contract.mjs",
    "smoke-test-portal-admin-ops-routes-contract.mjs",
    "smoke-test-portal-admin-portrait-payloads-contract.mjs",
    "smoke-test-portal-admin-user-routes-contract.mjs",
    "smoke-test-portal-api-payloads-contract.mjs",
    "smoke-test-portal-api-routes-contract.mjs",
    "smoke-test-portal-auth-runtime-handler-contract.mjs",
    "smoke-test-portal-commercial-saas.mjs",
    "smoke-test-portal-identity-security-runtime-contract.mjs",
    "smoke-test-portal-legacy-workspace-upload-contract.mjs",
    "smoke-test-portal-local-login.mjs",
    "smoke-test-portal-opl-runtime-recovery.mjs",
    "smoke-test-portal-opl-web-launch.mjs",
    "smoke-test-portal-opl-web-mas-run.mjs",
    "smoke-test-portal-page-payload-helpers-contract.mjs",
    "smoke-test-portal-runtime-entrypoint-contract.mjs",
    "smoke-test-portal-runtime-route-wiring-contract.mjs",
    "smoke-test-portal-server-plan-runtime-handler-contract.mjs",
    "smoke-test-portal-spa-access.mjs",
    "smoke-test-portal-task-space-routes-contract.mjs",
    "smoke-test-portal-ui-and-guards.mjs",
    "smoke-test-portal-user-admin.mjs",
    "smoke-test-portal-workspace-runtime-contract.mjs",
    "smoke-test-portal-zip-archive-contract.mjs",
    "start-minio-port-forward.ps1",
    "start-opl-web-runtime.mjs",
    "install-harbor-local.ps1",
    "install-minio-local.ps1",
  ];
  const legacyNames = scriptNames.filter((name) =>
    /^smoke-test-v(?:19|20|21)/u.test(name)
    || /^check-v(?:18|19|20|21)/u.test(name)
    || /^daily-check-v(?:19|20|21)/u.test(name)
    || /^live-prepare-v(?:19|20|21)/u.test(name)
    || /^smoke-test-v13/u.test(name)
    || /^load-test-v13/u.test(name)
    || /^analyze-v21/u.test(name)
    || /^smoke-test-portal-resource-orders/u.test(name)
    || /^smoke-test-portal-resource-order-attribution-contract/u.test(name)
    || /^smoke-test-portal-resource-provisioner-timeout-config/u.test(name)
    || /^smoke-test-portal-async-provision/u.test(name)
    || /^smoke-test-portal-opl-adapter/u.test(name)
    || /^smoke-test-portal-opl-web-hard-loop/u.test(name)
    || /^smoke-test-opl-launch-adapter/u.test(name)
    || /^live-test-/u.test(name)
    || /^smoke-test-resource-provisioner/u.test(name)
    || /^smoke-test-billing-opencost/u.test(name)
    || /^install-opencost/u.test(name)
    || /^start-opencost/u.test(name)
    || /^start-billing-live/u.test(name)
    || /^smoke-test-billing-cos-zip-reader/u.test(name)
    || /^smoke-test-billing-http-routes-contract/u.test(name)
    || /^smoke-test-billing-resource-attribution/u.test(name)
    || /^smoke-test-billing-summary-runtime-contract/u.test(name)
    || /^smoke-test-billing-tencent-bill-summary/u.test(name)
    || /^smoke-test-billing-tencent-runtime-contract/u.test(name)
    || /^smoke-test-billing-v12-cos-attribution/u.test(name)
    || /^smoke-test-portal-billing-export-routes-contract/u.test(name)
    || /^smoke-test-portal-http-dispatcher-contract/u.test(name)
    || /^smoke-test-portal-page-payloads-contract/u.test(name)
    || /^smoke-test-portal-runtime-bootstrap-contract/u.test(name)
    || /^smoke-test-portal-store-structure-contract/u.test(name)
    || residualLegacyTestAnchors.includes(name)
  );
  assert.deepEqual(legacyNames, [], `legacy_scripts_must_be_deleted:${legacyNames.join(",")}`);

  const legacyScriptAssets = [
    "scripts/fixtures/med-autoscience-runner-fixture.mjs",
    "scripts/fixtures/portal-internal-resource-order-fixture.mjs",
    "scripts/lib/v19-commercial-ops-journey-contract.mjs",
    "scripts/lib/v19-live-cleanup-guard.mjs",
    "scripts/lib/v19-live-e2e-contract.mjs",
    "scripts/lib/v19-live-labels.mjs",
    "scripts/lib/v19-live-tke-context.mjs",
    "scripts/lib/v20.33-evidence.mjs",
  ];
  for (const repoPath of legacyScriptAssets) {
    await assertMissing(repoPath, "legacy_script_asset");
  }

  const suite = await readRepoFile("scripts/smoke-test-v22-mvp-contract-suite.mjs");
  for (const forbidden of ["smoke-test-v19", "smoke-test-v20", "smoke-test-v21", "live-test-", "resource-provisioner", "opencost"]) {
    assertNotIncludes(suite, forbidden, "default_mvp_suite_legacy_reference");
  }

  const currentNarrativeFiles = [
    "README.md",
    "docs/product.md",
    "docs/architecture.md",
    "docs/recovery/v22-program-board.md",
    "docs/recovery/v22-agent-verify-manifest.json",
    "scripts/smoke-test-v22-mvp-contract-suite.mjs",
    "scripts/v22-verify.mjs",
    "scripts/v22-workflow-gate.mjs",
  ];
  const forbiddenCurrentReferences = residualLegacyTestAnchors
    .filter((name) => name.startsWith("smoke-test-"))
    .map((name) => `scripts/${name}`);
  for (const file of currentNarrativeFiles) {
    const source = await readRepoFile(file);
    for (const forbidden of forbiddenCurrentReferences) {
      assertNotIncludes(source, forbidden, `current_validation_must_not_reference_residual_legacy_anchor:${file}`);
    }
  }
}

async function assertRetiredAssetsDeleted() {
  for (const repoPath of [
    "adapters/resource-provisioner",
    "adapters/med-autoscience-runner",
    "adapters/cloud-provisioner",
    "adapters/shared",
    "infra/opencost",
    "infra/kubernetes",
    "infra/codex-runtime",
    "infra/production-hardening",
    "compose.demo.yaml",
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
  for (const repoPath of [
    "services/portal/src/state/portal-resource-order-store.mjs",
    "services/portal/src/integrations/resource-provisioner-client.mjs",
    "services/portal/src/domain/resource-orders.mjs",
    "services/portal/src/domain/resource-order-event-normalizer.mjs",
    "services/portal/src/domain/resource-order-lifecycle.mjs",
    "services/portal/src/domain/resource-order-normalizer-fields.mjs",
    "services/portal/src/domain/resource-order-normalizer-objects.mjs",
    "services/portal/src/domain/resource-order-normalizers.mjs",
    "services/portal/src/domain/resource-order-public-view.mjs",
    "services/portal/src/domain/resource-order-quote.mjs",
    "services/portal/src/domain/resource-order-statuses.mjs",
  ]) {
    await assertMissing(repoPath, "resource_order_schema_store_file");
  }

  const files = [
    "services/portal/src/state/portal-store-schema.mjs",
    "services/portal/src/state/portal-store-postgres-persistence.mjs",
    "services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs",
    "services/portal/src/state/portal-store-migrations.mjs",
    "services/portal/src/state/portal-store-migration-collections.mjs",
    "services/portal/src/state/portal-store-storage-bootstrap.mjs",
    "services/portal/src/state/portal-store-db-auth.mjs",
    "services/portal/src/state/portal-store-db-delegates.mjs",
    "services/portal/src/state/portal-store-db-facade.mjs",
    "services/portal/src/state/portal-accounting-store.mjs",
    "services/portal/src/state/portal-store.mjs",
    "services/portal/src/app/portal-store-runtime.mjs",
    "services/portal/src/app/portal-runtime-clients.mjs",
    "services/portal/src/app/portal-runtime.mjs",
    "services/portal/src/app/portal-feature-runtime-handlers.mjs",
    "services/portal/src/config/portal-config.mjs",
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
      "orderId",
      "order_id",
      "resourceProvisionerClient",
      "createResourceProvisionerClient",
      "RESOURCE_PROVISIONER_URL",
      "RESOURCE_PROVISIONER_TIMEOUT_MS",
      "/resource-orders/",
    ]) {
      assertNotIncludes(source, forbidden, `resource_order_schema_store:${file}`);
    }
  }
}

async function assertStrictBranchGatesStayScoped() {
  for (const file of [
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
  ]) {
    const source = await readRepoFile(file);
    assertNotIncludes(source, 'if (currentBranchName() === "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement") return;', `strict_monolith_gate_scope:${file}`);
  }
}

async function assertActivePortalLegacyAliasesRetired() {
  const files = await readdir(path.join(repoRoot, "services/portal/src"), { recursive: true });
  const findings = [];
  for (const file of files) {
    if (!String(file).endsWith(".mjs")) continue;
    const repoPath = path.join("services/portal/src", file).replaceAll("\\", "/");
    const source = await readRepoFile(repoPath);
    for (const forbidden of [
      "legacyResourceOrderId",
      "resourceOrderId",
      "resource_order_id",
      "user_owned",
      "user-owned",
    ]) {
      if (source.includes(forbidden)) findings.push(`${repoPath}:${forbidden}`);
    }
  }
  assert.deepEqual(findings, [], `active_portal_legacy_aliases_must_be_deleted:${findings.join(",")}`);
}

async function assertResidualTestAnchorsRetired() {
  const allowedResidualGateFiles = new Set([
    "scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
    "scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
    "scripts/smoke-test-v22-contract-conflict-boundary.mjs",
    "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
    "scripts/smoke-test-v22-physical-delete-user-owned-retired-domain-store.mjs",
    "scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
    "scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
    "scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
    "scripts/smoke-test-v22-cleanup-completion-truth.mjs",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-agent-verify-entrypoint.mjs",
    "scripts/smoke-test-v22-product-goal-execution-order.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-repo-zoning-boundary.mjs",
    "scripts/smoke-test-v22-saas-portal-opl-ops-surface-contract.mjs",
    "scripts/smoke-test-v22-tencent-readonly-inventory-boundary.mjs",
    "scripts/smoke-test-v22-admin-ops-console-boundary.mjs",
    "scripts/smoke-test-v22-portal-role-surface-boundaries.mjs",
    "scripts/smoke-test-v22-authorized-tencent-create-release-contract.mjs",
    "scripts/smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs",
    "scripts/smoke-test-v22-env-template-default-entry.mjs",
    "scripts/smoke-test-v22-long-term-governance-surfaces.mjs",
    "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
  ]);
  const forbiddenTokens = [
    "resourceOrderCount",
    "legacyResourceOrderId",
    "resourceOrderId",
    "resource_orders",
    "resource_order_events",
    "resourceOrders",
    "resourceOrderEvents",
    "handleResourceOrderRoutes",
    "user_owned",
    "user-owned",
  ];
  const scriptNames = await listScripts();
  const findings = [];
  for (const name of scriptNames) {
    if (!name.startsWith("smoke-test-v22-") || !name.endsWith(".mjs")) continue;
    const repoPath = `scripts/${name}`;
    if (allowedResidualGateFiles.has(repoPath)) continue;
    const source = await readRepoFile(repoPath);
    for (const token of forbiddenTokens) {
      if (source.includes(token)) findings.push(`${repoPath}:${token}`);
    }
  }
  assert.deepEqual(findings, [], `residual_legacy_test_anchors_must_be_retired:${findings.join(",")}`);
}

if (runAll || modes.has("policy")) {
  await assertPolicyTruth();
  await assertStrictBranchGatesStayScoped();
}
if (runAll || modes.has("portal")) await assertPortalCompatibilityDeleted();
if (runAll || modes.has("scripts")) await assertLegacyScriptsDeleted();
if (runAll || modes.has("assets")) await assertRetiredAssetsDeleted();
if (runAll || modes.has("schema")) {
  await assertSchemaStoreRetired();
  await assertActivePortalLegacyAliasesRetired();
}
if (runAll || modes.has("residual")) await assertResidualTestAnchorsRetired();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_strict_monolith_legacy_retirement",
  modes: runAll ? ["all"] : [...modes],
}, null, 2));
