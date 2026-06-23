package server

import (
	"context"
	"testing"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/postgres"
)

func TestControlPlaneStoreSelectorFailsClosedForProductionWithoutDatabaseURL(t *testing.T) {
	_, err := newControlPlaneStore(config.Config{
		Service:            "medopl-go-backend",
		Mode:               "production",
		Port:               8789,
		ProviderSecretRoot: t.TempDir(),
	})
	if err == nil {
		t.Fatal("expected production control-plane store without DATABASE_URL to fail closed")
	}
}

func TestControlPlaneStoreSelectorUsesMemoryOnlyOutsideProduction(t *testing.T) {
	store, err := newControlPlaneStore(config.Config{
		Service:            "medopl-go-backend",
		Mode:               "local",
		Port:               8789,
		ProviderSecretRoot: t.TempDir(),
	})
	if err != nil {
		t.Fatalf("newControlPlaneStore() error = %v", err)
	}
	if store == nil {
		t.Fatal("expected local control-plane store")
	}
}

func TestControlPlaneStoreSelectorUsesPostgresForProductionDatabaseURL(t *testing.T) {
	previous := openProductionSQLBackend
	openProductionSQLBackend = func(ctx context.Context, databaseURL string, migrationPath string) (*postgres.SQLBackend, error) {
		return nil, nil
	}
	t.Cleanup(func() {
		openProductionSQLBackend = previous
	})
	store, err := newControlPlaneStore(config.Config{
		Service:            "medopl-go-backend",
		Mode:               "production",
		Port:               8789,
		ProviderSecretRoot: t.TempDir(),
		DatabaseURL:        "postgres://medopl:test@postgres.medopl.local:5432/medopl?sslmode=require",
	})
	if err != nil {
		t.Fatalf("newControlPlaneStore() error = %v", err)
	}
	if store == nil {
		t.Fatal("expected production control-plane store")
	}
	if got := controlPlaneStoreKind(store); got != "postgres" {
		t.Fatalf("store kind = %q", got)
	}
}
