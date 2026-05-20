import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  collectTencentReadonlyInventory,
  createTencentReadonlyInventoryAdapter,
} from "../../../services/portal/src/domain/tencent-readonly-inventory-adapter.mjs";

const inventoryAdapterPath = "services/portal/src/domain/tencent-readonly-inventory-adapter.mjs";
const suitePath = "tests/contract/smoke-test-v22-mvp-contract-suite.mjs";

const readonlyEnv = {
  RUN_TENCENT_READONLY_INVENTORY: "1",
  TENCENT_READONLY_SECRET_ID: "secret-id-proof",
  TENCENT_READONLY_SECRET_KEY: "secret-key-proof",
  TENCENT_READONLY_REGIONS: "ap-guangzhou,ap-shanghai",
  TENCENT_READONLY_ALLOWED_APIS: [
    "DescribeAccount",
    "DescribeRegions",
    "DescribeInstances",
    "DescribeClusters",
    "ListBuckets",
    "HeadObject",
    "DescribeBillSummary",
    "DescribeTagResources",
  ].join(","),
  TENCENT_READONLY_ACCOUNT_ID: "tencent-account-1234567890",
};

const portalLedger = {
  resources: [
    {
      accountId: "acct-001",
      workspaceId: "workspace-001",
      cloudOperationId: "operation-001",
      resourceBindingId: "binding-001",
      serverPlanId: "pro_8c16g_100gb",
      runId: "",
      resourceType: "compute",
      region: "ap-guangzhou",
    },
    {
      accountId: "acct-001",
      workspaceId: "workspace-001",
      cloudOperationId: "operation-002",
      resourceBindingId: "binding-002",
      serverPlanId: "storage_100gb",
      runId: "run-002",
      resourceType: "file_space",
      region: "ap-shanghai",
    },
    {
      accountId: "acct-001",
      workspaceId: "workspace-001",
      cloudOperationId: "operation-003",
      resourceBindingId: "binding-003",
      serverPlanId: "tag_snapshot",
      runId: "",
      resourceType: "tagged_resource",
      region: "ap-shanghai",
    },
    {
      accountId: "acct-001",
      workspaceId: "workspace-001",
      cloudOperationId: "operation-004",
      resourceBindingId: "binding-004",
      serverPlanId: "billing_snapshot",
      runId: "",
      resourceType: "billing_summary",
      region: "ap-guangzhou",
    },
  ],
};

function ownershipTags(overrides = {}) {
  return {
    accountId: "acct-001",
    workspaceId: "workspace-001",
    cloudOperationId: "operation-001",
    resourceBindingId: "binding-001",
    serverPlanId: "pro_8c16g_100gb",
    runId: "",
    resourceType: "compute",
    region: "ap-guangzhou",
    ...overrides,
  };
}

function assertThrowsCode(fn, code) {
  assert.throws(fn, (error) => error?.message === code, `expected_error:${code}`);
}

function assertNotContainsForbidden(value, label) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    "secret-id-proof",
    "secret-key-proof",
    "mutation-secret-proof",
    "unlisted-secret-proof",
    "token-proof",
    "kubeconfig-proof",
    "object-key-proof",
    "storage-key-proof",
    "cos-prefix-proof",
    "signed-url-proof",
    "raw-cvm-object-proof",
    "cos-object-body-proof",
    "bucket-policy-proof",
    "provider-raw-response-proof",
    "permission-denied-raw-proof",
    "rate-limited-raw-proof",
  ];
  for (const phrase of forbidden) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
  assert.equal(
    /SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|cosPrefix|signedUrl|rawCloudObject|rawCvmObject|cosObjectBody|bucketPolicy|providerRawResponse|rawResponse/i.test(serialized),
    false,
    `${label}_must_not_contain_forbidden_field`,
  );
}

function assertTopLevelOutputWhitelist(output) {
  assert.deepEqual(Object.keys(output).sort(), [
    "accountMasked",
    "auditQueueItems",
    "conflictCount",
    "missingTagCount",
    "orphanResourceCount",
    "portalMappingStatus",
    "region",
    "resourceStatus",
    "resourceType",
    "tagCompleteness",
  ].sort(), "live_inventory_output_top_level_whitelist");
}

function assertReadonlyClientCallsOnly(calls) {
  assert(calls.length > 0, "fake_client_should_have_calls");
  for (const call of calls) {
    assert.match(call, /^(describe|list|get|head)/i, `client_call_must_be_readonly:${call}`);
  }
  for (const mutation of ["Create", "Delete", "Modify", "Run", "Terminate"]) {
    assert.equal(calls.some((call) => call.startsWith(mutation)), false, `mutation_method_must_not_be_called:${mutation}`);
  }
}

function createFakeTencentClient() {
  const calls = [];
  const failMutation = (name) => () => {
    calls.push(name);
    throw new Error(`${name}_must_not_be_called`);
  };
  const pages = {
    describeCvmInstances: {
      "ap-guangzhou:": {
        items: [
          {
            id: "cvm-page-1",
            status: "running",
            tags: ownershipTags(),
            rawCvmObject: "raw-cvm-object-proof",
            providerRawResponse: "provider-raw-response-proof",
          },
        ],
        nextCursor: "page-2",
      },
      "ap-guangzhou:page-2": {
        items: [
          {
            id: "cvm-page-2-missing-tag",
            status: "running",
            tags: ownershipTags({ resourceBindingId: "" }),
          },
          {
            id: "cvm-page-2-conflict",
            status: "running",
            tags: ownershipTags({ cloudOperationId: "operation-conflict" }),
          },
          {
            id: "cvm-page-2-orphan",
            status: "running",
            tags: ownershipTags({
              accountId: "acct-999",
              workspaceId: "workspace-999",
              cloudOperationId: "operation-999",
              resourceBindingId: "binding-999",
            }),
          },
          {
            id: "cvm-page-2-region-mismatch",
            status: "running",
            region: "ap-guangzhou",
            tags: ownershipTags({ region: "ap-shanghai" }),
          },
        ],
        nextCursor: null,
      },
      "ap-shanghai:": {
        error: {
          code: "PermissionDenied",
          message: "permission-denied-raw-proof",
          rawResponse: "provider-raw-response-proof",
        },
      },
    },
    describeTkeClusters: {
      "ap-guangzhou:": { items: [], nextCursor: null },
      "ap-shanghai:": {
        error: {
          code: "RateLimited",
          message: "rate-limited-raw-proof",
          rawResponse: "provider-raw-response-proof",
        },
      },
    },
    describeCosBuckets: {
      "ap-guangzhou:": { items: [], nextCursor: null },
      "ap-shanghai:": {
        items: [
          {
            id: "cos-bucket-002",
            bucketRef: "bucket-redacted-002",
            prefixRef: "prefix-redacted-002",
            status: "available",
            tags: ownershipTags({
              cloudOperationId: "operation-002",
              resourceBindingId: "binding-002",
              serverPlanId: "storage_100gb",
              runId: "run-002",
              resourceType: "file_space",
              region: "ap-shanghai",
            }),
            objectKey: "object-key-proof",
            storageKey: "storage-key-proof",
            cosPrefix: "cos-prefix-proof",
            signedUrl: "signed-url-proof",
            bucketPolicy: "bucket-policy-proof",
          },
        ],
        nextCursor: null,
      },
    },
    describeBillingSummary: {
      "ap-guangzhou:": {
        items: [
          {
            id: "billing-summary-004",
            status: "ready",
            tags: ownershipTags({
              cloudOperationId: "operation-004",
              resourceBindingId: "binding-004",
              serverPlanId: "billing_snapshot",
              resourceType: "billing_summary",
            }),
          },
        ],
        nextCursor: null,
      },
      "ap-shanghai:": { items: [], nextCursor: null },
    },
    describeTagResources: {
      "ap-guangzhou:": { items: [], nextCursor: null },
      "ap-shanghai:": {
        items: [
          {
            id: "tag-resource-003",
            status: "tagged",
            tags: ownershipTags({
              cloudOperationId: "operation-003",
              resourceBindingId: "binding-003",
              serverPlanId: "tag_snapshot",
              resourceType: "tagged_resource",
              region: "ap-shanghai",
            }),
          },
        ],
        nextCursor: null,
      },
    },
  };

  function pageFor(name, region, cursor) {
    calls.push(name);
    const page = pages[name]?.[`${region}:${cursor || ""}`] || { items: [], nextCursor: null };
    if (page.error) {
      const error = new Error(page.error.message);
      error.code = page.error.code;
      error.rawResponse = page.error.rawResponse;
      throw error;
    }
    return page;
  }

  return {
    calls,
    describeAccount() {
      calls.push("describeAccount");
      return { accountMasked: "tencent-account-****7890", SecretId: "secret-id-proof" };
    },
    describeRegions() {
      calls.push("describeRegions");
      return { items: [{ region: "ap-guangzhou" }, { region: "ap-shanghai" }] };
    },
    describeCvmInstances({ region, cursor }) {
      return pageFor("describeCvmInstances", region, cursor);
    },
    describeTkeClusters({ region, cursor }) {
      return pageFor("describeTkeClusters", region, cursor);
    },
    describeCosBuckets({ region, cursor }) {
      return pageFor("describeCosBuckets", region, cursor);
    },
    describeCosMetadata({ region, bucketRef, prefixRef }) {
      calls.push("describeCosMetadata");
      assert.equal(typeof bucketRef, "string", "cos_metadata_bucket_ref_required");
      assert.equal(typeof prefixRef, "string", "cos_metadata_prefix_ref_required");
      return {
        region,
        exists: true,
        usageSummary: { sizeBytes: 4096 },
        billingSummary: { cny: "3.20" },
        cosObjectBody: "cos-object-body-proof",
        objectKey: "object-key-proof",
      };
    },
    describeBillingSummary({ region, cursor }) {
      return pageFor("describeBillingSummary", region, cursor);
    },
    describeTagResources({ region, cursor }) {
      return pageFor("describeTagResources", region, cursor);
    },
    CreateInstances: failMutation("CreateInstances"),
    DeleteBucket: failMutation("DeleteBucket"),
    ModifyInstancesAttribute: failMutation("ModifyInstancesAttribute"),
    RunInstances: failMutation("RunInstances"),
    TerminateInstances: failMutation("TerminateInstances"),
  };
}

const fakeClient = createFakeTencentClient();
const adapter = createTencentReadonlyInventoryAdapter({ client: fakeClient });
const inventory = await collectTencentReadonlyInventory({ adapter, env: readonlyEnv, portalLedger });

assertTopLevelOutputWhitelist(inventory);
assertReadonlyClientCallsOnly(fakeClient.calls);
assert.deepEqual(inventory.region, ["ap-guangzhou", "ap-shanghai"]);
assert(inventory.resourceType.includes("compute"), "mapped_compute_should_be_present");
assert(inventory.resourceType.includes("file_space"), "mapped_file_space_should_be_present");
assert(inventory.resourceType.includes("billing_summary"), "mapped_billing_summary_should_be_present");
assert.equal(inventory.portalMappingStatus.mapped, 4, "mapped_resource_count");
assert.equal(inventory.missingTagCount, 1, "missing_tag_count");
assert.equal(inventory.orphanResourceCount, 1, "orphan_resource_count");
assert.equal(inventory.conflictCount, 4, "conflict_count_includes_tag_region_permission_rate");
assert(inventory.auditQueueItems.some((item) => item.reason === "missing_tags"), "missing_tag_audit_required");
assert(inventory.auditQueueItems.some((item) => item.reason === "tag_conflict"), "tag_conflict_audit_required");
assert(inventory.auditQueueItems.some((item) => item.reason === "orphan_resource"), "orphan_resource_audit_required");
assert(inventory.auditQueueItems.some((item) => item.reason === "region_mismatch"), "region_mismatch_audit_required");
assert(inventory.auditQueueItems.some((item) => item.reason === "readonly_permission_denied"), "permission_denied_audit_required");
assert(inventory.auditQueueItems.some((item) => item.reason === "readonly_rate_limited"), "rate_limited_audit_required");
assertNotContainsForbidden(inventory, "live_inventory_output");

assertThrowsCode(() => createTencentReadonlyInventoryAdapter({ client: {} }), "readonly_inventory_live_client_missing_method:describeAccount");
await assert.rejects(
  collectTencentReadonlyInventory({
    adapter,
    env: { ...readonlyEnv, TENCENT_MUTATION_SECRET_ID: "mutation-secret-proof" },
    portalLedger,
  }),
  (error) => error?.message === "readonly_inventory_forbidden_secret_key:TENCENT_MUTATION_SECRET_ID",
  "mutation_secret_should_fail_closed",
);
await assert.rejects(
  collectTencentReadonlyInventory({
    adapter,
    env: { ...readonlyEnv, UNLISTED_SECRET_KEY: "unlisted-secret-proof" },
    portalLedger,
  }),
  (error) => error?.message === "readonly_inventory_non_allowlist_secret_key_rejected:UNLISTED_SECRET_KEY",
  "unknown_secret_key_should_fail_closed",
);
await assert.rejects(
  collectTencentReadonlyInventory({
    adapter,
    env: { ...readonlyEnv, TENCENT_READONLY_ALLOWED_APIS: "" },
    portalLedger,
  }),
  (error) => error?.message === "readonly_inventory_api_allowlist_required",
  "empty_api_allowlist_should_fail_closed",
);
await assert.rejects(
  collectTencentReadonlyInventory({
    adapter,
    env: { ...readonlyEnv, TENCENT_READONLY_ALLOWED_APIS: "DescribeInstances,CreateInstances" },
    portalLedger,
  }),
  (error) => error?.message === "readonly_inventory_forbidden_api:CreateInstances",
  "mutation_api_should_fail_closed",
);

const source = await readFile(inventoryAdapterPath, "utf8");
assert.equal(source.includes("tencentcloud-sdk-nodejs"), false, "inventory_adapter_must_not_import_tencentcloud_sdk_nodejs");
assert.equal(source.includes("@tencentcloud"), false, "inventory_adapter_must_not_import_at_tencentcloud");
assert.equal(source.includes("/home/dev/.secrets/medopl/secrets.env.txt"), false, "inventory_adapter_must_not_read_secret_file");
assert.equal(source.includes("fs.readFile"), false, "inventory_adapter_must_not_read_files");
assert.equal(source.includes("process.env"), false, "inventory_adapter_must_not_read_process_env");
assert.equal(/Create|Delete|Modify|Run|Terminate|PutObject|DeleteObject/.test(source), false, "inventory_adapter_source_must_not_call_mutation_api");

const suite = await readFile(suitePath, "utf8");
assert(suite.includes("smoke-test-v22-tencent-readonly-inventory-adapter-local-gate.mjs"), "mvp_suite_must_include_inventory_adapter_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_inventory_adapter_shell",
  checked: [
    "live_shaped_client_interface",
    "fake_client_pagination_and_multi_region",
    "permission_denied_and_rate_limited_safe_audit",
    "empty_result_missing_tag_conflict_orphan_region_mismatch",
    "cos_metadata_without_object_body",
    "readonly_api_guard",
    "secret_allowlist_guard",
    "redacted_output_whitelist",
  ],
}, null, 2));
