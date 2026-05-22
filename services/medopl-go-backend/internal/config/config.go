package config

import (
	"fmt"
	"os"
	"strconv"
)

const (
	defaultPort = 8789
	defaultMode = "local"
	serviceName = "medopl-go-backend"
)

type Config struct {
	Service string
	Mode    string
	Port    int
}

func Load() (Config, error) {
	cfg := Config{
		Service: serviceName,
		Mode:    valueOrDefault(os.Getenv("MEDOPL_BACKEND_MODE"), defaultMode),
		Port:    defaultPort,
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
	return nil
}

func valueOrDefault(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
