package server

import (
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
}
