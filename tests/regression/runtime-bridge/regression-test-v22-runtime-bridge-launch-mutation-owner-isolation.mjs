import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

const launchSource = await readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-launch.mjs");
const routesSource = await readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-routes.mjs");
const routesHttpSource = await readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-routes-http.mjs");
const messagePayloadsSource = await readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-message-payloads.mjs");
const messageDispatchSource = await readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-message-dispatch.mjs");
const messageRoutesPath = "services/opl-runtime-bridge/src/runtime-bridge-message-routes.mjs";
const contractPayloadsSource = await readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-contract-payloads.mjs");
const launchBootstrapSource = await readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-launch-bootstrap-payloads.mjs");
const runtimeBridgeFilesPath = "services/opl-runtime-bridge/src/runtime-bridge-files.mjs";
const runtimeAgentRelayPath = "services/opl-runtime-bridge/src/runtime-bridge-runtime-agent-relay.mjs";
const publicArtifactsPath = "services/opl-runtime-bridge/src/runtime-bridge-public-artifacts.mjs";
const launchLookupPath = "services/opl-runtime-bridge/src/runtime-bridge-launch-lookup.mjs";
const runtimeBridgeEventsPath = "services/opl-runtime-bridge/src/runtime-bridge-events.mjs";

assert.equal(
  await exists(runtimeBridgeFilesPath),
  true,
  "runtime_bridge_file_artifact_handler_owner_missing",
);

assert.equal(
  await exists(runtimeAgentRelayPath),
  true,
  "runtime_bridge_runtime_agent_relay_owner_missing",
);

assert.equal(
  await exists(publicArtifactsPath),
  true,
  "runtime_bridge_public_artifact_projection_owner_missing",
);

assert.equal(
  await exists(launchLookupPath),
  true,
  "runtime_bridge_launch_lookup_owner_missing",
);

assert.equal(
  await exists(runtimeBridgeEventsPath),
  true,
  "runtime_bridge_events_owner_missing",
);

assert.equal(
  await exists(messageRoutesPath),
  true,
  "runtime_bridge_message_route_owner_missing",
);

const fileHandlersSource = await readRepoFile(runtimeBridgeFilesPath);
const runtimeAgentRelaySource = await readRepoFile(runtimeAgentRelayPath);
const publicArtifactsSource = await readRepoFile(publicArtifactsPath);
const launchLookupSource = await readRepoFile(launchLookupPath);
const runtimeBridgeEventsSource = await readRepoFile(runtimeBridgeEventsPath);
const messageRoutesSource = await readRepoFile(messageRoutesPath);
const mcpCompatibleShapesSource = await readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-mcp-compatible-shapes.mjs");
const runsSource = await readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-runs.mjs");

for (const localMutation of [
  "function upsertWorkspace",
  "function createWorkspaceSession",
  "function createRuntimeSession",
]) {
  assert.equal(
    launchSource.includes(localMutation),
    false,
    `launch_must_not_own_state_store_mutation:${localMutation}`,
  );
}

for (const importMarker of [
  'from "./state-store-workspace-mutations.mjs"',
  'from "./state-store-runtime-mutations.mjs"',
  'from "./runtime-bridge-launch-bootstrap-payloads.mjs"',
]) {
  assert(
    launchSource.includes(importMarker),
    `launch_must_import_owner:${importMarker}`,
  );
}

for (const localLaunchProjectionHelper of [
  "function publicLaunchView",
  "function publicRuntimeSessionView",
  "function publicWorkspaceView",
  "function publicSessionView",
  "function publicMessageView",
  "function publicArtifactView",
  "function publicProgressView",
  "function publicRunView",
  "function publicRunActionView",
  "function publicTraceView",
  "function publicCostView",
]) {
  assert.equal(
    launchSource.includes(localLaunchProjectionHelper),
    false,
    `launch_must_not_own_bootstrap_projection_helper:${localLaunchProjectionHelper}`,
  );
  assert(
    launchBootstrapSource.includes(localLaunchProjectionHelper),
    `launch_bootstrap_payload_owner_must_export_helper:${localLaunchProjectionHelper}`,
  );
}

assert(
  messageRoutesSource.includes('from "./runtime-bridge-message-payloads.mjs"'),
  "message_routes_must_import_message_payload_owner",
);
assert.equal(
  routesSource.includes('from "./runtime-bridge-message-payloads.mjs"'),
  false,
  "routes_must_not_import_message_payload_owner_directly",
);
assert(
  messageRoutesSource.includes('from "./runtime-bridge-message-dispatch.mjs"'),
  "message_routes_must_import_message_dispatch_owner",
);
assert.equal(
  routesSource.includes('from "./runtime-bridge-message-dispatch.mjs"'),
  false,
  "routes_must_not_import_message_dispatch_owner_directly",
);
assert(
  routesSource.includes('from "./runtime-bridge-routes-http.mjs"'),
  "routes_must_import_http_helper_owner",
);
assert(
  routesSource.includes('from "./runtime-bridge-contract-payloads.mjs"'),
  "routes_must_import_contract_payload_owner",
);
assert(
  routesSource.includes('from "./runtime-bridge-files.mjs"'),
  "routes_must_import_file_artifact_handler_owner",
);
assert(
  !routesSource.includes('from "./runtime-bridge-launch-lookup.mjs"'),
  "routes_must_not_import_launch_lookup_owner_directly",
);
assert(
  launchSource.includes('from "./runtime-bridge-launch-lookup.mjs"'),
  "launch_must_import_launch_lookup_owner",
);
assert(
  fileHandlersSource.includes('from "./runtime-bridge-launch-lookup.mjs"'),
  "file_handlers_must_import_launch_lookup_owner",
);
assert(
  runsSource.includes('from "./runtime-bridge-launch-lookup.mjs"'),
  "runtime_runs_must_import_launch_lookup_owner",
);
assert(
  routesSource.includes('from "./runtime-bridge-runtime-agent-relay.mjs"'),
  "routes_must_import_runtime_agent_relay_owner",
);
assert(
  routesSource.includes('from "./runtime-bridge-events.mjs"'),
  "routes_must_import_runtime_bridge_events_owner",
);
assert(
  routesSource.includes('from "./runtime-bridge-message-routes.mjs"'),
  "routes_must_import_message_route_owner",
);
assert.equal(
  routesSource.includes('from "./state-store-events.mjs"'),
  false,
  "routes_must_not_import_state_store_events_directly",
);
assert.equal(
  routesSource.includes('from "./state-store-artifact-trace-mutations.mjs"'),
  false,
  "routes_must_not_import_trace_mutations_directly",
);

for (const localPayloadHelper of [
  "function publicCompletedMessagePayload",
  "function completedMessageExtra",
  "function failedMessageExtra",
  "function messageStatusPayload",
  "function publicMessageReplyPayload",
  "function timingPayload",
]) {
  assert.equal(
    routesSource.includes(localPayloadHelper),
    false,
    `routes_must_not_own_message_payload_helper:${localPayloadHelper}`,
  );
  assert(
    messagePayloadsSource.includes(localPayloadHelper),
    `message_payload_owner_must_export_helper:${localPayloadHelper}`,
  );
}

for (const localMessageDispatchHelper of [
  "function createRuntimeBridgeMessageRouteApi",
  "async function handleMessage",
  "async function handleMessageStatus",
  "async function completeMessageInBackground",
  "async function runMessageToCompletion",
  "async function acceptMessageForBackground",
  "async function dispatchMessageRequest",
]) {
  assert.equal(
    routesSource.includes(localMessageDispatchHelper),
    false,
    `routes_must_not_own_message_route_handler:${localMessageDispatchHelper}`,
  );
  assert(
    messageRoutesSource.includes(localMessageDispatchHelper),
    `message_route_owner_must_export_handler:${localMessageDispatchHelper}`,
  );
}

for (const localMessageDispatchHelper of [
  "function waitForMessageCompletion",
  "function upsertRuntimeMessage",
  "function messageRecordInState",
  "function messageStatusLookup",
  "function statusUrlForMessage",
  "function mergeMessageSideEffects",
]) {
  assert.equal(
    routesSource.includes(localMessageDispatchHelper),
    false,
    `routes_must_not_own_message_dispatch_helper:${localMessageDispatchHelper}`,
  );
  assert(
    messageDispatchSource.includes(localMessageDispatchHelper),
    `message_dispatch_owner_must_export_helper:${localMessageDispatchHelper}`,
  );
}

for (const localHttpHelper of [
  "function readConfig",
  "function sendJson",
  "function buildLaunchCookie",
  "function sendRetired",
  "async function readBody",
  "function launchTokenHash",
  "function messageIdFromInput",
  "function runIdFromInput",
  "function launchTokenFrom",
  "function routeKey",
  "function matchDynamicHandler",
]) {
  assert.equal(
    routesSource.includes(localHttpHelper),
    false,
    `routes_must_not_own_http_helper:${localHttpHelper}`,
  );
  assert(
    routesHttpSource.includes(localHttpHelper.replace("async function ", "function ")) ||
      routesHttpSource.includes(localHttpHelper),
    `http_helper_owner_must_export_helper:${localHttpHelper}`,
  );
}

for (const localContractPayloadHelper of [
  "function runtimeBridgeContractMetadata",
  "function publicRuntimeSession",
  "function runtimeBridgeBootstrapPayload",
  "function publicGatedRun",
  "function fileGatePayload",
  "function artifactGatePayload",
  "function capabilityNotSupportedPayload",
  "function runtimeRunMetadataRefs",
]) {
  assert.equal(
    routesSource.includes(localContractPayloadHelper),
    false,
    `routes_must_not_own_contract_payload_helper:${localContractPayloadHelper}`,
  );
  assert(
    contractPayloadsSource.includes(localContractPayloadHelper),
    `contract_payload_owner_must_export_helper:${localContractPayloadHelper}`,
  );
}

for (const localFileArtifactHandler of [
  "function artifactBelongsToLaunch",
  "async function handleRuntimeBridgeFile",
  "async function handleRunArtifacts",
  "async function handleRuntimeBridgeArtifact",
  "async function handleArtifactsList",
]) {
  assert.equal(
    routesSource.includes(localFileArtifactHandler),
    false,
    `routes_must_not_own_file_artifact_handler:${localFileArtifactHandler}`,
  );
  assert(
    fileHandlersSource.includes(localFileArtifactHandler),
    `file_artifact_handler_owner_must_export_handler:${localFileArtifactHandler}`,
  );
}

for (const localLaunchLookupHelper of [
  "function runtimeSessionByLaunch",
  "function runBelongsToLaunch",
]) {
  assert.equal(
    routesSource.includes(localLaunchLookupHelper),
    false,
    `routes_must_not_own_launch_lookup_helper:${localLaunchLookupHelper}`,
  );
  assert.equal(
    fileHandlersSource.includes(localLaunchLookupHelper),
    false,
    `file_handlers_must_not_own_launch_lookup_helper:${localLaunchLookupHelper}`,
  );
  assert(
    launchLookupSource.includes(localLaunchLookupHelper),
    `launch_lookup_owner_must_export_helper:${localLaunchLookupHelper}`,
  );
}

for (const localRuntimeAgentRelayHelper of [
  "function createConfiguredRuntimeAgentRelay",
]) {
  assert.equal(
    routesSource.includes(localRuntimeAgentRelayHelper),
    false,
    `routes_must_not_own_runtime_agent_relay_helper:${localRuntimeAgentRelayHelper}`,
  );
  assert(
    runtimeAgentRelaySource.includes(localRuntimeAgentRelayHelper),
    `runtime_agent_relay_owner_must_export_helper:${localRuntimeAgentRelayHelper}`,
  );
}

for (const localEventHelper of [
  "function createRuntimeBridgeEventApi",
  "async function publishTraceEvent",
  "async function handleTraceLinks",
  "async function handleTraceEvents",
  "async function handleCostRecords",
]) {
  assert.equal(
    routesSource.includes(localEventHelper),
    false,
    `routes_must_not_own_runtime_event_helper:${localEventHelper}`,
  );
  assert(
    runtimeBridgeEventsSource.includes(localEventHelper),
    `runtime_event_owner_must_export_helper:${localEventHelper}`,
  );
}

for (const relayImplementationImport of [
  'from "./local-fake-runtime-agent-relay.mjs"',
  'from "./runtime-agent-http-relay.mjs"',
]) {
  assert.equal(
    routesSource.includes(relayImplementationImport),
    false,
    `routes_must_not_import_runtime_agent_relay_implementation:${relayImplementationImport}`,
  );
  assert(
    runtimeAgentRelaySource.includes(relayImplementationImport),
    `runtime_agent_relay_owner_must_import_implementation:${relayImplementationImport}`,
  );
}

for (const sourceOwner of [
  ["message_payloads", messagePayloadsSource],
  ["file_artifact_handlers", fileHandlersSource],
  ["mcp_compatible_shapes", mcpCompatibleShapesSource],
  ["runtime_runs", runsSource],
]) {
  assert(
    sourceOwner[1].includes('from "./runtime-bridge-public-artifacts.mjs"'),
    `runtime_source_must_import_public_artifact_projection_owner:${sourceOwner[0]}`,
  );
}

for (const [label, sourceText] of [
  ["message_payloads", messagePayloadsSource],
  ["file_artifact_handlers", fileHandlersSource],
  ["mcp_compatible_shapes", mcpCompatibleShapesSource],
]) {
  assert.equal(
    sourceText.includes('from "./runtime-bridge-runs.mjs"'),
    false,
    `runtime_projection_consumer_must_not_import_full_run_api:${label}`,
  );
}

assert.equal(
  runsSource.includes("function publicRunArtifact"),
  false,
  "runtime_runs_must_not_own_public_artifact_projection",
);

assert(
  publicArtifactsSource.includes("function publicRunArtifact"),
  "public_artifact_projection_owner_must_export_public_run_artifact",
);

assert(
  fileHandlersSource.includes("function createRuntimeBridgeFileApi"),
  "file_artifact_handler_owner_must_export_factory",
);

assert.equal(
  routesSource.includes("async function handleRunStatus"),
  false,
  "routes_must_not_own_run_status_handler",
);

assert(
  runsSource.includes("async function handleRunStatus"),
  "runtime_runs_must_own_run_status_handler",
);

for (const localRuntimeRunHandler of [
  "async function handleRuntimeRunInput",
  "async function handleRuntimeRun",
  "async function handleRuntimeBridgeRun",
]) {
  assert.equal(
    routesSource.includes(localRuntimeRunHandler),
    false,
    `routes_must_not_own_runtime_run_handler:${localRuntimeRunHandler}`,
  );
  assert(
    runsSource.includes(localRuntimeRunHandler),
    `runtime_runs_must_own_runtime_run_handler:${localRuntimeRunHandler}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_runtime_bridge_launch_mutation_owner_isolation",
  checked: [
    "launch_does_not_duplicate_workspace_or_runtime_mutations",
    "launch_uses_state_store_mutation_owner_modules",
    "launch_uses_bootstrap_projection_owner",
    "routes_use_message_route_owner",
    "message_routes_use_payload_and_dispatch_owners",
    "routes_use_http_helper_owner",
    "routes_use_contract_payload_owner",
    "routes_use_file_artifact_handler_owner",
    "routes_use_runtime_agent_relay_owner",
    "routes_use_runtime_event_owner",
    "runtime_public_artifact_projection_owner",
    "runtime_launch_lookup_owner",
  ],
}, null, 2));
