import { createTencentReadonlyInventorySdkClient } from "./tencent-readonly-inventory-sdk-client.mjs";
import { assertReadonlyInventoryApiAllowlist } from "./tencent-readonly-inventory-provider.mjs";

function assertFactory(value) {
  if (typeof value !== "function") {
    throw new Error("readonly_inventory_real_sdk_factory_required");
  }
}

export function createTencentReadonlyInventoryRealSdkClient({
  sdkFactory,
  credentials,
  accountId = "",
  allowedApis = [],
  regions = [],
} = {}) {
  assertFactory(sdkFactory);
  const normalizedAllowedApis = assertReadonlyInventoryApiAllowlist(allowedApis);
  const sdk = sdkFactory({
    credentials,
    accountId,
    allowedApis: normalizedAllowedApis,
    regions,
  });
  return createTencentReadonlyInventorySdkClient({
    sdk,
    credentials,
    accountId,
    allowedApis: normalizedAllowedApis,
    regions,
  });
}
