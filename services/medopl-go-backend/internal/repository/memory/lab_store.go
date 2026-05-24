package memory

import (
	"context"
	"sync"

	labdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/lab"
	labrepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/lab"
)

type LabStore struct {
	mu                     sync.Mutex
	subscriptionsByID      map[string]labdomain.Subscription
	subscriptionsWorkspace map[string]string
}

func NewLabStore() *LabStore {
	return &LabStore{
		subscriptionsByID:      make(map[string]labdomain.Subscription),
		subscriptionsWorkspace: make(map[string]string),
	}
}

func (store *LabStore) ListPackages(ctx context.Context) ([]labdomain.PackagePlan, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return labdomain.Catalog(), nil
}

func (store *LabStore) SubscriptionByWorkspace(ctx context.Context, workspaceID string) (labdomain.Subscription, error) {
	if err := ctx.Err(); err != nil {
		return labdomain.Subscription{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	subscriptionID, ok := store.subscriptionsWorkspace[workspaceID]
	if !ok {
		return labdomain.Subscription{}, labrepo.ErrNotFound
	}
	return store.subscriptionsByID[subscriptionID], nil
}

func (store *LabStore) ActivateSubscription(ctx context.Context, subscription labdomain.Subscription) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, ok := store.subscriptionsByID[subscription.ID]; ok {
		return labrepo.ErrDuplicateID
	}
	store.subscriptionsByID[subscription.ID] = subscription
	store.subscriptionsWorkspace[subscription.WorkspaceID] = subscription.ID
	return nil
}

func (store *LabStore) UpgradeSubscription(ctx context.Context, subscription labdomain.Subscription) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, ok := store.subscriptionsByID[subscription.ID]; !ok {
		return labrepo.ErrNotFound
	}
	store.subscriptionsByID[subscription.ID] = subscription
	store.subscriptionsWorkspace[subscription.WorkspaceID] = subscription.ID
	return nil
}
