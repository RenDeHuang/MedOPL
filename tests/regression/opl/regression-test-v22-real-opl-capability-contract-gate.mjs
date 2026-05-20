import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSmokeClassifiedIn } from "../../../scripts/v22-test-classification.mjs";

const CONTRACT_PATH = "docs/specs/README.md";
const FLOW_PATH = "docs/recovery/real-opl-capability-canary-validation-path.md";
const CONTRACT_INDEX_PATH = "docs/specs/README.md";
const ACCEPTANCE_PATH = "docs/recovery/mvp-contract-acceptance.md";
const STATUS_MATRIX_PATH = "docs/recovery/status-matrix.md";
const MVP_SUITE_PATH = "tests/contract/contract-test-v22-mvp-contract-suite.mjs";

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
const acceptance = await read(ACCEPTANCE_PATH);
const statusMatrix = await read(STATUS_MATRIX_PATH);
const suite = await read(MVP_SUITE_PATH);

assertAllIncluded(contract, [
  "# v22 Real OPL Capability Canary Boundary Contract",
  "Contract Level",
  "Level 1",
  "Level 2",
  "Level 3",
  "Real OPL capability canary execution contract",
  "Subscription Package",
  "Product Truth",
  "Primary Scope",
  "Non-goals",
  "Authorization Boundary",
  "Canonical Identity Map",
  "Capability Registry",
  "Discovery And Canary Evidence Boundary",
  "Message Reply Canary",
  "File Capability Canary",
  "Runtime Agent And Run Canary",
  "Artifact Backflow Canary",
  "Observability Canary",
  "Portal Projection Canary",
  "Error Gates And No-Fake-Success",
  "Absorption Gate",
], "contract");

assertAllIncluded(contract, [
  "spec:v22-mvp-managed-opl-loop",
  "spec:v22-portal-opl-connection-boundary",
  "spec:v22-portal-opl-context-backflow-boundary",
  "spec:v22-upstream-opl-boundary",
  "spec:v22-opl-work-message-file-run-boundary",
  "spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary",
  "spec:v22-portal-files-billing-trace-boundary",
  "spec:v22-token-provider-boundary",
  "spec:v22-trace-metadata-boundary",
  "spec:v22-langfuse-observability-metadata-boundary",
  "docs/recovery/status-matrix.md",
  "docs/recovery/mvp-contract-acceptance.md",
  "docs/recovery/portal-opl-context-backflow-validation-path.md",
  "docs/recovery/real-opl-capability-canary-validation-path.md",
], "subscription_package");

assertAllIncluded(contract, [
  "tenantId",
  "portalUserId",
  "workspaceId",
  "launchId",
  "workspaceSessionId",
  "runtimeSessionId",
  "oplSessionId",
  "oplConversationId",
  "clientMessageId",
  "messageId",
  "replyMessageId",
  "fileRef",
  "runId",
  "artifactRef",
  "outputFileRef",
  "traceId",
  "billingMetadataRef",
], "identity_map");

assertAllIncluded(contract, [
  "supported",
  "mapped_to_webui_bridge",
  "mapped_to_acp_runtime",
  "requires_runtime_agent",
  "deferred_authorization",
  "capability_not_supported",
  "provider_key_required",
  "managed_environment_required",
  "runtime_authorization_required",
  "upstream_unavailable",
  "upstream_reply_timeout",
  "runtime_bridge_mapping_failed",
  "trace_sink_not_configured",
], "capability_and_error_states");

assertAllIncluded(contract, [
  "raw prompt",
  "raw completion",
  "raw API key",
  "bearer token",
  "launchToken",
  "runtimeToken",
  "objectKey",
  "storageKey",
  "localPath",
  "signedUrl",
  "presignedUrl",
  "providerKeyRef",
  "trace.medopl.cn",
  "one-person-lab upstream remains clean",
  "Langfuse is an optional sanitized observability attachment",
  "Runtime Bridge / Runtime Agent is the downstream canonical source",
], "secret_and_source_boundaries");

assertAllIncluded(flow, [
  "# v22 Real OPL Capability Canary Complete Workflow And Validation Path",
  "Complete Workflow",
  "Validation Order",
  "Stage 0: Branch contract declaration",
  "Stage 1: Real OPL WebUI capability discovery",
  "Stage 2: Portal launch and OPL context canary",
  "Stage 3: Real session backflow canary",
  "Stage 4: Real message reply canary",
  "Stage 5: File capability canary",
  "Stage 6: Runtime Agent and run canary",
  "Stage 7: Artifact/output backflow canary",
  "Stage 8: Observability metadata canary",
  "Stage 9: Portal projection and negative gates",
  "Stage 10: Performance canary",
  "Canary Evidence Rules",
  "Productionization Handoff",
], "flow_doc");

assertAllIncluded(flow, [
  "Portal -> Gateway -> clean OPL WebUI -> Runtime Bridge / Runtime Agent -> Portal projection",
  "messageId/status/replyMessageId",
  "workspace-scoped fileRef",
  "runId/status/traceId/billingMetadataRef",
  "artifactRef or outputFileRef",
  "workspace/session/run",
  ".runtime",
  "no fake 200",
], "workflow_acceptance");

assertIncludes(index, "spec:v22-real-opl-capability-canary-boundary", "contracts_index");
assertIncludes(index, "Real OPL Capability Canary 合同包", "contracts_index");
assertIncludes(acceptance, "Real OPL capability canary", "mvp_acceptance");
assertIncludes(statusMatrix, "Real OPL capability canary", "status_matrix");
assertIncludes(statusMatrix, "not_production_truth_yet", "status_matrix");
assertIncludes(statusMatrix, "future authorization boundary", "status_matrix");
assert.ok(isSmokeClassifiedIn("tests/regression/opl/regression-test-v22-real-opl-capability-contract-gate.mjs"), "mvp_suite: missing tests/regression/opl/regression-test-v22-real-opl-capability-contract-gate.mjs");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_opl_capability_canary_boundary",
  checkedFiles: [
    CONTRACT_PATH,
    FLOW_PATH,
    CONTRACT_INDEX_PATH,
    ACCEPTANCE_PATH,
    STATUS_MATRIX_PATH,
    MVP_SUITE_PATH,
  ],
}, null, 2));
