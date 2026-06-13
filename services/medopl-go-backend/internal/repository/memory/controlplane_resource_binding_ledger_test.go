package memory

import (
	"context"
	"testing"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
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

func TestControlPlaneStoreWritesResourceBindingLifecycle(t *testing.T) {
	ctx := context.Background()
	store := NewControlPlaneStore()
	base := packageCResourceBindingLedger(t, cpd.ResourceBindingStatusRequested, "")

	assertResourceBindingLifecycleStore(t, ctx, store, base)
}

func TestControlPlaneStoreMarksFailedAndCleanupRequired(t *testing.T) {
	ctx := context.Background()
	store := NewControlPlaneStore()
	base := packageCResourceBindingLedger(t, cpd.ResourceBindingStatusRequested, "")

	if err := store.CreateResourceBindingLedger(ctx, base); err != nil {
		t.Fatalf("CreateResourceBindingLedger() error = %v", err)
	}
	if err := store.MarkResourceBindingFailed(ctx, base.ResourceBindingID); err != nil {
		t.Fatalf("MarkResourceBindingFailed() error = %v", err)
	}
	failed, err := store.ResourceBindingLedgerByID(ctx, base.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID() failed lookup error = %v", err)
	}
	if failed.Status != cpd.ResourceBindingStatusFailed || failed.ReleasedAt != "" {
		t.Fatalf("failed ledger mismatch: %+v", failed)
	}

	if err := store.MarkResourceBindingCleanupRequired(ctx, base.ResourceBindingID); err != nil {
		t.Fatalf("MarkResourceBindingCleanupRequired() error = %v", err)
	}
	cleanup, err := store.ResourceBindingLedgerByID(ctx, base.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID() cleanup lookup error = %v", err)
	}
	if cleanup.Status != cpd.ResourceBindingStatusCleanupRequired || cleanup.NodePoolID != "" {
		t.Fatalf("cleanup ledger mismatch: %+v", cleanup)
	}
}

func assertResourceBindingLifecycleStore(t *testing.T, ctx context.Context, store cprepo.Store, base cpd.ResourceBindingLedger) {
	t.Helper()
	if err := store.CreateResourceBindingLedger(ctx, base); err != nil {
		t.Fatalf("CreateResourceBindingLedger() error = %v", err)
	}

	operation := packageCCloudOperation(t, cpd.ResourceBindingStatusRequested, "")
	if err := store.AppendCloudOperationEvent(ctx, operation); err != nil {
		t.Fatalf("AppendCloudOperationEvent(requested) error = %v", err)
	}

	if err := store.UpdateResourceBindingNodePool(ctx, base.ResourceBindingID, "np-tenant-proof", cpd.ResourceBindingStatusCreated); err != nil {
		t.Fatalf("UpdateResourceBindingNodePool() error = %v", err)
	}
	created, err := store.ResourceBindingLedgerByID(ctx, base.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID() created lookup error = %v", err)
	}
	if created.NodePoolID != "np-tenant-proof" || created.Status != cpd.ResourceBindingStatusCreated {
		t.Fatalf("created ledger mismatch: %+v", created)
	}

	readyOperation := packageCCloudOperation(t, cpd.ResourceBindingStatusReady, "np-tenant-proof")
	if err := store.AppendCloudOperationEvent(ctx, readyOperation); err != nil {
		t.Fatalf("AppendCloudOperationEvent(ready) error = %v", err)
	}
	if err := store.UpdateResourceBindingStatus(ctx, base.ResourceBindingID, cpd.ResourceBindingStatusReady); err != nil {
		t.Fatalf("UpdateResourceBindingStatus(ready) error = %v", err)
	}
	ready, err := store.ResourceBindingLedgerByID(ctx, base.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID() ready lookup error = %v", err)
	}
	if ready.Status != cpd.ResourceBindingStatusReady || ready.NodePoolID != "np-tenant-proof" {
		t.Fatalf("ready ledger mismatch: %+v", ready)
	}

	releasedAt := time.Date(2026, 6, 13, 12, 5, 0, 0, time.UTC)
	if err := store.MarkResourceBindingReleased(ctx, base.ResourceBindingID, releasedAt); err != nil {
		t.Fatalf("MarkResourceBindingReleased() error = %v", err)
	}
	released, err := store.ResourceBindingLedgerByID(ctx, base.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID() released lookup error = %v", err)
	}
	if released.Status != cpd.ResourceBindingStatusReleased || released.ReleasedAt != "2026-06-13T12:05:00Z" {
		t.Fatalf("released ledger mismatch: %+v", released)
	}

	gotOperation, err := store.CloudOperationByID(ctx, operation.OperationID)
	if err != nil {
		t.Fatalf("CloudOperationByID() error = %v", err)
	}
	if gotOperation.Status != cpd.ResourceBindingStatusReleased || gotOperation.NodePoolID != "np-tenant-proof" {
		t.Fatalf("cloud operation mismatch: %+v", gotOperation)
	}
}

func packageCResourceBindingLedger(t *testing.T, status string, nodePoolID string) cpd.ResourceBindingLedger {
	t.Helper()
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
		NodePoolID:           nodePoolID,
		NodePoolName:         "medopl-tenant-rb-package-c-live-canary-20260613",
		Status:               status,
		OperationID:          "op-package-c-live-canary-live-proof",
		CreatedAt:            time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("NewResourceBindingLedger() error = %v", err)
	}
	return ledger
}

func packageCCloudOperation(t *testing.T, status string, nodePoolID string) cpd.CloudOperation {
	t.Helper()
	operation, err := cpd.NewCloudOperation(cpd.CloudOperationInput{
		OperationID:          "op-package-c-live-canary-live-proof",
		ResourceBindingID:    "rb-package-c-live-canary-20260613",
		TenantID:             "tenant-canary-package-c",
		AccountID:            "acct-canary-package-c",
		WorkspaceID:          "ws-canary-package-c",
		BillingAttributionID: "ba-package-c-live-canary-20260613",
		OperationType:        cpd.CloudOperationTypeCreateReleaseCanary,
		ServerPlanID:         "starter_2c4g_10gb",
		WorkspaceStorageGB:   10,
		Status:               status,
		CloudProvider:        "tencent",
		Region:               "na-siliconvalley",
		ClusterID:            "cls-fi097sy4",
		NodePoolID:           nodePoolID,
		NodePoolName:         "medopl-tenant-rb-package-c-live-canary-20260613",
		CloudTagSupport:      cpd.CloudTagSupportTKENodePool,
		CreatedAt:            time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("NewCloudOperation() error = %v", err)
	}
	return operation
}
