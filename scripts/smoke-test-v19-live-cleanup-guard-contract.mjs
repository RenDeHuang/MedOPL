import assert from "node:assert/strict";

import { runWithRequiredCleanup } from "./lib/v19-live-cleanup-guard.mjs";

const calls = [];

await assert.rejects(
  () => runWithRequiredCleanup({
    collect: async () => {
      calls.push("collect");
      return { nodePools: [{ nodePoolId: "np-contract" }] };
    },
    validate: async () => {
      calls.push("validate");
      throw new Error("tag_mismatch");
    },
    cleanup: async (state) => {
      calls.push(`cleanup:${state.nodePools[0].nodePoolId}`);
      return { deletedNodePools: ["np-contract"] };
    },
    runAfterCleanup: async () => {
      calls.push("after-cleanup");
      return { remaining: 0 };
    },
  }),
  (error) => {
    assert.equal(error.message, "tag_mismatch");
    assert.deepEqual(error.cleanupResult, { deletedNodePools: ["np-contract"] });
    assert.deepEqual(error.afterCleanupResult, { remaining: 0 });
    return true;
  },
);

assert.deepEqual(calls, ["collect", "validate", "cleanup:np-contract", "after-cleanup"]);

const success = await runWithRequiredCleanup({
  collect: async () => ({ nodePools: [{ nodePoolId: "np-success" }] }),
  validate: async () => ({ ok: true }),
  cleanup: async () => ({ deletedNodePools: ["np-success"] }),
  runAfterCleanup: async () => ({ remaining: 0 }),
});

assert.equal(success.validation.ok, true);
assert.deepEqual(success.cleanupResult, { deletedNodePools: ["np-success"] });
assert.deepEqual(success.afterCleanupResult, { remaining: 0 });

console.log(JSON.stringify({ ok: true, contract: "v19_live_cleanup_guard" }, null, 2));
