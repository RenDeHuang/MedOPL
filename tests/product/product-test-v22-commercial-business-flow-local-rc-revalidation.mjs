import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const requiredLocalRcCommands = [
  "node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk --json",
  "bash -lc \"cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...\"",
];

const requiredCurrentCommands = [
  "node tests/frontend/frontend-test-v22-commercial-launch-ui-productization.mjs",
  "node tests/backend/backend-test-v22-api-contract.mjs",
  "node tests/suites/suite-test-v22-golden-smoke.mjs",
];

function findSuite(manifest, id) {
  return (manifest.suites || []).find((suite) => suite.id === id)
    || (manifest.package_suites || []).find((suite) => suite.id === id);
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

const [manifest, productReadme, commercialE2eTest, storageBillingSmoke, portalBrowserTest] = await Promise.all([
  readFile("tests/fixtures/v22/agent-verify-manifest.json", "utf8").then(JSON.parse),
  readFile("docs/product/README.md", "utf8"),
  readFile("services/medopl-go-backend/internal/service/controlplane/commercial_billing_e2e_test.go", "utf8"),
  readFile("tests/smoke/smoke-test-v22-portal-storage-usage-billing-flow.mjs", "utf8"),
  readFile("tests/regression/portal/regression-test-v22-portal-local-api-action-browser.mjs", "utf8"),
]);

const localRc = findSuite(manifest, "local-release-candidate");
assert(localRc, "local_release_candidate_suite_missing");
for (const command of requiredLocalRcCommands) {
  assert(localRc.commands.includes(command), `local_rc_command_missing:${command}`);
}

const current = findSuite(manifest, "current");
assert(current, "current_suite_missing");
for (const command of requiredCurrentCommands) {
  assert(current.commands.includes(command), `current_command_missing:${command}`);
}

const localRegression = findSuite(manifest, "local-regression");
assert(localRegression, "local_regression_suite_missing");
assert(
  localRegression.commands.includes("node tests/regression/portal/regression-test-v22-portal-local-api-action-browser.mjs"),
  "local_regression_must_cover_portal_local_api_action_browser",
);

const goldenPath = findSuite(manifest, "golden-path");
assert(goldenPath, "golden_path_suite_missing");
assert(
  goldenPath.commands.includes("node tests/suites/suite-test-v22-golden-smoke.mjs"),
  "golden_path_must_run_golden_smoke_wrapper",
);

assertIncludesAll(commercialE2eTest, [
  "PrepareBusinessAccount",
  "ApproveBusinessAccount",
  "CreatePaymentOrder",
  "MarkPaymentPaid",
  "OpenManagedEnvironment",
  "RuntimeGate",
  "RecordFile",
  "StartRun",
  "Release",
  "DestroyStorage",
  "BillingStatement",
  "ResourcePreauthFreeze",
  "UsageDebitRecorded",
  "ReleaseStopBilling",
  "StorageBillingStopped",
  "internal_commercial_billing_ledger_closure",
  "external_psp_settlement",
], "commercial_billing_e2e");

assertIncludesAll(storageBillingSmoke, [
  "TestServiceLocalProductRCUploadFileRunArtifactBillingAuditReleaseAndStorageDestroy",
  "TestServiceStorageFileArtifactMetadataRoundTripsThroughPostgresOwnedRefs",
  "TestServiceBillingLedgerEntriesCarryBusinessReconciliationRefs",
  "TestServiceDestroyStorageUsesCollisionResistantBillingEventID",
], "storage_usage_billing_smoke");

assertIncludesAll(portalBrowserTest, [
  "account_not_approved",
  "insufficient_balance",
  "assertUserCreditLedger",
  "assertRuntimeGateReason",
  "billing_statement_must_include_credit_ledger",
  "runtime_gate_balance_must_be_sufficient_after_credit",
], "portal_browser_business_flow");

assertIncludesAll(productReadme, [
  "owner-created-or-approved MedOPL account with sufficient plan/balance/quota",
  "account prepare -> account approval -> credit -> plan -> open runtime/storage -> upload/run/artifact -> billing ledger -> statement reconciliation -> release/destroy/stop billing",
  "Local RC",
], "product_readme_local_rc_truth");

assertNotIncludesAny(productReadme, [
  "当前阻塞是 real-cloud authorization boundary",
  "real-cloud authorization boundary；它不授权",
  "缺少 local RC 复验",
], "product_readme_old_blocker");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_commercial_business_flow_local_rc_revalidation",
  checked: {
    manifest: ["current", "local-release-candidate"],
    backend: "commercial_billing_e2e",
    frontend: "portal_local_api_action_browser",
    smoke: "portal_storage_usage_billing_flow",
    product_truth: "docs/product/README.md",
  },
  cannotClaim: [
    "cloud executed",
    "build/push/deploy/live-test executed",
    "production complete",
    "external PSP settlement",
  ],
}, null, 2));
