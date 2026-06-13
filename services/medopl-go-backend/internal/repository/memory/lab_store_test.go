package memory

import (
	"context"
	"errors"
	"testing"

	labdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/lab"
	labrepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/lab"
)

func TestLabStoreActivatesAndUpgradesSubscription(t *testing.T) {
	store := NewLabStore()
	ctx := context.Background()
	subscription := labdomain.Subscription{
		ID:             "sub-v22",
		WorkspaceID:    "workspace-v22",
		PackageID:      "starter_2c4g_100gb",
		Status:         labdomain.SubscriptionStatusActive,
		IdempotencyKey: "idem-activate",
	}
	if err := store.ActivateSubscription(ctx, subscription); err != nil {
		t.Fatalf("activate: %v", err)
	}
	found, err := store.SubscriptionByWorkspace(ctx, "workspace-v22")
	if err != nil || found.PackageID != "starter_2c4g_100gb" {
		t.Fatalf("found = %+v err=%v", found, err)
	}
	subscription.PackageID = "pro_8c16g_100gb"
	subscription.IdempotencyKey = "idem-upgrade"
	if err := store.UpgradeSubscription(ctx, subscription); err != nil {
		t.Fatalf("upgrade: %v", err)
	}
	found, err = store.SubscriptionByWorkspace(ctx, "workspace-v22")
	if err != nil || found.PackageID != "pro_8c16g_100gb" {
		t.Fatalf("found after upgrade = %+v err=%v", found, err)
	}
}

func TestLabStoreFailsClosedForUnknownWorkspaceAndDuplicateID(t *testing.T) {
	store := NewLabStore()
	ctx := context.Background()
	if _, err := store.SubscriptionByWorkspace(ctx, "missing"); !errors.Is(err, labrepo.ErrNotFound) {
		t.Fatalf("missing err = %v", err)
	}
	subscription := labdomain.Subscription{
		ID:             "sub-v22",
		WorkspaceID:    "workspace-v22",
		PackageID:      "starter_2c4g_100gb",
		Status:         labdomain.SubscriptionStatusActive,
		IdempotencyKey: "idem-activate",
	}
	if err := store.ActivateSubscription(ctx, subscription); err != nil {
		t.Fatalf("activate: %v", err)
	}
	if err := store.ActivateSubscription(ctx, subscription); !errors.Is(err, labrepo.ErrDuplicateID) {
		t.Fatalf("duplicate err = %v", err)
	}
}

func TestLabStoreHonorsContextCancellation(t *testing.T) {
	store := NewLabStore()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := store.ListPackages(ctx); err == nil {
		t.Fatalf("expected canceled context error")
	}
}
