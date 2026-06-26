package controlplane

import (
	"context"
	"sync"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func TestServiceConcurrentReleaseWritesSingleBillingAuditReceipt(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	results, errs := runConcurrent(8, func(index int) (ReleaseResult, error) {
		return service.Release(ctx, ReleaseInput{
			WorkspaceID:       launch.WorkspaceID,
			ResourceBindingID: launch.ResourceBindingID,
			StopBilling:       true,
			IdempotencyKey:    "release-concurrent-" + string(rune('a'+index)),
		})
	})
	for _, err := range errs {
		if err != nil {
			t.Fatalf("Release(concurrent) error = %v", err)
		}
	}
	if len(results) != 8 {
		t.Fatalf("concurrent release result count = %d", len(results))
	}
	releaseAuditID := results[0].AuditEventID
	for _, result := range results {
		if !result.BillingStopped || result.Status != cpd.ResourceStatusReleased {
			t.Fatalf("concurrent release must stop billing: %+v", result)
		}
		if result.AuditEventID != releaseAuditID {
			t.Fatalf("concurrent release must return one receipt id: first=%s result=%+v", releaseAuditID, result)
		}
	}
	audits, err := service.store.ListAuditEvents(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListAuditEvents() error = %v", err)
	}
	releaseAudits := 0
	for _, audit := range audits {
		if audit.Kind == cpd.AuditKindResourceRelease {
			releaseAudits++
		}
	}
	if releaseAudits != 1 {
		t.Fatalf("concurrent release must write one release audit, got %d: %+v", releaseAudits, audits)
	}
}

func TestServiceConcurrentStorageDestroyWritesSingleReceipt(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)
	release, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-before-concurrent-destroy",
	})
	if err != nil {
		t.Fatalf("Release() error = %v", err)
	}
	storageBindingID := storageBindingIDForLaunch(launch)

	results, errs := runConcurrent(8, func(index int) (StorageDestroyReceipt, error) {
		return service.DestroyStorage(ctx, DestroyStorageInput{
			WorkspaceID:       launch.WorkspaceID,
			ResourceBindingID: launch.ResourceBindingID,
			StorageBindingID:  storageBindingID,
			IdempotencyKey:    "destroy-concurrent-" + string(rune('a'+index)),
		})
	})
	for _, err := range errs {
		if err != nil {
			t.Fatalf("DestroyStorage(concurrent) error = %v", err)
		}
	}
	storageAuditID := results[0].AuditEvent.ID
	for _, result := range results {
		if !result.StorageDestroyed || result.StorageState != cpd.StorageStatusDestroyed {
			t.Fatalf("concurrent storage destroy must keep storage destroyed: %+v", result)
		}
		if result.AuditEvent.ID != storageAuditID {
			t.Fatalf("concurrent storage destroy must return one receipt id: first=%s result=%+v", storageAuditID, result)
		}
	}
	audits, err := service.store.ListAuditEvents(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListAuditEvents() error = %v", err)
	}
	releaseAudits := 0
	destroyAudits := 0
	for _, audit := range audits {
		switch audit.Kind {
		case cpd.AuditKindResourceRelease:
			releaseAudits++
			if audit.ID != release.AuditEventID {
				t.Fatalf("release audit changed after storage destroy: %+v release=%+v", audit, release)
			}
		case cpd.AuditKindStorageDestroy:
			destroyAudits++
		}
	}
	if releaseAudits != 1 || destroyAudits != 1 {
		t.Fatalf("concurrent destroy must keep one release audit and one destroy audit: release=%d destroy=%d audits=%+v", releaseAudits, destroyAudits, audits)
	}
}

func TestServiceConcurrentOpenAndRunKeepSingleRuntimeAndRunLedger(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-v22",
		PortalUserID: "user-v22",
		WorkspaceID:  "workspace-v22",
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if _, err := service.ApproveBusinessAccount(ctx, ApproveBusinessAccountInput{
		TenantID:     "tenant-v22",
		PortalUserID: "user-v22",
		WorkspaceID:  "workspace-v22",
	}); err != nil {
		t.Fatalf("ApproveBusinessAccount() error = %v", err)
	}
	if _, err := service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		Amount:         200,
		Currency:       "CNY",
		IdempotencyKey: "credit-concurrent-open-once",
	}); err != nil {
		t.Fatalf("CreditBusinessAccount() error = %v", err)
	}
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-once",
	}); err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}

	launches, errs := runConcurrent(8, func(index int) (cpd.LaunchProjection, error) {
		return service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
			TenantID:       "tenant-v22",
			PortalUserID:   "user-v22",
			WorkspaceID:    "workspace-v22",
			IdempotencyKey: "open-concurrent-" + string(rune('a'+index)),
		})
	})
	for _, err := range errs {
		if err != nil {
			t.Fatalf("OpenManagedEnvironment(concurrent) error = %v", err)
		}
	}
	launch := launches[0]
	for _, item := range launches {
		if item.ResourceBindingID != launch.ResourceBindingID {
			t.Fatalf("concurrent open must keep one resource binding: first=%+v item=%+v", launch, item)
		}
	}
	ledgers, err := service.store.ListResourceBindingLedgers(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListResourceBindingLedgers() error = %v", err)
	}
	resources, err := service.store.ListResources(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListResources() error = %v", err)
	}
	if len(ledgers) != 1 || len(resources) != 1 {
		t.Fatalf("concurrent open must keep one runtime ledger/resource: ledgers=%+v resources=%+v", ledgers, resources)
	}

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "concurrent-run.csv",
		RelativePath: "inputs/concurrent-run.csv",
		ContentType:  "text/csv",
		SizeBytes:    256,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}
	runs, errs := runConcurrent(8, func(index int) (PublicRunResult, error) {
		return service.StartRun(ctx, StartRunInput{
			LaunchID:  launch.LaunchID,
			Message:   "concurrent same request",
			FileRefs:  []string{fileRef.FileRef},
			ToolName:  "opl-webui-runtime",
			RequestID: "run-concurrent-idempotent",
		})
	})
	for _, err := range errs {
		if err != nil {
			t.Fatalf("StartRun(concurrent) error = %v", err)
		}
	}
	for _, result := range runs {
		if result.Run.RunRef != "run-concurrent-idempotent" || result.ArtifactRef != runs[0].ArtifactRef {
			t.Fatalf("concurrent same request must return stable run/artifact refs: first=%+v result=%+v", runs[0], result)
		}
	}
	billing, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingSummary() error = %v", err)
	}
	if billing.Summary.RunCount != 1 {
		t.Fatalf("concurrent same request must count one completed run: %+v", billing)
	}
}

func runConcurrent[T any](workers int, fn func(index int) (T, error)) ([]T, []error) {
	results := make([]T, workers)
	errs := make([]error, workers)
	var wg sync.WaitGroup
	wg.Add(workers)
	for index := 0; index < workers; index++ {
		go func(index int) {
			defer wg.Done()
			results[index], errs[index] = fn(index)
		}(index)
	}
	wg.Wait()
	return results, errs
}
