package memory

import (
	"context"
	"sort"
	"sync"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

type ControlPlaneStore struct {
	mu                  sync.Mutex
	bindingsByWorkspace map[string]cpd.ProviderBinding
	launchesByID        map[string]cpd.LaunchProjection
	resourcesByBinding  map[string]cpd.ManagedResource
	auditEventsByID     map[string]cpd.AuditEvent
}

func NewControlPlaneStore() *ControlPlaneStore {
	return &ControlPlaneStore{
		bindingsByWorkspace: make(map[string]cpd.ProviderBinding),
		launchesByID:        make(map[string]cpd.LaunchProjection),
		resourcesByBinding:  make(map[string]cpd.ManagedResource),
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

func (store *ControlPlaneStore) ListResources(ctx context.Context) ([]cpd.ManagedResource, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	items := make([]cpd.ManagedResource, 0, len(store.resourcesByBinding))
	for _, item := range store.resourcesByBinding {
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ResourceBindingID < items[j].ResourceBindingID
	})
	return items, nil
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
