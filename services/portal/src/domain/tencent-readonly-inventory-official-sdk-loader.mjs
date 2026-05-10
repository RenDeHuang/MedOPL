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
    method: "GetResources",
  }),
});

function text(value = "") {
  return String(value ?? "").trim();
}

function moduleRoot(value = {}) {
  return value?.default && (typeof value.default === "object" || typeof value.default === "function") ? value.default : value;
}

function assertSdkPackage(sdkPackage) {
  const tencentcloudSdkPackage = tencentcloudSdkPackageFor(sdkPackage);
  if (!tencentcloudSdkPackage || typeof tencentcloudSdkPackage !== "object") {
    throw new Error("tencent_readonly_official_sdk_package_required");
  }
}

function tencentcloudSdkPackageFor(sdkPackage) {
  return moduleRoot(sdkPackage?.tencentcloudSdkPackage || sdkPackage);
}

function cosSdkPackageFor(sdkPackage) {
  const root = moduleRoot(sdkPackage?.cosSdkPackage);
  if (typeof root !== "function") {
    const error = new Error("tencent_readonly_official_cos_sdk_package_required");
    error.code = "tencent_readonly_official_cos_sdk_package_required";
    error.category = "sdk_module_shape_mismatch";
    error.apiName = "createCosClient";
    error.clientMethod = "cosSdkPackageFor";
    error.resourceType = "cos";
    throw error;
  }
  return root;
}

function clientClassFor(sdkPackage, config) {
  const root = tencentcloudSdkPackageFor(sdkPackage);
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

function numericCursor(value = "") {
  const normalized = text(value);
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function monthString(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function offsetNextCursor(response = {}, offset = 0, limit = 100) {
  const total = Number(response.TotalCount || response.totalCount || 0);
  const next = offset + limit;
  return total > next ? String(next) : "";
}

function tagsObject(tags = []) {
  if (!Array.isArray(tags)) return {};
  return Object.fromEntries(tags.map((tag) => [text(tag.Key || tag.TagKey), text(tag.Value || tag.TagValue)]).filter(([key]) => key));
}

function tkeTagsObject(tagSpecification = []) {
  if (!Array.isArray(tagSpecification)) return {};
  return Object.assign({}, ...tagSpecification.map((spec) => tagsObject(spec.Tags)));
}

function normalizeOfficialResponse(config, response = {}, params = {}) {
  if (config.service === "cvm" && config.method === "DescribeInstances") {
    const offset = numericCursor(params.Cursor || params.cursor);
    const limit = 100;
    return {
      items: (Array.isArray(response.InstanceSet) ? response.InstanceSet : []).map((item) => ({
        ...item,
        Tags: tagsObject(item.Tags),
      })),
      NextToken: offsetNextCursor(response, offset, limit),
    };
  }
  if (config.service === "tke" && config.method === "DescribeClusters") {
    const offset = numericCursor(params.Cursor || params.cursor);
    const limit = 100;
    return {
      items: (Array.isArray(response.Clusters) ? response.Clusters : []).map((item) => ({
        ...item,
        Tags: tkeTagsObject(item.TagSpecification),
      })),
      NextToken: offsetNextCursor(response, offset, limit),
    };
  }
  if (config.service === "billing" && config.method === "DescribeBillSummary") {
    return {
      items: (Array.isArray(response.SummaryDetail) ? response.SummaryDetail : []).map((item) => ({
        ...item,
        ResourceRef: text(item.GroupKey || item.GroupValue || "billing-summary"),
        Status: response.Ready === 0 ? "preparing" : "ready",
      })),
      NextToken: "",
    };
  }
  if (config.service === "tag" && config.method === "GetResources") {
    return {
      items: (Array.isArray(response.ResourceTagMappingList) ? response.ResourceTagMappingList : []).map((item) => ({
        ResourceRef: text(item.Resource || "tagged-resource"),
        Status: "tagged",
        Tags: tagsObject(item.Tags),
      })),
      NextToken: text(response.PaginationToken),
    };
  }
  return response;
}

function readonlyParamsFor(config, params = {}) {
  if (config.service === "cvm" && config.method === "DescribeInstances") {
    return {
      Offset: numericCursor(params.Cursor || params.cursor),
      Limit: 100,
    };
  }
  if (config.service === "tke" && config.method === "DescribeClusters") {
    return {
      Offset: numericCursor(params.Cursor || params.cursor),
      Limit: 100,
    };
  }
  if (config.service === "billing" && config.method === "DescribeBillSummary") {
    return {
      Month: monthString(),
      GroupType: "region",
    };
  }
  if (config.service === "tag" && config.method === "GetResources") {
    return {
      PaginationToken: text(params.Cursor || params.cursor),
      MaxResults: 200,
    };
  }
  return {};
}

function readonlyMethod(rawClient, methodName) {
  if (!rawClient || typeof rawClient[methodName] !== "function") {
    throw new Error(`tencent_readonly_official_sdk_method_required:${methodName}`);
  }
  return (params) => rawClient[methodName](params);
}

function createReadonlyClient({ sdkPackage, context, config, exposedMethod }) {
  return Object.freeze({
    async [exposedMethod](params = {}) {
      const rawClient = createRawClient({
        sdkPackage,
        config,
        context,
        region: text(params?.Region || params?.region),
      });
      const invoke = readonlyMethod(rawClient, config.method);
      const response = await invoke(readonlyParamsFor(config, params));
      return normalizeOfficialResponse(config, response, params);
    },
  });
}

function createCosReadonlyClient({ sdkPackage, context }) {
  const CosClient = cosSdkPackageFor(sdkPackage);
  const credential = credentialConfig(context.credentials || {});
  const rawClient = new CosClient({
    SecretId: credential.secretId,
    SecretKey: credential.secretKey,
    ...(credential.token ? { SecurityToken: credential.token } : {}),
  });
  const listBuckets = readonlyMethod(rawClient, "getService");
  const headObject = readonlyMethod(rawClient, "headObject");
  return Object.freeze({
    async ListBuckets(params = {}) {
      const response = await listBuckets({
        Region: text(params?.Region || params?.region),
        Marker: text(params?.Cursor || params?.cursor),
        MaxKeys: 2000,
      });
      return {
        items: (Array.isArray(response.Buckets) ? response.Buckets : []).map((item) => ({
          ...item,
          BucketRef: text(item.Name || item.BucketRef),
          Region: text(item.Location || item.Region || params?.Region || params?.region),
        })),
        NextToken: text(response.NextMarker || response.NextToken),
      };
    },
    async HeadObject(params = {}) {
      return headObject({
        Region: text(params?.Region || params?.region),
        Bucket: text(params?.Bucket || params?.BucketRef || params?.bucketRef),
        Key: text(params?.Key || params?.PrefixRef || params?.prefixRef),
      });
    },
  });
}

export async function loadTencentReadonlyInventoryOfficialSdkPackage({
  importPackage = (specifier) => import(specifier),
} = {}) {
  try {
    return Object.freeze({
      tencentcloudSdkPackage: moduleRoot(await importPackage("tencentcloud-sdk-nodejs")),
      cosSdkPackage: moduleRoot(await importPackage("cos-nodejs-sdk-v5")),
    });
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
        exposedMethod: "GetResources",
      });
    },
  });
}
