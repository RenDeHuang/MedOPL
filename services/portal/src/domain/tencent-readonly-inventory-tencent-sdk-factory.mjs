import { assertReadonlyInventoryApiAllowlist } from "./tencent-readonly-inventory-provider.mjs";

const CLIENT_FACTORIES = Object.freeze({
  account: "createAccountClient",
  region: "createRegionClient",
  cvm: "createCvmClient",
  tke: "createTkeClient",
  cos: "createCosClient",
  billing: "createBillingClient",
  tag: "createTagClient",
});

function assertSdkModules(sdkModules) {
  if (!sdkModules || typeof sdkModules !== "object") {
    throw new Error("tencent_readonly_sdk_modules_required");
  }
  for (const factoryName of Object.values(CLIENT_FACTORIES)) {
    if (typeof sdkModules[factoryName] !== "function") {
      throw new Error(`tencent_readonly_sdk_module_factory_required:${factoryName}`);
    }
  }
}

function assertClientMethod(client, methodName) {
  if (!client || typeof client[methodName] !== "function") {
    throw new Error(`tencent_readonly_sdk_client_method_required:${methodName}`);
  }
}

function createClients({ sdkModules, credentials, accountId, allowedApis, regions }) {
  const context = Object.freeze({
    credentials,
    accountId,
    allowedApis,
    regions,
  });
  return {
    account: sdkModules.createAccountClient(context),
    region: sdkModules.createRegionClient(context),
    cvm: sdkModules.createCvmClient(context),
    tke: sdkModules.createTkeClient(context),
    cos: sdkModules.createCosClient(context),
    billing: sdkModules.createBillingClient(context),
    tag: sdkModules.createTagClient(context),
  };
}

export function createTencentReadonlyInventoryTencentSdkFactory({ sdkModules } = {}) {
  assertSdkModules(sdkModules);
  return function tencentReadonlyInventorySdkFactory({
    credentials,
    accountId = "",
    allowedApis = [],
    regions = [],
  } = {}) {
    const normalizedAllowedApis = assertReadonlyInventoryApiAllowlist(allowedApis);
    const clients = createClients({
      sdkModules,
      credentials,
      accountId,
      allowedApis: normalizedAllowedApis,
      regions,
    });

    assertClientMethod(clients.account, "DescribeAccount");
    assertClientMethod(clients.region, "DescribeRegions");
    assertClientMethod(clients.cvm, "DescribeInstances");
    assertClientMethod(clients.tke, "DescribeClusters");
    assertClientMethod(clients.cos, "ListBuckets");
    assertClientMethod(clients.cos, "HeadObject");
    assertClientMethod(clients.billing, "DescribeBillSummary");
    assertClientMethod(clients.tag, "DescribeTagResources");

    return Object.freeze({
      DescribeAccount(params) {
        return clients.account.DescribeAccount(params);
      },
      DescribeRegions(params) {
        return clients.region.DescribeRegions(params);
      },
      DescribeInstances(params) {
        return clients.cvm.DescribeInstances(params);
      },
      DescribeClusters(params) {
        return clients.tke.DescribeClusters(params);
      },
      ListBuckets(params) {
        return clients.cos.ListBuckets(params);
      },
      HeadObject(params) {
        return clients.cos.HeadObject(params);
      },
      DescribeBillSummary(params) {
        return clients.billing.DescribeBillSummary(params);
      },
      DescribeTagResources(params) {
        return clients.tag.DescribeTagResources(params);
      },
    });
  };
}
