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

const portalApiRoutes = "services/portal/src/routes/portal-api.routes.mjs";
const inventoryPath = "docs/recovery/physical-legacy-file-retirement-inventory.md";

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

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

async function assertDeletedTargetsAbsent() {
  const stillPresent = [];
  for (const filePath of deletedTargets) {
    if (await fileExists(filePath)) stillPresent.push(filePath);
  }
  assert.deepEqual(stillPresent, [], `physical_delete_user_owned_retired_files_still_present:${stillPresent.join(",")}`);
}

function assertPortalApiDoesNotMountRetiredRoute(source) {
  for (const forbidden of [
    "createUserOwnedResourceRoutes",
    "handleRetiredUserOwnedResources",
    "user-owned-resource.routes.mjs",
    "normalizeUserComputeInstance",
    "createPortalUserOwnedResourceStore",
  ]) {
    assertNotIncludes(source, forbidden, "portal_api_must_not_reference_deleted_user_owned_surface");
  }
}

function assertInventoryRecordsStrictDelete(source) {
  assertNotIncludes(source, "keep_tombstone", "inventory_must_not_keep_user_owned_tombstone");
  assertNotIncludes(source, "archive_reference", "inventory_must_not_keep_user_owned_archive_reference");

  for (const targetPath of deletedTargets) {
    const row = source
      .split(/\r?\n/u)
      .find((line) => line.startsWith(`| \`${targetPath}\``));
    assert(row, `inventory_deleted_target_row_missing:${targetPath}`);
    assert(row.includes("| `delete` |"), `inventory_deleted_target_decision_mismatch:${targetPath}`);
    if (targetPath.includes("/routes/")) {
      assert(row.includes("| `not_started` |") || row.includes("| `deleted` |"), `inventory_route_delete_status_unexpected:${targetPath}`);
    } else {
      assert(row.includes("| `deleted` |"), `inventory_deleted_target_status_mismatch:${targetPath}`);
    }
  }
}

await assertDeletedTargetsAbsent();

const [portalApiSource, inventory] = await Promise.all([
  readRepoFile(portalApiRoutes),
  readRepoFile(inventoryPath),
]);

assertPortalApiDoesNotMountRetiredRoute(portalApiSource);
assertInventoryRecordsStrictDelete(inventory);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_physical_delete_user_owned_retired_domain_store",
  deletedTargets,
  strictPolicy: {
    publicTombstone: "delete",
  },
  inventoryPath,
}, null, 2));
