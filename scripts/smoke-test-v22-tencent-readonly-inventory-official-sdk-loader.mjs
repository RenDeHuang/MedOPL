import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createTencentReadonlyInventoryOfficialSdkModules } from "../services/portal/src/domain/tencent-readonly-inventory-official-sdk-modules.mjs";
import { createTencentReadonlyInventoryOfficialSdkModulesFromPackage } from "../services/portal/src/domain/tencent-readonly-inventory-official-sdk-loader.mjs";
import { createTencentReadonlyInventoryRealSdkClient } from "../services/portal/src/domain/tencent-readonly-inventory-real-sdk-client.mjs";
import { createTencentReadonlyInventoryTencentSdkFactory } from "../services/portal/src/domain/tencent-readonly-inventory-tencent-sdk-factory.mjs";
import { runCli } from "./v22-tencent-readonly-inventory-runner.mjs";

const repoRoot = path.resolve(".");
const loaderPath = "services/portal/src/domain/tencent-readonly-inventory-official-sdk-loader.mjs";
const runnerPath = "scripts/v22-tencent-readonly-inventory-runner.mjs";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const portalPackagePath = "services/portal/package.json";
const portalLockPath = "services/portal/package-lock.json";
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

function createFakeSdkPackage({ cvmError = null } = {}) {
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
            InstanceId: "ins-loader-001",
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
            InstanceId: "ins-loader-002",
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
            BucketRef: "bucket-loader-001",
            PrefixRef: "prefix-loader-001",
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

  function clientClass(serviceName, methods) {
    return class FakeTencentOfficialClient {
      constructor(options = {}) {
        calls.push(`construct:${serviceName}`);
        assert.equal(options.credential?.secretId, "secret-id-proof", `${serviceName}_secret_id_private_boundary`);
        assert.equal(options.credential?.secretKey, "secret-key-proof", `${serviceName}_secret_key_private_boundary`);
        assert.equal(typeof options.profile?.httpProfile?.endpoint, "string", `${serviceName}_endpoint_configured`);
        Object.assign(this, methods);
      }
    };
  }

  const packageShape = {
    sts: {
      v20180813: {
        Client: clientClass("sts", {
          GetCallerIdentity() {
            calls.push("GetCallerIdentity");
            return {
              AccountId: "tencent-account-1234567890",
              SecretId: "secret-id-proof",
              SecretKey: "secret-key-proof",
              RawResponse: "raw-sdk-response-proof",
            };
          },
          CreateRole: mutation("CreateRole"),
        }),
      },
    },
    cvm: {
      v20170312: {
        Client: clientClass("cvm", {
          DescribeRegions() {
            calls.push("DescribeRegions");
            return {
              Regions: [{ Region: "ap-guangzhou" }, { Region: "ap-shanghai" }],
              RawResponse: "raw-response-proof",
            };
          },
          DescribeInstances(params) {
            return page("DescribeInstances", params);
          },
          RunInstances: mutation("RunInstances"),
          TerminateInstances: mutation("TerminateInstances"),
          ModifyInstancesAttribute: mutation("ModifyInstancesAttribute"),
        }),
      },
    },
    tke: {
      v20180525: {
        Client: clientClass("tke", {
          DescribeClusters(params) {
            return page("DescribeClusters", params);
          },
          DeleteCluster: mutation("DeleteCluster"),
        }),
      },
    },
    cos: {
      v20180530: {
        Client: clientClass("cos", {
          ListBuckets(params) {
            return page("ListBuckets", params);
          },
          HeadObject(params = {}) {
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
          PutObject: mutation("PutObject"),
          DeleteObject: mutation("DeleteObject"),
        }),
      },
    },
    billing: {
      v20180709: {
        Client: clientClass("billing", {
          DescribeBillSummary(params) {
            return page("DescribeBillSummary", params);
          },
          ModifyBill: mutation("ModifyBill"),
        }),
      },
    },
    tag: {
      v20180813: {
        Client: clientClass("tag", {
          DescribeTagResources(params) {
            return page("DescribeTagResources", params);
          },
          UpdateTags: mutation("UpdateTags"),
        }),
      },
    },
  };
  packageShape.calls = calls;
  return packageShape;
}

const portalPackage = JSON.parse(await readFile(portalPackagePath, "utf8"));
assert(portalPackage.dependencies?.["tencentcloud-sdk-nodejs"], "package_json_must_include_tencentcloud_sdk_nodejs");

const officialSdkPackageWithoutCos = createFakeSdkPackage();
delete officialSdkPackageWithoutCos.cos;
const nonCosClient = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
    sdkModules: createTencentReadonlyInventoryOfficialSdkModules({
      officialSdkModules: createTencentReadonlyInventoryOfficialSdkModulesFromPackage({
        sdkPackage: officialSdkPackageWithoutCos,
      }),
    }),
  }),
  credentials: {
    SecretId: "secret-id-proof",
    SecretKey: "secret-key-proof",
    token: "token-proof",
  },
  accountId: "tencent-account-1234567890",
  allowedApis: nonCosAllowedApis,
  regions: ["ap-guangzhou", "ap-shanghai"],
});
assertPage(await nonCosClient.describeCvmInstances({ region: "ap-guangzhou" }), "loader_non_cos_cvm_page");
assertPage(await nonCosClient.describeTkeClusters({ region: "ap-shanghai" }), "loader_non_cos_tke_page");
assert.equal(
  officialSdkPackageWithoutCos.calls.some((call) => call === "construct:cos" || call === "ListBuckets" || call === "HeadObject"),
  false,
  "loader_non_cos_allowlist_must_not_construct_or_call_cos",
);
await assert.rejects(
  () => nonCosClient.describeCosBuckets({ region: "ap-shanghai" }),
  /readonly_inventory_sdk_api_not_allowed:ListBuckets/,
  "loader_non_cos_client_rejects_cos_method_without_constructing_cos",
);
assert.equal(
  officialSdkPackageWithoutCos.calls.some((call) => call === "construct:cos" || call === "ListBuckets" || call === "HeadObject"),
  false,
  "loader_non_cos_rejected_method_must_not_construct_or_call_cos",
);

let missingCosError;
try {
  createTencentReadonlyInventoryRealSdkClient({
    sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
      sdkModules: createTencentReadonlyInventoryOfficialSdkModules({
        officialSdkModules: createTencentReadonlyInventoryOfficialSdkModulesFromPackage({
          sdkPackage: officialSdkPackageWithoutCos,
        }),
      }),
    }),
    credentials: {
      SecretId: "secret-id-proof",
      SecretKey: "secret-key-proof",
      token: "token-proof",
    },
    accountId: "tencent-account-1234567890",
    allowedApis,
    regions: ["ap-guangzhou", "ap-shanghai"],
  });
} catch (error) {
  missingCosError = error;
}
assert(missingCosError, "loader_cos_allowlist_missing_cos_sdk_must_fail_closed");
assert.equal(
  missingCosError.code || missingCosError.message,
  "tencent_readonly_official_sdk_client_class_required:cos.v20180530",
  "loader_missing_cos_provider_code",
);
assert.equal(missingCosError.category, "sdk_module_shape_mismatch", "loader_missing_cos_category");
assert.equal(missingCosError.apiName, "createCosClient", "loader_missing_cos_api_name");
assert.equal(missingCosError.clientMethod, "clientClassFor", "loader_missing_cos_client_method");
assert.equal(missingCosError.resourceType, "cos", "loader_missing_cos_resource_type");
assertNotContainsForbidden(missingCosError, "loader_missing_cos_error");

const officialSdkPackage = createFakeSdkPackage();
const officialSdkModules = createTencentReadonlyInventoryOfficialSdkModulesFromPackage({
  sdkPackage: officialSdkPackage,
});
assert.deepEqual(Object.keys(officialSdkModules).sort(), [
  "createAccountClient",
  "createBillingClient",
  "createCosClient",
  "createCvmClient",
  "createRegionClient",
  "createTagClient",
  "createTkeClient",
].sort(), "loader_factory_whitelist");
assert.equal("rawClient" in officialSdkModules, false, "loader_must_not_expose_raw_client");
assert.equal("client" in officialSdkModules, false, "loader_must_not_expose_client");
assert.equal("sdk" in officialSdkModules, false, "loader_must_not_expose_sdk");
assert.equal("call" in officialSdkModules, false, "loader_must_not_expose_generic_call");

const sdkFactory = createTencentReadonlyInventoryTencentSdkFactory({
  sdkModules: createTencentReadonlyInventoryOfficialSdkModules({ officialSdkModules }),
});
const client = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory,
  credentials: {
    SecretId: "secret-id-proof",
    SecretKey: "secret-key-proof",
    token: "token-proof",
  },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou", "ap-shanghai"],
});
assert.deepEqual(Object.keys(client).sort(), [
  "describeAccount",
  "describeBillingSummary",
  "describeCosBuckets",
  "describeCosMetadata",
  "describeCvmInstances",
  "describeRegions",
  "describeTagResources",
  "describeTkeClusters",
].sort(), "loader_client_interface_whitelist");
assert.equal("rawClient" in client, false, "loader_client_must_not_expose_raw_client");
assert.equal("call" in client, false, "loader_client_must_not_expose_generic_call");

const account = await client.describeAccount();
assert.equal(account.accountMasked, "tencent-account-****7890", "loader_account_masked");
assertNotContainsForbidden(account, "loader_account");
const regions = await client.describeRegions();
assert.deepEqual(regions.items, [{ region: "ap-guangzhou" }, { region: "ap-shanghai" }], "loader_regions");
const cvmPage1 = await client.describeCvmInstances({ region: "ap-guangzhou" });
assertPage(cvmPage1, "loader_cvm_page_1");
assert.equal(cvmPage1.nextCursor, "page-2", "loader_cvm_cursor");
const cvmPage2 = await client.describeCvmInstances({ region: "ap-guangzhou", cursor: cvmPage1.nextCursor });
assertPage(cvmPage2, "loader_cvm_page_2");
assertPage(await client.describeTkeClusters({ region: "ap-shanghai" }), "loader_tke_page");
const bucketPage = await client.describeCosBuckets({ region: "ap-shanghai" });
assertPage(bucketPage, "loader_bucket_page");
const metadata = await client.describeCosMetadata({
  region: "ap-shanghai",
  bucketRef: bucketPage.items[0].bucketRef,
  prefixRef: bucketPage.items[0].prefixRef,
});
assert.deepEqual(metadata.metadataSummary, { sizeBytes: 4096, checksumStatus: "present" }, "loader_cos_metadata_summary");
assertNotContainsForbidden(metadata, "loader_cos_metadata");
assertPage(await client.describeBillingSummary({ region: "ap-shanghai" }), "loader_billing_page");
assertPage(await client.describeTagResources({ region: "ap-shanghai" }), "loader_tag_page");

for (const mutationCall of [
  "CreateRole",
  "RunInstances",
  "TerminateInstances",
  "ModifyInstancesAttribute",
  "DeleteCluster",
  "PutObject",
  "DeleteObject",
  "ModifyBill",
  "UpdateTags",
]) {
  assert.equal(officialSdkPackage.calls.includes(mutationCall), false, `loader_mutation_sdk_call_must_not_happen:${mutationCall}`);
}

let permissionError;
try {
  const permissionPackage = createFakeSdkPackage({
    cvmError: {
      code: "AuthFailure.UnauthorizedOperation",
      message: "permission-denied-raw-proof",
      rawResponse: "raw-sdk-response-proof",
      endpoint: "raw-endpoint-proof",
      authorizationHeader: "authorization-header-proof",
    },
  });
  const permissionClient = createTencentReadonlyInventoryRealSdkClient({
    sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
      sdkModules: createTencentReadonlyInventoryOfficialSdkModules({
        officialSdkModules: createTencentReadonlyInventoryOfficialSdkModulesFromPackage({
          sdkPackage: permissionPackage,
        }),
      }),
    }),
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis,
    regions: ["ap-guangzhou"],
  });
  await permissionClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  permissionError = error;
}
assertSafeError(permissionError, "permission_denied", "loader_permission_error");

let rateLimitError;
try {
  const ratePackage = createFakeSdkPackage({
    cvmError: {
      code: "RateLimitExceeded",
      message: "rate-limited-raw-proof",
      rawResponse: "raw-sdk-response-proof",
    },
  });
  const rateClient = createTencentReadonlyInventoryRealSdkClient({
    sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
      sdkModules: createTencentReadonlyInventoryOfficialSdkModules({
        officialSdkModules: createTencentReadonlyInventoryOfficialSdkModulesFromPackage({
          sdkPackage: ratePackage,
        }),
      }),
    }),
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis,
    regions: ["ap-guangzhou"],
  });
  await rateClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  rateLimitError = error;
}
assertSafeError(rateLimitError, "rate_limited", "loader_rate_limit_error");

let networkError;
try {
  const networkPackage = createFakeSdkPackage({
    cvmError: {
      code: "ECONNRESET",
      message: "network-error-raw-proof",
      rawResponse: "raw-sdk-response-proof",
      endpoint: "raw-endpoint-proof",
      authorizationHeader: "authorization-header-proof",
    },
  });
  const networkClient = createTencentReadonlyInventoryRealSdkClient({
    sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
      sdkModules: createTencentReadonlyInventoryOfficialSdkModules({
        officialSdkModules: createTencentReadonlyInventoryOfficialSdkModulesFromPackage({
          sdkPackage: networkPackage,
        }),
      }),
    }),
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis,
    regions: ["ap-guangzhou"],
  });
  await networkClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  networkError = error;
}
assertSafeError(networkError, "network_error", "loader_network_error");

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

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-official-sdk-loader-"));
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

  const defaultBlocked = runRunner([
    "--live-readonly",
    "--sdk-mode",
    "tencent-official-sdk-readonly",
    "--secret-file",
    secretFile,
  ], 1);
  assert.equal(defaultBlocked.reportPath, null, "default_official_loader_no_report");
  assert.equal(defaultBlocked.summary.blockedReason, "tencent_readonly_official_sdk_modules_required", "default_official_loader_reason");
  assertReportWhitelist(defaultBlocked.summary, "default_official_loader_summary");

  let loadCalls = 0;
  const noFlag = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-official-sdk-readonly",
    "--secret-file",
    secretFile,
  ], {
    loadOfficialSdkPackage: async () => {
      loadCalls += 1;
      return createFakeSdkPackage();
    },
  });
  assert.equal(noFlag.status, 1, "no_flag_status");
  assert.equal(noFlag.payload.summary.blockedReason, "tencent_readonly_official_sdk_modules_required", "no_flag_reason");
  assert.equal(loadCalls, 0, "no_flag_must_not_load_sdk_package");

  const disabled = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-official-sdk-readonly",
    "--enable-official-sdk-loader",
    "--secret-file",
    disabledSecretFile,
  ], {
    loadOfficialSdkPackage: async () => {
      loadCalls += 1;
      return createFakeSdkPackage();
    },
  });
  assert.equal(disabled.status, 1, "disabled_run_gate_status");
  assert.equal(disabled.payload.summary.blockedReason, "live_readonly_requires_run_gate", "disabled_run_gate_reason");
  assert.equal(loadCalls, 0, "disabled_run_gate_must_not_load_sdk_package");

  await assert.rejects(
    () => runCli([
      "--live-readonly",
      "--sdk-mode",
      "tencent-official-sdk-readonly",
      "--enable-official-sdk-loader",
      "--secret-file",
      emptyApisFile,
    ], {
      loadOfficialSdkPackage: async () => {
        loadCalls += 1;
        return createFakeSdkPackage();
      },
    }),
    /readonly_inventory_api_allowlist_required/,
    "empty_apis_rejected_before_loader",
  );
  assert.equal(loadCalls, 0, "empty_apis_must_not_load_sdk_package");

  await assert.rejects(
    () => runCli([
      "--live-readonly",
      "--sdk-mode",
      "tencent-official-sdk-readonly",
      "--enable-official-sdk-loader",
      "--secret-file",
      mutationApisFile,
    ], {
      loadOfficialSdkPackage: async () => {
        loadCalls += 1;
        return createFakeSdkPackage();
      },
    }),
    /readonly_inventory_forbidden_api:CreateInstances/,
    "mutation_api_rejected_before_loader",
  );
  assert.equal(loadCalls, 0, "mutation_api_must_not_load_sdk_package");

  const runnerPackageWithoutCos = createFakeSdkPackage();
  delete runnerPackageWithoutCos.cos;
  const nonCosLiveRun = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-official-sdk-readonly",
    "--enable-official-sdk-loader",
    "--secret-file",
    nonCosSecretFile,
    "--run-id",
    "official-sdk-loader-non-cos-proof",
  ], {
    loadOfficialSdkPackage: async () => {
      loadCalls += 1;
      return runnerPackageWithoutCos;
    },
  });
  assert.equal(nonCosLiveRun.status, 0, "official_loader_non_cos_live_status");
  assert.equal(nonCosLiveRun.payload.summary.ok, true, "official_loader_non_cos_live_ok");
  assertReportWhitelist(nonCosLiveRun.payload.summary, "official_loader_non_cos_live_summary");
  assert.equal(
    runnerPackageWithoutCos.calls.some((call) => call === "construct:cos" || call === "ListBuckets" || call === "HeadObject"),
    false,
    "official_loader_non_cos_live_must_not_construct_or_call_cos",
  );

  loadCalls = 0;
  const runnerPackage = createFakeSdkPackage();
  const loaded = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-official-sdk-readonly",
    "--enable-official-sdk-loader",
    "--secret-file",
    secretFile,
    "--run-id",
    "official-sdk-loader-proof",
  ], {
    loadOfficialSdkPackage: async () => {
      loadCalls += 1;
      return runnerPackage;
    },
  });
  assert.equal(loaded.status, 0, "explicit_loader_with_fake_package_status");
  assert.equal(loadCalls, 1, "explicit_loader_loads_package_once");
  assert(loaded.payload.reportPath.endsWith(".runtime/v22-tencent-readonly-inventory/official-sdk-loader-proof.json"), "official_loader_report_path");
  assertReportWhitelist(loaded.payload.summary, "official_loader_stdout_summary");
  assert.equal(loaded.payload.summary.ok, true, "official_loader_summary_ok");
  const report = JSON.parse(await readFile(loaded.payload.reportPath, "utf8"));
  assertReportWhitelist(report, "official_loader_report");
  assert.deepEqual(report, loaded.payload.summary, "official_loader_report_matches_summary");

  for (const mutationCall of [
    "CreateRole",
    "RunInstances",
    "TerminateInstances",
    "ModifyInstancesAttribute",
    "DeleteCluster",
    "PutObject",
    "DeleteObject",
    "ModifyBill",
    "UpdateTags",
  ]) {
    assert.equal(runnerPackage.calls.includes(mutationCall), false, `runner_loader_mutation_sdk_call_must_not_happen:${mutationCall}`);
  }
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await rm(runtimeReportDir, { recursive: true, force: true });
}

const updatedPackage = JSON.parse(await readFile(portalPackagePath, "utf8"));
assert(updatedPackage.dependencies?.["tencentcloud-sdk-nodejs"], "package_json_must_include_tencentcloud_sdk_nodejs");
const lock = JSON.parse(await readFile(portalLockPath, "utf8"));
assert(lock.packages?.["node_modules/tencentcloud-sdk-nodejs"], "package_lock_must_include_tencentcloud_sdk_nodejs");

const loaderSource = await readFile(loaderPath, "utf8");
assert.equal(loaderSource.includes("process.env"), false, "loader_must_not_read_process_env");
assert.equal(loaderSource.includes("readFile"), false, "loader_must_not_read_secret_file");
assert.equal(loaderSource.includes(liveSecretPathProof), false, "loader_must_not_reference_real_secret_path");
assert(loaderSource.includes("tencentcloud-sdk-nodejs"), "loader_must_reference_official_sdk_dependency");
assert.equal(/call\s*\(\s*apiName/.test(loaderSource), false, "loader_must_not_expose_generic_call");
assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(loaderSource), false, "loader_must_not_call_mutation_methods");

const runnerSource = await readFile(runnerPath, "utf8");
assert(runnerSource.includes("--enable-official-sdk-loader"), "runner_must_have_explicit_official_sdk_loader_switch");
assert(runnerSource.includes("loadOfficialSdkPackage"), "runner_must_support_injected_sdk_package_loader");
assert.equal(/(^|\n)\s*source\s+/.test(runnerSource), false, "runner_must_not_source_secret_file");
assert.equal(runnerSource.includes("process.env"), false, "runner_must_not_inject_process_env");
assert.equal(runnerSource.includes(liveSecretPathProof), false, "runner_must_not_read_real_secret_path_literal");
assert.equal(/call\s*\(\s*apiName/.test(runnerSource), false, "runner_must_not_expose_generic_call");
assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(runnerSource), false, "runner_must_not_call_mutation_methods");

const suite = await readFile(suitePath, "utf8");
assert(suite.includes("smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs"), "mvp_suite_must_include_official_sdk_loader_smoke");
assert(suite.includes("smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"), "mvp_suite_must_keep_tc3_cleanup_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_official_sdk_loader",
  checked: [
    "package_dependency_and_lockfile",
    "fake_official_sdk_package_to_factories",
    "runner_default_fail_closed_without_loading_sdk",
    "run_gate_and_allowlist_before_sdk_loading",
    "explicit_loader_switch_with_fake_package",
    "raw_sdk_client_not_exposed",
    "mutation_methods_not_visible_or_called",
    "safe_error_redaction",
    "non_cos_allowlist_does_not_require_cos_sdk_shape",
    "cos_allowlist_missing_cos_sdk_fails_closed_with_sanitized_diagnostic",
    "no_real_secret_or_cloud_call",
    "tc3_diagnostic_smoke_kept",
  ],
}, null, 2));
