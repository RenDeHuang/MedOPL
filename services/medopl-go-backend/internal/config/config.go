package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	defaultPort                         = 8789
	defaultMode                         = "local"
	serviceName                         = "medopl-go-backend"
	defaultLocalProviderSecretRoot      = ".runtime/runtime-bridge/provider-secrets"
	defaultProductionProviderSecretRoot = "/tmp/medopl-runtime/provider-secrets"
)

type Config struct {
	Service            string
	Mode               string
	Port               int
	DatabaseURL        string
	ProviderSecretRoot string
	PortalStaticRoot   string
	PortalStateRoot    string
	PortalStateStatus  string
	OPLGatewayURL      string
	RuntimeBridgeURL   string
}

func Load() (Config, error) {
	mode := valueOrDefault(os.Getenv("MEDOPL_BACKEND_MODE"), valueOrDefault(os.Getenv("MEDOPL_ENV"), defaultMode))
	cfg := Config{
		Service:            serviceName,
		Mode:               mode,
		Port:               defaultPort,
		DatabaseURL:        strings.TrimSpace(os.Getenv("DATABASE_URL")),
		ProviderSecretRoot: valueOrDefault(os.Getenv("PORTAL_OPL_PROVIDER_SECRET_ROOT"), defaultProviderSecretRoot(mode)),
		PortalStaticRoot:   strings.TrimSpace(os.Getenv("MEDOPL_PORTAL_STATIC_ROOT")),
		PortalStateRoot:    valueOrDefault(os.Getenv("MEDOPL_PORTAL_STATE_ROOT"), filepath.Join(".runtime", "local-services", "portal-state")),
		OPLGatewayURL:      strings.TrimRight(valueOrDefault(os.Getenv("OPL_WEB_GATEWAY_PUBLIC_URL"), "http://127.0.0.1:18789"), "/"),
		RuntimeBridgeURL:   strings.TrimRight(valueOrDefault(os.Getenv("PORTAL_RUNTIME_BRIDGE_PUBLIC_URL"), "http://127.0.0.1:8788"), "/"),
	}
	rawPort := valueOrDefault(os.Getenv("MEDOPL_BACKEND_PORT"), strconv.Itoa(defaultPort))
	port, err := strconv.Atoi(rawPort)
	if err != nil {
		return Config{}, fmt.Errorf("invalid MEDOPL_BACKEND_PORT: %w", err)
	}
	cfg.Port = port
	return cfg, cfg.Validate()
}

func (cfg Config) Addr() string {
	return fmt.Sprintf(":%d", cfg.Port)
}

func (cfg Config) Validate() error {
	if cfg.Service != serviceName {
		return fmt.Errorf("invalid service: %s", cfg.Service)
	}
	if cfg.Mode == "" {
		return fmt.Errorf("MEDOPL_BACKEND_MODE required")
	}
	if cfg.Port <= 0 || cfg.Port > 65535 {
		return fmt.Errorf("MEDOPL_BACKEND_PORT out of range: %d", cfg.Port)
	}
	if cfg.ProviderSecretRoot = strings.TrimSpace(cfg.ProviderSecretRoot); cfg.ProviderSecretRoot == "" {
		return fmt.Errorf("PORTAL_OPL_PROVIDER_SECRET_ROOT required")
	}
	if strings.TrimSpace(cfg.Mode) == "production" {
		if strings.TrimSpace(cfg.DatabaseURL) == "" {
			return fmt.Errorf("DATABASE_URL required for production mode")
		}
		if err := validateProductionDatabaseURL(cfg.DatabaseURL); err != nil {
			return err
		}
	}
	return nil
}

func validateProductionDatabaseURL(raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return fmt.Errorf("DATABASE_URL must be a valid postgres URL")
	}
	if parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
		return fmt.Errorf("DATABASE_URL must use postgres protocol")
	}
	if strings.TrimSpace(parsed.Hostname()) == "" {
		return fmt.Errorf("DATABASE_URL hostname required")
	}
	if strings.Contains(parsed.Hostname(), ":") && !strings.Contains(parsed.Host, "[") {
		return fmt.Errorf("DATABASE_URL hostname must not include a port segment")
	}
	if strings.TrimSpace(parsed.Port()) != "" {
		port, err := strconv.Atoi(parsed.Port())
		if err != nil || port <= 0 || port > 65535 {
			return fmt.Errorf("DATABASE_URL port out of range")
		}
	}
	return nil
}

func valueOrDefault(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func defaultProviderSecretRoot(mode string) string {
	if strings.TrimSpace(mode) == "production" {
		return defaultProductionProviderSecretRoot
	}
	return defaultLocalProviderSecretRoot
}
