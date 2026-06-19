package controlplane

import (
	"context"
	"errors"
	"strings"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

type DestroyStorageInput struct {
	WorkspaceID       string
	ResourceBindingID string
	StorageBindingID  string
	IdempotencyKey    string
}

type StorageDestroyReceipt struct {
	Ok                bool           `json:"ok"`
	StorageDestroyed  bool           `json:"storageDestroyed"`
	BillingStopped    bool           `json:"billingStopped"`
	WorkspaceID       string         `json:"workspaceId"`
	ResourceBindingID string         `json:"resourceBindingId"`
	StorageBindingID  string         `json:"storageBindingId"`
	StorageState      string         `json:"storageState"`
	AuditEvent        cpd.AuditEvent `json:"auditEvent"`
}

func (service *Service) DestroyStorage(ctx context.Context, input DestroyStorageInput) (StorageDestroyReceipt, error) {
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	resourceBindingID := strings.TrimSpace(input.ResourceBindingID)
	storageBindingID := strings.TrimSpace(input.StorageBindingID)
	if workspaceID == "" {
		return StorageDestroyReceipt{}, cpd.ErrWorkspaceRequired
	}
	if resourceBindingID == "" {
		return StorageDestroyReceipt{}, cpd.ErrResourceBindingRequired
	}
	if storageBindingID == "" {
		storageBindingID = "storage-" + shortID(workspaceID+":"+resourceBindingID)
	}
	if strings.TrimSpace(input.IdempotencyKey) == "" {
		return StorageDestroyReceipt{}, cpd.ErrIdempotencyKeyRequired
	}
	resource, err := service.store.ResourceByBinding(ctx, resourceBindingID)
	if errors.Is(err, cprepo.ErrNotFound) {
		return StorageDestroyReceipt{}, cpd.ErrResourceNotFound
	} else if err != nil {
		return StorageDestroyReceipt{}, err
	}
	if resource.WorkspaceID != workspaceID {
		return StorageDestroyReceipt{}, cpd.ErrResourceNotFound
	}
	audit := cpd.AuditEvent{
		ID:                "audit-" + shortID(resourceBindingID+":"+storageBindingID+":"+input.IdempotencyKey),
		Kind:              cpd.AuditKindStorageDestroy,
		WorkspaceID:       workspaceID,
		ResourceBindingID: resourceBindingID,
		Status:            "recorded",
		IdempotencyKey:    strings.TrimSpace(input.IdempotencyKey),
		CreatedAt:         service.now().UTC().Format(time.RFC3339),
	}
	if err := service.store.SaveAuditEvent(ctx, audit); err != nil {
		return StorageDestroyReceipt{}, err
	}
	return StorageDestroyReceipt{
		Ok:                true,
		StorageDestroyed:  true,
		BillingStopped:    true,
		WorkspaceID:       workspaceID,
		ResourceBindingID: resourceBindingID,
		StorageBindingID:  storageBindingID,
		StorageState:      "destroyed",
		AuditEvent:        audit,
	}, nil
}

func storageDestroyReceiptRecorded(ctx context.Context, store cprepo.Store, workspaceID string, resourceBindingID string) bool {
	events, err := store.ListAuditEvents(ctx, workspaceID)
	if err != nil {
		return false
	}
	for _, event := range events {
		if event.Kind == cpd.AuditKindStorageDestroy && event.ResourceBindingID == resourceBindingID {
			return true
		}
	}
	return false
}
