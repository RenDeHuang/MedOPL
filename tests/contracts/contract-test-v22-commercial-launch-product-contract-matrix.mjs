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

const productContractMatrixPath = "contracts/medopl-commercial-launch-product-contract-matrix.json";
const freezeMatrixPath = "contracts/medopl-commercial-launch-freeze-matrix.json";

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertNonEmptyArray(value, label) {
  assert(Array.isArray(value) && value.length > 0, `${label}_must_be_non_empty_array`);
}

function collectSurfaceIds(freezeMatrix) {
  return new Set((freezeMatrix.commercial_launch_freeze_matrix?.surfaces || []).map((surface) => surface.id));
}

const [
  matrix,
  freezeMatrix,
  pageStateMatrix,
  interactionFlowContract,
  apiContract,
  billingContract,
  releaseContract,
  productionReceiptBoundary,
  verifySource,
  productAuthoritySource,
  current,
  manifest,
  contractsIndexSource,
] = await Promise.all([
  readJson(productContractMatrixPath),
  readJson(freezeMatrixPath),
  readJson("contracts/medopl-portal-page-state-matrix.json"),
  readJson("contracts/medopl-portal-interaction-flow-contract.json"),
  readJson("contracts/medopl-api-contract.json"),
  readJson("contracts/medopl-billing-ledger-contract.json"),
  readJson("contracts/medopl-release-boundary.json"),
  readJson("contracts/medopl-production-receipt-boundary.json"),
  readRepoFile("scripts/v22-verify.mjs"),
  readRepoFile("tests/product/product-test-v22-medopl-contract-authority.mjs"),
  readJson("tests/fixtures/v22/goal-current.json"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readRepoFile("contracts/README.md"),
]);

assert.equal(matrix.schema_version, 1, "commercial_launch_product_contract_matrix_schema_version_mismatch");
assert.equal(matrix.state, "active", "commercial_launch_product_contract_matrix_must_be_active");
assert.equal(matrix.owner, "MedOPL Commercial Launch", "commercial_launch_product_contract_matrix_owner_mismatch");
assert.equal(matrix.purpose, "commercial_launch_product_contract_matrix", "commercial_launch_product_contract_matrix_purpose_mismatch");
assert.equal(
  matrix.authority_boundary?.surface,
  "commercial_launch_product_contract",
  "commercial_launch_product_contract_matrix_authority_surface_mismatch",
);
assert.equal(
  matrix.authority_boundary?.allowed_view,
  "persona_business_interaction_state_truth_regression_legacy_retirement_matrix",
  "commercial_launch_product_contract_matrix_allowed_view_mismatch",
);
assert.equal(
  matrix.authority_boundary?.forbidden_view,
  "ui_only_freeze_raw_figma_pixel_truth_or_docs_only_claim",
  "commercial_launch_product_contract_matrix_forbidden_view_mismatch",
);

for (const field of ["consumers", "consumer_tests"]) {
  assertNonEmptyArray(matrix[field], `commercial_launch_product_contract_matrix_${field}`);
}
for (const consumer of [
  "tests/contracts/contract-test-v22-commercial-launch-product-contract-matrix.mjs",
  "tests/product/product-test-v22-medopl-contract-authority.mjs",
  "tests/frontend/frontend-test-v22-portal-page-state-matrix.mjs",
]) {
  assert(matrix.consumers.includes(consumer), `commercial_launch_product_contract_matrix_consumer_missing:${consumer}`);
}

assert(verifySource.includes(productContractMatrixPath), "active_platform_must_consume_commercial_launch_product_contract_matrix");
assert(productAuthoritySource.includes(productContractMatrixPath), "product_authority_test_must_consume_commercial_launch_product_contract_matrix");
assert(current.product_authority?.product_contracts?.includes(productContractMatrixPath), "current_product_authority_must_list_commercial_launch_product_contract_matrix");
assert(manifest.control_plane_files?.includes(productContractMatrixPath), "verify_manifest_control_plane_must_list_commercial_launch_product_contract_matrix");
assert(TEST_LANE_CONTRACT_REFS.includes(productContractMatrixPath), "test_lane_contract_refs_must_include_commercial_launch_product_contract_matrix");
assert(TEST_LANE_SUITES["local-contract"].includes("tests/contracts/contract-test-v22-commercial-launch-product-contract-matrix.mjs"), "local_contract_suite_must_run_commercial_launch_product_contract_matrix_test");
assert(contractsIndexSource.includes(productContractMatrixPath), "contracts_index_must_list_commercial_launch_product_contract_matrix");

assert.equal(
  matrix.commercial_launch_product_contract_matrix?.grain,
  "persona_to_business_step_to_page_action_to_backend_truth_to_receipt_to_regression_to_legacy_retirement",
  "commercial_launch_product_contract_matrix_grain_mismatch",
);
assert.deepEqual(
  matrix.commercial_launch_product_contract_matrix?.required_axes,
  [
    "persona",
    "user_job",
    "business_step",
    "freeze_surface",
    "page",
    "primary_action",
    "allowed_states",
    "backend_truth",
    "receipt_or_cannot_claim",
    "regression_gate",
    "legacy_retirement",
  ],
  "commercial_launch_product_contract_matrix_required_axes_mismatch",
);

const freezeSurfaceIds = collectSurfaceIds(freezeMatrix);
const pageIds = new Set(pageStateMatrix.medopl_portal_page_state_matrix.pages.map((page) => page.id));
const interactionIds = new Set(interactionFlowContract.medopl_portal_interaction_flow_contract.flows.map((flow) => flow.id));
const journeys = matrix.commercial_launch_product_contract_matrix?.journeys || [];
assert(journeys.length >= 10, "commercial_launch_product_contract_matrix_must_cover_full_commercial_journey");

const requiredBusinessSteps = [
  "account_prepare",
  "account_approval",
  "credit_balance",
  "plan_selection",
  "open_compute_resource",
  "open_storage_space",
  "upload_run_artifact",
  "usage_billing_reconciliation",
  "enter_opl",
  "release_compute_resource",
  "destroy_or_retain_storage",
  "admin_audit_receipt",
];
const journeyIds = new Set(journeys.map((journey) => journey.id));
for (const businessStep of requiredBusinessSteps) {
  assert(journeyIds.has(businessStep), `commercial_launch_product_contract_matrix_journey_missing:${businessStep}`);
}

const knownPersonas = new Set([
  "ordinary_user",
  "owner_admin",
  "platform_operator",
  "opl_webui_consumer",
]);
const requiredStateNames = new Set(["loading", "empty", "ready", "blocked", "failed", "pending"]);
const allRegressionGates = new Set();
const allLegacyTargets = [];

for (const journey of journeys) {
  for (const field of matrix.commercial_launch_product_contract_matrix.required_axes) {
    assert(journey[field] !== undefined, `commercial_launch_product_contract_matrix_journey_field_missing:${journey.id}:${field}`);
  }
  assert(knownPersonas.has(journey.persona), `commercial_launch_product_contract_matrix_unknown_persona:${journey.id}:${journey.persona}`);
  assert(freezeSurfaceIds.has(journey.freeze_surface), `commercial_launch_product_contract_matrix_unknown_freeze_surface:${journey.id}:${journey.freeze_surface}`);
  if (journey.page !== "admin_owner_surface" && journey.page !== "opl_webui_runtime_required_surface") {
    assert(pageIds.has(journey.page), `commercial_launch_product_contract_matrix_unknown_page:${journey.id}:${journey.page}`);
  }
  if (journey.primary_action !== "admin_owner_action" && journey.primary_action !== "external_opl_handoff") {
    assert(interactionIds.has(journey.primary_action), `commercial_launch_product_contract_matrix_unknown_interaction:${journey.id}:${journey.primary_action}`);
  }
  assertNonEmptyArray(journey.allowed_states, `commercial_launch_product_contract_matrix_allowed_states:${journey.id}`);
  assert(journey.allowed_states.some((state) => requiredStateNames.has(state)), `commercial_launch_product_contract_matrix_state_floor_missing:${journey.id}`);
  assert(journey.backend_truth?.owner, `commercial_launch_product_contract_matrix_backend_owner_missing:${journey.id}`);
  assertNonEmptyArray(journey.backend_truth?.contracts, `commercial_launch_product_contract_matrix_backend_contracts:${journey.id}`);
  for (const contractPath of journey.backend_truth.contracts) {
    assert(
      [
        productContractMatrixPath,
        freezeMatrixPath,
        "contracts/medopl-product-profile.json",
        "contracts/medopl-portal-page-state-matrix.json",
        "contracts/medopl-portal-interaction-flow-contract.json",
        "contracts/medopl-portal-ui-quality-contract.json",
        "contracts/medopl-api-contract.json",
        "contracts/medopl-runtime-bridge-contract.json",
        "contracts/medopl-data-plane-contract.json",
        "contracts/medopl-billing-ledger-contract.json",
        "contracts/medopl-release-boundary.json",
        "contracts/medopl-cloud-authorization-pack.json",
        "contracts/medopl-production-receipt-boundary.json",
      ].includes(contractPath),
      `commercial_launch_product_contract_matrix_backend_contract_unknown:${journey.id}:${contractPath}`,
    );
  }
  assert(journey.receipt_or_cannot_claim?.cannot_claim, `commercial_launch_product_contract_matrix_cannot_claim_missing:${journey.id}`);
  assertNonEmptyArray(journey.regression_gate, `commercial_launch_product_contract_matrix_regression_gate:${journey.id}`);
  for (const gate of journey.regression_gate) allRegressionGates.add(gate);
  assert(journey.legacy_retirement?.old_surface, `commercial_launch_product_contract_matrix_legacy_old_surface_missing:${journey.id}`);
  assert(journey.legacy_retirement?.replacement_owner, `commercial_launch_product_contract_matrix_legacy_replacement_owner_missing:${journey.id}`);
  assert(journey.legacy_retirement?.deletion_condition, `commercial_launch_product_contract_matrix_legacy_deletion_condition_missing:${journey.id}`);
  allLegacyTargets.push(journey.legacy_retirement.old_surface);
}

for (const requiredGate of [
  "node tests/contracts/contract-test-v22-commercial-launch-product-contract-matrix.mjs",
  "node tests/frontend/frontend-test-v22-portal-page-state-matrix.mjs",
  "node tests/frontend/frontend-test-v22-commercial-launch-ui-productization.mjs",
  "node tests/regression/portal/regression-test-v22-retire-legacy-resource-user-surface.mjs",
]) {
  assert(allRegressionGates.has(requiredGate), `commercial_launch_product_contract_matrix_regression_gate_missing:${requiredGate}`);
}
for (const legacySurface of [
  "cloud_console_resource_order_surface",
  "ui_only_readiness_claim",
  "raw_figma_pixel_truth",
  "release_claim_without_owner_receipt",
  "user_visible_internal_runner_terms",
]) {
  assert(allLegacyTargets.includes(legacySurface), `commercial_launch_product_contract_matrix_legacy_target_missing:${legacySurface}`);
}

assert(
  JSON.stringify(apiContract).includes("account_approved") &&
    JSON.stringify(apiContract).includes("plan_selected") &&
    JSON.stringify(apiContract).includes("balance_sufficient"),
  "api_contract_must_keep_commercial_admission_truth",
);
assert(JSON.stringify(billingContract).includes("resource_preauth_freeze"), "billing_contract_must_keep_preauth_freeze_truth");
assert(JSON.stringify(releaseContract).includes("release_owner_receipt"), "release_contract_must_keep_release_owner_receipt_truth");
assert(JSON.stringify(productionReceiptBoundary).includes("production_complete"), "production_receipt_boundary_must_keep_production_complete_claim_gate");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_commercial_launch_product_contract_matrix",
  journeys: journeys.length,
  regressionGates: allRegressionGates.size,
}, null, 2));
