export function createPortalStoreDbDelegates({
  ensureStorageInfra,
  getAccountingStore,
  getLabBillingStore,
  getWorkspaceStore,
  storageMode,
}) {
  const RESOURCE_ORDER_STATE_RETIRED_ERROR = "portal_resource_order_state_retired";

  function retiredResourceOrderStateOperation() {
    const error = new Error(RESOURCE_ORDER_STATE_RETIRED_ERROR);
    error.code = RESOURCE_ORDER_STATE_RETIRED_ERROR;
    return Promise.reject(error);
  }

  async function topupWallet(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      throw new Error("portal_accounting_store_unavailable_for_storage_mode");
    }
    return getAccountingStore().topupWallet(params);
  }

  async function refundWallet(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      throw new Error("portal_accounting_store_unavailable_for_storage_mode");
    }
    return getAccountingStore().refundWallet(params);
  }

  async function makeupChargeWallet(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      throw new Error("portal_accounting_store_unavailable_for_storage_mode");
    }
    return getAccountingStore().makeupChargeWallet(params);
  }

  async function upsertWorkspaceFile(params) {
    await ensureStorageInfra();
    return getWorkspaceStore().upsertWorkspaceFile(params);
  }

  async function upsertStorageOrder(params) {
    await ensureStorageInfra();
    return getWorkspaceStore().upsertStorageOrder(params);
  }

  async function upsertTaskSpace(params) {
    await ensureStorageInfra();
    return getWorkspaceStore().upsertTaskSpace(params);
  }

  async function persistResourceOrderState(params) {
    await ensureStorageInfra();
    return retiredResourceOrderStateOperation();
  }

  async function persistLabBillingState(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      throw new Error("portal_lab_billing_store_unavailable_for_storage_mode");
    }
    return getLabBillingStore().persistLabBillingState(params);
  }

  return {
    makeupChargeWallet,
    persistLabBillingState,
    persistResourceOrderState,
    refundWallet,
    topupWallet,
    upsertStorageOrder,
    upsertTaskSpace,
    upsertWorkspaceFile,
  };
}
