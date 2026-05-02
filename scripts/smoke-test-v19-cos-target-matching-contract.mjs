import assert from "node:assert/strict";

import {
  buildCosTargetFromFixture,
  matchesCosTargetItem,
} from "./lib/v19-live-e2e-contract.mjs";

const target = {
  tenantId: "4644a0cd-2049-40a3-935b-a7a4716b1418",
  workspaceId: "test-v19-momtezv0-6ef3b8",
  resourceOrderId: "b556641e-9943-4069-b9fe-2439a876d8a0",
  runId: "test-run-test-v19-momtezv0-6ef3b8",
  serverPlanId: "cpu-2c4g",
};

const cosEnv = buildCosTargetFromFixture(target);
assert.equal(cosEnv.COS_LIVE_EXPECT_TENANT_ID, target.tenantId);
assert.equal(cosEnv.COS_LIVE_EXPECT_TENANT_TAG_VALUE, "4644a0cd204940a3935ba7a4");
assert.equal(cosEnv.COS_LIVE_EXPECT_WORKSPACE_TAG_VALUE, "testv19momtezv06ef3b8");
assert.equal(cosEnv.COS_LIVE_EXPECT_RESOURCE_ORDER_TAG_VALUE, "b556641e99434069b9fe2439");
assert.equal(cosEnv.COS_LIVE_EXPECT_RUN_TAG_VALUE, "testruntestv19momtezv06e");
assert.equal(cosEnv.COS_LIVE_EXPECT_SERVER_PLAN_TAG_VALUE, "cpu2c4g");

assert.equal(matchesCosTargetItem({
  tenantId: target.tenantId,
  workspaceId: target.workspaceId,
  resourceOrderId: target.resourceOrderId,
  runId: target.runId,
  serverPlanId: target.serverPlanId,
}, target), true, "cos_target_must_match_raw_ids");

assert.equal(matchesCosTargetItem({
  tenantId: "4644a0cd204940a3935ba7a4",
  workspaceId: "testv19momtezv06ef3b8",
  resourceOrderId: "b556641e99434069b9fe2439",
  runId: "testruntestv19momtezv06e",
  serverPlanId: "cpu2c4g",
}, target), true, "cos_target_must_match_cloud_tag_values");

assert.equal(matchesCosTargetItem({
  tenantId: "other",
  workspaceId: "testv19momtezv06ef3b8",
  resourceOrderId: "b556641e99434069b9fe2439",
  runId: "testruntestv19momtezv06e",
  serverPlanId: "cpu2c4g",
}, target), false, "cos_target_must_reject_wrong_tenant");

console.log(JSON.stringify({
  ok: true,
  contract: "v19_cos_target_matching",
}, null, 2));
