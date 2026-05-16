import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CONTRACT_PATH = "docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md";
const FLOW_PATH = "docs/recovery/real-opl-file-run-artifact-validation-path.md";
const CONTRACT_INDEX_PATH = "docs/contracts/README.md";
const CAPABILITY_CONTRACT_PATH = "docs/contracts/v22-real-opl-capability-canary-boundary.md";
const CAPABILITY_FLOW_PATH = "docs/recovery/real-opl-capability-canary-validation-path.md";
const PROVIDER_MESSAGE_CONTRACT_PATH = "docs/contracts/v22-real-opl-provider-message-canary-boundary.md";
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
const providerMessageContract = await read(PROVIDER_MESSAGE_CONTRACT_PATH);
const acceptance = await read(ACCEPTANCE_PATH);
const statusMatrix = await read(STATUS_MATRIX_PATH);
const suite = await read(MVP_SUITE_PATH);

assertAllIncluded(contract, [
  "# v22 Real OPL File Run Artifact Canary Boundary Contract",
  "Contract Level",
  "Level 1",
  "Level 2",
  "Level 3",
  "Subscription Package",
  "Product Truth",
  "Primary Scope",
  "Non-goals",
  "Authorization Boundary",
  "Canonical Identity Map",
  "Step Gates",
  "File Upload Gate",
  "Run Gate",
  "Artifact Output Gate",
  "Trace Projection Gate",
  "Portal Projection Gate",
  "Billing Metadata Boundary",
  "Production Runtime Agent Binding",
  "Langfuse Attachment Boundary",
  "Canary Evidence Boundary",
  "Productionization Handoff",
  "Absorption Gate",
], "contract_sections");

assertAllIncluded(contract, [
  "v22-mvp-managed-opl-loop.md",
  "v22-portal-opl-connection-boundary.md",
  "v22-portal-opl-context-backflow-boundary.md",
  "v22-real-opl-capability-canary-boundary.md",
  "v22-real-opl-provider-message-canary-boundary.md",
  "v22-upstream-opl-boundary.md",
  "v22-opl-work-message-file-run-boundary.md",
  "v22-runtime-bridge-session-run-file-provider-keyref-boundary.md",
  "v22-portal-files-billing-trace-boundary.md",
  "v22-token-provider-boundary.md",
  "v22-trace-metadata-boundary.md",
  "v22-langfuse-observability-metadata-boundary.md",
  "docs/recovery/real-opl-file-run-artifact-validation-path.md",
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
  "fileRef",
  "runId",
  "traceId",
  "artifactRef",
  "outputFileRef",
  "billingMetadataRef",
  "usageMetadataRef",
  "ownerRef",
  "operationId",
  "K8s labels",
], "identity_map");

assertAllIncluded(contract, [
  "file_ref_not_observed",
  "workspace_file_scope_missing",
  "file_upload_capability_not_supported",
  "storage_authorization_required",
  "requires_runtime_agent",
  "runtime_authorization_required",
  "managed_environment_required",
  "run_not_observed",
  "artifact_not_observed",
  "output_file_ref_not_observed",
  "portal_projection_missing",
  "trace_sink_not_configured",
  "capability_not_supported",
  "adapter_mapping_failed",
  "upstream_unavailable",
  "deferred_authorization",
  "no fake 200",
], "step_gates");

assertAllIncluded(contract, [
  "云服务/COS 是真实账单与存储事实源",
  "OPL 分支只传 `billingMetadataRef`、`usageMetadataRef` 或 `resourceBindingId`",
  "OPL lane 只产出运行身份与 run/artifact projection",
  "resourceBindingId/workspace runtime identity",
  "不提供 `ownerRef`、`operationId` 或 K8s labels",
  "不能声称真实 billing/cost 已闭环",
  "Langfuse is an optional sanitized observability attachment",
  "trace.medopl.cn",
  "one-person-lab upstream remains clean",
  "不修改 one-person-lab upstream",
  "不调用真实云 mutation",
  "不部署 Langfuse",
  "不把 `/api/opl/*` placeholder 当 Product API",
], "boundary_terms");

assertAllIncluded(contract, [
  "Runtime Agent HTTP API proof",
  "Portal -> Gateway -> Adapter -> Runtime Agent HTTP API",
  "Portal workspace/session/run trace projection",
  "该 smoke 只是负向保护，不满足完整闭环吸收标准",
  "Runtime Agent canary server 实际收到 file upload/intake 和 run dispatch HTTP 请求",
], "absorption_gate_full_loop");

assertAllIncluded(flow, [
  "# v22 Real OPL File Run Artifact Canary Workflow And Validation Path",
  "Complete Workflow",
  "Validation Order",
  "Stage 0: Branch contract declaration",
  "Stage 1: Reuse proven Portal launch and provider message baseline",
  "Stage 2: File upload or file intent gate",
  "Stage 3: Workspace-scoped fileRef projection",
  "Stage 4: Run intent and Runtime Agent gate",
  "Stage 5: Run state projection",
  "Stage 6: Artifact/output backflow gate",
  "Stage 7: Runtime Agent API relay full-loop",
  "Stage 8: Portal workspace/session/run query",
  "Stage 9: Trace and Langfuse attachment boundary",
  "Stage 10: Billing metadata handoff boundary",
  "Stage 11: Negative gates and evidence hygiene",
  "Stage 12: Productionization handoff",
], "flow_sections");

assertAllIncluded(flow, [
  "Portal launch -> Gateway -> clean OPL WebUI -> Adapter -> file intent -> workspace-scoped fileRef -> run intent -> Runtime Agent gate -> runId/status/traceId -> artifactRef or outputFileRef -> Portal projection",
  "Runtime Agent HTTP API relay full-loop",
  "Production Runtime Agent binding",
  "Runtime Agent HTTP API proof is not production deploy evidence",
  "不使用 `local-fake-runtime-agent-relay`",
  "OPL lane 不决定 `ownerRef`、`operationId` 或 K8s labels",
  "file_ref_not_observed",
  "workspace_file_scope_missing",
  "requires_runtime_agent",
  "runtime_authorization_required",
  "run_not_observed",
  "artifact_not_observed",
  "output_file_ref_not_observed",
  "portal_projection_missing",
  "trace_sink_not_configured",
  "storage_authorization_required",
  ".runtime",
  "no fake 200",
  "不代表真实云 runtime 已接入",
  "不代表 Langfuse 已部署",
], "workflow_terms");

assertIncludes(index, "v22-real-opl-file-run-artifact-canary-boundary.md", "contracts_index");
assertIncludes(index, "Real OPL File Run Artifact Canary 合同包", "contracts_index");
assertIncludes(index, "Runtime Agent HTTP API proof", "contracts_index");
assertIncludes(capabilityContract, "v22-real-opl-file-run-artifact-canary-boundary.md", "capability_contract");
assertIncludes(capabilityFlow, "real-opl-file-run-artifact-validation-path.md", "capability_flow");
assertIncludes(providerMessageContract, "不证明 file、run、artifact", "provider_message_contract");
assertIncludes(acceptance, "Real OPL file/run/artifact canary", "mvp_acceptance");
assertIncludes(acceptance, "Real OPL file/run/artifact canary 当前完成合同、完整验证链路定义和本地 Adapter gate 实现验证", "mvp_acceptance");
assertIncludes(acceptance, "local Runtime Agent HTTP API proof is not production deploy evidence", "mvp_acceptance");
assertIncludes(acceptance, "真实云 runtime、COS 账单或 Langfuse 部署仍未上线", "mvp_acceptance");
assertIncludes(statusMatrix, "Real OPL file/run/artifact canary", "status_matrix");
assertIncludes(statusMatrix, "每个 step 必须 gate", "status_matrix");
assertIncludes(statusMatrix, "runtime-agent-http-relay.mjs", "status_matrix");
assertIncludes(statusMatrix, "Runtime Agent HTTP API proof", "status_matrix");
assertIncludes(statusMatrix, "billingMetadataRef", "status_matrix");
assertIncludes(suite, "smoke-test-v22-real-opl-file-run-artifact-contract-gate.mjs", "mvp_suite");
assert.equal(
  suite.includes("smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop.mjs"),
  false,
  "runtime_agent_api_loop_must_not_run_in_default_mvp_suite",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_opl_file_run_artifact_canary_boundary",
  checkedFiles: [
    CONTRACT_PATH,
    FLOW_PATH,
    CONTRACT_INDEX_PATH,
    CAPABILITY_CONTRACT_PATH,
    CAPABILITY_FLOW_PATH,
    PROVIDER_MESSAGE_CONTRACT_PATH,
    ACCEPTANCE_PATH,
    STATUS_MATRIX_PATH,
    MVP_SUITE_PATH,
  ],
}, null, 2));
