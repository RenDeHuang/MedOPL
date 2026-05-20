import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSmokeClassifiedIn } from "../../../scripts/v22-test-classification.mjs";

const CONTRACT_PATH = "docs/contracts/v22-real-opl-provider-message-canary-boundary.md";
const FLOW_PATH = "docs/recovery/real-opl-provider-message-canary-validation-path.md";
const CONTRACT_INDEX_PATH = "docs/contracts/README.md";
const CAPABILITY_CONTRACT_PATH = "docs/contracts/v22-real-opl-capability-canary-boundary.md";
const CAPABILITY_FLOW_PATH = "docs/recovery/real-opl-capability-canary-validation-path.md";
const ACCEPTANCE_PATH = "docs/recovery/mvp-contract-acceptance.md";
const STATUS_MATRIX_PATH = "docs/recovery/status-matrix.md";
const MVP_SUITE_PATH = "tests/contract/smoke-test-v22-mvp-contract-suite.mjs";
const WEBUI_BRIDGE_CLIENT_PATH = "services/opl-runtime-bridge/src/opl-webui-bridge-client.mjs";

async function read(path) {
  return readFile(path, "utf8");
}

function assertIncludes(text, needle, label) {
  assert.ok(text.includes(needle), `${label}: missing ${needle}`);
}

function assertAllIncluded(text, needles, label) {
  for (const needle of needles) assertIncludes(text, needle, label);
}

const contract = await read(CONTRACT_PATH);
const flow = await read(FLOW_PATH);
const index = await read(CONTRACT_INDEX_PATH);
const capabilityContract = await read(CAPABILITY_CONTRACT_PATH);
const capabilityFlow = await read(CAPABILITY_FLOW_PATH);
const acceptance = await read(ACCEPTANCE_PATH);
const statusMatrix = await read(STATUS_MATRIX_PATH);
const suite = await read(MVP_SUITE_PATH);
const webuiBridgeClient = await read(WEBUI_BRIDGE_CLIENT_PATH);

assertAllIncluded(contract, [
  "# v22 Real OPL Provider Message Canary Boundary Contract",
  "Contract Level",
  "Level 1",
  "Level 2",
  "Level 3",
  "Level 4",
  "Subscription Package",
  "Product Truth",
  "Primary Scope",
  "Non-goals",
  "Authorization Boundary",
  "Provider Key Boundary",
  "Canonical Message Identity Map",
  "Message Send Contract",
  "Reply Observation Contract",
  "Runtime Bridge Normalization Contract",
  "Portal Projection And Session Trace",
  "Langfuse Attachment Boundary",
  "Error Gates And No-Fake-Success",
  "Canary Evidence Boundary",
  "Productionization Handoff",
  "Absorption Gate",
], "contract_sections");

assertAllIncluded(contract, [
  "v22-mvp-managed-opl-loop.md",
  "v22-portal-opl-connection-boundary.md",
  "v22-portal-opl-context-backflow-boundary.md",
  "v22-real-opl-capability-canary-boundary.md",
  "v22-upstream-opl-boundary.md",
  "v22-opl-work-message-file-run-boundary.md",
  "v22-runtime-bridge-session-run-file-provider-keyref-boundary.md",
  "v22-portal-files-billing-trace-boundary.md",
  "v22-token-provider-boundary.md",
  "v22-trace-metadata-boundary.md",
  "v22-langfuse-observability-metadata-boundary.md",
  "docs/recovery/real-opl-provider-message-canary-validation-path.md",
], "subscription_package");

assertAllIncluded(contract, [
  "tenantId",
  "portalUserId",
  "workspaceId",
  "launchId",
  "workspaceSessionId",
  "runtimeSessionId",
  "resourceBindingId",
  "providerKeyRef",
  "oplSessionId",
  "oplConversationId",
  "clientMessageId",
  "messageId",
  "replyMessageId",
  "traceId",
  "messageTraceId",
  "providerInvocationRef",
], "identity_map");

assertAllIncluded(contract, [
  "provider_key_required",
  "provider_authorization_required",
  "provider_invocation_not_observed",
  "upstream_unavailable",
  "upstream_reply_timeout",
  "runtime_bridge_mapping_failed",
  "capability_not_supported",
  "trace_sink_not_configured",
  "deferred_authorization",
  "REAL_OPL_PROVIDER_MESSAGE_CANARY=1",
  "OPL_PROVIDER_SECRET_FILE",
  "OPL_REAL_WEBUI_DIR",
  "OPL_REAL_WEBUI_URL",
  "message reply capability 状态为 `mapped_to_webui_bridge`",
  ".runtime/real-opl-provider-message-live-canary/evidence.json",
  "live runner 已退出 active repo executable surface",
  "不代表真实 file upload",
  "不证明 file、run、artifact",
], "error_gates");

assertAllIncluded(contract, [
  "raw prompt",
  "raw completion",
  "raw API key",
  "bearer token",
  "launchToken",
  "runtimeToken",
  "sessionStorage",
  "localStorage",
  "trace.medopl.cn",
  "Langfuse is an optional sanitized observability attachment",
  "one-person-lab upstream remains clean",
  "no fake 200",
], "secret_and_boundary_terms");

assertAllIncluded(flow, [
  "# v22 Real OPL Provider Message Canary Workflow And Validation Path",
  "Complete Workflow",
  "Validation Order",
  "Stage 0: Branch contract declaration",
  "Stage 1: Provider readiness discovery without secret access",
  "Stage 2: Portal launch and OPL public context",
  "Stage 3: Real OPL session and conversation binding",
  "Stage 4: Provider key gate and authorization gate",
  "Stage 5: Send real message intent",
  "Stage 6: Observe provider boundary and assistant reply",
  "Stage 7: Runtime Bridge normalization",
  "Stage 8: Portal message status projection",
  "Stage 9: Portal session trace projection",
  "Stage 10: Negative gates and evidence hygiene",
  "Stage 11: Productionization handoff",
], "flow_sections");

assertAllIncluded(flow, [
  "Portal launch -> Gateway -> clean OPL WebUI -> session bind -> send message -> observe reply -> Runtime Bridge normalize -> Portal message status -> Portal session trace",
  "messageId/status/replyMessageId",
  "providerInvocationRef",
  "messageTraceId",
  "historical future-authorized provider message runner",
  "REAL_OPL_PROVIDER_MESSAGE_CANARY=1",
  "OPL_PROVIDER_SECRET_FILE",
  "Current Live Canary Result",
  "capabilitySource=mapped_to_webui_bridge",
  "本结果只证明真实 provider message/reply",
  "provider_key_required",
  "provider_authorization_required",
  "provider_invocation_not_observed",
  "upstream_reply_timeout",
  ".runtime",
  "no fake 200",
], "workflow_terms");

assertIncludes(index, "v22-real-opl-provider-message-canary-boundary.md", "contracts_index");
assertIncludes(index, "Real OPL Provider Message Canary 合同包", "contracts_index");
assertIncludes(capabilityContract, "v22-real-opl-provider-message-canary-boundary.md", "capability_contract");
assertIncludes(capabilityFlow, "real-opl-provider-message-canary-validation-path.md", "capability_flow");
assertIncludes(acceptance, "Real OPL provider message canary", "mvp_acceptance");
assertIncludes(acceptance, "授权 live canary 已证明真实 OPL WebUI bridge + gflab provider message 能返回 assistant reply", "mvp_acceptance");
assertIncludes(acceptance, "不代表真实 file/run/artifact、真实云 runtime 或 Langfuse 部署已上线", "mvp_acceptance");
assertIncludes(statusMatrix, "Real OPL provider message canary", "status_matrix");
assertIncludes(statusMatrix, "Real OPL provider message live canary", "status_matrix");
assertIncludes(statusMatrix, "当前 message reply capability 为 `mapped_to_webui_bridge`", "status_matrix");
assertIncludes(index, "授权 live canary 已证明真实 assistant reply 可按 `mapped_to_webui_bridge` 回流 Portal", "contracts_index");
assert.ok(isSmokeClassifiedIn("tests/regression/opl/smoke-test-v22-real-opl-provider-message-contract-gate.mjs"), "mvp_suite: missing tests/regression/opl/smoke-test-v22-real-opl-provider-message-contract-gate.mjs");
assert.equal(
  isSmokeClassifiedIn("scripts/smoke-test-v22-real-opl-provider-message-live-canary.mjs"),
  false,
  "live_provider_canary_must_not_run_in_default_mvp_suite",
);

assert.equal(
  webuiBridgeClient.includes("isHealthCheck: true"),
  false,
  "live_provider_message_canary_must_not_create_health_check_conversation",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_opl_provider_message_canary_boundary",
  checkedFiles: [
    CONTRACT_PATH,
    FLOW_PATH,
    CONTRACT_INDEX_PATH,
    CAPABILITY_CONTRACT_PATH,
    CAPABILITY_FLOW_PATH,
    ACCEPTANCE_PATH,
    STATUS_MATRIX_PATH,
    MVP_SUITE_PATH,
    WEBUI_BRIDGE_CLIENT_PATH,
  ],
}, null, 2));
