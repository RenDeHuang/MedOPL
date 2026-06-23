package config

import "testing"

func TestLoadUsesDeterministicLocalDefaults(t *testing.T) {
	t.Setenv("MEDOPL_BACKEND_MODE", "")
	t.Setenv("MEDOPL_BACKEND_PORT", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Service != "medopl-go-backend" {
		t.Fatalf("service = %q", cfg.Service)
	}
	if cfg.Mode != "local" {
		t.Fatalf("mode = %q", cfg.Mode)
	}
	if cfg.Port != 8789 {
		t.Fatalf("port = %d", cfg.Port)
	}
	if cfg.Addr() != ":8789" {
		t.Fatalf("addr = %q", cfg.Addr())
	}
	if cfg.PortalStateRoot != ".runtime/local-services/portal-state" {
		t.Fatalf("portal state root = %q", cfg.PortalStateRoot)
	}
	if cfg.OPLGatewayURL != "http://127.0.0.1:18789" {
		t.Fatalf("opl gateway url = %q", cfg.OPLGatewayURL)
	}
	if cfg.RuntimeBridgeURL != "http://127.0.0.1:8788" {
		t.Fatalf("runtime bridge url = %q", cfg.RuntimeBridgeURL)
	}
}

func TestLoadUsesWritableProductionProviderSecretDefault(t *testing.T) {
	t.Setenv("MEDOPL_BACKEND_MODE", "production")
	t.Setenv("MEDOPL_ENV", "")
	t.Setenv("DATABASE_URL", "postgres://medopl:test@postgres.medopl.local:5432/medopl?sslmode=require")
	t.Setenv("PORTAL_OPL_PROVIDER_SECRET_ROOT", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.ProviderSecretRoot != "/tmp/medopl-runtime/provider-secrets" {
		t.Fatalf("provider secret root = %q", cfg.ProviderSecretRoot)
	}
	if cfg.DatabaseURL != "postgres://medopl:test@postgres.medopl.local:5432/medopl?sslmode=require" {
		t.Fatalf("database url = %q", cfg.DatabaseURL)
	}
}

func TestLoadAcceptsProductionModeFromDeployEnvironment(t *testing.T) {
	t.Setenv("MEDOPL_BACKEND_MODE", "")
	t.Setenv("MEDOPL_ENV", "production")
	t.Setenv("DATABASE_URL", "postgres://medopl:test@postgres.medopl.local:5432/medopl?sslmode=require")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Mode != "production" {
		t.Fatalf("mode = %q", cfg.Mode)
	}
}

func TestProductionModeRequiresDatabaseURL(t *testing.T) {
	t.Setenv("MEDOPL_BACKEND_MODE", "production")
	t.Setenv("MEDOPL_ENV", "")
	t.Setenv("DATABASE_URL", "")

	if _, err := Load(); err == nil {
		t.Fatal("expected production without DATABASE_URL to fail closed")
	}
}

func TestLoadRejectsInvalidPort(t *testing.T) {
	t.Setenv("MEDOPL_BACKEND_PORT", "not-a-port")

	if _, err := Load(); err == nil {
		t.Fatal("expected invalid port error")
	}
}

func TestValidateRejectsInvalidModeAndPort(t *testing.T) {
	if err := (Config{Service: "medopl-go-backend", Port: 8789}).Validate(); err == nil {
		t.Fatal("expected empty mode error")
	}
	if err := (Config{Service: "medopl-go-backend", Mode: "local", Port: 0}).Validate(); err == nil {
		t.Fatal("expected invalid port error")
	}
}
