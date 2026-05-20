import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createTencentReadonlyInventoryAdapter } from "../../../services/portal/src/domain/tencent-readonly-inventory-adapter.mjs";
import { createTencentReadonlyInventoryRealSdkClient } from "../../../services/portal/src/domain/tencent-readonly-inventory-real-sdk-client.mjs";

const repoRoot = path.resolve(".");
const modulePath = "services/portal/src/domain/tencent-readonly-inventory-real-sdk-client.mjs";
const runnerPath = "scripts/v22-tencent-readonly-inventory-runner.mjs";
const contractPath = "docs/contracts/v22-tencent-readonly-inventory-boundary.md";
const suitePath = "tests/contract/smoke-test-v22-mvp-contract-suite.mjs";
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

function assertPage(page, label) {
  assert(Array.isArray(page.items), `${label}_items`);
  assert("nextCursor" in page, `${label}_next_cursor`);
  assertNotContainsForbidden(page, label);
}

function assertSafeError(error, category, label) {
  assert(error && typeof error === "object", `${label}_error_object`);
  assert.equal(error.category, category, `${label}_category`);
  assert.equal(typeof error.retryable, "boolean", `${label}_retryable`);
  assertNotContainsForbidden(error, label);
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
    cloudOperationId: "operation-001",
    resourceBindingId: "binding-001",
    serverPlanId: "pro_8c16g_100gb",
    runId: "",
    resourceType: "compute",
    region: "ap-guangzhou",
    ...overrides,
  };
}

function createFakeSdkFactory({ expectedRegions = ["ap-guangzhou", "ap-shanghai"] } = {}) {
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
            InstanceId: "ins-real-001",
            InstanceState: "running",
            Tags: ownershipTags(),
            RawResponse: "raw-sdk-response-proof",
            SecretId: "secret-id-proof",
          },
        ],
        NextToken: "page-2",
        RawResponse: "raw-sdk-response-proof",
      },
      "ap-guangzhou:page-2": {
        items: [
          {
            InstanceId: "ins-real-002",
            InstanceState: "running",
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

  const sdk = {
    DescribeAccount(params = {}) {
      calls.push("DescribeAccount");
      assert.equal(params.SecretId, undefined, "factory_sdk_method_must_not_receive_secret_id");
      return {
        AccountId: "tencent-account-1234567890",
        SecretId: "secret-id-proof",
        SecretKey: "secret-key-proof",
        RawResponse: "raw-sdk-response-proof",
      };
    },
    DescribeRegions() {
      calls.push("DescribeRegions");
      return { Regions: [{ Region: "ap-guangzhou" }, { Region: "ap-shanghai" }] };
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

  const factory = ({ credentials, regions }) => {
    calls.push("sdkFactory");
    assert.equal(credentials.SecretId, "secret-id-proof", "factory_receives_secret_id_in_private_boundary");
    assert.deepEqual(regions, expectedRegions, "factory_receives_regions");
    return sdk;
  };
  factory.calls = calls;
  return factory;
}

const sdkFactory = createFakeSdkFactory();
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

for (const method of [
  "describeAccount",
  "describeRegions",
  "describeCvmInstances",
  "describeTkeClusters",
  "describeCosBuckets",
  "describeCosMetadata",
  "describeBillingSummary",
  "describeTagResources",
]) {
  assert.equal(typeof client[method], "function", `real_sdk_client_method:${method}`);
}
assert.equal("call" in client, false, "real_sdk_client_must_not_expose_generic_call");
assert.equal("rawClient" in client, false, "real_sdk_client_must_not_expose_raw_client");
assert.equal("sdk" in client, false, "real_sdk_client_must_not_expose_sdk");
for (const key of Object.keys(client)) {
  assert.equal(/Create|Delete|Modify|Run|Terminate|Put|Update|Attach|Detach|TagMutation/i.test(key), false, `mutation_method_must_not_be_visible:${key}`);
}

const account = await client.describeAccount();
assert.deepEqual(account, {
  accountMasked: "tencent-account-****7890",
  resourceType: "account",
  resourceStatus: "available",
});
assertNotContainsForbidden(account, "account");

const regions = await client.describeRegions();
assert.deepEqual(regions.items, [{ region: "ap-guangzhou" }, { region: "ap-shanghai" }], "regions");

const page1 = await client.describeCvmInstances({ region: "ap-guangzhou" });
assertPage(page1, "compute_page_1");
assert.equal(page1.nextCursor, "page-2", "compute_cursor");
const page2 = await client.describeCvmInstances({ region: "ap-guangzhou", cursor: page1.nextCursor });
assertPage(page2, "compute_page_2");

const storagePage = await client.describeCosBuckets({ region: "ap-shanghai" });
assertPage(storagePage, "storage_page");
const metadata = await client.describeCosMetadata({
  region: "ap-shanghai",
  bucketRef: storagePage.items[0].bucketRef,
  prefixRef: storagePage.items[0].prefixRef,
});
assert.deepEqual(metadata, {
  region: "ap-shanghai",
  resourceType: "file_space",
  resourceStatus: "metadata_available",
  metadataSummary: { sizeBytes: 4096 },
  billingSummary: { amountCny: "0.00" },
});
assertNotContainsForbidden(metadata, "metadata");

let regionError;
try {
  await client.describeTkeClusters({ region: "ap-shanghai" });
} catch (error) {
  regionError = error;
}
assertSafeError(regionError, "region_unavailable", "region_unavailable");

let rateLimitError;
try {
  await client.describeBillingSummary({ region: "ap-shanghai" });
} catch (error) {
  rateLimitError = error;
}
assertSafeError(rateLimitError, "rate_limited", "rate_limited");

const permissionFactory = createFakeSdkFactory({ expectedRegions: ["ap-guangzhou"] });
const deniedClient = createTencentReadonlyInventoryRealSdkClient({
  sdkFactory: () => ({
    ...permissionFactory({ credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" }, regions: ["ap-guangzhou"] }),
    DescribeInstances() {
      const error = new Error("permission-denied-raw-proof");
      error.code = "PermissionDenied";
      error.rawResponse = "raw-sdk-response-proof";
      throw error;
    },
  }),
  credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
  accountId: "tencent-account-1234567890",
  allowedApis,
  regions: ["ap-guangzhou"],
});
let deniedError;
try {
  await deniedClient.describeCvmInstances({ region: "ap-guangzhou" });
} catch (error) {
  deniedError = error;
}
assertSafeError(deniedError, "permission_denied", "permission_denied");

assert.throws(
  () => createTencentReadonlyInventoryRealSdkClient({
    sdkFactory,
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis: [],
    regions: ["ap-guangzhou"],
  }),
  /readonly_inventory_api_allowlist_required/,
  "allowed_apis_required",
);
assert.throws(
  () => createTencentReadonlyInventoryRealSdkClient({
    sdkFactory,
    credentials: { SecretId: "secret-id-proof", SecretKey: "secret-key-proof" },
    accountId: "tencent-account-1234567890",
    allowedApis: ["DescribeAccount", "CreateInstances"],
    regions: ["ap-guangzhou"],
  }),
  /readonly_inventory_forbidden_api:CreateInstances/,
  "mutation_api_rejected",
);

const liveAdapter = createTencentReadonlyInventoryAdapter({ client });
assert.equal(typeof liveAdapter.listReadonlyInventoryResources, "function", "inventory_adapter_accepts_real_sdk_client");
for (const mutation of ["Create", "Delete", "Modify", "Run", "Terminate", "Put", "Update", "Attach", "Detach"]) {
  assert.equal(sdkFactory.calls.some((call) => call.startsWith(mutation)), false, `mutation_sdk_call_must_not_happen:${mutation}`);
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

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-real-sdk-runner-"));
const reportPathsToCleanup = [];
try {
  const secretFile = path.join(tmpDir, "readonly.env");
  const disabledSecretFile = path.join(tmpDir, "disabled.env");
  const emptyApisFile = path.join(tmpDir, "empty-apis.env");
  const mutationApisFile = path.join(tmpDir, "mutation-apis.env");
  await writeFile(secretFile, goodSecretText, "utf8");
  await writeFile(disabledSecretFile, goodSecretText.replace("RUN_TENCENT_READONLY_INVENTORY=1", "RUN_TENCENT_READONLY_INVENTORY=0"), "utf8");
  await writeFile(emptyApisFile, goodSecretText.replace(/TENCENT_READONLY_ALLOWED_APIS=.*/, "TENCENT_READONLY_ALLOWED_APIS="), "utf8");
  await writeFile(mutationApisFile, goodSecretText.replace("DescribeAccount,DescribeRegions", "DescribeAccount,CreateInstances"), "utf8");

  const disabled = runRunner(["--live-readonly", "--secret-file", disabledSecretFile, "--run-id", "real-sdk-disabled-proof"], 1);
  assert.equal(disabled.reportPath, null, "disabled_live_no_report");
  assert.equal(disabled.summary.blockedReason, "live_readonly_requires_run_gate", "disabled_live_reason");

  runRunner(["--live-readonly", "--secret-file", emptyApisFile, "--run-id", "real-sdk-empty-apis-proof"], 1);
  runRunner(["--live-readonly", "--secret-file", mutationApisFile, "--run-id", "real-sdk-mutation-apis-proof"], 1);

  const liveRun = runRunner([
    "--live-readonly",
    "--secret-file",
    secretFile,
    "--sdk-mode",
    "fake-real-sdk",
    "--run-id",
    "real-sdk-live-proof",
  ]);
  reportPathsToCleanup.push(liveRun.reportPath);
  assert(liveRun.reportPath.endsWith(".runtime/v22-tencent-readonly-inventory/real-sdk-live-proof.json"), "live_report_path");
  assertReportWhitelist(liveRun.summary, "live_stdout_summary");
  assert.equal(liveRun.summary.mode, "live-readonly", "live_summary_mode");
  assert.equal(liveRun.summary.ok, true, "live_summary_ok");
  assert.equal(liveRun.summary.resourceCounts.mapped > 0, true, "live_mapped_resource_count");
  const report = JSON.parse(await readFile(liveRun.reportPath, "utf8"));
  assertReportWhitelist(report, "live_report");
  assert.deepEqual(report, liveRun.summary, "live_stdout_summary_matches_report");

  const defaultLive = runRunner(["--live-readonly", "--secret-file", secretFile, "--run-id", "real-sdk-default-proof"], 1);
  assert.equal(defaultLive.reportPath, null, "default_live_without_runtime_injection_no_report");
  assert.equal(defaultLive.summary.blockedReason, "live_readonly_requires_separate_authorization", "default_live_blocked_reason");
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await Promise.all(reportPathsToCleanup.map((reportPath) => rm(reportPath, { force: true })));
}

const moduleSource = await readFile(modulePath, "utf8");
assert.equal(moduleSource.includes("process.env"), false, "real_sdk_module_must_not_read_process_env");
assert.equal(moduleSource.includes(liveSecretPathProof), false, "real_sdk_module_must_not_read_live_secret_file");
assert.equal(moduleSource.includes("tencentcloud-sdk-nodejs"), false, "real_sdk_module_must_not_import_sdk_dependency");
assert.equal(moduleSource.includes("@tencentcloud"), false, "real_sdk_module_must_not_import_sdk_namespace");
assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(moduleSource), false, "real_sdk_module_must_not_call_mutation_methods");
assert.equal(/call\s*\(\s*apiName/.test(moduleSource), false, "real_sdk_module_must_not_expose_generic_call");

const runnerSource = await readFile(runnerPath, "utf8");
assert.equal(/(^|\n)\s*source\s+/.test(runnerSource), false, "runner_must_not_source_secret_file");
assert.equal(runnerSource.includes("process.env"), false, "runner_must_not_inject_process_env");
assert.equal(runnerSource.includes(liveSecretPathProof), false, "default_smoke_runner_must_not_read_real_secret_path_literal");
assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(runnerSource), false, "runner_must_not_call_mutation_methods");

const contract = await readFile(contractPath, "utf8");
for (const phrase of [
  "Live Readonly Authorization Note",
  "live readonly 只允许读取用户当前会话明确授权的 git 外 readonly inventory secret 文件",
  "只允许读取 `TENCENT_READONLY_*` allowlist key",
  "必须要求 `RUN_TENCENT_READONLY_INVENTORY=1`",
  "只允许调用 check-config 已通过的 Describe/List/Get/Head 类 API",
  "禁止 Create/Delete/Modify/Run/Terminate/Put/Update/Attach/Detach/Tag mutation",
  "输出只能写 `.runtime/v22-tencent-readonly-inventory/*.json`",
  "stdout 只打印脱敏摘要",
  "不创建、不删除、不释放、不扩缩容、不改标签、不扣费",
  "权限/限流/region 错误只进入安全 audit summary",
  "真实 live run 必须由用户在当前会话单独授权后执行",
]) {
  assert(contract.includes(phrase), `contract_missing_live_readonly_note:${phrase}`);
}

const suite = await readFile(suitePath, "utf8");
assert(suite.includes("smoke-test-v22-tencent-readonly-inventory-real-sdk-client.mjs"), "mvp_suite_must_include_real_sdk_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_real_sdk_client",
  checked: [
    "real_sdk_factory_dependency_injection",
    "semantic_readonly_methods_only",
    "fake_sdk_factory_pagination_and_multi_region",
    "mutation_api_rejected_and_not_called",
    "safe_response_and_error_normalization",
    "inventory_adapter_compatibility",
    "live_readonly_runner_gate_with_fake_real_sdk",
    "default_smoke_no_real_secret_or_cloud",
    "live_authorization_note",
  ],
}, null, 2));
