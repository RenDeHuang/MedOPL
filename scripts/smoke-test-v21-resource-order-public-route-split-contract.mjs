import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const retiredRoutePath = path.join(repoRoot, "services/portal/src/routes/resource-order.routes.mjs");
const userOwnedRoutePath = path.join(repoRoot, "services/portal/src/routes/user-owned-resource.routes.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractFunctionBlock(source, functionName) {
  const marker = `export function ${functionName}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`missing_function:${functionName}`);
  const bodyStart = source.indexOf("{", source.indexOf(")", start));
  if (bodyStart < 0) throw new Error(`invalid_function:${functionName}`);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated_function:${functionName}`);
}

function nonEmptyLineCount(text) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).length;
}

async function main() {
  const [retiredRouteSource, userOwnedRouteSource] = await Promise.all([
    readFile(retiredRoutePath, "utf8"),
    readFile(userOwnedRoutePath, "utf8"),
  ]);
  const retiredRouteBlock = extractFunctionBlock(retiredRouteSource, "createResourceOrderRoutes");
  const retiredRouteLines = nonEmptyLineCount(retiredRouteBlock);

  assert(retiredRouteSource.includes("export function createResourceOrderRoutes"), "contract_failed:missing_retired_route_factory");
  assert(retiredRouteSource.includes("retired_in_v21"), "contract_failed:resource_order_routes_not_retired");
  assert(retiredRouteSource.includes("/portal/api/platform-provisioned-resources"), "contract_failed:retired_route_missing_platform_provisioned_pointer");
  assert(retiredRouteSource.includes("/portal/api/user-owned-resources"), "contract_failed:retired_route_missing_legacy_user_owned_pointer");
  assert(retiredRouteSource.includes("/portal/api/resource-orders"), "contract_failed:retired_route_missing_resource_orders_guard");
  assert(retiredRouteSource.includes("/portal/api/my/resources"), "contract_failed:retired_route_missing_old_my_resources_guard");
  assert(retiredRouteSource.includes("/portal/internal/resource-orders"), "contract_failed:retired_route_missing_internal_resource_orders_guard");
  assert(retiredRouteLines <= 45, `contract_failed:retired_resource_order_route_too_large:${retiredRouteLines}`);

  assert(userOwnedRouteSource.includes("export function createUserOwnedResourceRoutes"), "contract_failed:missing_user_owned_route_factory");
  for (const routePath of [
    "/portal/api/platform-provisioned-resources",
    "/portal/api/platform-provisioned-resources/compute-instances",
    "/portal/api/platform-provisioned-resources/storage-buckets",
    "/portal/api/platform-provisioned-resources/bind",
    "/portal/api/platform-provisioned-resources/unbind",
    "/portal/api/platform-provisioned-resources/protection-freezes",
    "/portal/api/platform-provisioned-resources/protection-freezes/ensure",
  ]) {
    assert(userOwnedRouteSource.includes(routePath), `contract_failed:platform_provisioned_route_missing:${routePath}`);
  }
  for (const routePath of [
    "/portal/api/user-owned-resources",
    "/portal/api/user-owned-resources/compute-instances",
    "/portal/api/user-owned-resources/storage-buckets",
    "/portal/api/user-owned-resources/bind",
    "/portal/api/user-owned-resources/unbind",
    "/portal/api/user-owned-resources/protection-freezes",
    "/portal/api/user-owned-resources/protection-freezes/ensure",
  ]) {
    assert(userOwnedRouteSource.includes(routePath), `contract_failed:user_owned_route_missing:${routePath}`);
  }

  for (const forbidden of [
    "delete-node-pool",
    "deleteNodePool",
    "nodePoolId",
    "resourceProvisionerClient",
    "scaleToZero",
    "tke_node_pool_create",
    "/portal/api/resource-orders/provision",
    "/portal/api/cloud/resources",
  ]) {
    assert(!userOwnedRouteSource.includes(forbidden), `contract_failed:user_owned_route_still_embeds_retired_stack:${forbidden}`);
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "v21_resource_order_public_route_split",
    retiredRouteNonEmptyLines: retiredRouteLines,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error.message || error) }, null, 2));
  process.exit(1);
});
