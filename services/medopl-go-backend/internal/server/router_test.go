package server

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
)

func writePortalStaticFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	index := `<!doctype html><html><head><title>MedOPL Portal</title></head><body><div id="root">MedOPL Portal</div><script type="module" src="/assets/app.js"></script></body></html>`
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte(index), 0o644); err != nil {
		t.Fatalf("write portal static index: %v", err)
	}
	if err := os.Mkdir(filepath.Join(root, "assets"), 0o755); err != nil {
		t.Fatalf("mkdir assets: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "assets", "app.js"), []byte("console.log('medopl portal')\n"), 0o644); err != nil {
		t.Fatalf("write portal static asset: %v", err)
	}
	return root
}

func TestRouterServesExpectedEndpoints(t *testing.T) {
	router := Router(config.Config{Service: "medopl-go-backend", Mode: "local", Port: 8789, ProviderSecretRoot: t.TempDir(), PortalStaticRoot: writePortalStaticFixture(t)})
	for _, path := range []string{"/", "/compute", "/storage", "/usage", "/opl"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s portal entry status = %d body = %s", path, rec.Code, rec.Body.String())
		}
		contentType := rec.Header().Get("Content-Type")
		if !strings.Contains(contentType, "text/html") {
			t.Fatalf("%s portal entry content-type = %q", path, contentType)
		}
		if !strings.Contains(rec.Body.String(), "MedOPL Portal") {
			t.Fatalf("%s portal entry did not serve portal html: %s", path, rec.Body.String())
		}
	}
	assetReq := httptest.NewRequest(http.MethodGet, "/assets/app.js", nil)
	assetRec := httptest.NewRecorder()
	router.ServeHTTP(assetRec, assetReq)
	if assetRec.Code != http.StatusOK || !strings.Contains(assetRec.Body.String(), "medopl portal") {
		t.Fatalf("portal asset status = %d body = %s", assetRec.Code, assetRec.Body.String())
	}
	for _, path := range []string{"/health", "/healthz", "/readyz", "/version", "/config/check"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s status = %d", path, rec.Code)
		}
	}
	for _, item := range []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/api/lab-packages"},
		{method: http.MethodGet, path: "/api/lab-entitlement?workspaceId=workspace-v22"},
		{method: http.MethodPost, path: "/api/lab-packages/activate", body: `{"workspaceId":"workspace-v22","packageId":"starter","idempotencyKey":"idem-lab"}`},
		{method: http.MethodGet, path: "/api/lab-subscription?workspaceId=workspace-v22"},
		{method: http.MethodPost, path: "/api/lab-packages/upgrade", body: `{"workspaceId":"workspace-v22","packageId":"pro","idempotencyKey":"idem-lab-upgrade"}`},
		{method: http.MethodGet, path: "/api/me"},
		{method: http.MethodGet, path: "/api/overview?workspaceId=workspace-v22"},
		{method: http.MethodGet, path: "/api/workspace?task=workspace-v22"},
		{method: http.MethodGet, path: "/api/workspace/storage?workspaceId=workspace-v22"},
		{method: http.MethodGet, path: "/api/storage/entitlement?workspaceId=workspace-v22"},
		{method: http.MethodPost, path: "/api/workspace/files/upload-url", body: `{"workspaceId":"workspace-v22","fileName":"input.csv","kind":"inputs"}`},
		{method: http.MethodGet, path: "/api/workspace/files/download-url?workspaceId=workspace-v22&file=result.md&kind=outputs"},
		{method: http.MethodPost, path: "/api/workspace/files/local-transfer", body: `{"workspaceId":"workspace-v22","fileName":"input.csv","kind":"inputs"}`},
		{method: http.MethodGet, path: "/api/workspace/files/local-transfer?workspaceId=workspace-v22&file=result.md&kind=outputs"},
		{method: http.MethodGet, path: "/api/announcements"},
		{method: http.MethodGet, path: "/api/admin/audit-events?workspaceId=workspace-v22"},
		{method: http.MethodGet, path: "/api/admin/overview"},
		{method: http.MethodGet, path: "/api/public/settings"},
		{method: http.MethodGet, path: "/api/server-plans"},
		{method: http.MethodGet, path: "/api/billing/export.csv"},
		{method: http.MethodGet, path: "/api/cloud/connector/status"},
		{method: http.MethodPost, path: "/api/cloud/connector/plan", body: `{"workspaceId":"workspace-v22"}`},
	} {
		req := httptest.NewRequest(item.method, item.path, bytes.NewBufferString(item.body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK && rec.Code != http.StatusPreconditionRequired {
			t.Fatalf("%s %s status = %d body = %s", item.method, item.path, rec.Code, rec.Body.String())
		}
	}
	for _, path := range []string{
		"/api/session-traces?workspaceId=workspace-v22",
		"/api/traces?workspaceId=workspace-v22",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("%s retired customer trace API status = %d body = %s", path, rec.Code, rec.Body.String())
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/api/logout", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("/api/logout status = %d", rec.Code)
	}
	for _, path := range []string{
		"/workflow/commands",
		"/runtime/launch",
		"/runs",
		"/billing/freeze",
		"/resources/release",
	} {
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(`{"workflowCommandId":"legacy-root-facade","idempotencyKey":"legacy-root-facade"}`))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusGone && rec.Code != http.StatusNotFound {
			t.Fatalf("%s legacy root facade status = %d body = %s", path, rec.Code, rec.Body.String())
		}
	}
}
