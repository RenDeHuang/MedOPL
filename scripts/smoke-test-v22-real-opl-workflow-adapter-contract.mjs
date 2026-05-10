import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CONTRACT_PATH = "docs/contracts/v22-real-opl-workflow-adapter-boundary.md";
const FLOW_PATH = "docs/recovery/real-opl-workflow-adapter-validation-path.md";
const CONTRACT_INDEX_PATH = "docs/contracts/README.md";
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
const acceptance = await read(ACCEPTANCE_PATH);
const statusMatrix = await read(STATUS_MATRIX_PATH);
const suite = await read(MVP_SUITE_PATH);

assertAllIncluded(contract, [
  "# v22 Real OPL Workflow Adapter Boundary Contract",
  "Portal SaaS Control Plane",
  "Gateway Entry And Secret Boundary",
  "Adapter Capability Registry",
  "Adapter Session Binding",
  "Adapter Message Relay",
  "Adapter File Reference Mapping",
  "Runtime Bridge Run Relay",
  "Runtime Agent Artifact Backflow",
  "Trace And Billing Canonical Projection",
  "Langfuse Observability Attachment",
  "Error Gates And No-Fake-Success",
  "Performance Canary",
  "Complete Workflow Validation Path",
  "trace.medopl.cn",
  "capability_not_supported",
  "provider_key_required",
  "platform_isolated_runtime_agent_required",
  "upstream_reply_timeout",
  "adapterContractVersion",
  "v22.real-opl-workflow-adapter.v1",
  "one-person-lab upstream remains clean",
  "Langfuse is not the canonical source",
  "Runtime Bridge / Runtime Agent is the canonical source",
], "contract");

assertAllIncluded(contract, [
  "v22-mvp-managed-opl-loop.md",
  "v22-portal-opl-connection-boundary.md",
  "v22-upstream-opl-boundary.md",
  "v22-opl-work-message-file-run-boundary.md",
  "v22-runtime-bridge-session-run-file-provider-keyref-boundary.md",
  "v22-portal-files-billing-trace-boundary.md",
  "v22-token-provider-boundary.md",
  "v22-langfuse-observability-metadata-boundary.md",
  "docs/recovery/status-matrix.md",
  "docs/recovery/mvp-contract-acceptance.md",
], "subscription_package");

assertAllIncluded(contract, [
  "POST /portal/api/opl/launch",
  "GET /portal-adapter/api/opl/bootstrap",
  "POST /portal-adapter/api/opl/sessions/bind",
  "POST /portal-adapter/api/opl/messages",
  "GET /portal-adapter/api/opl/messages/{messageId}/status",
  "POST /portal-adapter/api/opl/files",
  "POST /portal-adapter/api/opl/runs",
  "GET /portal-adapter/api/opl/runs/{runId}/status",
  "GET /portal-adapter/api/opl/runs/{runId}/artifacts",
  "GET /portal-adapter/api/opl/artifacts/{artifactRef}",
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
  "# v22 Real OPL Workflow Adapter Complete Link And Validation Path",
  "Complete Link",
  "Development Verification Order",
  "Stage 0: Discovery baseline",
  "Stage 1: Gateway launch and bootstrap",
  "Stage 2: Session binding",
  "Stage 3: Message reply canary",
  "Stage 4: File reference canary",
  "Stage 5: Runtime run and artifact canary",
  "Stage 6: Trace, billing, and Langfuse projection",
  "Stage 7: Performance comparison",
  "Absorption Gate",
  "trace.medopl.cn",
], "flow_doc");

assertAllIncluded(flow, [
  "direct OPL WebUI baseline",
  "Gateway + Adapter",
  "message accepted -> reply observed",
  "run accepted -> artifact visible",
  "session class extra p95 target <= 300ms",
  "long task extra overhead target <= 5%",
], "performance_path");

assertIncludes(index, "v22-real-opl-workflow-adapter-boundary.md", "contracts_index");
assertIncludes(acceptance, "real OPL workflow adapter", "mvp_acceptance");
assertIncludes(statusMatrix, "real OPL workflow adapter", "status_matrix");
assertIncludes(suite, "smoke-test-v22-real-opl-workflow-adapter-contract.mjs", "mvp_suite");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_opl_workflow_adapter_boundary",
  checkedFiles: [
    CONTRACT_PATH,
    FLOW_PATH,
    CONTRACT_INDEX_PATH,
    ACCEPTANCE_PATH,
    STATUS_MATRIX_PATH,
    MVP_SUITE_PATH,
  ],
}, null, 2));
