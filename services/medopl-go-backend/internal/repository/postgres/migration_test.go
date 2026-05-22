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
		"CREATE INDEX IF NOT EXISTS",
		"idempotency_key",
		"workspace_id",
		"REFERENCES tenants(id)",
		"REFERENCES workspaces(id)",
		"REFERENCES runs(id)",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_tenant_slug",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_workspace_idempotency",
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_files_workspace_name",
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
