import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createTencentReadonlyInventoryRealSdkClient } from "../services/portal/src/domain/tencent-readonly-inventory-real-sdk-client.mjs";
import { createTencentReadonlyInventoryTencentSdkFactory } from "../services/portal/src/domain/tencent-readonly-inventory-tencent-sdk-factory.mjs";
import { runCli } from "./v22-tencent-readonly-inventory-runner.mjs";

const repoRoot = path.resolve(".");
const modulePath = "services/portal/src/domain/tencent-readonly-inventory-tencent-sdk-factory.mjs";
const runnerPath = "scripts/v22-tencent-readonly-inventory-runner.mjs";
const contractPath = "docs/contracts/v22-tencent-readonly-inventory-boundary.md";
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

function assertNotContainsForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const forbidden = [
    "secret-id-proof",
    "secret-key-proof",
    "token-proof",
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
    "network-error-raw-proof",
  ];
  for (const phrase of forbidden) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
  assert.equal(
    /SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|cosPrefix|signedUrl|bucketPolicy|cosObjectBody|rawRequest|rawResponse|providerRawResponse|rawEndpoint|authorizationHeader/i.test(serialized),
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

function createFakeSdkModules({ cvmError = null } = {}) {
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
            InstanceId: "ins-live-001",
            InstanceState: "running",
            Tags: ownershipTags(),
            RawResponse: "raw-sdk-response-proof",
            SecretId: "secret-id-proof",
          },
        ],
        NextToken: "page-2",
      },
      "ap-guangzhou:page-2": {
        items: [
          {
            InstanceId: "ins-live-002",
            InstanceState: "running",
            Tags: ownershipTags({ resourceOrderId: "order-002", resourceBindingId: "binding-002" }),
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
            BucketRef: "bucket-live-001",
            PrefixRef: "prefix-live-001",
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

  function createClient(serviceName, methods) {
    calls.push(`create:${serviceName}`);
    return Object.freeze(methods);
  }

  async function page(apiName, params = {}) {
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
    createAccountClient({ credentials, regions }) {
      assert.equal(credentials.SecretId, "secret-id-proof", "account_client_receives_private_secret_boundary");
      assert.deepEqual(regions, ["ap-guangzhou", "ap-shanghai"], "account_client_receives_regions");
      return createClient("account", {
        async DescribeAccount() {
          calls.push("DescribeAccount");
          return {
            AccountId: "tencent-account-1234567890",
            SecretId: "secret-id-proof",
            SecretKey: "secret-key-proof",
            RawResponse: "raw-sdk-response-proof",
          };
        },
        CreateAccount: mutation("CreateAccount"),
      });
    },
    createRegionClient() {
      return createClient("region", {
        async DescribeRegions() {
          calls.push("DescribeRegions");
          return { Regions: [{ Region: "ap-guangzhou" }, { Region: "ap-shanghai" }] };
        },
        ModifyRegion: mutation("ModifyRegion"),
      });
    },
    createCvmClient() {
      return createClient("cvm", {
        DescribeInstances(params) {
          return page("DescribeInstances", params);
        },
        RunInstances: mutation("RunInstances"),
        TerminateInstances: mutation("TerminateInstances"),
      });
    },
    createTkeClient() {
      return createClient("tke", {
        DescribeClusters(params) {
          return page("DescribeClusters", params);
        },
        DeleteCluster: mutation("DeleteCluster"),
      });
    },
    createCosClient() {
      return createClient("cos", {
        ListBuckets(params) {
          return page("ListBuckets", params);
        },
        async HeadObject(params = {}) {
          calls.push("HeadObject");
          assert.equal(typeof params.BucketRef, "string", "head_bucket_ref");
          assert.equal(typeof params.PrefixRef, "string", "head_prefix_ref");
          return {
            Exists: true,
            MetadataSummary: { sizeBytes: 4096 },
            BillingSummary: { amountCny: "0.00" },
            objectKey: "object-key-proof",
            cosObjectBody: "cos-object-body-proof",
            rawResponse: "raw-sdk-response-proof",
          };
        },
        PutObject: mutation("PutObject"),
        DeleteObject: mutation("DeleteObject"),
      });
    },
    createBillingClient() {
      return createClient("billing", {
        DescribeBillSummary(params) {
          return page("DescribeBillSummary", params);
        },
        ModifyBill: mutation("ModifyBill"),
      });
    },
    createTagClient() {
      return createClient("tag", {
        DescribeTagResources(params) {
          return page("DescribeTagResources", params);
        },
        UpdateTags: mutation("UpdateTags"),
      });
    },
  };
}

const sdkModules = createFakeSdkModules();
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
].sort(), "tencent_sdk_factory_method_whitelist");
assert.equal("call" in sdk, false, "sdk_factory_must_not_expose_generic_call");
assert.equal("rawClient" in sdk, false, "sdk_factory_must_not_expose_raw_client");
assert.equal("client" in sdk, false, "sdk_factory_must_not_expose_client");
assert.equal("sdk" in sdk, false, "sdk_factory_must_not_expose_sdk");

const client = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory,
  credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou", "ap-shanghai"],
});
const account = await client.describeAccount();
assert.equal(account.accountMasked, "tencent-account-****7890", "account_masked");
assertNotContainsForbidden(account, "account");
const page1 = await client.describeCvmInstances({ region: "ap-guangzhou" });
assert.equal(page1.nextCursor, "page-2", "cvm_page_cursor");
assertNotContainsForbidden(page1, "cvm_page_1");
const page2 = await client.describeCvmInstances({ region: "ap-guangzhou", cursor: page1.nextCursor });
assert.equal(page2.items.length, 1, "cvm_page_2_items");
const bucketPage = await client.describeCosBuckets({ region: "ap-shanghai" });
assert.equal(bucketPage.items.length, 1, "bucket_page_items");
const metadata = await client.describeCosMetadata({
  region: "ap-shanghai",
  bucketRef: bucketPage.items[0].bucketRef,
  prefixRef: bucketPage.items[0].prefixRef,
});
assert.deepEqual(metadata.metadataSummary, { sizeBytes: 4096 }, "cos_metadata_summary");
assertNotContainsForbidden(metadata, "cos_metadata");

let regionError;
try {
  await client.describeTkeClusters({ region: "ap-shanghai" });
} catch (error) {
  regionError = error;
}
assert.equal(regionError.category, "region_unavailable", "region_error_category");
assertNotContainsForbidden(regionError, "region_error");

let rateLimitError;
try {
  await client.describeBillingSummary({ region: "ap-shanghai" });
} catch (error) {
  rateLimitError = error;
}
assert.equal(rateLimitError.category, "rate_limited", "rate_limit_error_category");
assertNotContainsForbidden(rateLimitError, "rate_limit_error");

const permissionClient = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
    sdkModules: createFakeSdkModules({
      cvmError: {
        code: "PermissionDenied",
        message: "permission-denied-raw-proof",
        rawResponse: "raw-sdk-response-proof",
      },
    }),
  }),
  credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou", "ap-shanghai"],
});
let permissionError;
try {
  await permissionClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  permissionError = error;
}
assert.equal(permissionError.category, "permission_denied", "permission_error_category");
assertNotContainsForbidden(permissionError, "permission_error");

const networkClient = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
    sdkModules: createFakeSdkModules({
      cvmError: {
        code: "NetworkError",
        message: "network-error-raw-proof",
        rawResponse: "raw-sdk-response-proof",
        endpoint: "raw-endpoint-proof",
        authorizationHeader: "authorization-header-proof",
      },
    }),
  }),
  credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou", "ap-shanghai"],
});
let networkError;
try {
  await networkClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  networkError = error;
}
assert.equal(networkError.category, "network_error", "network_error_category");
assert.equal(networkError.retryable, true, "network_error_retryable");
assertNotContainsForbidden(networkError, "network_error");

assert.throws(
  () => createTencentReadonlyInventoryTencentSdkFactory({ sdkModules: null }),
  /tencent_readonly_sdk_modules_required/,
  "missing_sdk_modules_rejected",
);
assert.throws(
  () => sdkFactory({
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis: [],
    regions: ["ap-guangzhou"],
  }),
  /readonly_inventory_api_allowlist_required/,
  "empty_allowlist_rejected_before_sdk_init",
);
assert.throws(
  () => sdkFactory({
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis: ["DescribeAccount", "CreateInstances"],
    regions: ["ap-guangzhou"],
  }),
  /readonly_inventory_forbidden_api:CreateInstances/,
  "mutation_api_rejected",
);
for (const mutation of ["Create", "Delete", "Modify", "Run", "Terminate", "Put", "Update", "Attach", "Detach"]) {
  assert.equal(sdkModules.calls.some((call) => call.startsWith(mutation)), false, `mutation_sdk_call_must_not_happen:${mutation}`);
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

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-real-live-run-"));
try {
  const secretFile = path.join(tmpDir, "readonly.env");
  const disabledSecretFile = path.join(tmpDir, "disabled.env");
  const emptyApisFile = path.join(tmpDir, "empty-apis.env");
  const emptyRegionsFile = path.join(tmpDir, "empty-regions.env");
  const mutationApisFile = path.join(tmpDir, "mutation-apis.env");
  await writeFile(secretFile, goodSecretText, "utf8");
  await writeFile(disabledSecretFile, goodSecretText.replace("RUN_TENCENT_READONLY_INVENTORY=1", "RUN_TENCENT_READONLY_INVENTORY=0"), "utf8");
  await writeFile(emptyApisFile, goodSecretText.replace(/TENCENT_READONLY_ALLOWED_APIS=.*/, "TENCENT_READONLY_ALLOWED_APIS="), "utf8");
  await writeFile(emptyRegionsFile, goodSecretText.replace(/TENCENT_READONLY_REGIONS=.*/, "TENCENT_READONLY_REGIONS="), "utf8");
  await writeFile(mutationApisFile, goodSecretText.replace("DescribeAccount,DescribeRegions", "DescribeAccount,CreateInstances"), "utf8");

  const missingModules = runRunner(["--live-readonly", "--sdk-mode", "tencent-real-readonly", "--secret-file", secretFile], 1);
  assert.equal(missingModules.reportPath, null, "missing_modules_no_report");
  assert.equal(missingModules.summary.blockedReason, "tencent_readonly_sdk_modules_required", "missing_modules_reason");

  const disabled = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-real-readonly",
    "--secret-file",
    disabledSecretFile,
  ], { tencentSdkModules: createFakeSdkModules() });
  assert.equal(disabled.status, 1, "disabled_run_gate_status");
  assert.equal(disabled.payload.reportPath, null, "disabled_run_gate_no_report");
  assert.equal(disabled.payload.summary.blockedReason, "live_readonly_requires_run_gate", "disabled_run_gate_reason");

  await assert.rejects(
    () => runCli(["--live-readonly", "--sdk-mode", "tencent-real-readonly", "--secret-file", emptyApisFile], { tencentSdkModules: createFakeSdkModules() }),
    /readonly_inventory_api_allowlist_required/,
    "empty_apis_rejected",
  );
  const emptyRegions = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-real-readonly",
    "--secret-file",
    emptyRegionsFile,
  ], { tencentSdkModules: createFakeSdkModules() });
  assert.equal(emptyRegions.status, 1, "empty_regions_status");
  assert.equal(emptyRegions.payload.reportPath, null, "empty_regions_no_report");
  assert.equal(emptyRegions.payload.summary.blockedReason, "readonly_inventory_regions_required", "empty_regions_reason");
  await assert.rejects(
    () => runCli(["--live-readonly", "--sdk-mode", "tencent-real-readonly", "--secret-file", mutationApisFile], { tencentSdkModules: createFakeSdkModules() }),
    /readonly_inventory_forbidden_api:CreateInstances/,
    "mutation_api_rejected_in_runner",
  );

  const runnerModules = createFakeSdkModules();
  const liveRun = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-real-readonly",
    "--secret-file",
    secretFile,
    "--run-id",
    "real-live-run-proof",
  ], { tencentSdkModules: runnerModules });
  assert.equal(liveRun.status, 0, "real_live_run_with_fake_modules_status");
  assert(liveRun.payload.reportPath.endsWith(".runtime/v22-tencent-readonly-inventory/real-live-run-proof.json"), "real_live_report_path");
  assertReportWhitelist(liveRun.payload.summary, "real_live_stdout_summary");
  assert.equal(liveRun.payload.summary.mode, "live-readonly", "real_live_summary_mode");
  assert.equal(liveRun.payload.summary.ok, true, "real_live_summary_ok");
  assert.equal(liveRun.payload.summary.resourceCounts.mapped > 0, true, "real_live_mapped_resources");
  const report = JSON.parse(await readFile(liveRun.payload.reportPath, "utf8"));
  assertReportWhitelist(report, "real_live_report");
  assert.deepEqual(report, liveRun.payload.summary, "real_live_report_matches_summary");
  for (const mutation of ["Create", "Delete", "Modify", "Run", "Terminate", "Put", "Update", "Attach", "Detach"]) {
    assert.equal(runnerModules.calls.some((call) => call.startsWith(mutation)), false, `runner_mutation_sdk_call_must_not_happen:${mutation}`);
  }
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await rm(runtimeReportDir, { recursive: true, force: true });
}

const moduleSource = await readFile(modulePath, "utf8");
assert.equal(moduleSource.includes("process.env"), false, "factory_must_not_read_process_env");
assert.equal(moduleSource.includes("readFile"), false, "factory_must_not_read_secret_file");
assert.equal(moduleSource.includes(liveSecretPathProof), false, "factory_must_not_reference_real_secret_path");
assert.equal(moduleSource.includes("tencentcloud-sdk-nodejs"), false, "factory_must_not_import_sdk_dependency");
assert.equal(moduleSource.includes("@tencentcloud"), false, "factory_must_not_import_sdk_namespace");
assert.equal(/call\s*\(\s*apiName/.test(moduleSource), false, "factory_must_not_expose_generic_call");
assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(moduleSource), false, "factory_must_not_call_mutation_methods");

const runnerSource = await readFile(runnerPath, "utf8");
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
    "real_live_factory_must_not_import_sdk_dependency",
  );
}
assert.equal(portalPackage.includes("@tencentcloud"), false, "portal_package_must_not_add_tencent_sdk_namespace");

const contract = await readFile(contractPath, "utf8");
assert(contract.includes("--sdk-mode tencent-real-readonly"), "contract_must_document_tencent_real_readonly_mode");
assert(contract.includes("默认 smoke 和 CI 不运行真实云"), "contract_must_document_default_smoke_no_real_cloud");

const suite = await readFile(suitePath, "utf8");
assert(suite.includes("smoke-test-v22-tencent-readonly-inventory-real-live-run.mjs"), "mvp_suite_must_include_real_live_run_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_real_live_run",
  checked: [
    "tencent_sdk_factory_module_shape",
    "dependency_injected_sdk_modules_only",
    "tencent_real_readonly_runner_mode",
    "missing_sdk_modules_fail_closed",
    "fake_sdk_modules_pagination_and_multi_region",
    "run_gate_and_allowlist_fail_closed",
    "regions_required_before_sdk_init",
    "mutation_api_rejected_and_not_called",
    "permission_rate_region_network_errors_safe",
    "redacted_stdout_and_report",
    "default_smoke_no_real_secret_or_cloud",
  ],
}, null, 2));
