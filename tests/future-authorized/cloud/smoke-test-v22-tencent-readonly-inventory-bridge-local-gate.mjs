import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runCli } from "../../../scripts/v22-tencent-readonly-inventory-runner.mjs";

const repoRoot = path.resolve(".");
const runnerPath = "scripts/v22-tencent-readonly-inventory-runner.mjs";
const contractPath = "docs/contracts/v22-tencent-readonly-inventory-boundary.md";
const suitePath = "tests/contract/smoke-test-v22-mvp-contract-suite.mjs";
const portalPackagePath = "services/portal/package.json";
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
  GetCallerIdentity: {
    endpoint: "sts.intl.tencentcloudapi.com",
    version: "2018-08-13",
  },
  DescribeRegions: {
    endpoint: "cvm.tencentcloudapi.com",
    version: "2017-03-12",
  },
  DescribeInstances: {
    endpoint: "cvm.tencentcloudapi.com",
    version: "2017-03-12",
  },
  DescribeClusters: {
    endpoint: "tke.tencentcloudapi.com",
    version: "2018-05-25",
  },
  ListBuckets: {
    endpoint: "cos.tencentcloudapi.com",
    version: "2018-05-30",
  },
  HeadObject: {
    endpoint: "cos.tencentcloudapi.com",
    version: "2018-05-30",
  },
  DescribeBillSummary: {
    endpoint: "billing.tencentcloudapi.com",
    version: "2018-07-09",
  },
  DescribeTagResources: {
    endpoint: "tag.tencentcloudapi.com",
    version: "2018-08-13",
  },
};

const fixtureSecretId = "secret-id-proof";

function assertNotContainsForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const forbidden = [
    "secret-id-proof",
    "secret-key-proof",
    "token-proof",
    "authorization-header-proof",
    "header-proof",
    "raw-response-proof",
    "raw-request-proof",
    "raw-endpoint-proof",
    "object-key-proof",
    "storage-key-proof",
    "cos-prefix-proof",
    "signed-url-proof",
    "cos-object-body-proof",
    "bucket-policy-proof",
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

function responseForAction(action, body = {}) {
  if (action === "GetCallerIdentity") {
    return { Response: { AccountId: "tencent-account-1234567890", RequestId: "req-account" } };
  }
  if (action === "DescribeRegions") {
    return { Response: { RegionSet: [{ Region: "ap-guangzhou" }], RequestId: "req-regions" } };
  }
  if (action === "DescribeInstances") {
    if (body.NextToken === "page-2") {
      return {
        Response: {
          InstanceSet: [
            {
              InstanceId: "ins-local-bridge-002",
              InstanceState: "RUNNING",
              Tags: ownershipTags({ cloudOperationId: "operation-002", resourceBindingId: "binding-002" }),
            },
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
            InstanceId: "ins-local-bridge-001",
            InstanceState: "RUNNING",
            Tags: ownershipTags(),
            SecretId: "secret-id-proof",
            rawResponse: "raw-response-proof",
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
            BucketRef: "bucket-local-bridge-001",
            PrefixRef: "prefix-local-bridge-001",
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
    return { Response: { SummarySet: [], RequestId: "req-billing" } };
  }
  if (action === "DescribeTagResources") {
    return { Response: { ResourceTagMappingList: [], RequestId: "req-tags" } };
  }
  return { Response: { RequestId: `req-${action}` } };
}

function createFakeGlobalFetch() {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const headers = options.headers || {};
    const action = headers["x-tc-action"];
    const expected = expectedApiMap[action];
    const body = JSON.parse(options.body || "{}");
    calls.push({ url, method: options.method, headers, body });
    assert(expected, `local_bridge_action_must_be_readonly_whitelisted:${action}`);
    assert.equal(options.method, "POST", `local_bridge_method:${action}`);
    assert.equal(url, `https://${expected.endpoint}`, `local_bridge_endpoint:${action}`);
    assert.equal(headers.host, expected.endpoint, `local_bridge_host:${action}`);
    assert.equal(headers["x-tc-version"], expected.version, `local_bridge_version:${action}`);
    assert(headers.authorization?.startsWith(`TC3-HMAC-SHA256 Credential=${fixtureSecretId}/`), `local_bridge_authorization_shape:${action}`);
    assert.equal(headers.authorization.includes("secret-key-proof"), false, `local_bridge_authorization_no_secret_key:${action}`);
    assert.equal(headers.authorization.includes("token-proof"), false, `local_bridge_authorization_no_token:${action}`);
    assert.equal("SemanticApi" in body, false, `local_bridge_body_no_internal_semantic_api:${action}`);
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

async function writeSecretFixture(dir, name, content) {
  const file = path.join(dir, name);
  await writeFile(file, content, "utf8");
  return file;
}

const goodSecretText = [
  "RUN_TENCENT_READONLY_INVENTORY=1",
  `TENCENT_READONLY_SECRET_ID=${fixtureSecretId}`,
  "TENCENT_READONLY_SECRET_KEY=secret-key-proof",
  "TENCENT_READONLY_REGIONS=ap-guangzhou,ap-shanghai",
  `TENCENT_READONLY_ALLOWED_APIS=${allowedApis.join(",")}`,
  "TENCENT_READONLY_ACCOUNT_ID=tencent-account-1234567890",
].join("\n");

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-readonly-inventory-local-bridge-"));
const originalFetch = globalThis.fetch;
const reportPathsToCleanup = [];
try {
  const goodSecretFile = await writeSecretFixture(tmpDir, "readonly.env", goodSecretText);
  const disabledRunFile = await writeSecretFixture(
    tmpDir,
    "disabled.env",
    goodSecretText.replace("RUN_TENCENT_READONLY_INVENTORY=1", "RUN_TENCENT_READONLY_INVENTORY=0"),
  );
  const missingRegionsFile = await writeSecretFixture(
    tmpDir,
    "missing-regions.env",
    goodSecretText.replace(/TENCENT_READONLY_REGIONS=.*/, "TENCENT_READONLY_REGIONS="),
  );
  const mutationApiFile = await writeSecretFixture(
    tmpDir,
    "mutation-api.env",
    goodSecretText.replace("DescribeAccount,DescribeRegions", "DescribeAccount,DeleteObject"),
  );

  const defaultFetch = createFakeGlobalFetch();
  globalThis.fetch = defaultFetch;
  const defaultBlocked = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-tc3-readonly",
    "--secret-file",
    goodSecretFile,
  ]);
  assert.equal(defaultBlocked.status, 1, "local_bridge_default_status");
  assert.equal(defaultBlocked.payload.reportPath, null, "local_bridge_default_no_report");
  assert.equal(defaultBlocked.payload.summary.blockedReason, "tencent_readonly_tc3_fetch_required", "local_bridge_default_reason");
  assert.equal(defaultFetch.calls.length, 0, "local_bridge_default_must_not_call_global_fetch");
  assertReportWhitelist(defaultBlocked.payload.summary, "local_bridge_default_summary");

  const disabledFetch = createFakeGlobalFetch();
  globalThis.fetch = disabledFetch;
  const disabledRun = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-tc3-readonly",
    "--enable-real-fetch",
    "--secret-file",
    disabledRunFile,
  ]);
  assert.equal(disabledRun.status, 1, "local_bridge_disabled_run_status");
  assert.equal(disabledRun.payload.summary.blockedReason, "live_readonly_requires_run_gate", "local_bridge_disabled_run_reason");
  assert.equal(disabledFetch.calls.length, 0, "local_bridge_disabled_run_no_fetch");

  const missingRegionsFetch = createFakeGlobalFetch();
  globalThis.fetch = missingRegionsFetch;
  const missingRegions = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-tc3-readonly",
    "--enable-real-fetch",
    "--secret-file",
    missingRegionsFile,
  ]);
  assert.equal(missingRegions.status, 1, "local_bridge_missing_regions_status");
  assert.equal(missingRegions.payload.summary.blockedReason, "readonly_inventory_regions_required", "local_bridge_missing_regions_reason");
  assert.equal(missingRegionsFetch.calls.length, 0, "local_bridge_missing_regions_no_fetch");

  const mutationFetch = createFakeGlobalFetch();
  globalThis.fetch = mutationFetch;
  let mutationError;
  try {
    await runCli([
      "--live-readonly",
      "--sdk-mode",
      "tencent-tc3-readonly",
      "--enable-real-fetch",
      "--secret-file",
      mutationApiFile,
    ]);
  } catch (error) {
    mutationError = error;
  }
  assert(mutationError, "local_bridge_mutation_api_must_throw");
  assert.match(String(mutationError.message), /readonly_inventory_forbidden_api:DeleteObject/, "local_bridge_mutation_api_reason");
  assert.equal(mutationFetch.calls.length, 0, "local_bridge_mutation_api_no_fetch");

  const liveFetch = createFakeGlobalFetch();
  globalThis.fetch = liveFetch;
  const liveResult = await runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-tc3-readonly",
    "--enable-real-fetch",
    "--secret-file",
    goodSecretFile,
    "--run-id",
    "local-bridge-proof",
  ]);
  assert.equal(liveResult.status, 0, "local_bridge_enabled_status");
  reportPathsToCleanup.push(liveResult.payload.reportPath);
  assert(liveResult.payload.reportPath.endsWith(".runtime/v22-tencent-readonly-inventory/local-bridge-proof.json"), "local_bridge_report_path");
  assertReportWhitelist(liveResult.payload.summary, "local_bridge_stdout_summary");
  assert.equal(liveResult.payload.summary.ok, true, "local_bridge_summary_ok");
  assert.equal(liveResult.payload.summary.mode, "live-readonly", "local_bridge_summary_mode");
  assert.equal(liveResult.payload.summary.resourceCounts.mapped > 0, true, "local_bridge_mapped_resources");
  assert(liveFetch.calls.length > 0, "local_bridge_enabled_calls_fetch");
  for (const call of liveFetch.calls) {
    assert.equal(/Create|Delete|Modify|Run|Terminate|Put|Update|Attach|Detach/i.test(call.headers["x-tc-action"]), false, `local_bridge_mutation_unreachable:${call.headers["x-tc-action"]}`);
  }

  const report = JSON.parse(await readFile(liveResult.payload.reportPath, "utf8"));
  assertReportWhitelist(report, "local_bridge_report");
  assert.deepEqual(report, liveResult.payload.summary, "local_bridge_report_matches_summary");

  const runnerSource = await readFile(runnerPath, "utf8");
  assert(runnerSource.includes("--enable-real-fetch"), "runner_must_define_enable_real_fetch");
  assert(runnerSource.includes("globalThis.fetch"), "runner_must_have_explicit_global_fetch_bridge");
  assert.equal(/(^|\n)\s*source\s+/.test(runnerSource), false, "runner_must_not_source_secret_file");
  assert.equal(runnerSource.includes("process.env"), false, "runner_must_not_read_process_env");
  assert.equal(runnerSource.includes(liveSecretPathProof), false, "runner_must_not_reference_real_secret_path");
  assert.equal(/call\s*\(\s*apiName/.test(runnerSource), false, "runner_must_not_expose_generic_call");
  assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(runnerSource), false, "runner_must_not_call_mutation_methods");

  const portalPackage = await readFile(portalPackagePath, "utf8");
  if (portalPackage.includes("tencentcloud-sdk-nodejs")) {
    assert.equal(
      runnerSource.includes("import(\"tencentcloud-sdk-nodejs\")"),
      false,
      "tc3_local_bridge_must_not_load_official_sdk_dependency",
    );
  }
  assert.equal(portalPackage.includes("@tencentcloud"), false, "portal_package_must_not_add_tencent_sdk_namespace");

  const contract = await readFile(contractPath, "utf8");
  assert(contract.includes("Live Bridge"), "contract_must_document_local_bridge");
  assert(contract.includes("`--enable-real-fetch`"), "contract_must_document_enable_real_fetch");
  assert(contract.includes("默认关闭"), "contract_must_document_fail_closed_default");
  assert(contract.includes("不扩大 create/release"), "contract_must_not_expand_create_release");

  const suite = await readFile(suitePath, "utf8");
  assert(suite.includes("smoke-test-v22-tencent-readonly-inventory-bridge-local-gate.mjs"), "mvp_suite_must_include_local_bridge_smoke");
} finally {
  globalThis.fetch = originalFetch;
  await rm(tmpDir, { recursive: true, force: true });
  await Promise.all(reportPathsToCleanup.map((reportPath) => rm(reportPath, { force: true })));
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_bridge_local_gate",
  checked: [
    "default_without_enable_real_fetch_fail_closed",
    "run_gate_regions_and_api_allowlist_before_fetch",
    "enable_real_fetch_injects_global_fetch_only_after_gate",
    "redacted_stdout_and_runtime_report",
    "mutation_api_unreachable",
    "no_secret_read_no_real_cloud_in_smoke",
  ],
}, null, 2));
