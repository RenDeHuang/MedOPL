package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

func writeControlPlaneError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, cpd.ErrProviderKeyRequired):
		ctx.JSON(http.StatusPreconditionRequired, gin.H{"ok": false, "error": "provider_key_required"})
	case errors.Is(err, cpd.ErrRuntimeReleaseRequired):
		ctx.JSON(http.StatusPreconditionRequired, gin.H{"ok": false, "error": "runtime_release_required_before_storage_destroy"})
	case errors.Is(err, cpd.ErrLaunchNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"ok": false, "error": "launch_not_found"})
	case errors.Is(err, cpd.ErrResourceNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"ok": false, "error": "resource_not_found"})
	case errors.Is(err, cpd.ErrWorkspaceRequired):
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "workspace_required"})
	case errors.Is(err, cpd.ErrIdempotencyKeyRequired):
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "idempotency_key_required"})
	case errors.Is(err, cpd.ErrFileRefRequired):
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "file_ref_required"})
	case errors.Is(err, cpd.ErrArtifactRefRequired):
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "artifact_ref_required"})
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
