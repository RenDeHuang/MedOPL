package controlplane

import (
	"fmt"
	"strings"
	"time"

	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/secret/providersecret"
)

type Service struct {
	store              cprepo.Store
	now                func() time.Time
	providerSecretSink ProviderSecretSink
	oplGatewayURL      string
	runtimeBridgeURL   string
}

type ProviderSecretSink interface {
	WriteProviderSecret(ref string, secret providersecret.Secret) error
}

type Option func(*Service)

type WorkspaceInput struct {
	WorkspaceID string
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
