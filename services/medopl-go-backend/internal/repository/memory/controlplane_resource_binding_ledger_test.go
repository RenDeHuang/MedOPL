package memory

import (
	"context"
	"testing"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

func TestControlPlaneStorePersistsResourceBindingLedgerByCanonicalBindingID(t *testing.T) {
	ctx := context.Background()
	store := NewControlPlaneStore()
	createdAt := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	ledger, err := cpd.NewResourceBindingLedger(cpd.ResourceBindingLedgerInput{
		TenantID:             "tenant-canary-package-c",
		AccountID:            "acct-canary-package-c",
		WorkspaceID:          "ws-canary-package-c",
		ResourceBindingID:    "rb-package-c-live-canary-20260613",
		BillingAttributionID: "ba-package-c-live-canary-20260613",
		ServerPlanID:         "starter_2c4g_10gb",
		WorkspaceStorageGB:   10,
		CloudProvider:        "tencent",
		Region:               "na-siliconvalley",
		ClusterID:            "cls-fi097sy4",
		NodePoolID:           "np-h0w4d9jo",
		NodePoolName:         "medopl-tenant-rb-package-c-live-canary-20260613",
		Status:               cpd.ResourceBindingStatusReady,
		OperationID:          "op-package-c-live-canary-live-full-lifecycle-2026-06-13",
		CreatedAt:            createdAt,
	})
	if err != nil {
		t.Fatalf("NewResourceBindingLedger() error = %v", err)
	}

	if err := store.SaveResourceBindingLedger(ctx, ledger); err != nil {
		t.Fatalf("SaveResourceBindingLedger() error = %v", err)
	}

	got, err := store.ResourceBindingLedgerByID(ctx, "rb-package-c-live-canary-20260613")
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID() error = %v", err)
	}
	if got.NodePoolID != "np-h0w4d9jo" || got.CanonicalOwnershipSource != "postgres_resource_binding_ledger" {
		t.Fatalf("ledger mismatch: %+v", got)
	}

	items, err := store.ListResourceBindingLedgers(ctx, "ws-canary-package-c")
	if err != nil {
		t.Fatalf("ListResourceBindingLedgers() error = %v", err)
	}
	if len(items) != 1 || items[0].ResourceBindingID != got.ResourceBindingID {
		t.Fatalf("workspace scoped ledgers = %+v", items)
	}
}

func TestControlPlaneStorePersistsCloudOperationByOperationID(t *testing.T) {
	ctx := context.Background()
	store := NewControlPlaneStore()
	createdAt := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	operation, err := cpd.NewCloudOperation(cpd.CloudOperationInput{
		OperationID:          "op-package-c-live-canary-live-full-lifecycle-2026-06-13",
		ResourceBindingID:    "rb-package-c-live-canary-20260613",
		TenantID:             "tenant-canary-package-c",
		AccountID:            "acct-canary-package-c",
		WorkspaceID:          "ws-canary-package-c",
		BillingAttributionID: "ba-package-c-live-canary-20260613",
		OperationType:        cpd.CloudOperationTypeCreateReleaseCanary,
		ServerPlanID:         "starter_2c4g_10gb",
		WorkspaceStorageGB:   10,
		Status:               cpd.ResourceBindingStatusReleased,
		CloudProvider:        "tencent",
		Region:               "na-siliconvalley",
		ClusterID:            "cls-fi097sy4",
		NodePoolID:           "np-h0w4d9jo",
		NodePoolName:         "medopl-tenant-rb-package-c-live-canary-20260613",
		CloudTagSupport:      "tke_nodepool_unsupported",
		CreatedAt:            createdAt,
		CompletedAt:          createdAt.Add(5 * time.Minute),
	})
	if err != nil {
		t.Fatalf("NewCloudOperation() error = %v", err)
	}

	if err := store.SaveCloudOperation(ctx, operation); err != nil {
		t.Fatalf("SaveCloudOperation() error = %v", err)
	}

	got, err := store.CloudOperationByID(ctx, operation.OperationID)
	if err != nil {
		t.Fatalf("CloudOperationByID() error = %v", err)
	}
	if got.Status != cpd.ResourceBindingStatusReleased || got.CloudTagSupport != "tke_nodepool_unsupported" {
		t.Fatalf("operation mismatch: %+v", got)
	}
}
