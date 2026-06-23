package memory

import (
	"context"
	"errors"
	"sort"
	"sync"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

type ControlPlaneStore struct {
	mu                  sync.Mutex
	accountsByWorkspace map[string]cpd.BusinessAccount
	creditsByID         map[string]cpd.CreditEvent
	bindingsByWorkspace map[string]cpd.ProviderBinding
	launchesByID        map[string]cpd.LaunchProjection
	filesByRef          map[string]cpd.FileRecord
	runsByID            map[string]cpd.RunRecord
	artifactsByRef      map[string]cpd.ArtifactRecord
	resourcesByBinding  map[string]cpd.ManagedResource
	ledgersByBinding    map[string]cpd.ResourceBindingLedger
	operationsByID      map[string]cpd.CloudOperation
	auditEventsByID     map[string]cpd.AuditEvent
}

func NewControlPlaneStore() *ControlPlaneStore {
	return &ControlPlaneStore{
		bindingsByWorkspace: make(map[string]cpd.ProviderBinding),
		accountsByWorkspace: make(map[string]cpd.BusinessAccount),
		creditsByID:         make(map[string]cpd.CreditEvent),
		launchesByID:        make(map[string]cpd.LaunchProjection),
		filesByRef:          make(map[string]cpd.FileRecord),
		runsByID:            make(map[string]cpd.RunRecord),
		artifactsByRef:      make(map[string]cpd.ArtifactRecord),
		resourcesByBinding:  make(map[string]cpd.ManagedResource),
		ledgersByBinding:    make(map[string]cpd.ResourceBindingLedger),
		operationsByID:      make(map[string]cpd.CloudOperation),
		auditEventsByID:     make(map[string]cpd.AuditEvent),
	}
}

func (store *ControlPlaneStore) SaveBusinessAccount(ctx context.Context, account cpd.BusinessAccount) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if existing, ok := store.accountsByWorkspace[account.WorkspaceID]; ok {
		if account.Balance == 0 {
			account.Balance = existing.Balance
		}
		if account.Currency == "" {
			account.Currency = existing.Currency
		}
		if account.CreatedAt == "" {
			account.CreatedAt = existing.CreatedAt
		}
	}
	store.accountsByWorkspace[account.WorkspaceID] = account
	return nil
}

func (store *ControlPlaneStore) BusinessAccountByWorkspace(ctx context.Context, workspaceID string) (cpd.BusinessAccount, error) {
	if err := ctx.Err(); err != nil {
		return cpd.BusinessAccount{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	account, ok := store.accountsByWorkspace[workspaceID]
	if !ok {
		return cpd.BusinessAccount{}, cprepo.ErrNotFound
	}
	return account, nil
}

func (store *ControlPlaneStore) BusinessAccountByUser(ctx context.Context, portalUserID string) (cpd.BusinessAccount, error) {
	if err := ctx.Err(); err != nil {
		return cpd.BusinessAccount{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, account := range store.accountsByWorkspace {
		if account.PortalUserID == portalUserID {
			return account, nil
		}
	}
	return cpd.BusinessAccount{}, cprepo.ErrNotFound
}

func (store *ControlPlaneStore) SaveCreditEvent(ctx context.Context, event cpd.CreditEvent) error {
	_, err := store.ApplyCreditEvent(ctx, event)
	if errors.Is(err, cprepo.ErrNotFound) {
		store.mu.Lock()
		defer store.mu.Unlock()
		if _, exists := store.creditsByID[event.ID]; exists {
			return nil
		}
		store.creditsByID[event.ID] = event
		return nil
	}
	return err
}

func (store *ControlPlaneStore) ApplyCreditEvent(ctx context.Context, event cpd.CreditEvent) (cpd.BusinessAccount, error) {
	if err := ctx.Err(); err != nil {
		return cpd.BusinessAccount{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, exists := store.creditsByID[event.ID]; exists {
		account, ok := store.accountsByWorkspace[event.WorkspaceID]
		if !ok {
			return cpd.BusinessAccount{}, cprepo.ErrNotFound
		}
		return account, nil
	}
	account, ok := store.accountsByWorkspace[event.WorkspaceID]
	if !ok {
		return cpd.BusinessAccount{}, cprepo.ErrNotFound
	}
	store.creditsByID[event.ID] = event
	account.Balance += event.Amount
	account.Currency = event.Currency
	store.accountsByWorkspace[event.WorkspaceID] = account
	return account, nil
}

func (store *ControlPlaneStore) ListCreditEvents(ctx context.Context, workspaceID string) ([]cpd.CreditEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	items := make([]cpd.CreditEvent, 0)
	for _, item := range store.creditsByID {
		if workspaceID == "" || item.WorkspaceID == workspaceID {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveProviderBinding(ctx context.Context, binding cpd.ProviderBinding) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.bindingsByWorkspace[binding.WorkspaceID] = binding
	return nil
}

func (store *ControlPlaneStore) ProviderBindingByWorkspace(ctx context.Context, workspaceID string) (cpd.ProviderBinding, error) {
	if err := ctx.Err(); err != nil {
		return cpd.ProviderBinding{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	binding, ok := store.bindingsByWorkspace[workspaceID]
	if !ok {
		return cpd.ProviderBinding{}, cprepo.ErrNotFound
	}
	return binding, nil
}

func (store *ControlPlaneStore) SaveLaunch(ctx context.Context, launch cpd.LaunchProjection) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.launchesByID[launch.LaunchID] = launch
	return nil
}

func (store *ControlPlaneStore) LaunchByID(ctx context.Context, launchID string) (cpd.LaunchProjection, error) {
	if err := ctx.Err(); err != nil {
		return cpd.LaunchProjection{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	launch, ok := store.launchesByID[launchID]
	if !ok {
		return cpd.LaunchProjection{}, cprepo.ErrNotFound
	}
	return launch, nil
}

func (store *ControlPlaneStore) SaveFile(ctx context.Context, file cpd.FileRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.filesByRef[file.FileRef] = file
	return nil
}

func (store *ControlPlaneStore) FileByRef(ctx context.Context, fileRef string) (cpd.FileRecord, error) {
	if err := ctx.Err(); err != nil {
		return cpd.FileRecord{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	file, ok := store.filesByRef[fileRef]
	if !ok {
		return cpd.FileRecord{}, cprepo.ErrNotFound
	}
	return file, nil
}

func (store *ControlPlaneStore) ListFiles(ctx context.Context, workspaceID string) ([]cpd.FileRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	items := make([]cpd.FileRecord, 0)
	for _, item := range store.filesByRef {
		if workspaceID == "" || item.WorkspaceID == workspaceID {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].FileRef < items[j].FileRef
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveRun(ctx context.Context, run cpd.RunRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	run.FileRefs = append([]string(nil), run.FileRefs...)
	run.InputObjectRefs = append([]string(nil), run.InputObjectRefs...)
	store.runsByID[run.RunID] = run
	return nil
}

func (store *ControlPlaneStore) RunByID(ctx context.Context, runID string) (cpd.RunRecord, error) {
	if err := ctx.Err(); err != nil {
		return cpd.RunRecord{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	run, ok := store.runsByID[runID]
	if !ok {
		return cpd.RunRecord{}, cprepo.ErrNotFound
	}
	run.FileRefs = append([]string(nil), run.FileRefs...)
	run.InputObjectRefs = append([]string(nil), run.InputObjectRefs...)
	return run, nil
}

func (store *ControlPlaneStore) ListRuns(ctx context.Context, workspaceID string) ([]cpd.RunRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	items := make([]cpd.RunRecord, 0)
	for _, item := range store.runsByID {
		if workspaceID == "" || item.WorkspaceID == workspaceID {
			item.FileRefs = append([]string(nil), item.FileRefs...)
			item.InputObjectRefs = append([]string(nil), item.InputObjectRefs...)
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].RunID < items[j].RunID
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveArtifact(ctx context.Context, artifact cpd.ArtifactRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	artifact.SourceFileRefs = append([]string(nil), artifact.SourceFileRefs...)
	store.artifactsByRef[artifact.ArtifactRef] = artifact
	return nil
}

func (store *ControlPlaneStore) ArtifactByRef(ctx context.Context, artifactRef string) (cpd.ArtifactRecord, error) {
	if err := ctx.Err(); err != nil {
		return cpd.ArtifactRecord{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	artifact, ok := store.artifactsByRef[artifactRef]
	if !ok {
		return cpd.ArtifactRecord{}, cprepo.ErrNotFound
	}
	artifact.SourceFileRefs = append([]string(nil), artifact.SourceFileRefs...)
	return artifact, nil
}

func (store *ControlPlaneStore) ListArtifacts(ctx context.Context, workspaceID string) ([]cpd.ArtifactRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	items := make([]cpd.ArtifactRecord, 0)
	for _, item := range store.artifactsByRef {
		if workspaceID == "" || item.WorkspaceID == workspaceID {
			item.SourceFileRefs = append([]string(nil), item.SourceFileRefs...)
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ArtifactRef < items[j].ArtifactRef
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveResource(ctx context.Context, resource cpd.ManagedResource) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.resourcesByBinding[resource.ResourceBindingID] = resource
	return nil
}

func (store *ControlPlaneStore) ResourceByBinding(ctx context.Context, resourceBindingID string) (cpd.ManagedResource, error) {
	if err := ctx.Err(); err != nil {
		return cpd.ManagedResource{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	resource, ok := store.resourcesByBinding[resourceBindingID]
	if !ok {
		return cpd.ManagedResource{}, cprepo.ErrNotFound
	}
	return resource, nil
}

func (store *ControlPlaneStore) ListResources(ctx context.Context, workspaceID string) ([]cpd.ManagedResource, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	items := make([]cpd.ManagedResource, 0, len(store.resourcesByBinding))
	for _, item := range store.resourcesByBinding {
		if workspaceID == "" || item.WorkspaceID == workspaceID {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ResourceBindingID < items[j].ResourceBindingID
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.ledgersByBinding[ledger.ResourceBindingID] = ledger
	return nil
}

func (store *ControlPlaneStore) CreateResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error {
	return store.SaveResourceBindingLedger(ctx, ledger)
}

func (store *ControlPlaneStore) ResourceBindingLedgerByID(ctx context.Context, resourceBindingID string) (cpd.ResourceBindingLedger, error) {
	if err := ctx.Err(); err != nil {
		return cpd.ResourceBindingLedger{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	ledger, ok := store.ledgersByBinding[resourceBindingID]
	if !ok {
		return cpd.ResourceBindingLedger{}, cprepo.ErrNotFound
	}
	return ledger, nil
}

func (store *ControlPlaneStore) ListResourceBindingLedgers(ctx context.Context, workspaceID string) ([]cpd.ResourceBindingLedger, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	items := make([]cpd.ResourceBindingLedger, 0, len(store.ledgersByBinding))
	for _, item := range store.ledgersByBinding {
		if workspaceID == "" || item.WorkspaceID == workspaceID {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ResourceBindingID < items[j].ResourceBindingID
	})
	return items, nil
}

func (store *ControlPlaneStore) SaveCloudOperation(ctx context.Context, operation cpd.CloudOperation) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.operationsByID[operation.OperationID] = operation
	return nil
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

func (store *ControlPlaneStore) updateResourceBinding(ctx context.Context, resourceBindingID string, update func(cpd.ResourceBindingLedger) (cpd.ResourceBindingLedger, error)) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	ledger, ok := store.ledgersByBinding[resourceBindingID]
	if !ok {
		return cprepo.ErrNotFound
	}
	updated, err := update(ledger)
	if err != nil {
		return err
	}
	store.ledgersByBinding[resourceBindingID] = updated

	if operation, ok := store.operationsByID[updated.OperationID]; ok {
		operation.NodePoolID = updated.NodePoolID
		operation.Status = updated.Status
		if updated.Status == cpd.ResourceBindingStatusReleased && updated.ReleasedAt != "" {
			operation.CompletedAt = updated.ReleasedAt
		}
		if updated.Status == cpd.ResourceBindingStatusFailed || updated.Status == cpd.ResourceBindingStatusCleanupRequired {
			operation.CompletedAt = time.Now().UTC().Format(time.RFC3339)
		}
		store.operationsByID[operation.OperationID] = operation
	}
	return nil
}

func (store *ControlPlaneStore) CloudOperationByID(ctx context.Context, operationID string) (cpd.CloudOperation, error) {
	if err := ctx.Err(); err != nil {
		return cpd.CloudOperation{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	operation, ok := store.operationsByID[operationID]
	if !ok {
		return cpd.CloudOperation{}, cprepo.ErrNotFound
	}
	return operation, nil
}

func (store *ControlPlaneStore) SaveAuditEvent(ctx context.Context, event cpd.AuditEvent) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.auditEventsByID[event.ID] = event
	return nil
}

func (store *ControlPlaneStore) ListAuditEvents(ctx context.Context, workspaceID string) ([]cpd.AuditEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	items := make([]cpd.AuditEvent, 0)
	for _, item := range store.auditEventsByID {
		if workspaceID == "" || item.WorkspaceID == workspaceID {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})
	return items, nil
}
