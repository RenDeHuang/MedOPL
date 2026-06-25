package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	cps "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
)

func prepareUser(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request prepareBusinessAccountRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.PrepareBusinessAccount(ctx.Request.Context(), cps.PrepareBusinessAccountInput{
			TenantID:     defaultString(request.TenantID, "tenant-local-rc"),
			PortalUserID: defaultString(request.PortalUserID, request.UserID, "user-local-rc"),
			WorkspaceID:  defaultString(request.WorkspaceID, "workspace-local-rc"),
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func creditUser(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request creditBusinessAccountRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.CreditBusinessAccount(ctx.Request.Context(), cps.CreditBusinessAccountInput{
			TenantID:       defaultString(request.TenantID, "tenant-local-rc"),
			PortalUserID:   defaultString(request.PortalUserID, request.UserID, "user-local-rc"),
			WorkspaceID:    defaultString(request.WorkspaceID, ctx.Query("workspaceId"), ctx.Query("workspace_id")),
			Amount:         request.Amount,
			Currency:       defaultString(request.Currency, "CNY"),
			IdempotencyKey: defaultString(request.IdempotencyKey, "credit-local-rc"),
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func createPaymentOrder(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request paymentOrderRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.CreatePaymentOrder(ctx.Request.Context(), cps.CreatePaymentOrderInput{
			TenantID:       defaultString(request.TenantID, "tenant-local-rc"),
			PortalUserID:   defaultString(request.PortalUserID, request.UserID, "user-local-rc"),
			WorkspaceID:    defaultString(request.WorkspaceID, ctx.Query("workspaceId"), ctx.Query("workspace_id")),
			Amount:         request.Amount,
			Currency:       defaultString(request.Currency, "CNY"),
			IdempotencyKey: defaultString(request.IdempotencyKey, "payment-order-local-rc"),
			ProviderRef:    request.ProviderRef,
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func markPaymentPaid(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request paymentPaidRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.MarkPaymentPaid(ctx.Request.Context(), cps.MarkPaymentPaidInput{
			TenantID:       defaultString(request.TenantID, "tenant-local-rc"),
			PortalUserID:   defaultString(request.PortalUserID, request.UserID, "user-local-rc"),
			WorkspaceID:    defaultString(request.WorkspaceID, ctx.Query("workspaceId"), ctx.Query("workspace_id")),
			OrderID:        request.OrderID,
			Amount:         request.Amount,
			Currency:       defaultString(request.Currency, "CNY"),
			IdempotencyKey: defaultString(request.IdempotencyKey, "payment-paid-local-rc"),
			ProviderRef:    request.ProviderRef,
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func refundBusinessAccount(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request billingMutationRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.RefundBusinessAccount(ctx.Request.Context(), cps.RefundBusinessAccountInput{
			TenantID:       defaultString(request.TenantID, "tenant-local-rc"),
			PortalUserID:   defaultString(request.PortalUserID, request.UserID, "user-local-rc"),
			WorkspaceID:    defaultString(request.WorkspaceID, ctx.Query("workspaceId"), ctx.Query("workspace_id")),
			Amount:         request.Amount,
			Currency:       defaultString(request.Currency, "CNY"),
			IdempotencyKey: defaultString(request.IdempotencyKey, "refund-local-rc"),
			Reason:         request.Reason,
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func adjustBusinessAccount(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request billingMutationRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.AdjustBusinessAccount(ctx.Request.Context(), cps.AdjustBusinessAccountInput{
			TenantID:       defaultString(request.TenantID, "tenant-local-rc"),
			PortalUserID:   defaultString(request.PortalUserID, request.UserID, "user-local-rc"),
			WorkspaceID:    defaultString(request.WorkspaceID, ctx.Query("workspaceId"), ctx.Query("workspace_id")),
			Amount:         request.Amount,
			Currency:       defaultString(request.Currency, "CNY"),
			IdempotencyKey: defaultString(request.IdempotencyKey, "adjustment-local-rc"),
			Reason:         request.Reason,
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func openManagedEnvironment(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request openManagedEnvironmentRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		launch, err := service.OpenManagedEnvironment(ctx.Request.Context(), cps.OpenManagedEnvironmentInput{
			TenantID:       defaultString(request.TenantID, "tenant-local-rc"),
			PortalUserID:   defaultString(request.PortalUserID, request.UserID, "user-local-rc"),
			WorkspaceID:    defaultString(request.WorkspaceID, "workspace-local-rc"),
			IdempotencyKey: defaultString(request.IdempotencyKey, "open-managed-environment-local-rc"),
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, launch)
	}
}

func runtimeGate(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request runtimeGateRequest
		_ = ctx.ShouldBindJSON(&request)
		payload, err := service.RuntimeGate(ctx.Request.Context(), cps.RuntimeGateInput{
			WorkspaceID:    defaultString(request.WorkspaceID, workspaceIDFromQuery(ctx), "workspace-local-rc"),
			InvocationMode: defaultString(request.InvocationMode, "runtime_required"),
			RuntimePlanID:  request.RuntimePlanID,
			StoragePlanID:  request.StoragePlanID,
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func launchStatus(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		launch, err := service.LaunchStatus(ctx.Request.Context(), cps.LaunchLookupInput{LaunchID: ctx.Param("launchId")})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, launch)
	}
}

func bootstrap(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.Bootstrap(ctx.Request.Context(), cps.LaunchLookupInput{LaunchID: launchIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func bindSession(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.BindSession(ctx.Request.Context(), cps.LaunchLookupInput{LaunchID: launchIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func recordMessage(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request messageRequest
		_ = ctx.ShouldBindJSON(&request)
		payload, err := service.RecordMessage(ctx.Request.Context(), cps.LaunchLookupInput{LaunchID: launchIDFromQuery(ctx)}, request.Message)
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func messageStatus() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "messageId": ctx.Param("messageId"), "status": "succeeded"})
	}
}

func recordFile(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request recordFileRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.RecordFile(ctx.Request.Context(), cps.RecordFileInput{
			LaunchID:     launchIDFromQuery(ctx),
			FileName:     request.FileName,
			RelativePath: request.RelativePath,
			ContentType:  request.ContentType,
			SizeBytes:    request.SizeBytes,
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func startRun(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request startRunRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.StartRun(ctx.Request.Context(), cps.StartRunInput{
			LaunchID:  launchIDFromQuery(ctx),
			Message:   request.Message,
			FileRefs:  request.FileRefs,
			ToolName:  request.ToolName,
			RequestID: request.RequestID,
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func artifact(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.Artifact(ctx.Request.Context(), launchIDFromQuery(ctx), ctx.Param("artifactRef"))
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func billingSummary(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.BillingSummary(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func billingDetails(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.BillingDetails(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func billingStatement(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.BillingStatement(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func runtimeFreeze(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.RuntimeFreeze(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func costsSummary(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.BillingSummary(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"source": "go-control-plane", "type": "local-rc", "totals": payload.Totals, "items": []any{}})
	}
}

func runCost() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"source": "go-control-plane", "type": "local-rc", "taskRef": ctx.Query("taskRef"), "cost": gin.H{"cpuCost": 1.25, "gpuCost": 0, "storageCost": 0.1, "totalCost": 1.35, "pricingSource": "local-rc-deterministic"}})
	}
}

func resources(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.Resources(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func releaseManagedEnvironment(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request releaseRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.Release(ctx.Request.Context(), cps.ReleaseInput{
			WorkspaceID:       defaultString(request.WorkspaceID, "workspace-local-rc"),
			ResourceBindingID: request.ResourceBindingID,
			StopBilling:       request.StopBilling,
			IdempotencyKey:    defaultString(request.IdempotencyKey, "release-local-rc"),
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func destroyStorage(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request destroyStorageRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.DestroyStorage(ctx.Request.Context(), cps.DestroyStorageInput{
			WorkspaceID:       defaultString(request.WorkspaceID, "workspace-local-rc"),
			ResourceBindingID: request.ResourceBindingID,
			StorageBindingID:  request.StorageBindingID,
			IdempotencyKey:    defaultString(request.IdempotencyKey, "destroy-storage-local-rc"),
		})
		if err != nil {
			writeControlPlaneErrorWithDiagnostic(ctx, err, storageDestroyDiagnostic(request))
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func storageDestroyDiagnostic(request destroyStorageRequest) controlPlaneErrorDiagnostic {
	workspaceID := defaultString(request.WorkspaceID, "workspace-local-rc")
	resourceBindingID := request.ResourceBindingID
	storageBindingID := request.StorageBindingID
	operationSeed := strings.Join([]string{workspaceID, resourceBindingID, storageBindingID, request.IdempotencyKey}, ":")
	return controlPlaneErrorDiagnostic{
		ErrorCategory:        "unknown_control_plane_error",
		CorrelationID:        "corr-" + hashForPublicDiagnostic(operationSeed),
		OperationID:          "storage-destroy-" + hashForPublicDiagnostic(operationSeed+":operation"),
		WorkspaceIDHash:      hashForPublicDiagnostic(workspaceID),
		StorageBindingIDHash: hashForPublicDiagnostic(storageBindingID),
		RuntimeBindingIDHash: hashForPublicDiagnostic(resourceBindingID),
		CurrentStorageState:  "unknown",
		ReleaseState:         "unknown",
		BillingStopped:       false,
		DestroyIntentState:   "unknown",
		AuditEventWritten:    false,
		ProviderRefPresent:   false,
		DBOperationStage:     "destroy_storage",
		HandlerStage:         "storage_destroy_handler",
		Retryable:            false,
	}
}
