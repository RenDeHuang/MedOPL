package server

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/postgres"
)

var openProductionSQLBackend = postgres.OpenSQLBackend

type storeKind interface {
	Kind() string
}

func newControlPlaneStore(cfg config.Config) (cprepo.Store, error) {
	if strings.TrimSpace(cfg.Mode) != "production" {
		return memory.NewControlPlaneStore(), nil
	}
	if strings.TrimSpace(cfg.DatabaseURL) == "" {
		return nil, fmt.Errorf("DATABASE_URL required for production control-plane store")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	backend, err := openProductionSQLBackend(ctx, cfg.DatabaseURL, "migrations/0001_baseline.sql")
	if err != nil {
		return nil, fmt.Errorf("open production postgres control-plane store: %w", err)
	}
	return postgres.NewControlPlaneStore(backend), nil
}

func controlPlaneStoreKind(store cprepo.Store) string {
	if typed, ok := store.(storeKind); ok {
		return typed.Kind()
	}
	return "memory"
}
