import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const serviceRoot = "services/medopl-go-backend";
const schemaRoot = `${serviceRoot}/ent/schema`;
const migrationRoot = `${serviceRoot}/migrations`;

const requiredSchemas = [
  "tenant.go",
  "user.go",
  "workspace.go",
  "run.go",
  "artifact.go",
  "file.go",
  "billingevent.go",
  "workflowexecution.go",
];

const requiredTables = [
  "tenants",
  "users",
  "workspaces",
  "runs",
  "artifacts",
  "files",
  "billing_events",
  "workflow_executions",
];

const schemaExpectations = new Map([
  ["tenant.go", ["Edges() []ent.Edge", "Indexes() []ent.Index", "edge.To(\"users\"", "edge.To(\"workspaces\"", "index.Fields(\"status\")"]],
  ["user.go", ["Edges() []ent.Edge", "Indexes() []ent.Index", "edge.From(\"tenant\"", "Field(\"tenant_id\")", "index.Fields(\"tenant_id\", \"email\").Unique()"]],
  ["workspace.go", ["Edges() []ent.Edge", "Indexes() []ent.Index", "edge.From(\"tenant\"", "edge.From(\"owner\"", "index.Fields(\"tenant_id\", \"slug\").Unique()"]],
  ["run.go", ["Edges() []ent.Edge", "Indexes() []ent.Index", "field.String(\"idempotency_key\").NotEmpty()", "index.Fields(\"workspace_id\", \"idempotency_key\").Unique()"]],
  ["artifact.go", ["Edges() []ent.Edge", "Indexes() []ent.Index", "edge.From(\"run\"", "edge.From(\"workspace\"", "index.Fields(\"run_id\")", "index.Fields(\"workspace_id\")"]],
  ["file.go", ["Edges() []ent.Edge", "Indexes() []ent.Index", "edge.From(\"workspace\"", "index.Fields(\"workspace_id\", \"name\").Unique()"]],
  ["billingevent.go", ["Edges() []ent.Edge", "Indexes() []ent.Index", "field.String(\"workspace_id\").Optional().Nillable()", "index.Fields(\"idempotency_key\").Unique()"]],
  ["workflowexecution.go", ["Edges() []ent.Edge", "Indexes() []ent.Index", "field.String(\"run_id\").Optional().Nillable()", "index.Fields(\"idempotency_key\").Unique()"]],
]);

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

function goEnv() {
  const goRoot = process.env.GOROOT || "/tmp/medopl-go-toolchain/root/usr/lib/go-1.22";
  return {
    ...process.env,
    GOROOT: goRoot,
    PATH: `${goRoot}/bin:${process.env.PATH ?? ""}`,
    GOMODCACHE: process.env.GOMODCACHE || "/tmp/medopl-go-modcache",
    GOCACHE: process.env.GOCACHE || "/tmp/medopl-go-buildcache",
    GOPROXY: process.env.GOPROXY || "https://goproxy.cn,direct",
    GOSUMDB: process.env.GOSUMDB || "sum.golang.google.cn",
  };
}

async function assertEntCodegen() {
  const workdir = await mkdtemp(path.join(os.tmpdir(), "medopl-ent-codegen-"));
  try {
    await cp(path.join(repoRoot, serviceRoot, "go.mod"), path.join(workdir, "go.mod"));
    await cp(path.join(repoRoot, serviceRoot, "go.sum"), path.join(workdir, "go.sum"));
    await mkdir(path.join(workdir, "ent"), { recursive: true });
    await cp(path.join(repoRoot, schemaRoot), path.join(workdir, "ent", "schema"), { recursive: true });
    const result = spawnSync(
      "go",
      ["run", "entgo.io/ent/cmd/ent", "generate", "./ent/schema"],
      {
        cwd: workdir,
        env: goEnv(),
        encoding: "utf8",
        timeout: 120000,
      },
    );
    assert.equal(result.status, 0, `ent_codegen_failed:${result.stderr || result.stdout}`);
    for (const generated of [
      "ent/client.go",
      "ent/migrate/schema.go",
      "ent/run.go",
      "ent/workflowexecution.go",
    ]) {
      assert.equal(await stat(path.join(workdir, generated)).then(() => true, () => false), true, `ent_codegen_missing:${generated}`);
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

assert.equal(await exists(schemaRoot), true, "go_backend_ent_schema_root_missing");
assert.equal(await exists(migrationRoot), true, "go_backend_migration_root_missing");

const schemaFiles = await listRepoFiles(schemaRoot);
for (const file of requiredSchemas) {
  assert(schemaFiles.includes(file), `go_backend_required_ent_schema_missing:${file}`);
}

const goMod = await readRepoFile(`${serviceRoot}/go.mod`);
assertIncludes(goMod, "entgo.io/ent", "go_mod_must_include_ent");
assert.equal(/github\.com\/redis\/go-redis/u.test(goMod), false, "step9_must_not_introduce_redis_client");

for (const file of requiredSchemas) {
  const source = await readRepoFile(`${schemaRoot}/${file}`);
  assertIncludes(source, "ent.Schema", `schema_must_embed_ent_schema:${file}`);
  assertIncludes(source, "created_at", `schema_must_have_created_at:${file}`);
  assertIncludes(source, "updated_at", `schema_must_have_updated_at:${file}`);
  assertIncludes(source, "Edges() []ent.Edge", `schema_must_declare_edges:${file}`);
  assertIncludes(source, "Indexes() []ent.Index", `schema_must_declare_indexes:${file}`);
  for (const marker of schemaExpectations.get(file) ?? []) {
    assertIncludes(source, marker, `schema_expectation:${file}`);
  }
  assert.equal(/Default\(""\)/u.test(source), false, `schema_must_not_encode_absence_as_empty_string:${file}`);
  assert.equal(/rawApiKey|bearerToken|launchToken|runtimeToken|secretFile|objectKey|localPath|signedUrl/u.test(source), false, `schema_must_not_store_secret_or_blob_locator:${file}`);
}

const migrationFiles = await listRepoFiles(migrationRoot);
assert.deepEqual(migrationFiles, ["0001_baseline.sql"], "go_backend_migration_files_must_be_single_repeatable_baseline");
const migration = await readRepoFile(`${migrationRoot}/0001_baseline.sql`);
for (const table of requiredTables) {
  assertIncludes(migration, `CREATE TABLE IF NOT EXISTS ${table}`, `migration_must_create_table:${table}`);
  assertIncludes(migration, `CREATE INDEX IF NOT EXISTS idx_${table}`, `migration_must_have_repeatable_index:${table}`);
}
for (const marker of [
  "tenant_id",
  "workspace_id",
  "run_id",
  "idempotency_key",
  "REFERENCES tenants(id)",
  "REFERENCES workspaces(id)",
  "REFERENCES runs(id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_tenant_slug",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_workspace_idempotency",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_files_workspace_name",
  "workflow_executions",
  "billing_events",
]) {
  assertIncludes(migration, marker, `migration_marker:${marker}`);
}
assert.equal(/DEFAULT ''|NOT NULL DEFAULT ''/u.test(migration), false, "migration_must_not_encode_absence_as_empty_string");
assert.equal(/redis|session_cache|launch_token|runtime_token|raw_api_key|object_key|local_path|signed_url/u.test(migration), false, "migration_must_not_store_volatile_or_secret_truth");

await assertEntCodegen();

const migrationTest = await readRepoFile(`${serviceRoot}/internal/repository/postgres/migration_test.go`);
for (const marker of ["0001_baseline.sql", "CREATE TABLE IF NOT EXISTS", "CREATE INDEX IF NOT EXISTS", "idempotency_key", "workspace_id", "TestEntSchemaDeclaresCanonicalPostgresConstraints"]) {
  assertIncludes(migrationTest, marker, `migration_test_marker:${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_go_backend_ent_postgres_boundary",
  schemas: requiredSchemas.length,
  migration: `${migrationRoot}/0001_baseline.sql`,
}, null, 2));
