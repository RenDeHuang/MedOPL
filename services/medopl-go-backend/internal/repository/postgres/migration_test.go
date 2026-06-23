package postgres

import (
	"os"
	"strings"
	"testing"
)

func readServiceFile(t *testing.T, repoPath string) string {
	t.Helper()
	source, err := os.ReadFile("../../../" + repoPath)
	if err != nil {
		t.Fatalf("read %s: %v", repoPath, err)
	}
	return string(source)
}

func TestBaselineMigrationIsRepeatableAndCanonical(t *testing.T) {
	migration := readServiceFile(t, "migrations/0001_baseline.sql")
	for _, marker := range []string{
		"CREATE TABLE IF NOT EXISTS tenants",
		"CREATE TABLE IF NOT EXISTS users",
		"CREATE TABLE IF NOT EXISTS workspaces",
		"CREATE TABLE IF NOT EXISTS runs",
		"CREATE TABLE IF NOT EXISTS artifacts",
		"CREATE TABLE IF NOT EXISTS files",
		"CREATE TABLE IF NOT EXISTS billing_events",
		"CREATE TABLE IF NOT EXISTS workflow_executions",
		"CREATE TABLE IF NOT EXISTS business_accounts",
		"CREATE TABLE IF NOT EXISTS credit_events",
		"CREATE TABLE IF NOT EXISTS provider_bindings",
		"CREATE TABLE IF NOT EXISTS launch_projections",
		"CREATE TABLE IF NOT EXISTS resource_bindings",
		"CREATE TABLE IF NOT EXISTS cloud_operations",
		"CREATE TABLE IF NOT EXISTS control_plane_audit_events",
		"CREATE INDEX IF NOT EXISTS",
		"idempotency_key",
		"workspace_id",
		"resource_binding_id",
		"billing_attribution_id",
		"workspace_storage_gb",
		"node_pool_id",
		"node_pool_name",
		"operation_id",
		"REFERENCES tenants(id)",
		"REFERENCES workspaces(id)",
		"REFERENCES runs(id)",
		"REFERENCES resource_bindings(resource_binding_id)",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_tenant_slug",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_workspace_idempotency",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_files_workspace_name",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_business_accounts_workspace_id",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_events_event_id",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_bindings_workspace_id",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_launch_projections_launch_id",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_bindings_resource_binding_id",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_cloud_operations_operation_id",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_control_plane_audit_events_event_id",
	} {
		if !strings.Contains(migration, marker) {
			t.Fatalf("migration missing marker %q", marker)
		}
	}
	for _, forbidden := range []string{
		"DEFAULT ''",
		"NOT NULL DEFAULT ''",
	} {
		if strings.Contains(migration, forbidden) {
			t.Fatalf("migration must not encode absent values as %q", forbidden)
		}
	}
}

func TestResourceBindingLedgerMigrationKeepsCloudTagsNonCanonical(t *testing.T) {
	migration := readServiceFile(t, "migrations/0001_baseline.sql")
	for _, marker := range []string{
		"canonical_ownership_source TEXT NOT NULL DEFAULT 'postgres_resource_binding_ledger'",
		"cloud_tag_support TEXT NOT NULL DEFAULT 'tke_nodepool_unsupported'",
		"CHECK (status IN ('requested', 'creating', 'created', 'scaling', 'ready', 'releaseRequested', 'deleting', 'released', 'failed', 'cleanupRequired'))",
		"CHECK (workspace_storage_gb > 0)",
		"released_at TIMESTAMPTZ",
	} {
		if !strings.Contains(migration, marker) {
			t.Fatalf("resource binding ledger migration missing marker %q", marker)
		}
	}
}

func TestBaselineMigrationDoesNotStoreVolatileOrSecretTruth(t *testing.T) {
	forbidden := []string{
		"redis",
		"session_cache",
		"launch_token",
		"runtime_token",
		"raw_api_key",
		"object_key",
		"local_path",
		"signed_url",
	}
	migration := strings.ToLower(readServiceFile(t, "migrations/0001_baseline.sql"))
	for _, marker := range forbidden {
		if strings.Contains(migration, marker) {
			t.Fatalf("migration must not contain %q", marker)
		}
	}
}

func TestEntSchemaDeclaresCanonicalPostgresConstraints(t *testing.T) {
	expectations := map[string][]string{
		"tenant.go": {
			"Edges() []ent.Edge",
			"Indexes() []ent.Index",
			`edge.To("users"`,
			`edge.To("workspaces"`,
			`index.Fields("status")`,
		},
		"user.go": {
			"Edges() []ent.Edge",
			"Indexes() []ent.Index",
			`edge.From("tenant"`,
			`Field("tenant_id")`,
			`index.Fields("tenant_id", "email").Unique()`,
		},
		"workspace.go": {
			"Edges() []ent.Edge",
			"Indexes() []ent.Index",
			`edge.From("tenant"`,
			`edge.From("owner"`,
			`index.Fields("tenant_id", "slug").Unique()`,
		},
		"run.go": {
			"Edges() []ent.Edge",
			"Indexes() []ent.Index",
			`field.String("idempotency_key").NotEmpty()`,
			`index.Fields("workspace_id", "idempotency_key").Unique()`,
		},
		"artifact.go": {
			"Edges() []ent.Edge",
			"Indexes() []ent.Index",
			`edge.From("run"`,
			`edge.From("workspace"`,
			`index.Fields("run_id")`,
			`index.Fields("workspace_id")`,
		},
		"file.go": {
			"Edges() []ent.Edge",
			"Indexes() []ent.Index",
			`edge.From("workspace"`,
			`index.Fields("workspace_id", "name").Unique()`,
		},
		"billingevent.go": {
			"Edges() []ent.Edge",
			"Indexes() []ent.Index",
			`field.String("workspace_id").Optional().Nillable()`,
			`index.Fields("idempotency_key").Unique()`,
		},
		"workflowexecution.go": {
			"Edges() []ent.Edge",
			"Indexes() []ent.Index",
			`field.String("run_id").Optional().Nillable()`,
			`index.Fields("idempotency_key").Unique()`,
		},
		"resourcebinding.go": {
			"Edges() []ent.Edge",
			"Indexes() []ent.Index",
			`field.String("resource_binding_id").NotEmpty().Unique()`,
			`field.Int("workspace_storage_gb").Positive()`,
			`field.String("canonical_ownership_source").Default("postgres_resource_binding_ledger")`,
			`field.String("cloud_tag_support").Default("tke_nodepool_unsupported")`,
			`field.Time("released_at").Optional().Nillable()`,
			`index.Fields("resource_binding_id").Unique()`,
			`edge.From("tenant"`,
			`edge.From("workspace"`,
		},
		"cloudoperation.go": {
			"Edges() []ent.Edge",
			"Indexes() []ent.Index",
			`field.String("operation_id").NotEmpty().Unique()`,
			`field.String("resource_binding_id").NotEmpty()`,
			`field.String("server_plan_id").NotEmpty()`,
			`field.Int("workspace_storage_gb").Positive()`,
			`field.String("cloud_tag_support").Default("tke_nodepool_unsupported")`,
			`field.String("canonical_ownership_source").Default("postgres_resource_binding_ledger")`,
			`field.Time("completed_at").Optional().Nillable()`,
			`index.Fields("operation_id").Unique()`,
			`edge.From("resource_binding"`,
		},
	}

	for file, markers := range expectations {
		source := readServiceFile(t, "ent/schema/"+file)
		if strings.Contains(source, `Default("")`) {
			t.Fatalf("%s must not encode absent values as empty strings", file)
		}
		for _, marker := range markers {
			if !strings.Contains(source, marker) {
				t.Fatalf("%s missing canonical schema marker %q", file, marker)
			}
		}
	}
}
