package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
)

func TestConfigCheckReturnsOkForValidConfig(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.GET("/config/check", ConfigCheck(config.Config{Service: "medopl-go-backend", Mode: "local", Port: 8789, ProviderSecretRoot: t.TempDir()}))
	req := httptest.NewRequest(http.MethodGet, "/config/check", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var payload ConfigCheckPayload
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal config check: %v", err)
	}
	if !payload.Ok || payload.Status != "ok" || payload.Service != "medopl-go-backend" {
		t.Fatalf("unexpected config check payload: %+v", payload)
	}
}

func TestConfigCheckFailsClosedForInvalidConfig(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.GET("/config/check", ConfigCheck(config.Config{Service: "medopl-go-backend", Port: 8789}))
	req := httptest.NewRequest(http.MethodGet, "/config/check", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rec.Code)
	}
	var payload ConfigCheckPayload
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal config check: %v", err)
	}
	if payload.Ok || payload.Status != "failed" || payload.Error == "" {
		t.Fatalf("expected failed config payload: %+v", payload)
	}
}
