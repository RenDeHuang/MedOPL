import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const productContractPaths = Object.freeze([
  "contracts/medopl-product-profile.json",
  "contracts/medopl-commercial-launch-freeze-matrix.json",
  "contracts/medopl-portal-page-state-matrix.json",
  "contracts/medopl-portal-interaction-flow-contract.json",
  "contracts/medopl-portal-ui-quality-contract.json",
  "contracts/medopl-api-contract.json",
  "contracts/medopl-runtime-bridge-contract.json",
  "contracts/medopl-data-plane-contract.json",
  "contracts/medopl-billing-ledger-contract.json",
  "contracts/medopl-release-boundary.json",
  "contracts/medopl-cloud-boundary.json",
  "contracts/medopl-cloud-authorization-pack.json",
  "contracts/medopl-production-receipt-boundary.json",
]);

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function flattenCommands(manifest) {
  return [
    ...(manifest.suites ?? []).flatMap((suite) => suite.commands ?? []),
    ...(manifest.package_suites ?? []).flatMap((suite) => suite.commands ?? []),
    ...(manifest.leaves ?? []).flatMap((leaf) => leaf.verification_commands ?? []),
  ].map(String);
}

const [packageJson, manifest, current, verifySource] = await Promise.all([
  readJson("package.json"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readJson("tests/fixtures/v22/goal-current.json"),
  readRepoFile("scripts/v22-verify.mjs"),
]);
const productProfile = await readJson("contracts/medopl-product-profile.json");

assert.equal(await exists("changes"), false, "changes_directory_must_be_physically_retired");
assert.equal(packageJson.scripts["gate:change"], undefined, "gate_change_script_must_be_retired");
assert.equal(packageJson.scripts["closeout:check"], undefined, "change_package_closeout_script_must_be_retired");
assert.equal(manifest.change_lifecycle_policy, undefined, "manifest_change_lifecycle_policy_must_be_retired");
assert.equal(
  manifest.control_plane_files?.some((file) => String(file).startsWith("changes/")),
  false,
  "manifest_control_plane_must_not_include_changes",
);

for (const contractPath of productContractPaths) {
  const contract = await readJson(contractPath);
  assert.equal(contract.state, "active", `product_contract_must_be_active:${contractPath}`);
  assert.equal(typeof contract.owner, "string", `product_contract_owner_missing:${contractPath}`);
  assert.equal(typeof contract.purpose, "string", `product_contract_purpose_missing:${contractPath}`);
  assert(contract.authority_boundary && typeof contract.authority_boundary === "object", `product_contract_authority_boundary_missing:${contractPath}`);
  assert(
    Array.isArray(contract.consumers) || Array.isArray(contract.consumer_tests),
    `product_contract_must_declare_consumers:${contractPath}`,
  );
}

assert(verifySource.includes("PRODUCT_AUTHORITY_CONTRACTS"), "active_platform_must_enumerate_product_authority_contracts");
for (const contractPath of productContractPaths) {
  assert(verifySource.includes(contractPath), `active_platform_must_consume_contract:${contractPath}`);
}

const allCommands = flattenCommands(manifest);
for (const command of allCommands) {
  assert.equal(command.includes("change-package"), false, `verify_manifest_must_not_run_change_package:${command}`);
  assert.equal(command.includes("changes/"), false, `verify_manifest_must_not_depend_on_changes:${command}`);
}

assert.equal(current.current_truth_role, "machine_cursor_fixture", "current_fixture_role_mismatch");
assert.equal(current.product_authority?.contracts_dir, "contracts", "current_fixture_must_point_to_contracts_authority");
assert.deepEqual(current.product_authority?.product_contracts, productContractPaths, "current_fixture_product_contracts_mismatch");
assert.equal(current.product_authority?.changes_retired, true, "current_fixture_must_mark_changes_retired");
const commercialGapMap = current.commercial_runtime_business_closure_goal_gap_map;
assert(commercialGapMap, "commercial_runtime_business_closure_goal_gap_map_missing");
const commercialGap6 = commercialGapMap.gaps?.find((gap) => gap.gap_id === "gap6");
assert(commercialGap6, "commercial_gap6_missing");
assert.equal(
  commercialGap6.slice_id,
  "goal-commercial-gap6-local-controlled-business-closure",
  "commercial_gap6_must_use_local_controlled_business_closure_slice",
);
assert.equal(
  commercialGap6.target_business_capability,
  "local/controlled commercial billing closure",
  "commercial_gap6_must_not_be_production_canary_rollout_closure",
);
assert.equal(commercialGap6.cloud_execute_required, false, "commercial_gap6_must_not_require_cloud_execute");
assert.equal(
  commercialGap6.deployment_proof_boundary,
  "future_separate_deployment_proof_not_gap6_blocker",
  "commercial_gap6_deployment_proof_boundary_mismatch",
);
for (const marker of ["account_approved", "plan_selected", "balance_sufficient", "quota_available", "resource_preauth_freeze", "return_to_opl_task", "insufficient_balance_fail_closed"]) {
  assert(commercialGap6.minimum_evidence_slice?.includes(marker), `commercial_gap6_minimum_evidence_missing:${marker}`);
}
for (const forbidden of ["MEDOPL_CANARY", "selected-user", "selected user", "selected tenant", "selected canary", "allowlist"]) {
  assert(
    !JSON.stringify(commercialGap6).includes(forbidden),
    `commercial_gap6_must_not_depend_on_canary_rollout_governance:${forbidden}`,
  );
}
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface?.name, "opl-webui", "product_profile_primary_consumer_must_be_opl_webui");
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface?.ordinary_chat_owner, "opl-webui", "product_profile_ordinary_chat_owner_must_be_opl_webui");
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface?.runtime_required_owner, "medopl", "product_profile_runtime_required_owner_must_be_medopl");
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface?.integration_contract, "POST /api/opl/runtime-gate", "product_profile_runtime_gate_contract_mismatch");
assert.deepEqual(
  productProfile.medopl_product_profile.primary_user_offer,
  [
    "compute_resource",
    "storage_space",
    "package_plan",
    "task_concurrency",
    "usage_billing",
    "resource_lifecycle",
    "opl_entry",
  ],
  "product_profile_primary_offer_must_be_resource_control_surface",
);
assert.equal(
  productProfile.medopl_product_profile.supporting_receipt_surface?.audit,
  "billing_release_storage_lifecycle_receipt",
  "product_profile_audit_must_be_supporting_receipt_not_primary_offer",
);
assert.equal(
  productProfile.medopl_product_profile.user_surface_forbidden_objects?.includes("raw_trace"),
  true,
  "product_profile_user_surface_must_forbid_raw_trace",
);
assert.equal(
  productProfile.medopl_product_profile.owner_split?.medopl_owns?.includes("compute_resource_lifecycle"),
  true,
  "product_profile_owner_split_must_make_compute_resource_lifecycle_medopl_owned",
);
assert.equal(
  productProfile.medopl_product_profile.owner_split?.opl_webui_owns?.includes("chat_first_project_session_surface"),
  true,
  "product_profile_owner_split_must_keep_chat_session_surface_with_opl_webui",
);
assert.equal(
  productProfile.medopl_product_profile.owner_split?.opl_webui_owns?.includes("file_management_experience"),
  true,
  "product_profile_owner_split_must_keep_file_management_with_opl_webui",
);

const testDirs = await readdir(path.join(repoRoot, "tests"), { withFileTypes: true });
const testDirNames = new Set(testDirs.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
for (const dirName of ["product", "frontend", "backend", "runtime", "release", "cloud", "hygiene", "support"]) {
  assert(testDirNames.has(dirName), `tests_taxonomy_dir_missing:${dirName}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_medopl_contract_authority",
  productContracts: productContractPaths.length,
}, null, 2));
