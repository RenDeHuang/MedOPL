package controlplane

import (
	"context"
	"errors"
	"strings"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

type ReleaseInput struct {
	WorkspaceID       string
	ResourceBindingID string
	StopBilling       bool
	IdempotencyKey    string
}

type ReleaseResult struct {
	Ok             bool                `json:"ok"`
	Status         string              `json:"status"`
	BillingStopped bool                `json:"billingStopped"`
	Resource       cpd.ManagedResource `json:"resource"`
	AuditEvent     cpd.AuditEvent      `json:"auditEvent"`
	Receipts       ReleaseReceipts     `json:"receipts"`
}

type ReleaseReceipts struct {
	RuntimeStopped        string `json:"runtimeStopped"`
	FileExportStatus      string `json:"fileExportStatus"`
	BillingSettlement     string `json:"billingSettlement"`
	AuditExportRef        string `json:"auditExportRef"`
	ResourceCleanupRef    string `json:"resourceCleanupRef"`
	StorageDestroyReceipt string `json:"storageDestroyReceipt"`
}

func (service *Service) Release(ctx context.Context, input ReleaseInput) (ReleaseResult, error) {
	resource, err := service.store.ResourceByBinding(ctx, strings.TrimSpace(input.ResourceBindingID))
	if errors.Is(err, cprepo.ErrNotFound) {
		return ReleaseResult{}, cpd.ErrResourceNotFound
	} else if err != nil {
		return ReleaseResult{}, err
	}
	if resource.WorkspaceID != strings.TrimSpace(input.WorkspaceID) {
		return ReleaseResult{}, cpd.ErrResourceNotFound
	}
	released, audit, err := cpd.ReleaseManagedResource(resource, cpd.ReleaseInput{
		WorkspaceID:       input.WorkspaceID,
		ResourceBindingID: input.ResourceBindingID,
		StopBilling:       input.StopBilling,
		IdempotencyKey:    input.IdempotencyKey,
		ReleasedAt:        service.now(),
	})
	if err != nil {
		return ReleaseResult{}, err
	}
	if err := service.store.SaveResource(ctx, released); err != nil {
		return ReleaseResult{}, err
	}
	if err := service.store.SaveAuditEvent(ctx, audit); err != nil {
		return ReleaseResult{}, err
	}
	return ReleaseResult{
		Ok:             true,
		Status:         released.Status,
		BillingStopped: released.StopBilling.Status == cpd.BillingStatusStopped,
		Resource:       released,
		AuditEvent:     audit,
		Receipts:       releaseReceipts(released, audit, false),
	}, nil
}

func releaseReceipts(resource cpd.ManagedResource, audit cpd.AuditEvent, storageDestroyed bool) ReleaseReceipts {
	storageDestroyReceipt := "pending_explicit_user_intent"
	if storageDestroyed {
		storageDestroyReceipt = "recorded"
	}
	return ReleaseReceipts{
		RuntimeStopped:        "recorded",
		FileExportStatus:      "retained",
		BillingSettlement:     resource.StopBilling.Status,
		AuditExportRef:        audit.ID,
		ResourceCleanupRef:    resource.ResourceBindingID,
		StorageDestroyReceipt: storageDestroyReceipt,
	}
}
