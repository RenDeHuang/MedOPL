import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

import { TEST_LANE_SUITES } from "../../scripts/v22-test-classification.mjs";

async function readJson(repoPath) {
  return JSON.parse(await readFile(repoPath, "utf8"));
}

async function pathExists(repoPath) {
  try {
    await stat(repoPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function commandPath(command) {
  assert(command.startsWith("node "), `portal_journey_registry_guard_command_must_be_node_test:${command}`);
  return command.slice("node ".length);
}

const productMatrix = await readJson("contracts/medopl-commercial-launch-product-contract-matrix.json");
const registry = await readJson("services/portal/frontend/src/app/registry/portalJourneyRegistry.json");
const routeSource = await readFile("services/portal/frontend/src/app/routes.tsx", "utf8");
const registrySource = await readFile("services/portal/frontend/src/app/registry/portalJourneyRegistry.ts", "utf8");

const journeys = productMatrix.commercial_launch_product_contract_matrix.journeys;
const journeysById = new Map(journeys.map((journey) => [journey.id, journey]));
const registryById = new Map(registry.journeys.map((journey) => [journey.id, journey]));

assert.equal(registry.schema_version, 1, "portal_journey_registry_schema_version_mismatch");
assert.equal(registry.owner, "services/portal/frontend", "portal_journey_registry_owner_mismatch");
assert.equal(registry.purpose, "portal_journey_registry", "portal_journey_registry_purpose_mismatch");
assert.equal(registry.state, "active", "portal_journey_registry_state_mismatch");
assert.equal(
  registry.authority_boundary,
  "source_level_route_page_action_binding_for_commercial_launch_journeys",
  "portal_journey_registry_authority_boundary_mismatch",
);
assert.equal(
  registry.matrix_source,
  "contracts/medopl-commercial-launch-product-contract-matrix.json",
  "portal_journey_registry_matrix_source_mismatch",
);
assert.equal(
  registry.raw_visual_evidence_policy,
  "runtime_artifact_only_not_git_truth",
  "portal_journey_registry_raw_visual_policy_mismatch",
);
assert.deepEqual(
  registry.journeys.map((journey) => journey.id).sort(),
  journeys.map((journey) => journey.id).sort(),
  "portal_journey_registry_must_cover_every_commercial_journey",
);
assert.deepEqual(
  [...registryById.keys()],
  [...new Set(registry.journeys.map((journey) => journey.id))],
  "portal_journey_registry_journey_ids_must_be_unique",
);

const expectedRouteJourneys = new Map([
  ["/packages", ["plan_selection"]],
  ["/compute", ["open_compute_resource", "release_compute_resource"]],
  ["/storage", ["open_storage_space", "upload_run_artifact", "destroy_or_retain_storage"]],
  ["/usage", ["credit_balance", "usage_billing_reconciliation"]],
  ["/opl", ["enter_opl", "opl_webui_runtime_required"]],
  ["/admin/users", ["account_prepare", "account_approval", "admin_audit_receipt"]],
]);

for (const [route, journeyIds] of expectedRouteJourneys) {
  assert.deepEqual(
    registry.routes?.[route],
    journeyIds,
    `portal_journey_registry_route_journeys_mismatch:${route}`,
  );
}

for (const [journeyId, matrixJourney] of journeysById) {
  const registered = registryById.get(journeyId);
  assert(registered, `portal_journey_registry_journey_missing:${journeyId}`);
  for (const field of [
    "route",
    "page",
    "page_module",
    "primary_action",
    "allowed_states",
    "backend_api",
    "backend_owner",
    "backend_contracts",
    "cannot_claim",
    "regression_gate",
    "legacy_retirement",
    "product_value_evidence",
  ]) {
    assert(registered[field] !== undefined, `portal_journey_registry_field_missing:${journeyId}:${field}`);
  }
  assert.equal(registered.page, matrixJourney.page, `portal_journey_registry_page_mismatch:${journeyId}`);
  assert.equal(registered.primary_action, matrixJourney.primary_action, `portal_journey_registry_action_mismatch:${journeyId}`);
  assert.deepEqual(registered.allowed_states, matrixJourney.allowed_states, `portal_journey_registry_states_mismatch:${journeyId}`);
  assert.equal(registered.backend_api, matrixJourney.backend_truth.api, `portal_journey_registry_backend_api_mismatch:${journeyId}`);
  assert.equal(registered.backend_owner, matrixJourney.backend_truth.owner, `portal_journey_registry_backend_owner_mismatch:${journeyId}`);
  assert.deepEqual(registered.backend_contracts, matrixJourney.backend_truth.contracts, `portal_journey_registry_backend_contracts_mismatch:${journeyId}`);
  assert.equal(
    registered.cannot_claim,
    matrixJourney.receipt_or_cannot_claim.cannot_claim,
    `portal_journey_registry_cannot_claim_mismatch:${journeyId}`,
  );
  assert.deepEqual(registered.regression_gate, matrixJourney.regression_gate, `portal_journey_registry_regression_gate_mismatch:${journeyId}`);
  assert.deepEqual(
    registered.legacy_retirement,
    matrixJourney.legacy_retirement,
    `portal_journey_registry_legacy_retirement_mismatch:${journeyId}`,
  );
  const negativeRegressionGuard = registered.legacy_retirement.negative_regression_guard;
  assert(negativeRegressionGuard, `portal_journey_registry_legacy_negative_guard_missing:${journeyId}`);
  const guardPath = commandPath(negativeRegressionGuard);
  assert(
    await pathExists(guardPath),
    `portal_journey_registry_legacy_negative_guard_path_missing:${journeyId}:${guardPath}`,
  );
  assert(
    registered.regression_gate.includes(negativeRegressionGuard),
    `portal_journey_registry_legacy_negative_guard_must_be_regression_gate:${journeyId}`,
  );
  assert(
    Object.values(TEST_LANE_SUITES).some((suite) => suite.includes(guardPath)),
    `portal_journey_registry_legacy_negative_guard_must_be_laned:${journeyId}:${guardPath}`,
  );
  assert(registry.routes?.[registered.route]?.includes(journeyId), `portal_journey_registry_route_index_missing:${registered.route}:${journeyId}`);
  assert.equal(routeSource.includes(`journeysForRoute("${registered.route}")`), true, `portal_route_must_declare_journey_binding:${registered.route}`);
  for (const evidenceField of [
    "desktop_screenshot",
    "mobile_screenshot",
    "empty_or_error_state",
    "disabled_reason",
    "task_completion_assertion",
    "console_request_clean",
  ]) {
    assert.equal(
      registered.product_value_evidence[evidenceField],
      "runtime_artifact_required",
      `portal_journey_product_value_evidence_missing:${journeyId}:${evidenceField}`,
    );
  }
}

assert(registrySource.includes("portalJourneyRegistry"), "portal_journey_registry_ts_export_missing");
assert(registrySource.includes("journeysForRoute"), "portal_journey_registry_route_helper_missing");
assert(registrySource.includes("journeyById"), "portal_journey_registry_lookup_helper_missing");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_journey_registry",
  journeys: registry.journeys.length,
  routes: Object.keys(registry.routes).sort(),
}, null, 2));
