package controlplane

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

const rawProviderKey = "local-rc-provider-key-material-that-must-stay-private"

func TestBindProviderKeyReturnsOnlyProviderKeyRef(t *testing.T) {
	binding, err := NewProviderBinding(BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RawProviderKey: rawProviderKey,
		IdempotencyKey: "bind-provider-key-once",
	})
	if err != nil {
		t.Fatalf("NewProviderBinding() error = %v", err)
	}

	if binding.ProviderKeyRef == "" {
		t.Fatal("ProviderKeyRef must be public and stable")
	}
	if strings.Contains(binding.ProviderKeyRef, rawProviderKey) {
		t.Fatal("providerKeyRef must not contain raw provider key")
	}
	assertPublicJSONDoesNotLeak(t, binding)
}

func TestPreflightFailsClosedUntilProviderKeyBound(t *testing.T) {
	result := Preflight(PreflightInput{WorkspaceID: "workspace-v22"})

	if result.Ok {
		t.Fatalf("preflight without binding should fail closed: %+v", result)
	}
	if result.Error != "provider_key_required" || result.LaunchStatus != "blocked_by_provider_key" {
		t.Fatalf("unexpected preflight result: %+v", result)
	}
}

func TestPreflightAllowsManagedEnvironmentWhenProviderKeyBound(t *testing.T) {
	binding, err := NewProviderBinding(BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RawProviderKey: rawProviderKey,
		IdempotencyKey: "bind-provider-key-once",
	})
	if err != nil {
		t.Fatalf("NewProviderBinding() error = %v", err)
	}

	result := Preflight(PreflightInput{WorkspaceID: "workspace-v22", Binding: binding})

	if !result.Ok || !result.ProviderBound || !result.ReadyForManagedEnvironment {
		t.Fatalf("unexpected preflight result: %+v", result)
	}
	if result.ProviderKeyRef != binding.ProviderKeyRef || result.LaunchStatus != "ready_for_launch" {
		t.Fatalf("unexpected public projection: %+v", result)
	}
	assertPublicJSONDoesNotLeak(t, result)
}

func TestLaunchProjectionUsesGatewayBoundaryWithoutSecretFields(t *testing.T) {
	binding, err := NewProviderBinding(BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RawProviderKey: rawProviderKey,
		IdempotencyKey: "bind-provider-key-once",
	})
	if err != nil {
		t.Fatalf("NewProviderBinding() error = %v", err)
	}

	launch, err := NewLaunch(LaunchInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		Binding:        binding,
		IdempotencyKey: "launch-once",
	})
	if err != nil {
		t.Fatalf("NewLaunch() error = %v", err)
	}

	if launch.LaunchID == "" || launch.RuntimeSessionID == "" || launch.OPLSessionID == "" {
		t.Fatalf("launch projection missing ids: %+v", launch)
	}
	if launch.ProviderKeyRef != binding.ProviderKeyRef {
		t.Fatalf("providerKeyRef = %q", launch.ProviderKeyRef)
	}
	if launch.LaunchStatus != LaunchStatusReady || !launch.GatewayReady {
		t.Fatalf("launch status = %+v", launch)
	}
	assertPublicJSONDoesNotLeak(t, launch)
}

func TestReleaseStopsBillingAndKeepsHistoryAuditable(t *testing.T) {
	resource := NewManagedResource(ResourceInput{
		TenantID:          "tenant-v22",
		PortalUserID:      "user-v22",
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: "binding-v22",
	})

	released, auditEvent, err := ReleaseManagedResource(resource, ReleaseInput{
		StopBilling:    true,
		IdempotencyKey: "release-once",
	})
	if err != nil {
		t.Fatalf("ReleaseManagedResource() error = %v", err)
	}

	if released.Status != ResourceStatusReleased || released.StopBilling.Status != BillingStatusStopped {
		t.Fatalf("release projection = %+v", released)
	}
	if auditEvent.Kind != AuditKindResourceRelease || auditEvent.Status != "recorded" {
		t.Fatalf("audit event = %+v", auditEvent)
	}
	assertPublicJSONDoesNotLeak(t, released)
	assertPublicJSONDoesNotLeak(t, auditEvent)
}

func TestResourceBindingLedgerRecordsPackageCTenantNodePoolTruth(t *testing.T) {
	createdAt := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	ledger, err := NewResourceBindingLedger(ResourceBindingLedgerInput{
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
		Status:               ResourceBindingStatusReady,
		OperationID:          "op-package-c-live-canary-live-full-lifecycle-2026-06-13",
		CreatedAt:            createdAt,
	})
	if err != nil {
		t.Fatalf("NewResourceBindingLedger() error = %v", err)
	}

	if ledger.Status != ResourceBindingStatusReady || ledger.WorkspaceStorageGB != 10 {
		t.Fatalf("ledger plan/status mismatch: %+v", ledger)
	}
	if ledger.NodePoolID != "np-h0w4d9jo" || ledger.NodePoolName == "" {
		t.Fatalf("ledger must retain tenant node pool identity: %+v", ledger)
	}
	if ledger.CanonicalOwnershipSource != "postgres_resource_binding_ledger" {
		t.Fatalf("canonical source = %q", ledger.CanonicalOwnershipSource)
	}
	if ledger.CloudTagSupport != "tke_nodepool_unsupported" {
		t.Fatalf("cloud tag support = %q", ledger.CloudTagSupport)
	}
	if ledger.CreatedAt != createdAt.Format(time.RFC3339) || ledger.ReleasedAt != "" {
		t.Fatalf("ledger timestamps = %+v", ledger)
	}
	assertPublicJSONDoesNotLeak(t, ledger)
}

func TestResourceBindingLedgerAllowsPreCreateRecordBeforeProviderNodePoolID(t *testing.T) {
	ledger, err := NewResourceBindingLedger(ResourceBindingLedgerInput{
		TenantID:             "tenant-package-c",
		AccountID:            "acct-package-c",
		WorkspaceID:          "ws-package-c",
		ResourceBindingID:    "rb-package-c-requested",
		BillingAttributionID: "ba-package-c-requested",
		ServerPlanID:         "starter_2c4g_10gb",
		WorkspaceStorageGB:   10,
		CloudProvider:        "tencent",
		Region:               "na-siliconvalley",
		ClusterID:            "cls-fi097sy4",
		NodePoolName:         "medopl-tenant-rb-package-c-requested",
		Status:               ResourceBindingStatusRequested,
		OperationID:          "op-package-c-requested",
		CreatedAt:            time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("NewResourceBindingLedger() error = %v", err)
	}
	if ledger.NodePoolID != "" || ledger.NodePoolName == "" {
		t.Fatalf("pre-create ledger should keep target name without fake provider ID: %+v", ledger)
	}
}

func TestResourceBindingLedgerStatusesCoverPackageCLifecycle(t *testing.T) {
	expected := []string{
		ResourceBindingStatusRequested,
		ResourceBindingStatusCreating,
		ResourceBindingStatusCreated,
		ResourceBindingStatusScaling,
		ResourceBindingStatusReady,
		ResourceBindingStatusReleaseRequested,
		ResourceBindingStatusDeleting,
		ResourceBindingStatusReleased,
		ResourceBindingStatusFailed,
		ResourceBindingStatusCleanupRequired,
	}
	for _, status := range expected {
		if !IsResourceBindingStatus(status) {
			t.Fatalf("status %q must be allowlisted", status)
		}
	}
	if IsResourceBindingStatus("active") {
		t.Fatal("old active status must not be a Package C ledger state")
	}
}

func TestCloudOperationRecordsPackageCStateWithoutCloudTagsAsTruth(t *testing.T) {
	createdAt := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	operation, err := NewCloudOperation(CloudOperationInput{
		OperationID:          "op-package-c-live-canary-live-full-lifecycle-2026-06-13",
		ResourceBindingID:    "rb-package-c-live-canary-20260613",
		TenantID:             "tenant-canary-package-c",
		AccountID:            "acct-canary-package-c",
		WorkspaceID:          "ws-canary-package-c",
		BillingAttributionID: "ba-package-c-live-canary-20260613",
		OperationType:        CloudOperationTypeCreateReleaseCanary,
		ServerPlanID:         "starter_2c4g_10gb",
		WorkspaceStorageGB:   10,
		Status:               ResourceBindingStatusReleased,
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
	if operation.CanonicalOwnershipSource != "postgres_resource_binding_ledger" {
		t.Fatalf("operation canonical source = %q", operation.CanonicalOwnershipSource)
	}
	if operation.CloudTagSupport != "tke_nodepool_unsupported" {
		t.Fatalf("operation cloud tag support = %q", operation.CloudTagSupport)
	}
	if operation.ServerPlanID != "starter_2c4g_10gb" || operation.WorkspaceStorageGB != 10 {
		t.Fatalf("operation plan/storage mismatch: %+v", operation)
	}
	assertPublicJSONDoesNotLeak(t, operation)
}

func assertPublicJSONDoesNotLeak(t *testing.T, value any) {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal public value: %v", err)
	}
	text := string(encoded)
	for _, marker := range []string{
		rawProviderKey,
		"rawProviderKey",
		"apiKey",
		"providerApiKey",
		"launchToken",
		"runtimeToken",
		"bearerToken",
		"SecretId",
		"SecretKey",
		"localPath",
		"signedUrl",
		"objectKey",
	} {
		if strings.Contains(text, marker) {
			t.Fatalf("public JSON leaked %q: %s", marker, text)
		}
	}
}
