import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const serviceRoot = "services/medopl-go-backend";

const requiredFiles = [
  "internal/domain/workflow/workflow.go",
  "internal/domain/workflow/workflow_test.go",
  "internal/repository/workflow/store.go",
  "internal/repository/memory/workflow_store.go",
  "internal/repository/memory/workflow_store_test.go",
  "internal/service/workflow/facade.go",
  "internal/service/workflow/facade_test.go",
];

const requiredMarkers = new Map([
  ["internal/domain/workflow/workflow.go", [
    "type Command struct",
    "type Execution struct",
    "type ApprovalTask struct",
    "WorkflowStatusPending",
    "WorkflowStatusRunning",
    "WorkflowStatusSucceeded",
    "WorkflowStatusFailed",
    "WorkflowStatusCancelled",
    "ErrInvalidTransition",
    "ErrCommandIDRequired",
    "ErrIdempotencyKeyRequired",
    "Transition",
    "ValidateCommand",
  ]],
  ["internal/repository/workflow/store.go", [
    "type Store interface",
    "CreateExecution",
    "ExecutionByCommandID",
    "ExecutionByIdempotencyKey",
    "UpdateExecution",
    "CreateApprovalTask",
    "ApprovalTask",
  ]],
  ["internal/service/workflow/facade.go", [
    "type Facade struct",
    "SubmitCommand",
    "StartCommand",
    "SucceedCommand",
    "FailCommand",
    "CancelCommand",
    "CreateApprovalTask",
    "ErrDuplicateIdempotencyKey",
  ]],
  ["internal/domain/workflow/workflow_test.go", [
    "TestWorkflowTransitionCoversPendingRunningSucceededFailedCancelled",
    "TestWorkflowRejectsInvalidTransition",
  ]],
  ["internal/service/workflow/facade_test.go", [
    "TestFacadeCreatesPendingExecutionWithIdempotency",
    "TestFacadeReturnsExistingExecutionForIdempotencyKey",
    "TestFacadeTransitionsPendingRunningSucceededFailedCancelled",
    "TestFacadeCreatesApprovalTask",
  ]],
]);

const forbiddenMarkers = [
  "Temporal",
  "LangGraph",
  "http.Client",
  "redis.NewClient",
  "sql.Open",
  "pgx",
  "rawApiKey",
  "launchToken",
  "runtimeToken",
  "bearerToken",
  "objectKey",
  "localPath",
  "signedUrl",
  "TargetRef",
  "PayloadSummaryRef",
  "ObjectRef",
  "PayloadRef",
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

function assertIncludes(source, marker, label) {
  assert(source.includes(marker), `${label}_missing:${marker}`);
}

for (const file of requiredFiles) {
  assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_workflow_facade_required_file_missing:${file}`);
}

for (const [file, markers] of requiredMarkers) {
  const source = await readRepoFile(`${serviceRoot}/${file}`);
  for (const marker of markers) {
    assertIncludes(source, marker, `go_backend_workflow_facade_marker:${file}`);
  }
}

const goSources = (await Promise.all(requiredFiles.map((file) => readRepoFile(`${serviceRoot}/${file}`)))).join("\n");
for (const marker of forbiddenMarkers) {
  assert.equal(goSources.includes(marker), false, `workflow_facade_must_not_introduce_forbidden_marker:${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_go_backend_workflow_facade_command_model",
  service: serviceRoot,
}, null, 2));
