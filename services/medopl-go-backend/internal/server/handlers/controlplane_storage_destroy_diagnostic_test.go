package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cps "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
)

func TestControlPlaneHandlersExposeStorageDestroyDiagnosticForGenericFailure(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	api := router.Group("/api")
	RegisterControlPlaneRoutes(api, storageDestroyFailingService{})

	rec := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v22/storage/destroy", strings.NewReader(`{
		"workspaceId":"workspace-v22",
		"resourceBindingId":"runtime-binding-v22",
		"storageBindingId":"storage-binding-v22",
		"idempotencyKey":"destroy-once"
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("storage destroy diagnostic status = %d body = %s", rec.Code, rec.Body.String())
	}
	body := mapFromRecorder(t, rec)
	if body["error"] != "control_plane_operation_failed" {
		t.Fatalf("storage destroy diagnostic keeps public error = %+v", body)
	}
	if body["errorCategory"] != "unknown_control_plane_error" {
		t.Fatalf("storage destroy diagnostic category = %+v", body)
	}
	if body["correlationId"] == "" || body["operationId"] == "" {
		t.Fatalf("storage destroy diagnostic ids = %+v", body)
	}
	for _, field := range []string{"workspaceIdHash", "runtimeBindingIdHash", "storageBindingIdHash", "handlerStage", "dbOperationStage"} {
		if body[field] == "" {
			t.Fatalf("storage destroy diagnostic missing %s in %+v", field, body)
		}
	}
	if body["retryable"] != false {
		t.Fatalf("storage destroy diagnostic retryable = %+v", body)
	}
	for _, forbidden := range []string{"workspace-v22", "runtime-binding-v22", "storage-binding-v22", "destroy-once", "postgres://", "SecretKey", "signed"} {
		if strings.Contains(rec.Body.String(), forbidden) {
			t.Fatalf("storage destroy diagnostic leaked %q in %s", forbidden, rec.Body.String())
		}
	}
}

type storageDestroyFailingService struct{}

func (storageDestroyFailingService) PrepareBusinessAccount(context.Context, cps.PrepareBusinessAccountInput) (cps.BusinessAccountProjection, error) {
	return cps.BusinessAccountProjection{}, nil
}
func (storageDestroyFailingService) CreditBusinessAccount(context.Context, cps.CreditBusinessAccountInput) (cps.BusinessAccountProjection, error) {
	return cps.BusinessAccountProjection{}, nil
}
func (storageDestroyFailingService) CreatePaymentOrder(context.Context, cps.CreatePaymentOrderInput) (cps.PaymentOrderProjection, error) {
	return cps.PaymentOrderProjection{}, nil
}
func (storageDestroyFailingService) MarkPaymentPaid(context.Context, cps.MarkPaymentPaidInput) (cps.BusinessAccountProjection, error) {
	return cps.BusinessAccountProjection{}, nil
}
func (storageDestroyFailingService) RefundBusinessAccount(context.Context, cps.RefundBusinessAccountInput) (cps.BusinessAccountProjection, error) {
	return cps.BusinessAccountProjection{}, nil
}
func (storageDestroyFailingService) AdjustBusinessAccount(context.Context, cps.AdjustBusinessAccountInput) (cps.BusinessAccountProjection, error) {
	return cps.BusinessAccountProjection{}, nil
}
func (storageDestroyFailingService) BillingStatement(context.Context, cps.WorkspaceInput) (cps.BillingStatement, error) {
	return cps.BillingStatement{}, nil
}
func (storageDestroyFailingService) RuntimeFreeze(context.Context, cps.WorkspaceInput) (cps.RuntimeFreezeProjection, error) {
	return cps.RuntimeFreezeProjection{}, nil
}
func (storageDestroyFailingService) BindProviderKey(context.Context, cps.BindProviderKeyInput) (cpd.ProviderBinding, error) {
	return cpd.ProviderBinding{}, nil
}
func (storageDestroyFailingService) ProviderBinding(context.Context, cps.WorkspaceInput) (cpd.ProviderBinding, error) {
	return cpd.ProviderBinding{}, nil
}
func (storageDestroyFailingService) Preflight(context.Context, cps.WorkspaceInput) (cpd.PreflightResult, error) {
	return cpd.PreflightResult{}, nil
}
func (storageDestroyFailingService) OpenManagedEnvironment(context.Context, cps.OpenManagedEnvironmentInput) (cpd.LaunchProjection, error) {
	return cpd.LaunchProjection{}, nil
}
func (storageDestroyFailingService) RuntimeGate(context.Context, cps.RuntimeGateInput) (cps.RuntimeGateProjection, error) {
	return cps.RuntimeGateProjection{}, nil
}
func (storageDestroyFailingService) LaunchStatus(context.Context, cps.LaunchLookupInput) (cpd.LaunchProjection, error) {
	return cpd.LaunchProjection{}, nil
}
func (storageDestroyFailingService) Bootstrap(context.Context, cps.LaunchLookupInput) (cpd.BootstrapProjection, error) {
	return cpd.BootstrapProjection{}, nil
}
func (storageDestroyFailingService) BindSession(context.Context, cps.LaunchLookupInput) (map[string]any, error) {
	return nil, nil
}
func (storageDestroyFailingService) RecordMessage(context.Context, cps.LaunchLookupInput, string) (map[string]any, error) {
	return nil, nil
}
func (storageDestroyFailingService) RecordFile(context.Context, cps.RecordFileInput) (cps.PublicFileRef, error) {
	return cps.PublicFileRef{}, nil
}
func (storageDestroyFailingService) StartRun(context.Context, cps.StartRunInput) (cps.PublicRunResult, error) {
	return cps.PublicRunResult{}, nil
}
func (storageDestroyFailingService) Artifact(context.Context, string, string) (map[string]any, error) {
	return nil, nil
}
func (storageDestroyFailingService) BillingSummary(context.Context, cps.WorkspaceInput) (cps.BillingSummary, error) {
	return cps.BillingSummary{}, nil
}
func (storageDestroyFailingService) BillingDetails(context.Context, cps.WorkspaceInput) (cps.BillingDetails, error) {
	return cps.BillingDetails{}, nil
}
func (storageDestroyFailingService) Resources(context.Context, cps.WorkspaceInput) (cps.ResourcesProjection, error) {
	return cps.ResourcesProjection{}, nil
}
func (storageDestroyFailingService) Release(context.Context, cps.ReleaseInput) (cps.ReleaseResult, error) {
	return cps.ReleaseResult{}, nil
}
func (storageDestroyFailingService) DestroyStorage(context.Context, cps.DestroyStorageInput) (cps.StorageDestroyReceipt, error) {
	return cps.StorageDestroyReceipt{}, errors.New("postgres constraint detail must stay private")
}
