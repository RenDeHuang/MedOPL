package controlplane

import (
	"context"
	"errors"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

var ErrNotFound = errors.New("not_found")

type Store interface {
	SaveProviderBinding(ctx context.Context, binding cpd.ProviderBinding) error
	ProviderBindingByWorkspace(ctx context.Context, workspaceID string) (cpd.ProviderBinding, error)
	SaveLaunch(ctx context.Context, launch cpd.LaunchProjection) error
	LaunchByID(ctx context.Context, launchID string) (cpd.LaunchProjection, error)
	SaveResource(ctx context.Context, resource cpd.ManagedResource) error
	ResourceByBinding(ctx context.Context, resourceBindingID string) (cpd.ManagedResource, error)
	ListResources(ctx context.Context, workspaceID string) ([]cpd.ManagedResource, error)
	SaveResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error
	ResourceBindingLedgerByID(ctx context.Context, resourceBindingID string) (cpd.ResourceBindingLedger, error)
	ListResourceBindingLedgers(ctx context.Context, workspaceID string) ([]cpd.ResourceBindingLedger, error)
	SaveCloudOperation(ctx context.Context, operation cpd.CloudOperation) error
	CloudOperationByID(ctx context.Context, operationID string) (cpd.CloudOperation, error)
	SaveAuditEvent(ctx context.Context, event cpd.AuditEvent) error
	ListAuditEvents(ctx context.Context, workspaceID string) ([]cpd.AuditEvent, error)
}
