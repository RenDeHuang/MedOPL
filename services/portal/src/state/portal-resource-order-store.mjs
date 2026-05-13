export const RESOURCE_ORDER_STORE_RETIRED_ERROR = "portal_resource_order_store_retired";

function retiredResourceOrderStoreOperation(operation) {
  const error = new Error(RESOURCE_ORDER_STORE_RETIRED_ERROR);
  error.code = RESOURCE_ORDER_STORE_RETIRED_ERROR;
  error.operation = operation;
  return Promise.reject(error);
}

export function createPortalResourceOrderStore() {
  return {
    appendResourceOrderEvent: () => retiredResourceOrderStoreOperation("appendResourceOrderEvent"),
    persistResourceOrderState: () => retiredResourceOrderStoreOperation("persistResourceOrderState"),
    upsertResourceOrder: () => retiredResourceOrderStoreOperation("upsertResourceOrder"),
  };
}
