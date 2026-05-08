const READONLY_SECRET_KEYS = new Set([
  "RUN_TENCENT_READONLY_INVENTORY",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
  "TENCENT_READONLY_REGIONS",
  "TENCENT_READONLY_ALLOWED_APIS",
  "TENCENT_READONLY_ACCOUNT_ID",
]);

const FORBIDDEN_SECRET_KEYS = new Set([
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "RUN_TENCENT_CREATE_RELEASE",
  "LANGFUSE_SECRET_KEY",
  "GITHUB_TOKEN",
  "DATABASE_URL",
  "SSH_PRIVATE_KEY",
  "kubeconfig",
  "raw API Key",
  "rawApiKey",
  "apiKey",
]);

const ALLOWED_API_PREFIXES = ["Describe", "List", "Get", "Head"];
const FORBIDDEN_API_PREFIXES = [
  "Create",
  "Delete",
  "Modify",
  "Run",
  "Terminate",
  "Attach",
  "Detach",
  "PutBucket",
  "PutObject",
  "DeleteObject",
  "Update",
];
const FORBIDDEN_API_NAMES = new Set([
  "TagResources",
  "UntagResources",
  "TagMutation",
  "PolicyMutation",
  "ReadObjectBody",
  "GetObjectBody",
]);

const REQUIRED_OWNERSHIP_FIELDS = [
  "accountId",
  "workspaceId",
  "resourceOrderId",
  "resourceBindingId",
  "serverPlanId",
  "resourceType",
  "region",
];

const OUTPUT_FORBIDDEN_KEYS = new Set([
  "SecretId",
  "SecretKey",
  "token",
  "bearerToken",
  "kubeconfig",
  "rawApiKey",
  "apiKey",
  "objectKey",
  "storageKey",
  "cosPrefix",
  "signedUrl",
  "rawCloudObject",
  "providerRawResponse",
  "bucketPolicy",
  "cosObjectBody",
  "privateIp",
  "createdAt",
  "metadata",
  "tags",
]);

function text(value = "") {
  return String(value ?? "").trim();
}

function listFromCsv(value = "") {
  return text(value)
    .split(",")
    .map((item) => text(item))
    .filter(Boolean);
}

function uniqueSorted(values = []) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))].sort();
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

function present(value) {
  return text(value) ? "present" : "missing";
}

function assertNoForbiddenSecretKeys(env = {}) {
  for (const key of Object.keys(env || {})) {
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      throw new Error(`readonly_inventory_forbidden_secret_key:${key}`);
    }
  }
}

export function assertReadonlyInventoryApiAllowlist(apis = []) {
  const normalized = Array.isArray(apis) ? apis.map((api) => text(api)).filter(Boolean) : listFromCsv(apis);
  if (normalized.length === 0) {
    throw new Error("readonly_inventory_api_allowlist_required");
  }
  for (const api of normalized) {
    const lower = api.toLowerCase();
    const forbiddenByPrefix = FORBIDDEN_API_PREFIXES.some((prefix) => api.startsWith(prefix));
    const forbiddenByName = FORBIDDEN_API_NAMES.has(api) || lower.includes("mutation") || lower.includes("policy");
    if (forbiddenByPrefix || forbiddenByName) {
      throw new Error(`readonly_inventory_forbidden_api:${api}`);
    }
    const allowed = ALLOWED_API_PREFIXES.some((prefix) => api.startsWith(prefix));
    if (!allowed) {
      throw new Error(`readonly_inventory_forbidden_api:${api}`);
    }
  }
  return normalized;
}

export function validateReadonlyInventorySecretEnv(env = {}) {
  assertNoForbiddenSecretKeys(env);
  const allowedApis = assertReadonlyInventoryApiAllowlist(env.TENCENT_READONLY_ALLOWED_APIS || "");
  const regions = listFromCsv(env.TENCENT_READONLY_REGIONS);
  return {
    enabled: text(env.RUN_TENCENT_READONLY_INVENTORY) === "1" || text(env.RUN_TENCENT_READONLY_INVENTORY).toLowerCase() === "true",
    readonlyCredentialStatus: {
      id: present(env.TENCENT_READONLY_SECRET_ID),
      key: present(env.TENCENT_READONLY_SECRET_KEY),
    },
    regions,
    allowedApis,
    accountMasked: maskIdentifier(env.TENCENT_READONLY_ACCOUNT_ID),
  };
}

function resourceRef(resource = {}) {
  return text(resource.resourceRef || resource.id || resource.resourceId || "unknown-resource");
}

function tagsFor(resource = {}) {
  const tags = resource.tags && typeof resource.tags === "object" ? resource.tags : {};
  return Object.fromEntries(Object.entries(tags).map(([key, value]) => [key, text(value)]));
}

function ledgerResources(portalLedger = {}) {
  return Array.isArray(portalLedger.resources) ? portalLedger.resources : [];
}

function ownershipKey(record = {}) {
  return [
    text(record.accountId),
    text(record.workspaceId),
    text(record.resourceOrderId),
    text(record.resourceBindingId),
    text(record.serverPlanId),
    text(record.runId || ""),
    text(record.resourceType),
    text(record.region),
  ].join("|");
}

function ledgerIndex(portalLedger = {}) {
  const index = new Map();
  for (const entry of ledgerResources(portalLedger)) {
    index.set(ownershipKey(entry), entry);
  }
  return index;
}

function missingFields(tags = {}) {
  return REQUIRED_OWNERSHIP_FIELDS.filter((field) => !text(tags[field]));
}

function findLedgerByBinding(portalLedger = {}, tags = {}) {
  return ledgerResources(portalLedger).find((entry) => (
    text(entry.resourceBindingId) === text(tags.resourceBindingId)
    && text(entry.accountId) === text(tags.accountId)
  ));
}

function auditItem(resource = {}, reason = "", tags = {}) {
  const missing = missingFields(tags);
  return {
    resourceRef: resourceRef(resource),
    resourceType: text(resource.resourceType || tags.resourceType || "unknown"),
    region: text(resource.region || tags.region || "unknown"),
    reason,
    portalMappingStatus: "audit_required",
    tagCompleteness: missing.length === 0 ? "complete" : "missing",
  };
}

function classifyResource(resource = {}, portalLedger = {}, index = new Map()) {
  const tags = tagsFor(resource);
  const missing = missingFields(tags);
  if (missing.length > 0) {
    return { status: "audit_required", reason: "missing_tags", tags };
  }
  if (text(resource.region) && text(tags.region) && text(resource.region) !== text(tags.region)) {
    return { status: "audit_required", reason: "region_mismatch", tags };
  }
  const directMatch = index.get(ownershipKey(tags));
  if (directMatch) {
    return { status: "mapped", tags };
  }
  const sameBinding = findLedgerByBinding(portalLedger, tags);
  if (sameBinding) {
    if (text(sameBinding.region) !== text(resource.region || tags.region)) {
      return { status: "audit_required", reason: "region_mismatch", tags };
    }
    return { status: "audit_required", reason: "tag_conflict", tags };
  }
  return { status: "audit_required", reason: "orphan_resource", tags };
}

function sanitizeResource(resource = {}) {
  return {
    resourceRef: resourceRef(resource),
    resourceType: text(resource.resourceType || "unknown"),
    resourceStatus: text(resource.resourceStatus || resource.status || "unknown"),
    region: text(resource.region || "unknown"),
  };
}

function assertProvider(provider = {}) {
  if (!provider || typeof provider.listReadonlyInventoryResources !== "function") {
    throw new Error("readonly_inventory_provider_required");
  }
}

function assertNoForbiddenOutputFields(value, path = "inventory") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenOutputFields(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (OUTPUT_FORBIDDEN_KEYS.has(key)) {
      throw new Error(`readonly_inventory_forbidden_output_field:${path}.${key}`);
    }
    assertNoForbiddenOutputFields(nested, `${path}.${key}`);
  }
}

export function createMockTencentReadonlyInventoryProvider({ resources = [] } = {}) {
  const fixture = resources.map((resource) => ({ ...resource }));
  return Object.freeze({
    name: "mock/tencent-readonly-inventory-provider",
    mode: "mock_snapshot",
    listReadonlyInventoryResources() {
      return fixture.map((resource) => ({ ...resource }));
    },
  });
}

export async function runTencentReadonlyInventory({ provider, portalLedger = {}, env = {} } = {}) {
  assertProvider(provider);
  const secretSummary = validateReadonlyInventorySecretEnv(env);
  const resources = await provider.listReadonlyInventoryResources();
  const index = ledgerIndex(portalLedger);

  const auditQueueItems = [];
  const mappedResources = [];
  let missingTagCount = 0;
  let orphanResourceCount = 0;
  let conflictCount = 0;

  for (const resource of resources) {
    assertNoForbiddenOutputFields(sanitizeResource(resource));
    const classification = classifyResource(resource, portalLedger, index);
    if (classification.status === "mapped") {
      mappedResources.push(sanitizeResource(resource));
      continue;
    }
    if (classification.reason === "missing_tags") missingTagCount += 1;
    if (classification.reason === "orphan_resource") orphanResourceCount += 1;
    if (classification.reason === "tag_conflict" || classification.reason === "region_mismatch") conflictCount += 1;
    auditQueueItems.push(auditItem(resource, classification.reason, classification.tags));
  }

  const sanitizedMapped = mappedResources.map(sanitizeResource);
  const output = {
    accountMasked: secretSummary.accountMasked,
    region: uniqueSorted(resources.map((resource) => resource.region)),
    resourceType: uniqueSorted(sanitizedMapped.map((resource) => resource.resourceType)),
    resourceStatus: uniqueSorted(sanitizedMapped.map((resource) => resource.resourceStatus)),
    tagCompleteness: {
      complete: resources.length - missingTagCount,
      missing: missingTagCount,
    },
    portalMappingStatus: {
      mapped: mappedResources.length,
      audit_required: auditQueueItems.length,
    },
    orphanResourceCount,
    missingTagCount,
    conflictCount,
    auditQueueItems,
    lifecycleSafety: {
      inventoryOnlyEvidence: true,
      releaseDeletesFileSpace: false,
      fileSpaceDeleteTriggersRetentionDays: 7,
      createReleaseMutationTriggered: false,
    },
  };
  assertNoForbiddenOutputFields(output);
  return output;
}

export const readonlyInventoryContract = Object.freeze({
  providerPackage: "Tencent Provider",
  stage: "readonly/tencent inventory",
  implementsRealCloudCall: false,
  readsSecretNow: false,
  secretLoadMode: "allowlist_only",
  allowedSecretKeys: [...READONLY_SECRET_KEYS],
  allowedApiPrefixes: [...ALLOWED_API_PREFIXES],
});
