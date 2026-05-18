import test from "node:test";
import assert from "node:assert/strict";

import { buildCostRecord } from "./state-store-cost-records.mjs";
import { createLaunchApi } from "./runtime-bridge-launch.mjs";
import { launchTokenFrom } from "./runtime-bridge-routes-http.mjs";
import { mapRunError } from "./run-error-mapper.mjs";

test("cost record default pricing source uses v22 pending source", () => {
  const record = buildCostRecord({});
  assert.equal(record.pricingSource, "v22-pricing-pending-product-approval");
});

test("launch token does not read from query string", () => {
  const url = new URL("http://localhost/runtime?launch_token=query-token");
  assert.equal(launchTokenFrom({}, url), "");
  assert.equal(launchTokenFrom({ launchToken: "body-token" }, url), "");
  assert.equal(
    launchTokenFrom({}, url, { headers: { authorization: "Bearer header-token" } }),
    "header-token",
  );
});

test("resource_order_prepare_failed is not mapped as dedicated run error", () => {
  const mapped = mapRunError(new Error("resource_order_prepare_failed"));
  assert.equal(mapped.code, "RUNNER_UPSTREAM_5XX");
  assert.equal(mapped.stage, "runner_submit");
});

test("bootstrap public payload does not expose ordinary user internal ids", async () => {
  const api = createLaunchApi({
    baseUrl: "http://127.0.0.1:8788",
    launchSecret: "unit-test-secret",
    buildSha: "test",
    buildTime: "test",
    runtimeMode: "test",
    oplWebUrl: "",
    runnerUrl: "",
    portalInternalBaseUrl: "",
    k8sNamespace: "",
    runnerImage: "",
    nodeEnv: "test",
    langfusePublisher: { configured: () => false },
    publishTraceEvent: async () => {},
  });
  const state = {
    runs: [],
    artifacts: [],
    messageRequests: [],
    events: [],
    runActions: [],
    traceLinks: [],
    costRecords: [],
    workspaces: [],
    workspaceSessions: [],
    runtimeSessions: [{
      runtimeSessionId: "runtime-public-v22",
      workspaceSessionId: "workspace-session-public-v22",
      workspaceId: "workspace-public-v22",
      portalUserId: "portal-user-public-v22",
      tenantId: "tenant-public-v22",
      resourceBindingId: "resource-binding-public-v22",
      providerKeyRef: "provider-key-ref-public-v22",
      providerConfigured: true,
    }],
  };
  const payload = await api.buildBootstrap(state, {
    launchId: "launch-public-v22",
    traceId: "trace-public-v22",
    portalUserId: "portal-user-public-v22",
    tenantId: "tenant-public-v22",
    workspaceId: "workspace-public-v22",
    workspaceSessionId: "workspace-session-public-v22",
    runtimeSessionId: "runtime-public-v22",
  });
  const serialized = JSON.stringify(payload);
  for (const forbidden of [
    "tenantId",
    "resourceBindingId",
    "runId",
    "planId",
    "implementationKind",
  ]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false, `bootstrap_must_not_expose_internal_field:${forbidden}`);
  }
  for (const forbiddenValue of [
    "tenant-public-v22",
    "resource-binding-public-v22",
  ]) {
    assert.equal(serialized.includes(forbiddenValue), false, `bootstrap_must_not_expose_internal_value:${forbiddenValue}`);
  }
  assert.equal(payload.identity.workspaceId, "workspace-public-v22", "bootstrap_workspace_id_stays_public");
  assert.equal(payload.provider.providerKeyRef, "provider-key-ref-public-v22", "bootstrap_provider_key_ref_stays_public");
});
