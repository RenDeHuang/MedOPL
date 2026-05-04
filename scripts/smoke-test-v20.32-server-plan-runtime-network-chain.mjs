import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  serverPlans: await readFile("services/portal/src/domain/server-plans.mjs", "utf8"),
  adapterClient: await readFile("services/portal/src/integrations/opl-adapter-client.mjs", "utf8"),
  runtimeLaunch: await readFile("services/opl-runtime-bridge/src/runtime-bridge-launch.mjs", "utf8"),
  runtimeRuns: await readFile("services/opl-runtime-bridge/src/runtime-bridge-runs.mjs", "utf8"),
  stateStore: await readFile("services/opl-runtime-bridge/src/state-store.mjs", "utf8"),
  runner: await readFile("adapters/med-autoscience-runner/src/server.mjs", "utf8"),
  runnerPodNetworking: await readFile("adapters/med-autoscience-runner/src/runner-pod-networking.mjs", "utf8"),
  jobTemplate: await readFile("infra/kubernetes/job-template.yaml", "utf8"),
  billingPlans: await readFile("adapters/billing-aggregator/src/server-plans-service.mjs", "utf8"),
};

function mustContain(source, needle, message) {
  assert(source.includes(needle), message);
}

for (const field of ["podNetworkingMode", "requiresEniPod", "podAnnotations"]) {
  mustContain(files.billingPlans, field, `billing_server_plan_catalog_must_publish_${field}`);
  mustContain(files.serverPlans, field, `portal_server_plan_selection_must_preserve_${field}`);
  mustContain(files.adapterClient, field, `portal_adapter_launch_payload_must_forward_${field}`);
  mustContain(files.runtimeLaunch, field, `runtime_launch_session_must_store_${field}`);
  mustContain(files.runtimeRuns, field, `runtime_run_context_must_forward_${field}`);
  mustContain(files.stateStore, field, `runtime_state_store_must_persist_${field}`);
  mustContain(files.runner, field, `runner_must_accept_${field}`);
  mustContain(files.runnerPodNetworking, field, `runner_pod_networking_module_must_handle_${field}`);
}

mustContain(files.runner, "runner-pod-networking.mjs", "runner_must_delegate_pod_networking_contract");
mustContain(files.runnerPodNetworking, "normalizePodAnnotations", "runner_must_whitelist_pod_annotations");
mustContain(files.runnerPodNetworking, "tke.cloud.tencent.com/eni-ip", "runner_must_support_tke_eni_pod_annotation");
mustContain(files.runnerPodNetworking, "if (requiresEniPod)", "runner_must_render_eni_annotation_only_when_required");
mustContain(files.jobTemplate, "__POD_ANNOTATIONS_BLOCK__", "job_template_must_have_pod_annotations_placeholder");
assert.doesNotMatch(
  files.jobTemplate,
  /tke\.cloud\.tencent\.com\/eni-ip/,
  "job_template_must_not_globally_force_tke_eni_annotation",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v20_32_server_plan_runtime_network_chain",
}, null, 2));
