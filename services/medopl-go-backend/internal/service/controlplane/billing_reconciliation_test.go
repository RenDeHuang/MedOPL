package controlplane

import (
	"context"
	"encoding/json"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
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
