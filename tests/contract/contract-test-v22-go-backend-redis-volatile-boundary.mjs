import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const serviceRoot = "services/medopl-go-backend";
const volatileRoot = `${serviceRoot}/internal/repository/volatile`;

const requiredFiles = [
  "stores.go",
  "memory.go",
  "memory_test.go",
];

const allowedInterfaces = [
  "SessionStore",
  "CacheStore",
  "QueueStore",
  "LockStore",
];

const forbiddenCanonicalMarkers = [
  "WorkspaceRepository",
  "RunRepository",
  "BillingRepository",
  "TenantRepository",
  "ArtifactRepository",
  "FileRepository",
  "WorkflowExecutionRepository",
  "CanonicalStateStore",
  "SaveWorkspace",
  "SaveRun",
  "SaveBilling",
  "SaveTenant",
  "go-redis",
  "redis.NewClient",
  "postgres",
  "pgx",
  "lib/pq",
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

async function listRepoFiles(repoPath) {
  const entries = await readdir(path.join(repoRoot, repoPath), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
}

function assertIncludes(source, marker, label) {
  assert(source.includes(marker), `${label}_missing:${marker}`);
}

assert.equal(await exists(volatileRoot), true, "go_backend_volatile_repository_root_missing");
assert.equal(await exists(`${serviceRoot}/internal/repository/redis`), false, "go_backend_must_not_create_redis_repository_truth_source");

const files = await listRepoFiles(volatileRoot);
for (const file of requiredFiles) {
  assert(files.includes(file), `go_backend_volatile_required_file_missing:${file}`);
}

const goMod = await readRepoFile(`${serviceRoot}/go.mod`);
assert.equal(/github\.com\/redis\/go-redis|github\.com\/lib\/pq|pgx|postgres/u.test(goMod), false, "step10_must_not_introduce_real_redis_or_postgres_client");

const source = (await Promise.all(requiredFiles.map((file) => readRepoFile(`${volatileRoot}/${file}`)))).join("\n");
for (const marker of allowedInterfaces) {
  assertIncludes(source, `type ${marker} interface`, `volatile_interface:${marker}`);
}
for (const marker of ["SetSession", "GetSession", "SetCache", "GetCache", "Enqueue", "Dequeue", "AcquireLock", "ReleaseLock"]) {
  assertIncludes(source, marker, `volatile_operation:${marker}`);
}
for (const marker of ["ErrInvalidTTL", "ttl <= 0", "TestMemoryVolatileStoreRejectsNonPositiveTTL"]) {
  assertIncludes(source, marker, `volatile_ttl_fail_closed:${marker}`);
}
for (const marker of forbiddenCanonicalMarkers) {
  assert.equal(source.includes(marker), false, `volatile_must_not_store_canonical_truth:${marker}`);
}
assert.equal(/rawApiKey|bearerToken|launchToken|runtimeToken|SecretId|SecretKey|kubeconfig|signedUrl|objectKey|localPath/u.test(source), false, "volatile_must_not_store_secret_or_blob_locator");

const testSource = await readRepoFile(`${volatileRoot}/memory_test.go`);
for (const marker of [
  "TestMemoryVolatileStoreSupportsSessionCacheQueueAndLock",
  "TestMemoryVolatileStoreFailsClosedOnMissingKeys",
  "TestMemoryVolatileStoreRejectsEmptyLockOwner",
  "TestMemoryVolatileStoreRejectsNonPositiveTTL",
  "TestMemoryVolatileStoreExpiresSessionCacheAndLock",
]) {
  assertIncludes(testSource, marker, `volatile_test_marker:${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_go_backend_redis_volatile_boundary",
  service: serviceRoot,
  allowedStores: allowedInterfaces,
}, null, 2));
