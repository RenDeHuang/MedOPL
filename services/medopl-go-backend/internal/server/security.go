package server

import (
	"bytes"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
)

type productionActor struct {
	TenantID    string
	UserID      string
	WorkspaceID string
	Role        string
	CSRFHash    string
}

const productionActorKey = "medoplProductionActor"

const productionCORSOrigin = "https://portal.medopl.cn"
const productionSessionCookieName = "medopl_session"
const productionCSRFCookieName = "medopl_csrf"

var productionRequestLimiter = newRequestLimiter(10)

func productionSecurityMiddleware(cfg config.Config) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if strings.TrimSpace(cfg.Mode) != "production" {
			ctx.Next()
			return
		}
		writeSecurityHeaders(ctx)
		if ctx.Request.Method == http.MethodOptions {
			writeCORSHeaders(ctx)
			ctx.AbortWithStatus(http.StatusNoContent)
			return
		}
		writeCORSHeaders(ctx)
		if isPublicProductionPath(ctx.Request.Method, ctx.FullPath(), ctx.Request.URL.Path) {
			ctx.Next()
			return
		}

		if isWebhookOnlyPath(ctx.Request.Method, ctx.FullPath(), ctx.Request.URL.Path) {
			if !hashMatches(headerValue(ctx, "X-MedOPL-Webhook-Secret"), cfg.WebhookSecretHash) {
				writeSecurityError(ctx, http.StatusUnauthorized, "webhook_signature_required")
				return
			}
			if ok, code := identityScopeAllowed(ctx); !ok {
				writeSecurityError(ctx, http.StatusForbidden, code)
				return
			}
			if !productionRequestLimiter.Allow(rateLimitKey(ctx, "webhook")) {
				writeSecurityError(ctx, http.StatusTooManyRequests, "rate_limited")
				return
			}
			ctx.Set(productionActorKey, actorFromHeaders(ctx, "webhook"))
			ctx.Next()
			return
		}

		actor, ok := authenticatedActor(ctx, cfg)
		if !ok {
			writeSecurityError(ctx, http.StatusUnauthorized, "authentication_required")
			return
		}
		if requiresAdmin(ctx.Request.Method, ctx.FullPath(), ctx.Request.URL.Path) && actor.Role != "admin" {
			writeSecurityError(ctx, http.StatusForbidden, "admin_required")
			return
		}
		applyActorHeaders(ctx, actor)
		if ok, code := identityScopeAllowed(ctx); !ok {
			writeSecurityError(ctx, http.StatusForbidden, code)
			return
		}
		if requiresCSRF(ctx.Request.Method) && !csrfAllowed(ctx, actor) {
			writeSecurityError(ctx, http.StatusForbidden, "csrf_required")
			return
		}
		if !productionRequestLimiter.Allow(rateLimitKey(ctx, actor.Role)) {
			writeSecurityError(ctx, http.StatusTooManyRequests, "rate_limited")
			return
		}
		ctx.Set(productionActorKey, actor)
		ctx.Next()
	}
}

type requestLimiter struct {
	mu       sync.Mutex
	limit    int
	window   time.Duration
	now      func() time.Time
	counters map[string]requestLimitCounter
}

type requestLimitCounter struct {
	count       int
	windowStart time.Time
}

func newRequestLimiter(limit int) *requestLimiter {
	return newRequestLimiterWithClock(limit, time.Minute, time.Now)
}

func newRequestLimiterWithClock(limit int, window time.Duration, now func() time.Time) *requestLimiter {
	return &requestLimiter{limit: limit, window: window, now: now, counters: map[string]requestLimitCounter{}}
}

func (limiter *requestLimiter) Allow(key string) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	current := limiter.now()
	counter := limiter.counters[key]
	if counter.windowStart.IsZero() || current.Sub(counter.windowStart) >= limiter.window {
		counter = requestLimitCounter{windowStart: current}
	}
	counter.count++
	limiter.counters[key] = counter
	return counter.count <= limiter.limit
}

func rateLimitKey(ctx *gin.Context, role string) string {
	return strings.Join([]string{
		role,
		strings.TrimSpace(ctx.GetHeader("X-MedOPL-Workspace-ID")),
		firstNonEmpty(ctx.FullPath(), ctx.Request.URL.Path),
	}, "|")
}

func authenticatedActor(ctx *gin.Context, cfg config.Config) (productionActor, bool) {
	token := bearerToken(ctx.GetHeader("Authorization"))
	if token != "" {
		if hashMatches(token, cfg.AdminTokenHash) {
			return actorFromHeaders(ctx, "admin"), true
		}
		if hashMatches(token, cfg.AuthTokenHash) {
			return actorFromHeaders(ctx, "user"), true
		}
	}
	if actor, ok := actorFromSessionCookie(ctx, cfg); ok {
		return actor, true
	}
	return productionActor{}, false
}

func isPublicProductionPath(method string, fullPath string, rawPath string) bool {
	path := firstNonEmpty(fullPath, rawPath)
	if method == http.MethodGet {
		switch path {
		case "/health", "/healthz", "/readyz", "/version", "/api/public/settings", "/api/logout":
			return true
		}
	}
	if method == http.MethodPost && path == "/api/session/bootstrap" {
		return true
	}
	if method == http.MethodGet && !strings.HasPrefix(path, "/api/") {
		return true
	}
	return false
}

func requiresCSRF(method string) bool {
	return method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete
}

func requiresAdmin(method string, fullPath string, rawPath string) bool {
	if method == http.MethodGet {
		return strings.HasPrefix(firstNonEmpty(fullPath, rawPath), "/api/admin/")
	}
	if method != http.MethodPost {
		return false
	}
	switch firstNonEmpty(fullPath, rawPath) {
	case "/api/v22/users/credit",
		"/api/v22/billing/refund",
		"/api/v22/billing/adjustment",
		"/api/admin/actions/:action",
		"/api/cloud/connector/plan":
		return true
	default:
		return false
	}
}

func isWebhookOnlyPath(method string, fullPath string, rawPath string) bool {
	return method == http.MethodPost && firstNonEmpty(fullPath, rawPath) == "/api/v22/billing/payment-paid"
}

func identityScopeAllowed(ctx *gin.Context) (bool, string) {
	bodyScope := scopeFromRequest(ctx)
	for _, item := range []struct {
		expected string
		actual   string
		code     string
	}{
		{expected: strings.TrimSpace(ctx.GetHeader("X-MedOPL-Tenant-ID")), actual: bodyScope.TenantID, code: "tenant_forbidden"},
		{expected: strings.TrimSpace(ctx.GetHeader("X-MedOPL-User-ID")), actual: bodyScope.UserID, code: "user_forbidden"},
		{expected: strings.TrimSpace(ctx.GetHeader("X-MedOPL-Workspace-ID")), actual: bodyScope.WorkspaceID, code: "workspace_forbidden"},
	} {
		if item.expected == "" {
			return false, item.code
		}
		if item.actual != "" && item.actual != item.expected {
			return false, item.code
		}
	}
	return true, ""
}

func applyActorHeaders(ctx *gin.Context, actor productionActor) {
	ctx.Request.Header.Set("X-MedOPL-Tenant-ID", actor.TenantID)
	ctx.Request.Header.Set("X-MedOPL-User-ID", actor.UserID)
	ctx.Request.Header.Set("X-MedOPL-Workspace-ID", actor.WorkspaceID)
}

type requestScope struct {
	TenantID    string
	UserID      string
	WorkspaceID string
}

func scopeFromRequest(ctx *gin.Context) requestScope {
	scope := requestScope{}
	for _, value := range []string{ctx.Query("tenantId"), ctx.Query("tenant_id")} {
		if strings.TrimSpace(value) != "" {
			scope.TenantID = strings.TrimSpace(value)
			break
		}
	}
	for _, value := range []string{ctx.Query("portalUserId"), ctx.Query("userId"), ctx.Query("portal_user_id"), ctx.Query("user_id")} {
		if strings.TrimSpace(value) != "" {
			scope.UserID = strings.TrimSpace(value)
			break
		}
	}
	for _, value := range []string{ctx.Query("workspaceId"), ctx.Query("workspace_id")} {
		if strings.TrimSpace(value) != "" {
			scope.WorkspaceID = strings.TrimSpace(value)
			break
		}
	}
	if ctx.Request.Body == nil {
		return scope
	}
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		return scope
	}
	ctx.Request.Body = io.NopCloser(bytes.NewReader(body))
	var payload struct {
		TenantID       string `json:"tenantId"`
		TenantIDSnake  string `json:"tenant_id"`
		PortalUserID   string `json:"portalUserId"`
		PortalUserID2  string `json:"portal_user_id"`
		UserID         string `json:"userId"`
		UserIDSnake    string `json:"user_id"`
		WorkspaceID    string `json:"workspaceId"`
		WorkspaceSnake string `json:"workspace_id"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return scope
	}
	scope.TenantID = firstNonEmpty(scope.TenantID, payload.TenantID, payload.TenantIDSnake)
	scope.UserID = firstNonEmpty(scope.UserID, payload.PortalUserID, payload.PortalUserID2, payload.UserID, payload.UserIDSnake)
	scope.WorkspaceID = firstNonEmpty(scope.WorkspaceID, payload.WorkspaceID, payload.WorkspaceSnake)
	return scope
}

func actorFromHeaders(ctx *gin.Context, role string) productionActor {
	return productionActor{
		TenantID:    strings.TrimSpace(ctx.GetHeader("X-MedOPL-Tenant-ID")),
		UserID:      strings.TrimSpace(ctx.GetHeader("X-MedOPL-User-ID")),
		WorkspaceID: strings.TrimSpace(ctx.GetHeader("X-MedOPL-Workspace-ID")),
		Role:        role,
	}
}

type productionSessionClaims struct {
	TenantID    string `json:"tenantId"`
	UserID      string `json:"userId"`
	WorkspaceID string `json:"workspaceId"`
	Role        string `json:"role"`
	CSRFHash    string `json:"csrfHash"`
}

func actorFromSessionCookie(ctx *gin.Context, cfg config.Config) (productionActor, bool) {
	cookie, err := ctx.Cookie(productionSessionCookieName)
	if err != nil {
		return productionActor{}, false
	}
	claims, ok := parseProductionSessionCookie(cookie, cfg.SessionSecretHash)
	if !ok {
		return productionActor{}, false
	}
	return productionActor{
		TenantID:    claims.TenantID,
		UserID:      claims.UserID,
		WorkspaceID: claims.WorkspaceID,
		Role:        "user",
		CSRFHash:    claims.CSRFHash,
	}, true
}

func parseProductionSessionCookie(cookieValue string, sessionSecretHash string) (productionSessionClaims, bool) {
	parts := strings.Split(strings.TrimSpace(cookieValue), ".")
	if len(parts) != 2 {
		return productionSessionClaims{}, false
	}
	payloadHex := parts[0]
	signatureHex := parts[1]
	if !hexHashMatches(payloadHex+":"+strings.TrimSpace(sessionSecretHash), signatureHex) {
		return productionSessionClaims{}, false
	}
	payload, err := hex.DecodeString(payloadHex)
	if err != nil {
		return productionSessionClaims{}, false
	}
	var claims productionSessionClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return productionSessionClaims{}, false
	}
	if strings.TrimSpace(claims.TenantID) == "" ||
		strings.TrimSpace(claims.UserID) == "" ||
		strings.TrimSpace(claims.WorkspaceID) == "" ||
		strings.TrimSpace(claims.CSRFHash) == "" {
		return productionSessionClaims{}, false
	}
	if role := strings.TrimSpace(claims.Role); role != "" && role != "user" && role != "admin" {
		return productionSessionClaims{}, false
	}
	claims.TenantID = strings.TrimSpace(claims.TenantID)
	claims.UserID = strings.TrimSpace(claims.UserID)
	claims.WorkspaceID = strings.TrimSpace(claims.WorkspaceID)
	claims.Role = "user"
	claims.CSRFHash = strings.TrimSpace(claims.CSRFHash)
	return claims, true
}

func csrfAllowed(ctx *gin.Context, actor productionActor) bool {
	header := strings.TrimSpace(ctx.GetHeader("X-MedOPL-CSRF"))
	if header == "" {
		return false
	}
	if strings.TrimSpace(actor.CSRFHash) == "" {
		return true
	}
	cookie, err := ctx.Cookie(productionCSRFCookieName)
	if err != nil || strings.TrimSpace(cookie) == "" {
		return false
	}
	if subtle.ConstantTimeCompare([]byte(header), []byte(strings.TrimSpace(cookie))) != 1 {
		return false
	}
	return hexHashMatches(header, actor.CSRFHash)
}

func writeSecurityError(ctx *gin.Context, status int, code string) {
	if status == http.StatusUnauthorized && code == "authentication_required" {
		ctx.AbortWithStatusJSON(status, gin.H{
			"ok":       false,
			"error":    "unauthenticated",
			"code":     code,
			"loginUrl": "/",
		})
		return
	}
	ctx.AbortWithStatusJSON(status, gin.H{"ok": false, "error": code})
}

func writeSecurityHeaders(ctx *gin.Context) {
	headers := ctx.Writer.Header()
	headers.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
	headers.Set("X-Content-Type-Options", "nosniff")
	headers.Set("X-Frame-Options", "DENY")
	headers.Set("Referrer-Policy", "no-referrer")
	headers.Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
}

func writeCORSHeaders(ctx *gin.Context) {
	headers := ctx.Writer.Header()
	if strings.TrimSpace(ctx.GetHeader("Origin")) == productionCORSOrigin {
		headers.Set("Access-Control-Allow-Origin", productionCORSOrigin)
	}
	headers.Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
	headers.Set("Access-Control-Allow-Headers", "Authorization,Content-Type,X-MedOPL-CSRF,X-MedOPL-Tenant-ID,X-MedOPL-User-ID,X-MedOPL-Workspace-ID,X-MedOPL-Webhook-Secret")
	headers.Set("Vary", "Origin")
}

func bearerToken(header string) string {
	value := strings.TrimSpace(header)
	if value == "" {
		return ""
	}
	prefix := "Bearer "
	if !strings.HasPrefix(value, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(value, prefix))
}

func hashMatches(raw string, expectedHash string) bool {
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(expectedHash) == "" {
		return false
	}
	sum := sha256.Sum256([]byte(raw))
	actual := hex.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(actual), []byte(strings.TrimSpace(expectedHash))) == 1
}

func hexHashMatches(raw string, expectedHash string) bool {
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(expectedHash) == "" {
		return false
	}
	sum := sha256.Sum256([]byte(raw))
	actual := hex.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(actual), []byte(strings.TrimSpace(expectedHash))) == 1
}

func headerValue(ctx *gin.Context, name string) string {
	return strings.TrimSpace(ctx.GetHeader(name))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
