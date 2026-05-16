import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runCli } from "./v22-tencent-readonly-inventory-runner.mjs";

const repoRoot = path.resolve(".");
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

const fixtureSecretId = "secret-id-proof";

const goodSecretText = [
  "RUN_TENCENT_READONLY_INVENTORY=1",
  `TENCENT_READONLY_SECRET_ID=${fixtureSecretId}`,
  "TENCENT_READONLY_SECRET_KEY=secret-key-proof",
  "TENCENT_READONLY_REGIONS=ap-guangzhou,ap-shanghai",
  `TENCENT_READONLY_ALLOWED_APIS=${allowedApis.join(",")}`,
  "TENCENT_READONLY_ACCOUNT_ID=tencent-account-1234567890",
].join("\n");

function assertNotContainsForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const forbidden = [
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
    "provider-raw-body-proof",
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

function assertDiagnostic(summary, expected, label) {
  assert.equal(summary.ok, false, `${label}_ok_false`);
  assert.equal(summary.blockedReason, "readonly_inventory_live_diagnostic", `${label}_blocked_reason`);
  assert(summary.diagnostic && typeof summary.diagnostic === "object", `${label}_diagnostic_object`);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(summary.diagnostic[key], value, `${label}_${key}`);
  }
  assertNotContainsForbidden(summary, label);
}

function responseForAction(action) {
  if (action === "GetCallerIdentity") {
    return { Response: { AccountId: "tencent-account-1234567890", RequestId: "req-account" } };
  }
  if (action === "DescribeRegions") {
    return { Response: { RegionSet: [{ Region: "ap-guangzhou" }, { Region: "ap-shanghai" }], RequestId: "req-regions" } };
  }
  return { Response: { RequestId: `req-${action}` } };
}

function createTencentErrorFetch({ failAction, code, message = "provider-raw-body-proof", status = 403 }) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const headers = options.headers || {};
    const action = headers["x-tc-action"];
    const body = JSON.parse(options.body || "{}");
    calls.push({ action, url, body });
    assert.equal(headers.authorization.includes("secret-key-proof"), false, `authorization_no_secret_key:${action}`);
    if (action === failAction) {
      return {
        ok: false,
        status,
        async json() {
          return {
            Response: {
              Error: {
                Code: code,
                Message: message,
              },
              RequestId: "req-error",
              RawResponse: "raw-response-proof",
            },
          };
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return responseForAction(action);
      },
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function createNetworkErrorFetch({ failAction }) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const headers = options.headers || {};
    const action = headers["x-tc-action"];
    calls.push({ action, url });
    if (action === failAction) {
      const error = new Error("network raw failure provider-raw-body-proof");
      error.code = "ECONNRESET";
      error.endpoint = "raw-endpoint-proof";
      error.authorizationHeader = "authorization-header-proof";
      throw error;
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return responseForAction(action);
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

async function runTc3(secretFile, runId, fetchImpl) {
  return runCli([
    "--live-readonly",
    "--sdk-mode",
    "tencent-tc3-readonly",
    "--enable-real-fetch",
    "--secret-file",
    secretFile,
    "--run-id",
    runId,
  ], { tc3Fetch: fetchImpl, tc3Now: () => 1700000000 });
}

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-readonly-local-diagnostics-"));
const reportPathsToCleanup = [];
try {
  const secretFile = await writeSecretFixture(tmpDir, "readonly.env", goodSecretText);

  const accountError = await runTc3(
    secretFile,
    "diagnostic-account-auth",
    createTencentErrorFetch({
      failAction: "GetCallerIdentity",
      code: "AuthFailure.UnauthorizedOperation",
    }),
  );
  assert.equal(accountError.status, 1, "account_error_status");
  reportPathsToCleanup.push(accountError.payload.reportPath);
  assert.equal(accountError.payload.reportPath.endsWith(".runtime/v22-tencent-readonly-inventory/diagnostic-account-auth.json"), true, "account_error_report_path");
  assertDiagnostic(accountError.payload.summary, {
    apiName: "DescribeAccount",
    clientMethod: "describeAccount",
    category: "permission_denied",
    providerCode: "AuthFailure.UnauthorizedOperation",
  }, "account_error_summary");
  assert.equal(accountError.payload.summary.accountMasked, "tencent-account-****7890", "account_error_keeps_account_masked");
  assert.deepEqual(accountError.payload.summary.regions, ["ap-guangzhou", "ap-shanghai"], "account_error_keeps_regions");
  assert.deepEqual(accountError.payload.summary.allowedApis, allowedApis, "account_error_keeps_allowed_apis");
  assertDiagnostic(JSON.parse(await readFile(accountError.payload.reportPath, "utf8")), {
    apiName: "DescribeAccount",
    clientMethod: "describeAccount",
    category: "permission_denied",
    providerCode: "AuthFailure.UnauthorizedOperation",
  }, "account_error_report");

  const regionError = await runTc3(
    secretFile,
    "diagnostic-region-invalid-action",
    createTencentErrorFetch({
      failAction: "DescribeRegions",
      code: "InvalidAction",
      status: 400,
    }),
  );
  assert.equal(regionError.status, 1, "region_error_status");
  reportPathsToCleanup.push(regionError.payload.reportPath);
  assertDiagnostic(regionError.payload.summary, {
    apiName: "DescribeRegions",
    clientMethod: "describeRegions",
    category: "sdk_error",
    providerCode: "InvalidAction",
  }, "region_error_summary");

  const networkError = await runTc3(
    secretFile,
    "diagnostic-network",
    createNetworkErrorFetch({ failAction: "GetCallerIdentity" }),
  );
  assert.equal(networkError.status, 1, "network_error_status");
  reportPathsToCleanup.push(networkError.payload.reportPath);
  assertDiagnostic(networkError.payload.summary, {
    apiName: "DescribeAccount",
    clientMethod: "describeAccount",
    category: "network_error",
    providerCode: "ECONNRESET",
  }, "network_error_summary");

  const source = await readFile("services/portal/src/domain/tencent-readonly-inventory-adapter.mjs", "utf8");
  assert(source.includes("describeAccount"), "inventory_adapter_must_wrap_describe_account");
  assert(source.includes("describeRegions"), "inventory_adapter_must_wrap_describe_regions");

  const suite = await readFile(suitePath, "utf8");
  assert(suite.includes("smoke-test-v22-tencent-readonly-inventory-diagnostics-local-gate.mjs"), "mvp_suite_must_include_live_diagnostics_smoke");
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await Promise.all(reportPathsToCleanup.map((reportPath) => rm(reportPath, { force: true })));
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_diagnostics_local_gate",
  checked: [
    "tencent_response_error_sanitized_diagnostic",
    "network_error_sanitized_diagnostic",
    "describe_account_and_regions_have_context",
    "env_summary_kept_after_safe_live_failure",
    "stdout_and_report_redacted",
  ],
}, null, 2));
