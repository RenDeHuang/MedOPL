package server

import (
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
)

type productionSessionBootstrapInput struct {
	TenantID    string `json:"tenantId"`
	UserID      string `json:"userId"`
	WorkspaceID string `json:"workspaceId"`
	Nonce       string `json:"nonce"`
	ExpiresAt   string `json:"expiresAt"`
	Signature   string `json:"signature"`
}

func productionSessionBootstrap(cfg config.Config) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if strings.TrimSpace(cfg.SessionSecretHash) == "" || strings.TrimSpace(cfg.SessionBootstrapHash) == "" {
			ctx.JSON(http.StatusServiceUnavailable, gin.H{"ok": false, "error": "session_bootstrap_not_configured"})
			return
		}
		var input productionSessionBootstrapInput
		if err := ctx.ShouldBindJSON(&input); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_session_bootstrap_payload"})
			return
		}
		claims, ok := validatedProductionSessionBootstrap(input, cfg.SessionBootstrapHash, time.Now)
		if !ok {
			ctx.JSON(http.StatusUnauthorized, gin.H{"ok": false, "error": "session_bootstrap_signature_required"})
			return
		}
		csrfToken := config.TokenHash(claims.Nonce + ":" + claims.WorkspaceID)[:32]
		sessionCookieValue, ok := signedProductionSessionCookieValue(productionSessionClaims{
			TenantID:    claims.TenantID,
			UserID:      claims.UserID,
			WorkspaceID: claims.WorkspaceID,
			Role:        "user",
			CSRFHash:    config.TokenHash(csrfToken),
		}, cfg.SessionSecretHash)
		if !ok {
			ctx.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "session_cookie_sign_failed"})
			return
		}
		writeProductionSessionCookies(ctx, sessionCookieValue, csrfToken, time.Hour)
		ctx.JSON(http.StatusOK, gin.H{
			"ok":          true,
			"tenantId":    claims.TenantID,
			"userId":      claims.UserID,
			"workspaceId": claims.WorkspaceID,
			"session":     "issued",
		})
	}
}

func productionLogout() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		clearProductionSessionCookies(ctx)
		ctx.Redirect(http.StatusFound, "/")
	}
}

func validatedProductionSessionBootstrap(input productionSessionBootstrapInput, bootstrapHash string, now func() time.Time) (productionSessionBootstrapInput, bool) {
	input.TenantID = strings.TrimSpace(input.TenantID)
	input.UserID = strings.TrimSpace(input.UserID)
	input.WorkspaceID = strings.TrimSpace(input.WorkspaceID)
	input.Nonce = strings.TrimSpace(input.Nonce)
	input.ExpiresAt = strings.TrimSpace(input.ExpiresAt)
	input.Signature = strings.TrimSpace(input.Signature)
	if input.TenantID == "" || input.UserID == "" || input.WorkspaceID == "" || input.Nonce == "" || input.ExpiresAt == "" {
		return productionSessionBootstrapInput{}, false
	}
	expiresAt, err := time.Parse(time.RFC3339, input.ExpiresAt)
	if err != nil || !expiresAt.After(now().UTC()) {
		return productionSessionBootstrapInput{}, false
	}
	expectedInput := productionSessionBootstrapSignature(input.TenantID, input.UserID, input.WorkspaceID, input.Nonce, input.ExpiresAt, bootstrapHash)
	if subtleCompareHex(input.Signature, expectedInput) != true {
		return productionSessionBootstrapInput{}, false
	}
	return input, true
}

func productionSessionBootstrapSignature(tenantID string, userID string, workspaceID string, nonce string, expiresAt string, bootstrapHash string) string {
	return config.TokenHash(strings.Join([]string{
		strings.TrimSpace(tenantID),
		strings.TrimSpace(userID),
		strings.TrimSpace(workspaceID),
		strings.TrimSpace(nonce),
		strings.TrimSpace(expiresAt),
		strings.TrimSpace(bootstrapHash),
	}, ":"))
}

func signedProductionSessionCookieValue(claims productionSessionClaims, sessionSecretHash string) (string, bool) {
	claims.Role = "user"
	claims.TenantID = strings.TrimSpace(claims.TenantID)
	claims.UserID = strings.TrimSpace(claims.UserID)
	claims.WorkspaceID = strings.TrimSpace(claims.WorkspaceID)
	claims.CSRFHash = strings.TrimSpace(claims.CSRFHash)
	if claims.TenantID == "" || claims.UserID == "" || claims.WorkspaceID == "" || claims.CSRFHash == "" {
		return "", false
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", false
	}
	payloadHex := hex.EncodeToString(payload)
	signature := config.TokenHash(payloadHex + ":" + strings.TrimSpace(sessionSecretHash))
	return payloadHex + "." + signature, true
}

func writeProductionSessionCookies(ctx *gin.Context, sessionCookieValue string, csrfToken string, maxAge time.Duration) {
	maxAgeSeconds := int(maxAge.Seconds())
	http.SetCookie(ctx.Writer, &http.Cookie{
		Name:     productionSessionCookieName,
		Value:    sessionCookieValue,
		Path:     "/",
		MaxAge:   maxAgeSeconds,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	http.SetCookie(ctx.Writer, &http.Cookie{
		Name:     productionCSRFCookieName,
		Value:    csrfToken,
		Path:     "/",
		MaxAge:   maxAgeSeconds,
		Secure:   true,
		HttpOnly: false,
		SameSite: http.SameSiteStrictMode,
	})
}

func clearProductionSessionCookies(ctx *gin.Context) {
	for _, name := range []string{productionSessionCookieName, productionCSRFCookieName} {
		http.SetCookie(ctx.Writer, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			Secure:   true,
			HttpOnly: name == productionSessionCookieName,
			SameSite: http.SameSiteStrictMode,
		})
	}
}

func subtleCompareHex(left string, right string) bool {
	return subtle.ConstantTimeCompare([]byte(strings.TrimSpace(left)), []byte(strings.TrimSpace(right))) == 1
}
