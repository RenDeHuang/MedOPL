const CLIENT_FACTORIES = Object.freeze({
  account: "createAccountClient",
  region: "createRegionClient",
  cvm: "createCvmClient",
  tke: "createTkeClient",
  cos: "createCosClient",
  billing: "createBillingClient",
  tag: "createTagClient",
});

const READONLY_METHODS = Object.freeze({
  DescribeAccount: ["DescribeAccount", "describeAccount", "GetCallerIdentity", "getCallerIdentity"],
  DescribeRegions: ["DescribeRegions", "describeRegions"],
  DescribeInstances: ["DescribeInstances", "describeInstances"],
  DescribeClusters: ["DescribeClusters", "describeClusters"],
  ListBuckets: ["ListBuckets", "listBuckets"],
  HeadObject: ["HeadObject", "headObject"],
  DescribeBillSummary: ["DescribeBillSummary", "describeBillSummary"],
  DescribeTagResources: ["DescribeTagResources", "describeTagResources"],
});

function assertOfficialSdkModules(officialSdkModules) {
  if (!officialSdkModules || typeof officialSdkModules !== "object") {
    throw new Error("tencent_readonly_official_sdk_modules_required");
  }
  for (const factoryName of Object.values(CLIENT_FACTORIES)) {
    if (typeof officialSdkModules[factoryName] !== "function") {
      throw new Error(`tencent_readonly_official_sdk_module_factory_required:${factoryName}`);
    }
  }
}

function assertClient(value, factoryName) {
  if (!value || typeof value !== "object") {
    throw new Error(`tencent_readonly_official_sdk_client_required:${factoryName}`);
  }
}

function resolveReadonlyMethod(client, candidates, apiName) {
  for (const methodName of candidates) {
    if (typeof client[methodName] === "function") {
      return (params) => client[methodName](params);
    }
  }
  throw new Error(`tencent_readonly_official_sdk_client_method_required:${apiName}`);
}

function createOfficialClient(officialSdkModules, factoryName, context) {
  const client = officialSdkModules[factoryName](context);
  assertClient(client, factoryName);
  return client;
}

function createSingleMethodClient({ officialSdkModules, factoryName, context, exposedApiName }) {
  const client = createOfficialClient(officialSdkModules, factoryName, context);
  const invoke = resolveReadonlyMethod(client, READONLY_METHODS[exposedApiName], exposedApiName);
  return Object.freeze({
    [exposedApiName](params) {
      return invoke(params);
    },
  });
}

function createCosClient({ officialSdkModules, context }) {
  const client = createOfficialClient(officialSdkModules, CLIENT_FACTORIES.cos, context);
  const listBuckets = resolveReadonlyMethod(client, READONLY_METHODS.ListBuckets, "ListBuckets");
  const headObject = resolveReadonlyMethod(client, READONLY_METHODS.HeadObject, "HeadObject");
  return Object.freeze({
    ListBuckets(params) {
      return listBuckets(params);
    },
    HeadObject(params) {
      return headObject(params);
    },
  });
}

export function createTencentReadonlyInventoryOfficialSdkModules({ officialSdkModules } = {}) {
  assertOfficialSdkModules(officialSdkModules);
  return Object.freeze({
    createAccountClient(context = {}) {
      return createSingleMethodClient({
        officialSdkModules,
        factoryName: CLIENT_FACTORIES.account,
        context,
        exposedApiName: "DescribeAccount",
      });
    },
    createRegionClient(context = {}) {
      return createSingleMethodClient({
        officialSdkModules,
        factoryName: CLIENT_FACTORIES.region,
        context,
        exposedApiName: "DescribeRegions",
      });
    },
    createCvmClient(context = {}) {
      return createSingleMethodClient({
        officialSdkModules,
        factoryName: CLIENT_FACTORIES.cvm,
        context,
        exposedApiName: "DescribeInstances",
      });
    },
    createTkeClient(context = {}) {
      return createSingleMethodClient({
        officialSdkModules,
        factoryName: CLIENT_FACTORIES.tke,
        context,
        exposedApiName: "DescribeClusters",
      });
    },
    createCosClient(context = {}) {
      return createCosClient({ officialSdkModules, context });
    },
    createBillingClient(context = {}) {
      return createSingleMethodClient({
        officialSdkModules,
        factoryName: CLIENT_FACTORIES.billing,
        context,
        exposedApiName: "DescribeBillSummary",
      });
    },
    createTagClient(context = {}) {
      return createSingleMethodClient({
        officialSdkModules,
        factoryName: CLIENT_FACTORIES.tag,
        context,
        exposedApiName: "DescribeTagResources",
      });
    },
  });
}
