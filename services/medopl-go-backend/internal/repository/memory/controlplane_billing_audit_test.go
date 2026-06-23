package memory

import (
	"context"
	"errors"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

func TestControlPlaneStoreBillingEventsAreIdempotentBySourceEventKey(t *testing.T) {
	ctx := context.Background()
	store := NewControlPlaneStore()
	first := cpd.BillingEvent{
		ID:             "billing-memory-first",
		TenantID:       "tenant-memory-billing",
		WorkspaceID:    "workspace-memory-billing",
		Type:           "debit",
		Status:         "recorded",
		IdempotencyKey: "source-event-memory-once",
		Amount:         1.25,
		Currency:       "CNY",
		SourceEventID:  "source-event-memory-once",
		CreatedAt:      "2026-06-24T02:03:04Z",
	}
	retry := first
	retry.ID = "billing-memory-retry-different-id"

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
		t.Fatalf("billing idempotency retry must keep one event, got %d: %+v", len(events), events)
	}
	if events[0].ID != first.ID || events[0].IdempotencyKey != first.IdempotencyKey {
		t.Fatalf("billing event must retain first source event record: %+v", events[0])
	}
}

func TestControlPlaneStoreBillingEventsRequireIdempotencyKey(t *testing.T) {
	ctx := context.Background()
	store := NewControlPlaneStore()
	event := cpd.BillingEvent{
		ID:          "billing-memory-missing-idempotency",
		TenantID:    "tenant-memory-billing",
		WorkspaceID: "workspace-memory-billing",
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
