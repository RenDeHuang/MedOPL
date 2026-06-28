package controlplane

import (
	"context"
	"errors"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

func (service *Service) saveBillingEventForAudit(ctx context.Context, audit cpd.AuditEvent, refs billingEventRefs) error {
	tenantID := refs.TenantID
	billingAttributionID := refs.BillingAttributionID
	if audit.ResourceBindingID != "" {
		ledger, err := service.store.ResourceBindingLedgerByID(ctx, audit.ResourceBindingID)
		if err == nil {
			tenantID = firstNonEmpty(tenantID, ledger.TenantID)
			billingAttributionID = firstNonEmpty(billingAttributionID, ledger.BillingAttributionID)
		} else if !errors.Is(err, cprepo.ErrNotFound) {
			return err
		}
	}
	ledgers, err := service.store.ListResourceBindingLedgers(ctx, audit.WorkspaceID)
	if err != nil {
		return err
	}
	for _, ledger := range ledgers {
		if ledger.ResourceBindingID == audit.ResourceBindingID {
			tenantID = firstNonEmpty(tenantID, ledger.TenantID)
			billingAttributionID = firstNonEmpty(billingAttributionID, ledger.BillingAttributionID)
			break
		}
	}
	if tenantID == "" {
		account, accountErr := service.store.BusinessAccountByWorkspace(ctx, audit.WorkspaceID)
		if accountErr == nil {
			tenantID = firstNonEmpty(account.TenantID)
		}
	}
	if tenantID == "" {
		return cpd.ErrResourceNotFound
	}
	amount := 1.25
	eventType := "debit"
	reason := audit.Kind
	switch audit.Kind {
	case cpd.AuditKindFileUpload:
		eventType = "hold"
		amount = 0.1
	case cpd.AuditKindArtifactAvailable:
		amount = 0
	case cpd.AuditKindResourceRelease, cpd.AuditKindStorageDestroy:
		eventType = "release"
		amount = 0
	}
	return service.store.SaveBillingEvent(ctx, cpd.BillingEvent{
		ID:                   "billing-" + shortID(audit.ID+":"+audit.Kind),
		TenantID:             tenantID,
		WorkspaceID:          audit.WorkspaceID,
		Type:                 eventType,
		Status:               "recorded",
		IdempotencyKey:       audit.ID,
		Amount:               amount,
		Currency:             "CNY",
		Reason:               reason,
		OwnerScope:           "go-control-plane",
		ResourceBindingID:    audit.ResourceBindingID,
		BillingAttributionID: billingAttributionID,
		FileRef:              refs.FileRef,
		RunRef:               refs.RunRef,
		ArtifactRef:          refs.ArtifactRef,
		SourceEventID:        audit.ID,
		SourceEventType:      audit.Kind,
		CreatedAt:            audit.CreatedAt,
	})
}

type billingEventRefs struct {
	TenantID             string
	BillingAttributionID string
	FileRef              string
	RunRef               string
	ArtifactRef          string
}
