import { ensureUserCommercialState } from "../domain/commercial-state.mjs";
import { hashPassword } from "../domain/portal-auth.mjs";
import { normalizeAnnouncementRecord } from "../domain/portal-presenters.mjs";
import { ensureLabSubscriptionCollections } from "../domain/lab-subscriptions.mjs";
import { normalizeServerPlanSelection } from "../domain/server-plans.mjs";
import { appendLedgerEntry, ensureWallet, normalizeLedgerEntries } from "../domain/wallet-ledger.mjs";
import { ensureWorkspaceStorageCollections } from "../domain/workspace-storage.mjs";
import { createPortalStore } from "../state/portal-store.mjs";

export function createPortalRuntimeStore({
  atomicWriteJson,
  exists,
  getTaskPath,
  sanitizeTaskTitle,
}) {
  return createPortalStore({
    atomicWriteJson,
    appendLedgerEntry,
    ensureWallet,
    exists,
    hashPassword,
    normalizeAnnouncementRecord,
    normalizeLedgerEntries,
    normalizeServerPlanSelection,
    ensureLabSubscriptionCollections,
    ensureUserCommercialState,
    ensureWorkspaceStorageCollections,
    sanitizeTaskTitle,
    getTaskPath,
  });
}
