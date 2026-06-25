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
	t.Setenv("MEDOPL_AUTH_TOKEN_SHA256", TokenHash("user-token"))
	t.Setenv("MEDOPL_ADMIN_TOKEN_SHA256", TokenHash("admin-token"))
	t.Setenv("MEDOPL_WEBHOOK_SECRET_SHA256", TokenHash("webhook-secret"))
	t.Setenv("MEDOPL_SESSION_SIGNING_SECRET_SHA256", TokenHash("session-secret"))
	t.Setenv("MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256", TokenHash("session-bootstrap-secret"))

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
	t.Setenv("MEDOPL_AUTH_TOKEN_SHA256", TokenHash("user-token"))
	t.Setenv("MEDOPL_ADMIN_TOKEN_SHA256", TokenHash("admin-token"))
	t.Setenv("MEDOPL_WEBHOOK_SECRET_SHA256", TokenHash("webhook-secret"))
	t.Setenv("MEDOPL_SESSION_SIGNING_SECRET_SHA256", TokenHash("session-secret"))
	t.Setenv("MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256", TokenHash("session-bootstrap-secret"))

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Mode != "production" {
		t.Fatalf("mode = %q", cfg.Mode)
	}
}

func TestProductionCanaryAdmissionRequiresSelectedTenantAndUserScope(t *testing.T) {
	t.Setenv("MEDOPL_BACKEND_MODE", "production")
	t.Setenv("MEDOPL_ENV", "")
	t.Setenv("DATABASE_URL", "postgres://medopl:test@postgres.medopl.local:5432/medopl?sslmode=require")
	t.Setenv("MEDOPL_AUTH_TOKEN_SHA256", TokenHash("user-token"))
	t.Setenv("MEDOPL_ADMIN_TOKEN_SHA256", TokenHash("admin-token"))
	t.Setenv("MEDOPL_WEBHOOK_SECRET_SHA256", TokenHash("webhook-secret"))
	t.Setenv("MEDOPL_SESSION_SIGNING_SECRET_SHA256", TokenHash("session-secret"))
	t.Setenv("MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256", TokenHash("session-bootstrap-secret"))
	t.Setenv("MEDOPL_CANARY_ADMISSION_ENABLED", "1")

	if _, err := Load(); err == nil {
		t.Fatal("expected enabled canary admission without selected tenant/user scope to fail closed")
	}

	t.Setenv("MEDOPL_CANARY_TENANT_ALLOWLIST", "tenant-selected")
	t.Setenv("MEDOPL_CANARY_USER_ALLOWLIST", "user-selected")
	if _, err := Load(); err == nil {
		t.Fatal("expected enabled canary admission without cost ceiling to fail closed")
	}

	t.Setenv("MEDOPL_CANARY_COST_CEILING_USD", "250")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() with selected canary scope error = %v", err)
	}
	if !cfg.CanaryAdmission.Enabled || len(cfg.CanaryAdmission.AllowTenants) != 1 || len(cfg.CanaryAdmission.AllowUsers) != 1 || cfg.CanaryAdmission.CostCeiling != 250 {
		t.Fatalf("canary admission config = %+v", cfg.CanaryAdmission)
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

func TestProductionModeRequiresAuthBoundaryHashes(t *testing.T) {
	t.Setenv("MEDOPL_BACKEND_MODE", "production")
	t.Setenv("MEDOPL_ENV", "")
	t.Setenv("DATABASE_URL", "postgres://medopl:test@postgres.medopl.local:5432/medopl?sslmode=require")

	if _, err := Load(); err == nil {
		t.Fatal("expected production without auth hashes to fail closed")
	}
}

func TestProductionModeRejectsMalformedAuthBoundaryHash(t *testing.T) {
	t.Setenv("MEDOPL_BACKEND_MODE", "production")
	t.Setenv("MEDOPL_ENV", "")
	t.Setenv("DATABASE_URL", "postgres://medopl:test@postgres.medopl.local:5432/medopl?sslmode=require")
	t.Setenv("MEDOPL_AUTH_TOKEN_SHA256", "not-a-sha")
	t.Setenv("MEDOPL_ADMIN_TOKEN_SHA256", TokenHash("admin-token"))
	t.Setenv("MEDOPL_WEBHOOK_SECRET_SHA256", TokenHash("webhook-secret"))
	t.Setenv("MEDOPL_SESSION_SIGNING_SECRET_SHA256", TokenHash("session-secret"))
	t.Setenv("MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256", TokenHash("session-bootstrap-secret"))

	if _, err := Load(); err == nil {
		t.Fatal("expected malformed production auth hash to fail closed")
	}
}

func TestProductionModeRejectsDatabaseURLWithDuplicatedPort(t *testing.T) {
	t.Setenv("MEDOPL_BACKEND_MODE", "production")
	t.Setenv("MEDOPL_ENV", "")
	t.Setenv("DATABASE_URL", "postgres://medopl:test@10.66.0.21:5432:5432/medopl?sslmode=disable")

	if _, err := Load(); err == nil {
		t.Fatal("expected malformed production DATABASE_URL to fail closed")
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
