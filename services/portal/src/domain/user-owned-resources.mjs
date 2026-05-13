export const USER_OWNED_RESOURCES_RETIRED = true;

function retiredUserOwnedResourcesError() {
  const error = new Error("legacy_user_owned_resources_retired");
  error.code = "legacy_user_owned_resources_retired";
  error.status = 410;
  return error;
}

export function normalizeUserComputeInstance() {
  throw retiredUserOwnedResourcesError();
}

export function normalizeUserStorageBucket() {
  throw retiredUserOwnedResourcesError();
}
