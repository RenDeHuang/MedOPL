import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createTencentReadonlyInventoryLiveAdapter } from "../services/portal/src/domain/tencent-readonly-inventory-live-adapter.mjs";
import { createTencentReadonlyInventorySdkClient } from "../services/portal/src/domain/tencent-readonly-inventory-sdk-client.mjs";

const modulePath = "services/portal/src/domain/tencent-readonly-inventory-sdk-client.mjs";
const contractPath = "docs/contracts/v22-tencent-readonly-inventory-boundary.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

const allowedApis = [
  "DescribeAccount",
  "DescribeRegions",
  "DescribeInstances",
  "DescribeClusters",
  "ListBuckets",
  "HeadObject",
  "DescribeBillSummary",
  "DescribeTagResources",
];

function assertThrowsCode(fn, code) {
  assert.throws(fn, (error) => error?.message === code, `expected_error:${code}`);
}

async function assertRejectsCode(promise, code) {
  await assert.rejects(promise, (error) => error?.message === code, `expected_error:${code}`);
}

function assertNotContainsForbidden(value, label) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    "secret-id-proof",
    "secret-key-proof",
    "token-proof",
    "kubeconfig-proof",
    "object-key-proof",
    "storage-key-proof",
    "cos-prefix-proof",
    "signed-url-proof",
    "bucket-policy-proof",
    "cos-object-body-proof",
    "raw-sdk-response-proof",
    "raw-request-proof",
    "raw-endpoint-proof",
    "authorization-header-proof",
    "permission-denied-raw-proof",
    "rate-limited-raw-proof",
    "region-unavailable-raw-proof",
  ];
  for (const phrase of forbidden) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
  assert.equal(
    /SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|cosPrefix|signedUrl|bucketPolicy|cosObjectBody|rawRequest|rawResponse|rawEndpoint|authorizationHeader|rawSdkResponse/i.test(serialized),
    false,
    `${label}_must_not_contain_forbidden_key`,
  );
}

function assertPageShape(page, label) {
  assert(Array.isArray(page.items), `${label}_items_required`);
  assert("nextCursor" in page, `${label}_next_cursor_required`);
  assertNotContainsForbidden(page, label);
  for (const item of page.items) {
    assert("region" in item, `${label}_item_region_required`);
    assert("resourceType" in item, `${label}_item_resource_type_required`);
    assert("resourceStatus" in item, `${label}_item_status_required`);
    assert("tags" in item, `${label}_item_tags_required`);
    assert.equal("rawResponse" in item, false, `${label}_must_not_return_raw_response`);
  }
}

function assertSafeError(error, label) {
  assert(error && typeof error === "object", `${label}_error_object_required`);
  assert.deepEqual(Object.keys(error).sort(), [
    "apiName",
    "category",
    "clientMethod",
    "code",
    "message",
    "providerCode",
    "region",
    "resourceType",
    "retryable",
  ].sort(), `${label}_error_keys`);
  assertNotContainsForbidden(error, `${label}_error`);
}

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

function createFakeSdk() {
  const calls = [];
  const failMutation = (name) => () => {
    calls.push(name);
    throw new Error(`${name}_must_not_be_called`);
  };
  const pages = {
    DescribeInstances: {
      "ap-guangzhou:": {
        items: [
          {
            InstanceId: "ins-001",
            InstanceState: "RUNNING",
            Tags: ownershipTags(),
            SecretId: "secret-id-proof",
            RawResponse: "raw-sdk-response-proof",
          },
        ],
        NextToken: "page-2",
        Response: "raw-sdk-response-proof",
      },
      "ap-guangzhou:page-2": {
        items: [
          {
            InstanceId: "ins-002",
            InstanceState: "RUNNING",
            Tags: ownershipTags({ cloudOperationId: "operation-002", resourceBindingId: "binding-002" }),
          },
        ],
        NextToken: "",
      },
      "ap-shanghai:": { items: [], NextToken: "" },
    },
    DescribeClusters: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": {
        error: {
          code: "RegionUnavailable",
          message: "region-unavailable-raw-proof",
          rawResponse: "raw-sdk-response-proof",
          endpoint: "raw-endpoint-proof",
          authorizationHeader: "authorization-header-proof",
        },
      },
    },
    ListBuckets: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": {
        items: [
          {
            BucketRef: "bucket-001",
            PrefixRef: "prefix-001",
            Status: "available",
            Tags: ownershipTags({
              cloudOperationId: "operation-storage-001",
              resourceBindingId: "binding-storage-001",
              serverPlanId: "storage_100gb",
              runId: "run-001",
              resourceType: "file_space",
              region: "ap-shanghai",
            }),
            objectKey: "object-key-proof",
            storageKey: "storage-key-proof",
            cosPrefix: "cos-prefix-proof",
            signedUrl: "signed-url-proof",
            BucketPolicy: "bucket-policy-proof",
          },
        ],
        NextToken: "",
      },
    },
    DescribeBillSummary: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": {
        error: {
          code: "RateLimitExceeded",
          message: "rate-limited-raw-proof",
          rawResponse: "raw-sdk-response-proof",
        },
      },
    },
    DescribeTagResources: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": { items: [], NextToken: "" },
    },
  };

  function page(apiName, params = {}) {
    calls.push(apiName);
    const key = `${params.Region || params.region}:${params.Cursor || params.cursor || ""}`;
    const response = pages[apiName]?.[key] || { items: [], NextToken: "" };
    if (response.error) {
      const error = new Error(response.error.message);
      error.code = response.error.code;
      error.rawResponse = response.error.rawResponse;
      error.endpoint = response.error.endpoint;
      error.authorizationHeader = response.error.authorizationHeader;
      throw error;
    }
    return response;
  }

  return {
    calls,
    DescribeAccount(params = {}) {
      calls.push("DescribeAccount");
      assert.equal(params.SecretId, undefined, "sdk_params_must_not_include_secret_id");
      return {
        AccountId: "tencent-account-1234567890",
        SecretId: "secret-id-proof",
        SecretKey: "secret-key-proof",
        RawResponse: "raw-sdk-response-proof",
      };
    },
    DescribeRegions() {
      calls.push("DescribeRegions");
      return {
        Regions: [{ Region: "ap-guangzhou" }, { Region: "ap-shanghai" }],
        RawResponse: "raw-sdk-response-proof",
      };
    },
    DescribeInstances(params) {
      return page("DescribeInstances", params);
    },
    DescribeClusters(params) {
      return page("DescribeClusters", params);
    },
    ListBuckets(params) {
      return page("ListBuckets", params);
    },
    HeadObject(params = {}) {
      calls.push("HeadObject");
      assert.equal(typeof params.BucketRef, "string", "head_object_bucket_ref_required");
      assert.equal(typeof params.PrefixRef, "string", "head_object_prefix_ref_required");
      return {
        Exists: true,
        MetadataSummary: { sizeBytes: 4096, checksumStatus: "present" },
        BillingSummary: { amountCny: "3.20" },
        objectKey: "object-key-proof",
        cosObjectBody: "cos-object-body-proof",
        rawResponse: "raw-sdk-response-proof",
      };
    },
    DescribeBillSummary(params) {
      return page("DescribeBillSummary", params);
    },
    DescribeTagResources(params) {
      return page("DescribeTagResources", params);
    },
    CreateInstances: failMutation("CreateInstances"),
    DeleteBucket: failMutation("DeleteBucket"),
    ModifyInstancesAttribute: failMutation("ModifyInstancesAttribute"),
    RunInstances: failMutation("RunInstances"),
    TerminateInstances: failMutation("TerminateInstances"),
    PutObject: failMutation("PutObject"),
    UpdateTags: failMutation("UpdateTags"),
    AttachDisks: failMutation("AttachDisks"),
    DetachDisks: failMutation("DetachDisks"),
  };
}

const fakeSdk = createFakeSdk();
const client = createTencentReadonlyInventorySdkClient({
  sdk: fakeSdk,
  credentials: {
    SecretId: "secret-id-proof",
    SecretKey: "secret-key-proof",
    token: "token-proof",
  },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou", "ap-shanghai"],
});

assert.equal(typeof client.describeAccount, "function", "describeAccount_method_required");
assert.equal(typeof client.describeRegions, "function", "describeRegions_method_required");
assert.equal(typeof client.describeCvmInstances, "function", "describeCvmInstances_method_required");
assert.equal(typeof client.describeTkeClusters, "function", "describeTkeClusters_method_required");
assert.equal(typeof client.describeCosBuckets, "function", "describeCosBuckets_method_required");
assert.equal(typeof client.describeCosMetadata, "function", "describeCosMetadata_method_required");
assert.equal(typeof client.describeBillingSummary, "function", "describeBillingSummary_method_required");
assert.equal(typeof client.describeTagResources, "function", "describeTagResources_method_required");
assert.equal("rawClient" in client, false, "raw_client_must_not_be_exposed");
assert.equal("sdk" in client, false, "sdk_must_not_be_exposed");
assert.equal("call" in client, false, "generic_call_must_not_be_exposed");
for (const key of Object.keys(client)) {
  assert.equal(/Create|Delete|Modify|Run|Terminate|Put|Update|Attach|Detach/i.test(key), false, `mutation_method_must_not_be_visible:${key}`);
}

const account = await client.describeAccount();
assert.deepEqual(account, {
  accountMasked: "tencent-account-****7890",
  resourceType: "account",
  resourceStatus: "available",
});
assertNotContainsForbidden(account, "account_summary");

const regions = await client.describeRegions();
assert.deepEqual(regions, {
  items: [{ region: "ap-guangzhou" }, { region: "ap-shanghai" }],
  nextCursor: "",
});

const computePage1 = await client.describeCvmInstances({ region: "ap-guangzhou" });
assertPageShape(computePage1, "compute_page_1");
assert.equal(computePage1.items.length, 1, "compute_page_1_count");
assert.equal(computePage1.nextCursor, "page-2", "compute_page_1_cursor");
const computePage2 = await client.describeCvmInstances({ region: "ap-guangzhou", cursor: computePage1.nextCursor });
assertPageShape(computePage2, "compute_page_2");
assert.equal(computePage2.items.length, 1, "compute_page_2_count");
const storagePage = await client.describeCosBuckets({ region: "ap-shanghai" });
assertPageShape(storagePage, "storage_page");
const metadata = await client.describeCosMetadata({
  region: "ap-shanghai",
  bucketRef: storagePage.items[0].bucketRef,
  prefixRef: storagePage.items[0].prefixRef,
});
assert.deepEqual(metadata, {
  region: "ap-shanghai",
  resourceType: "file_space",
  resourceStatus: "metadata_available",
  metadataSummary: { sizeBytes: 4096, checksumStatus: "present" },
  billingSummary: { amountCny: "3.20" },
});
assertNotContainsForbidden(metadata, "cos_metadata");

let permissionError;
try {
  await client.describeTkeClusters({ region: "ap-shanghai" });
} catch (error) {
  permissionError = error;
}
assertSafeError(permissionError, "region_unavailable");
assert.equal(permissionError.category, "region_unavailable", "region_unavailable_category");

let rateLimitError;
try {
  await client.describeBillingSummary({ region: "ap-shanghai" });
} catch (error) {
  rateLimitError = error;
}
assertSafeError(rateLimitError, "rate_limited");
assert.equal(rateLimitError.category, "rate_limited", "rate_limited_category");
assert.equal(rateLimitError.retryable, true, "rate_limited_retryable");

const permissionSdk = {
  ...createFakeSdk(),
  DescribeInstances() {
    const error = new Error("permission-denied-raw-proof");
    error.code = "PermissionDenied";
    error.rawResponse = "raw-sdk-response-proof";
    throw error;
  },
};
const permissionClient = createTencentReadonlyInventorySdkClient({
  sdk: permissionSdk,
  credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou"],
});
let deniedError;
try {
  await permissionClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  deniedError = error;
}
assertSafeError(deniedError, "permission_denied");
assert.equal(deniedError.category, "permission_denied", "permission_denied_category");

assertThrowsCode(() => createTencentReadonlyInventorySdkClient({
  sdk: fakeSdk,
  credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis: [],
  regions: ["ap-guangzhou"],
}), "readonly_inventory_api_allowlist_required");
assertThrowsCode(() => createTencentReadonlyInventorySdkClient({
  sdk: fakeSdk,
  credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis: ["DescribeInstances", "CreateInstances"],
  regions: ["ap-guangzhou"],
}), "readonly_inventory_forbidden_api:CreateInstances");
const limitedClient = createTencentReadonlyInventorySdkClient({
  sdk: fakeSdk,
  credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis: ["DescribeAccount"],
  regions: ["ap-guangzhou"],
});
await assertRejectsCode(limitedClient.describeRegions(), "readonly_inventory_sdk_api_not_allowed:DescribeRegions");

const liveAdapter = createTencentReadonlyInventoryLiveAdapter({ client });
assert.equal(typeof liveAdapter.listReadonlyInventoryResources, "function", "live_adapter_should_accept_sdk_wrapper");

for (const mutation of ["Create", "Delete", "Modify", "Run", "Terminate", "Put", "Update", "Attach", "Detach"]) {
  assert.equal(fakeSdk.calls.some((call) => call.startsWith(mutation)), false, `mutation_sdk_call_must_not_happen:${mutation}`);
}

const source = await readFile(modulePath, "utf8");
assert.equal(source.includes("process.env"), false, "sdk_client_must_not_read_process_env");
assert.equal(source.includes("/home/dev/.secrets/medopl/secrets.env.txt"), false, "sdk_client_must_not_read_secret_file");
assert.equal(source.includes("fs.readFile"), false, "sdk_client_must_not_read_files");
assert.equal(source.includes("tencentcloud-sdk-nodejs"), false, "sdk_client_must_not_import_real_sdk");
assert.equal(source.includes("@tencentcloud"), false, "sdk_client_must_not_import_real_sdk_namespace");
assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(source), false, "sdk_client_must_not_passthrough_mutation_methods");
assert.equal(/call\s*\(\s*apiName/.test(source), false, "sdk_client_must_not_expose_generic_api_call");

const contract = await readFile(contractPath, "utf8");
for (const phrase of [
  "SDK adapter 属于 readonly inventory 实现层，不是 create/release",
  "当前分支不读取 secret、不运行真实云盘点",
  "SDK 只能隐藏在 thin client wrapper 里",
  "业务层只允许使用 inventory client interface",
  "不能暴露 Tencent SDK raw client 或通用 call(apiName, params)",
  "不允许 Create/Delete/Modify/Run/Terminate 等 mutation API",
]) {
  assert(contract.includes(phrase), `contract_missing_sdk_implementation_note:${phrase}`);
}

const suite = await readFile(suitePath, "utf8");
assert(suite.includes("smoke-test-v22-tencent-readonly-inventory-sdk-client.mjs"), "mvp_suite_must_include_sdk_client_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_sdk_client",
  checked: [
    "semantic_inventory_client_interface",
    "fake_sdk_pagination_and_multi_region",
    "api_allowlist_fail_closed",
    "no_raw_client_or_generic_call",
    "no_mutation_api_visibility_or_calls",
    "safe_response_normalization",
    "safe_error_normalization",
    "cos_metadata_without_object_body",
    "live_adapter_shape_compatibility",
    "implementation_note",
  ],
}, null, 2));
