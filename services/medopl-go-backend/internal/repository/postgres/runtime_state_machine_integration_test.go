package postgres

import (
	"context"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cps "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
)

func TestRuntimeOpenReleaseStateMachineSurvivesPostgresStoreRestart(t *testing.T) {
	ctx := context.Background()
	db := NewMemoryTestDB(t)
	first := cps.NewService(NewControlPlaneStore(db))
	if _, err := first.PrepareBusinessAccount(ctx, cps.PrepareBusinessAccountInput{
		TenantID:     "tenant-runtime-state-rc",
		PortalUserID: "user-runtime-state-rc",
		WorkspaceID:  "workspace-runtime-state-rc",
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if _, err := first.CreditBusinessAccount(ctx, cps.CreditBusinessAccountInput{
		TenantID:       "tenant-runtime-state-rc",
		PortalUserID:   "user-runtime-state-rc",
		WorkspaceID:    "workspace-runtime-state-rc",
		Amount:         200,
		Currency:       "CNY",
		IdempotencyKey: "credit-runtime-state-rc",
	}); err != nil {
		t.Fatalf("CreditBusinessAccount() error = %v", err)
	}
	if _, err := first.BindProviderKey(ctx, cps.BindProviderKeyInput{
		TenantID:       "tenant-runtime-state-rc",
		PortalUserID:   "user-runtime-state-rc",
		WorkspaceID:    "workspace-runtime-state-rc",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-runtime-state-rc",
	}); err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}
	launch, err := first.OpenManagedEnvironment(ctx, cps.OpenManagedEnvironmentInput{
		TenantID:       "tenant-runtime-state-rc",
		PortalUserID:   "user-runtime-state-rc",
		WorkspaceID:    "workspace-runtime-state-rc",
		IdempotencyKey: "open-runtime-state-rc",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment() error = %v", err)
	}

	second := cps.NewService(NewControlPlaneStore(db))
	ready, err := second.RuntimeGate(ctx, cps.RuntimeGateInput{
		WorkspaceID:    launch.WorkspaceID,
		InvocationMode: "runtime_required",
	})
	if err != nil {
		t.Fatalf("RuntimeGate(ready after restart) error = %v", err)
	}
	if ready.RuntimeState != "ready" || !ready.Release.CanReleaseRuntime || !ready.ConsumerProjection.RunEnabled {
		t.Fatalf("ready runtime projection must survive Postgres store restart: %+v", ready)
	}

	release, err := second.Release(ctx, cps.ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-runtime-state-rc",
	})
	if err != nil {
		t.Fatalf("Release() error = %v", err)
	}
	if !release.BillingStopped || release.AuditEventID == "" {
		t.Fatalf("release must stop billing and expose audit receipt: %+v", release)
	}

	third := cps.NewService(NewControlPlaneStore(db))
	released, err := third.RuntimeGate(ctx, cps.RuntimeGateInput{
		WorkspaceID:    launch.WorkspaceID,
		InvocationMode: "runtime_required",
	})
	if err != nil {
		t.Fatalf("RuntimeGate(released after restart) error = %v", err)
	}
	if released.RuntimeState != "released" || released.Billing.FreezeStatus != cpd.BillingStatusStopped || released.ConsumerProjection.RunEnabled {
		t.Fatalf("released runtime projection must survive Postgres store restart: %+v", released)
	}
	store := NewControlPlaneStore(db)
	ledger, err := store.ResourceBindingLedgerByID(ctx, launch.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID() error = %v", err)
	}
	if ledger.Status != cpd.ResourceBindingStatusReleased || ledger.ReleasedAt == "" {
		t.Fatalf("runtime lifecycle ledger must close on release: %+v", ledger)
	}
	operation, err := store.CloudOperationByID(ctx, ledger.OperationID)
	if err != nil {
		t.Fatalf("CloudOperationByID() error = %v", err)
	}
	if operation.Status != cpd.ResourceBindingStatusReleased || operation.CompletedAt == "" {
		t.Fatalf("cloud operation must follow released runtime lifecycle: %+v", operation)
	}
	audits, err := store.ListAuditEvents(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListAuditEvents() error = %v", err)
	}
	if releaseAuditCount(audits) != 1 {
		t.Fatalf("release must persist exactly one audit receipt across restarts: %+v", audits)
	}

	reopened, err := third.OpenManagedEnvironment(ctx, cps.OpenManagedEnvironmentInput{
		TenantID:       "tenant-runtime-state-rc",
		PortalUserID:   "user-runtime-state-rc",
		WorkspaceID:    launch.WorkspaceID,
		IdempotencyKey: "reopen-runtime-state-rc",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment(reopen) error = %v", err)
	}
	if reopened.ResourceBindingID != launch.ResourceBindingID {
		t.Fatalf("reopen must keep workspace runtime binding stable: first=%s reopened=%s", launch.ResourceBindingID, reopened.ResourceBindingID)
	}
	reopenedGate, err := third.RuntimeGate(ctx, cps.RuntimeGateInput{
		WorkspaceID:    launch.WorkspaceID,
		InvocationMode: "runtime_required",
	})
	if err != nil {
		t.Fatalf("RuntimeGate(reopened) error = %v", err)
	}
	if reopenedGate.RuntimeState != "ready" || reopenedGate.Billing.FreezeStatus != cpd.BillingStatusActive || !reopenedGate.ConsumerProjection.RunEnabled {
		t.Fatalf("reopen must restore ready runtime projection from Postgres state: %+v", reopenedGate)
	}
	if reopenedGate.Billing.FrozenAmount != 30 {
		t.Fatalf("reopen must create a fresh commercial hold after previous settlement: %+v", reopenedGate.Billing)
	}
	reactivated, err := store.ResourceBindingLedgerByID(ctx, launch.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID(after reopen) error = %v", err)
	}
	if reactivated.Status != cpd.ResourceBindingStatusReady || reactivated.ReleasedAt != "" {
		t.Fatalf("reopen must clear stale release marker: %+v", reactivated)
	}
}

func releaseAuditCount(audits []cpd.AuditEvent) int {
	count := 0
	for _, audit := range audits {
		if audit.Kind == cpd.AuditKindResourceRelease {
			count++
		}
	}
	return count
}
