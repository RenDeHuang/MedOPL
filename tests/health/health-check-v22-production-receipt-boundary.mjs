import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_LANE_CONTRACT_REFS,
  TEST_LANE_SUITES,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

const [
  activePlatformSource,
  receiptBoundarySource,
  cloudAuthorization,
  releaseBoundary,
  manifest,
  contractsReadme,
  testsReadme,
] = await Promise.all([
  readRepoFile("scripts/v22-verify.mjs"),
  readRepoFile("scripts/v22-production-receipt-boundary.mjs"),
  readJson("contracts/medopl-cloud-authorization-pack.json"),
  readJson("contracts/medopl-release-boundary.json"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readRepoFile("contracts/README.md"),
  readRepoFile("tests/README.md"),
]);

const contractPath = "contracts/medopl-production-receipt-boundary.json";
const releaseTest = "tests/release/release-test-v22-production-receipt-boundary.mjs";
const healthTest = "tests/health/health-check-v22-production-receipt-boundary.mjs";

for (const marker of [
  contractPath,
  "validateProductionReceiptBoundary",
  "evaluateProductionReceiptManifest",
  "contracts/medopl-portal-ui-quality-contract.json",
  "uiQualityContract",
]) {
  assert(activePlatformSource.includes(marker), `active_platform_must_consume_production_receipt_boundary:${marker}`);
}
assert(receiptBoundarySource.includes("forbidden_raw_manifest_fields"), "receipt_boundary_module_must_enforce_raw_manifest_field_list");
assert(TEST_LANE_CONTRACT_REFS.includes(contractPath), "test_lane_contract_refs_must_include_production_receipt_boundary");
assert(TEST_LANE_SUITES.release.includes(releaseTest), "release_suite_must_include_production_receipt_boundary_test");
assert(TEST_LANE_SUITES.health.includes(healthTest), "health_suite_must_include_production_receipt_boundary_health_test");

const releaseSuite = manifest.suites.find((suite) => suite.id === "release");
const healthSuite = manifest.suites.find((suite) => suite.id === "health");
const currentSuite = manifest.suites.find((suite) => suite.id === "current");
assert(releaseSuite?.commands.includes(`node ${releaseTest}`), "manifest_release_suite_must_run_production_receipt_test");
assert(healthSuite?.commands.includes(`node ${healthTest}`), "manifest_health_suite_must_run_production_receipt_health_test");
assert(currentSuite?.commands.includes(`node ${releaseTest}`), "manifest_current_suite_must_run_production_receipt_test");

assert.equal(
  cloudAuthorization.active_pack.post_authorized_command_receipt_manifest?.required,
  true,
  "cloud_authorization_pack_must_require_post_authorized_command_receipt_manifest",
);
assert.equal(
  cloudAuthorization.active_pack.post_authorized_command_receipt_manifest?.contract,
  contractPath,
  "cloud_authorization_pack_receipt_manifest_contract_mismatch",
);
assert.equal(
  releaseBoundary.authority_boundary.production_receipt_boundary,
  contractPath,
  "release_boundary_must_reference_production_receipt_contract",
);

for (const doc of [contractsReadme, testsReadme]) {
  assert(doc.includes("medopl-production-receipt-boundary"), "docs_must_reference_production_receipt_boundary");
  assert(doc.includes("receipt manifest"), "docs_must_describe_receipt_manifest_boundary");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_production_receipt_boundary_wiring",
}, null, 2));
