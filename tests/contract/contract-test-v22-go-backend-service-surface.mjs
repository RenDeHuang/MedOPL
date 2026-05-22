import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const serviceRoot = "services/medopl-go-backend";

const requiredFiles = [
  "go.mod",
  "cmd/server/main.go",
  "internal/buildinfo/buildinfo.go",
  "internal/config/config.go",
  "internal/config/config_test.go",
  "internal/server/http.go",
  "internal/server/router.go",
  "internal/server/router_test.go",
  "internal/server/handlers/health.go",
  "internal/server/handlers/health_test.go",
  "internal/server/handlers/version.go",
  "internal/server/handlers/version_test.go",
  "internal/server/handlers/config_check.go",
  "internal/server/handlers/config_check_test.go",
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

async function listFiles(dir, prefix = dir) {
  const entries = await readdir(path.join(repoRoot, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await listFiles(repoPath, repoPath));
    if (entry.isFile()) files.push(repoPath);
  }
  return files.sort();
}

function assertIncludes(source, marker, label) {
  assert(source.includes(marker), `${label}_missing:${marker}`);
}

assert.equal(await exists(serviceRoot), true, "go_backend_service_root_missing");
for (const file of requiredFiles) {
  assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_required_file_missing:${file}`);
}

const goMod = await readRepoFile(`${serviceRoot}/go.mod`);
assertIncludes(goMod, "module github.com/rendehuang/medopl/services/medopl-go-backend", "go_mod_module");
assertIncludes(goMod, "go 1.22", "go_mod_version");
assertIncludes(goMod, "github.com/gin-gonic/gin", "go_mod_gin_dependency");
assert.equal(/entgo\.io\/ent|github\.com\/redis\/go-redis|github\.com\/lib\/pq|pgx|postgres/u.test(goMod), false, "step8_go_mod_must_not_introduce_ent_postgres_or_redis");

const mainSource = await readRepoFile(`${serviceRoot}/cmd/server/main.go`);
assertIncludes(mainSource, "internal/config", "server_main_must_use_config");
assertIncludes(mainSource, "internal/server", "server_main_must_use_server");
assertIncludes(mainSource, "Run", "server_main_must_start_http_server");

const configSource = await readRepoFile(`${serviceRoot}/internal/config/config.go`);
for (const marker of ["MEDOPL_BACKEND_PORT", "8789", "MEDOPL_BACKEND_MODE", "Load", "Validate"]) {
  assertIncludes(configSource, marker, `config_marker:${marker}`);
}

const routerSource = await readRepoFile(`${serviceRoot}/internal/server/router.go`);
for (const marker of ["gin.New", "GET(\"/health\"", "GET(\"/version\"", "GET(\"/config/check\""]) {
  assertIncludes(routerSource, marker, `router_marker:${marker}`);
}

const healthSource = await readRepoFile(`${serviceRoot}/internal/server/handlers/health.go`);
for (const marker of ["medopl-go-backend", "status", "ok", "checks", "config"]) {
  assertIncludes(healthSource, marker, `health_marker:${marker}`);
}
assert.equal(/time\.Now|Hostname|os\.Getpid|uuid|rand/u.test(healthSource), false, "health_handler_must_be_deterministic");

const allFiles = await listFiles(serviceRoot);
const forbiddenStep8Patterns = [
  "ent/schema",
  "migrations/",
  "internal/repository/redis",
  "internal/integration/cloud",
  "internal/worker",
];
for (const forbidden of forbiddenStep8Patterns) {
  assert.equal(allFiles.some((repoPath) => repoPath.includes(forbidden)), false, `step8_must_not_create_later_stage_surface:${forbidden}`);
}

const testSources = await Promise.all(requiredFiles.filter((file) => file.endsWith("_test.go")).map((file) => readRepoFile(`${serviceRoot}/${file}`)));
const serializedTests = testSources.join("\n");
for (const marker of [
  "\"{\\\"checks\\\":{\\\"config\\\":\\\"ok\\\"},\\\"mode\\\":\\\"local\\\",\\\"service\\\":\\\"medopl-go-backend\\\",\\\"status\\\":\\\"ok\\\",\\\"version\\\":\\\"dev\\\"}\"",
  "httptest",
  "/health",
  "/version",
  "/config/check",
]) {
  assertIncludes(serializedTests, marker, `go_backend_tests_marker:${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_go_backend_service_surface",
  service: serviceRoot,
  endpoints: ["/health", "/version", "/config/check"],
}, null, 2));
