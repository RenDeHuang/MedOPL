package config

import (
	"crypto/sha256"
	"encoding/hex"
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
	Service              string
	Mode                 string
	Port                 int
	DatabaseURL          string
	ProviderSecretRoot   string
	PortalStaticRoot     string
	PortalStateRoot      string
	PortalStateStatus    string
	OPLGatewayURL        string
	RuntimeBridgeURL     string
	AuthTokenHash        string
	AdminTokenHash       string
	WebhookSecretHash    string
	SessionSecretHash    string
	SessionBootstrapHash string
	CanaryAdmission      CanaryAdmissionConfig
}

type CanaryAdmissionConfig struct {
	Enabled           bool
	EmergencyStop     bool
	AllowTenants      []string
	AllowUsers        []string
	EnabledBy         string
	CostCeiling       float64
	MonitoringOwner   string
	RollbackOwner     string
	DisableCommandRef string
}

func Load() (Config, error) {
	mode := valueOrDefault(os.Getenv("MEDOPL_BACKEND_MODE"), valueOrDefault(os.Getenv("MEDOPL_ENV"), defaultMode))
	cfg := Config{
		Service:              serviceName,
		Mode:                 mode,
		Port:                 defaultPort,
		DatabaseURL:          strings.TrimSpace(os.Getenv("DATABASE_URL")),
		ProviderSecretRoot:   valueOrDefault(os.Getenv("PORTAL_OPL_PROVIDER_SECRET_ROOT"), defaultProviderSecretRoot(mode)),
		PortalStaticRoot:     strings.TrimSpace(os.Getenv("MEDOPL_PORTAL_STATIC_ROOT")),
		PortalStateRoot:      valueOrDefault(os.Getenv("MEDOPL_PORTAL_STATE_ROOT"), filepath.Join(".runtime", "local-services", "portal-state")),
		OPLGatewayURL:        strings.TrimRight(valueOrDefault(os.Getenv("OPL_WEB_GATEWAY_PUBLIC_URL"), "http://127.0.0.1:18789"), "/"),
		RuntimeBridgeURL:     strings.TrimRight(valueOrDefault(os.Getenv("PORTAL_RUNTIME_BRIDGE_PUBLIC_URL"), "http://127.0.0.1:8788"), "/"),
		AuthTokenHash:        strings.TrimSpace(os.Getenv("MEDOPL_AUTH_TOKEN_SHA256")),
		AdminTokenHash:       strings.TrimSpace(os.Getenv("MEDOPL_ADMIN_TOKEN_SHA256")),
		WebhookSecretHash:    strings.TrimSpace(os.Getenv("MEDOPL_WEBHOOK_SECRET_SHA256")),
		SessionSecretHash:    strings.TrimSpace(os.Getenv("MEDOPL_SESSION_SIGNING_SECRET_SHA256")),
		SessionBootstrapHash: strings.TrimSpace(os.Getenv("MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256")),
		CanaryAdmission: CanaryAdmissionConfig{
			Enabled:           envBool("MEDOPL_CANARY_ADMISSION_ENABLED"),
			EmergencyStop:     envBool("MEDOPL_CANARY_EMERGENCY_STOP"),
			AllowTenants:      csvEnv("MEDOPL_CANARY_TENANT_ALLOWLIST"),
			AllowUsers:        csvEnv("MEDOPL_CANARY_USER_ALLOWLIST"),
			EnabledBy:         strings.TrimSpace(os.Getenv("MEDOPL_CANARY_ADMISSION_ENABLED_BY")),
			CostCeiling:       envFloat("MEDOPL_CANARY_COST_CEILING_USD"),
			MonitoringOwner:   strings.TrimSpace(os.Getenv("MEDOPL_CANARY_MONITORING_OWNER")),
			RollbackOwner:     strings.TrimSpace(os.Getenv("MEDOPL_CANARY_ROLLBACK_OWNER")),
			DisableCommandRef: strings.TrimSpace(os.Getenv("MEDOPL_CANARY_DISABLE_COMMAND_REF")),
		},
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
		if err := validateSHA256Env("MEDOPL_AUTH_TOKEN_SHA256", cfg.AuthTokenHash); err != nil {
			return err
		}
		if err := validateSHA256Env("MEDOPL_ADMIN_TOKEN_SHA256", cfg.AdminTokenHash); err != nil {
			return err
		}
		if err := validateSHA256Env("MEDOPL_WEBHOOK_SECRET_SHA256", cfg.WebhookSecretHash); err != nil {
			return err
		}
		if err := validateSHA256Env("MEDOPL_SESSION_SIGNING_SECRET_SHA256", cfg.SessionSecretHash); err != nil {
			return err
		}
		if err := validateSHA256Env("MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256", cfg.SessionBootstrapHash); err != nil {
			return err
		}
		if cfg.CanaryAdmission.Enabled {
			if len(cfg.CanaryAdmission.AllowTenants) == 0 {
				return fmt.Errorf("MEDOPL_CANARY_TENANT_ALLOWLIST required when canary admission is enabled")
			}
			if len(cfg.CanaryAdmission.AllowUsers) == 0 {
				return fmt.Errorf("MEDOPL_CANARY_USER_ALLOWLIST required when canary admission is enabled")
			}
			if cfg.CanaryAdmission.CostCeiling <= 0 {
				return fmt.Errorf("MEDOPL_CANARY_COST_CEILING_USD required when canary admission is enabled")
			}
		}
	}
	return nil
}

func TokenHash(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func validateSHA256Env(name string, value string) error {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fmt.Errorf("%s required for production mode", name)
	}
	if len(trimmed) != 64 {
		return fmt.Errorf("%s must be sha256 hex", name)
	}
	for _, char := range trimmed {
		if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f')) {
			return fmt.Errorf("%s must be lowercase sha256 hex", name)
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

func csvEnv(name string) []string {
	values := strings.Split(os.Getenv(name), ",")
	out := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func envBool(name string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(name))) {
	case "1", "true", "yes", "on", "enabled":
		return true
	default:
		return false
	}
}

func envFloat(name string) float64 {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return 0
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || value < 0 {
		return 0
	}
	return value
}
