import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const productContractPaths = Object.freeze([
  "contracts/medopl-product-profile.json",
  "contracts/medopl-portal-page-state-matrix.json",
  "contracts/medopl-api-contract.json",
  "contracts/medopl-runtime-bridge-contract.json",
  "contracts/medopl-data-plane-contract.json",
  "contracts/medopl-billing-ledger-contract.json",
  "contracts/medopl-release-boundary.json",
  "contracts/medopl-cloud-boundary.json",
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
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface?.name, "opl-webui", "product_profile_primary_consumer_must_be_opl_webui");
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface?.ordinary_chat_owner, "opl-webui", "product_profile_ordinary_chat_owner_must_be_opl_webui");
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface?.runtime_required_owner, "medopl", "product_profile_runtime_required_owner_must_be_medopl");
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface?.integration_contract, "POST /api/opl/runtime-gate", "product_profile_runtime_gate_contract_mismatch");

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
