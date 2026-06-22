package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/secret/providersecret"
	controlplaneservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
)

func TestControlPlaneHandlersExposeProviderLaunchBillingResourceLocalRC(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "local-rc-provider-key-material-that-must-stay-private"

	bindResponse := postMap(t, router, "/api/provider/bind", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "bind-provider-once",
	})
	assertPublicPayload(t, bindResponse, rawProviderKey)
	if bindResponse["providerBound"] != true || bindResponse["providerKeyRef"] == "" {
		t.Fatalf("bind response = %+v", bindResponse)
	}

	preflightResponse := postMap(t, router, "/api/provider/preflight", map[string]any{
		"workspaceId": "workspace-v22",
	})
	if preflightResponse["readyForManagedEnvironment"] != true || preflightResponse["launchStatus"] != "ready_for_launch" {
		t.Fatalf("preflight response = %+v", preflightResponse)
	}
	oplEntryPreflightResponse := postMap(t, router, "/api/opl/entry/preflight", map[string]any{
		"workspaceId": "workspace-v22",
	})
	if oplEntryPreflightResponse["readyForManagedEnvironment"] != true || oplEntryPreflightResponse["launchStatus"] != "ready_for_launch" {
		t.Fatalf("opl entry preflight response = %+v", oplEntryPreflightResponse)
	}

	launchResponse := postMap(t, router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "open-once",
	})
	assertPublicPayload(t, launchResponse, rawProviderKey)
	if launchResponse["launchStatus"] != "ready" || launchResponse["providerBound"] != true {
		t.Fatalf("launch response = %+v", launchResponse)
	}
	launchID := launchResponse["launchId"].(string)

	statusResponse := getMap(t, router, "/api/opl/launch-status/"+launchID)
	if statusResponse["status"] != "ready" || statusResponse["gatewayReady"] != true {
		t.Fatalf("status response = %+v", statusResponse)
	}

	bootstrapResponse := getMap(t, router, "/api/opl/bootstrap?launchId="+launchID)
	if bootstrapResponse["runtimeBridgeContractVersion"] != "v22-local-rc" {
		t.Fatalf("bootstrap response = %+v", bootstrapResponse)
	}

	fileResponse := postMap(t, router, "/api/opl/files?launchId="+launchID, map[string]any{
		"fileName":     "measurements.csv",
		"relativePath": "inputs/measurements.csv",
		"contentType":  "text/csv",
		"sizeBytes":    128,
	})
	if fileResponse["ok"] != true || fileResponse["fileRef"] == "" {
		t.Fatalf("file response = %+v", fileResponse)
	}

	runResponse := postMap(t, router, "/api/opl/runs?launchId="+launchID, map[string]any{
		"message":  "analyze file",
		"fileRefs": []any{fileResponse["fileRef"]},
		"toolName": "opl-workbench",
	})
	if runResponse["ok"] != true || runResponse["status"] != "succeeded" {
		t.Fatalf("run response = %+v", runResponse)
	}

	billingResponse := getMap(t, router, "/api/billing/summary?workspaceId=workspace-v22")
	if billingResponse["todayCost"] == nil || billingResponse["source"] != "go-control-plane" || billingResponse["runCount"] != float64(1) || billingResponse["ledgerCount"] == nil {
		t.Fatalf("billing response = %+v", billingResponse)
	}

	resourcesResponse := getMap(t, router, "/api/platform-provisioned-resources?workspaceId=workspace-v22")
	if resourcesResponse["source"] != "go-control-plane" || resourcesResponse["ok"] != true {
		t.Fatalf("resources response = %+v", resourcesResponse)
	}

	releaseResponse := postMap(t, router, "/api/v22/managed-environment/release", map[string]any{
		"workspaceId":       "workspace-v22",
		"resourceBindingId": launchResponse["resourceBindingId"],
		"stopBilling":       true,
		"idempotencyKey":    "release-once",
	})
	if releaseResponse["billingStopped"] != true || releaseResponse["status"] != "released" {
		t.Fatalf("release response = %+v", releaseResponse)
	}
	if releaseResponse["auditEventId"] == "" {
		t.Fatalf("release response must expose top-level auditEventId for production canary: %+v", releaseResponse)
	}
	releaseAuditEvent := releaseResponse["auditEvent"].(map[string]any)
	if releaseResponse["auditEventId"] != releaseAuditEvent["id"] {
		t.Fatalf("release auditEventId mismatch: %+v", releaseResponse)
	}
}

func TestControlPlaneHandlersFailClosedForUnknownFileAndArtifactRefs(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "local-rc-provider-key-material-that-must-stay-private"

	_ = postMap(t, router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "bind-provider-once",
	})
	launchResponse := postMap(t, router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "open-once",
	})
	launchID := launchResponse["launchId"].(string)

	missingFileRun := postRaw(router, "/api/opl/runs?launchId="+launchID, map[string]any{
		"message":   "analyze missing file",
		"fileRefs":  []any{"file-missing"},
		"toolName":  "opl-workbench",
		"requestId": "run-missing-file",
	})
	if missingFileRun.Code != http.StatusBadRequest || !strings.Contains(missingFileRun.Body.String(), "file_ref_required") {
		t.Fatalf("missing file run status = %d body = %s", missingFileRun.Code, missingFileRun.Body.String())
	}
	assertPublicPayload(t, mapFromRecorder(t, missingFileRun), rawProviderKey)

	missingArtifact := httptest.NewRecorder()
	request, _ := http.NewRequest(http.MethodGet, "/api/opl/artifacts/artifact-missing?launchId="+launchID, nil)
	router.ServeHTTP(missingArtifact, request)
	if missingArtifact.Code != http.StatusBadRequest || !strings.Contains(missingArtifact.Body.String(), "artifact_ref_required") {
		t.Fatalf("missing artifact status = %d body = %s", missingArtifact.Code, missingArtifact.Body.String())
	}
	assertPublicPayload(t, mapFromRecorder(t, missingArtifact), rawProviderKey)
}

func TestControlPlaneHandlersExposeV22GoTakeoverProviderOpenShape(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "local-rc-provider-key-material-that-must-stay-private"

	prepareResponse := postMap(t, router, "/api/v22/users/prepare", map[string]any{
		"tenantId":    "tenant-v22",
		"userId":      "user-v22",
		"workspaceId": "workspace-v22",
	})
	if prepareResponse["source"] != "go-control-plane" || prepareResponse["status"] != "prepared" {
		t.Fatalf("prepare response = %+v", prepareResponse)
	}

	creditResponse := postMap(t, router, "/api/v22/users/credit", map[string]any{
		"workspaceId": "workspace-v22",
		"amount":      100,
	})
	if creditResponse["source"] != "go-control-plane" || creditResponse["balance"] == nil {
		t.Fatalf("credit response = %+v", creditResponse)
	}

	blocked := postRaw(router, "/api/v22/managed-environment/readiness", map[string]any{
		"workspaceId": "workspace-v22",
	})
	if blocked.Code != http.StatusPreconditionRequired || !strings.Contains(blocked.Body.String(), "provider_key_required") {
		t.Fatalf("readiness without provider status = %d body = %s", blocked.Code, blocked.Body.String())
	}

	bindResponse := postMap(t, router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "v22-provider-key-once",
	})
	assertPublicPayload(t, bindResponse, rawProviderKey)
	if bindResponse["providerBound"] != true || bindResponse["providerKeyRef"] == "" {
		t.Fatalf("bind response = %+v", bindResponse)
	}

	readinessResponse := postMap(t, router, "/api/v22/managed-environment/readiness", map[string]any{
		"workspaceId": "workspace-v22",
	})
	if readinessResponse["readyForManagedEnvironment"] != true || readinessResponse["providerKeyRef"] != bindResponse["providerKeyRef"] {
		t.Fatalf("readiness response = %+v", readinessResponse)
	}

	openResponse := postMap(t, router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "v22-open-once",
	})
	assertPublicPayload(t, openResponse, rawProviderKey)
	if openResponse["launchStatus"] != "ready" || openResponse["providerBound"] != true || openResponse["resourceBindingId"] == "" {
		t.Fatalf("open response = %+v", openResponse)
	}
}

func TestControlPlaneHandlersExposeOPLWebuiRuntimeGate(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "runtime-gate-provider-key-material-that-must-stay-private"

	ordinaryChat := postMap(t, router, "/api/opl/runtime-gate", map[string]any{
		"workspaceId":    "workspace-v22",
		"invocationMode": "ordinary_chat",
		"runtimePlanId":  "starter_2c4g_10gb",
		"storagePlanId":  "workspace_10gb",
	})
	assertPublicPayload(t, ordinaryChat, rawProviderKey)
	if ordinaryChat["productOwner"] != "medopl" || ordinaryChat["primaryConsumer"] != "opl-webui" {
		t.Fatalf("ordinary runtime gate owner boundary = %+v", ordinaryChat)
	}
	if ordinaryChat["medoplRuntimeRequired"] != false || ordinaryChat["nextAction"] != "continue_in_opl_webui" {
		t.Fatalf("ordinary runtime gate = %+v", ordinaryChat)
	}
	ordinaryConsumer := ordinaryChat["consumerProjection"].(map[string]any)
	if ordinaryConsumer["chatSurface"] != "opl-webui" || ordinaryConsumer["runSurface"] != "none" {
		t.Fatalf("ordinary runtime consumer projection = %+v", ordinaryConsumer)
	}
	if ordinaryConsumer["uploadEnabled"] != false || ordinaryConsumer["runEnabled"] != false || ordinaryConsumer["artifactEnabled"] != false {
		t.Fatalf("ordinary runtime consumer actions = %+v", ordinaryConsumer)
	}

	bindResponse := postMap(t, router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "runtime-gate-provider-once",
	})
	openResponse := postMap(t, router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "runtime-gate-open-once",
	})

	runtimeRequired := postMap(t, router, "/api/opl/runtime-gate", map[string]any{
		"workspaceId":    "workspace-v22",
		"invocationMode": "runtime_required",
		"runtimePlanId":  "starter_2c4g_10gb",
		"storagePlanId":  "workspace_10gb",
	})
	assertPublicPayload(t, runtimeRequired, rawProviderKey)
	if runtimeRequired["medoplRuntimeRequired"] != true || runtimeRequired["runtimeBindingId"] != openResponse["resourceBindingId"] {
		t.Fatalf("runtime required gate = %+v", runtimeRequired)
	}
	if runtimeRequired["providerKeyRef"] != bindResponse["providerKeyRef"] || runtimeRequired["storageBindingId"] == "" {
		t.Fatalf("runtime required provider/storage = %+v", runtimeRequired)
	}
	nodePool := runtimeRequired["nodePoolProjection"].(map[string]any)
	if nodePool["nodePoolRef"] == "" || nodePool["state"] != "ready" || nodePool["customerVisible"] != false {
		t.Fatalf("runtime required node pool projection = %+v", nodePool)
	}
	release := runtimeRequired["release"].(map[string]any)
	if release["canReleaseRuntime"] != true || release["destroyStorage"] != "requires_explicit_user_intent" {
		t.Fatalf("runtime required release projection = %+v", release)
	}
	consumerProjection := runtimeRequired["consumerProjection"].(map[string]any)
	if consumerProjection["chatSurface"] != "opl-webui" || consumerProjection["runSurface"] != "opl-webui_with_medopl_runtime" {
		t.Fatalf("runtime required consumer surface = %+v", consumerProjection)
	}
	if consumerProjection["uploadEnabled"] != true || consumerProjection["runEnabled"] != true || consumerProjection["artifactEnabled"] != true {
		t.Fatalf("runtime required consumer actions = %+v", consumerProjection)
	}
	if consumerProjection["releaseAction"] != "release_runtime_stop_billing" || consumerProjection["storageAction"] != "retain_storage_until_explicit_destroy" {
		t.Fatalf("runtime required consumer release/storage = %+v", consumerProjection)
	}
}

func TestControlPlaneProductionBootstrapContractFailsClosed(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "production-bootstrap-raw-provider-key-must-not-leak"

	for _, target := range []string{
		"/api/v22/production/bootstrap/plan",
		"/api/v22/production/bootstrap/commit",
	} {
		rec := postRaw(router, target, map[string]any{
			"firstAdmin": map[string]any{
				"email":    "founder@example.invalid",
				"password": "portal-admin-password-must-not-leak",
			},
			"tenant": map[string]any{
				"id": "tenant-production-seed",
			},
			"workspace": map[string]any{
				"id":             "workspace-production-seed",
				"providerKeyRef": "gflab:workspace-production-seed:refonly001122",
			},
			"rawProviderKey": rawProviderKey,
		})
		if rec.Code != http.StatusPreconditionRequired {
			t.Fatalf("%s status = %d body = %s", target, rec.Code, rec.Body.String())
		}
		body := rec.Body.String()
		for _, required := range []string{
			"production_launch_gap_01_bootstrap_contract_local_gate",
			"contract-only",
			"blocked_until_multi_tenant_minimum_launch_closure",
			"providerKeyRef",
		} {
			if !strings.Contains(body, required) {
				t.Fatalf("%s response missing %q: %s", target, required, body)
			}
		}
		for _, forbidden := range []string{
			rawProviderKey,
			"portal-admin-password-must-not-leak",
			"rawProviderKey",
			"launchToken",
			"runtimeToken",
			"Ingress",
			"LoadBalancer",
		} {
			if strings.Contains(body, forbidden) {
				t.Fatalf("%s response leaked forbidden marker %q: %s", target, forbidden, body)
			}
		}
	}
}

func TestControlPlaneProductionPackageCOperationContractFailsClosed(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "production-operation-raw-provider-key-must-not-leak"

	for _, target := range []string{
		"/api/v22/production/package-c-operation/plan",
		"/api/v22/production/package-c-operation/commit",
	} {
		rec := postRaw(router, target, map[string]any{
			"tenantId":             "tenant-production-alpha",
			"accountId":            "account-production-alpha",
			"workspaceId":          "workspace-production-alpha",
			"resourceBindingId":    "rb-production-alpha",
			"billingAttributionId": "bill-production-alpha",
			"serverPlanId":         "starter_2c4g_10gb",
			"providerKeyRef":       "gflab:workspace-production-alpha:refonly001122",
			"idempotencyKey":       "workspace-provision-alpha-once",
			"rawProviderKey":       rawProviderKey,
			"bearerToken":          "bearer-token-must-not-leak",
			"tencentSecretId":      "tencent-secret-id-must-not-leak",
			"tencentSecretKey":     "tencent-secret-key-must-not-leak",
		})
		if rec.Code != http.StatusPreconditionRequired {
			t.Fatalf("%s status = %d body = %s", target, rec.Code, rec.Body.String())
		}
		body := rec.Body.String()
		for _, required := range []string{
			"production_launch_gap_02_package_c_operation_contract_local_gate",
			"contract-only",
			"production_launch_operation_required",
			"production-launch-operation-runner.js",
			"requested",
			"creating",
			"ready",
			"providerKeyRef",
			"blocked_until_multi_tenant_minimum_launch_closure",
		} {
			if !strings.Contains(body, required) {
				t.Fatalf("%s response missing %q: %s", target, required, body)
			}
		}
		for _, forbidden := range []string{
			rawProviderKey,
			"bearer-token-must-not-leak",
			"tencent-secret-id-must-not-leak",
			"tencent-secret-key-must-not-leak",
			"rawProviderKey",
			"bearerToken",
			"tencentSecretId",
			"tencentSecretKey",
			"Ingress",
			"LoadBalancer",
			"kubectl",
		} {
			if strings.Contains(body, forbidden) {
				t.Fatalf("%s response leaked forbidden marker %q: %s", target, forbidden, body)
			}
		}
	}
}

func TestControlPlaneProductionLedgerContractFailsClosed(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "production-ledger-raw-provider-key-must-not-leak"

	for _, target := range []string{
		"/api/v22/production/ledger/plan",
		"/api/v22/production/ledger/commit",
	} {
		rec := postRaw(router, target, map[string]any{
			"tenantId":             "tenant-production-alpha",
			"accountId":            "account-production-alpha",
			"workspaceId":          "workspace-production-alpha",
			"resourceBindingId":    "rb-production-alpha",
			"billingAttributionId": "bill-production-alpha",
			"serverPlanId":         "starter_2c4g_10gb",
			"workspaceStorageGb":   10,
			"cloudProvider":        "tencent",
			"region":               "ap-guangzhou",
			"clusterId":            "cls-fi097sy4",
			"nodePoolName":         "medopl-tenant-production-alpha",
			"providerKeyRef":       "gflab:workspace-production-alpha:refonly001122",
			"idempotencyKey":       "workspace-ledger-alpha-once",
			"rawProviderKey":       rawProviderKey,
			"dbPassword":           "postgres-password-must-not-leak",
			"bearerToken":          "bearer-token-must-not-leak",
			"tencentSecretId":      "tencent-secret-id-must-not-leak",
			"tencentSecretKey":     "tencent-secret-key-must-not-leak",
		})
		if rec.Code != http.StatusPreconditionRequired {
			t.Fatalf("%s status = %d body = %s", target, rec.Code, rec.Body.String())
		}
		body := rec.Body.String()
		for _, required := range []string{
			"production_launch_gap_03_resourcebinding_postgresql_ledger_contract_local_gate",
			"contract-only",
			"production_launch_ledger_required",
			"production-launch-ledger-runner.js",
			"resource_bindings",
			"cloud_operations",
			"operation_id",
			"resource_binding_id",
			"requested",
			"creating",
			"ready",
			"providerKeyRef",
			"blocked_until_multi_tenant_minimum_launch_closure",
		} {
			if !strings.Contains(body, required) {
				t.Fatalf("%s response missing %q: %s", target, required, body)
			}
		}
		for _, forbidden := range []string{
			rawProviderKey,
			"postgres-password-must-not-leak",
			"bearer-token-must-not-leak",
			"tencent-secret-id-must-not-leak",
			"tencent-secret-key-must-not-leak",
			"rawProviderKey",
			"dbPassword",
			"bearerToken",
			"tencentSecretId",
			"tencentSecretKey",
			"Ingress",
			"LoadBalancer",
			"kubectl",
		} {
			if strings.Contains(body, forbidden) {
				t.Fatalf("%s response leaked forbidden marker %q: %s", target, forbidden, body)
			}
		}
	}
}

func TestControlPlaneProductionCommercialLedgerContractFailsClosed(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "production-commercial-ledger-raw-provider-key-must-not-leak"

	for _, target := range []string{
		"/api/v22/production/commercial-ledger/plan",
		"/api/v22/production/commercial-ledger/commit",
	} {
		rec := postRaw(router, target, map[string]any{
			"tenantId":             "tenant-production-alpha",
			"accountId":            "account-production-alpha",
			"workspaceId":          "workspace-production-alpha",
			"resourceBindingId":    "rb-production-alpha",
			"cloudOperationId":     "op-production-alpha",
			"billingAttributionId": "bill-production-alpha",
			"serverPlanId":         "starter_2c4g_10gb",
			"workspaceStorageGb":   10,
			"providerKeyRef":       "gflab:workspace-production-alpha:refonly001122",
			"idempotencyKey":       "workspace-commercial-ledger-alpha-once",
			"rawProviderKey":       rawProviderKey,
			"dbPassword":           "postgres-password-must-not-leak",
			"bearerToken":          "bearer-token-must-not-leak",
			"tencentSecretId":      "tencent-secret-id-must-not-leak",
			"tencentSecretKey":     "tencent-secret-key-must-not-leak",
		})
		if rec.Code != http.StatusPreconditionRequired {
			t.Fatalf("%s status = %d body = %s", target, rec.Code, rec.Body.String())
		}
		body := rec.Body.String()
		for _, required := range []string{
			"production_launch_gap_04_billing_audit_quota_ledger_contract_local_gate",
			"contract-only",
			"production_launch_commercial_ledger_required",
			"production-launch-commercial-ledger-runner.js",
			"billing_events",
			"audit_events",
			"quota_ledger",
			"resource_binding_id",
			"cloud_operation_id",
			"billing_attribution_id",
			"providerKeyRef",
			"blocked_until_multi_tenant_minimum_launch_closure",
		} {
			if !strings.Contains(body, required) {
				t.Fatalf("%s response missing %q: %s", target, required, body)
			}
		}
		for _, forbidden := range []string{
			rawProviderKey,
			"postgres-password-must-not-leak",
			"bearer-token-must-not-leak",
			"tencent-secret-id-must-not-leak",
			"tencent-secret-key-must-not-leak",
			"rawProviderKey",
			"dbPassword",
			"bearerToken",
			"tencentSecretId",
			"tencentSecretKey",
			"Ingress",
			"LoadBalancer",
			"kubectl",
		} {
			if strings.Contains(body, forbidden) {
				t.Fatalf("%s response leaked forbidden marker %q: %s", target, forbidden, body)
			}
		}
	}
}

func TestControlPlaneProductionWorkspaceLifecycleContractFailsClosed(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "production-workspace-lifecycle-raw-provider-key-must-not-leak"

	for _, target := range []string{
		"/api/v22/production/workspace-lifecycle/plan",
		"/api/v22/production/workspace-lifecycle/commit",
	} {
		rec := postRaw(router, target, map[string]any{
			"tenantId":             "tenant-production-alpha",
			"accountId":            "account-production-alpha",
			"workspaceId":          "workspace-production-alpha",
			"resourceBindingId":    "rb-production-alpha",
			"cloudOperationId":     "op-production-alpha",
			"billingAttributionId": "bill-production-alpha",
			"serverPlanId":         "starter_2c4g_10gb",
			"providerKeyRef":       "gflab:workspace-production-alpha:refonly001122",
			"idempotencyKey":       "workspace-lifecycle-alpha-once",
			"rawProviderKey":       rawProviderKey,
			"dbPassword":           "postgres-password-must-not-leak",
			"bearerToken":          "bearer-token-must-not-leak",
			"tencentSecretId":      "tencent-secret-id-must-not-leak",
			"tencentSecretKey":     "tencent-secret-key-must-not-leak",
		})
		if rec.Code != http.StatusPreconditionRequired {
			t.Fatalf("%s status = %d body = %s", target, rec.Code, rec.Body.String())
		}
		body := rec.Body.String()
		for _, required := range []string{
			"production_launch_gap_05_workspace_lifecycle_contract_local_gate",
			"contract-only",
			"production_launch_workspace_lifecycle_required",
			"production-launch-workspace-lifecycle-runner.js",
			"suspend",
			"resume",
			"delete",
			"resource_bindings",
			"cloud_operations",
			"billing_events",
			"audit_events",
			"quota_ledger",
			"resource_binding_id",
			"cloud_operation_id",
			"providerKeyRef",
			"blocked_until_multi_tenant_minimum_launch_closure",
		} {
			if !strings.Contains(body, required) {
				t.Fatalf("%s response missing %q: %s", target, required, body)
			}
		}
		for _, forbidden := range []string{
			rawProviderKey,
			"postgres-password-must-not-leak",
			"bearer-token-must-not-leak",
			"tencent-secret-id-must-not-leak",
			"tencent-secret-key-must-not-leak",
			"rawProviderKey",
			"dbPassword",
			"bearerToken",
			"tencentSecretId",
			"tencentSecretKey",
			"Ingress",
			"LoadBalancer",
			"kubectl",
		} {
			if strings.Contains(body, forbidden) {
				t.Fatalf("%s response leaked forbidden marker %q: %s", target, forbidden, body)
			}
		}
	}
}

func TestControlPlaneProductionCanaryContractFailsClosed(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "production-canary-raw-provider-key-must-not-leak"

	for _, target := range []string{
		"/api/v22/production/canary/plan",
		"/api/v22/production/canary/commit",
	} {
		rec := postRaw(router, target, map[string]any{
			"tenantId":             "tenant-production-alpha",
			"accountId":            "account-production-alpha",
			"workspaceId":          "workspace-production-alpha",
			"resourceBindingId":    "rb-production-alpha",
			"cloudOperationId":     "op-production-alpha",
			"billingAttributionId": "bill-production-alpha",
			"serverPlanId":         "starter_2c4g_10gb",
			"providerKeyRef":       "gflab:workspace-production-alpha:refonly001122",
			"idempotencyKey":       "production-canary-alpha-once",
			"rawProviderKey":       rawProviderKey,
			"dbPassword":           "postgres-password-must-not-leak",
			"bearerToken":          "bearer-token-must-not-leak",
			"tencentSecretId":      "tencent-secret-id-must-not-leak",
			"tencentSecretKey":     "tencent-secret-key-must-not-leak",
		})
		if rec.Code != http.StatusPreconditionRequired {
			t.Fatalf("%s status = %d body = %s", target, rec.Code, rec.Body.String())
		}
		body := rec.Body.String()
		for _, required := range []string{
			"production_launch_gap_06_canary_rollback_cleanup_contract_local_gate",
			"contract-only",
			"production_launch_canary_required",
			"production-launch-canary-runner.js",
			"admin_identity_smoke",
			"tenant_smoke",
			"workspace_smoke",
			"portal_backend_package_c_dry_run_boundary",
			"resource_bindings",
			"cloud_operations",
			"billing_events",
			"audit_events",
			"quota_ledger",
			"rollbackPlanRequired",
			"cleanupPlanRequired",
			"providerKeyRef",
			"blocked_until_multi_tenant_minimum_launch_closure",
		} {
			if !strings.Contains(body, required) {
				t.Fatalf("%s response missing %q: %s", target, required, body)
			}
		}
		for _, forbidden := range []string{
			rawProviderKey,
			"postgres-password-must-not-leak",
			"bearer-token-must-not-leak",
			"tencent-secret-id-must-not-leak",
			"tencent-secret-key-must-not-leak",
			"rawProviderKey",
			"dbPassword",
			"bearerToken",
			"tencentSecretId",
			"tencentSecretKey",
			"Ingress",
			"LoadBalancer",
			"kubectl",
		} {
			if strings.Contains(body, forbidden) {
				t.Fatalf("%s response leaked forbidden marker %q: %s", target, forbidden, body)
			}
		}
	}
}

func TestControlPlaneExternalAccessStrategyContractFailsClosed(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "external-access-raw-provider-key-must-not-leak"

	for _, target := range []string{
		"/api/v22/production/external-access-strategy/plan",
		"/api/v22/production/external-access-strategy/commit",
	} {
		rec := postRaw(router, target, map[string]any{
			"portalHost":          "portal.medopl.example.com",
			"ingressClass":        "nginx",
			"tlsSecretName":       "medopl-portal-tls",
			"externalSmokeUrl":    "https://portal.medopl.example.com/health",
			"providerKeyRef":      "gflab:workspace-production-alpha:refonly001122",
			"tlsCertificatePem":   "-----BEGIN CERTIFICATE----- tls-cert-that-must-not-leak -----END CERTIFICATE-----",
			"tlsPrivateKeyPem":    "-----BEGIN PRIVATE KEY----- tls-private-key-that-must-not-leak -----END PRIVATE KEY-----",
			"rawProviderKey":      rawProviderKey,
			"kubeconfig":          "kubeconfig-must-not-leak",
			"dbPassword":          "postgres-password-must-not-leak",
			"bearerToken":         "bearer-token-must-not-leak",
			"portalAdminPassword": "portal-admin-password-must-not-leak",
			"tencentSecretId":     "tencent-secret-id-must-not-leak",
			"tencentSecretKey":    "tencent-secret-key-must-not-leak",
		})
		if rec.Code != http.StatusPreconditionRequired {
			t.Fatalf("%s status = %d body = %s", target, rec.Code, rec.Body.String())
		}
		body := rec.Body.String()
		for _, required := range []string{
			"production_launch_gap_07_external_access_strategy_contract_local_gate",
			"contract-only",
			"package_d_external_access_strategy_required",
			"package-d-external-access-strategy-runner.js",
			"admin_only_port_forward",
			"internal_gateway",
			"kubernetes_ingress",
			"loadbalancer_service",
			"https_domain",
			"ingress_https_domain_formal_candidate",
			"PORTAL_HOST_DOMAIN",
			"INGRESS_CLASS",
			"TLS_SECRET_NAME_OR_CERT_MANAGER_ISSUER",
			"ALLOWED_INGRESS_ANNOTATIONS",
			"FORBIDDEN_INGRESS_ANNOTATIONS",
			"EXTERNAL_SMOKE_URL",
			"ROLLBACK_DELETE_INGRESS_PLAN",
			"portal.medopl.cn",
			"qcloud",
			"medopl-portal-tls",
			"https://portal.medopl.cn/",
			"tencent_ssl_or_manual_certificate_material_to_authorized_kubernetes_tls_secret",
			"qcloud-tls-readiness-contract-redacted.json",
			"providerKeyRef",
			"Ingress/LoadBalancer/DNS/TLS mutation",
			"public user access completion claim",
		} {
			if !strings.Contains(body, required) {
				t.Fatalf("%s response missing %q: %s", target, required, body)
			}
		}
		for _, forbidden := range []string{
			rawProviderKey,
			"kubeconfig-must-not-leak",
			"postgres-password-must-not-leak",
			"bearer-token-must-not-leak",
			"portal-admin-password-must-not-leak",
			"tencent-secret-id-must-not-leak",
			"tencent-secret-key-must-not-leak",
			"tls-cert-that-must-not-leak",
			"tls-private-key-that-must-not-leak",
			"tlsCertificatePem",
			"tlsPrivateKeyPem",
			"rawProviderKey",
			"dbPassword",
			"bearerToken",
			"tencentSecretId",
			"tencentSecretKey",
		} {
			if strings.Contains(body, forbidden) {
				t.Fatalf("%s response leaked forbidden marker %q: %s", target, forbidden, body)
			}
		}
	}
}

func TestControlPlaneHandlersMaterializeProviderSecretBoundary(t *testing.T) {
	secretRoot := t.TempDir()
	router := controlPlaneHandlerTestRouterWithSecretRoot(secretRoot)
	rawProviderKey := "local-rc-provider-key-material-that-must-stay-private"

	bindResponse := postMap(t, router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "v22-provider-key-secret-boundary-once",
	})
	assertPublicPayload(t, bindResponse, rawProviderKey)
	providerKeyRef, ok := bindResponse["providerKeyRef"].(string)
	if !ok || providerKeyRef == "" {
		t.Fatalf("providerKeyRef missing from bind response: %+v", bindResponse)
	}

	secretPath := filepath.Join(secretRoot, providersecret.NormalizeRef(providerKeyRef)+".json")
	secretPayload, err := os.ReadFile(secretPath)
	if err != nil {
		t.Fatalf("provider secret file missing: %v", err)
	}
	assertJSONContains(t, secretPayload, `"provider":"gflabtoken"`)
	assertJSONContains(t, secretPayload, `"source":"user_input"`)
	assertJSONContains(t, secretPayload, `"apiKey":"`+rawProviderKey+`"`)
}

func TestControlPlaneHandlersDoNotExposeProviderSecretWriteErrors(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	service := controlplaneservice.NewService(
		memory.NewControlPlaneStore(),
		controlplaneservice.WithProviderSecretStore(leakingProviderSecretSink{}),
	)
	api := router.Group("/api")
	RegisterControlPlaneRoutes(api, service)

	rec := postRaw(router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         "local-rc-provider-key-material-that-must-stay-private",
		"idempotencyKey": "v22-provider-key-secret-error-once",
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("provider secret write failure status = %d body = %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	for _, marker := range []string{"/tmp/provider-secrets/private-ref.json", "provider secret write failed", "local-rc-provider-key-material-that-must-stay-private"} {
		if strings.Contains(body, marker) {
			t.Fatalf("provider secret write error leaked %q: %s", marker, body)
		}
	}
	if !strings.Contains(body, "control_plane_operation_failed") {
		t.Fatalf("provider secret write failure must use public generic error: %s", body)
	}
}

func TestControlPlaneHandlersScopeResourcesAndFailClosedOnMissingRelease(t *testing.T) {
	router := controlPlaneHandlerTestRouter()

	for _, workspaceID := range []string{"workspace-v22", "workspace-other"} {
		postMap(t, router, "/api/provider/bind", map[string]any{
			"tenantId":       "tenant-v22",
			"portalUserId":   "user-v22",
			"workspaceId":    workspaceID,
			"apiKey":         "local-rc-provider-key-material-that-must-stay-private",
			"idempotencyKey": "bind-provider-" + workspaceID,
		})
		postMap(t, router, "/api/v22/managed-environment/open", map[string]any{
			"tenantId":       "tenant-v22",
			"portalUserId":   "user-v22",
			"workspaceId":    workspaceID,
			"idempotencyKey": "open-" + workspaceID,
		})
	}

	resourcesResponse := getMap(t, router, "/api/platform-provisioned-resources?workspaceId=workspace-v22")
	items := resourcesResponse["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["workspaceId"] != "workspace-v22" {
		t.Fatalf("resources response = %+v", resourcesResponse)
	}

	rec := postRaw(router, "/api/v22/managed-environment/release", map[string]any{
		"workspaceId":       "workspace-v22",
		"resourceBindingId": "missing-binding",
		"stopBilling":       true,
		"idempotencyKey":    "release-missing-once",
	})
	if rec.Code != http.StatusNotFound || !strings.Contains(rec.Body.String(), "resource_not_found") {
		t.Fatalf("release missing status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestControlPlaneHandlersFailClosedWithoutProviderKey(t *testing.T) {
	router := controlPlaneHandlerTestRouter()

	preflightResponse := postMap(t, router, "/api/provider/preflight", map[string]any{"workspaceId": "workspace-v22"})
	if preflightResponse["ok"] != false || preflightResponse["error"] != "provider_key_required" {
		t.Fatalf("preflight response = %+v", preflightResponse)
	}

	rec := postRaw(router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "open-once",
	})
	if rec.Code != http.StatusPreconditionRequired {
		t.Fatalf("open status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestCloudConnectorFailsClosedBeforeRealCloudAuthorization(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.GET("/api/cloud/connector/status", CloudConnectorStatus())
	router.POST("/api/cloud/connector/plan", CloudConnectorPlan())

	status := getMap(t, router, "/api/cloud/connector/status")
	if status["ok"] != false || status["status"] != "authorization_required" || status["mode"] != "fail_closed" {
		t.Fatalf("cloud connector status = %+v", status)
	}

	rec := postRaw(router, "/api/cloud/connector/plan", map[string]any{
		"workspaceId": "workspace-v22",
	})
	if rec.Code != http.StatusPreconditionRequired {
		t.Fatalf("cloud connector plan status = %d body = %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	for _, marker := range []string{"authorization_required", "fail_closed", "real-cloud authorization package"} {
		if !strings.Contains(body, marker) {
			t.Fatalf("cloud connector plan missing %q: %s", marker, body)
		}
	}
	for _, forbidden := range []string{"SecretId", "SecretKey", "kubeconfig", "AKID", "tencentcloud"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("cloud connector plan leaked forbidden marker %q: %s", forbidden, body)
		}
	}
}

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
