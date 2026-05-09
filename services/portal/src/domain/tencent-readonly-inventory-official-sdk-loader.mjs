const SERVICE_CONFIGS = Object.freeze({
  account: Object.freeze({
    service: "sts",
    version: "v20180813",
    endpoint: "sts.intl.tencentcloudapi.com",
    method: "GetCallerIdentity",
  }),
  region: Object.freeze({
    service: "cvm",
    version: "v20170312",
    endpoint: "cvm.tencentcloudapi.com",
    method: "DescribeRegions",
  }),
  cvm: Object.freeze({
    service: "cvm",
    version: "v20170312",
    endpoint: "cvm.tencentcloudapi.com",
    method: "DescribeInstances",
  }),
  tke: Object.freeze({
    service: "tke",
    version: "v20180525",
    endpoint: "tke.tencentcloudapi.com",
    method: "DescribeClusters",
  }),
  cosList: Object.freeze({
    service: "cos",
    version: "v20180530",
    endpoint: "cos.tencentcloudapi.com",
    method: "ListBuckets",
  }),
  cosHead: Object.freeze({
    service: "cos",
    version: "v20180530",
    endpoint: "cos.tencentcloudapi.com",
    method: "HeadObject",
  }),
  billing: Object.freeze({
    service: "billing",
    version: "v20180709",
    endpoint: "billing.tencentcloudapi.com",
    method: "DescribeBillSummary",
  }),
  tag: Object.freeze({
    service: "tag",
    version: "v20180813",
    endpoint: "tag.tencentcloudapi.com",
    method: "DescribeTagResources",
  }),
});

function text(value = "") {
  return String(value ?? "").trim();
}

function moduleRoot(value = {}) {
  return value?.default && typeof value.default === "object" ? value.default : value;
}

function assertSdkPackage(sdkPackage) {
  if (!sdkPackage || typeof sdkPackage !== "object") {
    throw new Error("tencent_readonly_official_sdk_package_required");
  }
}

function clientClassFor(sdkPackage, config) {
  const root = moduleRoot(sdkPackage);
  const Client = root?.[config.service]?.[config.version]?.Client;
  if (typeof Client !== "function") {
    throw new Error(`tencent_readonly_official_sdk_client_class_required:${config.service}.${config.version}`);
  }
  return Client;
}

function credentialConfig(credentials = {}) {
  const secretId = text(credentials.SecretId || credentials.secretId);
  const secretKey = text(credentials.SecretKey || credentials.secretKey);
  if (!secretId || !secretKey) {
    throw new Error("tencent_readonly_official_sdk_credentials_required");
  }
  const credential = {
    secretId,
    secretKey,
  };
  const token = text(credentials.token || credentials.Token);
  if (token) {
    credential.token = token;
  }
  return credential;
}

function createRawClient({ sdkPackage, config, context = {}, region = "" }) {
  const Client = clientClassFor(sdkPackage, config);
  return new Client({
    credential: credentialConfig(context.credentials || {}),
    region: text(region || context.regions?.[0]),
    profile: {
      httpProfile: {
        endpoint: config.endpoint,
      },
    },
  });
}

function readonlyMethod(rawClient, methodName) {
  if (!rawClient || typeof rawClient[methodName] !== "function") {
    throw new Error(`tencent_readonly_official_sdk_method_required:${methodName}`);
  }
  return (params) => rawClient[methodName](params);
}

function createReadonlyClient({ sdkPackage, context, config, exposedMethod }) {
  const rawClient = createRawClient({ sdkPackage, config, context });
  const invoke = readonlyMethod(rawClient, config.method);
  return Object.freeze({
    [exposedMethod](params) {
      return invoke(params);
    },
  });
}

function createCosReadonlyClient({ sdkPackage, context }) {
  const rawClient = createRawClient({
    sdkPackage,
    config: SERVICE_CONFIGS.cosList,
    context,
  });
  const listBuckets = readonlyMethod(rawClient, SERVICE_CONFIGS.cosList.method);
  const headObject = readonlyMethod(rawClient, SERVICE_CONFIGS.cosHead.method);
  return Object.freeze({
    ListBuckets(params) {
      return listBuckets(params);
    },
    HeadObject(params) {
      return headObject(params);
    },
  });
}

export async function loadTencentReadonlyInventoryOfficialSdkPackage({
  importPackage = (specifier) => import(specifier),
} = {}) {
  try {
    return moduleRoot(await importPackage("tencentcloud-sdk-nodejs"));
  } catch {
    throw new Error("tencent_readonly_official_sdk_package_required");
  }
}

export function createTencentReadonlyInventoryOfficialSdkModulesFromPackage({ sdkPackage } = {}) {
  assertSdkPackage(sdkPackage);
  return Object.freeze({
    createAccountClient(context = {}) {
      return createReadonlyClient({
        sdkPackage,
        context,
        config: SERVICE_CONFIGS.account,
        exposedMethod: "GetCallerIdentity",
      });
    },
    createRegionClient(context = {}) {
      return createReadonlyClient({
        sdkPackage,
        context,
        config: SERVICE_CONFIGS.region,
        exposedMethod: "DescribeRegions",
      });
    },
    createCvmClient(context = {}) {
      return createReadonlyClient({
        sdkPackage,
        context,
        config: SERVICE_CONFIGS.cvm,
        exposedMethod: "DescribeInstances",
      });
    },
    createTkeClient(context = {}) {
      return createReadonlyClient({
        sdkPackage,
        context,
        config: SERVICE_CONFIGS.tke,
        exposedMethod: "DescribeClusters",
      });
    },
    createCosClient(context = {}) {
      return createCosReadonlyClient({ sdkPackage, context });
    },
    createBillingClient(context = {}) {
      return createReadonlyClient({
        sdkPackage,
        context,
        config: SERVICE_CONFIGS.billing,
        exposedMethod: "DescribeBillSummary",
      });
    },
    createTagClient(context = {}) {
      return createReadonlyClient({
        sdkPackage,
        context,
        config: SERVICE_CONFIGS.tag,
        exposedMethod: "DescribeTagResources",
      });
    },
  });
}
