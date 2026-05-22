import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const serviceRoot = "services/medopl-go-backend";

const requiredFiles = [
  "internal/domain/run/run.go",
  "internal/domain/run/run_test.go",
  "internal/domain/file/file.go",
  "internal/domain/file/file_test.go",
  "internal/domain/artifact/artifact.go",
  "internal/domain/artifact/artifact_test.go",
  "internal/repository/runfileartifact/store.go",
  "internal/repository/memory/run_file_artifact_store.go",
  "internal/repository/memory/run_file_artifact_store_test.go",
  "internal/service/runfileartifact/service.go",
  "internal/service/runfileartifact/service_test.go",
];

const requiredMarkers = new Map([
  ["internal/domain/run/run.go", [
    "type RunRequest struct",
    "type RunExecution struct",
    "RunStatusPending",
    "RunStatusRunning",
    "RunStatusSucceeded",
    "RunStatusFailed",
    "RunStatusCancelled",
    "RunStatusGated",
    "ErrProviderKeyRequired",
    "ErrFileRefRequired",
    "ErrInvalidRunStatus",
    "ErrArtifactNotObserved",
    "ValidateRunRequest",
    "ApplyRuntimeResult",
  ]],
  ["internal/domain/file/file.go", [
    "type FileRef struct",
    "FileKindInputs",
    "FileKindOutputs",
    "FileStatusAvailable",
    "FileStatusDeleted",
    "ValidateFileRef",
  ]],
  ["internal/domain/artifact/artifact.go", [
    "type RunArtifact struct",
    "ArtifactKindOutputs",
    "ArtifactStatusAvailable",
    "ValidateRunArtifact",
  ]],
  ["internal/repository/runfileartifact/store.go", [
    "type CanonicalStore interface",
    "SaveRunRequest",
    "SaveRunExecution",
    "SaveFileRef",
    "SaveRunArtifact",
    "ListRunArtifacts",
  ]],
  ["internal/service/runfileartifact/service.go", [
    "CreateRunRequest",
    "RecordRuntimeResult",
    "RecordFileRef",
    "RecordRunArtifact",
    "ErrDuplicateID",
  ]],
  ["internal/service/runfileartifact/service_test.go", [
    "TestServiceCreatesPendingRunWithoutFakeSuccess",
    "TestServiceRequiresProviderKeyAndFileRefs",
    "TestServiceRequiresObservedArtifactBeforeSucceededRun",
  ]],
]);

const forbiddenGoMarkers = [
  "rawApiKey",
  "providerSecret",
  "apiKey",
  "launchToken",
  "runtimeToken",
  "bearerToken",
  "SecretId",
  "SecretKey",
  "kubeconfig",
  "storageKey",
  "objectKey",
  "signedUrl",
  "presignedUrl",
  "localPath",
  "pathOnRuntime",
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
  assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_run_file_artifact_required_file_missing:${file}`);
}

for (const [file, markers] of requiredMarkers) {
  const source = await readRepoFile(`${serviceRoot}/${file}`);
  for (const marker of markers) {
    assertIncludes(source, marker, `go_backend_run_file_artifact_marker:${file}`);
  }
}

const goSources = (await Promise.all(requiredFiles
  .filter((file) => file.endsWith(".go"))
  .map((file) => readRepoFile(`${serviceRoot}/${file}`))))
  .join("\n");

for (const marker of forbiddenGoMarkers) {
  assert.equal(goSources.includes(marker), false, `go_backend_run_file_artifact_must_not_persist_forbidden_marker:${marker}`);
}
assert.equal(/github\.com\/redis\/go-redis|redis\.NewClient|pgx|github\.com\/lib\/pq|sql\.Open/u.test(goSources), false, "step11_must_not_open_real_postgres_or_redis_client");

const goMod = await readRepoFile(`${serviceRoot}/go.mod`);
assert.equal(/github\.com\/redis\/go-redis|github\.com\/lib\/pq|pgx/u.test(goMod), false, "step11_must_not_add_real_redis_or_postgres_client_dependency");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_go_backend_run_file_artifact_domain",
  service: serviceRoot,
  requiredFiles: requiredFiles.length,
}, null, 2));
