import { processQueuedPortalProductionCloudOperations } from "../domain/portal-cloud-operation-production.mjs";

export function drainPortalCloudOperationQueue(db = {}, options = {}) {
  return processQueuedPortalProductionCloudOperations(db, {
    maxOperations: 1,
    workerId: "portal-cloud-operation-worker",
    ...options,
  });
}
