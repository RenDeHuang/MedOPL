package postgres

import (
	"context"
	"errors"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

func TestBillingAuditUsesTypedPostgresBackend(t *testing.T) {
	ctx := context.Background()
	db := newTypedBillingAuditTestDB(t)
	first := NewControlPlaneStore(db)
	second := NewControlPlaneStore(db)

	audit := cpd.AuditEvent{
		ID:                "audit-typed-billing-rc",
		Kind:              cpd.AuditKindRunSucceeded,
		WorkspaceID:       "workspace-billing-audit-rc",
		ResourceBindingID: "binding-billing-audit-rc",
		Status:            "recorded",
		IdempotencyKey:    "run-billing-audit-rc",
		CreatedAt:         "2026-06-24T02:03:04Z",
	}
	if err := first.SaveAuditEvent(ctx, audit); err != nil {
		t.Fatalf("SaveAuditEvent() error = %v", err)
	}

	billing := cpd.BillingEvent{
		ID:                   "billing-typed-billing-rc",
		TenantID:             "tenant-billing-audit-rc",
		WorkspaceID:          audit.WorkspaceID,
		Type:                 "debit",
		Status:               "recorded",
		IdempotencyKey:       audit.ID,
		Amount:               1.25,
		Currency:             "CNY",
		Reason:               "run_succeeded",
		OwnerScope:           "go-control-plane",
		ResourceBindingID:    audit.ResourceBindingID,
		BillingAttributionID: "billing-attr-billing-audit-rc",
		RunRef:               audit.IdempotencyKey,
		SourceEventID:        audit.ID,
		SourceEventType:      audit.Kind,
		CreatedAt:            audit.CreatedAt,
	}
	if err := first.SaveBillingEvent(ctx, billing); err != nil {
		t.Fatalf("SaveBillingEvent() error = %v", err)
	}

	if db.genericWriteCount != 0 {
		t.Fatalf("typed billing/audit metadata must not fall back to generic control_plane_records writes; got %d", db.genericWriteCount)
	}

	audits, err := second.ListAuditEvents(ctx, audit.WorkspaceID)
	if err != nil {
		t.Fatalf("ListAuditEvents() error = %v", err)
	}
	if len(audits) != 1 || audits[0].ID != audit.ID || audits[0].ResourceBindingID != audit.ResourceBindingID {
		t.Fatalf("typed audit receipt did not survive backend restart: %+v", audits)
	}
	billingEvents, err := second.ListBillingEvents(ctx, audit.WorkspaceID)
	if err != nil {
		t.Fatalf("ListBillingEvents() error = %v", err)
	}
	if len(billingEvents) != 1 || billingEvents[0].SourceEventID != audit.ID || billingEvents[0].RunRef != audit.IdempotencyKey {
		t.Fatalf("typed billing event did not retain audit/run reconciliation refs: %+v", billingEvents)
	}
}

func TestBillingEventRequiresIdempotencyKey(t *testing.T) {
	ctx := context.Background()
	db := newTypedBillingAuditTestDB(t)
	store := NewControlPlaneStore(db)
	event := cpd.BillingEvent{
		ID:          "billing-missing-idempotency-key",
		TenantID:    "tenant-billing-idempotency-required",
		WorkspaceID: "workspace-billing-idempotency-required",
		Type:        "debit",
		Status:      "recorded",
		Amount:      1.25,
		Currency:    "CNY",
		CreatedAt:   "2026-06-24T02:03:04Z",
	}

	if err := store.SaveBillingEvent(ctx, event); !errors.Is(err, cpd.ErrIdempotencyKeyRequired) {
		t.Fatalf("SaveBillingEvent() error = %v, want %v", err, cpd.ErrIdempotencyKeyRequired)
	}
}

func TestBillingEventUpsertIsIdempotentBySourceEventKey(t *testing.T) {
	ctx := context.Background()
	db := newTypedBillingAuditTestDB(t)
	store := NewControlPlaneStore(db)
	first := cpd.BillingEvent{
		ID:                   "billing-source-event-first",
		TenantID:             "tenant-billing-idempotency-rc",
		WorkspaceID:          "workspace-billing-idempotency-rc",
		Type:                 "debit",
		Status:               "recorded",
		IdempotencyKey:       "audit-source-event-once",
		Amount:               1.25,
		Currency:             "CNY",
		Reason:               "run_succeeded",
		OwnerScope:           "go-control-plane",
		ResourceBindingID:    "binding-billing-idempotency-rc",
		BillingAttributionID: "billing-attr-idempotency-rc",
		RunRef:               "run-billing-idempotency-rc",
		SourceEventID:        "audit-source-event-once",
		SourceEventType:      cpd.AuditKindRunSucceeded,
		CreatedAt:            "2026-06-24T02:03:04Z",
	}
	second := first
	second.ID = "billing-source-event-retry-different-id"

	if err := store.SaveBillingEvent(ctx, first); err != nil {
		t.Fatalf("SaveBillingEvent(first) error = %v", err)
	}
	if err := store.SaveBillingEvent(ctx, second); err != nil {
		t.Fatalf("SaveBillingEvent(retry) error = %v", err)
	}
	events, err := store.ListBillingEvents(ctx, first.WorkspaceID)
	if err != nil {
		t.Fatalf("ListBillingEvents() error = %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("billing idempotency key retry must keep one event, got %d: %+v", len(events), events)
	}
	if events[0].IdempotencyKey != first.IdempotencyKey || events[0].SourceEventID != first.SourceEventID {
		t.Fatalf("billing event must retain source event idempotency refs: %+v", events[0])
	}
}

func TestBillingEventWritebackFromFileUploadIsIdempotent(t *testing.T) {
	ctx := context.Background()
	db := newTypedBillingAuditTestDB(t)
	store := NewControlPlaneStore(db)
	first := cpd.BillingEvent{
		ID:                   "billing-file-upload-first",
		TenantID:             "tenant-file-upload-billing-rc",
		WorkspaceID:          "workspace-file-upload-billing-rc",
		Type:                 "hold",
		Status:               "recorded",
		IdempotencyKey:       "audit-file-upload-once",
		Amount:               0.1,
		Currency:             "CNY",
		Reason:               cpd.AuditKindFileUpload,
		OwnerScope:           "go-control-plane",
		ResourceBindingID:    "binding-file-upload-billing-rc",
		BillingAttributionID: "billing-attr-file-upload-rc",
		FileRef:              "file-upload-billing-rc",
		SourceEventID:        "audit-file-upload-once",
		SourceEventType:      cpd.AuditKindFileUpload,
		CreatedAt:            "2026-06-24T02:03:04Z",
	}
	retry := first
	retry.ID = "billing-file-upload-retry"

	if err := store.SaveBillingEvent(ctx, first); err != nil {
		t.Fatalf("SaveBillingEvent(first) error = %v", err)
	}
	if err := store.SaveBillingEvent(ctx, retry); err != nil {
		t.Fatalf("SaveBillingEvent(retry) error = %v", err)
	}
	events, err := store.ListBillingEvents(ctx, first.WorkspaceID)
	if err != nil {
		t.Fatalf("ListBillingEvents() error = %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("file upload billing event retry must keep one event, got %d: %+v", len(events), events)
	}
	event := events[0]
	if event.TenantID != first.TenantID || event.SourceEventType != cpd.AuditKindFileUpload || event.FileRef != first.FileRef {
		t.Fatalf("file upload billing event must retain tenant/source/file refs: %+v", event)
	}
	if event.Type != "hold" || event.Amount != 0.1 || event.IdempotencyKey != first.IdempotencyKey {
		t.Fatalf("file upload billing event must keep hold/idempotency semantics: %+v", event)
	}
}
