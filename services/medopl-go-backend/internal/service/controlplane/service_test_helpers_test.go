package controlplane

import (
	"context"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

func assertLedgerHasSourceEvent(t *testing.T, ledger []LedgerItem, eventType string) {
	t.Helper()
	for _, item := range ledger {
		if item.SourceEventType == eventType {
			switch item.Type {
			case "credit", "debit", "hold", "release", "refund", "adjustment":
			default:
				t.Fatalf("ledger entry type must follow billing contract: %+v", item)
			}
			return
		}
	}
	t.Fatalf("ledger missing source event %q: %+v", eventType, ledger)
}

func assertLedgerAmount(t *testing.T, ledger []LedgerItem, eventType string, amount float64) {
	t.Helper()
	for _, item := range ledger {
		if item.SourceEventType == eventType {
			if item.Amount != amount {
				t.Fatalf("ledger amount mismatch for %q: got %v want %v item=%+v", eventType, item.Amount, amount, item)
			}
			return
		}
	}
	t.Fatalf("ledger missing source event %q: %+v", eventType, ledger)
}

func bindAndOpen(t *testing.T, ctx context.Context, service *Service) cpd.LaunchProjection {
	t.Helper()
	prepareFundedWorkspace(t, ctx, service, "tenant-v22", "user-v22", "workspace-v22", 200, "credit-workspace-v22-once")
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-once",
	}); err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}
	launch, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		IdempotencyKey: "open-once",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment() error = %v", err)
	}
	return launch
}

func prepareFundedWorkspace(t *testing.T, ctx context.Context, service *Service, tenantID string, portalUserID string, workspaceID string, amount float64, idempotencyKey string) {
	t.Helper()
	if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     tenantID,
		PortalUserID: portalUserID,
		WorkspaceID:  workspaceID,
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if _, err := service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
		TenantID:       tenantID,
		PortalUserID:   portalUserID,
		WorkspaceID:    workspaceID,
		Amount:         amount,
		Currency:       "CNY",
		IdempotencyKey: idempotencyKey,
	}); err != nil {
		t.Fatalf("CreditBusinessAccount() error = %v", err)
	}
}
