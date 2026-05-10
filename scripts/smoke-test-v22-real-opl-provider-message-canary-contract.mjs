import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CONTRACT_PATH = "docs/contracts/v22-real-opl-provider-message-canary-boundary.md";
const FLOW_PATH = "docs/recovery/real-opl-provider-message-canary-validation-path.md";
const CONTRACT_INDEX_PATH = "docs/contracts/README.md";
const CAPABILITY_CONTRACT_PATH = "docs/contracts/v22-real-opl-capability-canary-boundary.md";
const CAPABILITY_FLOW_PATH = "docs/recovery/real-opl-capability-canary-validation-path.md";
const ACCEPTANCE_PATH = "docs/recovery/mvp-contract-acceptance.md";
const STATUS_MATRIX_PATH = "docs/recovery/status-matrix.md";
const MVP_SUITE_PATH = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

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
  "Adapter Normalization Contract",
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
  "adapter_mapping_failed",
  "capability_not_supported",
  "trace_sink_not_configured",
  "deferred_authorization",
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
  "Stage 7: Adapter normalization",
  "Stage 8: Portal message status projection",
  "Stage 9: Portal session trace projection",
  "Stage 10: Negative gates and evidence hygiene",
  "Stage 11: Productionization handoff",
], "flow_sections");

assertAllIncluded(flow, [
  "Portal launch -> Gateway -> clean OPL WebUI -> session bind -> send message -> observe reply -> Adapter normalize -> Portal message status -> Portal session trace",
  "messageId/status/replyMessageId",
  "providerInvocationRef",
  "messageTraceId",
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
assertIncludes(statusMatrix, "Real OPL provider message canary", "status_matrix");
assertIncludes(suite, "smoke-test-v22-real-opl-provider-message-canary-contract.mjs", "mvp_suite");

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
  ],
}, null, 2));
