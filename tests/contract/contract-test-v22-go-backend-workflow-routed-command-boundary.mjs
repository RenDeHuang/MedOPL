import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const serviceRoot = "services/medopl-go-backend";

const requiredFiles = [
  "internal/server/handlers/workflow_commands.go",
  "internal/server/handlers/workflow_commands_test.go",
  "internal/server/router.go",
  "internal/server/router_test.go",
];

const requiredMarkers = new Map([
  ["internal/server/handlers/workflow_commands.go", [
    "func WorkflowCommands",
    "type WorkflowCommandRequest struct",
    "WorkflowCommandID",
    "IdempotencyKey",
    "func WorkflowCommandAction",
    "workflow_command_id_required",
    "idempotency_key_required",
    "unsupported_workflow_command_type",
    "workflowCommandId",
    "SubmitCommand",
  ]],
  ["internal/server/handlers/workflow_commands_test.go", [
    "TestWorkflowCommandsFailsClosedWithoutWorkflowCommandID",
    "TestWorkflowCommandsFailsClosedWithoutIdempotencyKey",
    "TestWorkflowCommandsRoutesLaunchRunBillingReleaseThroughFacade",
    "TestWorkflowActionRoutesUseFixedCommandTypes",
    "TestWorkflowCommandsRejectsUnsupportedCommandType",
  ]],
  ["internal/server/router.go", [
    "workflowFacade",
    "NewWorkflowStore",
    "NewFacade",
    "POST(\"/workflow/commands\"",
    "POST(\"/runtime/launch\"",
    "POST(\"/runs\"",
    "POST(\"/billing/freeze\"",
    "POST(\"/resources/release\"",
  ]],
]);

const commandTypes = [
  "runtime.launch",
  "managed_run.submit",
  "billing.freeze",
  "resource.release",
];

const forbiddenMarkers = [
  "SubmitRun(",
  "CreateRunRequest(",
  "RecordRuntimeResult(",
  "runtimebroker",
  "runfileartifact",
  "redis.NewClient",
  "sql.Open",
  "pgx",
  "Temporal",
  "LangGraph",
  "rawApiKey",
  "launchToken",
  "runtimeToken",
  "bearerToken",
  "objectKey",
  "localPath",
  "signedUrl",
];

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

for (const file of requiredFiles) {
  assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_workflow_route_required_file_missing:${file}`);
}

for (const [file, markers] of requiredMarkers) {
  const source = await readRepoFile(`${serviceRoot}/${file}`);
  for (const marker of markers) {
    assert(source.includes(marker), `go_backend_workflow_route_marker_missing:${file}:${marker}`);
  }
}

const handlerSource = await readRepoFile(`${serviceRoot}/internal/server/handlers/workflow_commands.go`);
const routerSource = await readRepoFile(`${serviceRoot}/internal/server/router.go`);
for (const commandType of commandTypes) {
  assert(handlerSource.includes(commandType), `go_backend_workflow_route_command_type_missing:${commandType}`);
}
for (const route of ["/runtime/launch", "/runs", "/billing/freeze", "/resources/release"]) {
  assert(routerSource.includes(route), `go_backend_workflow_action_route_missing:${route}`);
}
for (const marker of forbiddenMarkers) {
  assert.equal(handlerSource.includes(marker), false, `go_backend_workflow_route_must_not_bypass_facade:${marker}`);
  assert.equal(routerSource.includes(marker), false, `go_backend_workflow_router_must_not_bypass_facade:${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_go_backend_workflow_routed_command_boundary",
  service: serviceRoot,
  commandTypes,
}, null, 2));
