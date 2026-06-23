package postgres

import (
	"context"
	"sync"
	"testing"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

func TestControlPlaneStorePersistsBusinessMetadataAcrossInstances(t *testing.T) {
	db := NewMemoryTestDB(t)
	ctx := context.Background()
	first := NewControlPlaneStore(db)
	second := NewControlPlaneStore(db)
	createdAt := "2026-06-23T01:02:03Z"

	binding := cpd.ProviderBinding{
		TenantID:       "tenant-business-rc",
		PortalUserID:   "user-business-rc",
		WorkspaceID:    "workspace-business-rc",
		ProviderBound:  true,
		ProviderKeyRef: "gflab:workspace-business-rc:provider-ref",
		BoundStatus:    cpd.ProviderBoundStatusActive,
		IdempotencyKey: "bind-business-rc",
		CreatedAt:      createdAt,
	}
	if err := first.SaveProviderBinding(ctx, binding); err != nil {
		t.Fatalf("SaveProviderBinding() error = %v", err)
	}
	gotBinding, err := second.ProviderBindingByWorkspace(ctx, binding.WorkspaceID)
	if err != nil {
		t.Fatalf("ProviderBindingByWorkspace() error = %v", err)
	}
	if gotBinding.ProviderKeyRef != binding.ProviderKeyRef || gotBinding.TenantID != binding.TenantID {
		t.Fatalf("provider binding was not persisted: %#v", gotBinding)
	}

	launch := cpd.LaunchProjection{
		Ok:                true,
		LaunchID:          "launch-business-rc",
		WorkspaceID:       binding.WorkspaceID,
		ResourceBindingID: "binding-business-rc",
		ProviderBound:     true,
		ProviderKeyRef:    binding.ProviderKeyRef,
		LaunchStatus:      cpd.LaunchStatusReady,
		Status:            cpd.LaunchStatusReady,
	}
	if err := first.SaveLaunch(ctx, launch); err != nil {
		t.Fatalf("SaveLaunch() error = %v", err)
	}
	gotLaunch, err := second.LaunchByID(ctx, launch.LaunchID)
	if err != nil {
		t.Fatalf("LaunchByID() error = %v", err)
	}
	if gotLaunch.ResourceBindingID != launch.ResourceBindingID || gotLaunch.ProviderKeyRef != launch.ProviderKeyRef {
		t.Fatalf("launch projection was not persisted: %#v", gotLaunch)
	}

	resource := cpd.ManagedResource{
		TenantID:          binding.TenantID,
		PortalUserID:      binding.PortalUserID,
		WorkspaceID:       binding.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		Status:            cpd.ResourceStatusActive,
		StorageState:      cpd.StorageStatusReady,
		StopBilling:       cpd.BillingState{Status: cpd.BillingStatusActive},
		ReleasePolicy:     cpd.BillingState{Status: cpd.BillingStatusActive},
	}
	if err := first.SaveResource(ctx, resource); err != nil {
		t.Fatalf("SaveResource() error = %v", err)
	}
	gotResource, err := second.ResourceByBinding(ctx, resource.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceByBinding() error = %v", err)
	}
	if gotResource.Status != resource.Status || gotResource.StorageState != resource.StorageState {
		t.Fatalf("resource metadata was not persisted: %#v", gotResource)
	}

	file := cpd.FileRecord{
		FileRef:        "file-business-rc",
		LaunchID:       launch.LaunchID,
		WorkspaceID:    binding.WorkspaceID,
		ProviderKeyRef: binding.ProviderKeyRef,
		Name:           "input.csv",
		RelativePath:   "inputs/input.csv",
		SizeBytes:      123,
		ContentType:    "text/csv",
		Status:         "available",
		CreatedAt:      createdAt,
	}
	if err := first.SaveFile(ctx, file); err != nil {
		t.Fatalf("SaveFile() error = %v", err)
	}
	gotFile, err := second.FileByRef(ctx, file.FileRef)
	if err != nil {
		t.Fatalf("FileByRef() error = %v", err)
	}
	if gotFile.RelativePath != file.RelativePath || gotFile.ProviderKeyRef != file.ProviderKeyRef {
		t.Fatalf("file metadata was not persisted: %#v", gotFile)
	}
	gotFiles, err := second.ListFiles(ctx, binding.WorkspaceID)
	if err != nil {
		t.Fatalf("ListFiles() error = %v", err)
	}
	if len(gotFiles) != 1 || gotFiles[0].FileRef != file.FileRef {
		t.Fatalf("file metadata list was not persisted: %#v", gotFiles)
	}

	run := cpd.RunRecord{
		RunID:          "run-business-rc",
		LaunchID:       launch.LaunchID,
		WorkspaceID:    binding.WorkspaceID,
		ProviderKeyRef: binding.ProviderKeyRef,
		RunRef:         "run-business-rc",
		Status:         "succeeded",
		ToolName:       "analysis",
		Message:        "analyze file",
		FileRefs:       []string{file.FileRef},
		CreatedAt:      createdAt,
	}
	if err := first.SaveRun(ctx, run); err != nil {
		t.Fatalf("SaveRun() error = %v", err)
	}
	gotRun, err := second.RunByID(ctx, run.RunID)
	if err != nil {
		t.Fatalf("RunByID() error = %v", err)
	}
	if len(gotRun.FileRefs) != 1 || gotRun.FileRefs[0] != file.FileRef || gotRun.Message != run.Message {
		t.Fatalf("run metadata was not persisted: %#v", gotRun)
	}
	gotRuns, err := second.ListRuns(ctx, binding.WorkspaceID)
	if err != nil {
		t.Fatalf("ListRuns() error = %v", err)
	}
	if len(gotRuns) != 1 || gotRuns[0].RunID != run.RunID || gotRuns[0].FileRefs[0] != file.FileRef {
		t.Fatalf("run metadata list was not persisted: %#v", gotRuns)
	}

	artifact := cpd.ArtifactRecord{
		ArtifactRef:    "artifact-business-rc",
		RunID:          run.RunID,
		LaunchID:       launch.LaunchID,
		WorkspaceID:    binding.WorkspaceID,
		ProviderKeyRef: binding.ProviderKeyRef,
		Kind:           "outputs",
		Name:           "result.md",
		RelativePath:   "outputs/result.md",
		SizeBytes:      456,
		ContentType:    "text/markdown",
		CreatedAt:      createdAt,
	}
	if err := first.SaveArtifact(ctx, artifact); err != nil {
		t.Fatalf("SaveArtifact() error = %v", err)
	}
	gotArtifact, err := second.ArtifactByRef(ctx, artifact.ArtifactRef)
	if err != nil {
		t.Fatalf("ArtifactByRef() error = %v", err)
	}
	if gotArtifact.RunID != run.RunID || gotArtifact.RelativePath != artifact.RelativePath {
		t.Fatalf("artifact metadata was not persisted: %#v", gotArtifact)
	}
	gotArtifacts, err := second.ListArtifacts(ctx, binding.WorkspaceID)
	if err != nil {
		t.Fatalf("ListArtifacts() error = %v", err)
	}
	if len(gotArtifacts) != 1 || gotArtifacts[0].ArtifactRef != artifact.ArtifactRef {
		t.Fatalf("artifact metadata list was not persisted: %#v", gotArtifacts)
	}

	event := cpd.AuditEvent{
		ID:                "audit-business-rc",
		Kind:              cpd.AuditKindRunSucceeded,
		WorkspaceID:       binding.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		Status:            "recorded",
		IdempotencyKey:    "run-business-rc",
		CreatedAt:         createdAt,
	}
	if err := first.SaveAuditEvent(ctx, event); err != nil {
		t.Fatalf("SaveAuditEvent() error = %v", err)
	}
	gotEvents, err := second.ListAuditEvents(ctx, binding.WorkspaceID)
	if err != nil {
		t.Fatalf("ListAuditEvents() error = %v", err)
	}
	if len(gotEvents) != 1 || gotEvents[0].ID != event.ID {
		t.Fatalf("audit metadata was not persisted: %#v", gotEvents)
	}
}

func TestControlPlaneStorePersistsBusinessAccountAndCreditMetadata(t *testing.T) {
	db := NewMemoryTestDB(t)
	ctx := context.Background()
	first := NewControlPlaneStore(db)
	second := NewControlPlaneStore(db)
	account := cpd.BusinessAccount{
		TenantID:     "tenant-business-rc",
		PortalUserID: "user-business-rc",
		WorkspaceID:  "workspace-business-rc",
		Status:       "prepared",
		CreatedAt:    "2026-06-23T01:02:03Z",
	}
	if err := first.SaveBusinessAccount(ctx, account); err != nil {
		t.Fatalf("SaveBusinessAccount() error = %v", err)
	}
	gotAccount, err := second.BusinessAccountByWorkspace(ctx, account.WorkspaceID)
	if err != nil {
		t.Fatalf("BusinessAccountByWorkspace() error = %v", err)
	}
	if gotAccount.TenantID != account.TenantID || gotAccount.PortalUserID != account.PortalUserID || gotAccount.Status != account.Status {
		t.Fatalf("business account metadata was not persisted: %#v", gotAccount)
	}

	credit := cpd.CreditEvent{
		ID:             "credit-business-rc",
		TenantID:       account.TenantID,
		PortalUserID:   account.PortalUserID,
		WorkspaceID:    account.WorkspaceID,
		Amount:         500,
		Currency:       "CNY",
		IdempotencyKey: "credit-business-rc-once",
		CreatedAt:      account.CreatedAt,
	}
	if err := first.SaveCreditEvent(ctx, credit); err != nil {
		t.Fatalf("SaveCreditEvent() error = %v", err)
	}
	gotCredits, err := second.ListCreditEvents(ctx, account.WorkspaceID)
	if err != nil {
		t.Fatalf("ListCreditEvents() error = %v", err)
	}
	if len(gotCredits) != 1 || gotCredits[0].ID != credit.ID || gotCredits[0].Amount != credit.Amount {
		t.Fatalf("credit metadata was not persisted: %#v", gotCredits)
	}
	gotAccount, err = second.BusinessAccountByWorkspace(ctx, account.WorkspaceID)
	if err != nil {
		t.Fatalf("BusinessAccountByWorkspace() after credit error = %v", err)
	}
	if gotAccount.Balance != credit.Amount || gotAccount.Currency != credit.Currency {
		t.Fatalf("credit balance was not persisted: %#v", gotAccount)
	}
}

func TestControlPlaneStoreCreditEventIsIdempotent(t *testing.T) {
	db := NewMemoryTestDB(t)
	ctx := context.Background()
	store := NewControlPlaneStore(db)
	account := cpd.BusinessAccount{
		TenantID:     "tenant-business-rc",
		PortalUserID: "user-business-rc",
		WorkspaceID:  "workspace-business-rc",
		Status:       "prepared",
		Currency:     "CNY",
		CreatedAt:    "2026-06-23T01:02:03Z",
	}
	if err := store.SaveBusinessAccount(ctx, account); err != nil {
		t.Fatalf("SaveBusinessAccount() error = %v", err)
	}
	credit := cpd.CreditEvent{
		ID:             "credit-business-rc",
		TenantID:       account.TenantID,
		PortalUserID:   account.PortalUserID,
		WorkspaceID:    account.WorkspaceID,
		Amount:         500,
		Currency:       "CNY",
		IdempotencyKey: "credit-business-rc-once",
		CreatedAt:      account.CreatedAt,
	}
	for attempt := 0; attempt < 3; attempt++ {
		if err := store.SaveCreditEvent(ctx, credit); err != nil {
			t.Fatalf("SaveCreditEvent() attempt %d error = %v", attempt, err)
		}
	}
	gotAccount, err := store.BusinessAccountByWorkspace(ctx, account.WorkspaceID)
	if err != nil {
		t.Fatalf("BusinessAccountByWorkspace() error = %v", err)
	}
	if gotAccount.Balance != credit.Amount {
		t.Fatalf("idempotent credit repeated balance = %v, want %v", gotAccount.Balance, credit.Amount)
	}
	gotCredits, err := store.ListCreditEvents(ctx, account.WorkspaceID)
	if err != nil {
		t.Fatalf("ListCreditEvents() error = %v", err)
	}
	if len(gotCredits) != 1 {
		t.Fatalf("idempotent credit events = %d, want 1: %#v", len(gotCredits), gotCredits)
	}
}

func TestControlPlaneStoreCreditEventConcurrentBalanceIsAtomic(t *testing.T) {
	db := NewMemoryTestDB(t)
	ctx := context.Background()
	store := NewControlPlaneStore(db)
	account := cpd.BusinessAccount{
		TenantID:     "tenant-business-rc",
		PortalUserID: "user-business-rc",
		WorkspaceID:  "workspace-business-rc",
		Status:       "prepared",
		Currency:     "CNY",
		CreatedAt:    "2026-06-23T01:02:03Z",
	}
	if err := store.SaveBusinessAccount(ctx, account); err != nil {
		t.Fatalf("SaveBusinessAccount() error = %v", err)
	}
	const workers = 20
	var wg sync.WaitGroup
	errs := make(chan error, workers)
	for index := 0; index < workers; index++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			errs <- store.SaveCreditEvent(ctx, cpd.CreditEvent{
				ID:             "credit-business-rc-" + string(rune('a'+index)),
				TenantID:       account.TenantID,
				PortalUserID:   account.PortalUserID,
				WorkspaceID:    account.WorkspaceID,
				Amount:         10,
				Currency:       "CNY",
				IdempotencyKey: "credit-business-rc-concurrent-" + string(rune('a'+index)),
				CreatedAt:      account.CreatedAt,
			})
		}(index)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("SaveCreditEvent() concurrent error = %v", err)
		}
	}
	gotAccount, err := store.BusinessAccountByWorkspace(ctx, account.WorkspaceID)
	if err != nil {
		t.Fatalf("BusinessAccountByWorkspace() error = %v", err)
	}
	if gotAccount.Balance != workers*10 {
		t.Fatalf("concurrent credit balance = %v, want %v", gotAccount.Balance, workers*10)
	}
	gotCredits, err := store.ListCreditEvents(ctx, account.WorkspaceID)
	if err != nil {
		t.Fatalf("ListCreditEvents() error = %v", err)
	}
	if len(gotCredits) != workers {
		t.Fatalf("concurrent credit events = %d, want %d", len(gotCredits), workers)
	}
}

func TestControlPlaneStorePersistsResourceBindingLifecycle(t *testing.T) {
	db := NewMemoryTestDB(t)
	ctx := context.Background()
	store := NewControlPlaneStore(db)
	createdAt := time.Date(2026, 6, 23, 1, 2, 3, 0, time.UTC)
	releasedAt := createdAt.Add(1 * time.Hour)
	ledger, err := cpd.NewResourceBindingLedger(cpd.ResourceBindingLedgerInput{
		TenantID:             "tenant-business-rc",
		AccountID:            "account-business-rc",
		WorkspaceID:          "workspace-business-rc",
		ResourceBindingID:    "binding-business-rc",
		BillingAttributionID: "billing-business-rc",
		ServerPlanID:         "starter",
		WorkspaceStorageGB:   10,
		CloudProvider:        "tencent",
		Region:               "usw",
		ClusterID:            "cls-business-rc",
		NodePoolID:           "np-business-rc",
		NodePoolName:         "np-business-rc",
		Status:               cpd.ResourceBindingStatusRequested,
		CreatedAt:            createdAt,
		OperationID:          "op-business-rc",
	})
	if err != nil {
		t.Fatalf("NewResourceBindingLedger() error = %v", err)
	}
	if err := store.CreateResourceBindingLedger(ctx, ledger); err != nil {
		t.Fatalf("CreateResourceBindingLedger() error = %v", err)
	}
	if err := store.UpdateResourceBindingNodePool(ctx, ledger.ResourceBindingID, "np-ready-rc", cpd.ResourceBindingStatusReady); err != nil {
		t.Fatalf("UpdateResourceBindingNodePool() error = %v", err)
	}
	if err := store.MarkResourceBindingReleased(ctx, ledger.ResourceBindingID, releasedAt); err != nil {
		t.Fatalf("MarkResourceBindingReleased() error = %v", err)
	}
	got, err := NewControlPlaneStore(db).ResourceBindingLedgerByID(ctx, ledger.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID() error = %v", err)
	}
	if got.Status != cpd.ResourceBindingStatusReleased || got.NodePoolID != "np-ready-rc" || got.ReleasedAt == "" {
		t.Fatalf("ledger lifecycle was not persisted: %#v", got)
	}
}
