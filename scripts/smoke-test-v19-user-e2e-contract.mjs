import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildKubeAttributionLabels,
  buildCosTargetFromFixture,
  buildTkeEnvFromFixture,
  parseLiveE2eConfig,
  validateSameDayFixture,
} from "./lib/v19-live-e2e-contract.mjs";

assert.throws(
  () => parseLiveE2eConfig({}),
  /RUN_V19_LIVE_E2E_must_equal_1/,
);

assert.throws(
  () => parseLiveE2eConfig({ RUN_V19_LIVE_E2E: "1", V19_LIVE_E2E_PHASE: "unsupported" }),
  /V19_LIVE_E2E_PHASE_invalid/,
);

const sameDay = parseLiveE2eConfig({
  RUN_V19_LIVE_E2E: "1",
  V19_LIVE_E2E_PHASE: "same_day",
  V19_LIVE_E2E_FIXTURE_FILE: ".runtime/fixture.json",
  V19_LIVE_E2E_KUBECONFIG: "/tmp/kubeconfig",
  V19_LIVE_E2E_KUBE_SERVER_OVERRIDE: "https://example.invalid:443",
  V19_LIVE_E2E_KUBE_INSECURE_SKIP_TLS_VERIFY: "1",
});
assert.equal(sameDay.phase, "same_day");
assert.equal(sameDay.fixtureFile, ".runtime/fixture.json");
assert.equal(sameDay.kubeInsecureSkipTlsVerify, true);
assert.equal(sameDay.tkeGateMode, "resource_provisioner_via_kubectl");
assert.equal(sameDay.resourceProvisionerDeployment, "resource-provisioner-opl");
assert.equal(sameDay.resourceProvisionerNamespace, "default");

const fixture = {
  env: {
    PORTAL_BASE_URL: "https://portal.example.invalid",
    PORTAL_TEST_LOGIN: "local",
    PORTAL_RECOVERY_USER_EMAIL: "test-user@example.test",
    PORTAL_RECOVERY_WORKSPACE_ID: "test-workspace-v19",
    PORTAL_RECOVERY_RESOURCE_ORDER_ID: "test-ro-v19",
    PORTAL_RECOVERY_RUN_ID: "test-run-v19",
    PORTAL_RECOVERY_SERVER_PLAN_ID: "ma5-medium16",
  },
  prepared: {
    tenantId: "test-tenant-v19",
  },
  attributionTarget: {
    tenant_id: "test-tenant-v19",
    workspace_id: "test-workspace-v19",
    resource_order_id: "test-ro-v19",
    run_id: "test-run-v19",
    server_plan_id: "ma5-medium16",
  },
};

const sameDayFixture = validateSameDayFixture(fixture);
assert.equal(sameDayFixture.tenantId, "test-tenant-v19");
assert.equal(sameDayFixture.workspaceId, "test-workspace-v19");
assert.equal(sameDayFixture.resourceOrderId, "test-ro-v19");
assert.equal(sameDayFixture.runId, "test-run-v19");
assert.equal(sameDayFixture.serverPlanId, "ma5-medium16");

const tkeEnv = buildTkeEnvFromFixture(sameDayFixture, {
  kubectlBin: "/mnt/c/DockerDesktopBin/kubectl.exe",
  kubeconfig: "/tmp/kubeconfig",
  kubeServerOverride: "https://example.invalid:443",
});
assert.equal(tkeEnv.RUN_TKE_LIVE, "1");
assert.equal(tkeEnv.RESOURCE_PROVISIONING_ENABLED, "1");
assert.equal(tkeEnv.TKE_LIVE_TENANT_ID, "test-tenant-v19");
assert.equal(tkeEnv.TKE_LIVE_WORKSPACE_ID, "test-workspace-v19");
assert.equal(tkeEnv.TKE_LIVE_RESOURCE_ORDER_ID, "test-ro-v19");
assert.equal(tkeEnv.TKE_LIVE_RUN_ID, "test-run-v19");
assert.equal(tkeEnv.TKE_LIVE_SERVER_PLAN_ID, "ma5-medium16");
assert.equal(tkeEnv.TKE_LIVE_KUBECTL_BIN, "/mnt/c/DockerDesktopBin/kubectl.exe");

assert.deepEqual(buildKubeAttributionLabels(sameDayFixture), {
  tenant_id: "test-tenant-v19",
  workspace_id: "test-workspace-v19",
  resource_order_id: "test-ro-v19",
  run_id: "test-run-v19",
  server_plan_id: "ma5-medium16",
});

const cosTarget = buildCosTargetFromFixture(sameDayFixture);
assert.equal(cosTarget.COS_LIVE_EXPECT_TENANT_TAG_VALUE, "testtenantv19");
assert.equal(cosTarget.COS_LIVE_EXPECT_WORKSPACE_TAG_VALUE, "testworkspacev19");
assert.equal(cosTarget.COS_LIVE_EXPECT_RESOURCE_ORDER_TAG_VALUE, "testrov19");
assert.equal(cosTarget.COS_LIVE_EXPECT_RUN_TAG_VALUE, "testrunv19");
assert.equal(cosTarget.COS_LIVE_EXPECT_SERVER_PLAN_TAG_VALUE, "ma5medium16");
assert.deepEqual({
  COS_LIVE_EXPECT_TENANT_ID: cosTarget.COS_LIVE_EXPECT_TENANT_ID,
  COS_LIVE_EXPECT_WORKSPACE_ID: cosTarget.COS_LIVE_EXPECT_WORKSPACE_ID,
  COS_LIVE_EXPECT_RESOURCE_ORDER_ID: cosTarget.COS_LIVE_EXPECT_RESOURCE_ORDER_ID,
  COS_LIVE_EXPECT_RUN_ID: cosTarget.COS_LIVE_EXPECT_RUN_ID,
  COS_LIVE_EXPECT_SERVER_PLAN_ID: cosTarget.COS_LIVE_EXPECT_SERVER_PLAN_ID,
}, {
  COS_LIVE_EXPECT_TENANT_ID: "test-tenant-v19",
  COS_LIVE_EXPECT_WORKSPACE_ID: "test-workspace-v19",
  COS_LIVE_EXPECT_RESOURCE_ORDER_ID: "test-ro-v19",
  COS_LIVE_EXPECT_RUN_ID: "test-run-v19",
  COS_LIVE_EXPECT_SERVER_PLAN_ID: "ma5-medium16",
});

assert.throws(
  () => validateSameDayFixture({ env: { PORTAL_RECOVERY_WORKSPACE_ID: "test-workspace-v19" } }),
  /fixture_missing:tenantId/,
);

const liveE2eSource = readFileSync("scripts/live-test-v19-user-e2e.mjs", "utf8");
assert.match(liveE2eSource, /async function runResourceProvisionerTkeGate\(/, "same-day E2E must verify the fixture-created TKE resources through resource-provisioner");
assert.doesNotMatch(liveE2eSource, /live-test-v19-tke-create-delete-cleanup\.mjs/, "same-day E2E must not create a second standalone TKE node pool");
assert.match(liveE2eSource, /resource-mappings\?resourceOrderId=/, "same-day E2E must query resource-provisioner mapping evidence by resourceOrderId");
assert.match(liveE2eSource, /\/resource-mappings\/observe-resources/, "same-day E2E must write observed CVM/nodePool/COS ids into resource mapping before cleanup");
assert.match(liveE2eSource, /observeResourceMappingResources\(/, "same-day E2E must have an explicit observed-resource mapping step");
assert.match(liveE2eSource, /assertResourceMappingHasObservedResources\(/, "same-day E2E must fail if observed resources were not persisted");
assert.match(liveE2eSource, /\/resource-mappings\/mark-cleanup/, "same-day E2E must write back mapping cleanup after external cleanup verification");
assert.match(liveE2eSource, /assertResourceMappingActive\(/, "same-day E2E must assert resource mapping is active before delete");
assert.match(liveE2eSource, /assertResourceMappingDeleted\(/, "same-day E2E must assert resource mapping is deleted after cleanup");
assert.match(liveE2eSource, /function normalizeKubeconfigForKubectl\(/, "same-day E2E must normalize WSL kubeconfig paths for kubectl.exe");
assert(liveE2eSource.includes("replace(/^\\/mnt\\/c\\//"), "same-day E2E must convert /mnt/c/... kubeconfig paths for Windows kubectl");
assert.match(liveE2eSource, /--insecure-skip-tls-verify=true/, "same-day E2E must support kube API server LB certificate bypass via explicit env");
assert(liveE2eSource.includes("typeof tags === \"object\""), "same-day E2E must accept object-shaped resource-provisioner tag maps");
assert.match(liveE2eSource, /async function collectBillingEvidence\(/, "same-day E2E must collect Step 5A billing evidence");
assert.match(liveE2eSource, /assertBillingPendingPositive\(/, "same-day E2E must assert pending cost is positive before cleanup");
assert.match(liveE2eSource, /assertBillingStoppedGrowing\(/, "same-day E2E must assert pending cost stops growing after cleanup");
assert.match(liveE2eSource, /V19_LIVE_E2E_BILLING_STABILITY_POLL_MS/, "same-day E2E must make billing stability window explicit");

console.log(JSON.stringify({ ok: true, contract: "v19_user_e2e" }, null, 2));
