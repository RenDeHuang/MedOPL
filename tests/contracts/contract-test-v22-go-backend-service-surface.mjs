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

const serviceSurfaceFiles = [
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
const volatileFiles = [
  "internal/repository/volatile/stores.go",
  "internal/repository/volatile/memory.go",
  "internal/repository/volatile/memory_test.go",
];
const domainFiles = [
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
const runtimeBrokerFiles = [
  "internal/integration/runtimebroker/runtime_broker.go",
  "internal/integration/runtimebroker/local_adapter.go",
  "internal/integration/runtimebroker/runtime_broker_test.go",
];
const workflowFiles = [
  "internal/domain/workflow/workflow.go",
  "internal/domain/workflow/workflow_test.go",
  "internal/repository/workflow/store.go",
  "internal/repository/memory/workflow_store.go",
  "internal/repository/memory/workflow_store_test.go",
  "internal/service/workflow/facade.go",
  "internal/service/workflow/facade_test.go",
];
const retiredWorkflowHttpFacadeFiles = [
  "internal/server/handlers/workflow_commands.go",
  "internal/server/handlers/workflow_commands_test.go",
];
const labTypedApiFiles = [
  "internal/domain/lab/lab.go",
  "internal/domain/lab/lab_test.go",
  "internal/repository/lab/store.go",
  "internal/repository/memory/lab_store.go",
  "internal/repository/memory/lab_store_test.go",
  "internal/service/lab/service.go",
  "internal/service/lab/service_test.go",
  "internal/server/handlers/lab.go",
  "internal/server/handlers/lab_test.go",
  "internal/server/router.go",
  "internal/server/router_test.go",
];
const localRCProviderKeyFixture = "local-rc-provider-key-material-that-must-stay-private";

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

async function listFiles(repoPath) {
  const entries = await readdir(path.join(repoRoot, repoPath), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
}

async function readJoinedGoFiles(repoPath) {
  const files = (await listFiles(repoPath)).filter((file) => file.endsWith(".go"));
  const sources = await Promise.all(files.map((file) => readRepoFile(`${repoPath}/${file}`)));
  return sources.join("\n");
}

function assertIncludes(source, marker, label) {
  assert(String(source).includes(marker), `${label}_missing:${marker}`);
}

function assertNotMatches(source, pattern, label) {
  assert.equal(pattern.test(String(source)), false, label);
}

function goEnv() {
  const env = { ...process.env };
  delete env.GOROOT;
  return {
    ...env,
    PATH: process.env.PATH ?? "",
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
    const result = spawnSync("go", ["run", "entgo.io/ent/cmd/ent", "generate", "./ent/schema"], {
      cwd: workdir,
      env: goEnv(),
      encoding: "utf8",
      timeout: 120000,
    });
    assert.equal(result.status, 0, `ent_codegen_failed:${result.stderr || result.stdout}`);
    for (const generated of ["ent/client.go", "ent/migrate/schema.go", "ent/run.go", "ent/workflowexecution.go"]) {
      assert.equal(await stat(path.join(workdir, generated)).then(() => true, () => false), true, `ent_codegen_missing:${generated}`);
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function assertServiceSurface() {
  assert.equal(await exists(serviceRoot), true, "go_backend_service_root_missing");
  for (const file of serviceSurfaceFiles) assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_required_file_missing:${file}`);

  const goMod = await readRepoFile(`${serviceRoot}/go.mod`);
  assertIncludes(goMod, "module github.com/rendehuang/medopl/services/medopl-go-backend", "go_mod_module");
  assertIncludes(goMod, "go 1.22", "go_mod_version");
  assertIncludes(goMod, "github.com/gin-gonic/gin", "go_mod_gin_dependency");
  assertIncludes(goMod, "github.com/lib/pq", "go_mod_postgres_driver_dependency");
  assertNotMatches(goMod, /github\.com\/redis\/go-redis|pgx/u, "go_backend_service_surface_must_not_introduce_unapproved_db_client");

  const mainSource = await readRepoFile(`${serviceRoot}/cmd/server/main.go`);
  assertIncludes(mainSource, "internal/config", "server_main_must_use_config");
  assertIncludes(mainSource, "internal/server", "server_main_must_use_server");
  assertIncludes(mainSource, "Run", "server_main_must_start_http_server");

  const routerSource = await readRepoFile(`${serviceRoot}/internal/server/router.go`);
  for (const marker of ["gin.New", "GET(\"/health\"", "GET(\"/version\"", "GET(\"/config/check\""]) {
    assertIncludes(routerSource, marker, `router_marker:${marker}`);
  }
  const configSource = await readRepoFile(`${serviceRoot}/internal/config/config.go`);
  for (const marker of ["DatabaseURL", "DATABASE_URL", "MEDOPL_ENV", "production"]) {
    assertIncludes(configSource, marker, `production_database_config_marker:${marker}`);
  }
  const storeSelectorSource = await readRepoFile(`${serviceRoot}/internal/server/store_selector.go`);
  for (const marker of ["newControlPlaneStore", "openProductionSQLBackend", "DATABASE_URL required for production control-plane store", "postgres.NewControlPlaneStore"]) {
    assertIncludes(storeSelectorSource, marker, `production_store_selector_marker:${marker}`);
  }
  const postgresSQLBackendSource = await readRepoFile(`${serviceRoot}/internal/repository/postgres/sql_backend.go`);
  assertIncludes(postgresSQLBackendSource, `sql.Open("postgres"`, "postgres_sql_backend_must_open_postgres_driver");
  for (const marker of [
    "INSERT INTO business_accounts",
    "FROM business_accounts",
    "INSERT INTO credit_events",
    "FROM credit_events",
    "FOR UPDATE",
    "ON CONFLICT (event_id) DO NOTHING",
    "SET balance = balance + $1",
  ]) {
    assertIncludes(postgresSQLBackendSource, marker, `postgres_business_persistence_marker:${marker}`);
  }
  const postgresControlPlaneSource = await readRepoFile(`${serviceRoot}/internal/repository/postgres/controlplane_store.go`);
  for (const marker of ["type ControlPlaneStore struct", "SaveBusinessAccount", "BusinessAccountByWorkspace", "ApplyCreditEvent", "SaveCreditEvent", "ListCreditEvents"]) {
    assertIncludes(postgresControlPlaneSource, marker, `postgres_control_plane_store_marker:${marker}`);
  }
  const postgresRuntimeLifecycleSource = await readRepoFile(`${serviceRoot}/internal/repository/postgres/runtime_lifecycle_backend.go`);
  for (const marker of [
    "UpsertResourceBindingLedger",
    "ResourceBindingLedger",
    "ListResourceBindingLedgers",
    "UpsertCloudOperation",
    "CloudOperation",
    "ensureRuntimeIdentityRows",
    "INSERT INTO resource_bindings",
    "INSERT INTO cloud_operations",
    "ON CONFLICT (resource_binding_id)",
    "ON CONFLICT (operation_id)",
  ]) {
    assertIncludes(postgresRuntimeLifecycleSource, marker, `postgres_runtime_lifecycle_marker:${marker}`);
  }
  for (const marker of [
    "type runtimeLifecycleBackend interface",
    "backend.UpsertResourceBindingLedger",
    "backend.ResourceBindingLedger",
    "backend.ListResourceBindingLedgers",
    "backend.UpsertCloudOperation",
    "backend.CloudOperation",
  ]) {
    assertIncludes(postgresControlPlaneSource, marker, `postgres_runtime_lifecycle_control_plane_marker:${marker}`);
  }
  const healthSource = await readRepoFile(`${serviceRoot}/internal/server/handlers/health.go`);
  for (const marker of ["medopl-go-backend", "status", "ok", "checks", "config"]) assertIncludes(healthSource, marker, `health_marker:${marker}`);
  assertNotMatches(healthSource, /time\.Now|Hostname|os\.Getpid|uuid|rand/u, "health_handler_must_be_deterministic");
}

async function assertEntPostgresBoundary() {
  assert.equal(await exists(schemaRoot), true, "go_backend_ent_schema_root_missing");
  assert.equal(await exists(migrationRoot), true, "go_backend_migration_root_missing");
  const schemaFiles = await listFiles(schemaRoot);
  for (const file of requiredSchemas) assert(schemaFiles.includes(file), `go_backend_required_ent_schema_missing:${file}`);

  const goMod = await readRepoFile(`${serviceRoot}/go.mod`);
  assertIncludes(goMod, "entgo.io/ent", "go_mod_must_include_ent");
  assertNotMatches(goMod, /github\.com\/redis\/go-redis/u, "step9_must_not_introduce_redis_client");

  for (const file of requiredSchemas) {
    const source = await readRepoFile(`${schemaRoot}/${file}`);
    for (const marker of ["ent.Schema", "created_at", "updated_at", "Edges() []ent.Edge", "Indexes() []ent.Index"]) {
      assertIncludes(source, marker, `schema_marker:${file}:${marker}`);
    }
    for (const marker of schemaExpectations.get(file) ?? []) assertIncludes(source, marker, `schema_expectation:${file}:${marker}`);
    assertNotMatches(source, /Default\(""\)/u, `schema_must_not_encode_absence_as_empty_string:${file}`);
    assertNotMatches(source, /rawApiKey|bearerToken|launchToken|runtimeToken|secretFile|objectKey|localPath|signedUrl/u, `schema_must_not_store_secret_or_blob_locator:${file}`);
  }

  assert.deepEqual(await listFiles(migrationRoot), ["0001_baseline.sql"], "go_backend_migration_files_must_be_single_repeatable_baseline");
  const migration = await readRepoFile(`${migrationRoot}/0001_baseline.sql`);
  for (const table of requiredTables) {
    assertIncludes(migration, `CREATE TABLE IF NOT EXISTS ${table}`, `migration_must_create_table:${table}`);
    assertIncludes(migration, `CREATE INDEX IF NOT EXISTS idx_${table}`, `migration_must_have_repeatable_index:${table}`);
  }
  for (const marker of ["tenant_id", "workspace_id", "run_id", "idempotency_key", "REFERENCES tenants(id)", "REFERENCES workspaces(id)", "REFERENCES runs(id)", "REFERENCES resource_bindings(resource_binding_id)", "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email", "CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_tenant_slug", "CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_workspace_idempotency", "CREATE UNIQUE INDEX IF NOT EXISTS idx_files_workspace_name", "CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_bindings_resource_binding_id", "CREATE UNIQUE INDEX IF NOT EXISTS idx_cloud_operations_operation_id", "workflow_executions", "billing_events", "resource_bindings", "cloud_operations"]) {
    assertIncludes(migration, marker, `migration_marker:${marker}`);
  }
  assertNotMatches(migration, /DEFAULT ''|NOT NULL DEFAULT ''/u, "migration_must_not_encode_absence_as_empty_string");
  assertNotMatches(migration, /redis|session_cache|launch_token|runtime_token|raw_api_key|object_key|local_path|signed_url/u, "migration_must_not_store_volatile_or_secret_truth");
  await assertEntCodegen();
}

async function assertVolatileBoundary() {
  const volatileRoot = `${serviceRoot}/internal/repository/volatile`;
  assert.equal(await exists(volatileRoot), true, "go_backend_volatile_repository_root_missing");
  assert.equal(await exists(`${serviceRoot}/internal/repository/redis`), false, "go_backend_must_not_create_redis_repository_truth_source");
  for (const file of volatileFiles) assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_volatile_required_file_missing:${file}`);

  const source = (await Promise.all(volatileFiles.map((file) => readRepoFile(`${serviceRoot}/${file}`)))).join("\n");
  for (const marker of ["SessionStore", "CacheStore", "QueueStore", "LockStore"]) assertIncludes(source, `type ${marker} interface`, `volatile_interface:${marker}`);
  for (const marker of ["SetSession", "GetSession", "SetCache", "GetCache", "Enqueue", "Dequeue", "AcquireLock", "ReleaseLock", "ErrInvalidTTL", "ttl <= 0"]) {
    assertIncludes(source, marker, `volatile_marker:${marker}`);
  }
  assertNotMatches(source, /WorkspaceRepository|RunRepository|BillingRepository|TenantRepository|ArtifactRepository|FileRepository|WorkflowExecutionRepository|CanonicalStateStore|SaveWorkspace|SaveRun|SaveBilling|SaveTenant|go-redis|redis\.NewClient|postgres|pgx|lib\/pq/u, "volatile_must_not_store_canonical_truth");
  assertNotMatches(source, /rawApiKey|bearerToken|launchToken|runtimeToken|SecretId|SecretKey|kubeconfig|signedUrl|objectKey|localPath/u, "volatile_must_not_store_secret_or_blob_locator");
}

async function assertRunFileArtifactDomain() {
  const requiredMarkers = new Map([
    ["internal/domain/run/run.go", ["type RunRequest struct", "type RunExecution struct", "RunStatusPending", "RunStatusRunning", "RunStatusSucceeded", "RunStatusFailed", "RunStatusCancelled", "RunStatusGated", "ErrRuntimeAgentRequired", "ErrProviderKeyRequired", "ErrFileRefRequired", "ErrInvalidRunStatus", "ErrArtifactNotObserved", "ValidateRunRequest", "ApplyRuntimeResult"]],
    ["internal/domain/file/file.go", ["type FileRef struct", "FileKindInputs", "FileKindOutputs", "FileStatusAvailable", "FileStatusDeleted", "ValidateFileRef"]],
    ["internal/domain/artifact/artifact.go", ["type RunArtifact struct", "ArtifactKindOutputs", "ArtifactStatusAvailable", "ValidateRunArtifact"]],
    ["internal/repository/runfileartifact/store.go", ["type CanonicalStore interface", "SaveRunRequest", "SaveRunExecution", "SaveFileRef", "SaveRunArtifact", "ListRunArtifacts"]],
    ["internal/service/runfileartifact/service.go", ["CreateRunRequest", "RecordRuntimeResult", "RecordFileRef", "RecordRunArtifact", "ErrDuplicateID"]],
    ["internal/service/runfileartifact/service_test.go", ["TestServiceCreatesPendingRunWithoutFakeSuccess", "TestServiceRequiresProviderKeyAndFileRefs", "TestServiceRequiresRuntimeAgentEndpoint", "TestServiceRequiresObservedArtifactBeforeSucceededRun"]],
  ]);
  for (const file of domainFiles) assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_run_file_artifact_required_file_missing:${file}`);
  for (const [file, markers] of requiredMarkers) {
    const source = await readRepoFile(`${serviceRoot}/${file}`);
    for (const marker of markers) assertIncludes(source, marker, `go_backend_run_file_artifact_marker:${file}:${marker}`);
  }
  const goSources = (await Promise.all(domainFiles.filter((file) => file.endsWith(".go")).map((file) => readRepoFile(`${serviceRoot}/${file}`)))).join("\n");
  assertNotMatches(goSources, /rawApiKey|providerSecret|apiKey|launchToken|runtimeToken|bearerToken|SecretId|SecretKey|kubeconfig|storageKey|objectKey|signedUrl|presignedUrl|localPath|pathOnRuntime/u, "go_backend_run_file_artifact_must_not_persist_forbidden_marker");
}

async function assertRuntimeBrokerInterface() {
  const requiredMarkers = new Map([
    ["internal/integration/runtimebroker/runtime_broker.go", ["type Broker interface", "BindSession", "SubmitRun", "RunStatus", "ListArtifacts", "Artifact", "type SessionBindRequest struct", "type RunSubmitRequest struct", "type PublicRunArtifact", "type RuntimeClaims struct", "ErrProviderKeyRequired", "ErrResourceBindingRequired", "ErrRuntimeAgentRequired", "ErrArtifactNotObserved", "ErrInvalidRunMode", "SanitizeArtifact"]],
    ["internal/integration/runtimebroker/local_adapter.go", ["type LocalAdapter struct", "NewLocalAdapter", "BindSession", "SubmitRun", "RunStatus", "ListArtifacts", "Artifact", "RunStatusGated"]],
    ["internal/integration/runtimebroker/runtime_broker_test.go", ["TestLocalAdapterBindsSessionWithoutRawSecret", "TestLocalAdapterFailsClosedWithoutProviderKey", "TestLocalAdapterSubmitsGatedRunWithoutFakeSuccess", "TestLocalAdapterRejectsNonFullRuntimeMode", "TestSanitizeArtifactExposesPublicWhitelist", "TestLocalAdapterRequiresObservedArtifactForSucceededRun"]],
  ]);
  for (const file of runtimeBrokerFiles) assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_runtime_broker_required_file_missing:${file}`);
  for (const [file, markers] of requiredMarkers) {
    const source = await readRepoFile(`${serviceRoot}/${file}`);
    for (const marker of markers) assertIncludes(source, marker, `go_backend_runtime_broker_marker:${file}:${marker}`);
  }
  const source = (await Promise.all(runtimeBrokerFiles.map((file) => readRepoFile(`${serviceRoot}/${file}`)))).join("\n");
  assertNotMatches(source, /rawApiKey|providerSecret|apiKey|launchToken|runtimeToken|bearerToken|SecretId|SecretKey|kubeconfig|storageKey|objectKey|signedUrl|presignedUrl|localPath|pathOnRuntime|ledgerEntries|cloudInventory|billingLedger|http\.Client|http\.NewRequest|fetch|redis\.NewClient|sql\.Open|pgx|github\.com\/lib\/pq/u, "runtime_broker_must_not_expose_forbidden_marker");
}

async function assertWorkflowFacadeBoundary() {
  const workflowMarkers = new Map([
    ["internal/domain/workflow/workflow.go", ["type Command struct", "type Execution struct", "type ApprovalTask struct", "WorkflowStatusPending", "WorkflowStatusRunning", "WorkflowStatusSucceeded", "WorkflowStatusFailed", "WorkflowStatusCancelled", "ErrInvalidTransition", "ErrCommandIDRequired", "ErrIdempotencyKeyRequired", "Transition", "ValidateCommand"]],
    ["internal/repository/workflow/store.go", ["type Store interface", "CreateExecution", "ExecutionByCommandID", "ExecutionByIdempotencyKey", "UpdateExecution", "CreateApprovalTask", "ApprovalTask"]],
    ["internal/service/workflow/facade.go", ["type Facade struct", "SubmitCommand", "StartCommand", "SucceedCommand", "FailCommand", "CancelCommand", "CreateApprovalTask", "ErrDuplicateIdempotencyKey"]],
    ["internal/service/workflow/facade_test.go", ["TestFacadeCreatesPendingExecutionWithIdempotency", "TestFacadeReturnsExistingExecutionForIdempotencyKey", "TestFacadeTransitionsPendingRunningSucceededFailedCancelled", "TestFacadeCreatesApprovalTask"]],
  ]);
  for (const file of workflowFiles) assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_workflow_facade_required_file_missing:${file}`);
  for (const [file, markers] of workflowMarkers) {
    const source = await readRepoFile(`${serviceRoot}/${file}`);
    for (const marker of markers) assertIncludes(source, marker, `go_backend_workflow_facade_marker:${file}:${marker}`);
  }
  const workflowSource = (await Promise.all(workflowFiles.map((file) => readRepoFile(`${serviceRoot}/${file}`)))).join("\n");
  assertNotMatches(workflowSource, /Temporal|LangGraph|http\.Client|redis\.NewClient|sql\.Open|pgx|rawApiKey|launchToken|runtimeToken|bearerToken|objectKey|localPath|signedUrl|TargetRef|PayloadSummaryRef|ObjectRef|PayloadRef/u, "workflow_facade_must_not_introduce_forbidden_marker");

  for (const file of retiredWorkflowHttpFacadeFiles) {
    assert.equal(await exists(`${serviceRoot}/${file}`), false, `go_backend_legacy_workflow_http_facade_must_be_removed:${file}`);
  }
  const routerSource = await readRepoFile(`${serviceRoot}/internal/server/router.go`);
  assertIncludes(routerSource, "handlers.RegisterControlPlaneRoutes(api, controlPlane)", "go_backend_router_must_keep_control_plane_route_owner");
  for (const retiredRootFacade of ['POST("/workflow/commands"', 'POST("/runtime/launch"', 'POST("/runs"', 'POST("/billing/freeze"', 'POST("/resources/release"']) {
    assert.equal(routerSource.includes(retiredRootFacade), false, `go_backend_router_must_not_expose_legacy_root_facade:${retiredRootFacade}`);
  }
  for (const marker of ["WorkflowCommands", "WorkflowCommandAction", "workflowservice.NewFacade", "NewWorkflowStore", "SubmitRun(", "CreateRunRequest(", "RecordRuntimeResult(", "runtimebroker", "runfileartifact", "redis.NewClient", "sql.Open", "pgx", "Temporal", "LangGraph", "rawApiKey", "launchToken", "runtimeToken", "bearerToken", "objectKey", "localPath", "signedUrl"]) {
    assert.equal(routerSource.includes(marker), false, `go_backend_workflow_router_must_not_bypass_facade:${marker}`);
  }
}

async function assertLabTypedPortalAPI() {
  const labMarkers = new Map([
    ["internal/domain/lab/lab.go", ["type PackagePlan struct", "type Subscription struct", "type Entitlement struct", "Catalog()", "PackageByID", "ValidateWorkspaceID", "ValidatePackageID", "BuildEntitlement", "ErrWorkspaceRequired", "ErrPackageRequired", "ErrPackageNotFound"]],
    ["internal/repository/lab/store.go", ["type Store interface", "ListPackages", "SubscriptionByWorkspace", "ActivateSubscription", "UpgradeSubscription"]],
    ["internal/repository/memory/lab_store.go", ["type LabStore struct", "NewLabStore", "ListPackages", "SubscriptionByWorkspace", "ActivateSubscription", "UpgradeSubscription"]],
    ["internal/service/lab/service.go", ["type Service struct", "ListLabPackages", "GetLabSubscription", "GetLabEntitlement", "ActivateLabPackage", "UpgradeLabPackage"]],
    ["internal/server/handlers/lab.go", ["func LabPackages", "func LabSubscription", "func LabEntitlement", "func ActivateLabPackage", "func UpgradeLabPackage", "workspace_id_required", "package_id_required", "package_not_found"]],
    ["internal/server/router.go", ["api := router.Group(\"/api\")", "GET(\"/lab-packages\"", "GET(\"/lab-subscription\"", "GET(\"/lab-entitlement\"", "POST(\"/lab-packages/activate\"", "POST(\"/lab-packages/upgrade\""]],
  ]);
  for (const file of labTypedApiFiles) assert.equal(await exists(`${serviceRoot}/${file}`), true, `go_backend_lab_typed_api_required_file_missing:${file}`);
  for (const [file, markers] of labMarkers) {
    const source = await readRepoFile(`${serviceRoot}/${file}`);
    for (const marker of markers) assertIncludes(source, marker, `go_backend_lab_typed_api_marker_missing:${file}:${marker}`);
  }
  const labSource = (await Promise.all(labTypedApiFiles.filter((file) => file.endsWith(".go")).map((file) => readRepoFile(`${serviceRoot}/${file}`)))).join("\n");
  assertNotMatches(labSource, /rawApiKey|providerSecret|apiKey|bearerToken|launchToken|runtimeToken|SecretId|SecretKey|kubeconfig|signedUrl|objectKey|localPath|http\.Client|redis\.NewClient|sql\.Open|pgx|lib\/pq|tencent|cloud\.|kubectl/u, "lab_typed_api_must_not_read_secret_or_call_cloud");
}

function runGoPackageTest(packagePath, testName, label) {
  const result = spawnSync("go", ["test", packagePath, "-run", testName, "-count=1"], {
    cwd: path.join(repoRoot, serviceRoot),
    env: goEnv(),
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `${label}_failed:${result.stderr || result.stdout}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(output.includes(localRCProviderKeyFixture), false, `${label}_must_not_print_raw_provider_key`);
  return output;
}

async function assertLocalRCControlPlaneParity() {
  const serviceSource = await readJoinedGoFiles(`${serviceRoot}/internal/service/controlplane`);
  const handlerSource = await readJoinedGoFiles(`${serviceRoot}/internal/server/handlers`);
  const billingApiSource = await readRepoFile("services/portal/frontend/src/api/portal/billing.ts");
  const resourcesApiSource = await readRepoFile("services/portal/frontend/src/api/portal/resources.ts");
  const oplApiSource = await readRepoFile("services/portal/frontend/src/api/portal/opl.ts");

  for (const marker of [
    "BillingSummary(ctx",
    "BillingDetails(ctx",
    "SaveAuditEvent",
    "ledgerFromEvents",
    "OwnerScope: \"go-control-plane\"",
    "Resources(ctx",
    "Release(ctx",
    "DestroyStorage(ctx",
    "ReleaseManagedResource",
    "AuditKindStorageDestroy",
    "BillingStopped",
    "ResourceStatusActive",
  ]) {
    assertIncludes(serviceSource, marker, `go_local_rc_control_plane_service:${marker}`);
  }
  for (const marker of [
    'api.GET("/billing/summary"',
    'api.GET("/billing/details"',
    'api.GET("/costs/summary"',
    'api.GET("/costs/workspace"',
    'api.GET("/costs/run"',
    'api.GET("/platform-provisioned-resources"',
    'api.POST("/v22/managed-environment/release"',
    'api.POST("/v22/storage/destroy"',
  ]) {
    assertIncludes(handlerSource, marker, `go_local_rc_control_plane_handler:${marker}`);
  }
  for (const [label, source] of [
    ["billing_api", billingApiSource],
    ["resources_api", resourcesApiSource],
    ["opl_api", oplApiSource],
  ]) {
    assertIncludes(source, "goControlPlaneClient", `portal_${label}_must_use_go_control_plane_client`);
  }
  assert.equal(billingApiSource.includes("apiClient.get"), false, "portal_billing_api_must_not_use_node_portal_client");
  assert.equal(resourcesApiSource.includes("apiClient.get"), false, "portal_resources_api_must_not_use_node_portal_client");
  assertIncludes(oplApiSource, "bindProviderKeyForOplEntry", "opl_api_must_expose_provider_key_binding_action");
  assertIncludes(oplApiSource, '"/v22/provider-key"', "opl_api_provider_key_binding_must_call_go_v22_provider_key");

  const providerLaunchOutput = runGoPackageTest(
    "./internal/server/handlers",
    "TestControlPlaneHandlersExposeProviderLaunchBillingResourceLocalRC",
    "go_provider_launch_local_rc_parity",
  );
  assert(providerLaunchOutput.includes("ok"), "go_provider_launch_local_rc_parity_must_report_ok");
  runGoPackageTest(
    "./internal/service/controlplane",
    "TestServiceRecordsFileRunArtifactBillingAuditAndRelease",
    "go_billing_audit_local_rc_parity",
  );
  runGoPackageTest(
    "./internal/domain/controlplane",
    "TestReleaseStopsBillingAndKeepsHistoryAuditable",
    "go_resource_release_local_rc_parity",
  );
  runGoPackageTest(
    "./internal/repository/postgres",
    "TestControlPlaneStoreUsesTypedRuntimeLifecycleBackend",
    "go_typed_runtime_lifecycle_postgres_parity",
  );
  runGoPackageTest(
    "./internal/repository/postgres",
    "TestRuntimeOpenReleaseStateMachineSurvivesPostgresStoreRestart",
    "go_runtime_state_machine_postgres_restart_parity",
  );
}

await assertServiceSurface();
await assertEntPostgresBoundary();
await assertVolatileBoundary();
await assertRunFileArtifactDomain();
await assertRuntimeBrokerInterface();
await assertWorkflowFacadeBoundary();
await assertLabTypedPortalAPI();
await assertLocalRCControlPlaneParity();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_go_backend_service_surface",
  service: serviceRoot,
  endpoints: ["/health", "/version", "/config/check", "/api/lab-packages", "/api/lab-subscription", "/api/lab-entitlement", "/api/lab-packages/activate", "/api/lab-packages/upgrade"],
  canonicalTruth: "postgres_ent_schema",
  workflowFacade: "internal_service_boundary",
  labTypedAPI: "go_control_plane_mvp",
  localRCParity: "provider_launch_billing_audit_resource_release",
}, null, 2));
