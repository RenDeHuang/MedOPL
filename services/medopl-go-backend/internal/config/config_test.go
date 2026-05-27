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
