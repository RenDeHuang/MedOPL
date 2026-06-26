package controlplane

import (
	"context"
	"errors"
	"testing"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func TestCommercialBillingFullBusinessCapabilityE2E(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	service.now = fixedClock("2026-06-24T00:00:00Z")

	if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-commercial-e2e",
		PortalUserID: "user-commercial-e2e",
		WorkspaceID:  "workspace-commercial-e2e",
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if _, err := service.ApproveBusinessAccount(ctx, ApproveBusinessAccountInput{
		TenantID:     "tenant-commercial-e2e",
		PortalUserID: "user-commercial-e2e",
		WorkspaceID:  "workspace-commercial-e2e",
	}); err != nil {
		t.Fatalf("ApproveBusinessAccount() error = %v", err)
	}
	order, err := service.CreatePaymentOrder(ctx, CreatePaymentOrderInput{
		TenantID:       "tenant-commercial-e2e",
		PortalUserID:   "user-commercial-e2e",
		WorkspaceID:    "workspace-commercial-e2e",
		Amount:         300,
		Currency:       "CNY",
		IdempotencyKey: "payment-order-commercial-e2e",
		ProviderRef:    "provider-order-ref",
	})
	if err != nil {
		t.Fatalf("CreatePaymentOrder() error = %v", err)
	}
	if order.Status != "created" || order.OrderID == "" || order.Amount != 300 {
		t.Fatalf("payment order = %+v", order)
	}
	for attempt := 0; attempt < 2; attempt++ {
		paid, err := service.MarkPaymentPaid(ctx, MarkPaymentPaidInput{
			TenantID:       "tenant-commercial-e2e",
			PortalUserID:   "user-commercial-e2e",
			WorkspaceID:    "workspace-commercial-e2e",
			OrderID:        order.OrderID,
			Amount:         300,
			Currency:       "CNY",
			IdempotencyKey: "payment-webhook-commercial-e2e",
			ProviderRef:    "provider-payment-ref",
		})
		if err != nil {
			t.Fatalf("MarkPaymentPaid() attempt %d error = %v", attempt, err)
		}
		if paid.Balance != 300 {
			t.Fatalf("payment webhook replay must not double credit: %+v", paid)
		}
	}

	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-commercial-e2e",
		PortalUserID:   "user-commercial-e2e",
		WorkspaceID:    "workspace-commercial-e2e",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-commercial-e2e",
	}); err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}
	launch, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-commercial-e2e",
		PortalUserID:   "user-commercial-e2e",
		WorkspaceID:    "workspace-commercial-e2e",
		IdempotencyKey: "open-commercial-e2e",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment() error = %v", err)
	}
	gate, err := service.RuntimeGate(ctx, RuntimeGateInput{
		TenantID:       "tenant-commercial-e2e",
		PortalUserID:   "user-commercial-e2e",
		WorkspaceID:    "workspace-commercial-e2e",
		InvocationMode: "runtime_required",
		RuntimePlanID:  "starter_2c4g_10gb",
		StoragePlanID:  "workspace_10gb",
		SessionID:      "session-commercial-e2e",
		TaskRef:        "task-commercial-e2e",
		TaskIntent:     "paper",
	})
	if err != nil {
		t.Fatalf("RuntimeGate(commercial e2e) error = %v", err)
	}
	admission := gate.CommercialAdmission
	if !admission.AccountExists || !admission.AccountApproved || !admission.WorkspaceExists || !admission.ProviderKeyRefExists || !admission.PlanSelected || !admission.BalanceSufficient || !admission.QuotaAvailable || admission.EmergencyPlatformStop {
		t.Fatalf("commercial e2e runtime gate must prove account/plan/balance/quota admission: %+v", admission)
	}
	if gate.ActionContract.PrimaryAction.Action != "return_to_opl_task" || gate.ActionContract.PrimaryAction.Reason != "runtime_storage_ready" {
		t.Fatalf("commercial e2e primary action must return to OPL task after paid runtime is ready: %+v", gate.ActionContract.PrimaryAction)
	}
	if gate.ActionContract.PurchaseProjection.ReturnToOPLTask.ResumeAction != "return_to_opl_task" ||
		gate.ActionContract.PurchaseProjection.ReturnToOPLTask.TaskRef != "task-commercial-e2e" ||
		gate.ActionContract.PurchaseProjection.ReturnToOPLTask.TaskIntent != "paper" {
		t.Fatalf("commercial e2e return-to-OPL contract = %+v", gate.ActionContract.PurchaseProjection.ReturnToOPLTask)
	}
	assertStringPresent(t, gate.ActionContract.PrimaryAction.CanClaim, "local_controlled_commercial_business_closure")
	assertStringPresent(t, gate.ActionContract.PrimaryAction.CannotClaim, "cloud_deployment_proof")
	freeze, err := service.RuntimeFreeze(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("RuntimeFreeze() error = %v", err)
	}
	if freeze.Status != "active" || freeze.Amount != 30 || freeze.FreezeDays != 7 || freeze.SettleEligibleAt != "2026-07-01T00:00:00Z" {
		t.Fatalf("runtime freeze = %+v", freeze)
	}

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "commercial-e2e.csv",
		RelativePath: "inputs/commercial-e2e.csv",
		ContentType:  "text/csv",
		SizeBytes:    1024,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}
	run, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "commercial e2e run",
		FileRefs:  []string{fileRef.FileRef},
		ToolName:  "opl-webui-runtime",
		RequestID: "run-commercial-e2e",
	})
	if err != nil {
		t.Fatalf("StartRun() error = %v", err)
	}
	if _, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-commercial-e2e",
	}); err != nil {
		t.Fatalf("Release() error = %v", err)
	}
	if _, err := service.DestroyStorage(ctx, DestroyStorageInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StorageBindingID:  storageBindingIDForLaunch(launch),
		IdempotencyKey:    "destroy-storage-commercial-e2e",
	}); err != nil {
		t.Fatalf("DestroyStorage() error = %v", err)
	}

	statement, err := service.BillingStatement(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingStatement() error = %v", err)
	}
	if statement.Wallet.Balance != 298.65 || statement.Wallet.ActiveFreeze != 0 || statement.Wallet.AvailableBalance != 298.65 {
		t.Fatalf("statement wallet = %+v", statement.Wallet)
	}
	if !statement.Receipts.RuntimeHold || !statement.Receipts.StorageMetadata || !statement.Receipts.FileMetadata || !statement.Receipts.RunMetadata || !statement.Receipts.ArtifactMetadata || !statement.Receipts.BillingAuditLinked || !statement.Receipts.ReleaseSettlement {
		t.Fatalf("statement receipts must prove storage/file/run/artifact/billing/audit/release linkage: %+v", statement.Receipts)
	}
	closure := statement.BusinessClosureReceipt
	if !closure.CustomerAccountExists || !closure.CreditRecorded || !closure.BalanceIncreased || !closure.ResourcePreauthFreeze || !closure.UsageDebitRecorded || !closure.BillingAttributionLinked || !closure.ReleaseStopBilling || !closure.StorageBillingStopped || !closure.AuditLinked {
		t.Fatalf("business closure receipt must prove internal commercial ledger journey: %+v", closure)
	}
	if closure.PreOpenBalanceCheck != "account_and_available_balance_required" {
		t.Fatalf("business closure pre-open balance check = %+v", closure)
	}
	if closure.IdempotencyPolicy != "credit_and_billing_events_use_idempotency_keys" || closure.InsufficientBalancePolicy != "runtime_open_fails_closed_when_available_balance_below_hold" {
		t.Fatalf("business closure safety policies = %+v", closure)
	}
	assertStringPresent(t, closure.CanClaim, "internal_commercial_billing_ledger_closure")
	assertStringPresent(t, closure.CannotClaim, "external_psp_settlement")
	assertLedgerEntry(t, statement.Rows, "credit", 300, "wallet_topup")
	assertLedgerEntry(t, statement.Rows, "hold", 30, "resource_preauth_freeze")
	assertLedgerEntry(t, statement.Rows, "hold", 0.1, cpd.AuditKindFileUpload)
	assertLedgerEntry(t, statement.Rows, "debit", 1.25, cpd.AuditKindRunSucceeded)
	assertLedgerEntry(t, statement.Rows, "release", 28.65, "subscription_freeze_release")
	assertLedgerReconciliationID(t, statement.Rows, cpd.AuditKindRunSucceeded, run.Run.RunRef)
}

func TestCommercialBillingOpenRuntimeRequiresFundedBusinessAccount(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-commercial-blocked",
		PortalUserID:   "user-commercial-blocked",
		WorkspaceID:    "workspace-commercial-blocked",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-commercial-blocked",
	}); err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}
	if _, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-commercial-blocked",
		PortalUserID:   "user-commercial-blocked",
		WorkspaceID:    "workspace-commercial-blocked",
		IdempotencyKey: "open-without-account",
	}); !errors.Is(err, cpd.ErrAccountRequired) {
		t.Fatalf("OpenManagedEnvironment(without account) error = %v", err)
	}
	if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-commercial-blocked",
		PortalUserID: "user-commercial-blocked",
		WorkspaceID:  "workspace-commercial-blocked",
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if _, err := service.ApproveBusinessAccount(ctx, ApproveBusinessAccountInput{
		TenantID:     "tenant-commercial-blocked",
		PortalUserID: "user-commercial-blocked",
		WorkspaceID:  "workspace-commercial-blocked",
	}); err != nil {
		t.Fatalf("ApproveBusinessAccount() error = %v", err)
	}
	if _, err := service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
		TenantID:       "tenant-commercial-blocked",
		PortalUserID:   "user-commercial-blocked",
		WorkspaceID:    "workspace-commercial-blocked",
		Amount:         29,
		Currency:       "CNY",
		IdempotencyKey: "credit-insufficient",
	}); err != nil {
		t.Fatalf("CreditBusinessAccount() error = %v", err)
	}
	if _, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-commercial-blocked",
		PortalUserID:   "user-commercial-blocked",
		WorkspaceID:    "workspace-commercial-blocked",
		IdempotencyKey: "open-insufficient-balance",
	}); !errors.Is(err, cpd.ErrInsufficientBalance) {
		t.Fatalf("OpenManagedEnvironment(insufficient balance) error = %v", err)
	}
}

func TestCommercialBillingRefundAdjustmentAndConcurrentPaymentAreIdempotent(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-commercial-ops",
		PortalUserID: "user-commercial-ops",
		WorkspaceID:  "workspace-commercial-ops",
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if _, err := service.ApproveBusinessAccount(ctx, ApproveBusinessAccountInput{
		TenantID:     "tenant-commercial-ops",
		PortalUserID: "user-commercial-ops",
		WorkspaceID:  "workspace-commercial-ops",
	}); err != nil {
		t.Fatalf("ApproveBusinessAccount() error = %v", err)
	}
	order, err := service.CreatePaymentOrder(ctx, CreatePaymentOrderInput{
		TenantID:       "tenant-commercial-ops",
		PortalUserID:   "user-commercial-ops",
		WorkspaceID:    "workspace-commercial-ops",
		Amount:         100,
		Currency:       "CNY",
		IdempotencyKey: "payment-order-ops",
	})
	if err != nil {
		t.Fatalf("CreatePaymentOrder() error = %v", err)
	}
	credits, errs := runConcurrent(8, func(index int) (BusinessAccountProjection, error) {
		return service.MarkPaymentPaid(ctx, MarkPaymentPaidInput{
			TenantID:       "tenant-commercial-ops",
			PortalUserID:   "user-commercial-ops",
			WorkspaceID:    "workspace-commercial-ops",
			OrderID:        order.OrderID,
			Amount:         100,
			Currency:       "CNY",
			IdempotencyKey: "payment-paid-ops",
		})
	})
	for _, err := range errs {
		if err != nil {
			t.Fatalf("MarkPaymentPaid(concurrent) error = %v", err)
		}
	}
	for _, credit := range credits {
		if credit.Balance != 100 {
			t.Fatalf("concurrent payment must keep one wallet credit: %+v", credit)
		}
	}
	for attempt := 0; attempt < 2; attempt++ {
		refund, err := service.RefundBusinessAccount(ctx, RefundBusinessAccountInput{
			TenantID:       "tenant-commercial-ops",
			PortalUserID:   "user-commercial-ops",
			WorkspaceID:    "workspace-commercial-ops",
			Amount:         10,
			Currency:       "CNY",
			IdempotencyKey: "refund-ops-once",
			Reason:         "customer_refund",
		})
		if err != nil {
			t.Fatalf("RefundBusinessAccount() attempt %d error = %v", attempt, err)
		}
		if refund.Balance != 90 {
			t.Fatalf("refund replay must be idempotent and subtract once: %+v", refund)
		}
	}
	for attempt := 0; attempt < 2; attempt++ {
		adjustment, err := service.AdjustBusinessAccount(ctx, AdjustBusinessAccountInput{
			TenantID:       "tenant-commercial-ops",
			PortalUserID:   "user-commercial-ops",
			WorkspaceID:    "workspace-commercial-ops",
			Amount:         5,
			Currency:       "CNY",
			IdempotencyKey: "adjustment-ops-once",
			Reason:         "admin_adjustment",
		})
		if err != nil {
			t.Fatalf("AdjustBusinessAccount() attempt %d error = %v", attempt, err)
		}
		if adjustment.Balance != 95 {
			t.Fatalf("adjustment replay must be idempotent and add once: %+v", adjustment)
		}
	}
	summary, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: "workspace-commercial-ops"})
	if err != nil {
		t.Fatalf("BillingSummary() error = %v", err)
	}
	assertLedgerEntry(t, summary.Ledger, "refund", 10, "customer_refund")
	assertLedgerEntry(t, summary.Ledger, "adjustment", 5, "admin_adjustment")
}

func TestCommercialBillingRefundCannotOverdrawAvailableBalance(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-commercial-refund",
		PortalUserID: "user-commercial-refund",
		WorkspaceID:  "workspace-commercial-refund",
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if _, err := service.ApproveBusinessAccount(ctx, ApproveBusinessAccountInput{
		TenantID:     "tenant-commercial-refund",
		PortalUserID: "user-commercial-refund",
		WorkspaceID:  "workspace-commercial-refund",
	}); err != nil {
		t.Fatalf("ApproveBusinessAccount() error = %v", err)
	}
	credit, err := service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
		TenantID:       "tenant-commercial-refund",
		PortalUserID:   "user-commercial-refund",
		WorkspaceID:    "workspace-commercial-refund",
		Amount:         10,
		Currency:       "CNY",
		IdempotencyKey: "credit-refund-balance",
	})
	if err != nil {
		t.Fatalf("CreditBusinessAccount() error = %v", err)
	}
	if credit.Balance != 10 {
		t.Fatalf("CreditBusinessAccount() balance = %+v", credit)
	}
	if _, err := service.RefundBusinessAccount(ctx, RefundBusinessAccountInput{
		TenantID:       "tenant-commercial-refund",
		PortalUserID:   "user-commercial-refund",
		WorkspaceID:    "workspace-commercial-refund",
		Amount:         11,
		Currency:       "CNY",
		IdempotencyKey: "refund-overdraw",
		Reason:         "customer_refund",
	}); !errors.Is(err, cpd.ErrInsufficientBalance) {
		t.Fatalf("RefundBusinessAccount(overdraw) error = %v", err)
	}
	events, err := service.store.ListBillingEvents(ctx, "workspace-commercial-refund")
	if err != nil {
		t.Fatalf("ListBillingEvents() error = %v", err)
	}
	for _, event := range events {
		if event.Type == "refund" {
			t.Fatalf("failed refund must not write billing event: %+v", events)
		}
	}
}

func assertLedgerReconciliationID(t *testing.T, ledger []LedgerItem, sourceEventType string, runRef string) {
	t.Helper()
	for _, item := range ledger {
		if item.SourceEventType == sourceEventType && item.RunRef == runRef && item.SourceEventID != "" && item.BillingAttributionID != "" {
			return
		}
	}
	t.Fatalf("ledger missing reconciliation id for source=%s run=%s ledger=%+v", sourceEventType, runRef, ledger)
}

func assertStringPresent(t *testing.T, values []string, expected string) {
	t.Helper()
	for _, value := range values {
		if value == expected {
			return
		}
	}
	t.Fatalf("missing %q in %+v", expected, values)
}

func TestCommercialBillingFreezeClockUsesSevenDayWindow(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	service.now = func() time.Time { return time.Date(2026, 6, 24, 12, 30, 0, 0, time.UTC) }
	launch := prepareFundedRuntime(t, ctx, service, 100)
	freeze, err := service.RuntimeFreeze(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("RuntimeFreeze() error = %v", err)
	}
	if freeze.StartedAt != "2026-06-24T12:30:00Z" || freeze.SettleEligibleAt != "2026-07-01T12:30:00Z" {
		t.Fatalf("freeze seven-day window = %+v", freeze)
	}
}
