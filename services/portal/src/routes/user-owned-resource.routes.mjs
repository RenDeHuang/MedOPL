import { createLegacyUserOwnedResourceRoutes } from "./platform-provisioned-resource.routes.mjs";

export function createUserOwnedResourceRoutes(options = {}) {
  return createLegacyUserOwnedResourceRoutes(options);
}

export { createLegacyUserOwnedResourceRoutes };
