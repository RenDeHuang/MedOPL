package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	defaultPort = 8789
	defaultMode = "local"
	serviceName = "medopl-go-backend"
)

type Config struct {
	Service            string
	Mode               string
	Port               int
	ProviderSecretRoot string
}

func Load() (Config, error) {
	cfg := Config{
		Service:            serviceName,
		Mode:               valueOrDefault(os.Getenv("MEDOPL_BACKEND_MODE"), defaultMode),
		Port:               defaultPort,
		ProviderSecretRoot: valueOrDefault(os.Getenv("PORTAL_OPL_PROVIDER_SECRET_ROOT"), filepath.Join(".runtime", "runtime-bridge", "provider-secrets")),
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
	return nil
}

func valueOrDefault(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
