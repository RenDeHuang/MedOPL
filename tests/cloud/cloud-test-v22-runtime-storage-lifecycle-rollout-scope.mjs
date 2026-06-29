import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const cloudRollout = readFileSync(path.join(repoRoot, ".github/workflows/cloud-rollout.yml"), "utf8");

function countOccurrences(source = "", needle = "") {
  return source.split(needle).length - 1;
}

const productionApplyJob = cloudRollout.slice(
  cloudRollout.indexOf("production-apply:"),
  cloudRollout.indexOf("production-rollback:"),
);
const workflowDispatchInputs = cloudRollout.slice(
  cloudRollout.indexOf("workflow_dispatch:"),
  cloudRollout.indexOf("permissions:"),
);

assert(
  ["rollout_scope:", "default: production_launch", "- production_launch", "- runtime_storage_lifecycle", "- g3_diagnostic"]
    .every((item) => workflowDispatchInputs.includes(item)),
  "cloud_rollout_must_expose_runtime_storage_lifecycle_scope",
);
assert.equal(
  countOccurrences(productionApplyJob, "if: ${{ inputs.rollout_scope != 'g3_diagnostic' }}"),
  5,
  "g3_diagnostic_must_skip_runtime_storage_receipt_steps",
);
assert.equal(
  countOccurrences(productionApplyJob, "if: ${{ inputs.availability_probe && inputs.rollout_scope == 'production_launch' }}"),
  12,
  "availability_production_complete_steps_must_be_production_launch_only",
);
assert(
  productionApplyJob.includes("Upload runtime storage lifecycle receipts") &&
    productionApplyJob.includes("if: ${{ inputs.rollout_scope == 'runtime_storage_lifecycle' }}") &&
    productionApplyJob.includes("medopl-runtime-storage-lifecycle-receipts") &&
    productionApplyJob.includes(".runtime/v22-cloud-authorization/run-v22-001/real_tke_runtime_node_lifecycle.json") &&
    productionApplyJob.includes(".runtime/v22-cloud-authorization/run-v22-001/runtime_owner_receipt.json") &&
    productionApplyJob.includes(".runtime/v22-cloud-authorization/run-v22-001/storage_owner_receipt.json") &&
    productionApplyJob.includes(".runtime/v22-cloud-authorization/run-v22-001/release_owner_receipt.json"),
  "runtime_storage_lifecycle_scope_must_upload_only_runtime_storage_release_receipts",
);

for (const expected of [
  "Kubernetes receipt preflight\n        if: ${{ inputs.rollout_scope != 'runtime_storage_lifecycle' }}",
  "Kubernetes receipt lane\n        if: ${{ inputs.rollout_scope != 'runtime_storage_lifecycle' }}",
  "Rollout apply\n        if: ${{ inputs.rollout_scope != 'runtime_storage_lifecycle' }}",
  "Billing audit receipt preflight\n        if: ${{ inputs.rollout_scope == 'production_launch' }}",
  "Deploy receipt preflight\n        if: ${{ inputs.rollout_scope == 'production_launch' }}",
  "MedOPL availability probe\n        if: ${{ inputs.availability_probe && inputs.rollout_scope != 'runtime_storage_lifecycle' }}",
  "OPL-Webui consumer canary preflight\n        if: ${{ inputs.availability_probe && inputs.rollout_scope == 'production_launch' }}",
  "Production receipt manifest\n        if: ${{ inputs.availability_probe && inputs.rollout_scope == 'production_launch' }}",
]) {
  assert(productionApplyJob.includes(expected), `runtime_storage_lifecycle_scope_missing_guard:${expected}`);
}

for (const expected of [
  "KUBECONFIG_CONTENT: ${{ inputs.rollout_scope == 'runtime_storage_lifecycle' && 'KUBECONFIG_NOT_USED_FOR_RUNTIME_STORAGE_LIFECYCLE' || secrets.KUBECONFIG }}",
  "runtime_storage_lifecycle scope does not write kubeconfig.",
  "DATABASE_URL: ${{ inputs.rollout_scope == 'runtime_storage_lifecycle' && 'DATABASE_URL_NOT_USED_FOR_RUNTIME_STORAGE_LIFECYCLE' || secrets.DATABASE_URL }}",
  "V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation real_tke_runtime_node_lifecycle --execute --confirm-current-session-authorization",
  "V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: .runtime/v22-cloud-authorization/run-v22-001/real-tke-node-lifecycle-plan.json",
  "Create runtime storage lifecycle receipt inputs",
  "\"deriveFromPlatformNodePool\":",
  "npm run cloud:goal:preflight -- --operation real_tke_runtime_node_lifecycle",
  "npm run cloud:goal -- --operation real_tke_runtime_node_lifecycle",
]) {
  assert(cloudRollout.includes(expected), `runtime_storage_lifecycle_rollout_missing:${expected}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_runtime_storage_lifecycle_rollout_scope",
}, null, 2));
