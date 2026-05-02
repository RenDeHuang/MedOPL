import assert from "node:assert/strict";

import { validateLiveTkeContext } from "./lib/v19-live-tke-context.mjs";

const livePortalFixtureContext = validateLiveTkeContext({
  tenantId: "c3b3ee57-b7e5-4414-a423-ca7dc6b89230",
  workspaceId: "test-v19-momot834-e693ac",
  resourceOrderId: "dada98b7-f610-4279-befb-498cac58c20c",
  runId: "test-run-test-v19-momot834-e693ac",
  serverPlanId: "tencent-na-siliconvalley-1-MA5.MEDIUM16",
});

assert.equal(livePortalFixtureContext.tenantId, "c3b3ee57-b7e5-4414-a423-ca7dc6b89230");
assert.equal(livePortalFixtureContext.workspaceId, "test-v19-momot834-e693ac");
assert.equal(livePortalFixtureContext.resourceOrderId, "dada98b7-f610-4279-befb-498cac58c20c");
assert.equal(livePortalFixtureContext.runId, "test-run-test-v19-momot834-e693ac");
assert.equal(livePortalFixtureContext.serverPlanId, "tencent-na-siliconvalley-1-MA5.MEDIUM16");

assert.throws(
  () => validateLiveTkeContext({
    tenantId: "c3b3ee57-b7e5-4414-a423-ca7dc6b89230",
    workspaceId: "prod-workspace",
    resourceOrderId: "dada98b7-f610-4279-befb-498cac58c20c",
    runId: "test-run-test-v19-momot834-e693ac",
    serverPlanId: "cpu-2c4g",
  }),
  /workspaceId_must_start_with_test-/,
);

assert.throws(
  () => validateLiveTkeContext({
    tenantId: "c3b3ee57-b7e5-4414-a423-ca7dc6b89230",
    workspaceId: "test-v19-momot834-e693ac",
    resourceOrderId: "dada98b7-f610-4279-befb-498cac58c20c",
    runId: "prod-run",
    serverPlanId: "cpu-2c4g",
  }),
  /runId_must_start_with_test-/,
);

assert.throws(
  () => validateLiveTkeContext({
    tenantId: "",
    workspaceId: "test-v19-momot834-e693ac",
    resourceOrderId: "dada98b7-f610-4279-befb-498cac58c20c",
    runId: "test-run-test-v19-momot834-e693ac",
    serverPlanId: "cpu-2c4g",
  }),
  /tenantId_required/,
);

console.log(JSON.stringify({ ok: true, contract: "v19_tke_live_context" }, null, 2));
