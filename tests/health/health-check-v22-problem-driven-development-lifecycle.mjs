import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readJson(repoPath) {
  return JSON.parse(await readFile(repoPath, "utf8"));
}

function commandFor(file) {
  return `node ${file}`;
}

const contractPath = "contracts/medopl-problem-driven-development-lifecycle-contract.json";
const gatePath = "tests/health/health-check-v22-problem-driven-development-lifecycle.mjs";
const [contract, manifest, testReadme] = await Promise.all([
  readJson(contractPath),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readFile("tests/README.md", "utf8"),
]);

const lifecycle = contract.medopl_problem_driven_development_lifecycle_contract;

assert.equal(contract.schema_version, 1, "problem_lifecycle_contract_schema_version_mismatch");
assert.equal(lifecycle.owner, "MedOPL Engineering", "problem_lifecycle_owner_mismatch");
assert.equal(lifecycle.purpose, "problem_driven_development_without_repo_bloat", "problem_lifecycle_purpose_mismatch");
assert.equal(lifecycle.state, "active", "problem_lifecycle_state_mismatch");
assert.equal(lifecycle.authority_boundary.problem_process_truth, "issue_or_runtime_state", "problem_process_truth_must_not_be_repo_docs");
assert.equal(lifecycle.authority_boundary.repo_truth, "source_tests_contracts_small_history_summary", "repo_truth_boundary_mismatch");
assert.equal(lifecycle.authority_boundary.raw_evidence_git_truth, false, "raw_evidence_must_not_be_git_truth");

assert.deepEqual(
  lifecycle.reproducible_problem.required_fields,
  [
    "journey_id",
    "preconditions",
    "steps_to_reproduce",
    "expected_result",
    "actual_result",
    "evidence_pointer",
    "severity",
    "environment",
  ],
  "reproducible_problem_required_fields_mismatch",
);
assert.equal(lifecycle.reproducible_problem.journey_id_source, "contracts/medopl-commercial-launch-product-contract-matrix.json", "journey_id_source_mismatch");
assert.equal(lifecycle.reproducible_problem.observation_without_required_fields, "not_reproducible", "observation_must_not_be_reproducible");

assert.deepEqual(
  lifecycle.dedupe_key.fields,
  [
    "journey_id",
    "invariant_violated",
    "failure_mode",
    "likely_root_cause",
  ],
  "dedupe_key_fields_mismatch",
);
assert.equal(lifecycle.dedupe_key.root_cause_optional_until_triage, true, "root_cause_must_be_optional_until_triage");
assert.equal(lifecycle.dedupe_key.missing_root_cause_value, "unknown_pending_triage", "missing_root_cause_value_mismatch");

assert.equal(lifecycle.repeat_thresholds.same_key_within_30_days, 2, "repeat_30_day_threshold_mismatch");
assert.equal(lifecycle.repeat_thresholds.same_key_within_90_days, 3, "repeat_90_day_threshold_mismatch");
assert.deepEqual(lifecycle.repeat_thresholds.single_occurrence_escalates_for, ["P0", "P1"], "single_occurrence_escalation_mismatch");

assert.deepEqual(
  lifecycle.lifecycle_states,
  ["observed", "reproducible", "fixed", "institutionalized", "cleared"],
  "problem_lifecycle_states_mismatch",
);
assert.equal(lifecycle.state_rules.observed.repo_truth_allowed, false, "observed_problem_must_not_enter_repo_truth");
assert.equal(lifecycle.state_rules.reproducible.minimum_long_lived_asset, "minimal_regression_test_if_core_journey", "reproducible_asset_rule_mismatch");
assert.equal(lifecycle.state_rules.institutionalized.allowed_only_when, "repeated_or_p0_p1", "institutionalized_threshold_mismatch");
assert.equal(lifecycle.state_rules.cleared.requires_transient_evidence_removed, true, "cleared_must_remove_transient_evidence");

assert.deepEqual(
  lifecycle.closeout_assets.allowed_long_lived_assets,
  [
    "source_fix",
    "minimal_regression_test",
    "required_contract_or_schema_constraint",
    "cannot_claim_or_owner_boundary",
    "compact_history_summary_when_product_relevant",
  ],
  "allowed_long_lived_assets_mismatch",
);
assert.deepEqual(
  lifecycle.closeout_assets.forbidden_long_lived_assets,
  [
    "raw_screenshot",
    "raw_trace",
    "temporary_debug_log",
    "one_off_reproduction_payload",
    "full_issue_transcript",
    "closeout_evidence_only_test",
  ],
  "forbidden_long_lived_assets_mismatch",
);
assert.equal(lifecycle.closeout_assets.long_lived_assets_are_permanent, false, "long_lived_assets_must_have_lifecycle");
assert.equal(lifecycle.closeout_assets.cleanup_policy, "merge_delete_or_fold_when_owner_or_journey_retires", "closeout_cleanup_policy_mismatch");

assert.deepEqual(
  lifecycle.cadence,
  {
    weekly: "triage_observed_reproducible_duplicate_not_a_bug",
    biweekly: "clear_stale_observed_and_runtime_evidence",
    monthly: "merge_or_delete_stale_regression_contract_history_assets",
    release: "review_p0_p1_billing_runtime_storage_release_and_cannot_claim",
  },
  "problem_lifecycle_cadence_mismatch",
);

const manifestSuitesById = new Map(manifest.suites.map((suite) => [suite.id, suite]));
for (const suiteId of ["health", "hygiene", "local-contract"]) {
  const commands = manifestSuitesById.get(suiteId)?.commands || [];
  assert(commands.includes(commandFor(gatePath)), `problem_lifecycle_gate_missing_from_manifest_suite:${suiteId}`);
}
assert.equal(
  manifest.problem_driven_development_lifecycle?.contract,
  contractPath,
  "manifest_problem_lifecycle_contract_pointer_mismatch",
);
assert.equal(
  manifest.problem_driven_development_lifecycle?.gate,
  gatePath,
  "manifest_problem_lifecycle_gate_pointer_mismatch",
);
assert.equal(
  manifest.problem_driven_development_lifecycle?.raw_evidence_git_truth,
  false,
  "manifest_problem_lifecycle_raw_evidence_boundary_mismatch",
);

assert(testReadme.includes("Problem-driven Development Lifecycle"), "tests_readme_problem_lifecycle_section_missing");
assert(testReadme.includes("observed -> reproducible -> fixed -> institutionalized -> cleared"), "tests_readme_problem_lifecycle_states_missing");
assert(testReadme.includes("问题过程默认留在 issue / `.runtime`"), "tests_readme_problem_lifecycle_runtime_boundary_missing");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_problem_driven_development_lifecycle",
  gate: gatePath,
  rawEvidenceGitTruth: lifecycle.authority_boundary.raw_evidence_git_truth,
}, null, 2));
