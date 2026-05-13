const RETIRED_USER_OWNED_RESOURCE_PATHS = new Set([
  "/portal/api/user-owned-resources",
  "/portal/api/user-owned-resources/compute-instances",
  "/portal/api/user-owned-resources/storage-buckets",
  "/portal/api/user-owned-resources/compute-instances/delete",
  "/portal/api/user-owned-resources/storage-buckets/delete",
  "/portal/api/user-owned-resources/bind",
  "/portal/api/user-owned-resources/unbind",
  "/portal/api/user-owned-resources/protection-freezes",
  "/portal/api/user-owned-resources/protection-freezes/ensure",
]);

function methodAllowed(method = "") {
  return ["GET", "POST", "DELETE"].includes(String(method || "").toUpperCase());
}

export function createUserOwnedResourceRoutes({ sendJson } = {}) {
  return async function handleRetiredUserOwnedResourceRoutes({ req, res, url }) {
    if (!RETIRED_USER_OWNED_RESOURCE_PATHS.has(String(url?.pathname || ""))) return false;
    if (!methodAllowed(req?.method)) return false;
    sendJson(res, {
      ok: false,
      error: "legacy_user_owned_resources_retired",
      mode: "retired",
      retiredIn: "v22",
      replacement: "/portal/api/platform-provisioned-resources",
    }, 410);
    return true;
  };
}
