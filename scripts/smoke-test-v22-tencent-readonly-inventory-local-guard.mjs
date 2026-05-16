import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  assertReadonlyInventoryApiAllowlist,
  createMockTencentReadonlyInventoryProvider,
  runTencentReadonlyInventory,
  validateReadonlyInventorySecretEnv,
} from "../services/portal/src/domain/tencent-readonly-inventory-provider.mjs";

const modulePath = "services/portal/src/domain/tencent-readonly-inventory-provider.mjs";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

function assertThrowsCode(fn, code) {
  assert.throws(fn, (error) => error?.message === code, `expected_error:${code}`);
}

function assertNotContainsForbidden(value, label) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    "secret-id-proof",
    "secret-key-proof",
    "mutation-secret",
    "github-token-proof",
    "database-url-proof",
    "ssh-private-key-proof",
    "kubeconfig-proof",
    "raw-api-key-proof",
    "token-proof",
    "object-key-proof",
    "storage-key-proof",
    "cos-prefix-proof",
    "signed-url-proof",
    "raw-cloud-object-proof",
    "provider-raw-response-proof",
    "bucket-policy-proof",
    "cos-object-body-proof",
    "10.0.0.7",
    "2026-05-09T00:00:00.000Z",
  ];
  for (const phrase of forbidden) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
  assert.equal(/SecretId|SecretKey|kubeconfig|rawApiKey|apiKey|objectKey|storageKey|cosPrefix|signedUrl|rawCloudObject|providerRawResponse|bucketPolicy|cosObjectBody|privateIp|createdAt/i.test(serialized), false, `${label}_must_not_contain_forbidden_field`);
}

function assertOnlyKeys(object = {}, allowed = new Set(), label = "object") {
  for (const key of Object.keys(object)) {
    assert(allowed.has(key), `${label}_unexpected_key:${key}`);
  }
}

const readonlyEnv = {
  RUN_TENCENT_READONLY_INVENTORY: "1",
  TENCENT_READONLY_SECRET_ID: "secret-id-proof",
  TENCENT_READONLY_SECRET_KEY: "secret-key-proof",
  TENCENT_READONLY_REGIONS: "ap-guangzhou,na-siliconvalley-1",
  TENCENT_READONLY_ALLOWED_APIS: "DescribeInstances,ListBuckets,GetBucketTagging,HeadObject,DescribeBillSummary",
  TENCENT_READONLY_ACCOUNT_ID: "tencent-account-1234567890",
};

const envSummary = validateReadonlyInventorySecretEnv(readonlyEnv);
assert.deepEqual(envSummary, {
  enabled: true,
  readonlyCredentialStatus: {
    id: "present",
    key: "present",
  },
  regions: ["ap-guangzhou", "na-siliconvalley"],
  allowedApis: ["DescribeInstances", "ListBuckets", "GetBucketTagging", "HeadObject", "DescribeBillSummary"],
  accountMasked: "tencent-account-****7890",
});
assertNotContainsForbidden(envSummary, "readonly_secret_summary");

assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  UNLISTED_SECRET_KEY: "must-not-be-accepted",
}), "readonly_inventory_non_allowlist_secret_key_rejected:UNLISTED_SECRET_KEY");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  TENCENT_READONLY_EXTRA_KEY: "must-not-be-accepted",
}), "readonly_inventory_non_allowlist_secret_key_rejected:TENCENT_READONLY_EXTRA_KEY");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  TENCENT_MUTATION_SECRET_ID: "mutation-secret",
}), "readonly_inventory_forbidden_secret_key:TENCENT_MUTATION_SECRET_ID");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  TENCENT_MUTATION_SECRET_KEY: "mutation-secret",
}), "readonly_inventory_forbidden_secret_key:TENCENT_MUTATION_SECRET_KEY");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  RUN_TENCENT_CREATE_RELEASE: "1",
}), "readonly_inventory_forbidden_secret_key:RUN_TENCENT_CREATE_RELEASE");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  LANGFUSE_SECRET_KEY: "langfuse-secret",
}), "readonly_inventory_forbidden_secret_key:LANGFUSE_SECRET_KEY");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  GITHUB_TOKEN: "github-token-proof",
}), "readonly_inventory_forbidden_secret_key:GITHUB_TOKEN");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  DATABASE_URL: "database-url-proof",
}), "readonly_inventory_forbidden_secret_key:DATABASE_URL");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  SSH_PRIVATE_KEY: "ssh-private-key-proof",
}), "readonly_inventory_forbidden_secret_key:SSH_PRIVATE_KEY");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  kubeconfig: "kubeconfig-proof",
}), "readonly_inventory_forbidden_secret_key:kubeconfig");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  rawApiKey: "raw-api-key-proof",
}), "readonly_inventory_forbidden_secret_key:rawApiKey");
assertThrowsCode(() => validateReadonlyInventorySecretEnv({
  ...readonlyEnv,
  TENCENT_READONLY_ALLOWED_APIS: "",
}), "readonly_inventory_api_allowlist_required");

assert.deepEqual(assertReadonlyInventoryApiAllowlist([
  "DescribeInstances",
  "ListBuckets",
  "GetBucketTagging",
  "HeadObject",
  "DescribeBillSummary",
]), ["DescribeInstances", "ListBuckets", "GetBucketTagging", "HeadObject", "DescribeBillSummary"]);
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist([]), "readonly_inventory_api_allowlist_required");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["CreateInstances"]), "readonly_inventory_forbidden_api:CreateInstances");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["DeleteObject"]), "readonly_inventory_forbidden_api:DeleteObject");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["ModifyInstancesAttribute"]), "readonly_inventory_forbidden_api:ModifyInstancesAttribute");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["RunInstances"]), "readonly_inventory_forbidden_api:RunInstances");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["TerminateInstances"]), "readonly_inventory_forbidden_api:TerminateInstances");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["AttachDisks"]), "readonly_inventory_forbidden_api:AttachDisks");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["DetachDisks"]), "readonly_inventory_forbidden_api:DetachDisks");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["PutBucketTagging"]), "readonly_inventory_forbidden_api:PutBucketTagging");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["PutObject"]), "readonly_inventory_forbidden_api:PutObject");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["UpdateTag"]), "readonly_inventory_forbidden_api:UpdateTag");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["TagResources"]), "readonly_inventory_forbidden_api:TagResources");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["PolicyMutation"]), "readonly_inventory_forbidden_api:PolicyMutation");
assertThrowsCode(() => assertReadonlyInventoryApiAllowlist(["ReadObjectBody"]), "readonly_inventory_forbidden_api:ReadObjectBody");

const portalLedger = {
  resources: [
    {
      accountId: "acct-001",
      workspaceId: "workspace-001",
      cloudOperationId: "operation-001",
      resourceBindingId: "binding-001",
      billingAttributionId: "billing-001",
      serverPlanId: "pro_8c16g_100gb",
      runId: null,
      resourceType: "compute",
      region: "ap-guangzhou",
    },
    {
      accountId: "acct-001",
      workspaceId: "workspace-001",
      cloudOperationId: "operation-002",
      resourceBindingId: "binding-002",
      billingAttributionId: "billing-storage-001",
      serverPlanId: "storage_100gb",
      runId: "run-002",
      resourceType: "file_space",
      region: "ap-guangzhou",
    },
  ],
};

const baseTag = {
  accountId: "acct-001",
  workspaceId: "workspace-001",
  cloudOperationId: "operation-001",
  resourceBindingId: "binding-001",
  billingAttributionId: "billing-001",
  serverPlanId: "pro_8c16g_100gb",
  runId: "",
  resourceType: "compute",
  region: "ap-guangzhou",
};

const provider = createMockTencentReadonlyInventoryProvider({
  resources: [
    {
      id: "cloud-compute-001",
      resourceType: "compute",
      resourceStatus: "running",
      region: "ap-guangzhou",
      tags: baseTag,
      metadata: {
        allowedRead: "cos_metadata",
        usageSummary: { sizeBytes: 1024 },
        billingSummary: { amount: 0 },
        cosObjectBody: "cos-object-body-proof",
        objectKey: "object-key-proof",
        storageKey: "storage-key-proof",
        cosPrefix: "cos-prefix-proof",
        signedUrl: "signed-url-proof",
        rawCloudObject: { proof: "raw-cloud-object-proof" },
        providerRawResponse: "provider-raw-response-proof",
        bucketPolicy: "bucket-policy-proof",
        privateIp: "10.0.0.7",
        createdAt: "2026-05-09T00:00:00.000Z",
        SecretId: "secret-id-proof",
        token: "token-proof",
      },
    },
    {
      id: "cloud-storage-002",
      resourceType: "file_space",
      resourceStatus: "available",
      region: "ap-guangzhou",
      tags: {
        accountId: "acct-001",
        workspaceId: "workspace-001",
        cloudOperationId: "operation-002",
        resourceBindingId: "binding-002",
        billingAttributionId: "billing-storage-001",
        serverPlanId: "storage_100gb",
        runId: "run-002",
        resourceType: "file_space",
        region: "ap-guangzhou",
      },
    },
    {
      id: "cloud-missing-tag",
      resourceType: "compute",
      resourceStatus: "running",
      region: "ap-guangzhou",
      tags: {
        accountId: "acct-001",
        workspaceId: "workspace-001",
        cloudOperationId: "operation-001",
        resourceBindingId: "binding-001",
        billingAttributionId: "billing-001",
        serverPlanId: "",
        resourceType: "compute",
        region: "ap-guangzhou",
      },
    },
    {
      id: "cloud-conflict",
      resourceType: "compute",
      resourceStatus: "running",
      region: "ap-guangzhou",
      tags: {
        ...baseTag,
        workspaceId: "workspace-conflict",
      },
    },
    {
      id: "cloud-orphan",
      resourceType: "compute",
      resourceStatus: "running",
      region: "ap-guangzhou",
      tags: {
        accountId: "acct-orphan",
        workspaceId: "workspace-orphan",
        cloudOperationId: "operation-orphan",
        resourceBindingId: "binding-orphan",
        billingAttributionId: "billing-orphan",
        serverPlanId: "pro_8c16g_100gb",
        resourceType: "compute",
        region: "ap-guangzhou",
      },
    },
    {
      id: "cloud-region-mismatch",
      resourceType: "compute",
      resourceStatus: "running",
      region: "na-siliconvalley",
      tags: baseTag,
    },
  ],
});

const inventory = await runTencentReadonlyInventory({ provider, portalLedger, env: readonlyEnv });

assertOnlyKeys(inventory, new Set([
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
  "lifecycleSafety",
]), "inventory_output");
assert.equal(inventory.accountMasked, "tencent-account-****7890", "inventory_account_masked_mismatch");
assert.deepEqual(inventory.region, ["ap-guangzhou", "na-siliconvalley"], "inventory_regions_mismatch");
assert.deepEqual(inventory.resourceType, ["compute", "file_space"], "inventory_resource_type_summary_mismatch");
assert.deepEqual(inventory.resourceStatus, ["available", "running"], "inventory_resource_status_summary_mismatch");
assert.deepEqual(inventory.tagCompleteness, { complete: 5, missing: 1 }, "inventory_tag_completeness_mismatch");
assert.deepEqual(inventory.portalMappingStatus, { mapped: 2, audit_required: 4 }, "inventory_mapping_status_mismatch");
assert.equal(inventory.orphanResourceCount, 1, "inventory_orphan_count_mismatch");
assert.equal(inventory.missingTagCount, 1, "inventory_missing_tag_count_mismatch");
assert.equal(inventory.conflictCount, 2, "inventory_conflict_count_mismatch");
assert.deepEqual(inventory.lifecycleSafety, {
  inventoryOnlyEvidence: true,
  releaseDeletesFileSpace: false,
  fileSpaceDeleteTriggersRetentionDays: 7,
  createReleaseMutationTriggered: false,
}, "inventory_lifecycle_safety_mismatch");

const auditReasons = inventory.auditQueueItems.map((item) => item.reason).sort();
assert.deepEqual(auditReasons, [
  "missing_tags",
  "orphan_resource",
  "region_mismatch",
  "tag_conflict",
].sort(), "inventory_audit_reasons_mismatch");
for (const item of inventory.auditQueueItems) {
  assertOnlyKeys(item, new Set([
    "resourceRef",
    "resourceType",
    "region",
    "reason",
    "portalMappingStatus",
    "tagCompleteness",
  ]), "audit_queue_item");
}
assertNotContainsForbidden(inventory, "inventory_output");

const moduleSource = await readFile(modulePath, "utf8");
const suiteSource = await readFile(suitePath, "utf8");

for (const forbidden of [
  "tencentcloud-sdk-nodejs",
  "@tencentcloud",
  "secrets.env.txt",
  "fs.readFile",
  "readFile(",
  "process.env.TENCENT",
]) {
  assert.equal(moduleSource.includes(forbidden), false, `module_source_must_not_include:${forbidden}`);
}
assert(suiteSource.includes("smoke-test-v22-tencent-readonly-inventory-local-guard"), "mvp_suite_must_include_local_guard_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_local_guard",
  covered: [
    "readonly_secret_allowlist",
    "mutation_secret_rejection",
    "readonly_api_allowlist",
    "mutation_api_rejection",
    "cos_metadata_usage_billing_summary_without_object_body",
    "portal_ledger_cloud_tag_double_check",
    "audit_queue_fail_closed",
    "redacted_inventory_output",
    "no_real_cloud_sdk_or_secret_file_reads",
  ],
}, null, 2));
