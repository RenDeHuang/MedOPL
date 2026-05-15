import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const deletedTargets = [
  "services/portal/src/domain/user-owned-resources.mjs",
  "services/portal/src/state/portal-user-owned-resource-store.mjs",
  "services/portal/src/routes/user-owned-resource.routes.mjs",
];

const checkedFiles = {
  repoZoning: "docs/recovery/repo-zoning.md",
  legacyBacklog: "docs/recovery/legacy-cleanup-backlog.md",
  statusMatrix: "docs/recovery/status-matrix.md",
  inventory: "docs/recovery/physical-legacy-file-retirement-inventory.md",
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  readme: "README.md",
  product: "docs/product.md",
  architecture: "docs/architecture.md",
  productCompose: "compose.product.yaml",
  defaultEntryGate: "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  portalConfig: "services/portal/src/config/portal-config.mjs",
  platformProvisionedDomain: "services/portal/src/domain/platform-provisioned-resources.mjs",
  platformProvisionedRoutes: "services/portal/src/routes/platform-provisioned-resource.routes.mjs",
  platformProvisionedStore: "services/portal/src/state/portal-platform-provisioned-resource-store.mjs",
  portalApiRoutes: "services/portal/src/routes/portal-api.routes.mjs",
  adminApiRoutes: "services/portal/src/routes/admin-api.routes.mjs",
  adminApiPayloads: "services/portal/src/app/portal-admin-api-payloads.mjs",
  adminPortraitPayloads: "services/portal/src/app/portal-admin-portrait-payloads.mjs",
  adminOverviewRuntimePayloads: "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs",
};

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

async function fileExists(filePath) {
  try {
    await access(path.join(repoRoot, filePath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
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

async function assertDeletedTargetsAbsent() {
  const stillPresent = [];
  for (const targetPath of deletedTargets) {
    if (await fileExists(targetPath)) stillPresent.push(targetPath);
  }
  assert.deepEqual(stillPresent, [], `user_owned_deleted_targets_still_present:${stillPresent.join(",")}`);
}

function assertStrictPolicyDocs({ repoZoning, legacyBacklog, statusMatrix, inventory, gapMatrix }) {
  assertIncludes(gapMatrix, "`user-owned` 不是主线", "gap_matrix_user_owned_retired_gap");
  assertIncludes(
    gapMatrix,
    "后续 feature leaf 碰到过时模块、接口、测试或兼容面时，必须同 leaf 清理退役，或拆出 cleanup leaf 后再继续",
    "gap_matrix_continuous_cleanup_rule",
  );

  for (const [label, source] of Object.entries({ repoZoning, legacyBacklog, statusMatrix, inventory })) {
    assertNotIncludes(source, "keep_tombstone", `${label}_strict_cleanup_must_not_keep_tombstone`);
    assertNotIncludes(source, "archive_reference", `${label}_strict_cleanup_must_not_archive_reference`);
  }

  assertIncludes(repoZoning, "| `services/portal/src/routes/user-owned-resource.routes.mjs` | Zone 2 | delete |", "repo_zoning_user_owned_route_delete");
  assertIncludes(legacyBacklog, "old public tombstone => delete", "legacy_backlog_public_tombstone_delete_policy");
  assertIncludes(statusMatrix, "public tombstone routes 必须删除", "status_matrix_public_tombstone_delete_policy");

  const routeRow = inventory
    .split(/\r?\n/u)
    .find((line) => line.startsWith("| `services/portal/src/routes/user-owned-resource.routes.mjs`"));
  assert(routeRow, "inventory_user_owned_route_row_missing");
  assert(routeRow.includes("| `delete` |"), "inventory_user_owned_route_decision_must_be_delete");
}

function assertPortalRegistrationDeleted({ portalApiRoutes }) {
  for (const forbidden of [
    "user-owned-resource.routes.mjs",
    "createUserOwnedResourceRoutes",
    "handleRetiredUserOwnedResources",
    "/portal/api/user-owned-resources",
  ]) {
    assertNotIncludes(portalApiRoutes, forbidden, "portal_api_user_owned_registration");
  }
}

function assertPlatformProvisionedDoesNotServeLegacyUserOwned(source, label) {
  for (const forbidden of [
    "LEGACY_USER_OWNED_RESOURCE_PATHS",
    "createLegacyUserOwnedResourceRoutes",
    "/portal/api/user-owned-resources",
    "user_owned:",
  ]) {
    assertNotIncludes(source, forbidden, `${label}_legacy_user_owned_surface`);
  }
}

function assertPlatformProvisionedLifecycleFailClosed(source, label) {
  assertIncludes(source, "unsupported_resource_lifecycle_mode", `${label}_must_fail_closed_unknown_lifecycle_mode`);
}

function assertNoDefaultUserOwnedCopy(source, label) {
  const forbidden = [
    /默认\s+user-owned\s+模式/u,
    /默认\s+`?user_owned`?\s+模式/u,
    /user_owned_storage/u,
    /legacy_user_owned_lifecycle_mode_retired/u,
  ];
  for (const pattern of forbidden) {
    const match = pattern.exec(source);
    assert.equal(match, null, `${label}_must_not_expose_default_user_owned_copy:line_${match ? lineOf(source, match.index) : "unknown"}`);
  }
}

const sources = Object.fromEntries(await Promise.all(
  Object.entries(checkedFiles).map(async ([key, filePath]) => [key, await readRepoFile(filePath)]),
));

await assertDeletedTargetsAbsent();
assertStrictPolicyDocs(sources);

for (const [label, source] of Object.entries({
  readme: sources.readme,
  product: sources.product,
  architecture: sources.architecture,
})) {
  assertNoUserOwnedPrimaryDefault(source, label);
}

assertComposeDoesNotUseUserOwnedDefault(sources.productCompose);
assertIncludes(sources.defaultEntryGate, "user_owned_primary_runtime_mode", "default_entry_gate_user_owned_retired_default");
assertNoUserOwnedPrimaryDefault(sources.portalConfig, "portal_config");
assertIncludes(
  sources.portalConfig,
  'PRODUCT_RUNTIME_MODE = String(process.env.PRODUCT_RUNTIME_MODE || "platform_provisioned")',
  "portal_config_runtime_mode_must_default_platform_provisioned",
);
assertPlatformProvisionedDoesNotServeLegacyUserOwned(sources.platformProvisionedDomain, "platform_provisioned_domain");
assertPlatformProvisionedDoesNotServeLegacyUserOwned(sources.platformProvisionedRoutes, "platform_provisioned_routes");
assertPlatformProvisionedDoesNotServeLegacyUserOwned(sources.platformProvisionedStore, "platform_provisioned_store");
assertPlatformProvisionedLifecycleFailClosed(sources.platformProvisionedDomain, "platform_provisioned_domain");
assertPlatformProvisionedLifecycleFailClosed(sources.platformProvisionedStore, "platform_provisioned_store");
assertPortalRegistrationDeleted(sources);
assertNoDefaultUserOwnedCopy(sources.adminApiRoutes, "admin_api_routes");
assertNoDefaultUserOwnedCopy(sources.adminApiPayloads, "admin_api_payloads");
assertNoDefaultUserOwnedCopy(sources.adminPortraitPayloads, "admin_portrait_payloads");
assertNoDefaultUserOwnedCopy(sources.adminOverviewRuntimePayloads, "admin_overview_runtime_payloads");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_retire_user_owned_primary_path",
  checked: checkedFiles,
  deletedTargets,
  strictPolicy: {
    publicTombstone: "delete",
    compatAlias: "delete",
  },
}, null, 2));
