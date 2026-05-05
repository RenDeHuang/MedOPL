import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const launchSource = await readFile("services/opl-runtime-bridge/src/runtime-bridge-launch.mjs", "utf8");
const routesSource = await readFile("services/opl-runtime-bridge/src/runtime-bridge-routes.mjs", "utf8");
const messagesSource = await readFile("services/opl-runtime-bridge/src/runtime-bridge-messages.mjs", "utf8");
const stateSource = await readFile("services/opl-runtime-bridge/src/state-store.mjs", "utf8");

assert.match(launchSource, /const traceId = firstNonEmpty\(\[input\.traceId, input\.trace_id\]\) \|\| `opl-trace-\$\{randomUUID\(\)\}`/, "launch_must_create_root_traceid");
assert.match(launchSource, /traceId,\s*\n\s*portalUserId: input\.portalUserId/, "launch_record_must_persist_traceid");
assert.match(launchSource, /version: "v1",\s*\n\s*traceId: scope\.traceId/, "bootstrap_must_return_root_traceid");
assert.match(launchSource, /identity: \{\s*\n\s*traceId: scope\.traceId/, "bootstrap_identity_must_return_traceid");

assert.match(stateSource, /traceId: input\.traceId \|\| input\.trace_id \|\| ""/, "state_records_must_accept_traceid");
assert.match(stateSource, /acceptedAt: input\.acceptedAt \|\| input\.accepted_at \|\| ""/, "message_request_must_persist_accepted_at");
assert.match(stateSource, /workerStartedAt: input\.workerStartedAt \|\| input\.worker_started_at \|\| ""/, "message_request_must_persist_worker_started_at");
assert.match(stateSource, /tracePublishedAt: input\.tracePublishedAt \|\| input\.trace_published_at \|\| ""/, "message_request_must_persist_trace_published_at");

assert.match(messagesSource, /traceId: input\.traceId \|\| input\.trace_id \|\| runtimeSession\.traceId \|\| ""/, "message_context_must_inherit_traceid");
assert.match(messagesSource, /const acpStartedAt = new Date\(\)\.toISOString\(\)/, "message_api_must_capture_acp_started_at");
assert.match(messagesSource, /const acpEndedAt = new Date\(\)\.toISOString\(\)/, "message_api_must_capture_acp_ended_at");
assert.match(messagesSource, /const trace = await publishTraceEvent/, "message_api_must_publish_trace_event");
assert.match(messagesSource, /tracePublishedAt/, "message_api_must_return_trace_published_at");

assert.match(routesSource, /function timingPayload\(record = \{\}\)/, "routes_must_build_timing_payload");
assert.match(routesSource, /queueLatencyMs: msBetween\(acceptedAt, workerStartedAt\)/, "timing_must_include_queue_latency");
assert.match(routesSource, /acpLatencyMs: msBetween\(acpStartedAt, acpEndedAt\)/, "timing_must_include_acp_latency");
assert.match(routesSource, /traceId: emptyText\(record\.traceId\)/, "message_status_must_return_traceid");
assert.match(routesSource, /traceId: input\.traceId \|\| runtimeSession\.traceId \|\| ""/, "accepted_message_must_return_traceid");
assert.match(routesSource, /function traceLinkMergeKey\(item = \{\}\)[\s\S]*item\.traceId[\s\S]*item\.runId[\s\S]*item\.traceName[\s\S]*item\.status/, "trace_link_merge_key_must_include_event_identity");
assert.match(routesSource, /traceLinks: mergeUniqueBy\(targetState\.traceLinks, sourceState\.traceLinks, traceLinkMergeKey\)/, "trace_link_merge_must_keep_events_under_same_trace");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.34_opl_traceid_static_contract",
  verified: [
    "root_traceid_created_at_launch",
    "bootstrap_returns_traceid",
    "message_status_returns_traceid",
    "message_timing_fields_persisted",
    "trace_links_keep_same_trace_events",
  ],
}, null, 2));
