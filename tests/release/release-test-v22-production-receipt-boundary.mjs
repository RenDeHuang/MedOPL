import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import {
  evaluateProductionReceiptManifest,
  validateProductionReceiptBoundary,
} from "../../scripts/v22-production-receipt-boundary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readJson(repoPath) {
  return JSON.parse(await readFile(path.join(repoRoot, repoPath), "utf8"));
}

const [boundary, cloudAuthorization, exampleManifest] = await Promise.all([
  readJson("contracts/medopl-production-receipt-boundary.json"),
  readJson("contracts/medopl-cloud-authorization-pack.json"),
  readJson("tests/fixtures/v22/production-receipt-manifest.example.json"),
]);

const boundaryResult = validateProductionReceiptBoundary({ boundary, cloudAuthorization });
assert.equal(boundaryResult.ok, true, `production_receipt_boundary_must_be_valid:${JSON.stringify(boundaryResult, null, 2)}`);
assert.deepEqual(
  boundary.production_receipt_boundary.required_receipt_types,
  cloudAuthorization.required_receipts_before_production_complete,
  "production_receipts_must_match_cloud_authorization_pack",
);
assert.equal(
  boundary.production_receipt_boundary.local_rc_claim_upgrade,
  "forbidden",
  "local_rc_must_not_auto_upgrade_to_production_complete",
);
assert.equal(
  boundary.production_receipt_boundary.cloud_deployable_rc_claim_upgrade,
  "forbidden",
  "cloud_deployable_rc_must_not_auto_upgrade_to_production_complete",
);
assert.equal(
  boundary.production_receipt_boundary.authorized_command_receipt_manifest_required,
  true,
  "authorized_cloud_command_must_write_receipt_manifest",
);
assert.equal(boundary.production_receipt_boundary.receipt_operation_binding_required, true, "receipt_operation_binding_must_be_required");
assert.equal(boundary.production_receipt_boundary.receipt_authorization_ref_required, true, "receipt_authorization_ref_must_be_required");
assert.equal(boundary.production_receipt_boundary.receipt_runner_id_required, true, "receipt_runner_id_must_be_required");

const complete = evaluateProductionReceiptManifest({
  boundary,
  manifest: exampleManifest,
});
assert.equal(complete.productionComplete, true, `complete_manifest_must_allow_production_complete:${JSON.stringify(complete, null, 2)}`);
assert.deepEqual(complete.missingReceiptTypes, [], "complete_manifest_must_have_no_missing_receipts");
assert.deepEqual(complete.rawEvidenceViolations, [], "complete_manifest_must_not_embed_raw_evidence");
assert.deepEqual(complete.receiptMappingViolations, [], "complete_manifest_must_match_operation_mapping");

const localRcUpgrade = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    evidence_level: "local_rc",
  },
});
assert.equal(localRcUpgrade.productionComplete, false, "local_rc_manifest_must_not_claim_production_complete");
assert(localRcUpgrade.blockers.includes("production_receipt_manifest_forbidden_evidence_level:local_rc"), "local_rc_upgrade_blocker_missing");

const cloudDeployableUpgrade = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    evidence_level: "cloud_deployable_rc",
  },
});
assert.equal(cloudDeployableUpgrade.productionComplete, false, "cloud_deployable_rc_manifest_must_not_claim_production_complete");
assert(
  cloudDeployableUpgrade.blockers.includes("production_receipt_manifest_forbidden_evidence_level:cloud_deployable_rc"),
  "cloud_deployable_upgrade_blocker_missing",
);

const missingReceipt = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    receipts: exampleManifest.receipts.filter((receipt) => receipt.type !== "production_deploy_receipt"),
  },
});
assert.equal(missingReceipt.productionComplete, false, "missing_receipt_manifest_must_not_complete");
assert.deepEqual(missingReceipt.missingReceiptTypes, ["production_deploy_receipt"], "missing_receipt_type_mismatch");

const rawPayload = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    raw_cloud_payload: {
      instanceId: "must-not-be-committed",
    },
  },
});
assert.equal(rawPayload.productionComplete, false, "raw_payload_manifest_must_not_complete");
assert(rawPayload.rawEvidenceViolations.includes("raw_cloud_payload"), "raw_payload_violation_missing");

const wrongOperationMapping = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    receipts: exampleManifest.receipts.map((receipt) => receipt.type === "runtime_owner_receipt"
      ? { ...receipt, operation_class: "storage_lifecycle" }
      : receipt),
  },
});
assert.equal(wrongOperationMapping.productionComplete, false, "wrong_operation_mapping_manifest_must_not_complete");
assert(
  wrongOperationMapping.receiptMappingViolations.includes("runtime_owner_receipt:operation_class"),
  "wrong_operation_mapping_violation_missing",
);

const missingAuthorizationRef = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    receipts: exampleManifest.receipts.map((receipt) => receipt.type === "storage_owner_receipt"
      ? { ...receipt, authorization_ref: "" }
      : receipt),
  },
});
assert.equal(missingAuthorizationRef.productionComplete, false, "missing_authorization_ref_manifest_must_not_complete");
assert(
  missingAuthorizationRef.receiptMappingViolations.includes("storage_owner_receipt:authorization_ref"),
  "missing_authorization_ref_violation_missing",
);

const mismatchedAuthorizationRun = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    receipts: exampleManifest.receipts.map((receipt) => receipt.type === "production_deploy_receipt"
      ? { ...receipt, authorization_ref: "contracts/medopl-cloud-authorization-pack.json#different-run" }
      : receipt),
  },
});
assert.equal(mismatchedAuthorizationRun.productionComplete, false, "mismatched_authorization_run_manifest_must_not_complete");
assert(
  mismatchedAuthorizationRun.receiptMappingViolations.includes("production_deploy_receipt:authorization_ref_run_id"),
  "mismatched_authorization_run_violation_missing",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_production_receipt_boundary",
  requiredReceipts: boundary.production_receipt_boundary.required_receipt_types.length,
}, null, 2));
