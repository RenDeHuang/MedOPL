const TENCENT_CLIENTS = Object.freeze({
  sts: ["sts", "v20180813"],
  tke: ["tke", "v20180525"],
  billing: ["billing", "v20180709"],
  tag: ["tag", "v20180813"],
});

function moduleRoot(value = {}) {
  return value?.default && typeof value.default === "object" ? value.default : value;
}

function objectRoot(value = {}) {
  return value?.default || value;
}

function clientShape(root, [service, version]) {
  const Client = root?.[service]?.[version]?.Client;
  if (typeof Client !== "function") throw new Error(`readonly_official_sdk_client_shape_missing:${service}:${version}`);
  return Client;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function countBy(items = [], fieldNames = []) {
  const counts = {};
  for (const item of Array.isArray(items) ? items : []) {
    const value = fieldNames.map((fieldName) => item?.[fieldName]).find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim());
    const key = value ? String(value) : "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function monthNow() {
  return new Date().toISOString().slice(0, 7);
}

function sanitizedBlocker({ operation, region = "", code = "readonly_sdk_call_failed" }) {
  return {
    code,
    operation,
    ...(region ? { region } : {}),
    message: "official SDK readonly call failed or could not produce sanitized evidence",
  };
}

async function capture(blockers, operation, region, fn) {
  try {
    return await fn();
  } catch (error) {
    blockers.push(sanitizedBlocker({
      operation,
      region,
      code: String(error?.code || error?.name || "readonly_sdk_call_failed").replace(/[^A-Za-z0-9_.:-]/gu, "_").slice(0, 96),
    }));
    return null;
  }
}

export function createTencentReadonlyInventoryOfficialSdkModules({ clients, tencentSdkRoot, cosSdkRoot, credentials, defaultRegion = "" } = {}) {
  if (clients) {
    return {
      describeAccount: (req = null) => clients.sts.GetCallerIdentity(req),
      describeTkeClusters: (region, req = {}) => clients.tkeByRegion[region].DescribeClusters(req),
      describeTkeNodePools: (region, req = {}) => clients.tkeByRegion[region].DescribeClusterNodePools(req),
      describeBillingBalance: (req = {}) => clients.billing.DescribeAccountBalance(req),
      describeBillingSummary: (req = {}) => clients.billing.DescribeBillSummary(req),
      describeTagResources: (req = {}) => clients.tag.GetResources(req),
      describeCosBuckets: (req = {}) => clients.cos.getService(req),
      describeCosMetadata: (req = {}) => clients.cos.headObject(req),
    };
  }

  const sdkRoot = moduleRoot(tencentSdkRoot);
  const CosConstructor = objectRoot(cosSdkRoot);
  if (typeof CosConstructor !== "function") throw new Error("readonly_official_cos_sdk_constructor_missing");
  if (!credentials?.secretId || !credentials?.secretKey) throw new Error("readonly_official_sdk_credentials_required");

  const credential = {
    secretId: credentials.secretId,
    secretKey: credentials.secretKey,
  };
  const clientCache = new Map();
  const cosClient = new CosConstructor({
    SecretId: credentials.secretId,
    SecretKey: credentials.secretKey,
  });

  function tencentClient(kind, region = "") {
    const cacheKey = `${kind}:${region}`;
    if (!clientCache.has(cacheKey)) {
      const Client = clientShape(sdkRoot, TENCENT_CLIENTS[kind]);
      clientCache.set(cacheKey, new Client({
        credential,
        region,
        profile: {
          httpProfile: {
            reqTimeout: 30,
          },
        },
      }));
    }
    return clientCache.get(cacheKey);
  }

  return {
    describeAccount: (req = null) => tencentClient("sts", defaultRegion).GetCallerIdentity(req),
    describeTkeClusters: (region, req = {}) => tencentClient("tke", region).DescribeClusters(req),
    describeTkeNodePools: (region, req = {}) => tencentClient("tke", region).DescribeClusterNodePools(req),
    describeBillingBalance: (req = {}) => tencentClient("billing").DescribeAccountBalance(req),
    describeBillingSummary: (req = {}) => tencentClient("billing").DescribeBillSummary(req),
    describeTagResources: (req = {}) => tencentClient("tag").GetResources(req),
    describeCosBuckets: (req = {}) => cosClient.getService(req),
    describeCosMetadata: (req = {}) => cosClient.headObject(req),
  };
}

export async function runTencentReadonlyInventoryOfficialSdk({
  modules,
  regions = [],
  billingMonth = monthNow(),
  expectedAccountId = "",
  cosMetadataProbes = [],
} = {}) {
  if (!modules) throw new Error("readonly_official_sdk_modules_required");
  const blockers = [];
  const resources = [];

  const account = await capture(blockers, "GetCallerIdentity", "", () => modules.describeAccount(null));
  if (account) {
    resources.push({
      region: "global",
      resourceType: "accountSummary",
      resourceStatus: "observed",
      accountIdMatchesExpected: expectedAccountId ? String(account.AccountId || "") === String(expectedAccountId) : "not_checked",
      identityType: account.Type || "unknown",
      tagCompleteness: "not_applicable",
      portalMappingStatus: "not_checked_without_portal_ledger",
    });
  }

  for (const region of regions) {
    const clusterResponse = await capture(blockers, "DescribeClusters", region, () => modules.describeTkeClusters(region, { Limit: 100 }));
    const clusters = Array.isArray(clusterResponse?.Clusters) ? clusterResponse.Clusters : [];
    if (clusterResponse) {
      resources.push({
        region,
        resourceType: "tkeClusterSummary",
        resourceStatus: "observed",
        totalCount: normalizeNumber(clusterResponse.TotalCount ?? clusters.length),
        clusterCount: clusters.length,
        statusCounts: countBy(clusters, ["ClusterStatus", "Status"]),
        typeCounts: countBy(clusters, ["ClusterType"]),
        tagCompleteness: "not_checked",
        portalMappingStatus: "not_checked_without_portal_ledger",
      });
    }

    for (const [clusterIndex, cluster] of clusters.entries()) {
      if (!cluster?.ClusterId) {
        blockers.push(sanitizedBlocker({
          operation: "DescribeClusterNodePools",
          region,
          code: "tke_cluster_id_missing_for_node_pool_inventory",
        }));
        continue;
      }
      const nodePoolResponse = await capture(blockers, "DescribeClusterNodePools", region, () => modules.describeTkeNodePools(region, { ClusterId: cluster.ClusterId }));
      const nodePools = Array.isArray(nodePoolResponse?.NodePoolSet) ? nodePoolResponse.NodePoolSet : [];
      if (nodePoolResponse) {
        resources.push({
          region,
          resourceType: "tkeNodePoolSummary",
          resourceStatus: "observed",
          clusterRef: `cluster-${clusterIndex + 1}`,
          totalCount: normalizeNumber(nodePoolResponse.TotalCount ?? nodePools.length),
          nodePoolCount: nodePools.length,
          lifeStateCounts: countBy(nodePools, ["LifeState", "Status"]),
          tagCompleteness: "not_checked",
          portalMappingStatus: "not_checked_without_portal_ledger",
        });
      }
    }
  }

  const balance = await capture(blockers, "DescribeAccountBalance", "", () => modules.describeBillingBalance({}));
  const bill = await capture(blockers, "DescribeBillSummary", "", () => modules.describeBillingSummary({
    Month: billingMonth,
    GroupType: "business",
  }));
  if (balance || bill) {
    resources.push({
      region: "global",
      resourceType: "billingSummary",
      resourceStatus: "observed",
      balanceObserved: Boolean(balance),
      billSummaryObserved: Boolean(bill),
      billReady: bill?.Ready === undefined ? "unknown" : Number(bill.Ready) === 1,
      summaryItemCount: Array.isArray(bill?.SummaryDetail) ? bill.SummaryDetail.length : 0,
      freezeAmountObserved: balance?.FreezeAmount !== undefined,
      oweAmountObserved: balance?.OweAmount !== undefined,
      tagCompleteness: "not_checked",
      portalMappingStatus: "not_checked_without_portal_ledger",
    });
  }

  const tagResponse = await capture(blockers, "GetResources", "", () => modules.describeTagResources({ MaxResults: 50 }));
  if (tagResponse) {
    resources.push({
      region: "global",
      resourceType: "billingTagSummary",
      resourceStatus: "observed",
      resourceTagMappingCount: Array.isArray(tagResponse.ResourceTagMappingList) ? tagResponse.ResourceTagMappingList.length : 0,
      nextPagePresent: Boolean(tagResponse.PaginationToken),
      tagCompleteness: "observed_without_raw_mapping",
      portalMappingStatus: "not_checked_without_portal_ledger",
    });
  }

  const cosBuckets = await capture(blockers, "getService", "", () => modules.describeCosBuckets({}));
  if (cosBuckets) {
    const buckets = Array.isArray(cosBuckets.Buckets) ? cosBuckets.Buckets : [];
    for (const region of regions) {
      const bucketCount = buckets.filter((bucket) => !bucket?.Location || bucket.Location === region).length;
      resources.push({
        region,
        resourceType: "cosStorageSummary",
        resourceStatus: "observed",
        bucketCount,
        metadataProbeConfigured: cosMetadataProbes.some((probe) => probe.region === region),
        readsObjectBody: false,
        tagCompleteness: "not_checked",
        portalMappingStatus: "not_checked_without_portal_ledger",
      });
    }
  }

  for (const [probeIndex, probe] of cosMetadataProbes.entries()) {
    const metadata = await capture(blockers, "headObject", probe.region || "", () => modules.describeCosMetadata({
      Bucket: probe.bucket,
      Region: probe.region,
      Key: probe.key,
    }));
    if (metadata) {
      resources.push({
        region: probe.region || "unknown",
        resourceType: "cosObjectMetadataSummary",
        resourceStatus: "observed",
        metadataProbeRef: `cos-metadata-probe-${probeIndex + 1}`,
        contentLengthObserved: metadata?.headers?.["content-length"] !== undefined || metadata?.ContentLength !== undefined,
        readsObjectBody: false,
        tagCompleteness: "not_checked",
        portalMappingStatus: "not_checked_without_portal_ledger",
      });
    }
  }

  if (!cosMetadataProbes.length) {
    blockers.push({
      code: "cos_metadata_probe_not_configured",
      operation: "headObject",
      message: "COS bucket listing was attempted, but object metadata proof requires an explicit metadata probe and no object body read",
    });
  }

  return { resources, blockers };
}
