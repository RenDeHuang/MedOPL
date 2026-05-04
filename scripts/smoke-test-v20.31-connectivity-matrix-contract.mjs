import assert from "node:assert/strict";

export const REQUIRED_EDGES = Object.freeze([
  Object.freeze({ edge: "portal_to_postgres", from: "portal", to: "postgres", module: "portal-state", capability: "state_read_write", required: true }),
  Object.freeze({ edge: "portal_to_redis", from: "portal", to: "redis", module: "portal-session-cache", capability: "session_cache", required: true }),
  Object.freeze({ edge: "portal_to_cos", from: "portal", to: "cos", module: "workspace-storage", capability: "workspace_file_io", required: true }),
  Object.freeze({ edge: "portal_to_billing_aggregator", from: "portal", to: "billing_aggregator", module: "billing-aggregator", capability: "billing_reconcile", required: true }),
  Object.freeze({ edge: "portal_to_resource_provisioner", from: "portal", to: "resource_provisioner", module: "resource-provisioner", capability: "resource_lifecycle", required: true }),
  Object.freeze({ edge: "portal_to_opl_adapter", from: "portal", to: "opl_adapter", module: "portal-opl-adapter", capability: "launch_and_message", required: true }),
  Object.freeze({ edge: "opl_web_to_runtime_bridge", from: "opl_web", to: "runtime_bridge", module: "opl-runtime-bridge", capability: "run_gateway", required: true }),
  Object.freeze({ edge: "runtime_bridge_to_runner", from: "runtime_bridge", to: "runner", module: "med-autoscience-runner", capability: "job_orchestration", required: true }),
  Object.freeze({ edge: "runner_to_kubernetes_api", from: "runner", to: "kubernetes_api", module: "runner-k8s-preflight", capability: "k8s_apply", required: true }),
  Object.freeze({ edge: "runner_to_workspace_storage", from: "runner", to: "workspace_storage", module: "runner-workspace-storage", capability: "artifact_io", required: true }),
  Object.freeze({ edge: "portal_to_trace", from: "portal", to: "trace", module: "portal-trace", capability: "trace_lookup", required: true }),
  Object.freeze({ edge: "opl_to_trace", from: "opl", to: "trace", module: "opl-trace", capability: "run_trace_write", required: true }),
  Object.freeze({ edge: "billing_aggregator_to_cos_t_plus_1", from: "billing_aggregator", to: "cos_t_plus_1", module: "billing-cos-exact-reconcile", capability: "t_plus_1_exact_bill", required: true }),
]);

const EXPECTED_EDGE_NAMES = Object.freeze([
  "portal_to_postgres",
  "portal_to_redis",
  "portal_to_cos",
  "portal_to_billing_aggregator",
  "portal_to_resource_provisioner",
  "portal_to_opl_adapter",
  "opl_web_to_runtime_bridge",
  "runtime_bridge_to_runner",
  "runner_to_kubernetes_api",
  "runner_to_workspace_storage",
  "portal_to_trace",
  "opl_to_trace",
  "billing_aggregator_to_cos_t_plus_1",
]);

assert.deepEqual(
  REQUIRED_EDGES.map((edge) => edge.edge),
  EXPECTED_EDGE_NAMES,
  "v20_31_connectivity_matrix_must_cover_all_required_edges",
);

for (const edge of REQUIRED_EDGES) {
  assert.equal(typeof edge.edge, "string", "edge_name_must_be_string");
  assert.equal(typeof edge.from, "string", "edge_from_must_be_string");
  assert.equal(typeof edge.to, "string", "edge_to_must_be_string");
  assert.equal(typeof edge.module, "string", "edge_module_must_be_string");
  assert.equal(typeof edge.capability, "string", "edge_capability_must_be_string");
  assert.equal(edge.required, true, "edge_required_must_be_true");
  assert.notEqual(edge.from, edge.to, "edge_from_to_must_not_be_same");
}

console.log(JSON.stringify({
  ok: true,
  suite: "v20.31_connectivity_matrix_contract",
  buildTag: "opl-v20.31",
  requiredEdgeCount: REQUIRED_EDGES.length,
}, null, 2));
