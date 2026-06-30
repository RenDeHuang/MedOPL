import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readRepoFile(relativePath));
}

const apiContract = await readJson("contracts/medopl-api-contract.json");
const serviceSurface = await readRepoFile("services/medopl-go-backend/internal/service/controlplane/runtime_lifecycle.go")
  + await readRepoFile("services/medopl-go-backend/internal/service/controlplane/run_artifact.go");

const runtimeGate = apiContract.medopl_api_contract.runtime_gate;
const consumerProjection = runtimeGate.consumer_projection;
assert(consumerProjection, "runtime_gate_consumer_projection_contract_missing");
assert.equal(
  consumerProjection.intent,
  "opl_webui_runtime_ready_path_readiness_projection",
  "runtime_gate_consumer_projection_intent_mismatch",
);
assert.deepEqual(
  consumerProjection.fields,
  [
    "chatSurface",
    "runSurface",
    "ready",
    "uploadEnabled",
    "runEnabled",
    "artifactEnabled",
    "releaseAction",
    "storageAction",
  ],
  "runtime_gate_consumer_projection_fields_mismatch",
);
assert.equal(
  consumerProjection.ready_policy,
  "ready_true_only_when_runtime_state_ready_and_storage_state_ready",
  "runtime_gate_consumer_projection_ready_policy_mismatch",
);
for (const field of consumerProjection.fields) {
  assert(serviceSurface.includes(`json:"${field}`), `runtime_gate_consumer_projection_go_field_missing:${field}`);
}
assert(
  serviceSurface.includes('ready := runtimeState == "ready" && storageState == "ready"')
    && serviceSurface.includes("Ready:           ready"),
  "runtime_gate_consumer_projection_ready_must_come_from_runtime_and_storage_state",
);

const runResult = apiContract.medopl_api_contract.run_result;
assert(runResult.must_not_return.includes("artifactBody"), "run_result_must_forbid_artifact_body");
assert(runResult.must_not_return.includes("paymentTruth"), "run_result_must_forbid_payment_truth");
assert(runResult.must_not_return.includes("billingTruth"), "run_result_must_forbid_billing_truth");
assert(runResult.must_not_return.includes("storageObjectKey"), "run_result_must_forbid_storage_object_key");
assert(serviceSurface.includes("type PublicRunArtifactRef struct"), "run_result_must_use_refs_only_artifact_projection");
assert(serviceSurface.includes("Artifacts        []PublicRunArtifactRef"), "public_run_result_must_not_embed_full_artifact_payload");

const publicRunResultSurface = serviceSurface.slice(
  serviceSurface.indexOf("type PublicRunResult struct"),
  serviceSurface.indexOf("func (service *Service) StartRun"),
);
for (const field of runResult.must_not_return) {
  assert(!publicRunResultSurface.includes(`json:"${field}`), `run_result_forbidden_response_field:${field}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_opl_webui_consumer_ready_path",
  owner: "medopl",
  primaryConsumer: "opl-webui",
}, null, 2));
