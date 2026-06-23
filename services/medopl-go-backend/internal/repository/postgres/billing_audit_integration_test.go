package postgres

import (
	"context"
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
