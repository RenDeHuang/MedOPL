import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const serviceRoot = "services/medopl-go-backend";

const requiredFiles = [
  "internal/integration/runtimebroker/runtime_broker.go",
  "internal/integration/runtimebroker/local_adapter.go",
  "internal/integration/runtimebroker/runtime_broker_test.go",
];

const requiredMarkers = new Map([
  ["internal/integration/runtimebroker/runtime_broker.go", [
    "type Broker interface",
    "BindSession",
    "SubmitRun",
    "RunStatus",
    "ListArtifacts",
    "Artifact",
    "type SessionBindRequest struct",
    "type RunSubmitRequest struct",
    "type PublicRunArtifact struct",
    "type RuntimeClaims struct",
    "ErrProviderKeyRequired",
    "ErrResourceBindingRequired",
    "ErrRuntimeAgentRequired",
    "ErrArtifactNotObserved",
    "ErrInvalidRunMode",
    "SanitizeArtifact",
  ]],
  ["internal/integration/runtimebroker/local_adapter.go", [
    "type LocalAdapter struct",
    "NewLocalAdapter",
    "BindSession",
    "SubmitRun",
    "RunStatus",
    "ListArtifacts",
    "Artifact",
    "RunStatusGated",
  ]],
  ["internal/integration/runtimebroker/runtime_broker_test.go", [
    "TestLocalAdapterBindsSessionWithoutRawSecret",
    "TestLocalAdapterFailsClosedWithoutProviderKey",
    "TestLocalAdapterSubmitsGatedRunWithoutFakeSuccess",
    "TestLocalAdapterRejectsNonFullRuntimeMode",
    "TestSanitizeArtifactExposesPublicWhitelist",
    "TestLocalAdapterRequiresObservedArtifactForSucceededRun",
  ]],
]);

const forbiddenMarkers = [
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
  "ledgerEntries",
  "cloudInventory",
  "billingLedger",
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
  assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_runtime_broker_required_file_missing:${file}`);
}

for (const [file, markers] of requiredMarkers) {
  const source = await readRepoFile(`${serviceRoot}/${file}`);
  for (const marker of markers) {
    assertIncludes(source, marker, `go_backend_runtime_broker_marker:${file}`);
  }
}

const goSources = (await Promise.all(requiredFiles.map((file) => readRepoFile(`${serviceRoot}/${file}`)))).join("\n");
for (const marker of forbiddenMarkers) {
  assert.equal(goSources.includes(marker), false, `runtime_broker_must_not_expose_forbidden_marker:${marker}`);
}
assert.equal(/http\.Client|http\.NewRequest|fetch|redis\.NewClient|sql\.Open|pgx|github\.com\/lib\/pq/u.test(goSources), false, "step12_must_not_create_real_network_or_db_client");

const goMod = await readRepoFile(`${serviceRoot}/go.mod`);
assert.equal(/github\.com\/redis\/go-redis|github\.com\/lib\/pq|pgx/u.test(goMod), false, "step12_must_not_add_real_redis_or_postgres_client_dependency");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_go_backend_runtime_broker_interface",
  service: serviceRoot,
}, null, 2));
