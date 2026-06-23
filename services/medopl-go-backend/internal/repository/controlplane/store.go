package controlplane

import (
	"context"
	"errors"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

var ErrNotFound = errors.New("not_found")

type Store interface {
	SaveBusinessAccount(ctx context.Context, account cpd.BusinessAccount) error
	BusinessAccountByWorkspace(ctx context.Context, workspaceID string) (cpd.BusinessAccount, error)
	BusinessAccountByUser(ctx context.Context, portalUserID string) (cpd.BusinessAccount, error)
	SaveCreditEvent(ctx context.Context, event cpd.CreditEvent) error
	ApplyCreditEvent(ctx context.Context, event cpd.CreditEvent) (cpd.BusinessAccount, error)
	ListCreditEvents(ctx context.Context, workspaceID string) ([]cpd.CreditEvent, error)
	SaveBillingEvent(ctx context.Context, event cpd.BillingEvent) error
	ListBillingEvents(ctx context.Context, workspaceID string) ([]cpd.BillingEvent, error)
	SaveProviderBinding(ctx context.Context, binding cpd.ProviderBinding) error
	ProviderBindingByWorkspace(ctx context.Context, workspaceID string) (cpd.ProviderBinding, error)
	SaveLaunch(ctx context.Context, launch cpd.LaunchProjection) error
	LaunchByID(ctx context.Context, launchID string) (cpd.LaunchProjection, error)
	SaveFile(ctx context.Context, file cpd.FileRecord) error
	FileByRef(ctx context.Context, fileRef string) (cpd.FileRecord, error)
	ListFiles(ctx context.Context, workspaceID string) ([]cpd.FileRecord, error)
	SaveRun(ctx context.Context, run cpd.RunRecord) error
	RunByID(ctx context.Context, runID string) (cpd.RunRecord, error)
	ListRuns(ctx context.Context, workspaceID string) ([]cpd.RunRecord, error)
	SaveArtifact(ctx context.Context, artifact cpd.ArtifactRecord) error
	ArtifactByRef(ctx context.Context, artifactRef string) (cpd.ArtifactRecord, error)
	ListArtifacts(ctx context.Context, workspaceID string) ([]cpd.ArtifactRecord, error)
	SaveResource(ctx context.Context, resource cpd.ManagedResource) error
	ResourceByBinding(ctx context.Context, resourceBindingID string) (cpd.ManagedResource, error)
	ListResources(ctx context.Context, workspaceID string) ([]cpd.ManagedResource, error)
	SaveResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error
	CreateResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error
	ResourceBindingLedgerByID(ctx context.Context, resourceBindingID string) (cpd.ResourceBindingLedger, error)
	ListResourceBindingLedgers(ctx context.Context, workspaceID string) ([]cpd.ResourceBindingLedger, error)
	SaveCloudOperation(ctx context.Context, operation cpd.CloudOperation) error
	AppendCloudOperationEvent(ctx context.Context, operation cpd.CloudOperation) error
	UpdateResourceBindingNodePool(ctx context.Context, resourceBindingID string, nodePoolID string, status string) error
	UpdateResourceBindingStatus(ctx context.Context, resourceBindingID string, status string) error
	MarkResourceBindingReleased(ctx context.Context, resourceBindingID string, releasedAt time.Time) error
	MarkResourceBindingFailed(ctx context.Context, resourceBindingID string) error
	MarkResourceBindingCleanupRequired(ctx context.Context, resourceBindingID string) error
	CloudOperationByID(ctx context.Context, operationID string) (cpd.CloudOperation, error)
	SaveAuditEvent(ctx context.Context, event cpd.AuditEvent) error
	ListAuditEvents(ctx context.Context, workspaceID string) ([]cpd.AuditEvent, error)
}
