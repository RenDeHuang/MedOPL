package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	labdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/lab"
	labrepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/lab"
	labservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/lab"
)

type LabService interface {
	ListLabPackages(ctx context.Context) ([]labdomain.PackagePlan, error)
	GetLabSubscription(ctx context.Context, workspaceID string) (labdomain.Subscription, error)
	GetLabEntitlement(ctx context.Context, workspaceID string) (labdomain.Entitlement, error)
	ActivateLabPackage(ctx context.Context, input labservice.MutationInput) (labservice.MutationResult, error)
	UpgradeLabPackage(ctx context.Context, input labservice.MutationInput) (labservice.MutationResult, error)
}

type LabMutationRequest struct {
	WorkspaceID    string `json:"workspaceId"`
	PackageID      string `json:"packageId"`
	IdempotencyKey string `json:"idempotencyKey"`
}

func LabPackages(service LabService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		items, err := service.ListLabPackages(ctx.Request.Context())
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "items": items, "source": "go-control-plane"})
	}
}

func LabSubscription(service LabService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		workspaceID := ctx.Query("workspaceId")
		subscription, err := service.GetLabSubscription(ctx.Request.Context(), workspaceID)
		if err != nil {
			writeLabError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "workspaceId": subscription.WorkspaceID, "subscription": subscription, "status": subscription.Status, "currentPackageId": subscription.PackageID})
	}
}

func LabEntitlement(service LabService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		workspaceID := ctx.Query("workspaceId")
		entitlement, err := service.GetLabEntitlement(ctx.Request.Context(), workspaceID)
		if err != nil {
			writeLabError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "workspaceId": workspaceID, "entitlement": entitlement})
	}
}

func ActivateLabPackage(service LabService) gin.HandlerFunc {
	return labMutation(service, service.ActivateLabPackage)
}

func UpgradeLabPackage(service LabService) gin.HandlerFunc {
	return labMutation(service, service.UpgradeLabPackage)
}

func labMutation(service LabService, run func(context.Context, labservice.MutationInput) (labservice.MutationResult, error)) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request LabMutationRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		result, err := run(ctx.Request.Context(), labservice.MutationInput{
			WorkspaceID:    request.WorkspaceID,
			PackageID:      request.PackageID,
			IdempotencyKey: request.IdempotencyKey,
		})
		if err != nil {
			writeLabError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, result)
	}
}

func writeLabError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, labdomain.ErrWorkspaceRequired):
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "workspace_id_required"})
	case errors.Is(err, labdomain.ErrPackageRequired):
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "package_id_required"})
	case errors.Is(err, labdomain.ErrPackageNotFound):
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{"ok": false, "error": "package_not_found"})
	case errors.Is(err, labrepo.ErrNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"ok": false, "error": "subscription_not_found"})
	default:
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
	}
}
