package handlers

import "testing"

func TestControlPlaneHandlersExposeExplicitStorageDestroyReceipt(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "storage-destroy-provider-key-material-that-must-stay-private"

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

	gateAfterRelease := postMap(t, router, "/api/opl/runtime-gate", map[string]any{
		"workspaceId":    "workspace-v22",
		"invocationMode": "runtime_required",
	})
	if gateAfterRelease["runtimeState"] != "released" || gateAfterRelease["storageState"] != "ready" {
		t.Fatalf("release must retain storage: %+v", gateAfterRelease)
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
	release := gateAfterDestroy["release"].(map[string]any)
	if release["destroyStorage"] != "completed" {
		t.Fatalf("destroyed storage release projection = %+v", release)
	}
}
