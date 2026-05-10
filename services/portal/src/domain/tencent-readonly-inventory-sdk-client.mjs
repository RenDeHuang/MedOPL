import { assertReadonlyInventoryApiAllowlist } from "./tencent-readonly-inventory-provider.mjs";

const METHOD_TO_API = Object.freeze({
  describeAccount: "DescribeAccount",
  describeRegions: "DescribeRegions",
  describeCvmInstances: "DescribeInstances",
  describeTkeClusters: "DescribeClusters",
  describeCosBuckets: "ListBuckets",
  describeCosMetadata: "HeadObject",
  describeBillingSummary: "DescribeBillSummary",
  describeTagResources: "DescribeTagResources",
});

const API_TO_SDK_METHOD = Object.freeze({
  DescribeAccount: "DescribeAccount",
  DescribeRegions: "DescribeRegions",
  DescribeInstances: "DescribeInstances",
  DescribeClusters: "DescribeClusters",
  ListBuckets: "ListBuckets",
  HeadObject: "HeadObject",
  DescribeBillSummary: "DescribeBillSummary",
  DescribeTagResources: "DescribeTagResources",
});

const RESOURCE_TYPE_BY_API = Object.freeze({
  DescribeAccount: "account",
  DescribeRegions: "region",
  DescribeInstances: "compute",
  DescribeClusters: "managed_cluster",
  ListBuckets: "file_space",
  HeadObject: "file_space",
  DescribeBillSummary: "billing_summary",
  DescribeTagResources: "tagged_resource",
});

const API_TO_CLIENT_METHOD = Object.freeze(Object.fromEntries(
  Object.entries(METHOD_TO_API).map(([method, apiName]) => [apiName, method]),
));

const RETRYABLE_ERROR_CATEGORIES = new Set(["rate_limited", "network_error"]);

function text(value = "") {
  return String(value ?? "").trim();
}

function list(value = []) {
  return Array.isArray(value) ? value : [];
}

function maskIdentifier(value = "") {
  const normalized = text(value);
  if (!normalized) return "missing";
  if (normalized.length <= 4) return "****";
  const lastDash = normalized.lastIndexOf("-");
  if (lastDash >= 0 && lastDash < normalized.length - 1) {
    return `${normalized.slice(0, lastDash + 1)}****${normalized.slice(-4)}`;
  }
  return `${normalized.slice(0, Math.max(0, normalized.length - 4))}****${normalized.slice(-4)}`;
}

function assertObject(value, label) {
  if (!value || typeof value !== "object") {
    throw new Error(`readonly_inventory_sdk_${label}_required`);
  }
}

function assertSdkMethods(sdk = {}) {
  for (const method of Object.values(API_TO_SDK_METHOD)) {
    if (typeof sdk[method] !== "function") {
      throw new Error(`readonly_inventory_sdk_missing_method:${method}`);
    }
  }
}

function assertApiAllowed(allowedSet, apiName) {
  if (!allowedSet.has(apiName)) {
    throw new Error(`readonly_inventory_sdk_api_not_allowed:${apiName}`);
  }
}

function responseItems(response = {}) {
  if (Array.isArray(response)) return response;
  return [
    ...list(response.items),
    ...list(response.Items),
    ...list(response.resources),
    ...list(response.Resources),
    ...list(response.instances),
    ...list(response.Instances),
    ...list(response.clusters),
    ...list(response.Clusters),
    ...list(response.buckets),
    ...list(response.Buckets),
    ...list(response.summaries),
    ...list(response.Summaries),
  ];
}

function nextCursor(response = {}) {
  return text(response.nextCursor || response.NextCursor || response.cursor || response.Cursor || response.nextToken || response.NextToken);
}

function tagsFor(item = {}) {
  const tags = item.tags || item.Tags || item.TagSet || {};
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return Object.fromEntries(Object.entries(tags).map(([key, value]) => [key, text(value)]));
}

function resourceRef(item = {}) {
  return text(
    item.resourceRef
      || item.ResourceRef
      || item.id
      || item.ID
      || item.resourceId
      || item.ResourceId
      || item.InstanceId
      || item.ClusterId
      || item.Name
      || item.name
      || item.BucketRef
      || item.bucketRef
      || "unknown-resource",
  );
}

function statusFor(item = {}) {
  return text(
    item.resourceStatus
      || item.ResourceStatus
      || item.status
      || item.Status
      || item.InstanceState
      || item.ClusterStatus
      || "unknown",
  ).toLowerCase();
}

function normalizeResourceItem(item = {}, region = "", resourceType = "unknown") {
  return {
    id: resourceRef(item),
    resourceType: text(item.resourceType || item.ResourceType || tagsFor(item).resourceType || resourceType),
    resourceStatus: statusFor(item),
    region: text(item.region || item.Region || item.Location || region),
    tags: tagsFor(item),
    bucketRef: text(item.bucketRef || item.BucketRef || item.Name),
    prefixRef: text(item.prefixRef || item.PrefixRef),
  };
}

function compactItem(item = {}) {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => {
    if (value === undefined || value === null || value === "") return false;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return false;
    return true;
  }));
}

function normalizePage(response = {}, region = "", resourceType = "unknown") {
  return {
    items: responseItems(response).map((item) => compactItem(normalizeResourceItem(item, region, resourceType))),
    nextCursor: nextCursor(response),
  };
}

function normalizeAccount(response = {}, accountId = "") {
  return {
    accountMasked: maskIdentifier(response.accountMasked || response.AccountMasked || response.accountId || response.AccountId || accountId),
    resourceType: "account",
    resourceStatus: "available",
  };
}

function normalizeRegions(response = {}, configuredRegions = []) {
  const items = responseItems(response).map((item) => ({ region: text(item.region || item.Region) })).filter((item) => item.region);
  const regionItems = items.length > 0 ? items : configuredRegions.map((region) => ({ region }));
  return {
    items: regionItems,
    nextCursor: nextCursor(response),
  };
}

function normalizeMetadata(response = {}, region = "") {
  return {
    region,
    resourceType: "file_space",
    resourceStatus: response.Exists === false || response.exists === false ? "metadata_missing" : "metadata_available",
    metadataSummary: response.metadataSummary || response.MetadataSummary || metadataSummaryFromHeaders(response.headers || response.Headers || {}),
    billingSummary: response.billingSummary || response.BillingSummary || {},
  };
}

function metadataSummaryFromHeaders(headers = {}) {
  if (!headers || typeof headers !== "object") return {};
  const sizeBytes = Number(headers["content-length"] || headers["Content-Length"] || 0);
  return {
    ...(Number.isFinite(sizeBytes) && sizeBytes > 0 ? { sizeBytes } : {}),
    ...(text(headers.etag || headers.ETag) ? { checksumStatus: "present" } : {}),
  };
}

function errorCategory(error = {}) {
  const code = text(error.category || error.providerCode || error.code || error.Code || error.name || error.message || error.providerMessage).toLowerCase();
  if (code.includes("permission") || code.includes("denied") || code.includes("unauthorized")) return "permission_denied";
  if (code.includes("authfailure") || code.includes("unauthorizedoperation")) return "permission_denied";
  if (code.includes("signature")) return "permission_denied";
  if (code.includes("rate") || code.includes("limit") || code.includes("throttle")) return "rate_limited";
  if (code.includes("region") && (code.includes("unavailable") || code.includes("unsupported"))) return "region_unavailable";
  if (code.includes("network") || code.includes("timeout") || code.includes("econn")) return "network_error";
  if (code.includes("notfound") || code.includes("not_found") || code.includes("not found")) return "not_found";
  return "sdk_error";
}

function safeError(error = {}, { apiName = "", clientMethod = "", region = "", resourceType = "unknown" } = {}) {
  const category = errorCategory(error);
  const normalized = Object.assign(new Error(`readonly_inventory_sdk_${category}`), {
    code: text(error.providerCode || error.code || error.Code || category),
    providerCode: text(error.providerCode || error.code || error.Code || category),
    apiName: text(error.apiName || apiName),
    clientMethod: text(error.clientMethod || clientMethod || API_TO_CLIENT_METHOD[error.apiName || apiName]),
    category,
    retryable: RETRYABLE_ERROR_CATEGORIES.has(category),
    region,
    resourceType,
  });
  Object.defineProperty(normalized, "message", {
    value: `readonly inventory ${category}`,
    enumerable: true,
    configurable: true,
  });
  return normalized;
}

async function invokeSdk({ sdk, sdkMethod, params, apiName, clientMethod, region, resourceType }) {
  try {
    return await sdk[sdkMethod](params);
  } catch (error) {
    throw safeError(error, { apiName, clientMethod, region, resourceType });
  }
}

export function createTencentReadonlyInventorySdkClient({
  sdk,
  credentials,
  accountId = "",
  allowedApis = [],
  regions = [],
} = {}) {
  assertObject(sdk, "client");
  assertSdkMethods(sdk);
  assertObject(credentials, "credentials");
  const normalizedApis = assertReadonlyInventoryApiAllowlist(allowedApis);
  const allowedSet = new Set(normalizedApis);
  const configuredRegions = regions.map((region) => text(region)).filter(Boolean);

  function assertAndInvoke(apiName, params = {}) {
    assertApiAllowed(allowedSet, apiName);
    const sdkMethod = API_TO_SDK_METHOD[apiName];
    return invokeSdk({
      sdk,
      sdkMethod,
      params,
      apiName,
      clientMethod: API_TO_CLIENT_METHOD[apiName],
      region: text(params.Region || params.region),
      resourceType: RESOURCE_TYPE_BY_API[apiName],
    });
  }

  return Object.freeze({
    async describeAccount() {
      const response = await assertAndInvoke(METHOD_TO_API.describeAccount, {});
      return normalizeAccount(response, accountId);
    },

    async describeRegions() {
      const response = await assertAndInvoke(METHOD_TO_API.describeRegions, {});
      return normalizeRegions(response, configuredRegions);
    },

    async describeCvmInstances({ region, cursor } = {}) {
      const response = await assertAndInvoke(METHOD_TO_API.describeCvmInstances, {
        Region: text(region),
        Cursor: text(cursor),
      });
      return normalizePage(response, text(region), "compute");
    },

    async describeTkeClusters({ region, cursor } = {}) {
      const response = await assertAndInvoke(METHOD_TO_API.describeTkeClusters, {
        Region: text(region),
        Cursor: text(cursor),
      });
      return normalizePage(response, text(region), "managed_cluster");
    },

    async describeCosBuckets({ region, cursor } = {}) {
      const response = await assertAndInvoke(METHOD_TO_API.describeCosBuckets, {
        Region: text(region),
        Cursor: text(cursor),
      });
      return normalizePage(response, text(region), "file_space");
    },

    async describeCosMetadata({ region, bucketRef, prefixRef } = {}) {
      const response = await assertAndInvoke(METHOD_TO_API.describeCosMetadata, {
        Region: text(region),
        BucketRef: text(bucketRef),
        PrefixRef: text(prefixRef),
      });
      return normalizeMetadata(response, text(region));
    },

    async describeBillingSummary({ region, cursor } = {}) {
      const response = await assertAndInvoke(METHOD_TO_API.describeBillingSummary, {
        Region: text(region),
        Cursor: text(cursor),
      });
      return normalizePage(response, text(region), "billing_summary");
    },

    async describeTagResources({ region, cursor } = {}) {
      const response = await assertAndInvoke(METHOD_TO_API.describeTagResources, {
        Region: text(region),
        Cursor: text(cursor),
      });
      return normalizePage(response, text(region), "tagged_resource");
    },
  });
}
