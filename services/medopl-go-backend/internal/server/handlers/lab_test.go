package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
	labservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/lab"
)

func TestLabHandlersServeTypedPortalAPI(t *testing.T) {
	router := labTestRouter()
	for _, item := range []struct {
		method string
		path   string
		body   string
		status int
	}{
		{method: http.MethodGet, path: "/api/lab-packages", status: http.StatusOK},
		{method: http.MethodGet, path: "/api/lab-entitlement?workspaceId=workspace-v22", status: http.StatusOK},
		{method: http.MethodPost, path: "/api/lab-packages/activate", body: `{"workspaceId":"workspace-v22","packageId":"starter","idempotencyKey":"idem-activate"}`, status: http.StatusOK},
		{method: http.MethodGet, path: "/api/lab-subscription?workspaceId=workspace-v22", status: http.StatusOK},
		{method: http.MethodPost, path: "/api/lab-packages/upgrade", body: `{"workspaceId":"workspace-v22","packageId":"pro","idempotencyKey":"idem-upgrade"}`, status: http.StatusOK},
	} {
		req := httptest.NewRequest(item.method, item.path, bytes.NewBufferString(item.body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != item.status {
			t.Fatalf("%s %s status=%d body=%s", item.method, item.path, rec.Code, rec.Body.String())
		}
		var response map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
			t.Fatalf("json response: %v", err)
		}
		if response["ok"] != true {
			t.Fatalf("response=%+v", response)
		}
	}
}

func TestLabSubscriptionProjectsNotActivatedWorkspace(t *testing.T) {
	router := labTestRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/lab-subscription?workspaceId=workspace-empty", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var response map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("json response: %v", err)
	}
	if response["ok"] != true || response["status"] != "not_activated" || response["subscription"] != nil {
		t.Fatalf("inactive subscription projection=%+v", response)
	}
	if response["workspaceId"] != "workspace-empty" || response["currentPackageId"] != nil || response["currentPackageName"] != nil {
		t.Fatalf("inactive subscription identity/package projection=%+v", response)
	}
}

func TestLabHandlersFailClosedWithoutWorkspaceOrPackage(t *testing.T) {
	router := labTestRouter()
	for _, item := range []struct {
		method string
		path   string
		body   string
		error  string
	}{
		{method: http.MethodGet, path: "/api/lab-subscription", error: "workspace_id_required"},
		{method: http.MethodPost, path: "/api/lab-packages/activate", body: `{"packageId":"starter"}`, error: "workspace_id_required"},
		{method: http.MethodPost, path: "/api/lab-packages/activate", body: `{"workspaceId":"workspace-v22"}`, error: "package_id_required"},
		{method: http.MethodPost, path: "/api/lab-packages/upgrade", body: `{"workspaceId":"workspace-v22","packageId":"missing"}`, error: "package_not_found"},
	} {
		req := httptest.NewRequest(item.method, item.path, bytes.NewBufferString(item.body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code < 400 {
			t.Fatalf("%s %s status=%d body=%s", item.method, item.path, rec.Code, rec.Body.String())
		}
		var response map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
			t.Fatalf("json response: %v", err)
		}
		if response["ok"] != false || response["error"] != item.error {
			t.Fatalf("response=%+v", response)
		}
	}
}

func labTestRouter() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	service := labservice.NewService(memory.NewLabStore())
	api := router.Group("/api")
	api.GET("/lab-packages", LabPackages(service))
	api.GET("/lab-subscription", LabSubscription(service))
	api.GET("/lab-entitlement", LabEntitlement(service))
	api.POST("/lab-packages/activate", ActivateLabPackage(service))
	api.POST("/lab-packages/upgrade", UpgradeLabPackage(service))
	return router
}
