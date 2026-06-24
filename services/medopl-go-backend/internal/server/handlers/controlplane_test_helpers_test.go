package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/secret/providersecret"
	controlplaneservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
)

func controlPlaneHandlerTestRouter() *gin.Engine {
	return controlPlaneHandlerTestRouterWithSecretRoot("")
}

func controlPlaneHandlerTestRouterWithSecretRoot(secretRoot string) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	options := []controlplaneservice.Option{}
	if strings.TrimSpace(secretRoot) != "" {
		options = append(options, controlplaneservice.WithProviderSecretStore(providersecret.NewFileStore(secretRoot)))
	}
	service := controlplaneservice.NewService(memory.NewControlPlaneStore(), options...)
	api := router.Group("/api")
	RegisterControlPlaneRoutes(api, service)
	return router
}

func prepareCreditUser(t *testing.T, router *gin.Engine, workspaceID string, amount float64) {
	t.Helper()
	postMap(t, router, "/api/v22/users/prepare", map[string]any{
		"tenantId":    "tenant-v22",
		"userId":      "user-v22",
		"workspaceId": workspaceID,
	})
	postMap(t, router, "/api/v22/users/credit", map[string]any{
		"tenantId":       "tenant-v22",
		"userId":         "user-v22",
		"workspaceId":    workspaceID,
		"amount":         amount,
		"currency":       "CNY",
		"idempotencyKey": "credit-" + workspaceID,
	})
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

func mapFromRecorder(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var decoded map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("decode response: %v body=%s", err, rec.Body.String())
	}
	return decoded
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

func assertJSONContains(t *testing.T, payload []byte, marker string) {
	t.Helper()
	if !strings.Contains(string(payload), marker) {
		t.Fatalf("json payload missing %s: %s", marker, string(payload))
	}
}

type leakingProviderSecretSink struct{}

func (leakingProviderSecretSink) WriteProviderSecret(string, providersecret.Secret) error {
	return errors.New("provider secret write failed: /tmp/provider-secrets/private-ref.json")
}
