package memory

import (
	"context"
	"sort"
	"sync"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

type ControlPlaneStore struct {
	mu                  sync.Mutex
	bindingsByWorkspace map[string]cpd.ProviderBinding
	launchesByID        map[string]cpd.LaunchProjection
	resourcesByBinding  map[string]cpd.ManagedResource
	ledgersByBinding    map[string]cpd.ResourceBindingLedger
	operationsByID      map[string]cpd.CloudOperation
	auditEventsByID     map[string]cpd.AuditEvent
}

func NewControlPlaneStore() *ControlPlaneStore {
	return &ControlPlaneStore{
		bindingsByWorkspace: make(map[string]cpd.ProviderBinding),
		launchesByID:        make(map[string]cpd.LaunchProjection),
		resourcesByBinding:  make(map[string]cpd.ManagedResource),
		ledgersByBinding:    make(map[string]cpd.ResourceBindingLedger),
		operationsByID:      make(map[string]cpd.CloudOperation),
		auditEventsByID:     make(map[string]cpd.AuditEvent),
	}
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
