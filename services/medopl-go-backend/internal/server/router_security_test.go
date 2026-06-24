package server

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/postgres"
)

const (
	testUserToken      = "user-token"
	testAdminToken     = "admin-token"
	testWebhookSecret  = "webhook-secret"
	testTenantID       = "tenant-v22"
	testPortalUserID   = "user-v22"
	testWorkspaceID    = "workspace-v22"
	testOtherWorkspace = "workspace-other"
)

func productionRouterForSecurityTest(t *testing.T) http.Handler {
	t.Helper()
	productionRequestLimiter = newRequestLimiter(10)
	previous := openProductionSQLBackend
	openProductionSQLBackend = func(ctx context.Context, databaseURL string, migrationPath string) (*postgres.SQLBackend, error) {
		return nil, nil
	}
	t.Cleanup(func() {
		openProductionSQLBackend = previous
	})
	router, err := RouterWithError(config.Config{
		Service:            "medopl-go-backend",
		Mode:               "production",
		Port:               8789,
		ProviderSecretRoot: t.TempDir(),
		PortalStaticRoot:   writePortalStaticFixture(t),
		DatabaseURL:        "postgres://medopl:test@postgres.medopl.local:5432/medopl?sslmode=require",
		AuthTokenHash:      config.TokenHash(testUserToken),
		AdminTokenHash:     config.TokenHash(testAdminToken),
		WebhookSecretHash:  config.TokenHash(testWebhookSecret),
	})
	if err != nil {
		t.Fatalf("RouterWithError() error = %v", err)
	}
	return router
}

func TestProductionRouterSecurityBoundary(t *testing.T) {
	router := productionRouterForSecurityTest(t)

	for _, path := range []string{"/health", "/readyz", "/version", "/api/public/settings"} {
		rec := serveSecurityRequest(router, http.MethodGet, path, "", "", "", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("%s public status = %d body = %s", path, rec.Code, rec.Body.String())
		}
	}

	unauthenticated := serveSecurityRequest(
		router,
		http.MethodPost,
		"/api/v22/managed-environment/open",
		`{"tenantId":"tenant-v22","portalUserId":"user-v22","workspaceId":"workspace-v22","idempotencyKey":"open-once"}`,
		"",
		"",
		"",
	)
	if unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated mutation status = %d body = %s", unauthenticated.Code, unauthenticated.Body.String())
	}
	assertSecurityBody(t, unauthenticated, "authentication_required")

	crossWorkspace := serveSecurityRequest(
		router,
		http.MethodPost,
		"/api/v22/managed-environment/open",
		`{"tenantId":"tenant-v22","portalUserId":"user-v22","workspaceId":"workspace-other","idempotencyKey":"open-cross"}`,
		testUserToken,
		"",
		"",
	)
	if crossWorkspace.Code != http.StatusForbidden {
		t.Fatalf("cross workspace mutation status = %d body = %s", crossWorkspace.Code, crossWorkspace.Body.String())
	}
	assertSecurityBody(t, crossWorkspace, "workspace_forbidden")

	crossTenant := serveSecurityRequestWithIdentity(
		router,
		http.MethodPost,
		"/api/v22/managed-environment/open",
		`{"tenantId":"tenant-other","portalUserId":"user-v22","workspaceId":"workspace-v22","idempotencyKey":"open-cross-tenant"}`,
		testUserToken,
		"",
		"",
		testTenantID,
		testPortalUserID,
		testWorkspaceID,
	)
	if crossTenant.Code != http.StatusForbidden {
		t.Fatalf("cross tenant mutation status = %d body = %s", crossTenant.Code, crossTenant.Body.String())
	}
	assertSecurityBody(t, crossTenant, "tenant_forbidden")

	crossUser := serveSecurityRequestWithIdentity(
		router,
		http.MethodPost,
		"/api/v22/managed-environment/open",
		`{"tenantId":"tenant-v22","portalUserId":"user-other","workspaceId":"workspace-v22","idempotencyKey":"open-cross-user"}`,
		testUserToken,
		"",
		"",
		testTenantID,
		testPortalUserID,
		testWorkspaceID,
	)
	if crossUser.Code != http.StatusForbidden {
		t.Fatalf("cross user mutation status = %d body = %s", crossUser.Code, crossUser.Body.String())
	}
	assertSecurityBody(t, crossUser, "user_forbidden")

	adminOnly := serveSecurityRequest(
		router,
		http.MethodPost,
		"/api/v22/billing/adjustment",
		`{"tenantId":"tenant-v22","userId":"user-v22","workspaceId":"workspace-v22","amount":5,"idempotencyKey":"adjust-user"}`,
		testUserToken,
		"",
		"",
	)
	if adminOnly.Code != http.StatusForbidden {
		t.Fatalf("admin-only mutation status = %d body = %s", adminOnly.Code, adminOnly.Body.String())
	}
	assertSecurityBody(t, adminOnly, "admin_required")

	webhookOnly := serveSecurityRequest(
		router,
		http.MethodPost,
		"/api/v22/billing/payment-paid",
		`{"tenantId":"tenant-v22","userId":"user-v22","workspaceId":"workspace-v22","orderId":"order-v22","amount":100,"idempotencyKey":"paid-user"}`,
		testAdminToken,
		"",
		"",
	)
	if webhookOnly.Code != http.StatusUnauthorized {
		t.Fatalf("webhook-only mutation status = %d body = %s", webhookOnly.Code, webhookOnly.Body.String())
	}
	assertSecurityBody(t, webhookOnly, "webhook_signature_required")

}

func TestProductionSecurityMiddlewareAuthorizesRolesBeforeHandlers(t *testing.T) {
	router := productionSecurityMiddlewareTestRouter()

	authorizedPrepare := serveSecurityRequest(
		router,
		http.MethodPost,
		"/api/v22/users/prepare",
		`{"tenantId":"tenant-v22","userId":"user-v22","workspaceId":"workspace-v22"}`,
		testUserToken,
		"",
		"csrf-token",
	)
	if authorizedPrepare.Code != http.StatusOK {
		t.Fatalf("authorized user mutation status = %d body = %s", authorizedPrepare.Code, authorizedPrepare.Body.String())
	}

	adminPrepare := serveSecurityRequest(
		router,
		http.MethodPost,
		"/api/v22/billing/adjustment",
		`{"tenantId":"tenant-v22","userId":"user-v22","workspaceId":"workspace-v22","amount":5,"idempotencyKey":"adjust-admin"}`,
		testAdminToken,
		"",
		"csrf-token",
	)
	if adminPrepare.Code != http.StatusOK {
		t.Fatalf("authorized admin mutation status = %d body = %s", adminPrepare.Code, adminPrepare.Body.String())
	}

	webhookPaid := serveSecurityRequest(
		router,
		http.MethodPost,
		"/api/v22/billing/payment-paid",
		`{"tenantId":"tenant-v22","userId":"user-v22","workspaceId":"workspace-v22","orderId":"order-v22","amount":100,"idempotencyKey":"paid-webhook"}`,
		"",
		testWebhookSecret,
		"",
	)
	if webhookPaid.Code != http.StatusOK && webhookPaid.Code != http.StatusBadRequest {
		t.Fatalf("webhook-authenticated request must pass auth boundary, status = %d body = %s", webhookPaid.Code, webhookPaid.Body.String())
	}
	if strings.Contains(webhookPaid.Body.String(), "webhook_signature_required") {
		t.Fatalf("webhook-authenticated request stopped at auth boundary: %s", webhookPaid.Body.String())
	}
}

func TestProductionSecurityMiddlewareLimitsAbuseAndRequiresCSRFForBrowserMutations(t *testing.T) {
	router := productionSecurityMiddlewareTestRouter()

	missingCSRF := serveSecurityRequest(
		router,
		http.MethodPost,
		"/api/v22/users/prepare",
		`{"tenantId":"tenant-v22","userId":"user-v22","workspaceId":"workspace-v22"}`,
		testUserToken,
		"",
		"",
	)
	if missingCSRF.Code != http.StatusForbidden {
		t.Fatalf("missing csrf status = %d body = %s", missingCSRF.Code, missingCSRF.Body.String())
	}
	assertSecurityBody(t, missingCSRF, "csrf_required")

	for index := 0; index < 12; index++ {
		rec := serveSecurityRequest(
			router,
			http.MethodPost,
			"/api/v22/managed-environment/open",
			`{"tenantId":"tenant-v22","portalUserId":"user-v22","workspaceId":"workspace-v22","idempotencyKey":"open-rate"}`,
			testUserToken,
			"",
			"csrf-token",
		)
		if index < 10 && rec.Code != http.StatusOK {
			t.Fatalf("request %d should pass before limit, status = %d body = %s", index, rec.Code, rec.Body.String())
		}
		if index >= 10 && rec.Code != http.StatusTooManyRequests {
			t.Fatalf("request %d should hit rate limit, status = %d body = %s", index, rec.Code, rec.Body.String())
		}
	}
}

func TestProductionSecurityHeadersAndCORSBoundary(t *testing.T) {
	router := productionSecurityMiddlewareTestRouter()

	preflight := serveSecurityRequestWithOrigin(router, http.MethodOptions, "/api/v22/users/prepare", "", "", "", "", "https://portal.medopl.cn")
	if preflight.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d body = %s", preflight.Code, preflight.Body.String())
	}
	if preflight.Header().Get("Access-Control-Allow-Origin") != "https://portal.medopl.cn" {
		t.Fatalf("cors origin = %q", preflight.Header().Get("Access-Control-Allow-Origin"))
	}

	rejectedOrigin := serveSecurityRequestWithOrigin(router, http.MethodOptions, "/api/v22/users/prepare", "", "", "", "", "https://evil.example")
	if rejectedOrigin.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("unexpected cors origin for rejected origin = %q", rejectedOrigin.Header().Get("Access-Control-Allow-Origin"))
	}

	rec := serveSecurityRequest(router, http.MethodGet, "/version", "", "", "", "")
	for header, expected := range map[string]string{
		"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
		"X-Content-Type-Options":    "nosniff",
		"X-Frame-Options":           "DENY",
		"Referrer-Policy":           "no-referrer",
	} {
		if rec.Header().Get(header) != expected {
			t.Fatalf("%s = %q", header, rec.Header().Get(header))
		}
	}
	if !strings.Contains(rec.Header().Get("Content-Security-Policy"), "frame-ancestors 'none'") {
		t.Fatalf("csp missing frame-ancestors: %q", rec.Header().Get("Content-Security-Policy"))
	}
}

func TestProductionRequestLimiterResetsAfterWindow(t *testing.T) {
	now := time.Date(2026, time.June, 24, 10, 0, 0, 0, time.UTC)
	limiter := newRequestLimiterWithClock(2, time.Minute, func() time.Time {
		return now
	})
	if !limiter.Allow("tenant|workspace|open") {
		t.Fatalf("first request should pass")
	}
	if !limiter.Allow("tenant|workspace|open") {
		t.Fatalf("second request should pass")
	}
	if limiter.Allow("tenant|workspace|open") {
		t.Fatalf("third request should be limited before window reset")
	}
	now = now.Add(time.Minute + time.Nanosecond)
	if !limiter.Allow("tenant|workspace|open") {
		t.Fatalf("request after window reset should pass")
	}
}

func productionSecurityMiddlewareTestRouter() http.Handler {
	productionRequestLimiter = newRequestLimiter(10)
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(productionSecurityMiddleware(config.Config{
		Service:           "medopl-go-backend",
		Mode:              "production",
		Port:              8789,
		DatabaseURL:       "postgres://medopl:test@postgres.medopl.local:5432/medopl?sslmode=require",
		AuthTokenHash:     config.TokenHash(testUserToken),
		AdminTokenHash:    config.TokenHash(testAdminToken),
		WebhookSecretHash: config.TokenHash(testWebhookSecret),
	}))
	api := router.Group("/api")
	api.POST("/v22/users/prepare", okSecurityHandler)
	api.POST("/v22/managed-environment/open", okSecurityHandler)
	api.POST("/v22/billing/adjustment", okSecurityHandler)
	api.POST("/v22/billing/payment-paid", okSecurityHandler)
	router.GET("/version", okSecurityHandler)
	return router
}

func okSecurityHandler(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{"ok": true})
}

func serveSecurityRequest(router http.Handler, method string, path string, body string, bearerToken string, webhookSecret string, csrf string) *httptest.ResponseRecorder {
	return serveSecurityRequestWithOrigin(router, method, path, body, bearerToken, webhookSecret, csrf, "")
}

func serveSecurityRequestWithOrigin(router http.Handler, method string, path string, body string, bearerToken string, webhookSecret string, csrf string, origin string) *httptest.ResponseRecorder {
	return serveSecurityRequestWithIdentityAndOrigin(router, method, path, body, bearerToken, webhookSecret, csrf, testTenantID, testPortalUserID, testWorkspaceID, origin)
}

func serveSecurityRequestWithIdentity(
	router http.Handler,
	method string,
	path string,
	body string,
	bearerToken string,
	webhookSecret string,
	csrf string,
	tenantID string,
	userID string,
	workspaceID string,
) *httptest.ResponseRecorder {
	return serveSecurityRequestWithIdentityAndOrigin(router, method, path, body, bearerToken, webhookSecret, csrf, tenantID, userID, workspaceID, "")
}

func serveSecurityRequestWithIdentityAndOrigin(
	router http.Handler,
	method string,
	path string,
	body string,
	bearerToken string,
	webhookSecret string,
	csrf string,
	tenantID string,
	userID string,
	workspaceID string,
	origin string,
) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	if bearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+bearerToken)
		req.Header.Set("X-MedOPL-Tenant-ID", tenantID)
		req.Header.Set("X-MedOPL-User-ID", userID)
		req.Header.Set("X-MedOPL-Workspace-ID", workspaceID)
	}
	if webhookSecret != "" {
		req.Header.Set("X-MedOPL-Webhook-Secret", webhookSecret)
		req.Header.Set("X-MedOPL-Tenant-ID", tenantID)
		req.Header.Set("X-MedOPL-User-ID", userID)
		req.Header.Set("X-MedOPL-Workspace-ID", workspaceID)
	}
	if csrf != "" {
		req.Header.Set("X-MedOPL-CSRF", csrf)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func assertSecurityBody(t *testing.T, rec *httptest.ResponseRecorder, marker string) {
	t.Helper()
	if !strings.Contains(rec.Body.String(), marker) {
		t.Fatalf("response missing %q: %s", marker, rec.Body.String())
	}
}
