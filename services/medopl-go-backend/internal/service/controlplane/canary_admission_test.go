package controlplane

import (
	"context"
	"errors"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func TestServiceCanaryAdmissionAllowsOnlySelectedTenantUserAndAuditsDecision(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore(), WithCanaryAdmission(CanaryAdmissionPolicy{
		Enabled:           true,
		AllowTenants:      []string{"tenant-canary"},
		AllowUsers:        []string{"user-canary"},
		CostCeiling:       1000,
		MonitoringOwner:   "MedOPL Operations",
		RollbackOwner:     "MedOPL Operations",
		DisableCommandRef: "MEDOPL_CANARY_ADMISSION_ENABLED=0",
	}))

	prepareCanaryRuntimePrerequisites(t, ctx, service, "tenant-canary", "user-canary", "workspace-canary")
	launch, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-canary",
		PortalUserID:   "user-canary",
		WorkspaceID:    "workspace-canary",
		IdempotencyKey: "open-selected-canary",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment(selected) error = %v", err)
	}
	if launch.ResourceBindingID == "" {
		t.Fatalf("selected canary launch missing runtime binding: %+v", launch)
	}

	gate, err := service.RuntimeGate(ctx, RuntimeGateInput{
		TenantID:       "tenant-canary",
		PortalUserID:   "user-canary",
		WorkspaceID:    "workspace-canary",
		InvocationMode: "runtime_required",
	})
	if err != nil {
		t.Fatalf("RuntimeGate(selected) error = %v", err)
	}
	if !gate.CanaryAdmission.Allowed || gate.CanaryAdmission.Decision != "allowed" || !gate.ConsumerProjection.RunEnabled {
		t.Fatalf("selected canary runtime gate must allow run path: %+v", gate)
	}
	if gate.CanaryAdmission.TenantScopeHash == "" || gate.CanaryAdmission.UserScopeHash == "" || gate.CanaryAdmission.DisableCommandRef == "" {
		t.Fatalf("selected canary admission receipt fields missing: %+v", gate.CanaryAdmission)
	}

	prepareCanaryRuntimePrerequisites(t, ctx, service, "tenant-other", "user-other", "workspace-other")
	if _, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-other",
		PortalUserID:   "user-other",
		WorkspaceID:    "workspace-other",
		IdempotencyKey: "open-denied-canary",
	}); !errors.Is(err, cpd.ErrCanaryAdmissionDenied) {
		t.Fatalf("OpenManagedEnvironment(denied) error = %v", err)
	}

	deniedGate, err := service.RuntimeGate(ctx, RuntimeGateInput{
		TenantID:       "tenant-other",
		PortalUserID:   "user-other",
		WorkspaceID:    "workspace-other",
		InvocationMode: "runtime_required",
	})
	if err != nil {
		t.Fatalf("RuntimeGate(denied) error = %v", err)
	}
	if deniedGate.Ok || deniedGate.CanaryAdmission.Allowed || deniedGate.NextAction != "canary_admission_required" {
		t.Fatalf("denied canary gate must fail closed before runtime open: %+v", deniedGate)
	}

	assertAuditKind(t, ctx, service, "workspace-canary", cpd.AuditKindCanaryAdmissionEnabled)
	assertAuditKind(t, ctx, service, "workspace-other", cpd.AuditKindCanaryAdmissionDenied)
}

func TestServiceCanaryAdmissionEmergencyDisableBlocksNewRuntimeRequiredButKeepsRelease(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore(), WithCanaryAdmission(CanaryAdmissionPolicy{
		Enabled:       true,
		AllowTenants:  []string{"tenant-canary"},
		AllowUsers:    []string{"user-canary"},
		EmergencyStop: true,
	}))
	prepareCanaryRuntimePrerequisites(t, ctx, service, "tenant-canary", "user-canary", "workspace-canary")

	if _, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-canary",
		PortalUserID:   "user-canary",
		WorkspaceID:    "workspace-canary",
		IdempotencyKey: "open-emergency-disabled",
	}); !errors.Is(err, cpd.ErrCanaryAdmissionDisabled) {
		t.Fatalf("OpenManagedEnvironment(emergency stop) error = %v", err)
	}
	assertAuditKind(t, ctx, service, "workspace-canary", cpd.AuditKindEmergencyStopTriggered)

	openService := NewService(memory.NewControlPlaneStore(), WithCanaryAdmission(CanaryAdmissionPolicy{
		Enabled:      true,
		AllowTenants: []string{"tenant-canary"},
		AllowUsers:   []string{"user-canary"},
	}))
	prepareCanaryRuntimePrerequisites(t, ctx, openService, "tenant-canary", "user-canary", "workspace-canary")
	launch, err := openService.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-canary",
		PortalUserID:   "user-canary",
		WorkspaceID:    "workspace-canary",
		IdempotencyKey: "open-before-disable",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment(before disable) error = %v", err)
	}
	openService.SetCanaryAdmissionPolicy(CanaryAdmissionPolicy{
		Enabled:       true,
		AllowTenants:  []string{"tenant-canary"},
		AllowUsers:    []string{"user-canary"},
		EmergencyStop: true,
	})

	if _, err := openService.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-canary",
		PortalUserID:   "user-canary",
		WorkspaceID:    "workspace-canary",
		IdempotencyKey: "open-after-disable",
	}); !errors.Is(err, cpd.ErrCanaryAdmissionDisabled) {
		t.Fatalf("OpenManagedEnvironment(new after disable) error = %v", err)
	}
	release, err := openService.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-after-disable",
	})
	if err != nil {
		t.Fatalf("Release(after emergency disable) error = %v", err)
	}
	if !release.BillingStopped || release.AuditEvent.Kind != cpd.AuditKindResourceRelease {
		t.Fatalf("release after disable must stop billing and keep release receipt: %+v", release)
	}
	assertAuditKind(t, ctx, openService, "workspace-canary", cpd.AuditKindCanaryAdmissionDisabled)
}

func prepareCanaryRuntimePrerequisites(t *testing.T, ctx context.Context, service *Service, tenantID string, portalUserID string, workspaceID string) {
	t.Helper()
	prepareFundedWorkspace(t, ctx, service, tenantID, portalUserID, workspaceID, 200, workspaceID+"-credit")
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       tenantID,
		PortalUserID:   portalUserID,
		WorkspaceID:    workspaceID,
		RawProviderKey: "selected-canary-provider-key-material-that-must-stay-private",
		IdempotencyKey: workspaceID + "-provider",
	}); err != nil {
		t.Fatalf("BindProviderKey(%s) error = %v", workspaceID, err)
	}
}

func assertAuditKind(t *testing.T, ctx context.Context, service *Service, workspaceID string, kind string) {
	t.Helper()
	audits, err := service.store.ListAuditEvents(ctx, workspaceID)
	if err != nil {
		t.Fatalf("ListAuditEvents(%s) error = %v", workspaceID, err)
	}
	for _, audit := range audits {
		if audit.Kind == kind {
			if audit.ID == "" || audit.Status != "recorded" || audit.IdempotencyKey == "" {
				t.Fatalf("audit %s must be recorded with stable receipt fields: %+v", kind, audit)
			}
			return
		}
	}
	t.Fatalf("audit kind %q missing for workspace %s: %+v", kind, workspaceID, audits)
}
