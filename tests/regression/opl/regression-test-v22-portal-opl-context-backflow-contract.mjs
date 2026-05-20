import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSmokeClassifiedIn } from "../../../scripts/v22-test-classification.mjs";

const CONTRACT_PATH = "docs/specs/README.md";
const FLOW_PATH = "docs/recovery/portal-opl-context-backflow-validation-path.md";
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
  "# v22 Portal-OPL Context Backflow Boundary Contract",
  "Contract Level",
  "Level 1",
  "Level 2",
  "Level 3",
  "Portal-OPL context/backflow execution contract",
  "Primary Scope",
  "Portal SaaS Control Plane",
  "Gateway Entry And Secret Boundary",
  "OPL Context Bootstrap",
  "Runtime Bridge Capability Registry",
  "Runtime Bridge Session Binding",
  "Runtime Bridge Message Relay",
  "Runtime Bridge Backflow Projection",
  "Downstream Runtime Boundary",
  "Downstream Langfuse Session Trace Boundary",
  "Error Gates And No-Fake-Success",
  "Performance Canary",
  "Complete Portal-OPL Link Validation Path",
  "trace.medopl.cn",
  "capability_not_supported",
  "provider_key_required",
  "platform_isolated_runtime_agent_required",
  "upstream_reply_timeout",
  "runtimeBridgeContractVersion",
  "v22.portal-opl-context-backflow.v1",
  "one-person-lab upstream remains clean",
  "Langfuse is not the canonical source",
  "Runtime Bridge / Runtime Agent is the downstream canonical source",
  "This contract does not implement cloud runtime",
  "This contract does not deploy Langfuse",
], "contract");

assertAllIncluded(contract, [
  "spec:v22-mvp-managed-opl-loop",
  "spec:v22-portal-opl-connection-boundary",
  "spec:v22-upstream-opl-boundary",
  "spec:v22-opl-work-message-file-run-boundary",
  "spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary",
  "spec:v22-portal-files-billing-trace-boundary",
  "spec:v22-token-provider-boundary",
  "spec:v22-langfuse-observability-metadata-boundary",
  "docs/recovery/status-matrix.md",
  "docs/recovery/mvp-contract-acceptance.md",
], "subscription_package");

assertAllIncluded(contract, [
  "POST /portal/api/opl/launch",
  "GET /runtime-bridge/api/opl/bootstrap",
  "POST /runtime-bridge/api/opl/sessions/bind",
  "POST /runtime-bridge/api/opl/messages",
  "GET /runtime-bridge/api/opl/messages/{messageId}/status",
  "GET /runtime-bridge/api/opl/status",
], "stable_api_surface");

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
], "forbidden_data");

assertAllIncluded(flow, [
  "# v22 Portal-OPL Context Backflow Complete Link And Validation Path",
  "Complete Portal-OPL Link",
  "Development Verification Order",
  "Stage 0: Discovery baseline",
  "Stage 1: Gateway launch and bootstrap",
  "Stage 2: Session binding",
  "Stage 3: OPL message backflow canary",
  "Stage 4: Downstream runtime boundary gate",
  "Stage 5: Downstream Langfuse session trace boundary",
  "Stage 6: Portal projection",
  "Stage 7: Performance comparison",
  "Absorption Gate",
  "trace.medopl.cn",
], "flow_doc");

assertAllIncluded(flow, [
  "direct OPL WebUI baseline",
  "Gateway + Runtime Bridge",
  "Portal launch -> OPL bootstrap",
  "OPL event -> Runtime Bridge projection -> Portal query",
  "session class extra p95 target <= 300ms",
  "Portal-OPL context/backflow extra overhead target",
], "performance_path");

assertIncludes(index, "spec:v22-portal-opl-context-backflow-boundary", "contracts_index");
assertIncludes(acceptance, "Portal-OPL context/backflow", "mvp_acceptance");
assertIncludes(statusMatrix, "Portal-OPL context/backflow", "status_matrix");
assert.ok(isSmokeClassifiedIn("tests/regression/opl/regression-test-v22-portal-opl-context-backflow-contract.mjs"), "mvp_suite: missing tests/regression/opl/regression-test-v22-portal-opl-context-backflow-contract.mjs");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_opl_context_backflow_boundary",
  checkedFiles: [
    CONTRACT_PATH,
    FLOW_PATH,
    CONTRACT_INDEX_PATH,
    ACCEPTANCE_PATH,
    STATUS_MATRIX_PATH,
    MVP_SUITE_PATH,
  ],
}, null, 2));
