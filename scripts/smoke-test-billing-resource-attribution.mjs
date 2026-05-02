import assert from "node:assert/strict";

const {
  applyResourceAttributionToRows,
  buildResourceAttributionIndex,
  resolveAttributionFromResourceIds,
} = await import("../adapters/billing-aggregator/src/resource-attribution.mjs");

const mapping = {
  id: "mapping-v19",
  tenantId: "tenant-v19",
  workspaceId: "workspace-v19",
  resourceOrderId: "order-v19",
  runId: "run-v19",
  serverPlanId: "cpu-2c4g",
  clusterId: "cls-v19",
  nodePoolId: "np-v19",
  nodePoolIds: ["np-v19", "np-v19-extra"],
  cvmInstanceIds: ["ins-v19"],
  cosKeys: ["workspaces/tenant-v19/workspace-v19/"],
};

const index = buildResourceAttributionIndex([mapping]);

const resolved = resolveAttributionFromResourceIds({ "资源ID": "ins-v19", "优惠后总价(元)": "1.23" }, index);
assert.equal(resolved.attributed, true);
assert.equal(resolved.resourceOrderId, "order-v19");
assert.equal(resolved.runId, "run-v19");
assert.equal(resolved.workspaceId, "workspace-v19");
assert.equal(resolved.tenantId, "tenant-v19");
assert.equal(resolved.serverPlanId, "cpu-2c4g");
assert.equal(resolved.matchedResourceId, "ins-v19");

const nodePoolResource = resolveAttributionFromResourceIds({ "资源ID": "cls-v19_np-v19" }, index);
assert.equal(nodePoolResource.attributed, true);
assert.equal(nodePoolResource.resourceOrderId, "order-v19");
assert.equal(nodePoolResource.matchedResourceId, "cls-v19_np-v19");

const observedNodePoolResource = resolveAttributionFromResourceIds({ "资源ID": "cls-v19_np-v19-extra" }, index);
assert.equal(observedNodePoolResource.attributed, true);
assert.equal(observedNodePoolResource.resourceOrderId, "order-v19");
assert.equal(observedNodePoolResource.matchedResourceId, "cls-v19_np-v19-extra");

const [attributed] = applyResourceAttributionToRows([
  {
    "资源ID": "ins-v19",
    totalCost: 3.45,
    attributed: false,
    pricingSource: "tencent_cos_daily_bill",
  },
], [mapping]);
assert.equal(attributed.attributed, true);
assert.equal(attributed.attributionSource, "resource_mapping");
assert.equal(attributed.resourceOrderId, "order-v19");
assert.equal(attributed.runId, "run-v19");

const [tagged] = applyResourceAttributionToRows([
  {
    resourceOrderId: "order-tagged",
    runId: "run-tagged",
    workspaceId: "workspace-tagged",
    tenantId: "tenant-tagged",
    serverPlanId: "plan-tagged",
    "资源ID": "ins-v19",
    attributed: true,
  },
], [mapping]);
assert.equal(tagged.resourceOrderId, "order-tagged", "complete bill tags must not be overwritten by resource mapping");
assert.equal(tagged.attributionSource, undefined);

const [missing] = applyResourceAttributionToRows([
  { "资源ID": "ins-missing", totalCost: 5, attributed: false },
], [mapping]);
assert.equal(missing.attributed, false);
assert.equal(missing.attributionState, "unattributed");

const [ambiguous] = applyResourceAttributionToRows([
  { "资源ID": "ins-v19", totalCost: 5, attributed: false },
], [
  mapping,
  {
    ...mapping,
    id: "mapping-other",
    resourceOrderId: "order-other",
    runId: "run-other",
  },
]);
assert.equal(ambiguous.attributed, false);
assert.equal(ambiguous.attributionState, "resource_mapping_ambiguous");
assert.equal(ambiguous.attributionMatchCount, 2);

console.log(JSON.stringify({ ok: true, contract: "billing_resource_attribution" }, null, 2));
