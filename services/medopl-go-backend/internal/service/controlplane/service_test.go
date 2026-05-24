package controlplane

import (
	"context"
	"errors"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func TestServiceBindsProviderKeyThenOpensLaunchAndBootstrap(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())

	binding, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-once",
	})
	if err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}
	if !binding.ProviderBound || binding.ProviderKeyRef == "" {
		t.Fatalf("binding = %+v", binding)
	}

	preflight, err := service.Preflight(ctx, WorkspaceInput{WorkspaceID: "workspace-v22"})
	if err != nil {
		t.Fatalf("Preflight() error = %v", err)
	}
	if !preflight.Ok || !preflight.ReadyForManagedEnvironment {
		t.Fatalf("preflight = %+v", preflight)
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
	if launch.LaunchStatus != cpd.LaunchStatusReady || launch.ProviderKeyRef != binding.ProviderKeyRef {
		t.Fatalf("launch = %+v", launch)
	}

	bootstrap, err := service.Bootstrap(ctx, LaunchLookupInput{LaunchID: launch.LaunchID})
	if err != nil {
		t.Fatalf("Bootstrap() error = %v", err)
	}
	if bootstrap.Identity.RuntimeSessionID != launch.RuntimeSessionID || bootstrap.Identity.OPLSessionID != launch.OPLSessionID {
		t.Fatalf("bootstrap = %+v", bootstrap)
	}
}

func TestServiceFailsClosedWithoutProviderKey(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())

	preflight, err := service.Preflight(ctx, WorkspaceInput{WorkspaceID: "workspace-v22"})
	if err != nil {
		t.Fatalf("Preflight() error = %v", err)
	}
	if preflight.Ok || preflight.Error != "provider_key_required" {
		t.Fatalf("preflight = %+v", preflight)
	}

	if _, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		IdempotencyKey: "open-once",
	}); !errors.Is(err, cpd.ErrProviderKeyRequired) {
		t.Fatalf("OpenManagedEnvironment() error = %v", err)
	}
}

func TestServiceRecordsFileRunArtifactBillingAuditAndRelease(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "measurements.csv",
		RelativePath: "inputs/measurements.csv",
		ContentType:  "text/csv",
		SizeBytes:    128,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}
	if fileRef.FileRef == "" || fileRef.ProviderKeyRef != launch.ProviderKeyRef {
		t.Fatalf("file ref = %+v", fileRef)
	}

	runResult, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "analyze file",
		FileRefs:  []string{fileRef.FileRef},
		ToolName:  "opl-workbench",
		RequestID: "run-v22",
	})
	if err != nil {
		t.Fatalf("StartRun() error = %v", err)
	}
	if runResult.Run.Status != "succeeded" || len(runResult.Artifacts) != 1 {
		t.Fatalf("run result = %+v", runResult)
	}

	billing, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: "workspace-v22"})
	if err != nil {
		t.Fatalf("BillingSummary() error = %v", err)
	}
	if billing.Wallet.Balance <= 0 || billing.Summary.RunCount != 1 || len(billing.Ledger) == 0 {
		t.Fatalf("billing = %+v", billing)
	}

	resources, err := service.Resources(ctx, WorkspaceInput{WorkspaceID: "workspace-v22"})
	if err != nil {
		t.Fatalf("Resources() error = %v", err)
	}
	if len(resources.Items) != 1 || resources.Summary.ActiveEnvironments != 1 {
		t.Fatalf("resources = %+v", resources)
	}

	release, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-once",
	})
	if err != nil {
		t.Fatalf("Release() error = %v", err)
	}
	if !release.BillingStopped || release.Resource.StopBilling.Status != cpd.BillingStatusStopped {
		t.Fatalf("release = %+v", release)
	}
}

func TestServiceResourcesAreWorkspaceScopedAndReleaseFailsClosedWhenMissing(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	workspaceLaunch := bindAndOpen(t, ctx, service)
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-other",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-other-once",
	}); err != nil {
		t.Fatalf("BindProviderKey(other) error = %v", err)
	}
	if _, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-other",
		IdempotencyKey: "open-other-once",
	}); err != nil {
		t.Fatalf("OpenManagedEnvironment(other) error = %v", err)
	}

	resources, err := service.Resources(ctx, WorkspaceInput{WorkspaceID: "workspace-v22"})
	if err != nil {
		t.Fatalf("Resources() error = %v", err)
	}
	if len(resources.Items) != 1 || resources.Items[0].WorkspaceID != "workspace-v22" || resources.Items[0].ResourceBindingID != workspaceLaunch.ResourceBindingID {
		t.Fatalf("workspace scoped resources = %+v", resources.Items)
	}

	if _, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: "missing-binding",
		StopBilling:       true,
		IdempotencyKey:    "release-missing-once",
	}); !errors.Is(err, cpd.ErrResourceNotFound) {
		t.Fatalf("Release(missing) error = %v", err)
	}

	if _, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       "workspace-other",
		ResourceBindingID: workspaceLaunch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-wrong-workspace-once",
	}); !errors.Is(err, cpd.ErrResourceNotFound) {
		t.Fatalf("Release(wrong workspace) error = %v", err)
	}
}

func bindAndOpen(t *testing.T, ctx context.Context, service *Service) cpd.LaunchProjection {
	t.Helper()
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
