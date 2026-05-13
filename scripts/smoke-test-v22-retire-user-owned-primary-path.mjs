import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const filePaths = {
  repoZoning: "docs/recovery/repo-zoning.md",
  legacyBacklog: "docs/recovery/legacy-cleanup-backlog.md",
  readme: "README.md",
  product: "docs/product.md",
  architecture: "docs/architecture.md",
  productCompose: "compose.product.yaml",
  defaultEntryGate: "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  statusMatrix: "docs/recovery/status-matrix.md",
  portalConfig: "services/portal/src/config/portal-config.mjs",
  userOwnedDomain: "services/portal/src/domain/user-owned-resources.mjs",
  userOwnedRoutes: "services/portal/src/routes/user-owned-resource.routes.mjs",
  userOwnedStore: "services/portal/src/state/portal-user-owned-resource-store.mjs",
  platformProvisionedDomain: "services/portal/src/domain/platform-provisioned-resources.mjs",
  platformProvisionedRoutes: "services/portal/src/routes/platform-provisioned-resource.routes.mjs",
  platformProvisionedStore: "services/portal/src/state/portal-platform-provisioned-resource-store.mjs",
  portalApiRoutes: "services/portal/src/routes/portal-api.routes.mjs",
  adminApiRoutes: "services/portal/src/routes/admin-api.routes.mjs",
  adminApiPayloads: "services/portal/src/app/portal-admin-api-payloads.mjs",
  adminPortraitPayloads: "services/portal/src/app/portal-admin-portrait-payloads.mjs",
  adminOverviewRuntimePayloads: "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs",
};

const serviceDeletionTargets = [
  "services/portal/src/domain/user-owned-resources.mjs",
  "services/portal/src/routes/user-owned-resource.routes.mjs",
  "services/portal/src/state/portal-user-owned-resource-store.mjs",
];

const forbiddenDefaultUserOwnedPatterns = [
  {
    pattern: /PRODUCT_RUNTIME_MODE["']?\s*[:=]\s*["']?user_owned/iu,
    detail: "PRODUCT_RUNTIME_MODE must not default to user_owned.",
  },
  {
    pattern: /\buser_owned\b\s+(?:primary|default)\s+(?:path|route|entry|runtime|mode)/iu,
    detail: "user_owned must not be described as a primary/default v22 path.",
  },
  {
    pattern: /(?:primary|default)\s+(?:path|route|entry|runtime|mode)\s+\buser_owned\b/iu,
    detail: "user_owned must not be described as a primary/default v22 path.",
  },
  {
    pattern: /`user_owned`\s*(?:是|作为|为)\s*(?:默认|主线|主路径|主入口|正式入口)/u,
    detail: "user_owned must not be named as the default or primary product path.",
  },
  {
    pattern: /(?:默认|主线|主路径|主入口|正式入口)\s*(?:是|作为|为)\s*`user_owned`/u,
    detail: "user_owned must not be named as the default or primary product path.",
  },
  {
    pattern: /user-owned\s+(?:primary|default)\s+(?:path|route|entry|runtime|mode)/iu,
    detail: "user-owned must not be described as a primary/default v22 path.",
  },
  {
    pattern: /(?:primary|default)\s+(?:path|route|entry|runtime|mode)\s+user-owned/iu,
    detail: "user-owned must not be described as a primary/default v22 path.",
  },
  {
    pattern: /用户自带\s*(?:CVM|COS|K8s|TKE)/iu,
    detail: "Default docs must not restore user-owned cloud resource language.",
  },
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function markdownRows(source) {
  return source
    .split(/\r?\n/u)
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

function assertRepoZoningUserOwnedTombstones(source) {
  const rows = markdownRows(source);
  for (const targetPath of serviceDeletionTargets) {
    const row = rows.find((cells) => cells[0] === `\`${targetPath}\``);
    assert(row, `repo_zoning_user_owned_target_missing:${targetPath}`);
    assert.equal(row[1], "Zone 2", `repo_zoning_user_owned_target_must_be_zone_2:${targetPath}`);
    assert.equal(row[2], "tombstone/delete", `repo_zoning_user_owned_target_must_be_tombstone_delete:${targetPath}`);
    assert.match(row[3], /legacy alias|旧用户自带资源|user-owned/iu, `repo_zoning_user_owned_reason_missing:${targetPath}`);
    assert.equal(row[5], "user-owned-retirement", `repo_zoning_user_owned_cleanup_slice_mismatch:${targetPath}`);
  }
}

function assertLegacyBacklogSlice(source) {
  assertIncludes(source, "## Slice 2: user_owned Primary Path Retirement", "legacy_backlog_user_owned_slice_heading");
  assertIncludes(
    source,
    "把 `user_owned` / `user-owned` 收敛为 legacy alias 或 tombstone",
    "legacy_backlog_user_owned_retirement_goal",
  );
  assertIncludes(
    source,
    "scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
    "legacy_backlog_user_owned_retirement_gate",
  );
  assertIncludes(source, "Portal 默认配置不再是 `user_owned`", "legacy_backlog_user_owned_default_config_check");
  assertIncludes(source, "普通用户页面不展示用户自配云资源", "legacy_backlog_user_owned_user_surface_check");
  assertIncludes(
    source,
    "新代码不得新增 `user-owned` route/domain/store 作为正式入口",
    "legacy_backlog_user_owned_new_entry_check",
  );
  assertIncludes(source, "不做兼容翻译", "legacy_backlog_user_owned_no_compat_translation");
  assertIncludes(
    source,
    "不授权本分支删除、移动或修改实现",
    "legacy_backlog_gate_only_does_not_authorize_implementation_changes",
  );
}

function assertNoUserOwnedPrimaryDefault(source, label) {
  for (const { pattern, detail } of forbiddenDefaultUserOwnedPatterns) {
    const match = pattern.exec(source);
    assert.equal(
      match,
      null,
      `${label}_must_not_restore_user_owned_primary_default:${detail}:line_${match ? lineOf(source, match.index) : "unknown"}`,
    );
  }
}

function parseCompose(source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    assert.fail(`compose_product_must_remain_strict_json:${error.message}`);
  }
}

function assertComposeDoesNotUseUserOwnedDefault(source) {
  assertNoUserOwnedPrimaryDefault(source, "compose_product");

  const compose = parseCompose(source);
  assert(compose.services, "compose_product_services_missing");
  for (const [serviceName, service] of Object.entries(compose.services)) {
    const environment = service.environment ?? {};
    assert.notEqual(
      environment.PRODUCT_RUNTIME_MODE,
      "user_owned",
      `compose_product_service_must_not_default_user_owned:${serviceName}`,
    );
    if (Object.hasOwn(environment, "PRODUCT_RUNTIME_MODE")) {
      assert.equal(
        environment.PRODUCT_RUNTIME_MODE,
        "platform_provisioned",
        `compose_product_runtime_mode_must_be_platform_provisioned:${serviceName}`,
      );
    }
  }
}

function assertDefaultEntryGateCoversUserOwned(source) {
  assertIncludes(source, "PRODUCT_RUNTIME_MODE\\\": \\\"user_owned", "default_entry_gate_user_owned_json_runtime_mode");
  assertIncludes(source, "PRODUCT_RUNTIME_MODE=user_owned", "default_entry_gate_user_owned_env_runtime_mode");
  assertIncludes(source, "user_owned_primary_runtime_mode", "default_entry_gate_user_owned_retired_default");
  assertIncludes(source, "assertComposeBoundary", "default_entry_gate_compose_boundary");
}

function assertGateDoesNotRequireServiceDeletion() {
  for (const targetPath of serviceDeletionTargets) {
    assert(
      Object.values(filePaths).includes(targetPath),
      `retirement_gate_must_read_user_owned_target:${targetPath}`,
    );
  }
}

function assertPortalConfigDefault(source) {
  assertNoUserOwnedPrimaryDefault(source, "portal_config");
  assert.match(
    source,
    /PRODUCT_RUNTIME_MODE\s*=\s*String\(process\.env\.PRODUCT_RUNTIME_MODE\s*\|\|\s*"platform_provisioned"\)/u,
    "portal_config_runtime_mode_must_default_platform_provisioned",
  );
}

function assertUserOwnedDomainTombstone(source) {
  assert(!source.includes("export * from \"./platform-provisioned-resources.mjs\""), "user_owned_domain_must_not_re_export_platform_domain");
  assert(!source.includes("normalizeCustomerComputeResource as normalizeUserComputeInstance"), "user_owned_domain_must_not_alias_compute_normalizer");
  assert(!source.includes("normalizeCustomerStorageResource as normalizeUserStorageBucket"), "user_owned_domain_must_not_alias_storage_normalizer");
  assertIncludes(source, "USER_OWNED_RESOURCES_RETIRED", "user_owned_domain_retired_marker");
  assertIncludes(source, "legacy_user_owned_resources_retired", "user_owned_domain_retired_error");
}

function assertUserOwnedStoreTombstone(source) {
  assert(!source.includes("export * from \"./portal-platform-provisioned-resource-store.mjs\""), "user_owned_store_must_not_re_export_platform_store");
  assert(!source.includes("createPortalPlatformProvisionedResourceStore as createPortalUserOwnedResourceStore"), "user_owned_store_must_not_alias_platform_store");
  assertIncludes(source, "USER_OWNED_RESOURCE_STORE_RETIRED", "user_owned_store_retired_marker");
  assertIncludes(source, "legacy_user_owned_resource_store_retired", "user_owned_store_retired_error");
}

function assertUserOwnedRoutesTombstone(source) {
  assert(!source.includes("platform-provisioned-resource.routes.mjs"), "user_owned_routes_must_not_import_platform_routes");
  assert(!source.includes("createLegacyUserOwnedResourceRoutes"), "user_owned_routes_must_not_export_legacy_platform_route");
  assertIncludes(source, "createUserOwnedResourceRoutes", "user_owned_routes_create_function");
  assertIncludes(source, "legacy_user_owned_resources_retired", "user_owned_routes_retired_error");
  assert.match(source, /\b410\b/u, "user_owned_routes_must_return_http_410");
}

function assertPlatformProvisionedRoutesDoNotServeLegacyUserOwned(source) {
  assert(!source.includes("LEGACY_USER_OWNED_RESOURCE_PATHS"), "platform_routes_must_not_define_legacy_user_owned_paths");
  assert(!source.includes("createLegacyUserOwnedResourceRoutes"), "platform_routes_must_not_export_legacy_user_owned_routes");
  assert(!source.includes("/portal/api/user-owned-resources"), "platform_routes_must_not_serve_user_owned_paths");
}

function assertNoUserOwnedLifecycleCompatibility(source, label) {
  assert(!/user_owned\s*:/u.test(source), `${label}_must_not_alias_user_owned_lifecycle_mode`);
  assertIncludes(source, "legacy_user_owned_lifecycle_mode_retired", `${label}_must_fail_closed_user_owned_lifecycle_mode`);
}

function assertPortalApiUsesRetiredRoute(source) {
  assertIncludes(source, "createUserOwnedResourceRoutes", "portal_api_must_mount_user_owned_tombstone_route");
  assert(!source.includes("handleLegacyUserOwnedResources"), "portal_api_must_not_name_user_owned_route_as_legacy_compat");
  assertIncludes(source, "handleRetiredUserOwnedResources", "portal_api_must_name_user_owned_route_as_retired");
}

function assertNoDefaultUserOwnedCopy(source, label) {
  const forbidden = [
    /默认\s+user-owned\s+模式/u,
    /默认\s+`?user_owned`?\s+模式/u,
    /user_owned_storage/u,
  ];
  for (const pattern of forbidden) {
    const match = pattern.exec(source);
    assert.equal(match, null, `${label}_must_not_expose_default_user_owned_copy:line_${match ? lineOf(source, match.index) : "unknown"}`);
  }
}

function assertLegacyBacklogCompleted(source) {
  assertIncludes(
    source,
    "completed on cleanup/v22-retire-user-owned-primary-path",
    "legacy_backlog_user_owned_slice_completion_record",
  );
  assertIncludes(source, "fail-closed tombstone", "legacy_backlog_user_owned_tombstone_record");
}

function assertRepoZoningCompleted(source) {
  assertIncludes(
    source,
    "user-owned primary path cleanup completed on `cleanup/v22-retire-user-owned-primary-path`",
    "repo_zoning_user_owned_completion_record",
  );
}

function assertStatusMatrixCompleted(source) {
  assertIncludes(
    source,
    "cleanup/v22-retire-user-owned-primary-path 已把 `services/portal/src/config/portal-config.mjs` 默认 runtime 收敛到 `platform_provisioned`",
    "status_matrix_user_owned_config_completion_record",
  );
  assertIncludes(source, "legacy user-owned route/domain/store 改为 fail-closed tombstone", "status_matrix_user_owned_tombstone_record");
  assertIncludes(source, "不得恢复 `user_owned` 正式产品语义", "status_matrix_user_owned_no_restore_record");
  assertIncludes(source, "只作为 retired tombstone", "status_matrix_user_owned_archive_tombstone_record");
}

async function importRepoModule(filePath) {
  const href = pathToFileURL(path.join(repoRoot, filePath)).href;
  return import(`${href}?retire_user_owned_gate=${Date.now()}_${Math.random()}`);
}

async function assertUserOwnedRouteRuntimeTombstone() {
  const { createUserOwnedResourceRoutes } = await importRepoModule(filePaths.userOwnedRoutes);
  assert.equal(typeof createUserOwnedResourceRoutes, "function", "user_owned_routes_export_create_function");

  const response = {};
  const handler = createUserOwnedResourceRoutes({
    sendJson(res, payload, status = 200) {
      res.statusCode = status;
      res.payload = payload;
    },
  });
  const handled = await handler({
    req: { method: "GET" },
    res: response,
    url: new URL("http://127.0.0.1/portal/api/user-owned-resources"),
    db: {},
    user: { id: "user-1", tenantId: "tenant-1" },
  });

  assert.equal(handled, true, "user_owned_route_tombstone_must_handle_old_path");
  assert.equal(response.statusCode, 410, "user_owned_route_tombstone_must_return_410");
  assert.equal(response.payload?.error, "legacy_user_owned_resources_retired", "user_owned_route_tombstone_error_mismatch");
  assert.equal(response.payload?.replacement, "/portal/api/platform-provisioned-resources", "user_owned_route_tombstone_replacement_mismatch");
}

async function assertUserOwnedDomainRuntimeTombstone() {
  const module = await importRepoModule(filePaths.userOwnedDomain);
  assert.equal(module.USER_OWNED_RESOURCES_RETIRED, true, "user_owned_domain_retired_constant_mismatch");
  assert.equal(typeof module.normalizeUserComputeInstance, "function", "user_owned_domain_compute_tombstone_export_missing");
  assert.throws(
    () => module.normalizeUserComputeInstance(),
    /legacy_user_owned_resources_retired/u,
    "user_owned_domain_compute_normalizer_must_throw_retired",
  );
}

async function assertUserOwnedStoreRuntimeTombstone() {
  const module = await importRepoModule(filePaths.userOwnedStore);
  assert.equal(module.USER_OWNED_RESOURCE_STORE_RETIRED, true, "user_owned_store_retired_constant_mismatch");
  assert.equal(typeof module.createPortalUserOwnedResourceStore, "function", "user_owned_store_tombstone_export_missing");
  assert.throws(
    () => module.createPortalUserOwnedResourceStore(),
    /legacy_user_owned_resource_store_retired/u,
    "user_owned_store_must_throw_retired",
  );
}

const sources = Object.fromEntries(await Promise.all(
  Object.entries(filePaths).map(async ([key, filePath]) => [key, await readRepoFile(filePath)]),
));

assertGateDoesNotRequireServiceDeletion();
assertRepoZoningUserOwnedTombstones(sources.repoZoning);
assertRepoZoningCompleted(sources.repoZoning);
assertLegacyBacklogSlice(sources.legacyBacklog);
assertLegacyBacklogCompleted(sources.legacyBacklog);
assertStatusMatrixCompleted(sources.statusMatrix);

for (const [label, source] of Object.entries({
  readme: sources.readme,
  product: sources.product,
  architecture: sources.architecture,
})) {
  assertNoUserOwnedPrimaryDefault(source, label);
}

assertComposeDoesNotUseUserOwnedDefault(sources.productCompose);
assertDefaultEntryGateCoversUserOwned(sources.defaultEntryGate);
assertPortalConfigDefault(sources.portalConfig);
assertUserOwnedDomainTombstone(sources.userOwnedDomain);
assertUserOwnedRoutesTombstone(sources.userOwnedRoutes);
assertUserOwnedStoreTombstone(sources.userOwnedStore);
assertPlatformProvisionedRoutesDoNotServeLegacyUserOwned(sources.platformProvisionedRoutes);
assertNoUserOwnedLifecycleCompatibility(sources.platformProvisionedDomain, "platform_provisioned_domain");
assertNoUserOwnedLifecycleCompatibility(sources.platformProvisionedStore, "platform_provisioned_store");
assertPortalApiUsesRetiredRoute(sources.portalApiRoutes);
assertNoDefaultUserOwnedCopy(sources.adminApiRoutes, "admin_api_routes");
assertNoDefaultUserOwnedCopy(sources.adminApiPayloads, "admin_api_payloads");
assertNoDefaultUserOwnedCopy(sources.adminPortraitPayloads, "admin_portrait_payloads");
assertNoDefaultUserOwnedCopy(sources.adminOverviewRuntimePayloads, "admin_overview_runtime_payloads");

await assertUserOwnedRouteRuntimeTombstone();
await assertUserOwnedDomainRuntimeTombstone();
await assertUserOwnedStoreRuntimeTombstone();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_retire_user_owned_primary_path",
  checked: {
    repoZoning: filePaths.repoZoning,
    legacyBacklog: filePaths.legacyBacklog,
    defaultEntrypoints: [
      filePaths.readme,
      filePaths.product,
      filePaths.architecture,
      filePaths.productCompose,
    ],
    defaultEntryGate: filePaths.defaultEntryGate,
    portalServiceFiles: [
      filePaths.portalConfig,
      filePaths.userOwnedDomain,
      filePaths.userOwnedRoutes,
      filePaths.userOwnedStore,
      filePaths.platformProvisionedDomain,
      filePaths.platformProvisionedRoutes,
      filePaths.platformProvisionedStore,
      filePaths.portalApiRoutes,
    ],
  },
  retirementTargets: serviceDeletionTargets,
  gateOnly: {
    requiresServiceDeletionNow: false,
    serviceFilesRead: true,
  },
}, null, 2));
