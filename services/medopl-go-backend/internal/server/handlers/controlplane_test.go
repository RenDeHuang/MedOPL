package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
	controlplaneservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
)

func TestControlPlaneHandlersExposeProviderLaunchBillingResourceLocalRC(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "local-rc-provider-key-material-that-must-stay-private"

	bindResponse := postMap(t, router, "/api/provider/bind", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "bind-provider-once",
	})
	assertPublicPayload(t, bindResponse, rawProviderKey)
	if bindResponse["providerBound"] != true || bindResponse["providerKeyRef"] == "" {
		t.Fatalf("bind response = %+v", bindResponse)
	}

	preflightResponse := postMap(t, router, "/api/provider/preflight", map[string]any{
		"workspaceId": "workspace-v22",
	})
	if preflightResponse["readyForManagedEnvironment"] != true || preflightResponse["launchStatus"] != "ready_for_launch" {
		t.Fatalf("preflight response = %+v", preflightResponse)
	}

	launchResponse := postMap(t, router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "open-once",
	})
	assertPublicPayload(t, launchResponse, rawProviderKey)
	if launchResponse["launchStatus"] != "ready" || launchResponse["providerBound"] != true {
		t.Fatalf("launch response = %+v", launchResponse)
	}
	launchID := launchResponse["launchId"].(string)

	statusResponse := getMap(t, router, "/api/opl/launch-status/"+launchID)
	if statusResponse["status"] != "ready" || statusResponse["gatewayReady"] != true {
		t.Fatalf("status response = %+v", statusResponse)
	}

	bootstrapResponse := getMap(t, router, "/api/opl/bootstrap?launchId="+launchID)
	if bootstrapResponse["runtimeBridgeContractVersion"] != "v22-local-rc" {
		t.Fatalf("bootstrap response = %+v", bootstrapResponse)
	}

	fileResponse := postMap(t, router, "/api/opl/files?launchId="+launchID, map[string]any{
		"fileName":     "measurements.csv",
		"relativePath": "inputs/measurements.csv",
		"contentType":  "text/csv",
		"sizeBytes":    128,
	})
	if fileResponse["ok"] != true || fileResponse["fileRef"] == "" {
		t.Fatalf("file response = %+v", fileResponse)
	}

	runResponse := postMap(t, router, "/api/opl/runs?launchId="+launchID, map[string]any{
		"message":  "analyze file",
		"fileRefs": []any{fileResponse["fileRef"]},
		"toolName": "opl-workbench",
	})
	if runResponse["ok"] != true || runResponse["status"] != "succeeded" {
		t.Fatalf("run response = %+v", runResponse)
	}

	billingResponse := getMap(t, router, "/api/billing/summary?workspaceId=workspace-v22")
	if billingResponse["todayCost"] == nil || billingResponse["source"] != "go-control-plane" {
		t.Fatalf("billing response = %+v", billingResponse)
	}

	resourcesResponse := getMap(t, router, "/api/platform-provisioned-resources")
	if resourcesResponse["source"] != "go-control-plane" || resourcesResponse["ok"] != true {
		t.Fatalf("resources response = %+v", resourcesResponse)
	}

	releaseResponse := postMap(t, router, "/api/v22/managed-environment/release", map[string]any{
		"workspaceId":       "workspace-v22",
		"resourceBindingId": launchResponse["resourceBindingId"],
		"stopBilling":       true,
		"idempotencyKey":    "release-once",
	})
	if releaseResponse["billingStopped"] != true || releaseResponse["status"] != "released" {
		t.Fatalf("release response = %+v", releaseResponse)
	}
}

func TestControlPlaneHandlersFailClosedWithoutProviderKey(t *testing.T) {
	router := controlPlaneHandlerTestRouter()

	preflightResponse := postMap(t, router, "/api/provider/preflight", map[string]any{"workspaceId": "workspace-v22"})
	if preflightResponse["ok"] != false || preflightResponse["error"] != "provider_key_required" {
		t.Fatalf("preflight response = %+v", preflightResponse)
	}

	rec := postRaw(router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "open-once",
	})
	if rec.Code != http.StatusPreconditionRequired {
		t.Fatalf("open status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func controlPlaneHandlerTestRouter() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	service := controlplaneservice.NewService(memory.NewControlPlaneStore())
	api := router.Group("/api")
	RegisterControlPlaneRoutes(api, service)
	return router
}

func getMap(t *testing.T, router *gin.Engine, path string) map[string]any {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return decodeOK(t, rec)
}

func postMap(t *testing.T, router *gin.Engine, path string, payload map[string]any) map[string]any {
	t.Helper()
	return decodeOK(t, postRaw(router, path, payload))
}

func postRaw(router *gin.Engine, path string, payload map[string]any) *httptest.ResponseRecorder {
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func decodeOK(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	if rec.Code < 200 || rec.Code >= 300 {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	return payload
}

func assertPublicPayload(t *testing.T, payload map[string]any, rawProviderKey string) {
	t.Helper()
	encoded, _ := json.Marshal(payload)
	text := string(encoded)
	for _, marker := range []string{rawProviderKey, "rawProviderKey", "providerApiKey", "launchToken", "runtimeToken", "bearerToken", "SecretId", "SecretKey", "signedUrl", "objectKey", "localPath"} {
		if strings.Contains(text, marker) {
			t.Fatalf("public payload leaked %q: %s", marker, text)
		}
	}
}
