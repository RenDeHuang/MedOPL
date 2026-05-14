import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const deletedTargets = [
  "services/portal/src/domain/user-owned-resources.mjs",
  "services/portal/src/state/portal-user-owned-resource-store.mjs",
];

const keptTombstoneRoute = "services/portal/src/routes/user-owned-resource.routes.mjs";
const portalApiRoutes = "services/portal/src/routes/portal-api.routes.mjs";
const inventoryPath = "docs/recovery/physical-legacy-file-retirement-inventory.md";

async function fileExists(filePath) {
  try {
    await access(path.join(repoRoot, filePath));
    return true;
  } catch {
    return false;
  }
}

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

async function importRepoModule(filePath) {
  const href = pathToFileURL(path.join(repoRoot, filePath)).href;
  return import(`${href}?physical_delete_user_owned=${Date.now()}_${Math.random()}`);
}

async function assertDeletedTargetsAbsent() {
  const stillPresent = [];
  for (const filePath of deletedTargets) {
    if (await fileExists(filePath)) stillPresent.push(filePath);
  }
  assert.deepEqual(stillPresent, [], `physical_delete_user_owned_retired_files_still_present:${stillPresent.join(",")}`);
}

function assertPortalApiUsesRouteTombstone(source) {
  assertIncludes(source, "createUserOwnedResourceRoutes", "portal_api_user_owned_route_tombstone_mount");
  assertIncludes(source, "handleRetiredUserOwnedResources", "portal_api_user_owned_route_retired_handler_name");
  for (const deletedTarget of deletedTargets) {
    assertNotIncludes(source, deletedTarget, "portal_api_must_not_reference_deleted_user_owned_file");
  }
  assertNotIncludes(source, "normalizeUserComputeInstance", "portal_api_must_not_reference_deleted_domain_export");
  assertNotIncludes(source, "createPortalUserOwnedResourceStore", "portal_api_must_not_reference_deleted_store_export");
}

function assertRouteTombstoneSource(source) {
  assertIncludes(source, "createUserOwnedResourceRoutes", "route_tombstone_create_function");
  assertIncludes(source, "legacy_user_owned_resources_retired", "route_tombstone_retired_error");
  assertIncludes(source, "replacement: \"/portal/api/platform-provisioned-resources\"", "route_tombstone_replacement");
  assert.match(source, /\b410\b/u, "route_tombstone_must_return_410");
  assertNotIncludes(source, "../domain/user-owned-resources.mjs", "route_must_not_import_deleted_domain");
  assertNotIncludes(source, "../state/portal-user-owned-resource-store.mjs", "route_must_not_import_deleted_store");
  assertNotIncludes(source, "normalizeUserComputeInstance", "route_must_not_reference_deleted_domain_export");
  assertNotIncludes(source, "createPortalUserOwnedResourceStore", "route_must_not_reference_deleted_store_export");
}

async function assertRouteRuntimeTombstone() {
  const { createUserOwnedResourceRoutes } = await importRepoModule(keptTombstoneRoute);
  assert.equal(typeof createUserOwnedResourceRoutes, "function", "route_tombstone_export_create_function");

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
  });

  assert.equal(handled, true, "route_tombstone_must_handle_old_path");
  assert.equal(response.statusCode, 410, "route_tombstone_must_return_http_410");
  assert.equal(response.payload?.error, "legacy_user_owned_resources_retired", "route_tombstone_error_mismatch");
  assert.equal(response.payload?.replacement, "/portal/api/platform-provisioned-resources", "route_tombstone_replacement_mismatch");
}

function assertInventoryRecordsSliceCompletion(source) {
  assertIncludes(source, "inventory_status: first_delete_slice_applied", "inventory_status_first_delete_slice");
  assertIncludes(source, "physical_delete_status values: `not_started`, `deleted`, `kept_tombstone`, `archive_reference`, `migrated`, `blocked_without_auth`, `transferred_to_schema_drop_leaf`", "inventory_physical_delete_status_taxonomy");
  for (const targetPath of deletedTargets) {
    const row = source
      .split(/\r?\n/u)
      .find((line) => line.startsWith(`| \`${targetPath}\``));
    assert(row, `inventory_deleted_target_row_missing:${targetPath}`);
    assert(row.includes("| `delete` |"), `inventory_deleted_target_decision_mismatch:${targetPath}`);
    assert(row.includes("| `deleted` |"), `inventory_deleted_target_status_mismatch:${targetPath}`);
    assert(row.includes("scripts/smoke-test-v22-physical-delete-user-owned-retired-domain-store.mjs"), `inventory_deleted_target_gate_missing:${targetPath}`);
    assert(row.includes("cleanup/v22-physical-legacy-goal"), `inventory_deleted_target_branch_missing:${targetPath}`);
  }
}

await assertDeletedTargetsAbsent();

const [routeSource, portalApiSource, inventory] = await Promise.all([
  readRepoFile(keptTombstoneRoute),
  readRepoFile(portalApiRoutes),
  readRepoFile(inventoryPath),
]);

assertRouteTombstoneSource(routeSource);
assertPortalApiUsesRouteTombstone(portalApiSource);
assertInventoryRecordsSliceCompletion(inventory);
await assertRouteRuntimeTombstone();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_physical_delete_user_owned_retired_domain_store",
  deletedTargets,
  keptTombstoneRoute,
  inventoryPath,
}, null, 2));
