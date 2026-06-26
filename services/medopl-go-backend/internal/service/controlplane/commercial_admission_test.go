package controlplane

import (
	"context"
	"errors"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func TestServiceCommercialAdmissionRequiresPlatformApprovedAccount(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())

	if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-approval",
		PortalUserID: "user-approval",
		WorkspaceID:  "workspace-approval",
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if _, err := service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
		TenantID:       "tenant-approval",
		PortalUserID:   "user-approval",
		WorkspaceID:    "workspace-approval",
		Amount:         200,
		Currency:       "CNY",
		IdempotencyKey: "credit-before-approval",
	}); err != nil {
		t.Fatalf("CreditBusinessAccount() error = %v", err)
	}
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-approval",
		PortalUserID:   "user-approval",
		WorkspaceID:    "workspace-approval",
		RawProviderKey: "commercial-admission-provider-key-material-that-must-stay-private",
		IdempotencyKey: "provider-before-approval",
	}); err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}

	gate, err := service.RuntimeGate(ctx, RuntimeGateInput{
		TenantID:       "tenant-approval",
		PortalUserID:   "user-approval",
		WorkspaceID:    "workspace-approval",
		InvocationMode: "runtime_required",
		RuntimePlanID:  "starter_2c4g_10gb",
		StoragePlanID:  "workspace_10gb",
	})
	if err != nil {
		t.Fatalf("RuntimeGate(prepared account) error = %v", err)
	}
	if gate.CommercialAdmission.AccountApproved || gate.CommercialAdmission.Allowed || gate.CommercialAdmission.Decision != "blocked" || gate.CommercialAdmission.Reason != "account_not_approved" {
		t.Fatalf("prepared account must be blocked before platform approval: %+v", gate.CommercialAdmission)
	}
	if gate.ActionContract.PrimaryAction.Action != "open_medopl_purchase" || gate.ActionContract.PrimaryAction.Reason != "account_not_approved" {
		t.Fatalf("prepared account action = %+v", gate.ActionContract.PrimaryAction)
	}
	if _, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-approval",
		PortalUserID:   "user-approval",
		WorkspaceID:    "workspace-approval",
		IdempotencyKey: "open-before-approval",
	}); !errors.Is(err, cpd.ErrAccountNotApproved) {
		t.Fatalf("OpenManagedEnvironment(prepared account) error = %v", err)
	}

	approved, err := service.ApproveBusinessAccount(ctx, ApproveBusinessAccountInput{
		TenantID:     "tenant-approval",
		PortalUserID: "user-approval",
		WorkspaceID:  "workspace-approval",
	})
	if err != nil {
		t.Fatalf("ApproveBusinessAccount() error = %v", err)
	}
	if approved.Status != "approved" || approved.Balance != 200 {
		t.Fatalf("ApproveBusinessAccount() = %+v", approved)
	}
	if _, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-approval",
		PortalUserID:   "user-approval",
		WorkspaceID:    "workspace-approval",
		IdempotencyKey: "open-after-approval",
	}); err != nil {
		t.Fatalf("OpenManagedEnvironment(approved account) error = %v", err)
	}
}

func TestServiceRuntimeGateUsesCommercialAdmissionNotSelectedCanaryAllowlist(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())

	prepareCommercialRuntimePrerequisites(t, ctx, service, "tenant-paid", "user-paid", "workspace-paid", 200)
	launch, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-paid",
		PortalUserID:   "user-paid",
		WorkspaceID:    "workspace-paid",
		IdempotencyKey: "open-paid-account",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment(account-approved commercial admission) error = %v", err)
	}
	if launch.ResourceBindingID == "" {
		t.Fatalf("paid account launch missing runtime binding: %+v", launch)
	}

	gate, err := service.RuntimeGate(ctx, RuntimeGateInput{
		TenantID:       "tenant-paid",
		PortalUserID:   "user-paid",
		WorkspaceID:    "workspace-paid",
		InvocationMode: "runtime_required",
	})
	if err != nil {
		t.Fatalf("RuntimeGate(paid account) error = %v", err)
	}
	if !gate.Ok || gate.NextAction != "run_in_opl_webui_with_medopl_runtime" || !gate.ConsumerProjection.RunEnabled {
		t.Fatalf("paid account commercial admission must allow ready runtime path: %+v", gate)
	}
	admission := gate.CommercialAdmission
	if !admission.AccountExists || !admission.AccountApproved || !admission.WorkspaceExists || !admission.ProviderKeyRefExists || !admission.PlanSelected || !admission.BalanceSufficient || !admission.QuotaAvailable || admission.EmergencyPlatformStop || !admission.Allowed {
		t.Fatalf("commercial admission receipt = %+v", admission)
	}
	if admission.Decision != "allowed" || admission.Reason != "runtime_storage_ready" {
		t.Fatalf("commercial admission decision = %+v", admission)
	}
}

func TestServiceRuntimeGateCommercialAdmissionBlocksUnfundedAccountBeforeRuntimeOpen(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-unfunded",
		PortalUserID:   "user-unfunded",
		WorkspaceID:    "workspace-unfunded",
		RawProviderKey: "commercial-admission-provider-key-material-that-must-stay-private",
		IdempotencyKey: "workspace-unfunded-provider",
	}); err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}

	gate, err := service.RuntimeGate(ctx, RuntimeGateInput{
		TenantID:       "tenant-unfunded",
		PortalUserID:   "user-unfunded",
		WorkspaceID:    "workspace-unfunded",
		InvocationMode: "runtime_required",
	})
	if err != nil {
		t.Fatalf("RuntimeGate(unfunded) error = %v", err)
	}
	if gate.CommercialAdmission.AccountExists || gate.CommercialAdmission.BalanceSufficient || gate.CommercialAdmission.Allowed {
		t.Fatalf("unfunded account must be blocked by commercial admission: %+v", gate.CommercialAdmission)
	}
	if gate.CommercialAdmission.Decision != "blocked" || gate.CommercialAdmission.Reason != "account_required" {
		t.Fatalf("unfunded commercial admission decision = %+v", gate.CommercialAdmission)
	}
	if gate.ActionContract.PrimaryAction.Action != "recharge_or_credit_required" {
		t.Fatalf("unfunded runtime_required should return purchase/recharge action: %+v", gate.ActionContract.PrimaryAction)
	}
}

func prepareCommercialRuntimePrerequisites(t *testing.T, ctx context.Context, service *Service, tenantID string, portalUserID string, workspaceID string, amount float64) {
	t.Helper()
	prepareFundedWorkspace(t, ctx, service, tenantID, portalUserID, workspaceID, amount, workspaceID+"-credit")
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       tenantID,
		PortalUserID:   portalUserID,
		WorkspaceID:    workspaceID,
		RawProviderKey: "commercial-admission-provider-key-material-that-must-stay-private",
		IdempotencyKey: workspaceID + "-provider",
	}); err != nil {
		t.Fatalf("BindProviderKey(%s) error = %v", workspaceID, err)
	}
}
