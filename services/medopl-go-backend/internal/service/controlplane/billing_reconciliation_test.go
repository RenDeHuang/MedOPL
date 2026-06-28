package controlplane

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func TestServiceBillingDetailsReconcilesStoredRunCosts(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "billing-reconcile.csv",
		RelativePath: "inputs/billing-reconcile.csv",
		ContentType:  "text/csv",
		SizeBytes:    256,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}
	runResult, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "reconcile stored run",
		FileRefs:  []string{fileRef.FileRef},
		ToolName:  "opl-webui-runtime",
		RequestID: "run-billing-reconcile-rc",
	})
	if err != nil {
		t.Fatalf("StartRun() error = %v", err)
	}

	details, err := service.BillingDetails(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingDetails() error = %v", err)
	}
	if len(details.RunCosts) != 1 {
		t.Fatalf("billing details must expose exactly one stored run cost: %+v", details.RunCosts)
	}
	got := details.RunCosts[0]
	if got.TaskRef != runResult.Run.RunRef || got.WorkspaceID != launch.WorkspaceID || got.RunStatus != "succeeded" {
		t.Fatalf("run cost must reconcile to stored run: got=%+v run=%+v launch=%+v", got, runResult.Run, launch)
	}
	if got.CPUCost != 1.25 || got.StorageCost != 0.1 || got.TotalCost != 1.35 {
		t.Fatalf("run cost amount mismatch: %+v", got)
	}
}

func TestServiceBillingLedgerEntriesCarryBusinessReconciliationRefs(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "ledger-reconcile.csv",
		RelativePath: "inputs/ledger-reconcile.csv",
		ContentType:  "text/csv",
		SizeBytes:    512,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}
	runResult, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "reconcile ledger refs",
		FileRefs:  []string{fileRef.FileRef},
		ToolName:  "opl-webui-runtime",
		RequestID: "run-ledger-reconcile-rc",
	})
	if err != nil {
		t.Fatalf("StartRun() error = %v", err)
	}
	release, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-ledger-reconcile-rc",
	})
	if err != nil {
		t.Fatalf("Release() error = %v", err)
	}

	summary, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingSummary() error = %v", err)
	}
	ledger := ledgerAsMaps(t, summary.Ledger)
	assertLedgerReconciliationRef(t, ledger, cpd.AuditKindFileUpload, "workspaceId", launch.WorkspaceID)
	assertLedgerReconciliationRef(t, ledger, cpd.AuditKindFileUpload, "currency", "CNY")
	assertLedgerReconciliationRef(t, ledger, cpd.AuditKindFileUpload, "resourceBindingId", launch.ResourceBindingID)
	assertLedgerReconciliationRef(t, ledger, cpd.AuditKindFileUpload, "fileRef", fileRef.FileRef)
	assertLedgerReconciliationRef(t, ledger, cpd.AuditKindRunSucceeded, "runRef", runResult.Run.RunRef)
	assertLedgerReconciliationRef(t, ledger, cpd.AuditKindArtifactAvailable, "artifactRef", runResult.ArtifactRef)
	assertLedgerReconciliationRef(t, ledger, cpd.AuditKindResourceRelease, "resourceBindingId", release.Resource.ResourceBindingID)
}

func TestServicePersistsBillingEventsForBusinessReceipts(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "billing-events.csv",
		RelativePath: "inputs/billing-events.csv",
		ContentType:  "text/csv",
		SizeBytes:    128,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}
	runResult, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "persist billing events",
		FileRefs:  []string{fileRef.FileRef},
		ToolName:  "opl-webui-runtime",
		RequestID: "run-billing-events-rc",
	})
	if err != nil {
		t.Fatalf("StartRun() error = %v", err)
	}
	release, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-billing-events-rc",
	})
	if err != nil {
		t.Fatalf("Release() error = %v", err)
	}

	events, err := service.store.ListBillingEvents(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListBillingEvents() error = %v", err)
	}
	if len(events) != 6 {
		t.Fatalf("expected commercial hold/file/run/artifact/release/settlement billing events, got %d: %+v", len(events), events)
	}
	assertBillingEvent(t, events, "resource.open", "hold", "", "", "", launch.ResourceBindingID)
	assertBillingEvent(t, events, cpd.AuditKindFileUpload, "hold", fileRef.FileRef, "", "", launch.ResourceBindingID)
	assertBillingEvent(t, events, cpd.AuditKindRunSucceeded, "debit", "", runResult.Run.RunRef, "", launch.ResourceBindingID)
	assertBillingEvent(t, events, cpd.AuditKindArtifactAvailable, "debit", "", "", runResult.ArtifactRef, launch.ResourceBindingID)
	assertBillingEvent(t, events, cpd.AuditKindResourceRelease, "release", "", "", "", release.Resource.ResourceBindingID)
	assertCommercialBillingEvent(t, events, "release", 28.65, "subscription_freeze_release", launch.ResourceBindingID)

	summary, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingSummary() error = %v", err)
	}
	credits, err := service.store.ListCreditEvents(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListCreditEvents() error = %v", err)
	}
	if summary.LedgerCount != len(events)+len(credits) {
		t.Fatalf("summary must read persisted billing and credit ledger count: got=%d want=%d ledger=%+v events=%+v credits=%+v", summary.LedgerCount, len(events)+len(credits), summary.Ledger, events, credits)
	}
}

func TestServiceRecordFileWritesBillingEventWhenLedgerTenantLookupIsUnavailable(t *testing.T) {
	ctx := context.Background()
	store := &ledgerTenantLookupUnavailableStore{Store: memory.NewControlPlaneStore()}
	service := NewService(store)
	launch := bindAndOpen(t, ctx, service)

	first, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "billing-event-writeback.csv",
		RelativePath: "inputs/billing-event-writeback.csv",
		ContentType:  "text/csv",
		SizeBytes:    128,
	})
	if err != nil {
		t.Fatalf("RecordFile(first) error = %v", err)
	}
	second, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "billing-event-writeback.csv",
		RelativePath: "inputs/billing-event-writeback.csv",
		ContentType:  "text/csv",
		SizeBytes:    128,
	})
	if err != nil {
		t.Fatalf("RecordFile(second) error = %v", err)
	}
	if second.FileRef != first.FileRef {
		t.Fatalf("repeated upload must keep stable fileRef: first=%+v second=%+v", first, second)
	}

	events, err := service.store.ListBillingEvents(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListBillingEvents() error = %v", err)
	}
	var fileUploadEvents []cpd.BillingEvent
	for _, event := range events {
		if event.SourceEventType == cpd.AuditKindFileUpload {
			fileUploadEvents = append(fileUploadEvents, event)
		}
	}
	if len(fileUploadEvents) != 1 {
		t.Fatalf("expected exactly one file.upload billing event after retry, got %d: %+v", len(fileUploadEvents), events)
	}
	event := fileUploadEvents[0]
	if event.TenantID != "tenant-v22" || event.WorkspaceID != launch.WorkspaceID || event.ResourceBindingID != launch.ResourceBindingID {
		t.Fatalf("file upload billing event must carry account tenant/workspace/resource identity: %+v launch=%+v", event, launch)
	}
	if event.Type != "hold" || event.Amount != 0.1 || event.FileRef != first.FileRef || event.IdempotencyKey == "" {
		t.Fatalf("file upload billing event mismatch: %+v file=%+v", event, first)
	}
}

func TestServiceRecordFileUsesCanonicalRuntimeTenantForPostgresBillingEvent(t *testing.T) {
	ctx := context.Background()
	store := &postgresBillingTenantFKStore{Store: memory.NewControlPlaneStore(), hideWorkspaceLedgerList: true}
	service := NewService(store)

	prepareFundedWorkspace(t, ctx, service, "tenant-runtime-canonical", "user-billing-fk", "workspace-billing-fk", 200, "credit-billing-fk-once")
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-runtime-canonical",
		PortalUserID:   "user-billing-fk",
		WorkspaceID:    "workspace-billing-fk",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-billing-fk-once",
	}); err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}
	launch, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-runtime-canonical",
		PortalUserID:   "user-billing-fk",
		WorkspaceID:    "workspace-billing-fk",
		IdempotencyKey: "open-billing-fk-once",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment() error = %v", err)
	}
	if err := service.store.SaveBusinessAccount(ctx, cpd.BusinessAccount{
		TenantID:     "tenant-business-account-stale",
		PortalUserID: "user-billing-fk",
		WorkspaceID:  "workspace-billing-fk",
		Status:       "approved",
		Balance:      170,
		Currency:     "CNY",
	}); err != nil {
		t.Fatalf("SaveBusinessAccount(stale tenant) error = %v", err)
	}

	first, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "billing-fk.csv",
		RelativePath: "inputs/billing-fk.csv",
		ContentType:  "text/csv",
		SizeBytes:    128,
	})
	if err != nil {
		t.Fatalf("RecordFile(first) error = %v", err)
	}
	second, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "billing-fk.csv",
		RelativePath: "inputs/billing-fk.csv",
		ContentType:  "text/csv",
		SizeBytes:    128,
	})
	if err != nil {
		t.Fatalf("RecordFile(second) error = %v", err)
	}
	if second.FileRef != first.FileRef {
		t.Fatalf("repeated upload must keep stable fileRef: first=%+v second=%+v", first, second)
	}

	events, err := service.store.ListBillingEvents(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListBillingEvents() error = %v", err)
	}
	var fileUploadEvents []cpd.BillingEvent
	for _, event := range events {
		if event.SourceEventType == cpd.AuditKindFileUpload {
			fileUploadEvents = append(fileUploadEvents, event)
		}
	}
	if len(fileUploadEvents) != 1 {
		t.Fatalf("expected exactly one file.upload billing event after retry, got %d: %+v", len(fileUploadEvents), events)
	}
	event := fileUploadEvents[0]
	if event.TenantID != "tenant-runtime-canonical" || event.WorkspaceID != launch.WorkspaceID || event.ResourceBindingID != launch.ResourceBindingID {
		t.Fatalf("file upload billing event must use canonical runtime tenant/workspace/resource identity: %+v launch=%+v", event, launch)
	}
	if event.Type != "hold" || event.Amount != 0.1 || event.FileRef != first.FileRef || event.IdempotencyKey == "" {
		t.Fatalf("file upload billing event mismatch: %+v file=%+v", event, first)
	}
}

func TestServiceDestroyStorageUsesCollisionResistantBillingEventID(t *testing.T) {
	ctx := context.Background()
	store := &billingEventIDCollisionStore{Store: memory.NewControlPlaneStore()}
	service := NewService(store)
	launch := bindAndOpen(t, ctx, service)

	if _, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-storage-destroy-collision-rc",
	}); err != nil {
		t.Fatalf("Release() error = %v", err)
	}
	destroyIDKey := "destroy-storage-collision-rc"
	storageBindingID := storageBindingIDForLaunch(launch)
	storageAuditID := "audit-" + shortID(launch.ResourceBindingID+":"+storageBindingID+":"+destroyIDKey)
	store.collidingBillingID = "billing-" + shortID(storageAuditID+":"+cpd.AuditKindStorageDestroy)

	if _, err := service.DestroyStorage(ctx, DestroyStorageInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StorageBindingID:  storageBindingID,
		IdempotencyKey:    destroyIDKey,
	}); err != nil {
		t.Fatalf("DestroyStorage() must not collide with historical billing_events.id values: %v", err)
	}

	events, err := service.store.ListBillingEvents(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListBillingEvents() error = %v", err)
	}
	var storageDestroyEvents []cpd.BillingEvent
	for _, event := range events {
		if event.SourceEventType == cpd.AuditKindStorageDestroy {
			storageDestroyEvents = append(storageDestroyEvents, event)
		}
	}
	if len(storageDestroyEvents) != 1 {
		t.Fatalf("expected exactly one storage.destroy billing event, got %d: %+v", len(storageDestroyEvents), events)
	}
	if storageDestroyEvents[0].ID == store.collidingBillingID {
		t.Fatalf("storage destroy billing event must avoid legacy short id collision: %+v legacy=%s", storageDestroyEvents[0], store.collidingBillingID)
	}
}

type ledgerTenantLookupUnavailableStore struct {
	cprepo.Store
}

func (store *ledgerTenantLookupUnavailableStore) ListResourceBindingLedgers(ctx context.Context, workspaceID string) ([]cpd.ResourceBindingLedger, error) {
	return nil, nil
}

type billingEventIDCollisionStore struct {
	cprepo.Store
	collidingBillingID string
}

func (store *billingEventIDCollisionStore) SaveBillingEvent(ctx context.Context, event cpd.BillingEvent) error {
	if store.collidingBillingID != "" && event.ID == store.collidingBillingID {
		return errors.New("billing_events_pkey_violation")
	}
	return store.Store.SaveBillingEvent(ctx, event)
}

type postgresBillingTenantFKStore struct {
	cprepo.Store
	canonicalTenantByWorkspace map[string]string
	hideWorkspaceLedgerList    bool
}

func (store *postgresBillingTenantFKStore) SaveResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error {
	store.noteCanonicalTenant(ledger)
	return store.Store.SaveResourceBindingLedger(ctx, ledger)
}

func (store *postgresBillingTenantFKStore) CreateResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error {
	store.noteCanonicalTenant(ledger)
	return store.Store.CreateResourceBindingLedger(ctx, ledger)
}

func (store *postgresBillingTenantFKStore) SaveBillingEvent(ctx context.Context, event cpd.BillingEvent) error {
	if event.WorkspaceID != "" {
		if want := store.canonicalTenantByWorkspace[event.WorkspaceID]; want != "" && event.TenantID != want {
			return errors.New("billing_events_tenant_fk_violation")
		}
	}
	return store.Store.SaveBillingEvent(ctx, event)
}

func (store *postgresBillingTenantFKStore) ListResourceBindingLedgers(ctx context.Context, workspaceID string) ([]cpd.ResourceBindingLedger, error) {
	if store.hideWorkspaceLedgerList {
		return nil, nil
	}
	return store.Store.ListResourceBindingLedgers(ctx, workspaceID)
}

func (store *postgresBillingTenantFKStore) noteCanonicalTenant(ledger cpd.ResourceBindingLedger) {
	if ledger.WorkspaceID == "" || ledger.TenantID == "" {
		return
	}
	if store.canonicalTenantByWorkspace == nil {
		store.canonicalTenantByWorkspace = make(map[string]string)
	}
	store.canonicalTenantByWorkspace[ledger.WorkspaceID] = ledger.TenantID
}

func ledgerAsMaps(t *testing.T, items []LedgerItem) []map[string]any {
	t.Helper()
	payload, err := json.Marshal(items)
	if err != nil {
		t.Fatalf("marshal ledger items error = %v", err)
	}
	var decoded []map[string]any
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal ledger items error = %v", err)
	}
	return decoded
}

func assertBillingEvent(t *testing.T, events []cpd.BillingEvent, sourceType string, eventType string, fileRef string, runRef string, artifactRef string, resourceBindingID string) {
	t.Helper()
	for _, event := range events {
		if event.SourceEventType != sourceType {
			continue
		}
		if event.Type != eventType || event.FileRef != fileRef || event.RunRef != runRef || event.ArtifactRef != artifactRef || event.ResourceBindingID != resourceBindingID {
			t.Fatalf("billing event mismatch for %s: %+v", sourceType, event)
		}
		return
	}
	t.Fatalf("billing event missing source type %q: %+v", sourceType, events)
}

func assertCommercialBillingEvent(t *testing.T, events []cpd.BillingEvent, eventType string, amount float64, reason string, resourceBindingID string) {
	t.Helper()
	for _, event := range events {
		if event.Type == eventType && event.Amount == amount && event.Reason == reason && event.ResourceBindingID == resourceBindingID {
			return
		}
	}
	t.Fatalf("commercial billing event missing type=%s amount=%v reason=%s resource=%s events=%+v", eventType, amount, reason, resourceBindingID, events)
}

func assertLedgerReconciliationRef(t *testing.T, ledger []map[string]any, eventType string, field string, want string) {
	t.Helper()
	for _, item := range ledger {
		if item["sourceEventType"] == eventType {
			if item[field] != want {
				t.Fatalf("ledger %s.%s = %v, want %s item=%+v ledger=%+v", eventType, field, item[field], want, item, ledger)
			}
			return
		}
	}
	t.Fatalf("ledger missing source event %q: %+v", eventType, ledger)
}
