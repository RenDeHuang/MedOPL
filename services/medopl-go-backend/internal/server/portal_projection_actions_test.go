package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
)

func TestGoPortalProjectionAdminActionsPersistLocalState(t *testing.T) {
	stateRoot := t.TempDir()
	cfg := config.Config{Service: "medopl-go-backend", Mode: "local", Port: 8789, ProviderSecretRoot: t.TempDir(), PortalStateRoot: stateRoot}
	router := Router(cfg)
	email := "go-action-user@example.test"

	postAction(t, router, "create-user", map[string]any{
		"name":     "Go Action User",
		"email":    email,
		"password": "Password123!",
	})
	users := getJSONMap(t, router, "/api/admin/users")
	user := findUserByEmail(t, users, email)
	if user["name"] != "Go Action User" || user["status"] != "active" || numberFrom(user["balance"]) != 0 {
		t.Fatalf("created user mismatch: %+v", user)
	}
	userID := stringFrom(user["id"])

	postAction(t, router, "recharge", map[string]any{"userId": userID, "amount": 120})
	postAction(t, router, "ledger-adjust", map[string]any{"userId": userID, "amount": 30, "actionType": "refund", "reason": "unit test"})
	users = getJSONMap(t, router, "/api/admin/users")
	user = findUserByEmail(t, users, email)
	if numberFrom(user["balance"]) != 90 {
		t.Fatalf("balance after local actions = %+v", user)
	}
	financeRows, _ := users["financeRows"].([]any)
	refundRow := findFinanceRowByType(t, financeRows, "refund")
	if numberFrom(refundRow["amount"]) != -30 {
		t.Fatalf("refund ledger amount must be negative: %+v", refundRow)
	}

	postAction(t, router, "announcements-save", map[string]any{
		"title":   "Go Action Announcement",
		"content": "Announcement saved through Go local RC action.",
		"status":  "active",
		"pinned":  true,
	})
	announcements := getJSONMap(t, router, "/api/announcements")
	if !jsonContains(announcements, "Go Action Announcement") {
		t.Fatalf("announcement not visible after save: %+v", announcements)
	}

	restartedRouter := Router(cfg)
	restartedUsers := getJSONMap(t, restartedRouter, "/api/admin/users")
	restartedUser := findUserByEmail(t, restartedUsers, email)
	if numberFrom(restartedUser["balance"]) != 90 {
		t.Fatalf("balance after router restart = %+v", restartedUser)
	}
	restartedAnnouncements := getJSONMap(t, restartedRouter, "/api/announcements")
	if !jsonContains(restartedAnnouncements, "Go Action Announcement") {
		t.Fatalf("announcement not visible after router restart: %+v", restartedAnnouncements)
	}
	export := getText(t, restartedRouter, "/api/billing/export.csv")
	if !strings.Contains(export, "finance-local-rc-extra-1") || !strings.Contains(export, "finance-local-rc-extra-2") {
		t.Fatalf("billing export did not include persisted finance rows: %s", export)
	}

	postAction(t, router, "announcements-delete", map[string]any{"id": "announcement-local-rc-extra-1"})
	announcements = getJSONMap(t, router, "/api/announcements")
	if jsonContains(announcements, "Go Action Announcement") {
		t.Fatalf("announcement still visible after delete: %+v", announcements)
	}
}

func TestGoPortalProjectionStateFailsClosedOnInvalidStateFile(t *testing.T) {
	stateRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(stateRoot, "portal-projection-state.json"), []byte("{invalid-json"), 0o600); err != nil {
		t.Fatal(err)
	}
	router := Router(config.Config{Service: "medopl-go-backend", Mode: "local", Port: 8789, ProviderSecretRoot: t.TempDir(), PortalStateRoot: stateRoot})
	req := httptest.NewRequest(http.MethodGet, "/config/check", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("config check status = %d body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "MEDOPL_PORTAL_STATE_ROOT") {
		t.Fatalf("config check did not report portal state root failure: %s", rec.Body.String())
	}
}

func getText(t *testing.T, router http.Handler, path string) string {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s status = %d body = %s", path, rec.Code, rec.Body.String())
	}
	return rec.Body.String()
}

func postAction(t *testing.T, router http.Handler, action string, payload map[string]any) {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/admin/actions/"+action, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s status = %d body = %s", action, rec.Code, rec.Body.String())
	}
}

func getJSONMap(t *testing.T, router http.Handler, path string) map[string]any {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s status = %d body = %s", path, rec.Code, rec.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	return payload
}

func findUserByEmail(t *testing.T, payload map[string]any, email string) map[string]any {
	t.Helper()
	items, ok := payload["items"].([]any)
	if !ok {
		t.Fatalf("items missing from payload: %+v", payload)
	}
	for _, item := range items {
		user, ok := item.(map[string]any)
		if ok && user["email"] == email {
			return user
		}
	}
	t.Fatalf("user %s not found in %+v", email, payload)
	return nil
}

func findFinanceRowByType(t *testing.T, rows []any, rowType string) map[string]any {
	t.Helper()
	for _, item := range rows {
		row, ok := item.(map[string]any)
		if ok && row["type"] == rowType {
			return row
		}
	}
	t.Fatalf("finance row type %s not found in %+v", rowType, rows)
	return nil
}

func jsonContains(payload map[string]any, needle string) bool {
	encoded, _ := json.Marshal(payload)
	return strings.Contains(string(encoded), needle)
}

func stringFrom(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

func numberFrom(value any) float64 {
	if number, ok := value.(float64); ok {
		return number
	}
	if number, ok := value.(int); ok {
		return float64(number)
	}
	return 0
}
