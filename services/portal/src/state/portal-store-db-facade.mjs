import { createPortalStoreDbAuth } from "./portal-store-db-auth.mjs";
import { createPortalStoreDbCore } from "./portal-store-db-core.mjs";
import { createPortalStoreDbDelegates } from "./portal-store-db-delegates.mjs";
import { createPortalStoreDbEvents } from "./portal-store-db-events.mjs";

export function createPortalStoreDbFacade(deps) {
  const core = createPortalStoreDbCore(deps);
  const auth = createPortalStoreDbAuth({
    ...deps,
    readJsonDb: core.readJsonDb,
    writeDb: core.writeDb,
  });
  const events = createPortalStoreDbEvents(deps);
  const delegates = createPortalStoreDbDelegates({
    ...deps,
    mutateJsonDb: core.mutateJsonDb,
    writeDb: core.writeDb,
  });

  core.writeDb.topupWallet = delegates.topupWallet;
  core.writeDb.refundWallet = delegates.refundWallet;
  core.writeDb.makeupChargeWallet = delegates.makeupChargeWallet;
  core.writeDb.persistPortalSessions = auth.persistPortalSessions;
  if (deps.storageMode() === "postgres_redis") {
    core.writeDb.upsertStorageOrder = delegates.upsertStorageOrder;
    core.writeDb.upsertTaskSpace = delegates.upsertTaskSpace;
    core.writeDb.upsertWorkspaceFile = delegates.upsertWorkspaceFile;
    core.writeDb.persistLabBillingState = delegates.persistLabBillingState;
  }

  return {
    ...events,
    ...auth,
    ...delegates,
    readDb: core.readDb,
    writeDb: core.writeDb,
  };
}
