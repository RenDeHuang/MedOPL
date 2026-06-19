import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import { TEST_LANE_SUITES } from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readJson(repoPath) {
  return JSON.parse(await readFile(path.join(repoRoot, repoPath), "utf8"));
}

const release = await readJson("contracts/medopl-release-boundary.json");
const cloud = await readJson("contracts/medopl-cloud-boundary.json");
const api = await readJson("contracts/medopl-api-contract.json");
const current = await readJson("tests/fixtures/v22/goal-current.json");

assert.equal(release.authority_boundary.default_real_cloud_mutation, "allowed_when_authorization_pack_is_active", "release_must_use_machine_authorization_pack");
assert.equal(release.authority_boundary.authorization_pack, "contracts/medopl-cloud-authorization-pack.json", "release_must_reference_cloud_authorization_pack");
assert.equal(
  release.medopl_release_boundary.storage_destroy_policy?.runtime_release_default,
  "retain_storage_until_explicit_user_intent",
  "release_must_retain_storage_by_default",
);
assert(release.medopl_release_boundary.required_receipts.includes("storage_destroy_receipt"), "release_must_require_storage_destroy_receipt");
assert(release.medopl_release_boundary.release_phases.includes("destroy_storage_intent"), "release_must_model_destroy_storage_intent");
assert(api.medopl_api_contract.storage_destroy?.must_return.includes("releaseReceipts"), "storage_destroy_api_must_return_release_receipts");
assert(TEST_LANE_SUITES.release.includes("tests/release/release-test-v22-boundary-contract.mjs"), "release_boundary_test_must_be_registered");
assert(TEST_LANE_SUITES.backend.includes("tests/backend/backend-test-v22-api-contract.mjs"), "release_boundary_must_have_backend_api_consumer_gate");
assert(TEST_LANE_SUITES.smoke.includes("tests/smoke/smoke-test-v22-portal-files-billing-trace-flow.mjs"), "release_boundary_must_have_golden_path_runtime_consumer_gate");
assert.equal(cloud.authority_boundary.default_real_cloud_execution, "allowed_when_authorization_pack_is_active", "cloud_must_use_machine_authorization_pack");
assert.equal(cloud.authority_boundary.authorization_pack, "contracts/medopl-cloud-authorization-pack.json", "cloud_must_reference_authorization_pack");
assert.equal(current.release_readiness_state?.blocked_before_risky_execution, true, "current_must_block_risky_execution");
for (const forbidden of ["secret", "true-cloud-mutation", "build-push-kubectl", "deploy", "live-test"]) {
  assert(current.current_leaf.forbidden_ops.includes(forbidden), `current_release_forbidden_op_missing:${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_release_boundary",
}, null, 2));
