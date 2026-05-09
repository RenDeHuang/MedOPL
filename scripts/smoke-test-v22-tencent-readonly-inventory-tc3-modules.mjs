import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createTencentReadonlyInventoryRealSdkClient } from "../services/portal/src/domain/tencent-readonly-inventory-real-sdk-client.mjs";
import { createTencentReadonlyInventoryTc3Modules } from "../services/portal/src/domain/tencent-readonly-inventory-tc3-modules.mjs";
import { createTencentReadonlyInventoryTencentSdkFactory } from "../services/portal/src/domain/tencent-readonly-inventory-tencent-sdk-factory.mjs";
import { runCli } from "./v22-tencent-readonly-inventory-runner.mjs";

const repoRoot = path.resolve(".");
const modulePath = "services/portal/src/domain/tencent-readonly-inventory-tc3-modules.mjs";
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

const expectedApiMap = {
  DescribeAccount: {
    endpoint: "sts.intl.tencentcloudapi.com",
    service: "sts",
    action: "GetCallerIdentity",
    version: "2018-08-13",
  },
  DescribeRegions: {
    endpoint: "cvm.tencentcloudapi.com",
    service: "cvm",
    action: "DescribeRegions",
    version: "2017-03-12",
  },
  DescribeInstances: {
    endpoint: "cvm.tencentcloudapi.com",
    service: "cvm",
    action: "DescribeInstances",
    version: "2017-03-12",
  },
  DescribeClusters: {
    endpoint: "tke.tencentcloudapi.com",
    service: "tke",
    action: "DescribeClusters",
    version: "2018-05-25",
  },
  ListBuckets: {
    endpoint: "cos.tencentcloudapi.com",
    service: "cos",
    action: "ListBuckets",
    version: "2018-05-30",
  },
  HeadObject: {
    endpoint: "cos.tencentcloudapi.com",
    service: "cos",
    action: "HeadObject",
    version: "2018-05-30",
  },
  DescribeBillSummary: {
    endpoint: "billing.tencentcloudapi.com",
    service: "billing",
    action: "DescribeBillSummary",
    version: "2018-07-09",
  },
  DescribeTagResources: {
    endpoint: "tag.tencentcloudapi.com",
    service: "tag",
    action: "DescribeTagResources",
    version: "2018-08-13",
  },
};

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
    "raw-response-proof",
    "raw-request-proof",
    "raw-endpoint-proof",
    "authorization-header-proof",
    "permission-denied-raw-proof",
    "rate-limited-raw-proof",
    "network-error-raw-proof",
  ];
  for (const phrase of forbidden) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
  assert.equal(
    /SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|cosPrefix|signedUrl|bucketPolicy|cosObjectBody|rawRequest|rawResponse|providerRawResponse|rawEndpoint|authorizationHeader|headers/i.test(serialized),
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

function responseForAction(action, body = {}) {
  if (action === "GetCallerIdentity") {
    return { Response: { AccountId: "tencent-account-1234567890", RequestId: "req-account" } };
  }
  if (action === "DescribeRegions") {
    return { Response: { RegionSet: [{ Region: "ap-guangzhou" }, { Region: "ap-shanghai" }], RequestId: "req-regions" } };
  }
  if (action === "DescribeInstances") {
    if (body.NextToken === "page-2") {
      return {
        Response: {
          InstanceSet: [
            { InstanceId: "ins-002", InstanceState: "RUNNING", Tags: ownershipTags({ resourceOrderId: "order-002", resourceBindingId: "binding-002" }) },
          ],
          NextToken: "",
          RequestId: "req-cvm-2",
        },
      };
    }
    return {
      Response: {
        InstanceSet: [
          {
            InstanceId: "ins-001",
            InstanceState: "RUNNING",
            Tags: ownershipTags(),
            RawResponse: "raw-response-proof",
            SecretId: "secret-id-proof",
          },
        ],
        NextToken: "page-2",
        RequestId: "req-cvm-1",
      },
    };
  }
  if (action === "DescribeClusters") {
    return { Response: { Clusters: [], RequestId: "req-tke" } };
  }
  if (action === "ListBuckets") {
    return {
      Response: {
        BucketSet: [
          {
            BucketRef: "bucket-001",
            PrefixRef: "prefix-001",
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
        RequestId: "req-cos-list",
      },
    };
  }
  if (action === "HeadObject") {
    return {
      Response: {
        Exists: true,
        MetadataSummary: { sizeBytes: 4096 },
        BillingSummary: { amountCny: "0.00" },
        objectKey: "object-key-proof",
        cosObjectBody: "cos-object-body-proof",
        rawResponse: "raw-response-proof",
        RequestId: "req-cos-head",
      },
    };
  }
  if (action === "DescribeBillSummary") {
    return { Response: { SummarySet: [{ Cost: "1.23" }], RequestId: "req-billing" } };
  }
  if (action === "DescribeTagResources") {
    return { Response: { ResourceTagMappingList: [], RequestId: "req-tags" } };
  }
  return { Response: { RequestId: `req-${action}` } };
}

function createFakeFetch({ failAction = "", failMode = "" } = {}) {
  const calls = [];
  const configByAction = new Map(Object.entries(expectedApiMap).map(([semanticApi, config]) => [config.action, { semanticApi, ...config }]));
  const fetchImpl = async (url, options = {}) => {
    const headers = options.headers || {};
    const action = headers["x-tc-action"];
    const expected = configByAction.get(action);
    const body = JSON.parse(options.body || "{}");
    calls.push({ url, method: options.method, headers, body });
    assert(expected, `tc3_action_must_be_whitelisted:${action}`);
    assert.equal(options.method, "POST", `tc3_method:${action}`);
    assert(headers.authorization?.startsWith("TC3-HMAC-SHA256 Credential=AKIDEXAMPLE/"), `tc3_authorization:${action}`);
    assert.equal(headers.authorization.includes("secret-key-proof"), false, `authorization_must_not_contain_secret_key:${action}`);
    assert.equal(headers.authorization.includes("token-proof"), false, `authorization_must_not_contain_token:${action}`);
    assert.equal(typeof headers["x-tc-timestamp"], "string", `tc3_timestamp:${action}`);
    assert.equal(headers["x-tc-region"] || "", body.Region || "", `tc3_region_header:${action}`);
    assert.equal(headers["x-tc-version"], expected.version, `tc3_version:${action}`);
    assert.equal(url, `https://${expected.endpoint}`, `tc3_endpoint:${expected.semanticApi}`);
    assert.equal(headers.host, expected.endpoint, `tc3_host:${expected.semanticApi}`);
    assert.equal(headers["content-type"], "application/json; charset=utf-8", `tc3_content_type:${expected.semanticApi}`);
    assert.equal("SemanticApi" in body, false, `tc3_body_must_not_include_internal_semantic_api:${expected.semanticApi}`);
    if (headers["x-tc-token"]) {
      assert.equal(headers["x-tc-token"], "token-proof", `tc3_token_private_header:${expected.semanticApi}`);
    }

    if (failAction && action === failAction) {
      if (failMode === "network") {
        const error = new Error("network-error-raw-proof");
        error.code = "NetworkError";
        error.endpoint = "raw-endpoint-proof";
        error.authorizationHeader = "authorization-header-proof";
        throw error;
      }
      const errorCode = failMode === "rate" ? "RequestLimitExceeded" : "AuthFailure.PermissionDenied";
      const message = failMode === "rate" ? "rate-limited-raw-proof" : "permission-denied-raw-proof";
      return {
        ok: false,
        status: failMode === "rate" ? 429 : 403,
        async json() {
          return { Response: { Error: { Code: errorCode, Message: message }, RequestId: "req-error", rawResponse: "raw-response-proof" } };
        },
      };
    }

    return {
      ok: true,
      status: 200,
      async json() {
        return responseForAction(action, body);
      },
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const fetchImpl = createFakeFetch();
const tc3Modules = createTencentReadonlyInventoryTc3Modules({
  fetchImpl,
  now: () => 1700000000,
});
assert.deepEqual(Object.keys(tc3Modules).sort(), [
  "createAccountClient",
  "createBillingClient",
  "createCosClient",
  "createCvmClient",
  "createRegionClient",
  "createTagClient",
  "createTkeClient",
].sort(), "tc3_modules_factory_whitelist");
assert.equal("call" in tc3Modules, false, "tc3_modules_must_not_expose_generic_call");
assert.equal("rawClient" in tc3Modules, false, "tc3_modules_must_not_expose_raw_client");
assert.equal("sdk" in tc3Modules, false, "tc3_modules_must_not_expose_sdk");

const sdkFactory = createTencentReadonlyInventoryTencentSdkFactory({ sdkModules: tc3Modules });
const sdk = sdkFactory({
  credentials: { SecretId: "AKIDEXAMPLE", SecretKey: "secret-key-proof", token: "token-proof" },
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
].sort(), "tc3_sdk_method_whitelist");
for (const key of Object.keys(sdk)) {
  assert.equal(/Create|Delete|Modify|Run|Terminate|Attach|Detach|Put|Update|TagMutation|Policy/i.test(key), false, `mutation_method_must_not_be_visible:${key}`);
}

const client = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory,
  credentials: { SecretId: "AKIDEXAMPLE", SecretKey: "secret-key-proof", token: "token-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou", "ap-shanghai"],
});
const account = await client.describeAccount();
assert.equal(account.accountMasked, "tencent-account-****7890", "tc3_account_masked");
assertNotContainsForbidden(account, "account");
const regions = await client.describeRegions();
assert.deepEqual(regions.items, [{ region: "ap-guangzhou" }, { region: "ap-shanghai" }], "tc3_regions");
const page1 = await client.describeCvmInstances({ region: "ap-guangzhou" });
assert.equal(page1.nextCursor, "page-2", "tc3_cvm_page_cursor");
assertNotContainsForbidden(page1, "cvm_page_1");
const page2 = await client.describeCvmInstances({ region: "ap-guangzhou", cursor: page1.nextCursor });
assert.equal(page2.items.length, 1, "tc3_cvm_page_2_items");
const bucketPage = await client.describeCosBuckets({ region: "ap-shanghai" });
assert.equal(bucketPage.items.length, 1, "tc3_bucket_items");
assertNotContainsForbidden(bucketPage, "bucket_page");
const metadata = await client.describeCosMetadata({
  region: "ap-shanghai",
  bucketRef: bucketPage.items[0].bucketRef,
  prefixRef: bucketPage.items[0].prefixRef,
});
assert.deepEqual(metadata.metadataSummary, { sizeBytes: 4096 }, "tc3_cos_metadata_summary");
assert.equal("cosObjectBody" in metadata, false, "tc3_cos_metadata_must_not_include_body");
assertNotContainsForbidden(metadata, "metadata");

const calledActions = fetchImpl.calls.map((call) => call.headers["x-tc-action"]);
assert.deepEqual(calledActions, [
  "GetCallerIdentity",
  "DescribeRegions",
  "DescribeInstances",
  "DescribeInstances",
  "ListBuckets",
  "HeadObject",
], "tc3_called_actions");
const accountCall = fetchImpl.calls.find((call) => call.headers["x-tc-action"] === "GetCallerIdentity");
assert(accountCall, "tc3_describe_account_call_required");
assert.equal(accountCall.url, "https://sts.intl.tencentcloudapi.com", "tc3_describe_account_intl_url");
assert.equal(accountCall.headers.host, "sts.intl.tencentcloudapi.com", "tc3_describe_account_intl_host");
assert.equal(accountCall.headers["x-tc-action"], "GetCallerIdentity", "tc3_describe_account_action");
assert.equal(accountCall.headers["x-tc-version"], "2018-08-13", "tc3_describe_account_version");
assert(accountCall.headers.authorization.includes("/sts/tc3_request"), "tc3_describe_account_service_scope");
assert.equal(accountCall.headers.authorization.includes("secret-key-proof"), false, "tc3_describe_account_authorization_no_secret_key");
assert.equal(accountCall.headers.authorization.includes("token-proof"), false, "tc3_describe_account_authorization_no_token");
for (const call of fetchImpl.calls) {
  const body = call.body;
  const expected = Object.values(expectedApiMap).find((config) => config.action === call.headers["x-tc-action"]);
  assert(expected, `tc3_endpoint_whitelist:${call.headers["x-tc-action"]}`);
  assert.equal(call.url, `https://${expected.endpoint}`, `tc3_endpoint_whitelist:${call.headers["x-tc-action"]}`);
  assert.equal(call.headers["x-tc-version"], expected.version, `tc3_version_whitelist:${call.headers["x-tc-action"]}`);
  assert.equal("SemanticApi" in body, false, `tc3_body_no_internal_semantic_api:${call.headers["x-tc-action"]}`);
}

assert.throws(
  () => createTencentReadonlyInventoryTc3Modules({}),
  /tencent_readonly_tc3_fetch_required/,
  "tc3_fetch_required",
);
assert.throws(
  () => sdkFactory({
    credentials: { SecretId: "AKIDEXAMPLE", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis: [],
    regions: ["ap-guangzhou"],
  }),
  /readonly_inventory_api_allowlist_required/,
  "tc3_allowed_apis_required",
);
assert.throws(
  () => sdkFactory({
    credentials: { SecretId: "AKIDEXAMPLE", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis: ["DescribeAccount", "DeleteObject"],
    regions: ["ap-guangzhou"],
  }),
  /readonly_inventory_forbidden_api:DeleteObject/,
  "tc3_mutation_api_rejected",
);

const permissionClient = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
    sdkModules: createTencentReadonlyInventoryTc3Modules({ fetchImpl: createFakeFetch({ failAction: "DescribeInstances", failMode: "permission" }), now: () => 1700000000 }),
  }),
  credentials: { SecretId: "AKIDEXAMPLE", SecretKey: "secret-key-proof", token: "token-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou"],
});
let permissionError;
try {
  await permissionClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  permissionError = error;
}
assert.equal(permissionError.category, "permission_denied", "tc3_permission_error_category");
assertNotContainsForbidden(permissionError, "permission_error");

const rateClient = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
    sdkModules: createTencentReadonlyInventoryTc3Modules({ fetchImpl: createFakeFetch({ failAction: "DescribeBillSummary", failMode: "rate" }), now: () => 1700000000 }),
  }),
  credentials: { SecretId: "AKIDEXAMPLE", SecretKey: "secret-key-proof", token: "token-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-shanghai"],
});
let rateError;
try {
  await rateClient.describeBillingSummary({ region: "ap-shanghai" });
} catch (error) {
  rateError = error;
}
assert.equal(rateError.category, "rate_limited", "tc3_rate_error_category");
assertNotContainsForbidden(rateError, "rate_error");

const networkClient = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory: createTencentReadonlyInventoryTencentSdkFactory({
    sdkModules: createTencentReadonlyInventoryTc3Modules({ fetchImpl: createFakeFetch({ failAction: "DescribeInstances", failMode: "network" }), now: () => 1700000000 }),
  }),
  credentials: { SecretId: "AKIDEXAMPLE", SecretKey: "secret-key-proof", token: "token-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou"],
});
let networkError;
try {
  await networkClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  networkError = error;
}
assert.equal(networkError.category, "network_error", "tc3_network_error_category");
assert.equal(networkError.retryable, true, "tc3_network_error_retryable");
assertNotContainsForbidden(networkError, "network_error");

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
  "TENCENT_READONLY_SECRET_ID=AKIDEXAMPLE",
  "TENCENT_READONLY_SECRET_KEY=secret-key-proof",
  "TENCENT_READONLY_REGIONS=ap-guangzhou,ap-shanghai",
  `TENCENT_READONLY_ALLOWED_APIS=${allowedApis.join(",")}`,
  "TENCENT_READONLY_ACCOUNT_ID=tencent-account-1234567890",
].join("\n");

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-tc3-modules-"));
try {
  const secretFile = path.join(tmpDir, "readonly.env");
  await writeFile(secretFile, goodSecretText, "utf8");

  const missingFetch = runRunner(["--live-readonly", "--sdk-mode", "tencent-tc3-readonly", "--secret-file", secretFile], 1);
  assert.equal(missingFetch.reportPath, null, "tc3_cli_without_injected_fetch_no_report");
  assert.equal(missingFetch.summary.blockedReason, "tencent_readonly_tc3_fetch_required", "tc3_cli_without_fetch_reason");

  const runResult = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-tc3-readonly",
    "--secret-file",
    secretFile,
    "--run-id",
    "tc3-live-proof",
  ], { tc3Fetch: createFakeFetch(), tc3Now: () => 1700000000 });
  assert.equal(runResult.status, 0, "tc3_run_cli_status");
  assert(runResult.payload.reportPath.endsWith(".runtime/v22-tencent-readonly-inventory/tc3-live-proof.json"), "tc3_report_path");
  assertReportWhitelist(runResult.payload.summary, "tc3_run_summary");
  assert.equal(runResult.payload.summary.mode, "live-readonly", "tc3_run_mode");
  assert.equal(runResult.payload.summary.ok, true, "tc3_run_ok");
  assert.equal(runResult.payload.summary.resourceCounts.mapped > 0, true, "tc3_mapped_resource_count");
  const report = JSON.parse(await readFile(runResult.payload.reportPath, "utf8"));
  assertReportWhitelist(report, "tc3_run_report");
  assert.deepEqual(report, runResult.payload.summary, "tc3_report_matches_summary");
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await rm(runtimeReportDir, { recursive: true, force: true });
}

const moduleSource = await readFile(modulePath, "utf8");
assert.equal(moduleSource.includes("process.env"), false, "tc3_module_must_not_read_process_env");
assert.equal(moduleSource.includes("readFile"), false, "tc3_module_must_not_read_secret_file");
assert.equal(moduleSource.includes(liveSecretPathProof), false, "tc3_module_must_not_reference_real_secret_path");
assert.equal(moduleSource.includes("tencentcloud-sdk-nodejs"), false, "tc3_module_must_not_import_tencent_sdk");
assert.equal(moduleSource.includes("@tencentcloud"), false, "tc3_module_must_not_import_tencent_sdk_namespace");
assert.equal(/call\s*\(\s*apiName/.test(moduleSource), false, "tc3_module_must_not_expose_generic_call");
assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(moduleSource), false, "tc3_module_must_not_call_mutation_methods");

const runnerSource = await readFile(runnerPath, "utf8");
assert.equal(/(^|\n)\s*source\s+/.test(runnerSource), false, "runner_must_not_source_secret_file");
assert.equal(runnerSource.includes("process.env"), false, "runner_must_not_read_process_env");
assert.equal(runnerSource.includes(liveSecretPathProof), false, "runner_must_not_reference_real_secret_path");
assert.equal(/call\s*\(\s*apiName/.test(runnerSource), false, "runner_must_not_expose_generic_call");

const portalPackage = await readFile(portalPackagePath, "utf8");
assert.equal(portalPackage.includes("tencentcloud-sdk-nodejs"), false, "portal_package_must_not_add_tencent_sdk_dependency");
assert.equal(portalPackage.includes("@tencentcloud"), false, "portal_package_must_not_add_tencent_sdk_namespace");

const contract = await readFile(contractPath, "utf8");
assert(contract.includes("TC3 readonly modules 属于 readonly inventory live client implementation"), "contract_must_document_tc3_modules_boundary");
assert(contract.includes("不是 create/release，不扩大 mutation 权限"), "contract_must_not_expand_mutation");

const suite = await readFile(suitePath, "utf8");
assert(suite.includes("smoke-test-v22-tencent-readonly-inventory-tc3-modules.mjs"), "mvp_suite_must_include_tc3_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_tc3_modules",
  checked: [
    "tc3_modules_factory_shape",
    "tc3_authorization_and_headers",
    "endpoint_action_service_version_whitelist",
    "fetch_dependency_injection",
    "no_real_cloud_call_in_smoke",
    "mutation_api_rejected",
    "allowed_apis_fail_closed",
    "safe_error_normalization",
    "raw_response_and_secret_redaction",
    "cos_head_metadata_without_object_body",
    "runner_tencent_tc3_readonly_injected_path",
  ],
}, null, 2));
