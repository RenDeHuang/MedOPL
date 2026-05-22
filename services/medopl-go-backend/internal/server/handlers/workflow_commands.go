package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	workflowdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/workflow"
	workflowservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/workflow"
)

const (
	CommandTypeRuntimeLaunch   = "runtime.launch"
	CommandTypeManagedRun      = "managed_run.submit"
	CommandTypeBillingFreeze   = "billing.freeze"
	CommandTypeResourceRelease = "resource.release"
)

type WorkflowCommandRequest struct {
	WorkflowCommandID string `json:"workflowCommandId"`
	CommandType       string `json:"commandType"`
	TenantID          string `json:"tenantId"`
	PortalUserID      string `json:"portalUserId"`
	WorkspaceID       string `json:"workspaceId"`
	RequestedBy       string `json:"requestedBy"`
	IdempotencyKey    string `json:"idempotencyKey"`
	SourceSurface     string `json:"sourceSurface"`
}

type WorkflowCommandResponse struct {
	Ok                  bool   `json:"ok"`
	Error               string `json:"error,omitempty"`
	WorkflowExecutionID string `json:"workflowExecutionId,omitempty"`
	WorkflowCommandID   string `json:"workflowCommandId,omitempty"`
	CommandType         string `json:"commandType,omitempty"`
	Status              string `json:"status,omitempty"`
}

type WorkflowCommandFacade interface {
	SubmitCommand(ctx context.Context, command workflowdomain.Command) (workflowdomain.Execution, error)
}

type workflowFacadeAdapter struct {
	facade *workflowservice.Facade
}

func (adapter workflowFacadeAdapter) SubmitCommand(ctx context.Context, command workflowdomain.Command) (workflowdomain.Execution, error) {
	return adapter.facade.SubmitCommand(ctx, command)
}

func WorkflowCommands(facade *workflowservice.Facade) gin.HandlerFunc {
	return workflowCommands(workflowFacadeAdapter{facade: facade})
}

func WorkflowCommandAction(facade *workflowservice.Facade, commandType string) gin.HandlerFunc {
	return workflowCommandAction(workflowFacadeAdapter{facade: facade}, commandType)
}

func workflowCommands(facade WorkflowCommandFacade) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request WorkflowCommandRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, WorkflowCommandResponse{Ok: false, Error: "invalid_json"})
			return
		}
		submitWorkflowCommand(ctx, facade, request)
	}
}

func workflowCommandAction(facade WorkflowCommandFacade, commandType string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request WorkflowCommandRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, WorkflowCommandResponse{Ok: false, Error: "invalid_json"})
			return
		}
		request.CommandType = commandType
		submitWorkflowCommand(ctx, facade, request)
	}
}

func submitWorkflowCommand(ctx *gin.Context, facade WorkflowCommandFacade, request WorkflowCommandRequest) {
	if request.WorkflowCommandID == "" {
		ctx.JSON(http.StatusBadRequest, WorkflowCommandResponse{Ok: false, Error: "workflow_command_id_required"})
		return
	}
	if request.IdempotencyKey == "" {
		ctx.JSON(http.StatusBadRequest, WorkflowCommandResponse{Ok: false, Error: "idempotency_key_required"})
		return
	}
	if !supportedWorkflowCommandType(request.CommandType) {
		ctx.JSON(http.StatusBadRequest, WorkflowCommandResponse{Ok: false, Error: "unsupported_workflow_command_type"})
		return
	}
	execution, err := facade.SubmitCommand(ctx.Request.Context(), workflowdomain.Command{
		CommandID:      request.WorkflowCommandID,
		CommandType:    request.CommandType,
		TenantID:       request.TenantID,
		PortalUserID:   request.PortalUserID,
		WorkspaceID:    request.WorkspaceID,
		RequestedBy:    request.RequestedBy,
		IdempotencyKey: request.IdempotencyKey,
		SourceSurface:  request.SourceSurface,
	})
	if err != nil {
		ctx.JSON(statusForWorkflowCommandError(err), WorkflowCommandResponse{Ok: false, Error: workflowCommandErrorCode(err)})
		return
	}
	ctx.JSON(http.StatusAccepted, WorkflowCommandResponse{
		Ok:                  true,
		WorkflowExecutionID: execution.ExecutionID,
		WorkflowCommandID:   execution.CommandID,
		CommandType:         execution.CommandType,
		Status:              string(execution.Status),
	})
}

func supportedWorkflowCommandType(commandType string) bool {
	switch commandType {
	case CommandTypeRuntimeLaunch, CommandTypeManagedRun, CommandTypeBillingFreeze, CommandTypeResourceRelease:
		return true
	default:
		return false
	}
}

func statusForWorkflowCommandError(err error) int {
	if errors.Is(err, workflowservice.ErrIdempotencyConflict) {
		return http.StatusConflict
	}
	return http.StatusBadRequest
}

func workflowCommandErrorCode(err error) string {
	if errors.Is(err, workflowservice.ErrIdempotencyConflict) {
		return "idempotency_conflict"
	}
	return err.Error()
}
