import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sequencePath = "docs/recovery/cloud-onboarding-absorption-sequence.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

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

function extractJsonBlock(source, markerName) {
  const start = `<!-- ${markerName}:start -->`;
  const end = `<!-- ${markerName}:end -->`;
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  assert(startIndex >= 0, `${markerName}_start_marker_missing`);
  assert(endIndex > startIndex, `${markerName}_end_marker_missing`);
  const block = source.slice(startIndex + start.length, endIndex);
  const match = /```json\s*([\s\S]*?)\s*```/.exec(block);
  assert(match, `${markerName}_json_fence_missing`);
  return JSON.parse(match[1]);
}

const [sequence, suite] = await Promise.all([
  readFile(sequencePath, "utf8"),
  readFile(suitePath, "utf8"),
]);

assertIncludesAll(sequence, [
  "v22 Cloud Onboarding Absorption Sequence",
  "model record: `gpt-5.3-codex`",
  "This document is an absorption guide only",
  "does not authorize reading secrets",
  "real Tencent Cloud calls",
  "dependency installation",
  "build/push",
  "kubectl",
  "live-test",
  "B remains the only integration/review/absorption window",
], "sequence_scope");

assertIncludesAll(sequence, [
  "feat/v22-cloud-onboarding-connect-cloud",
  "must not be absorbed directly",
  "feat/v22-portal-cloud-operation-test-bridge",
  "contract/v22-cloud-onboarding-runnable-path",
  "feat/v22-tencent-sdk-readonly-connection",
  "feat/v22-tencent-resource-lifecycle-gates",
  "feat/v22-tencent-deploy-execution-gates",
  "docs/v22-cloud-onboarding-absorption-sequence",
], "sequence_branch_names");

assertIncludesAll(sequence, [
  "`9fabaa1`",
  "`352d00a`",
  "`2b6a631`",
  "`5eb3349`",
  "`846a381`",
  "B verifies current branch head",
], "sequence_commits");

assertIncludesAll(sequence, [
  "Portal test-only fake-live cloud operation API bridge",
  "R-00..R-21 runnable path, CC gates, workflow task packet shape",
  "Tencent official SDK / COS SDK dependency diff and readonly connection loader/client",
  "Package C TKE/COS lifecycle runner gates, dry-run and fake-live local proof",
  "Package D TCR/build-push/kubectl deploy/runtime smoke gates",
  "This absorption sequence, branch scope map, and B verification checklist",
], "sequence_branch_scopes");

assertIncludesAll(sequence, [
  "testOnly=true",
  "productionPortalConnected=false",
  "runnerMode=fake-live",
  "realCloudCalls=false",
  "does not prove production Portal",
  "does not authorize mutation APIs",
  "Real resource mutation remains user-authorized",
  "Package D does not authorize Package C lifecycle actions",
  "forbids `kubectl delete`",
], "sequence_safety_boundaries");

assertIncludesAll(sequence, [
  "git rev-list --left-right --count <previous-branch>...<next-branch>",
  "git diff --name-only <previous-branch>...<next-branch>",
  "git diff --check <previous-branch>...<next-branch>",
  "node scripts/smoke-test-v22-portal-cloud-operation-test-api-fake-live.mjs",
  "node scripts/smoke-test-v22-cloud-connection-runnable-path.mjs",
  "node scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs",
  "node scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-runner.mjs",
  "node scripts/smoke-test-v22-authorized-tencent-deploy-execution-contract.mjs",
  "node scripts/smoke-test-v22-cloud-onboarding-absorption-sequence.mjs",
], "sequence_verification_commands");

assertIncludesAll(sequence, [
  "Production Portal is not yet connected to a real queue and PostgreSQL canonical store",
  "Real Package C resource lifecycle operations are not authorized by this absorption guide",
  "Real Package D build/push/kubectl operations are not authorized by this absorption guide",
  "The test-only Portal API is not a production cloud operation API",
], "sequence_production_gaps");

assertNotIncludesAny(sequence, [
  "Production Portal is connected",
  "real queue and PostgreSQL canonical store are complete",
  "Real Package C resource lifecycle operations are authorized",
  "Real Package D build/push/kubectl operations are authorized",
  "TKE node creation/deletion is complete",
  "COS storage creation/deletion is complete",
  "TCR push is complete",
], "sequence_forbidden_claims");

const data = extractJsonBlock(sequence, "v22-cloud-onboarding-absorption-sequence");
assert.equal(data.programId, "v22-cloud-onboarding", "sequence_program_id");
assert.equal(data.modelRecord, "gpt-5.3-codex", "sequence_model_record");
assert.equal(data.sourceMixedBranch, "feat/v22-cloud-onboarding-connect-cloud", "sequence_source_branch");
assert.equal(data.directMixedBranchAbsorptionAllowed, false, "sequence_must_forbid_direct_absorption");
assert.equal(data.targetTrunk, "recovery/platform-v22-trunk", "sequence_target_trunk");
assert.equal(data.bWindowOnly, true, "sequence_b_window_only");
assert.equal(data.requiresFfOnlyChain, true, "sequence_requires_ff_only");
assert.equal(data.readsSecretNow, false, "sequence_must_not_read_secret");
assert.equal(data.callsRealCloudNow, false, "sequence_must_not_call_cloud");
assert.equal(data.runsBuildPushKubectlNow, false, "sequence_must_not_build_push_kubectl");
assert.equal(data.runsDependencyInstallNow, false, "sequence_must_not_install_dependency");
assert.equal(data.authorizesRealMutationNow, false, "sequence_must_not_authorize_mutation");
assert.deepEqual(data.branches.map((branch) => branch.order), [1, 2, 3, 4, 5, 6], "sequence_branch_order");
assert.deepEqual(data.branches.map((branch) => branch.branch), [
  "feat/v22-portal-cloud-operation-test-bridge",
  "contract/v22-cloud-onboarding-runnable-path",
  "feat/v22-tencent-sdk-readonly-connection",
  "feat/v22-tencent-resource-lifecycle-gates",
  "feat/v22-tencent-deploy-execution-gates",
  "docs/v22-cloud-onboarding-absorption-sequence",
], "sequence_branch_list");

const branchByOrder = Object.fromEntries(data.branches.map((branch) => [branch.order, branch]));
assert.equal(branchByOrder[1].productionPortalConnected, false, "branch1_must_not_claim_production_portal");
assert.equal(branchByOrder[1].realCloudCalls, false, "branch1_must_not_call_cloud");
assert.equal(branchByOrder[3].mutationAllowed, false, "branch3_must_not_allow_mutation");
assert.equal(branchByOrder[4].forbidsUnownedNodeOrStorageMutation, true, "branch4_must_forbid_unowned_mutation");
assert.equal(branchByOrder[5].modifiesTkeNodePool, false, "branch5_must_not_modify_tke_node_pool");
assert.equal(branchByOrder[5].modifiesCosStorage, false, "branch5_must_not_modify_cos");
assert.equal(branchByOrder[5].forbidsKubectlDelete, true, "branch5_must_forbid_kubectl_delete");
assert.equal(branchByOrder[6].addsRunner, false, "branch6_must_not_add_runner");

assert.deepEqual(data.ffOnlyPairs, [
  ["recovery/platform-v22-trunk", "feat/v22-portal-cloud-operation-test-bridge"],
  ["feat/v22-portal-cloud-operation-test-bridge", "contract/v22-cloud-onboarding-runnable-path"],
  ["contract/v22-cloud-onboarding-runnable-path", "feat/v22-tencent-sdk-readonly-connection"],
  ["feat/v22-tencent-sdk-readonly-connection", "feat/v22-tencent-resource-lifecycle-gates"],
  ["feat/v22-tencent-resource-lifecycle-gates", "feat/v22-tencent-deploy-execution-gates"],
  ["feat/v22-tencent-deploy-execution-gates", "docs/v22-cloud-onboarding-absorption-sequence"],
], "sequence_ff_only_pairs");

assert.deepEqual(data.productionGaps, [
  "production_portal_queue_postgresql_canonical_store",
  "user_authorized_real_package_c_lifecycle_execution",
  "user_authorized_real_package_d_build_push_kubectl",
  "cos_billing_reconciliation_live_evidence",
  "final_b_review_cleanup_evidence",
], "sequence_production_gaps_data");

assert(suite.includes("smoke-test-v22-cloud-onboarding-absorption-sequence.mjs"), "suite_must_include_absorption_sequence_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_onboarding_absorption_sequence",
  checked: [
    "six_branch_split",
    "ff_only_absorption_order",
    "branch_scope_boundaries",
    "b_verification_commands",
    "secret_and_live_cloud_non_authorization",
    "production_gaps_not_overclaimed",
    "mvp_suite_integration",
  ],
}, null, 2));
