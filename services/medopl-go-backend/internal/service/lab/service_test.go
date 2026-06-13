package lab

import (
	"context"
	"errors"
	"testing"

	labdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/lab"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func TestServiceListsPackagesAndDisabledEntitlement(t *testing.T) {
	service := NewService(memory.NewLabStore())
	ctx := context.Background()
	items, err := service.ListLabPackages(ctx)
	if err != nil || len(items) != 2 {
		t.Fatalf("items=%+v err=%v", items, err)
	}
	entitlement, err := service.GetLabEntitlement(ctx, "workspace-v22")
	if err != nil {
		t.Fatalf("entitlement err=%v", err)
	}
	if entitlement.Enabled || entitlement.Status != "disabled" {
		t.Fatalf("entitlement=%+v", entitlement)
	}
}

func TestServiceActivatesAndUpgradesLabPackage(t *testing.T) {
	service := NewService(memory.NewLabStore())
	ctx := context.Background()
	activated, err := service.ActivateLabPackage(ctx, MutationInput{
		WorkspaceID:    "workspace-v22",
		PackageID:      "starter",
		IdempotencyKey: "idem-activate",
	})
	if err != nil || activated.Subscription.PackageID != "starter_2c4g_100gb" || !activated.Entitlement.Enabled {
		t.Fatalf("activated=%+v err=%v", activated, err)
	}
	upgraded, err := service.UpgradeLabPackage(ctx, MutationInput{
		WorkspaceID:    "workspace-v22",
		PackageID:      "pro",
		IdempotencyKey: "idem-upgrade",
	})
	if err != nil || upgraded.Subscription.PackageID != "pro_8c16g_100gb" || upgraded.Entitlement.Storage.TotalGB != 100 {
		t.Fatalf("upgraded=%+v err=%v", upgraded, err)
	}
}

func TestServiceFailsClosedForMissingWorkspaceAndPackage(t *testing.T) {
	service := NewService(memory.NewLabStore())
	ctx := context.Background()
	if _, err := service.ActivateLabPackage(ctx, MutationInput{PackageID: "starter"}); !errors.Is(err, labdomain.ErrWorkspaceRequired) {
		t.Fatalf("missing workspace err=%v", err)
	}
	if _, err := service.ActivateLabPackage(ctx, MutationInput{WorkspaceID: "workspace-v22"}); !errors.Is(err, labdomain.ErrPackageRequired) {
		t.Fatalf("missing package err=%v", err)
	}
	if _, err := service.ActivateLabPackage(ctx, MutationInput{WorkspaceID: "workspace-v22", PackageID: "unknown"}); !errors.Is(err, labdomain.ErrPackageNotFound) {
		t.Fatalf("unknown package err=%v", err)
	}
}
