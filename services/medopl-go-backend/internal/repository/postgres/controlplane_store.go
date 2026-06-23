package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"sync"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

const (
	recordKindProviderBinding       = "provider_binding"
	recordKindBusinessAccount       = "business_account"
	recordKindCreditEvent           = "credit_event"
	recordKindLaunchProjection      = "launch_projection"
	recordKindFile                  = "file"
	recordKindRun                   = "run"
	recordKindArtifact              = "artifact"
	recordKindManagedResource       = "managed_resource"
	recordKindResourceBindingLedger = "resource_binding_ledger"
	recordKindCloudOperation        = "cloud_operation"
	recordKindAuditEvent            = "audit_event"
)

type Backend interface {
	UpsertRecord(ctx context.Context, record Record) error
	Record(ctx context.Context, kind string, recordID string) (Record, error)
	ListRecords(ctx context.Context, kind string, workspaceID string) ([]Record, error)
}

type businessBackend interface {
	UpsertBusinessAccount(ctx context.Context, account cpd.BusinessAccount) error
	BusinessAccountByWorkspace(ctx context.Context, workspaceID string) (cpd.BusinessAccount, error)
	BusinessAccountByUser(ctx context.Context, portalUserID string) (cpd.BusinessAccount, error)
	ApplyCreditEvent(ctx context.Context, event cpd.CreditEvent) (cpd.BusinessAccount, error)
	SaveCreditEvent(ctx context.Context, event cpd.CreditEvent) error
	ListCreditEvents(ctx context.Context, workspaceID string) ([]cpd.CreditEvent, error)
}

type runtimeLifecycleBackend interface {
	UpsertResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error
	ResourceBindingLedger(ctx context.Context, resourceBindingID string) (cpd.ResourceBindingLedger, error)
	ListResourceBindingLedgers(ctx context.Context, workspaceID string) ([]cpd.ResourceBindingLedger, error)
	UpsertCloudOperation(ctx context.Context, operation cpd.CloudOperation) error
	CloudOperation(ctx context.Context, operationID string) (cpd.CloudOperation, error)
}

type ControlPlaneStore struct {
	backend Backend
	kind    string
	mu      sync.Mutex
}

func NewControlPlaneStore(backend Backend) *ControlPlaneStore {
	return &ControlPlaneStore{backend: backend, kind: "postgres"}
}

func (store *ControlPlaneStore) Kind() string {
	return store.kind
}

func (store *ControlPlaneStore) SaveBusinessAccount(ctx context.Context, account cpd.BusinessAccount) error {
	account = store.mergeExistingBusinessAccount(ctx, account)
	if backend, ok := store.backend.(businessBackend); ok {
		return backend.UpsertBusinessAccount(ctx, account)
	}
	return store.save(ctx, recordKindBusinessAccount, account.WorkspaceID, account.WorkspaceID, account)
}

func (store *ControlPlaneStore) BusinessAccountByWorkspace(ctx context.Context, workspaceID string) (cpd.BusinessAccount, error) {
	if backend, ok := store.backend.(businessBackend); ok {
		return backend.BusinessAccountByWorkspace(ctx, workspaceID)
	}
	var account cpd.BusinessAccount
	err := store.load(ctx, recordKindBusinessAccount, workspaceID, &account)
	return account, err
}

func (store *ControlPlaneStore) BusinessAccountByUser(ctx context.Context, portalUserID string) (cpd.BusinessAccount, error) {
	if backend, ok := store.backend.(businessBackend); ok {
		return backend.BusinessAccountByUser(ctx, portalUserID)
	}
	records, err := store.backend.ListRecords(ctx, recordKindBusinessAccount, "")
	if err != nil {
		return cpd.BusinessAccount{}, err
	}
	for _, record := range records {
		var account cpd.BusinessAccount
		if err := json.Unmarshal(record.Payload, &account); err != nil {
			return cpd.BusinessAccount{}, err
		}
		if account.PortalUserID == portalUserID {
			return account, nil
		}
	}
	return cpd.BusinessAccount{}, cprepo.ErrNotFound
}

func (store *ControlPlaneStore) SaveCreditEvent(ctx context.Context, event cpd.CreditEvent) error {
	if backend, ok := store.backend.(businessBackend); ok {
		return backend.SaveCreditEvent(ctx, event)
	}
	_, err := store.ApplyCreditEvent(ctx, event)
	if errors.Is(err, cprepo.ErrNotFound) {
		store.mu.Lock()
		defer store.mu.Unlock()
		return store.save(ctx, recordKindCreditEvent, event.ID, event.WorkspaceID, event)
	}
	return err
}

func (store *ControlPlaneStore) ApplyCreditEvent(ctx context.Context, event cpd.CreditEvent) (cpd.BusinessAccount, error) {
	if backend, ok := store.backend.(businessBackend); ok {
		return backend.ApplyCreditEvent(ctx, event)
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	var existing cpd.CreditEvent
	if err := store.load(ctx, recordKindCreditEvent, event.ID, &existing); err == nil {
		return store.BusinessAccountByWorkspace(ctx, event.WorkspaceID)
	} else if !errors.Is(err, cprepo.ErrNotFound) {
		return cpd.BusinessAccount{}, err
	}
	var account cpd.BusinessAccount
	if err := store.load(ctx, recordKindBusinessAccount, event.WorkspaceID, &account); err != nil {
		return cpd.BusinessAccount{}, err
	}
	if err := store.save(ctx, recordKindCreditEvent, event.ID, event.WorkspaceID, event); err != nil {
		return cpd.BusinessAccount{}, err
	}
	account.Balance += event.Amount
	account.Currency = event.Currency
	if err := store.save(ctx, recordKindBusinessAccount, account.WorkspaceID, account.WorkspaceID, account); err != nil {
		return cpd.BusinessAccount{}, err
	}
	return account, nil
}

func (store *ControlPlaneStore) ListCreditEvents(ctx context.Context, workspaceID string) ([]cpd.CreditEvent, error) {
	if backend, ok := store.backend.(businessBackend); ok {
		return backend.ListCreditEvents(ctx, workspaceID)
	}
	records, err := store.backend.ListRecords(ctx, recordKindCreditEvent, workspaceID)
	if err != nil {
		return nil, err
	}
	items := make([]cpd.CreditEvent, 0, len(records))
	for _, record := range records {
		var item cpd.CreditEvent
		if err := json.Unmarshal(record.Payload, &item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})
	return items, nil
}

func (store *ControlPlaneStore) mergeExistingBusinessAccount(ctx context.Context, account cpd.BusinessAccount) cpd.BusinessAccount {
	existing, err := store.BusinessAccountByWorkspace(ctx, account.WorkspaceID)
	if err != nil {
		return account
	}
	if account.Balance == 0 {
		account.Balance = existing.Balance
	}
	if account.Currency == "" {
		account.Currency = existing.Currency
	}
	if account.CreatedAt == "" {
		account.CreatedAt = existing.CreatedAt
	}
	return account
}

func (store *ControlPlaneStore) SaveProviderBinding(ctx context.Context, binding cpd.ProviderBinding) error {
	return store.save(ctx, recordKindProviderBinding, binding.WorkspaceID, binding.WorkspaceID, binding)
}

func (store *ControlPlaneStore) ProviderBindingByWorkspace(ctx context.Context, workspaceID string) (cpd.ProviderBinding, error) {
	var binding cpd.ProviderBinding
	err := store.load(ctx, recordKindProviderBinding, workspaceID, &binding)
	return binding, err
}

func (store *ControlPlaneStore) SaveLaunch(ctx context.Context, launch cpd.LaunchProjection) error {
	return store.save(ctx, recordKindLaunchProjection, launch.LaunchID, launch.WorkspaceID, launch)
}

func (store *ControlPlaneStore) LaunchByID(ctx context.Context, launchID string) (cpd.LaunchProjection, error) {
	var launch cpd.LaunchProjection
	err := store.load(ctx, recordKindLaunchProjection, launchID, &launch)
	return launch, err
}

func (store *ControlPlaneStore) SaveFile(ctx context.Context, file cpd.FileRecord) error {
	return store.save(ctx, recordKindFile, file.FileRef, file.WorkspaceID, file)
}

func (store *ControlPlaneStore) FileByRef(ctx context.Context, fileRef string) (cpd.FileRecord, error) {
	var file cpd.FileRecord
	err := store.load(ctx, recordKindFile, fileRef, &file)
	return file, err
}

func (store *ControlPlaneStore) ListFiles(ctx context.Context, workspaceID string) ([]cpd.FileRecord, error) {
	records, err := store.backend.ListRecords(ctx, recordKindFile, workspaceID)
	if err != nil {
		return nil, err
	}
	items := make([]cpd.FileRecord, 0, len(records))
	for _, record := range records {
		var item cpd.FileRecord
		if err := json.Unmarshal(record.Payload, &item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].FileRef < items[j].FileRef
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveRun(ctx context.Context, run cpd.RunRecord) error {
	run.FileRefs = append([]string(nil), run.FileRefs...)
	run.InputObjectRefs = append([]string(nil), run.InputObjectRefs...)
	return store.save(ctx, recordKindRun, run.RunID, run.WorkspaceID, run)
}

func (store *ControlPlaneStore) RunByID(ctx context.Context, runID string) (cpd.RunRecord, error) {
	var run cpd.RunRecord
	err := store.load(ctx, recordKindRun, runID, &run)
	run.FileRefs = append([]string(nil), run.FileRefs...)
	run.InputObjectRefs = append([]string(nil), run.InputObjectRefs...)
	return run, err
}

func (store *ControlPlaneStore) ListRuns(ctx context.Context, workspaceID string) ([]cpd.RunRecord, error) {
	records, err := store.backend.ListRecords(ctx, recordKindRun, workspaceID)
	if err != nil {
		return nil, err
	}
	items := make([]cpd.RunRecord, 0, len(records))
	for _, record := range records {
		var item cpd.RunRecord
		if err := json.Unmarshal(record.Payload, &item); err != nil {
			return nil, err
		}
		item.FileRefs = append([]string(nil), item.FileRefs...)
		item.InputObjectRefs = append([]string(nil), item.InputObjectRefs...)
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].RunID < items[j].RunID
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveArtifact(ctx context.Context, artifact cpd.ArtifactRecord) error {
	artifact.SourceFileRefs = append([]string(nil), artifact.SourceFileRefs...)
	return store.save(ctx, recordKindArtifact, artifact.ArtifactRef, artifact.WorkspaceID, artifact)
}

func (store *ControlPlaneStore) ArtifactByRef(ctx context.Context, artifactRef string) (cpd.ArtifactRecord, error) {
	var artifact cpd.ArtifactRecord
	err := store.load(ctx, recordKindArtifact, artifactRef, &artifact)
	artifact.SourceFileRefs = append([]string(nil), artifact.SourceFileRefs...)
	return artifact, err
}

func (store *ControlPlaneStore) ListArtifacts(ctx context.Context, workspaceID string) ([]cpd.ArtifactRecord, error) {
	records, err := store.backend.ListRecords(ctx, recordKindArtifact, workspaceID)
	if err != nil {
		return nil, err
	}
	items := make([]cpd.ArtifactRecord, 0, len(records))
	for _, record := range records {
		var item cpd.ArtifactRecord
		if err := json.Unmarshal(record.Payload, &item); err != nil {
			return nil, err
		}
		item.SourceFileRefs = append([]string(nil), item.SourceFileRefs...)
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ArtifactRef < items[j].ArtifactRef
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveResource(ctx context.Context, resource cpd.ManagedResource) error {
	return store.save(ctx, recordKindManagedResource, resource.ResourceBindingID, resource.WorkspaceID, resource)
}

func (store *ControlPlaneStore) ResourceByBinding(ctx context.Context, resourceBindingID string) (cpd.ManagedResource, error) {
	var resource cpd.ManagedResource
	err := store.load(ctx, recordKindManagedResource, resourceBindingID, &resource)
	return resource, err
}

func (store *ControlPlaneStore) ListResources(ctx context.Context, workspaceID string) ([]cpd.ManagedResource, error) {
	records, err := store.backend.ListRecords(ctx, recordKindManagedResource, workspaceID)
	if err != nil {
		return nil, err
	}
	items := make([]cpd.ManagedResource, 0, len(records))
	for _, record := range records {
		var item cpd.ManagedResource
		if err := json.Unmarshal(record.Payload, &item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ResourceBindingID < items[j].ResourceBindingID
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error {
	if backend, ok := store.backend.(runtimeLifecycleBackend); ok {
		return backend.UpsertResourceBindingLedger(ctx, ledger)
	}
	return store.save(ctx, recordKindResourceBindingLedger, ledger.ResourceBindingID, ledger.WorkspaceID, ledger)
}

func (store *ControlPlaneStore) CreateResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error {
	return store.SaveResourceBindingLedger(ctx, ledger)
}

func (store *ControlPlaneStore) ResourceBindingLedgerByID(ctx context.Context, resourceBindingID string) (cpd.ResourceBindingLedger, error) {
	if backend, ok := store.backend.(runtimeLifecycleBackend); ok {
		return backend.ResourceBindingLedger(ctx, resourceBindingID)
	}
	var ledger cpd.ResourceBindingLedger
	err := store.load(ctx, recordKindResourceBindingLedger, resourceBindingID, &ledger)
	return ledger, err
}

func (store *ControlPlaneStore) ListResourceBindingLedgers(ctx context.Context, workspaceID string) ([]cpd.ResourceBindingLedger, error) {
	if backend, ok := store.backend.(runtimeLifecycleBackend); ok {
		return backend.ListResourceBindingLedgers(ctx, workspaceID)
	}
	records, err := store.backend.ListRecords(ctx, recordKindResourceBindingLedger, workspaceID)
	if err != nil {
		return nil, err
	}
	items := make([]cpd.ResourceBindingLedger, 0, len(records))
	for _, record := range records {
		var item cpd.ResourceBindingLedger
		if err := json.Unmarshal(record.Payload, &item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ResourceBindingID < items[j].ResourceBindingID
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveCloudOperation(ctx context.Context, operation cpd.CloudOperation) error {
	if backend, ok := store.backend.(runtimeLifecycleBackend); ok {
		return backend.UpsertCloudOperation(ctx, operation)
	}
	return store.save(ctx, recordKindCloudOperation, operation.OperationID, operation.WorkspaceID, operation)
}

func (store *ControlPlaneStore) AppendCloudOperationEvent(ctx context.Context, operation cpd.CloudOperation) error {
	return store.SaveCloudOperation(ctx, operation)
}

func (store *ControlPlaneStore) UpdateResourceBindingNodePool(ctx context.Context, resourceBindingID string, nodePoolID string, status string) error {
	return store.updateResourceBinding(ctx, resourceBindingID, func(ledger cpd.ResourceBindingLedger) (cpd.ResourceBindingLedger, error) {
		if !cpd.IsResourceBindingStatus(status) {
			return cpd.ResourceBindingLedger{}, cpd.ErrStatusRequired
		}
		ledger.NodePoolID = nodePoolID
		ledger.Status = status
		return ledger, nil
	})
}

func (store *ControlPlaneStore) UpdateResourceBindingStatus(ctx context.Context, resourceBindingID string, status string) error {
	return store.updateResourceBinding(ctx, resourceBindingID, func(ledger cpd.ResourceBindingLedger) (cpd.ResourceBindingLedger, error) {
		if !cpd.IsResourceBindingStatus(status) {
			return cpd.ResourceBindingLedger{}, cpd.ErrStatusRequired
		}
		ledger.Status = status
		return ledger, nil
	})
}

func (store *ControlPlaneStore) MarkResourceBindingReleased(ctx context.Context, resourceBindingID string, releasedAt time.Time) error {
	return store.updateResourceBinding(ctx, resourceBindingID, func(ledger cpd.ResourceBindingLedger) (cpd.ResourceBindingLedger, error) {
		ledger.Status = cpd.ResourceBindingStatusReleased
		ledger.ReleasedAt = releasedAt.UTC().Format(time.RFC3339)
		return ledger, nil
	})
}

func (store *ControlPlaneStore) MarkResourceBindingFailed(ctx context.Context, resourceBindingID string) error {
	return store.UpdateResourceBindingStatus(ctx, resourceBindingID, cpd.ResourceBindingStatusFailed)
}

func (store *ControlPlaneStore) MarkResourceBindingCleanupRequired(ctx context.Context, resourceBindingID string) error {
	return store.UpdateResourceBindingStatus(ctx, resourceBindingID, cpd.ResourceBindingStatusCleanupRequired)
}

func (store *ControlPlaneStore) CloudOperationByID(ctx context.Context, operationID string) (cpd.CloudOperation, error) {
	if backend, ok := store.backend.(runtimeLifecycleBackend); ok {
		return backend.CloudOperation(ctx, operationID)
	}
	var operation cpd.CloudOperation
	err := store.load(ctx, recordKindCloudOperation, operationID, &operation)
	return operation, err
}

func (store *ControlPlaneStore) SaveAuditEvent(ctx context.Context, event cpd.AuditEvent) error {
	return store.save(ctx, recordKindAuditEvent, event.ID, event.WorkspaceID, event)
}

func (store *ControlPlaneStore) ListAuditEvents(ctx context.Context, workspaceID string) ([]cpd.AuditEvent, error) {
	records, err := store.backend.ListRecords(ctx, recordKindAuditEvent, workspaceID)
	if err != nil {
		return nil, err
	}
	items := make([]cpd.AuditEvent, 0, len(records))
	for _, record := range records {
		var item cpd.AuditEvent
		if err := json.Unmarshal(record.Payload, &item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})
	return items, nil
}

func (store *ControlPlaneStore) updateResourceBinding(ctx context.Context, resourceBindingID string, update func(cpd.ResourceBindingLedger) (cpd.ResourceBindingLedger, error)) error {
	ledger, err := store.ResourceBindingLedgerByID(ctx, resourceBindingID)
	if err != nil {
		return err
	}
	updated, err := update(ledger)
	if err != nil {
		return err
	}
	if err := store.SaveResourceBindingLedger(ctx, updated); err != nil {
		return err
	}
	operation, err := store.CloudOperationByID(ctx, updated.OperationID)
	if err == nil {
		operation.NodePoolID = updated.NodePoolID
		operation.Status = updated.Status
		if updated.Status == cpd.ResourceBindingStatusReleased && updated.ReleasedAt != "" {
			operation.CompletedAt = updated.ReleasedAt
		}
		if updated.Status == cpd.ResourceBindingStatusFailed || updated.Status == cpd.ResourceBindingStatusCleanupRequired {
			operation.CompletedAt = time.Now().UTC().Format(time.RFC3339)
		}
		return store.SaveCloudOperation(ctx, operation)
	}
	if errors.Is(err, cprepo.ErrNotFound) {
		return nil
	}
	return err
}

func (store *ControlPlaneStore) save(ctx context.Context, kind string, recordID string, workspaceID string, value any) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return store.backend.UpsertRecord(ctx, Record{
		Kind:        kind,
		RecordID:    recordID,
		WorkspaceID: workspaceID,
		Payload:     payload,
	})
}

func (store *ControlPlaneStore) load(ctx context.Context, kind string, recordID string, target any) error {
	record, err := store.backend.Record(ctx, kind, recordID)
	if err != nil {
		return err
	}
	return json.Unmarshal(record.Payload, target)
}
