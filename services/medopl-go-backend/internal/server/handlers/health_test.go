package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
)

func TestHealthReturnsDeterministicJSON(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.GET("/health", Health(config.Config{Service: "medopl-go-backend", Mode: "local", Port: 8789}))
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	got := strings.TrimSpace(rec.Body.String())
	want := "{\"checks\":{\"config\":\"ok\"},\"mode\":\"local\",\"service\":\"medopl-go-backend\",\"status\":\"ok\",\"version\":\"dev\"}"
	if got != want {
		t.Fatalf("health json mismatch\ngot:  %s\nwant: %s", got, want)
	}
}
