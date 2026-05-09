import { createHash, createHmac } from "node:crypto";

const API_CONFIG = Object.freeze({
  DescribeAccount: Object.freeze({
    endpoint: "sts.intl.tencentcloudapi.com",
    service: "sts",
    action: "GetCallerIdentity",
    version: "2018-08-13",
  }),
  DescribeRegions: Object.freeze({
    endpoint: "cvm.tencentcloudapi.com",
    service: "cvm",
    action: "DescribeRegions",
    version: "2017-03-12",
  }),
  DescribeInstances: Object.freeze({
    endpoint: "cvm.tencentcloudapi.com",
    service: "cvm",
    action: "DescribeInstances",
    version: "2017-03-12",
  }),
  DescribeClusters: Object.freeze({
    endpoint: "tke.tencentcloudapi.com",
    service: "tke",
    action: "DescribeClusters",
    version: "2018-05-25",
  }),
  ListBuckets: Object.freeze({
    endpoint: "cos.tencentcloudapi.com",
    service: "cos",
    action: "ListBuckets",
    version: "2018-05-30",
  }),
  HeadObject: Object.freeze({
    endpoint: "cos.tencentcloudapi.com",
    service: "cos",
    action: "HeadObject",
    version: "2018-05-30",
  }),
  DescribeBillSummary: Object.freeze({
    endpoint: "billing.tencentcloudapi.com",
    service: "billing",
    action: "DescribeBillSummary",
    version: "2018-07-09",
  }),
  DescribeTagResources: Object.freeze({
    endpoint: "tag.tencentcloudapi.com",
    service: "tag",
    action: "DescribeTagResources",
    version: "2018-08-13",
  }),
});

function text(value = "") {
  return String(value ?? "").trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

function assertFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw new Error("tencent_readonly_tc3_fetch_required");
  }
}

function assertCredentials(credentials = {}) {
  if (!text(credentials.SecretId) || !text(credentials.SecretKey)) {
    throw new Error("tencent_readonly_tc3_credentials_required");
  }
}

function compact(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => {
    if (item === undefined || item === null || item === "") return false;
    if (typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 0) return false;
    return true;
  }));
}

function tagsFor(tags = {}) {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return Object.fromEntries(Object.entries(tags).map(([key, value]) => [key, text(value)]));
}

function normalizeResource(item = {}, resourceType = "unknown", region = "") {
  return compact({
    id: text(item.id || item.ID || item.resourceRef || item.ResourceRef || item.InstanceId || item.ClusterId || item.BucketRef),
    resourceType: text(item.resourceType || item.ResourceType || tagsFor(item.Tags || item.tags).resourceType || resourceType),
    resourceStatus: text(item.resourceStatus || item.ResourceStatus || item.status || item.Status || item.InstanceState || item.ClusterStatus || "unknown").toLowerCase(),
    region: text(item.region || item.Region || region),
    tags: tagsFor(item.Tags || item.tags),
    bucketRef: text(item.bucketRef || item.BucketRef),
    prefixRef: text(item.prefixRef || item.PrefixRef),
  });
}

function responsePage(response = {}, keys = [], resourceType = "unknown", region = "") {
  const items = keys.flatMap((key) => Array.isArray(response[key]) ? response[key] : []);
  return {
    items: items.map((item) => normalizeResource(item, resourceType, region)),
    NextToken: text(response.NextToken || response.nextToken),
  };
}

function normalizeResponse(apiName, response = {}, params = {}) {
  if (apiName === "DescribeAccount") {
    return {
      AccountId: text(response.AccountId || response.OwnerUin || response.Uin),
    };
  }
  if (apiName === "DescribeRegions") {
    const regions = response.RegionSet || response.RegionInfoSet || response.Regions || [];
    return {
      Regions: regions.map((item) => ({ Region: text(item.Region || item.region) })).filter((item) => item.Region),
      NextToken: text(response.NextToken || response.nextToken),
    };
  }
  if (apiName === "DescribeInstances") {
    return responsePage(response, ["InstanceSet", "Instances", "items"], "compute", params.Region);
  }
  if (apiName === "DescribeClusters") {
    return responsePage(response, ["Clusters", "ClusterSet", "items"], "managed_cluster", params.Region);
  }
  if (apiName === "ListBuckets") {
    return responsePage(response, ["BucketSet", "Buckets", "items"], "file_space", params.Region);
  }
  if (apiName === "HeadObject") {
    return {
      Exists: response.Exists !== false,
      MetadataSummary: response.MetadataSummary || response.metadataSummary || {},
      BillingSummary: response.BillingSummary || response.billingSummary || {},
    };
  }
  if (apiName === "DescribeBillSummary") {
    return responsePage(response, ["SummarySet", "Summaries", "items"], "billing_summary", params.Region);
  }
  if (apiName === "DescribeTagResources") {
    return responsePage(response, ["ResourceTagMappingList", "Resources", "items"], "tagged_resource", params.Region);
  }
  throw new Error(`tencent_readonly_tc3_unknown_api:${apiName}`);
}

function requestPayload(apiName, params = {}) {
  const payload = {};
  if (text(params.Region)) payload.Region = text(params.Region);
  if (text(params.Cursor)) payload.NextToken = text(params.Cursor);
  if (text(params.BucketRef)) payload.BucketRef = text(params.BucketRef);
  if (text(params.PrefixRef)) payload.PrefixRef = text(params.PrefixRef);
  return payload;
}

function tc3Headers({ apiName, credentials, now, payload }) {
  const config = API_CONFIG[apiName];
  if (!config) throw new Error(`tencent_readonly_tc3_api_not_allowed:${apiName}`);
  const timestamp = Number(now());
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${config.endpoint}\nx-tc-action:${config.action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256(body),
  ].join("\n");
  const credentialScope = `${date}/${config.service}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const secretDate = hmac(`TC3${credentials.SecretKey}`, date);
  const secretService = hmac(secretDate, config.service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = hmac(secretSigning, stringToSign, "hex");
  const headers = {
    authorization: `TC3-HMAC-SHA256 Credential=${credentials.SecretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "content-type": "application/json; charset=utf-8",
    host: config.endpoint,
    "x-tc-action": config.action,
    "x-tc-region": text(payload.Region),
    "x-tc-timestamp": String(timestamp),
    "x-tc-version": config.version,
  };
  if (text(credentials.token)) {
    headers["x-tc-token"] = text(credentials.token);
  }
  return headers;
}

function errorCode(error = {}) {
  return text(error.code || error.Code || error.name || error.message);
}

function errorMessage(error = {}) {
  return text(error.message || error.Message);
}

function safeTc3Error(error = {}, apiName = "unknown") {
  const normalized = new Error(`tencent_readonly_tc3_request_failed:${apiName}`);
  normalized.code = errorCode(error) || "tencent_readonly_tc3_error";
  normalized.providerCode = normalized.code;
  normalized.providerMessage = errorMessage(error);
  normalized.status = Number(error.status || 0);
  normalized.apiName = apiName;
  return normalized;
}

function createReadonlyClient({ fetchImpl, now, credentials }) {
  assertCredentials(credentials);
  async function request(apiName, params = {}) {
    const config = API_CONFIG[apiName];
    const payload = requestPayload(apiName, params);
    const body = JSON.stringify(payload);
    const headers = tc3Headers({ apiName, credentials, now, payload });
    let response;
    try {
      response = await fetchImpl(`https://${config.endpoint}`, {
        method: "POST",
        headers,
        body,
      });
    } catch (error) {
      throw safeTc3Error(error, apiName);
    }

    let parsed = {};
    try {
      parsed = await response.json();
    } catch {
      parsed = {};
    }
    const payloadError = parsed?.Response?.Error;
    if (!response.ok || payloadError) {
      const error = new Error(payloadError?.Message || `tencent_readonly_tc3_${apiName}_failed`);
      error.code = payloadError?.Code || "";
      error.status = response.status;
      throw safeTc3Error(error, apiName);
    }
    return normalizeResponse(apiName, parsed.Response || parsed, payload);
  }
  return Object.freeze({
    DescribeAccount(params) {
      return request("DescribeAccount", params);
    },
    DescribeRegions(params) {
      return request("DescribeRegions", params);
    },
    DescribeInstances(params) {
      return request("DescribeInstances", params);
    },
    DescribeClusters(params) {
      return request("DescribeClusters", params);
    },
    ListBuckets(params) {
      return request("ListBuckets", params);
    },
    HeadObject(params) {
      return request("HeadObject", params);
    },
    DescribeBillSummary(params) {
      return request("DescribeBillSummary", params);
    },
    DescribeTagResources(params) {
      return request("DescribeTagResources", params);
    },
  });
}

function createFactory(fetchImpl, now) {
  return function createClient(context = {}) {
    return createReadonlyClient({
      fetchImpl,
      now,
      credentials: context.credentials || {},
    });
  };
}

export function createTencentReadonlyInventoryTc3Modules({ fetchImpl, now = () => Math.floor(Date.now() / 1000) } = {}) {
  assertFetch(fetchImpl);
  return Object.freeze({
    createAccountClient: createFactory(fetchImpl, now),
    createRegionClient: createFactory(fetchImpl, now),
    createCvmClient: createFactory(fetchImpl, now),
    createTkeClient: createFactory(fetchImpl, now),
    createCosClient: createFactory(fetchImpl, now),
    createBillingClient: createFactory(fetchImpl, now),
    createTagClient: createFactory(fetchImpl, now),
  });
}
