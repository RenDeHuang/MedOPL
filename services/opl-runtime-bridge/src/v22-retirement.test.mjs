import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("runtime bridge no longer owns cost record state or public ledger route", async () => {
  const [stateStoreCore, retiredFields, routes, retiredRoutes, events] = await Promise.all([
    readFile(new URL("./state-store-core.mjs", import.meta.url), "utf8"),
    readFile(new URL("./state-store-retired-fields.mjs", import.meta.url), "utf8"),
    readFile(new URL("./runtime-bridge-routes.mjs", import.meta.url), "utf8"),
    readFile(new URL("./runtime-bridge-retired-routes.mjs", import.meta.url), "utf8"),
    readFile(new URL("./runtime-bridge-events.mjs", import.meta.url), "utf8"),
  ]);

  assert.equal(stateStoreCore.includes("costRecords: []"), false, "runtime_bridge_must_not_declare_billing_ledger_state");
  assert(stateStoreCore.includes("dropRetiredStateFields(state)"), "state_store_core_must_delegate_retired_field_cleanup");
  assert(retiredFields.includes("costRecords: _retiredCostRecords"), "retired_field_owner_must_drop_cost_records");
  assert(routes.includes("createRetiredRouteHandlers"), "runtime_bridge_router_must_import_retired_routes_owner");
  assert(retiredRoutes.includes("handleCostRecordsRetired"), "runtime_bridge_must_keep_cost_records_retirement_tombstone");
  assert(retiredRoutes.includes("旧 /api/cost-records 已退场"), "runtime_bridge_cost_records_tombstone_must_explain_retirement");
  assert.equal(events.includes("handleCostRecords"), false, "runtime_event_owner_must_not_serve_cost_records");
});

test("runtime bridge config ignores retired runner and kube env", async () => {
  const configSource = await readFile(new URL("./runtime-bridge-routes-http.mjs", import.meta.url), "utf8");
  for (const retiredMarker of [
    "MED_AUTOSCIENCE_RUNNER_URL",
    "MED_AUTOSCIENCE_RUNNER_IMAGE",
    "K8S_NAMESPACE",
    "runnerUrl",
    "runnerImage",
    "k8sNamespace",
  ]) {
    assert.equal(configSource.includes(retiredMarker), false, `config_must_not_keep_retired_runner_or_kube_marker:${retiredMarker}`);
  }
});

test("runtime session and run records drop retired runner cloud provisioner fields", async () => {
  const [runtimeRecordSource, runRecordSource, issueFieldsSource, managedRunSource] = await Promise.all([
    readFile(new URL("./state-store-runtime-records.mjs", import.meta.url), "utf8"),
    readFile(new URL("./state-store-run-records.mjs", import.meta.url), "utf8"),
    readFile(new URL("./runtime-bridge-launch-issue-fields.mjs", import.meta.url), "utf8"),
    readFile(new URL("./runtime-bridge-managed-run-context.mjs", import.meta.url), "utf8"),
  ]);
  const serialized = [runtimeRecordSource, runRecordSource, issueFieldsSource, managedRunSource].join("\n");
  for (const forbidden of [
    "image",
    "runnerImage",
    "tkeClusterId",
    "nodePoolCreatePayload",
    "provisionerPayload",
    "legacy-namespace",
    "legacy-runner",
    "legacy-cluster",
    "legacy-node-pool-create",
    "legacy-provisioner",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `runtime_records_must_not_propagate_legacy_field:${forbidden}`);
  }
});

test("launch token does not read from query string", async () => {
  const routesHttpSource = await readFile(new URL("./runtime-bridge-routes-http.mjs", import.meta.url), "utf8");
  const launchTokenFunction = sourceFunction(routesHttpSource, "launchTokenFrom");

  assert(launchTokenFunction.includes("authorizationBearerFrom(req)"), "launch_token_must_come_from_authorization_header");
  for (const forbiddenMarker of ["searchParams", "launch_token", "input.launchToken", "input.launch_token"]) {
    assert.equal(launchTokenFunction.includes(forbiddenMarker), false, `launch_token_must_not_read_legacy_marker:${forbiddenMarker}`);
  }
});

test("resource_order_prepare_failed is not mapped as dedicated run error", async () => {
  const [mapperSource, contractSource] = await Promise.all([
    readFile(new URL("./run-error-mapper.mjs", import.meta.url), "utf8"),
    readFile(new URL("./run-contract.mjs", import.meta.url), "utf8"),
  ]);

  assert.equal(mapperSource.includes("resource_order_prepare_failed"), false, "resource_order_prepare_failed_must_not_have_dedicated_runtime_mapping");
  assert(mapperSource.includes("RUN_ERROR_CODES.RUNTIME_UPSTREAM_5XX"), "generic_runtime_error_must_use_runtime_upstream_code");
  assert(mapperSource.includes("RUN_STAGES.RUNTIME_SUBMIT"), "generic_runtime_error_must_use_runtime_submit_stage");
  assert.equal(`${mapperSource}\n${contractSource}`.includes("RUNNER_"), false, "runtime_error_contract_must_not_keep_runner_codes");
});

test("bootstrap public payload does not expose ordinary user internal ids", async () => {
  const launchSource = await readFile(new URL("./runtime-bridge-launch.mjs", import.meta.url), "utf8");
  const bootstrapFunction = sourceFunction(launchSource, "buildBootstrap");

  assert(bootstrapFunction.includes("launch: publicLaunchView(launch, runtimeSession || {})"), "bootstrap_must_use_public_launch_projection");
  assert(bootstrapFunction.includes("provider: {"), "bootstrap_must_project_provider_through_public_block");
  assert(bootstrapFunction.includes("providerKeyRef: runtimeSession?.providerKeyRef || \"\""), "bootstrap_must_keep_provider_key_ref_public_only");
  assert.equal(bootstrapFunction.includes("costs:"), false, "bootstrap_must_not_project_billing_ledger");
  for (const forbiddenMarker of [
    "tenantId:",
    "resourceBindingId:",
    "implementationKind:",
  ]) {
    assert.equal(bootstrapFunction.includes(forbiddenMarker), false, `bootstrap_must_not_project_internal_marker:${forbiddenMarker}`);
  }
});

function sourceFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `source_function_missing:${name}`);
  const signatureEnd = source.indexOf(")", start + marker.length);
  assert(signatureEnd > start, `source_function_signature_missing:${name}`);
  const bodyStart = source.indexOf("{", signatureEnd);
  assert(bodyStart > start, `source_function_body_missing:${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`source_function_body_unclosed:${name}`);
}
