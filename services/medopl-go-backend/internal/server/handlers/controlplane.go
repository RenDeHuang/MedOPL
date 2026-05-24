package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cps "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
)

type ControlPlaneService interface {
	BindProviderKey(ctx context.Context, input cps.BindProviderKeyInput) (cpd.ProviderBinding, error)
	ProviderBinding(ctx context.Context, input cps.WorkspaceInput) (cpd.ProviderBinding, error)
	Preflight(ctx context.Context, input cps.WorkspaceInput) (cpd.PreflightResult, error)
	OpenManagedEnvironment(ctx context.Context, input cps.OpenManagedEnvironmentInput) (cpd.LaunchProjection, error)
	LaunchStatus(ctx context.Context, input cps.LaunchLookupInput) (cpd.LaunchProjection, error)
	Bootstrap(ctx context.Context, input cps.LaunchLookupInput) (cpd.BootstrapProjection, error)
	BindSession(ctx context.Context, input cps.LaunchLookupInput) (map[string]any, error)
	RecordMessage(ctx context.Context, input cps.LaunchLookupInput, message string) (map[string]any, error)
	RecordFile(ctx context.Context, input cps.RecordFileInput) (cps.PublicFileRef, error)
	StartRun(ctx context.Context, input cps.StartRunInput) (cps.PublicRunResult, error)
	Artifact(ctx context.Context, launchID string, artifactRef string) (map[string]any, error)
	BillingSummary(ctx context.Context, input cps.WorkspaceInput) (cps.BillingSummary, error)
	BillingDetails(ctx context.Context, input cps.WorkspaceInput) (cps.BillingDetails, error)
	Resources(ctx context.Context, input cps.WorkspaceInput) (cps.ResourcesProjection, error)
	Release(ctx context.Context, input cps.ReleaseInput) (cps.ReleaseResult, error)
}

type bindProviderKeyRequest struct {
	TenantID       string `json:"tenantId"`
	PortalUserID   string `json:"portalUserId"`
	UserID         string `json:"userId"`
	WorkspaceID    string `json:"workspaceId"`
	APIKey         string `json:"apiKey"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type workspaceRequest struct {
	WorkspaceID string `json:"workspaceId"`
}

type openManagedEnvironmentRequest struct {
	TenantID       string `json:"tenantId"`
	PortalUserID   string `json:"portalUserId"`
	UserID         string `json:"userId"`
	WorkspaceID    string `json:"workspaceId"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type recordFileRequest struct {
	FileName     string `json:"fileName"`
	RelativePath string `json:"relativePath"`
	ContentType  string `json:"contentType"`
	SizeBytes    int64  `json:"sizeBytes"`
}

type startRunRequest struct {
	Message   string   `json:"message"`
	FileRefs  []string `json:"fileRefs"`
	ToolName  string   `json:"toolName"`
	RequestID string   `json:"requestId"`
}

type messageRequest struct {
	Message string `json:"message"`
}

type releaseRequest struct {
	WorkspaceID       string `json:"workspaceId"`
	ResourceBindingID string `json:"resourceBindingId"`
	StopBilling       bool   `json:"stopBilling"`
	IdempotencyKey    string `json:"idempotencyKey"`
}

func RegisterControlPlaneRoutes(api *gin.RouterGroup, service ControlPlaneService) {
	api.GET("/provider/binding", getProviderBinding(service))
	api.POST("/provider/bind", bindProviderKey(service))
	api.POST("/provider/preflight", providerPreflight(service))
	api.POST("/v22/users/prepare", prepareUser())
	api.POST("/v22/users/credit", creditUser())
	api.POST("/v22/provider-key", bindProviderKey(service))
	api.POST("/v22/managed-environment/readiness", managedEnvironmentReadiness(service))
	api.POST("/v22/managed-environment/open", openManagedEnvironment(service))
	api.POST("/v22/managed-environment/release", releaseManagedEnvironment(service))
	api.POST("/opl/launch", openManagedEnvironment(service))
	api.GET("/opl/launch-status/:launchId", launchStatus(service))
	api.GET("/opl/bootstrap", bootstrap(service))
	api.POST("/opl/sessions/bind", bindSession(service))
	api.POST("/opl/messages", recordMessage(service))
	api.GET("/opl/messages/:messageId/status", messageStatus())
	api.POST("/opl/files", recordFile(service))
	api.POST("/opl/runs", startRun(service))
	api.GET("/opl/artifacts/:artifactRef", artifact(service))
	api.GET("/billing/summary", billingSummary(service))
	api.GET("/billing/details", billingDetails(service))
	api.GET("/costs/summary", costsSummary(service))
	api.GET("/costs/workspace", costsSummary(service))
	api.GET("/costs/run", runCost())
	api.GET("/platform-provisioned-resources", resources(service))
}

func getProviderBinding(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		binding, err := service.ProviderBinding(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, binding)
	}
}

func bindProviderKey(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request bindProviderKeyRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		binding, err := service.BindProviderKey(ctx.Request.Context(), cps.BindProviderKeyInput{
			TenantID:       defaultString(request.TenantID, "tenant-local-rc"),
			PortalUserID:   defaultString(request.PortalUserID, request.UserID, "user-local-rc"),
			WorkspaceID:    defaultString(request.WorkspaceID, "workspace-local-rc"),
			RawProviderKey: request.APIKey,
			IdempotencyKey: defaultString(request.IdempotencyKey, "bind-provider-local-rc"),
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, mergeOK(binding))
	}
}

func providerPreflight(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request workspaceRequest
		_ = ctx.ShouldBindJSON(&request)
		result, err := service.Preflight(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: defaultString(request.WorkspaceID, workspaceIDFromQuery(ctx), "workspace-local-rc")})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, result)
	}
}

func managedEnvironmentReadiness(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request workspaceRequest
		_ = ctx.ShouldBindJSON(&request)
		result, err := service.Preflight(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: defaultString(request.WorkspaceID, workspaceIDFromQuery(ctx), "workspace-local-rc")})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		if !result.Ok {
			ctx.JSON(http.StatusPreconditionRequired, result)
			return
		}
		ctx.JSON(http.StatusOK, result)
	}
}

func prepareUser() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "source": "go-control-plane", "status": "prepared"})
	}
}

func creditUser() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "source": "go-control-plane", "balance": 100, "currency": "CNY"})
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

func writeControlPlaneError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, cpd.ErrProviderKeyRequired):
		ctx.JSON(http.StatusPreconditionRequired, gin.H{"ok": false, "error": "provider_key_required"})
	case errors.Is(err, cpd.ErrLaunchNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"ok": false, "error": "launch_not_found"})
	case errors.Is(err, cpd.ErrResourceNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"ok": false, "error": "resource_not_found"})
	case errors.Is(err, cpd.ErrWorkspaceRequired):
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "workspace_required"})
	case errors.Is(err, cpd.ErrIdempotencyKeyRequired):
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "idempotency_key_required"})
	default:
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "control_plane_operation_failed"})
	}
}

func workspaceIDFromQuery(ctx *gin.Context) string {
	return defaultString(ctx.Query("workspaceId"), ctx.Query("workspace_id"), "workspace-local-rc")
}

func launchIDFromQuery(ctx *gin.Context) string {
	return defaultString(ctx.Query("launchId"), ctx.Query("launch_id"))
}

func defaultString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func mergeOK(value any) gin.H {
	return gin.H{"ok": true, "tenantId": field(value, "TenantID"), "portalUserId": field(value, "PortalUserID"), "workspaceId": field(value, "WorkspaceID"), "providerBound": field(value, "ProviderBound"), "providerKeyRef": field(value, "ProviderKeyRef"), "boundStatus": field(value, "BoundStatus")}
}

func field(value any, name string) any {
	if binding, ok := value.(cpd.ProviderBinding); ok {
		switch name {
		case "TenantID":
			return binding.TenantID
		case "PortalUserID":
			return binding.PortalUserID
		case "WorkspaceID":
			return binding.WorkspaceID
		case "ProviderBound":
			return binding.ProviderBound
		case "ProviderKeyRef":
			return binding.ProviderKeyRef
		case "BoundStatus":
			return binding.BoundStatus
		default:
			return ""
		}
	}
	return ""
}
