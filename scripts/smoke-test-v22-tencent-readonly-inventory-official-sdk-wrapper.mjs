import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { collectTencentReadonlyInventory, createTencentReadonlyInventoryLiveAdapter } from "../services/portal/src/domain/tencent-readonly-inventory-live-adapter.mjs";
import { createTencentReadonlyInventoryOfficialSdkModules } from "../services/portal/src/domain/tencent-readonly-inventory-official-sdk-modules.mjs";
import { createTencentReadonlyInventoryRealSdkClient } from "../services/portal/src/domain/tencent-readonly-inventory-real-sdk-client.mjs";
import { createTencentReadonlyInventoryTencentSdkFactory } from "../services/portal/src/domain/tencent-readonly-inventory-tencent-sdk-factory.mjs";
import { runCli } from "./v22-tencent-readonly-inventory-runner.mjs";

const repoRoot = path.resolve(".");
const modulePath = "services/portal/src/domain/tencent-readonly-inventory-official-sdk-modules.mjs";
const runnerPath = "scripts/v22-tencent-readonly-inventory-runner.mjs";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const portalPackagePath = "services/portal/package.json";
const runtimeReportDir = path.join(repoRoot, ".runtime", "v22-tencent-readonly-inventory");
const liveSecretPathProof = ["/home/dev", ".secrets", "medopl", "tencent-readonly-inventory.env"].join("/");

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

const nonCosAllowedApis = allowedApis.filter((apiName) => !["ListBuckets", "HeadObject"].includes(apiName));

function assertNotContainsForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const forbidden = [
    "secret-id-proof",
    "secret-key-proof",
    "token-proof",
    "kubeconfig-proof",
    "authorization-header-proof",
    "header-proof",
    "raw-response-proof",
    "raw-sdk-response-proof",
    "raw-request-proof",
    "raw-endpoint-proof",
    "object-key-proof",
    "storage-key-proof",
    "cos-prefix-proof",
    "signed-url-proof",
    "cos-object-body-proof",
    "bucket-policy-proof",
    "permission-denied-raw-proof",
    "rate-limited-raw-proof",
    "network-error-raw-proof",
  ];
  for (const phrase of forbidden) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
  assert.equal(
    /SecretId|SecretKey|token|kubeconfig|authorization|headers|objectKey|storageKey|cosPrefix|signedUrl|bucketPolicy|cosObjectBody|rawRequest|rawResponse|providerRawResponse|rawEndpoint/i.test(serialized),
    false,
    `${label}_must_not_contain_forbidden_key`,
  );
}

function assertReportWhitelist(report, label) {
  assert.deepEqual(Object.keys(report).sort(), [
    "accountMasked",
    "allowedApis",
    "auditQueueCounts",
    "blockedReason",
    "mode",
    "ok",
    "regions",
    "resourceCounts",
  ].sort(), `${label}_report_whitelist`);
  assertNotContainsForbidden(report, label);
}

function assertPage(page, label) {
  assert(Array.isArray(page.items), `${label}_items_required`);
  assert("nextCursor" in page, `${label}_next_cursor_required`);
  assertNotContainsForbidden(page, label);
}

function assertSafeError(error, category, label) {
  assert(error && typeof error === "object", `${label}_error_object`);
  assert.equal(error.category, category, `${label}_category`);
  assert.equal(typeof error.retryable, "boolean", `${label}_retryable`);
  assertNotContainsForbidden(error, label);
}

function ownershipTags(overrides = {}) {
  return {
    accountId: "acct-001",
    workspaceId: "workspace-001",
    resourceOrderId: "order-001",
    resourceBindingId: "binding-001",
    serverPlanId: "pro_8c16g_100gb",
    runId: "",
    resourceType: "compute",
    region: "ap-guangzhou",
    ...overrides,
  };
}

function createFakeOfficialSdkModules({ cvmError = null, expectedAllowedApis = allowedApis } = {}) {
  const calls = [];
  const mutation = (name) => async () => {
    calls.push(name);
    throw new Error(`${name}_must_not_be_called`);
  };
  const pages = {
    DescribeInstances: {
      "ap-guangzhou:": {
        items: [
          {
            InstanceId: "ins-official-001",
            InstanceState: "RUNNING",
            Tags: ownershipTags(),
            RawResponse: "raw-sdk-response-proof",
            SecretId: "secret-id-proof",
          },
        ],
        NextToken: "page-2",
        Response: "raw-response-proof",
      },
      "ap-guangzhou:page-2": {
        items: [
          {
            InstanceId: "ins-official-002",
            InstanceState: "RUNNING",
            Tags: ownershipTags({ resourceOrderId: "order-002", resourceBindingId: "binding-002" }),
          },
        ],
        NextToken: "",
      },
      "ap-shanghai:": { items: [], NextToken: "" },
    },
    DescribeClusters: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": { items: [], NextToken: "" },
    },
    ListBuckets: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": {
        items: [
          {
            BucketRef: "bucket-official-001",
            PrefixRef: "prefix-official-001",
            Status: "available",
            Tags: ownershipTags({
              resourceOrderId: "order-storage-001",
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
      "ap-shanghai:": { items: [], NextToken: "" },
    },
    DescribeTagResources: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": { items: [], NextToken: "" },
    },
  };

  function page(apiName, params = {}) {
    calls.push(apiName);
    if (apiName === "DescribeInstances" && cvmError) {
      const error = new Error(cvmError.message);
      error.code = cvmError.code;
      error.rawResponse = cvmError.rawResponse;
      error.endpoint = cvmError.endpoint;
      error.authorizationHeader = cvmError.authorizationHeader;
      throw error;
    }
    const key = `${params.Region || ""}:${params.Cursor || ""}`;
    return pages[apiName]?.[key] || { items: [], NextToken: "" };
  }

  function createClient(serviceName, methods) {
    calls.push(`create:${serviceName}`);
    return Object.freeze(methods);
  }

  return {
    calls,
    createAccountClient({ credentials, allowedApis: factoryAllowedApis, regions }) {
      assert.equal(credentials.SecretId, "secret-id-proof", "official_account_factory_receives_private_secret_boundary");
      assert.deepEqual(factoryAllowedApis, expectedAllowedApis, "official_account_factory_receives_allowlist");
      assert.deepEqual(regions, ["ap-guangzhou", "ap-shanghai"], "official_account_factory_receives_regions");
      return createClient("account", {
        async GetCallerIdentity() {
          calls.push("GetCallerIdentity");
          return {
            AccountId: "tencent-account-1234567890",
            SecretId: "secret-id-proof",
            SecretKey: "secret-key-proof",
            RawResponse: "raw-sdk-response-proof",
          };
        },
        createAccount: mutation("createAccount"),
      });
    },
    createRegionClient() {
      return createClient("region", {
        async describeRegions() {
          calls.push("DescribeRegions");
          return {
            Regions: [{ Region: "ap-guangzhou" }, { Region: "ap-shanghai" }],
            RawResponse: "raw-response-proof",
          };
        },
        modifyRegion: mutation("modifyRegion"),
      });
    },
    createCvmClient() {
      return createClient("cvm", {
        describeInstances(params) {
          return page("DescribeInstances", params);
        },
        createInstances: mutation("createInstances"),
        deleteInstances: mutation("deleteInstances"),
        modifyInstancesAttribute: mutation("modifyInstancesAttribute"),
        runInstances: mutation("runInstances"),
        terminateInstances: mutation("terminateInstances"),
      });
    },
    createTkeClient() {
      return createClient("tke", {
        DescribeClusters(params) {
          return page("DescribeClusters", params);
        },
        deleteCluster: mutation("deleteCluster"),
      });
    },
    createCosClient() {
      return createClient("cos", {
        listBuckets(params) {
          return page("ListBuckets", params);
        },
        async headObject(params = {}) {
          calls.push("HeadObject");
          assert.equal(typeof params.BucketRef, "string", "head_bucket_ref");
          assert.equal(typeof params.PrefixRef, "string", "head_prefix_ref");
          return {
            Exists: true,
            MetadataSummary: { sizeBytes: 4096, checksumStatus: "present" },
            BillingSummary: { amountCny: "0.00" },
            objectKey: "object-key-proof",
            cosObjectBody: "cos-object-body-proof",
            rawResponse: "raw-sdk-response-proof",
          };
        },
        putObject: mutation("putObject"),
        deleteObject: mutation("deleteObject"),
      });
    },
    createBillingClient() {
      return createClient("billing", {
        DescribeBillSummary(params) {
          return page("DescribeBillSummary", params);
        },
        updateBill: mutation("updateBill"),
      });
    },
    createTagClient() {
      return createClient("tag", {
        describeTagResources(params) {
          return page("DescribeTagResources", params);
        },
        updateTags: mutation("updateTags"),
      });
    },
  };
}

const officialSdkModules = createFakeOfficialSdkModules();
const sdkModules = createTencentReadonlyInventoryOfficialSdkModules({ officialSdkModules });
assert.deepEqual(Object.keys(sdkModules).sort(), [
  "createAccountClient",
  "createBillingClient",
  "createCosClient",
  "createCvmClient",
  "createRegionClient",
  "createTagClient",
  "createTkeClient",
].sort(), "official_modules_factory_whitelist");
assert.equal("rawClient" in sdkModules, false, "official_modules_must_not_expose_raw_client");
assert.equal("client" in sdkModules, false, "official_modules_must_not_expose_client");
assert.equal("sdk" in sdkModules, false, "official_modules_must_not_expose_sdk");
assert.equal("call" in sdkModules, false, "official_modules_must_not_expose_generic_call");

const officialSdkModulesWithoutCos = createFakeOfficialSdkModules({
  expectedAllowedApis: nonCosAllowedApis,
});
officialSdkModulesWithoutCos.createCosClient = () => {
  officialSdkModulesWithoutCos.calls.push("create:cos-missing");
  throw Object.assign(new Error("raw-response-proof"), {
    code: "tencent_readonly_official_sdk_client_class_required:cos.v20180530",
    category: "sdk_module_shape_mismatch",
    apiName: "createCosClient",
    clientMethod: "clientClassFor",
    resourceType: "cos",
    rawResponse: "raw-sdk-response-proof",
    authorizationHeader: "authorization-header-proof",
  });
};
const nonCosClient = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
    sdkModules: createTencentReadonlyInventoryOfficialSdkModules({
      officialSdkModules: officialSdkModulesWithoutCos,
    }),
  }),
  credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof", token: "token-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis: nonCosAllowedApis,
  regions: ["ap-guangzhou", "ap-shanghai"],
});
assertPage(await nonCosClient.describeCvmInstances({ region: "ap-guangzhou" }), "official_non_cos_cvm_page");
assertPage(await nonCosClient.describeTkeClusters({ region: "ap-shanghai" }), "official_non_cos_tke_page");
assert.equal(officialSdkModulesWithoutCos.calls.includes("create:cos-missing"), false, "official_non_cos_must_not_create_cos");
await assert.rejects(
  () => nonCosClient.describeCosBuckets({ region: "ap-shanghai" }),
  /readonly_inventory_sdk_api_not_allowed:ListBuckets/,
  "official_non_cos_client_rejects_cos_method_without_creating_cos",
);
assert.equal(officialSdkModulesWithoutCos.calls.includes("create:cos-missing"), false, "official_non_cos_rejected_method_must_not_create_cos");

let missingCosError;
try {
  const officialSdkModulesMissingCosForAllowlist = createFakeOfficialSdkModules();
  officialSdkModulesMissingCosForAllowlist.createCosClient = officialSdkModulesWithoutCos.createCosClient;
  createTencentReadonlyInventoryRealSdkClient({
    sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
      sdkModules: createTencentReadonlyInventoryOfficialSdkModules({
        officialSdkModules: officialSdkModulesMissingCosForAllowlist,
      }),
    }),
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof", token: "token-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis,
    regions: ["ap-guangzhou", "ap-shanghai"],
  });
} catch (error) {
  missingCosError = error;
}
assert(missingCosError, "official_cos_allowlist_missing_cos_sdk_must_fail_closed");
assert.equal(missingCosError.code || missingCosError.message, "tencent_readonly_official_sdk_client_class_required:cos.v20180530", "official_missing_cos_provider_code");
assert.equal(missingCosError.category, "sdk_module_shape_mismatch", "official_missing_cos_category");
assert.equal(missingCosError.apiName, "createCosClient", "official_missing_cos_api_name");
assert.equal(missingCosError.clientMethod, "clientClassFor", "official_missing_cos_client_method");
assert.equal(missingCosError.resourceType, "cos", "official_missing_cos_resource_type");
assertNotContainsForbidden(missingCosError, "official_missing_cos_error");

const sdkFactory = createTencentReadonlyInventoryTencentSdkFactory({ sdkModules });
const sdk = sdkFactory({
  credentials: {
    SecretId: "secret-id-proof",
    SecretKey: "secret-key-proof",
    token: "token-proof",
  },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou", "ap-shanghai"],
});
assert.deepEqual(Object.keys(sdk).sort(), [
  "DescribeAccount",
  "DescribeBillSummary",
  "DescribeClusters",
  "DescribeInstances",
  "DescribeRegions",
  "DescribeTagResources",
  "HeadObject",
  "ListBuckets",
].sort(), "official_sdk_factory_method_whitelist");
assert.equal("rawClient" in sdk, false, "official_sdk_must_not_expose_raw_client");
assert.equal("client" in sdk, false, "official_sdk_must_not_expose_client");
assert.equal("sdk" in sdk, false, "official_sdk_must_not_expose_sdk");
assert.equal("call" in sdk, false, "official_sdk_must_not_expose_generic_call");

const client = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory,
  credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof", token: "token-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou", "ap-shanghai"],
});
const expectedClientMethods = [
  "describeAccount",
  "describeRegions",
  "describeCvmInstances",
  "describeTkeClusters",
  "describeCosBuckets",
  "describeCosMetadata",
  "describeBillingSummary",
  "describeTagResources",
];
assert.deepEqual(Object.keys(client).sort(), expectedClientMethods.sort(), "official_client_interface_whitelist");
assert.equal("rawClient" in client, false, "official_client_must_not_expose_raw_client");
assert.equal("call" in client, false, "official_client_must_not_expose_generic_call");

const account = await client.describeAccount();
assert.equal(account.accountMasked, "tencent-account-****7890", "official_account_masked");
assertNotContainsForbidden(account, "official_account");
const regions = await client.describeRegions();
assert.deepEqual(regions.items, [{ region: "ap-guangzhou" }, { region: "ap-shanghai" }], "official_regions");
const page1 = await client.describeCvmInstances({ region: "ap-guangzhou" });
assertPage(page1, "official_cvm_page_1");
assert.equal(page1.nextCursor, "page-2", "official_cvm_cursor");
const page2 = await client.describeCvmInstances({ region: "ap-guangzhou", cursor: page1.nextCursor });
assertPage(page2, "official_cvm_page_2");
const tkePage = await client.describeTkeClusters({ region: "ap-shanghai" });
assertPage(tkePage, "official_tke_page");
const bucketPage = await client.describeCosBuckets({ region: "ap-shanghai" });
assert.equal(bucketPage.items.length, 1, "official_bucket_page_items");
assertPage(bucketPage, "official_bucket_page");
const metadata = await client.describeCosMetadata({
  region: "ap-shanghai",
  bucketRef: bucketPage.items[0].bucketRef,
  prefixRef: bucketPage.items[0].prefixRef,
});
assert.deepEqual(metadata.metadataSummary, { sizeBytes: 4096, checksumStatus: "present" }, "official_cos_metadata_summary");
assertNotContainsForbidden(metadata, "official_cos_metadata");
const billingPage = await client.describeBillingSummary({ region: "ap-shanghai" });
assertPage(billingPage, "official_billing_page");
const tagPage = await client.describeTagResources({ region: "ap-shanghai" });
assertPage(tagPage, "official_tag_page");

const liveAdapter = createTencentReadonlyInventoryLiveAdapter({ client });
const inventory = await collectTencentReadonlyInventory({
  adapter: liveAdapter,
  env: {
    RUN_TENCENT_READONLY_INVENTORY: "1",
    TENCENT_READONLY_SECRET_ID: "secret-id-proof",
    TENCENT_READONLY_SECRET_KEY: "secret-key-proof",
    TENCENT_READONLY_REGIONS: "ap-guangzhou,ap-shanghai",
    TENCENT_READONLY_ALLOWED_APIS: allowedApis.join(","),
    TENCENT_READONLY_ACCOUNT_ID: "tencent-account-1234567890",
  },
  portalLedger: {
    resources: [
      {
        accountId: "acct-001",
        workspaceId: "workspace-001",
        resourceOrderId: "order-001",
        resourceBindingId: "binding-001",
        serverPlanId: "pro_8c16g_100gb",
        runId: "",
        resourceType: "compute",
        region: "ap-guangzhou",
      },
      {
        accountId: "acct-001",
        workspaceId: "workspace-001",
        resourceOrderId: "order-storage-001",
        resourceBindingId: "binding-storage-001",
        serverPlanId: "storage_100gb",
        runId: "run-001",
        resourceType: "file_space",
        region: "ap-shanghai",
      },
    ],
  },
});
assert.equal(inventory.portalMappingStatus.mapped >= 2, true, "official_inventory_mapped_resources");
assertNotContainsForbidden(inventory, "official_inventory");

let permissionError;
try {
  const permissionClient = createTencentReadonlyInventoryRealSdkClient({
    sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
      sdkModules: createTencentReadonlyInventoryOfficialSdkModules({
        officialSdkModules: createFakeOfficialSdkModules({
          cvmError: {
            code: "AuthFailure.UnauthorizedOperation",
            message: "permission-denied-raw-proof",
            rawResponse: "raw-sdk-response-proof",
            endpoint: "raw-endpoint-proof",
            authorizationHeader: "authorization-header-proof",
          },
        }),
      }),
    }),
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis,
    regions: ["ap-guangzhou", "ap-shanghai"],
  });
  await permissionClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  permissionError = error;
}
assertSafeError(permissionError, "permission_denied", "official_permission_error");

let rateLimitError;
try {
  const rateClient = createTencentReadonlyInventoryRealSdkClient({
    sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
      sdkModules: createTencentReadonlyInventoryOfficialSdkModules({
        officialSdkModules: createFakeOfficialSdkModules({
          cvmError: {
            code: "RateLimitExceeded",
            message: "rate-limited-raw-proof",
            rawResponse: "raw-sdk-response-proof",
          },
        }),
      }),
    }),
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis,
    regions: ["ap-guangzhou", "ap-shanghai"],
  });
  await rateClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  rateLimitError = error;
}
assertSafeError(rateLimitError, "rate_limited", "official_rate_limit_error");

let networkError;
try {
  const networkClient = createTencentReadonlyInventoryRealSdkClient({
    sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
      sdkModules: createTencentReadonlyInventoryOfficialSdkModules({
        officialSdkModules: createFakeOfficialSdkModules({
          cvmError: {
            code: "ECONNRESET",
            message: "network-error-raw-proof",
            rawResponse: "raw-sdk-response-proof",
            endpoint: "raw-endpoint-proof",
            authorizationHeader: "authorization-header-proof",
          },
        }),
      }),
    }),
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis,
    regions: ["ap-guangzhou", "ap-shanghai"],
  });
  await networkClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  networkError = error;
}
assertSafeError(networkError, "network_error", "official_network_error");

assert.throws(
  () => createTencentReadonlyInventoryOfficialSdkModules({ officialSdkModules: null }),
  /tencent_readonly_official_sdk_modules_required/,
  "missing_official_sdk_modules_rejected",
);
assert.throws(
  () => createTencentReadonlyInventoryOfficialSdkModules({
    officialSdkModules: {
      ...createFakeOfficialSdkModules(),
      createCvmClient: undefined,
    },
  }),
  /tencent_readonly_official_sdk_module_factory_required:createCvmClient/,
  "missing_official_factory_rejected",
);
assert.throws(
  () => createTencentReadonlyInventoryTencentSdkFactory({ sdkModules })({
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis: [],
    regions: ["ap-guangzhou"],
  }),
  /readonly_inventory_api_allowlist_required/,
  "empty_allowlist_rejected",
);
assert.throws(
  () => createTencentReadonlyInventoryTencentSdkFactory({ sdkModules })({
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis: ["DescribeAccount", "CreateInstances"],
    regions: ["ap-guangzhou"],
  }),
  /readonly_inventory_forbidden_api:CreateInstances/,
  "mutation_api_rejected",
);
for (const mutationCall of [
  "createAccount",
  "modifyRegion",
  "createInstances",
  "deleteInstances",
  "modifyInstancesAttribute",
  "runInstances",
  "terminateInstances",
  "deleteCluster",
  "putObject",
  "deleteObject",
  "updateBill",
  "updateTags",
]) {
  assert.equal(officialSdkModules.calls.includes(mutationCall), false, `official_mutation_sdk_call_must_not_happen:${mutationCall}`);
}

function runRunner(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, ["scripts/v22-tencent-readonly-inventory-runner.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, expectedStatus, `runner_status:${args.join(" ")}`);
  assertNotContainsForbidden(result.stdout, `runner_stdout:${args.join(" ")}`);
  assertNotContainsForbidden(result.stderr, `runner_stderr:${args.join(" ")}`);
  return JSON.parse(result.stdout.trim());
}

const goodSecretText = [
  "RUN_TENCENT_READONLY_INVENTORY=1",
  "TENCENT_READONLY_SECRET_ID=secret-id-proof",
  "TENCENT_READONLY_SECRET_KEY=secret-key-proof",
  "TENCENT_READONLY_REGIONS=ap-guangzhou,ap-shanghai",
  `TENCENT_READONLY_ALLOWED_APIS=${allowedApis.join(",")}`,
  "TENCENT_READONLY_ACCOUNT_ID=tencent-account-1234567890",
].join("\n");

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-official-sdk-wrapper-"));
try {
  const secretFile = path.join(tmpDir, "readonly.env");
  const nonCosSecretFile = path.join(tmpDir, "readonly-non-cos.env");
  const disabledSecretFile = path.join(tmpDir, "disabled.env");
  const emptyApisFile = path.join(tmpDir, "empty-apis.env");
  const mutationApisFile = path.join(tmpDir, "mutation-apis.env");
  await writeFile(secretFile, goodSecretText, "utf8");
  await writeFile(nonCosSecretFile, goodSecretText.replace(/TENCENT_READONLY_ALLOWED_APIS=.*/, `TENCENT_READONLY_ALLOWED_APIS=${nonCosAllowedApis.join(",")}`), "utf8");
  await writeFile(disabledSecretFile, goodSecretText.replace("RUN_TENCENT_READONLY_INVENTORY=1", "RUN_TENCENT_READONLY_INVENTORY=0"), "utf8");
  await writeFile(emptyApisFile, goodSecretText.replace(/TENCENT_READONLY_ALLOWED_APIS=.*/, "TENCENT_READONLY_ALLOWED_APIS="), "utf8");
  await writeFile(mutationApisFile, goodSecretText.replace("DescribeAccount,DescribeRegions", "DescribeAccount,CreateInstances"), "utf8");

  const missingModules = runRunner(["--live-readonly", "--sdk-mode", "tencent-official-sdk-readonly", "--secret-file", secretFile], 1);
  assert.equal(missingModules.reportPath, null, "missing_official_modules_no_report");
  assert.equal(missingModules.summary.blockedReason, "tencent_readonly_official_sdk_modules_required", "missing_official_modules_reason");
  assertReportWhitelist(missingModules.summary, "missing_official_modules_summary");

  const disabled = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-official-sdk-readonly",
    "--secret-file",
    disabledSecretFile,
  ], { officialSdkModules: createFakeOfficialSdkModules() });
  assert.equal(disabled.status, 1, "official_disabled_run_gate_status");
  assert.equal(disabled.payload.reportPath, null, "official_disabled_run_gate_no_report");
  assert.equal(disabled.payload.summary.blockedReason, "live_readonly_requires_run_gate", "official_disabled_run_gate_reason");

  await assert.rejects(
    () => runCli(["--live-readonly", "--sdk-mode", "tencent-official-sdk-readonly", "--secret-file", emptyApisFile], { officialSdkModules: createFakeOfficialSdkModules() }),
    /readonly_inventory_api_allowlist_required/,
    "official_empty_apis_rejected",
  );
  await assert.rejects(
    () => runCli(["--live-readonly", "--sdk-mode", "tencent-official-sdk-readonly", "--secret-file", mutationApisFile], { officialSdkModules: createFakeOfficialSdkModules() }),
    /readonly_inventory_forbidden_api:CreateInstances/,
    "official_mutation_api_rejected_in_runner",
  );

  const runnerModulesWithoutCos = createFakeOfficialSdkModules({
    expectedAllowedApis: nonCosAllowedApis,
  });
  runnerModulesWithoutCos.createCosClient = () => {
    runnerModulesWithoutCos.calls.push("create:cos-missing");
    throw new Error("tencent_readonly_official_sdk_client_class_required:cos.v20180530");
  };
  const nonCosLiveRun = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-official-sdk-readonly",
    "--secret-file",
    nonCosSecretFile,
    "--run-id",
    "official-sdk-wrapper-non-cos-proof",
  ], { officialSdkModules: runnerModulesWithoutCos });
  assert.equal(nonCosLiveRun.status, 0, "official_non_cos_live_run_status");
  assert.equal(nonCosLiveRun.payload.summary.ok, true, "official_non_cos_live_run_ok");
  assertReportWhitelist(nonCosLiveRun.payload.summary, "official_non_cos_live_run_summary");
  assert.equal(runnerModulesWithoutCos.calls.includes("create:cos-missing"), false, "official_non_cos_live_must_not_create_cos");

  const runnerModules = createFakeOfficialSdkModules();
  const liveRun = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-official-sdk-readonly",
    "--secret-file",
    secretFile,
    "--run-id",
    "official-sdk-wrapper-proof",
  ], { officialSdkModules: runnerModules });
  assert.equal(liveRun.status, 0, "official_live_run_with_fake_modules_status");
  assert(liveRun.payload.reportPath.endsWith(".runtime/v22-tencent-readonly-inventory/official-sdk-wrapper-proof.json"), "official_live_report_path");
  assertReportWhitelist(liveRun.payload.summary, "official_live_stdout_summary");
  assert.equal(liveRun.payload.summary.mode, "live-readonly", "official_live_summary_mode");
  assert.equal(liveRun.payload.summary.ok, true, "official_live_summary_ok");
  assert.equal(liveRun.payload.summary.resourceCounts.mapped > 0, true, "official_live_mapped_resources");
  const report = JSON.parse(await readFile(liveRun.payload.reportPath, "utf8"));
  assertReportWhitelist(report, "official_live_report");
  assert.deepEqual(report, liveRun.payload.summary, "official_live_report_matches_summary");
  for (const mutationCall of [
    "createAccount",
    "modifyRegion",
    "createInstances",
    "deleteInstances",
    "modifyInstancesAttribute",
    "runInstances",
    "terminateInstances",
    "deleteCluster",
    "putObject",
    "deleteObject",
    "updateBill",
    "updateTags",
  ]) {
    assert.equal(runnerModules.calls.includes(mutationCall), false, `runner_official_mutation_sdk_call_must_not_happen:${mutationCall}`);
  }
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await rm(runtimeReportDir, { recursive: true, force: true });
}

const moduleSource = await readFile(modulePath, "utf8");
assert.equal(moduleSource.includes("process.env"), false, "official_module_must_not_read_process_env");
assert.equal(moduleSource.includes("readFile"), false, "official_module_must_not_read_secret_file");
assert.equal(moduleSource.includes(liveSecretPathProof), false, "official_module_must_not_reference_real_secret_path");
assert.equal(moduleSource.includes("tencentcloud-sdk-nodejs"), false, "official_module_must_not_import_sdk_dependency");
assert.equal(moduleSource.includes("@tencentcloud"), false, "official_module_must_not_import_sdk_namespace");
assert.equal(/call\s*\(\s*apiName/.test(moduleSource), false, "official_module_must_not_expose_generic_call");
assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(moduleSource), false, "official_module_must_not_call_mutation_methods");

const runnerSource = await readFile(runnerPath, "utf8");
assert(runnerSource.includes("tencent-official-sdk-readonly"), "runner_must_support_official_sdk_mode");
assert(runnerSource.includes("tencent_readonly_official_sdk_modules_required"), "runner_must_fail_closed_without_official_modules");
assert.equal(/(^|\n)\s*source\s+/.test(runnerSource), false, "runner_must_not_source_secret_file");
assert.equal(runnerSource.includes("process.env"), false, "runner_must_not_inject_process_env");
assert.equal(runnerSource.includes(liveSecretPathProof), false, "runner_must_not_read_real_secret_path_literal");
assert.equal(/call\s*\(\s*apiName/.test(runnerSource), false, "runner_must_not_expose_generic_call");
assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(runnerSource), false, "runner_must_not_call_mutation_methods");

const portalPackage = await readFile(portalPackagePath, "utf8");
if (portalPackage.includes("tencentcloud-sdk-nodejs")) {
  assert.equal(
    moduleSource.includes("tencentcloud-sdk-nodejs"),
    false,
    "official_wrapper_module_must_not_import_sdk_dependency",
  );
}
assert.equal(portalPackage.includes("@tencentcloud"), false, "portal_package_must_not_add_tencent_sdk_namespace");

const suite = await readFile(suitePath, "utf8");
assert(suite.includes("smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs"), "mvp_suite_must_include_official_sdk_wrapper_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_official_sdk_wrapper_shell",
  checked: [
    "official_sdk_modules_dependency_injection_only",
    "official_sdk_shape_adapted_to_existing_readonly_factory",
    "semantic_inventory_client_interface_only",
    "missing_official_modules_fail_closed",
    "run_gate_and_allowlist_fail_closed",
    "fake_official_sdk_happy_path_account_regions_cvm_tke_cos_billing_tag",
    "permission_rate_network_errors_sanitized",
    "non_cos_allowlist_does_not_require_cos_sdk_shape",
    "cos_allowlist_missing_cos_sdk_fails_closed_with_sanitized_diagnostic",
    "raw_sdk_response_and_storage_internals_redacted",
    "mutation_methods_not_visible_or_called",
    "no_real_secret_cloud_or_sdk_dependency",
  ],
}, null, 2));
