import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "scripts/live-test-v19-tke-create-delete-cleanup.mjs",
  "scripts/live-test-v19-user-e2e.mjs",
];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const deleteCallIndex = source.indexOf("/resource-orders/delete-node-pool") >= 0
    ? source.indexOf("/resource-orders/delete-node-pool")
    : source.indexOf("deleteNodePool({");
  assert.notEqual(deleteCallIndex, -1, `${file}:delete_call_required`);
  const payloadWindow = source.slice(deleteCallIndex, deleteCallIndex + 900);
  for (const required of ["resourceOrderId", "runId", "tenantId", "workspaceId", "serverPlanId", "nodePoolId"]) {
    assert.match(payloadWindow, new RegExp(`\\b${required}\\b`), `${file}:delete_payload_missing_${required}`);
  }
  assert.match(payloadWindow, /confirmation:\s*"delete-node-pool"/, `${file}:delete_confirmation_required`);
}

console.log(JSON.stringify({ ok: true, contract: "v20_live_delete_binding_payload" }, null, 2));
