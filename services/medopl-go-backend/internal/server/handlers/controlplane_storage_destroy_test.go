package handlers

import (
	"net/http"
	"strings"
	"testing"
)

func TestControlPlaneHandlersRejectStorageDestroyBeforeRuntimeRelease(t *testing.T) {
	router := controlPlaneHandlerTestRouter()

	prepareCreditUser(t, router, "workspace-v22", 200)
	postMap(t, router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         "storage-destroy-provider-key-material-that-must-stay-private",
		"idempotencyKey": "storage-destroy-reject-provider-once",
	})
	openResponse := postMap(t, router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "storage-destroy-reject-open-once",
	})

	rec := postRaw(router, "/api/v22/storage/destroy", map[string]any{
		"workspaceId":       "workspace-v22",
		"resourceBindingId": openResponse["resourceBindingId"],
		"idempotencyKey":    "storage-destroy-reject-active-runtime-once",
	})
	if rec.Code != http.StatusPreconditionRequired {
		t.Fatalf("storage destroy before release status = %d body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "runtime_release_required_before_storage_destroy") {
		t.Fatalf("storage destroy before release must fail closed with public reason: %s", rec.Body.String())
	}
}

func TestControlPlaneHandlersExposeExplicitStorageDestroyReceipt(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "storage-destroy-provider-key-material-that-must-stay-private"

	prepareCreditUser(t, router, "workspace-v22", 200)
	postMap(t, router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "storage-destroy-provider-once",
	})
	openResponse := postMap(t, router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "storage-destroy-open-once",
	})

	releaseResponse := postMap(t, router, "/api/v22/managed-environment/release", map[string]any{
		"workspaceId":       "workspace-v22",
		"resourceBindingId": openResponse["resourceBindingId"],
		"stopBilling":       true,
		"idempotencyKey":    "storage-destroy-release-once",
	})
	assertPublicPayload(t, releaseResponse, rawProviderKey)
	if releaseResponse["billingStopped"] != true || releaseResponse["status"] != "released" {
		t.Fatalf("release response = %+v", releaseResponse)
	}
	releaseReceipts := releaseResponse["receipts"].(map[string]any)
	if releaseReceipts["runtimeStopped"] != "recorded" || releaseReceipts["billingSettlement"] != "stopped" || releaseReceipts["storageDestroyReceipt"] != "pending_explicit_user_intent" {
		t.Fatalf("release receipts = %+v", releaseReceipts)
	}

	gateAfterRelease := postMap(t, router, "/api/opl/runtime-gate", map[string]any{
		"workspaceId":    "workspace-v22",
		"invocationMode": "runtime_required",
	})
	if gateAfterRelease["runtimeState"] != "released" || gateAfterRelease["storageState"] != "ready" {
		t.Fatalf("release must retain storage: %+v", gateAfterRelease)
	}
	releaseConsumerProjection := gateAfterRelease["consumerProjection"].(map[string]any)
	if releaseConsumerProjection["releaseAction"] != "not_available" || releaseConsumerProjection["storageAction"] != "destroy_storage_explicit_intent" {
		t.Fatalf("release must project explicit storage destroy action: %+v", releaseConsumerProjection)
	}
	storageBindingID := gateAfterRelease["storageBindingId"].(string)

	destroyResponse := postMap(t, router, "/api/v22/storage/destroy", map[string]any{
		"workspaceId":       "workspace-v22",
		"resourceBindingId": openResponse["resourceBindingId"],
		"storageBindingId":  storageBindingID,
		"idempotencyKey":    "storage-destroy-once",
	})
	assertPublicPayload(t, destroyResponse, rawProviderKey)
	if destroyResponse["storageDestroyed"] != true || destroyResponse["billingStopped"] != true || destroyResponse["storageState"] != "destroyed" {
		t.Fatalf("storage destroy response = %+v", destroyResponse)
	}
	destroyReceipts := destroyResponse["releaseReceipts"].(map[string]any)
	if destroyReceipts["storageDestroyReceipt"] != "recorded" || destroyReceipts["billingSettlement"] != "stopped" {
		t.Fatalf("destroy receipts = %+v", destroyReceipts)
	}
	auditEvent := destroyResponse["auditEvent"].(map[string]any)
	if auditEvent["kind"] != "storage.destroy" || auditEvent["status"] != "recorded" {
		t.Fatalf("storage destroy audit = %+v", auditEvent)
	}

	gateAfterDestroy := postMap(t, router, "/api/opl/runtime-gate", map[string]any{
		"workspaceId":    "workspace-v22",
		"invocationMode": "runtime_required",
	})
	if gateAfterDestroy["storageState"] != "destroyed" {
		t.Fatalf("destroyed storage gate = %+v", gateAfterDestroy)
	}
	billing := gateAfterDestroy["billing"].(map[string]any)
	if billing["freezeStatus"] != "stopped" {
		t.Fatalf("destroyed storage billing projection = %+v", billing)
	}
	release := gateAfterDestroy["release"].(map[string]any)
	if release["destroyStorage"] != "completed" || release["stopBilling"] != "stopped" {
		t.Fatalf("destroyed storage release projection = %+v", release)
	}
	destroyConsumerProjection := gateAfterDestroy["consumerProjection"].(map[string]any)
	if destroyConsumerProjection["storageAction"] != "storage_destroy_completed" {
		t.Fatalf("destroyed storage consumer projection = %+v", destroyConsumerProjection)
	}
}
