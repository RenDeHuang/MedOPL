import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { TEST_LANE_SUITES } from "../../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const selfFile = "tests/contracts/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs";

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

function assertIncludesAll(source, markers, label) {
  for (const marker of markers) {
    assert(source.includes(marker), `${label}_missing:${marker}`);
  }
}

function assertExcludesAll(source, markers, label) {
  for (const marker of markers) {
    assert.equal(source.includes(marker), false, `${label}_must_not_include:${marker}`);
  }
}

const files = {
  runtimeSpec: "specs/runtime/spec.md",
  specsIndex: "docs/specs/README.md",
  runtimeTruth: "docs/runtime/README.md",
  frameworkTruth: "docs/framework/README.md",
  policiesTruth: "docs/policies/README.md",
  changeProposal: "changes/active/ai-runtime-contract/proposal.md",
  changeSpecDelta: "changes/active/ai-runtime-contract/spec-delta.md",
  changeDesign: "changes/active/ai-runtime-contract/design.md",
  changeTasks: "changes/active/ai-runtime-contract/tasks.md",
  changeEvalPlan: "changes/active/ai-runtime-contract/eval-plan.md",
  changeReview: "changes/active/ai-runtime-contract/review.md",
  changeCloseout: "changes/active/ai-runtime-contract/closeout.md",
  runtimeAgentRelay: "services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs",
  acpRuntimeClient: "services/opl-runtime-bridge/src/opl-acp-runtime-client.mjs",
  runtimeRuns: "services/opl-runtime-bridge/src/runtime-bridge-runs.mjs",
  runtimeMessages: "services/opl-runtime-bridge/src/runtime-bridge-messages.mjs",
  mcpCompatibleShapes: "services/opl-runtime-bridge/src/runtime-bridge-mcp-compatible-shapes.mjs",
  testRegistry: "scripts/v22-test-classification.mjs",
};

for (const [label, repoPath] of Object.entries(files)) {
  assert.equal(await exists(repoPath), true, `ai_runtime_required_file_missing:${label}:${repoPath}`);
}

const contents = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([label, repoPath]) => [label, await readRepoFile(repoPath)]),
));

assertIncludesAll(contents.runtimeSpec, [
  "`runtime:ai-runtime-contract`",
  "`runtime:mcp-compatible-boundary`",
  "AI Runtime Contract",
  "MCP-compatible boundary",
  "runtimeSession",
  "runtimeTool",
  "runtimeResource",
  "runtimeRun",
  "runtimeArtifact",
  "runtimeApproval",
  "tools / resources / prompts / artifacts / approval",
  "providerKeyRef",
  "Runtime Bridge AI runtime adapter layer",
], "runtime_spec_ai_runtime_contract");

assertIncludesAll(contents.specsIndex, [
  "spec:v22-ai-runtime-contract-boundary",
  "specs/runtime/spec.md",
], "docs_specs_ai_runtime_index");
assert.equal(contents.specsIndex.split("\n").length <= 400, true, `docs_specs_index_line_budget_exceeded:${contents.specsIndex.split("\n").length}`);
assert.equal(/```json/u.test(contents.specsIndex), false, "docs_specs_index_must_not_embed_machine_json");
assertIncludesAll(`${contents.runtimeSpec}\n${contents.policiesTruth}`, [
  "secret",
  "真实云",
  "build",
  "deploy",
  "kubectl",
  "live-test",
], "runtime_policy_ai_runtime_boundary");

assertIncludesAll(contents.runtimeTruth, [
  "AI Runtime Contract",
  "Runtime Bridge AI runtime adapter layer",
  "MCP-compatible boundary",
  "runtimeSession",
  "runtimeTool",
  "runtimeResource",
  "runtimeRun",
  "runtimeArtifact",
  "runtimeApproval",
], "runtime_truth_ai_runtime_boundary");

assertIncludesAll(contents.frameworkTruth, [
  "AI Runtime Contract",
  "MCP-compatible boundary",
  "tools / resources / prompts / artifacts / approval",
  "Runtime Bridge / Runtime Agent projection boundary",
], "framework_truth_ai_runtime_boundary");

assertIncludesAll(contents.mcpCompatibleShapes, [
  "buildMcpCompatibleRuntimeShapes",
  "assertMcpCompatibleShapeOnly",
  "runtimeTool",
  "runtimeResource",
  "runtimeRun",
  "runtimeArtifact",
  "runtimeApproval",
  "shapeOnly: true",
  "productionMcpServer: false",
  "externalClientsAuthorized: false",
  "realCloudAuthorized: false",
  "secretReadAuthorized: false",
  "deployAuthorized: false",
], "runtime_source_mcp_compatible_shape_owner");

assertIncludesAll(`${contents.runtimeAgentRelay}\n${contents.acpRuntimeClient}\n${contents.runtimeRuns}\n${contents.runtimeMessages}`, [
  "runtimeSession",
  "providerKeyRef",
  "relayRun",
  "relayFile",
  "promptAcpRuntime",
  "publicRunArtifact",
  "addSessionLedgerEntry",
  "assertNoForbiddenRelayFields",
], "runtime_source_ai_runtime_existing_surfaces");

assertExcludesAll(`${contents.runtimeAgentRelay}\n${contents.acpRuntimeClient}\n${contents.runtimeRuns}\n${contents.runtimeMessages}`, [
  "mcpServer.listen",
  "rawProviderKey: input",
  "launchToken: input",
  "runtimeToken: input",
], "runtime_source_must_not_claim_mcp_server_or_leak_tokens");

const mcpShapesUrl = pathToFileURL(path.join(repoRoot, files.mcpCompatibleShapes));
mcpShapesUrl.search = `contract=${Date.now()}`;
const mcpShapes = await import(mcpShapesUrl.href);
assert.equal(typeof mcpShapes.buildMcpCompatibleRuntimeShapes, "function", "mcp_shape_owner_must_export_builder");
assert.equal(typeof mcpShapes.assertMcpCompatibleShapeOnly, "function", "mcp_shape_owner_must_export_guard");

const shapePayload = mcpShapes.buildMcpCompatibleRuntimeShapes({
  runtimeSession: {
    runtimeSessionId: "runtime-session-v22",
    workspaceId: "workspace-v22",
    workspaceSessionId: "workspace-session-v22",
    providerKeyRef: "provider-key-ref-v22",
    rawProviderKey: "raw-provider-key-must-not-project",
    launchToken: "launch-token-must-not-project",
    runtimeToken: "runtime-token-must-not-project",
  },
  run: {
    runId: "run-v22",
    traceId: "trace-v22",
    toolName: "opl-runtime",
    objectKey: "object-key-must-not-project",
    localPath: "/tmp/must-not-project",
  },
  artifact: {
    artifactId: "artifact-v22",
    runId: "run-v22",
    name: "result.csv",
    relativePath: "outputs/result.csv",
    signedUrl: "https://storage.example.test/private?signature=must-not-project",
  },
});

assert.deepEqual(Object.keys(shapePayload).sort(), [
  "artifacts",
  "boundary",
  "prompts",
  "resources",
  "runtimeApproval",
  "tools",
], "mcp_shape_payload_top_level_keys_mismatch");
assert.equal(shapePayload.boundary.shapeOnly, true, "mcp_shape_boundary_must_be_shape_only");
assert.equal(shapePayload.boundary.productionMcpServer, false, "mcp_shape_must_not_claim_production_server");
assert.equal(shapePayload.boundary.externalClientsAuthorized, false, "mcp_shape_must_not_authorize_external_clients");
assert.equal(shapePayload.boundary.realCloudAuthorized, false, "mcp_shape_must_not_authorize_real_cloud");
assert.equal(shapePayload.boundary.secretReadAuthorized, false, "mcp_shape_must_not_authorize_secret_read");
assert.equal(shapePayload.boundary.deployAuthorized, false, "mcp_shape_must_not_authorize_deploy");
assert(shapePayload.tools.some((tool) => tool.name === "runtime.run"), "mcp_shape_must_project_runtime_run_tool");
assert(shapePayload.resources.some((resource) => resource.name === "runtimeSession"), "mcp_shape_must_project_runtime_session_resource");
assert(shapePayload.prompts.some((prompt) => prompt.name === "runtimePrompt"), "mcp_shape_must_project_runtime_prompt_shape");
assert.equal(shapePayload.runtimeApproval.status, "future_authorized_only", "mcp_shape_approval_must_be_future_authorized_only");
mcpShapes.assertMcpCompatibleShapeOnly(shapePayload);
assertExcludesAll(JSON.stringify(shapePayload), [
  "raw-provider-key-must-not-project",
  "launch-token-must-not-project",
  "runtime-token-must-not-project",
  "object-key-must-not-project",
  "/tmp/must-not-project",
  "signature=must-not-project",
  "rawProviderKey",
  "launchToken",
  "runtimeToken",
  "objectKey",
  "localPath",
  "signedUrl",
], "mcp_shape_projection_must_not_leak_secret_or_storage_locator");

assertIncludesAll(contents.testRegistry, [
  selfFile,
  "\"surface\":\"runtime-bridge\"",
  "\"verifySuites\":[\"local-contract\"]",
], "test_registry_ai_runtime_contract");
assert(TEST_LANE_SUITES["local-contract"].includes(selfFile), "ai_runtime_contract_must_be_local_contract_registry_member");

assertIncludesAll([
  contents.changeProposal,
  contents.changeSpecDelta,
  contents.changeDesign,
  contents.changeTasks,
  contents.changeEvalPlan,
  contents.changeReview,
  contents.changeCloseout,
].join("\n"), [
  "ai-runtime-contract",
  "Runtime",
  "Golden Path Impact",
  "preserves",
  "AI Runtime Contract",
  "MCP-compatible boundary",
  "runtimeSession",
  "runtimeTool",
  "runtimeResource",
  "runtimeRun",
  "runtimeArtifact",
  "runtimeApproval",
  "No secret read unless explicitly authorized.",
  "No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.",
], "change_package_ai_runtime_contract");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_ai_runtime_contract",
  checked: [
    "durable_runtime_spec",
    "human_spec_index",
    "runtime_truth",
    "framework_truth",
    "change_package",
    "test_lane_registry",
    "runtime_source_boundary",
    "mcp_compatible_shape_projection",
  ],
}, null, 2));
