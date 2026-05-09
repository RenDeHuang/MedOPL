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

const API_CLIENTS = Object.freeze({
  DescribeAccount: Object.freeze({ client: "account", method: "DescribeAccount" }),
  DescribeRegions: Object.freeze({ client: "region", method: "DescribeRegions" }),
  DescribeInstances: Object.freeze({ client: "cvm", method: "DescribeInstances" }),
  DescribeClusters: Object.freeze({ client: "tke", method: "DescribeClusters" }),
  ListBuckets: Object.freeze({ client: "cos", method: "ListBuckets" }),
  HeadObject: Object.freeze({ client: "cos", method: "HeadObject" }),
  DescribeBillSummary: Object.freeze({ client: "billing", method: "DescribeBillSummary" }),
  DescribeTagResources: Object.freeze({ client: "tag", method: "DescribeTagResources" }),
});

const CLIENT_API_NAMES = Object.freeze(
  Object.entries(API_CLIENTS).reduce((acc, [apiName, config]) => {
    acc[config.client] = [...(acc[config.client] || []), apiName];
    return acc;
  }, {}),
);

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

function moduleShapeError(error = {}, clientName = "unknown") {
  const factoryName = CLIENT_FACTORIES[clientName] || clientName;
  const explicitCode = String(error?.providerCode || error?.code || error?.Code || "").trim();
  const safeMessageCode = String(error?.message || "").trim().startsWith("tencent_readonly_")
    ? String(error.message).trim()
    : "";
  const providerCode = explicitCode || safeMessageCode || `tencent_readonly_sdk_client_shape_mismatch:${clientName}`;
  const normalized = Object.assign(new Error(providerCode), {
    code: providerCode,
    providerCode,
    category: error?.category || "sdk_module_shape_mismatch",
    apiName: error?.apiName || factoryName,
    clientMethod: error?.clientMethod || "clientClassFor",
    region: error?.region || "",
    resourceType: error?.resourceType || clientName,
  });
  Object.defineProperty(normalized, "message", {
    value: providerCode,
    enumerable: true,
    configurable: true,
  });
  return normalized;
}

function assertKnownAllowedApis(allowedApis = []) {
  for (const apiName of allowedApis) {
    if (!API_CLIENTS[apiName]) {
      throw new Error(`readonly_inventory_sdk_unsupported_api:${apiName}`);
    }
  }
}

function clientNamesForAllowedApis(allowedApis = []) {
  return [...new Set(allowedApis.map((apiName) => API_CLIENTS[apiName]?.client).filter(Boolean))];
}

function createLazyClients({ sdkModules, credentials, accountId, allowedApis, regions }) {
  const context = Object.freeze({
    credentials,
    accountId,
    allowedApis,
    regions,
  });
  const clients = new Map();

  function getClient(clientName) {
    if (!clients.has(clientName)) {
      try {
        clients.set(clientName, sdkModules[CLIENT_FACTORIES[clientName]](context));
      } catch (error) {
        throw moduleShapeError(error, clientName);
      }
    }
    return clients.get(clientName);
  }

  function assertClientApi(clientName, apiName) {
    try {
      const client = getClient(clientName);
      assertClientMethod(client, API_CLIENTS[apiName].method);
    } catch (error) {
      throw moduleShapeError(error, clientName);
    }
  }

  return {
    getClient,
    assertClientApi,
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
    assertKnownAllowedApis(normalizedAllowedApis);
    const clients = createLazyClients({
      sdkModules,
      credentials,
      accountId,
      allowedApis: normalizedAllowedApis,
      regions,
    });

    for (const clientName of clientNamesForAllowedApis(normalizedAllowedApis)) {
      for (const apiName of CLIENT_API_NAMES[clientName] || []) {
        if (normalizedAllowedApis.includes(apiName)) {
          clients.assertClientApi(clientName, apiName);
        }
      }
    }

    function invoke(apiName, params) {
      const config = API_CLIENTS[apiName];
      const client = clients.getClient(config.client);
      return client[config.method](params);
    }

    return Object.freeze({
      DescribeAccount(params) {
        return invoke("DescribeAccount", params);
      },
      DescribeRegions(params) {
        return invoke("DescribeRegions", params);
      },
      DescribeInstances(params) {
        return invoke("DescribeInstances", params);
      },
      DescribeClusters(params) {
        return invoke("DescribeClusters", params);
      },
      ListBuckets(params) {
        return invoke("ListBuckets", params);
      },
      HeadObject(params) {
        return invoke("HeadObject", params);
      },
      DescribeBillSummary(params) {
        return invoke("DescribeBillSummary", params);
      },
      DescribeTagResources(params) {
        return invoke("DescribeTagResources", params);
      },
    });
  };
}
