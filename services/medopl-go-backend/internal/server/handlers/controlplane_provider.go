package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	cps "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
)

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
