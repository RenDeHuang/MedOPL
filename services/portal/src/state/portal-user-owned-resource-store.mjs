export const USER_OWNED_RESOURCE_STORE_RETIRED = true;

export function createPortalUserOwnedResourceStore() {
  const error = new Error("legacy_user_owned_resource_store_retired");
  error.code = "legacy_user_owned_resource_store_retired";
  error.status = 410;
  throw error;
}
