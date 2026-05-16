import {
  assertReadonlyInventoryApiAllowlist,
  runTencentReadonlyInventory,
  validateReadonlyInventorySecretEnv,
} from "./tencent-readonly-inventory-provider.mjs";

const REQUIRED_CLIENT_METHODS = [
  "describeAccount",
  "describeRegions",
  "describeCvmInstances",
  "describeTkeClusters",
  "describeCosBuckets",
  "describeCosMetadata",
  "describeBillingSummary",
  "describeTagResources",
];

const PAGE_METHODS = [
  ["describeCvmInstances", "DescribeInstances", "compute"],
  ["describeTkeClusters", "DescribeClusters", "managed_cluster"],
  ["describeCosBuckets", "ListBuckets", "file_space"],
  ["describeBillingSummary", "DescribeBillSummary", "billing_summary"],
  ["describeTagResources", "DescribeTagResources", "tagged_resource"],
];

const PUBLIC_OUTPUT_KEYS = [
  "accountMasked",
  "region",
  "resourceType",
  "resourceStatus",
  "tagCompleteness",
  "portalMappingStatus",
  "orphanResourceCount",
  "missingTagCount",
  "conflictCount",
  "auditQueueItems",
];

function text(value = "") {
  return String(value ?? "").trim();
}

function uniqueSorted(values = []) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))].sort();
}

function assertClient(client = {}) {
  for (const method of REQUIRED_CLIENT_METHODS) {
    if (!client || typeof client[method] !== "function") {
      throw new Error(`readonly_inventory_live_client_missing_method:${method}`);
    }
  }
}

function pageItems(page = {}) {
  if (Array.isArray(page)) return page;
  if (Array.isArray(page.items)) return page.items;
  if (Array.isArray(page.resources)) return page.resources;
  if (Array.isArray(page.instances)) return page.instances;
  if (Array.isArray(page.clusters)) return page.clusters;
  if (Array.isArray(page.buckets)) return page.buckets;
  if (Array.isArray(page.summaries)) return page.summaries;
  return [];
}

function pageCursor(page = {}) {
  return text(page?.nextCursor || page?.cursor || page?.nextToken || "");
}

function tagsFor(item = {}) {
  return item.tags && typeof item.tags === "object" ? item.tags : {};
}

function resourceRef(item = {}) {
  return text(item.resourceRef || item.id || item.resourceId || item.instanceId || item.clusterId || item.bucketRef || "unknown-resource");
}

function normalizeResource(item = {}, region = "", resourceType = "unknown") {
  const tags = tagsFor(item);
  return {
    id: resourceRef(item),
    resourceType: text(item.resourceType || tags.resourceType || resourceType),
    resourceStatus: text(item.resourceStatus || item.status || "unknown"),
    region: text(item.region || region),
    tags,
  };
}

function safeClientAuditItem({ method = "", region = "", reason = "", resourceType = "unknown" } = {}) {
  return {
    resourceRef: `${method}:${region}`,
    resourceType,
    region,
    reason,
    portalMappingStatus: "audit_required",
    tagCompleteness: "unknown",
  };
}

export function safeLiveDiagnostic(error = {}, fallback = {}) {
  const category = text(error.category || classifyClientError(error).replace(/^readonly_/, "") || "sdk_error") || "sdk_error";
  return {
    apiName: text(error.apiName || fallback.apiName),
    clientMethod: text(error.clientMethod || fallback.clientMethod || fallback.method),
    category,
    providerCode: text(error.providerCode || error.code || error.Code || category),
    region: text(error.region || fallback.region),
    resourceType: text(error.resourceType || fallback.resourceType),
  };
}

function throwLiveDiagnostic(error = {}, fallback = {}) {
  const diagnostic = safeLiveDiagnostic(error, fallback);
  const wrapped = new Error("readonly_inventory_live_diagnostic");
  wrapped.diagnostic = diagnostic;
  wrapped.code = diagnostic.providerCode;
  wrapped.category = diagnostic.category;
  wrapped.apiName = diagnostic.apiName;
  wrapped.clientMethod = diagnostic.clientMethod;
  wrapped.region = diagnostic.region;
  wrapped.resourceType = diagnostic.resourceType;
  throw wrapped;
}

function classifyClientError(error = {}) {
  const code = text(error.category || error.code || error.name || error.message).toLowerCase();
  if (code.includes("permission") || code.includes("denied")) return "readonly_permission_denied";
  if (code.includes("rate") || code.includes("limit") || code.includes("throttle")) return "readonly_rate_limited";
  if (code.includes("region") && (code.includes("unavailable") || code.includes("unsupported"))) return "readonly_region_unavailable";
  if (code.includes("network") || code.includes("timeout") || code.includes("econn")) return "readonly_network_error";
  return "";
}

async function collectPagedResources({ client, method, region, resourceType, auditQueueItems }) {
  const resources = [];
  let cursor = "";
  do {
    let page;
    try {
      page = await client[method]({ region, cursor: cursor || undefined });
    } catch (error) {
      const reason = classifyClientError(error);
      if (!reason) {
        throwLiveDiagnostic(error, { method, region, resourceType });
      }
      auditQueueItems.push(safeClientAuditItem({ method, region, reason, resourceType }));
      return resources;
    }

    for (const item of pageItems(page)) {
      const resource = normalizeResource(item, region, resourceType);
      resources.push(resource);
      if (method === "describeCosBuckets") {
        await collectCosMetadataEvidence({ client, item, region, auditQueueItems });
      }
    }
    cursor = pageCursor(page);
  } while (cursor);
  return resources;
}

async function collectCosMetadataEvidence({ client, item = {}, region = "", auditQueueItems }) {
  try {
    await client.describeCosMetadata({
      region,
      bucketRef: text(item.bucketRef || item.id || item.resourceRef),
      prefixRef: text(item.prefixRef || item.folderRef || "workspace-file-space"),
    });
  } catch (error) {
    const reason = classifyClientError(error);
    if (!reason) {
      throwLiveDiagnostic(error, {
        method: "describeCosMetadata",
        region,
        resourceType: "file_space",
      });
    }
    auditQueueItems.push(safeClientAuditItem({
      method: "describeCosMetadata",
      region,
      reason,
      resourceType: "file_space",
    }));
  }
}

async function collectLiveResources({ client, regions = [], allowedApis = [] } = {}) {
  const allowedSet = new Set(allowedApis);
  if (allowedSet.has("DescribeAccount")) {
    try {
      await client.describeAccount();
    } catch (error) {
      throwLiveDiagnostic(error, {
        apiName: "DescribeAccount",
        method: "describeAccount",
        resourceType: "account",
      });
    }
  }
  if (allowedSet.has("DescribeRegions")) {
    try {
      await client.describeRegions();
    } catch (error) {
      throwLiveDiagnostic(error, {
        apiName: "DescribeRegions",
        method: "describeRegions",
        resourceType: "region",
      });
    }
  }

  const auditQueueItems = [];
  const resources = [];
  for (const region of regions) {
    for (const [method, apiName, resourceType] of PAGE_METHODS) {
      if (!allowedSet.has(apiName)) continue;
      resources.push(...await collectPagedResources({
        client,
        method,
        region,
        resourceType,
        auditQueueItems,
      }));
    }
  }
  return { resources, auditQueueItems };
}

function publicInventoryOutput(output = {}, additionalAuditItems = []) {
  const auditQueueItems = [...(Array.isArray(output.auditQueueItems) ? output.auditQueueItems : []), ...additionalAuditItems];
  const region = uniqueSorted([...(Array.isArray(output.region) ? output.region : []), ...auditQueueItems.map((item) => item.region)]);
  const next = {
    accountMasked: output.accountMasked,
    region,
    resourceType: Array.isArray(output.resourceType) ? output.resourceType : [],
    resourceStatus: Array.isArray(output.resourceStatus) ? output.resourceStatus : [],
    tagCompleteness: output.tagCompleteness,
    portalMappingStatus: {
      mapped: Number(output.portalMappingStatus?.mapped || 0),
      audit_required: auditQueueItems.length,
    },
    orphanResourceCount: Number(output.orphanResourceCount || 0),
    missingTagCount: Number(output.missingTagCount || 0),
    conflictCount: Number(output.conflictCount || 0) + additionalAuditItems.length,
    auditQueueItems,
  };
  return Object.fromEntries(PUBLIC_OUTPUT_KEYS.map((key) => [key, next[key]]));
}

export function createTencentReadonlyInventoryAdapter({ client } = {}) {
  assertClient(client);
  return Object.freeze({
    name: "live-shaped/tencent-readonly-inventory-adapter",
    mode: "live_shaped_shell",
    async listReadonlyInventoryResources({ envSummary } = {}) {
      const { resources, auditQueueItems } = await collectLiveResources({
        client,
        regions: envSummary?.regions || [],
        allowedApis: envSummary?.allowedApis || [],
      });
      return { resources, auditQueueItems };
    },
  });
}

export async function collectTencentReadonlyInventory({ adapter, env = {}, portalLedger = {} } = {}) {
  if (!adapter || typeof adapter.listReadonlyInventoryResources !== "function") {
    throw new Error("readonly_inventory_inventory_adapter_required");
  }
  const envSummary = validateReadonlyInventorySecretEnv(env);
  assertReadonlyInventoryApiAllowlist(envSummary.allowedApis);
  const collected = await adapter.listReadonlyInventoryResources({ envSummary });
  const provider = {
    listReadonlyInventoryResources() {
      return collected.resources || [];
    },
  };
  const output = await runTencentReadonlyInventory({ provider, portalLedger, env });
  return publicInventoryOutput(output, collected.auditQueueItems || []);
}
