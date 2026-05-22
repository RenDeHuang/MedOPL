package server

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
)

func TestRouterServesExpectedEndpoints(t *testing.T) {
	router := Router(config.Config{Service: "medopl-go-backend", Mode: "local", Port: 8789})
	for _, path := range []string{"/health", "/version", "/config/check"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s status = %d", path, rec.Code)
		}
	}
	for _, item := range []struct {
		path string
		body string
	}{
		{path: "/workflow/commands", body: `{"workflowCommandId":"cmd-v22","commandType":"managed_run.submit","tenantId":"tenant-v22","workspaceId":"workspace-v22","requestedBy":"user-v22","idempotencyKey":"idem-v22"}`},
		{path: "/runtime/launch", body: `{"workflowCommandId":"cmd-launch","tenantId":"tenant-v22","workspaceId":"workspace-v22","requestedBy":"user-v22","idempotencyKey":"idem-launch"}`},
		{path: "/runs", body: `{"workflowCommandId":"cmd-run","tenantId":"tenant-v22","workspaceId":"workspace-v22","requestedBy":"user-v22","idempotencyKey":"idem-run"}`},
		{path: "/billing/freeze", body: `{"workflowCommandId":"cmd-billing","tenantId":"tenant-v22","workspaceId":"workspace-v22","requestedBy":"user-v22","idempotencyKey":"idem-billing"}`},
		{path: "/resources/release", body: `{"workflowCommandId":"cmd-release","tenantId":"tenant-v22","workspaceId":"workspace-v22","requestedBy":"user-v22","idempotencyKey":"idem-release"}`},
	} {
		req := httptest.NewRequest(http.MethodPost, item.path, bytes.NewBufferString(item.body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusAccepted {
			t.Fatalf("%s status = %d", item.path, rec.Code)
		}
	}
}
