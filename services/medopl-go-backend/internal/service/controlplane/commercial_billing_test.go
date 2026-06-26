package controlplane

import (
	"context"
	"testing"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func TestCommercialBillingSummaryDerivesWalletFromCreditAndRuntimeHold(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	service.now = fixedClock("2026-06-24T00:00:00Z")

	if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-commercial",
		PortalUserID: "user-commercial",
		WorkspaceID:  "workspace-commercial",
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if _, err := service.ApproveBusinessAccount(ctx, ApproveBusinessAccountInput{
		TenantID:     "tenant-commercial",
		PortalUserID: "user-commercial",
		WorkspaceID:  "workspace-commercial",
	}); err != nil {
		t.Fatalf("ApproveBusinessAccount() error = %v", err)
	}
	if _, err := service.ApproveBusinessAccount(ctx, ApproveBusinessAccountInput{
		TenantID:     "tenant-commercial",
		PortalUserID: "user-commercial",
		WorkspaceID:  "workspace-commercial",
	}); err != nil {
		t.Fatalf("ApproveBusinessAccount() error = %v", err)
	}
	if _, err := service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
		TenantID:       "tenant-commercial",
		PortalUserID:   "user-commercial",
		WorkspaceID:    "workspace-commercial",
		Amount:         200,
		Currency:       "CNY",
		IdempotencyKey: "credit-commercial-once",
	}); err != nil {
		t.Fatalf("CreditBusinessAccount() error = %v", err)
	}
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-commercial",
		PortalUserID:   "user-commercial",
		WorkspaceID:    "workspace-commercial",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-commercial-once",
	}); err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}
	launch, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-commercial",
		PortalUserID:   "user-commercial",
		WorkspaceID:    "workspace-commercial",
		IdempotencyKey: "open-commercial-runtime-once",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment() error = %v", err)
	}

	summary, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingSummary() error = %v", err)
	}
	if summary.Wallet.Balance != 200 {
		t.Fatalf("wallet balance must come from credit ledger, got %+v", summary.Wallet)
	}
	if summary.Wallet.ActiveFreeze != 30 || summary.Wallet.Frozen != 30 || summary.Wallet.AvailableBalance != 170 {
		t.Fatalf("wallet freeze must come from active runtime hold, got %+v", summary.Wallet)
	}
	assertLedgerEntry(t, summary.Ledger, "credit", 200, "wallet_topup")
	assertLedgerEntry(t, summary.Ledger, "hold", 30, "resource_preauth_freeze")

	gate, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: launch.WorkspaceID, InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate() error = %v", err)
	}
	if gate.Billing.FrozenAmount != 30 || gate.Billing.FreezeStatus != cpd.BillingStatusActive {
		t.Fatalf("runtime gate freeze must mirror commercial hold: %+v", gate.Billing)
	}
}

func TestCommercialBillingReleaseSettlesUsageAndReleasesRemainingHold(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	service.now = fixedClock("2026-06-24T00:00:00Z")
	launch := prepareFundedRuntime(t, ctx, service, 200)

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "settlement.csv",
		RelativePath: "inputs/settlement.csv",
		ContentType:  "text/csv",
		SizeBytes:    256,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}
	if _, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "settle commercial run",
		FileRefs:  []string{fileRef.FileRef},
		ToolName:  "opl-webui-runtime",
		RequestID: "run-commercial-settlement",
	}); err != nil {
		t.Fatalf("StartRun() error = %v", err)
	}
	if _, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-commercial-settlement",
	}); err != nil {
		t.Fatalf("Release() error = %v", err)
	}

	summary, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingSummary() error = %v", err)
	}
	if summary.Wallet.Balance != 198.65 || summary.Wallet.ActiveFreeze != 0 || summary.Wallet.AvailableBalance != 198.65 {
		t.Fatalf("release must settle usage and release remaining hold, got %+v", summary.Wallet)
	}
	assertLedgerEntry(t, summary.Ledger, "hold", 0.1, cpd.AuditKindFileUpload)
	assertLedgerEntry(t, summary.Ledger, "debit", 1.25, cpd.AuditKindRunSucceeded)
	assertLedgerEntry(t, summary.Ledger, "release", 28.65, "subscription_freeze_release")
}

func prepareFundedRuntime(t *testing.T, ctx context.Context, service *Service, amount float64) cpd.LaunchProjection {
	t.Helper()
	if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-commercial",
		PortalUserID: "user-commercial",
		WorkspaceID:  "workspace-commercial",
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if _, err := service.ApproveBusinessAccount(ctx, ApproveBusinessAccountInput{
		TenantID:     "tenant-commercial",
		PortalUserID: "user-commercial",
		WorkspaceID:  "workspace-commercial",
	}); err != nil {
		t.Fatalf("ApproveBusinessAccount() error = %v", err)
	}
	if _, err := service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
		TenantID:       "tenant-commercial",
		PortalUserID:   "user-commercial",
		WorkspaceID:    "workspace-commercial",
		Amount:         amount,
		Currency:       "CNY",
		IdempotencyKey: "credit-commercial-once",
	}); err != nil {
		t.Fatalf("CreditBusinessAccount() error = %v", err)
	}
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-commercial",
		PortalUserID:   "user-commercial",
		WorkspaceID:    "workspace-commercial",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-commercial-once",
	}); err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}
	launch, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-commercial",
		PortalUserID:   "user-commercial",
		WorkspaceID:    "workspace-commercial",
		IdempotencyKey: "open-commercial-runtime-once",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment() error = %v", err)
	}
	return launch
}

func fixedClock(value string) func() time.Time {
	return func() time.Time {
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			panic(err)
		}
		return parsed
	}
}

func assertLedgerEntry(t *testing.T, ledger []LedgerItem, entryType string, amount float64, reason string) {
	t.Helper()
	for _, item := range ledger {
		if item.Type == entryType && item.Amount == amount && item.Reason == reason {
			return
		}
	}
	t.Fatalf("ledger entry missing type=%s amount=%v reason=%s ledger=%+v", entryType, amount, reason, ledger)
}
