import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  requiredCommercialOpsJourneySteps,
  validateCommercialOpsJourneyEvidence,
} = await import("./lib/v19-commercial-ops-journey-contract.mjs");

const validEvidence = {
  ok: true,
  target: {
    tenantId: "tenant-v19",
    userId: "user-v19",
    workspaceId: "workspace-v19",
    resourceOrderId: "order-v19",
    runId: "run-v19",
    serverPlanId: "cpu-2c4g",
  },
  portal: {
    baseUrl: "https://portal.medopl.cn",
  },
  opl: {
    baseUrl: "https://opl.medopl.cn",
    providerKeySource: "gflabtoken",
    onePersonLabUpstreamClean: true,
  },
  cloudResources: {
    nodePoolId: "np-v19",
    cvmInstanceIds: ["ins-v19"],
    cosKeys: ["workspaces/tenant-v19/workspace-v19/runs/run-v19/output.txt"],
  },
  billing: {
    billingStartedAt: "2026-05-02T00:00:00.000Z",
    billingStoppedAt: "2026-05-02T01:00:00.000Z",
    earliestExactWriteAt: "2026-05-02T03:00:00.000Z",
    l3ExactWaitMinutes: 120,
    exactSource: "DescribeBillDetail",
    settlementAction: "charged",
    matchedResourceId: "ins-v19",
    resourceMappingId: "mapping-v19",
    ledgerIds: ["ledger-v19"],
  },
  steps: requiredCommercialOpsJourneySteps().map((name) => ({
    name,
    ok: true,
    observedAt: "2026-05-02T03:05:00.000Z",
  })),
};

const result = validateCommercialOpsJourneyEvidence(validEvidence);
assert.equal(result.ok, true);
assert.equal(result.requiredStepCount, requiredCommercialOpsJourneySteps().length);

assert.throws(
  () => validateCommercialOpsJourneyEvidence({
    ...validEvidence,
    steps: validEvidence.steps.filter((item) => item.name !== "l3_exact_settlement"),
  }),
  /commercial_ops_evidence_missing_steps:l3_exact_settlement/,
);

assert.throws(
  () => validateCommercialOpsJourneyEvidence({
    ...validEvidence,
    opl: { ...validEvidence.opl, providerKeySource: "manual" },
  }),
  /commercial_ops_evidence_invalid_provider_key_source:manual/,
);

assert.throws(
  () => validateCommercialOpsJourneyEvidence({
    ...validEvidence,
    billing: { ...validEvidence.billing, l3ExactWaitMinutes: 60 },
  }),
  /commercial_ops_evidence_l3_wait_must_equal_120/,
);

assert.throws(
  () => validateCommercialOpsJourneyEvidence({
    ...validEvidence,
    authorizationHeader: "must-not-be-recorded",
  }),
  /commercial_ops_evidence_sensitive/,
);

const planSource = await readFile("docs/plan/2026-05-02-OPL-v19-Commercial-Ops-Full-User-Journey-Implementation-Plan.md", "utf8");
for (const step of requiredCommercialOpsJourneySteps()) {
  const words = step.split("_").filter(Boolean);
  assert(
    words.some((word) => planSource.toLowerCase().includes(word)),
    `plan_must_reference_journey_step_family:${step}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  contract: "v19_commercial_ops_full_journey",
  requiredStepCount: requiredCommercialOpsJourneySteps().length,
}, null, 2));
