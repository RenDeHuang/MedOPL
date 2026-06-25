package controlplane

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/secret/providersecret"
)

type Service struct {
	store              cprepo.Store
	mu                 sync.Mutex
	now                func() time.Time
	providerSecretSink ProviderSecretSink
	oplGatewayURL      string
	runtimeBridgeURL   string
	canaryAdmission    CanaryAdmissionPolicy
}

type ProviderSecretSink interface {
	WriteProviderSecret(ref string, secret providersecret.Secret) error
}

type Option func(*Service)

type WorkspaceInput struct {
	WorkspaceID string
}

type CanaryAdmissionPolicy struct {
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

type CanaryAdmissionDecision struct {
	Enabled            bool    `json:"enabled"`
	Allowed            bool    `json:"allowed"`
	Decision           string  `json:"decision"`
	Reason             string  `json:"reason,omitempty"`
	EnabledBy          string  `json:"enabledBy,omitempty"`
	TenantScopeHash    string  `json:"tenantScopeHash,omitempty"`
	UserScopeHash      string  `json:"userScopeHash,omitempty"`
	CostCeiling        float64 `json:"costCeiling,omitempty"`
	MonitoringOwner    string  `json:"monitoringOwner,omitempty"`
	RollbackOwner      string  `json:"rollbackOwner,omitempty"`
	DisableCommandRef  string  `json:"disableCommandRef,omitempty"`
	AdmissionReceiptID string  `json:"admissionReceiptId,omitempty"`
}

func WithProviderSecretStore(sink ProviderSecretSink) Option {
	return func(service *Service) {
		service.providerSecretSink = sink
	}
}

func WithGatewayURLs(oplGatewayURL string, runtimeBridgeURL string) Option {
	return func(service *Service) {
		service.oplGatewayURL = strings.TrimRight(strings.TrimSpace(oplGatewayURL), "/")
		service.runtimeBridgeURL = strings.TrimRight(strings.TrimSpace(runtimeBridgeURL), "/")
	}
}

func WithCanaryAdmission(policy CanaryAdmissionPolicy) Option {
	return func(service *Service) {
		service.canaryAdmission = normalizedCanaryAdmissionPolicy(policy)
	}
}

func (service *Service) SetCanaryAdmissionPolicy(policy CanaryAdmissionPolicy) {
	service.mu.Lock()
	defer service.mu.Unlock()
	service.canaryAdmission = normalizedCanaryAdmissionPolicy(policy)
}

func NewService(store cprepo.Store, options ...Option) *Service {
	service := &Service{store: store, now: time.Now}
	for _, option := range options {
		if option != nil {
			option(service)
		}
	}
	return service
}

func shortID(value string) string {
	sum := 0
	for _, r := range value {
		sum += int(r)
	}
	return fmt.Sprintf("%x", sum)
}

func stableID(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])[:16]
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
