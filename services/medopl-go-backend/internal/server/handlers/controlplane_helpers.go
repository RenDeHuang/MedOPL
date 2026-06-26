package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

func writeControlPlaneError(ctx *gin.Context, err error) {
	ctx.JSON(controlPlaneStatus(err), controlPlaneErrorBody(err))
}

type controlPlaneErrorDiagnostic struct {
	ErrorCategory        string
	CorrelationID        string
	OperationID          string
	WorkspaceIDHash      string
	StorageBindingIDHash string
	RuntimeBindingIDHash string
	CurrentStorageState  string
	ReleaseState         string
	BillingStopped       bool
	DestroyIntentState   string
	AuditEventWritten    bool
	ProviderRefPresent   bool
	DBOperationStage     string
	HandlerStage         string
	Retryable            bool
}

func writeControlPlaneErrorWithDiagnostic(ctx *gin.Context, err error, diagnostic controlPlaneErrorDiagnostic) {
	body := controlPlaneErrorBody(err)
	if body["error"] == "control_plane_operation_failed" {
		body["errorCategory"] = defaultString(diagnostic.ErrorCategory, "unknown_control_plane_error")
		body["correlationId"] = defaultString(diagnostic.CorrelationID, "corr-"+hashForPublicDiagnostic(diagnostic.OperationID))
		body["operationId"] = defaultString(diagnostic.OperationID, "operation-"+hashForPublicDiagnostic(diagnostic.CorrelationID))
		body["workspaceIdHash"] = diagnostic.WorkspaceIDHash
		body["storageBindingIdHash"] = diagnostic.StorageBindingIDHash
		body["runtimeBindingIdHash"] = diagnostic.RuntimeBindingIDHash
		body["currentStorageState"] = defaultString(diagnostic.CurrentStorageState, "unknown")
		body["releaseState"] = defaultString(diagnostic.ReleaseState, "unknown")
		body["billingStopped"] = diagnostic.BillingStopped
		body["destroyIntentState"] = defaultString(diagnostic.DestroyIntentState, "not_recorded")
		body["auditEventWritten"] = diagnostic.AuditEventWritten
		body["providerRefPresent"] = diagnostic.ProviderRefPresent
		body["dbOperationStage"] = defaultString(diagnostic.DBOperationStage, "unknown")
		body["handlerStage"] = defaultString(diagnostic.HandlerStage, "unknown")
		body["retryable"] = diagnostic.Retryable
	}
	ctx.JSON(controlPlaneStatus(err), body)
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

func controlPlaneStatus(err error) int {
	switch {
	case errors.Is(err, cpd.ErrProviderKeyRequired):
		return http.StatusPreconditionRequired
	case errors.Is(err, cpd.ErrRuntimeReleaseRequired):
		return http.StatusPreconditionRequired
	case errors.Is(err, cpd.ErrAccountRequired):
		return http.StatusPreconditionRequired
	case errors.Is(err, cpd.ErrAccountNotApproved):
		return http.StatusPreconditionRequired
	case errors.Is(err, cpd.ErrInsufficientBalance):
		return http.StatusPaymentRequired
	case errors.Is(err, cpd.ErrLaunchNotFound):
		return http.StatusNotFound
	case errors.Is(err, cpd.ErrResourceNotFound):
		return http.StatusNotFound
	default:
		return http.StatusBadRequest
	}
}

func controlPlaneErrorBody(err error) gin.H {
	switch {
	case errors.Is(err, cpd.ErrProviderKeyRequired):
		return gin.H{"ok": false, "error": "provider_key_required"}
	case errors.Is(err, cpd.ErrRuntimeReleaseRequired):
		return gin.H{"ok": false, "error": "runtime_release_required_before_storage_destroy"}
	case errors.Is(err, cpd.ErrAccountRequired):
		return gin.H{"ok": false, "error": "account_required"}
	case errors.Is(err, cpd.ErrAccountNotApproved):
		return gin.H{"ok": false, "error": "account_not_approved"}
	case errors.Is(err, cpd.ErrInsufficientBalance):
		return gin.H{"ok": false, "error": "insufficient_balance"}
	case errors.Is(err, cpd.ErrLaunchNotFound):
		return gin.H{"ok": false, "error": "launch_not_found"}
	case errors.Is(err, cpd.ErrResourceNotFound):
		return gin.H{"ok": false, "error": "resource_not_found"}
	case errors.Is(err, cpd.ErrWorkspaceRequired):
		return gin.H{"ok": false, "error": "workspace_required"}
	case errors.Is(err, cpd.ErrIdempotencyKeyRequired):
		return gin.H{"ok": false, "error": "idempotency_key_required"}
	case errors.Is(err, cpd.ErrFileRefRequired):
		return gin.H{"ok": false, "error": "file_ref_required"}
	case errors.Is(err, cpd.ErrArtifactRefRequired):
		return gin.H{"ok": false, "error": "artifact_ref_required"}
	default:
		return gin.H{"ok": false, "error": "control_plane_operation_failed"}
	}
}

func hashForPublicDiagnostic(value string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(value)))
	return hex.EncodeToString(sum[:])[:16]
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
