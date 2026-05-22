package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
	workflowservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/workflow"
)

func TestWorkflowCommandsFailsClosedWithoutWorkflowCommandID(t *testing.T) {
	router := workflowCommandTestRouter()
	payload := validWorkflowCommandPayload(CommandTypeManagedRun)
	delete(payload, "workflowCommandId")

	rec := postWorkflowCommand(router, payload)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
	var response WorkflowCommandResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if response.Ok || response.Error != "workflow_command_id_required" {
		t.Fatalf("response = %+v", response)
	}
}

func TestWorkflowCommandsFailsClosedWithoutIdempotencyKey(t *testing.T) {
	router := workflowCommandTestRouter()
	payload := validWorkflowCommandPayload(CommandTypeManagedRun)
	delete(payload, "idempotencyKey")

	rec := postWorkflowCommand(router, payload)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
	var response WorkflowCommandResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if response.Ok || response.Error != "idempotency_key_required" {
		t.Fatalf("response = %+v", response)
	}
}

func TestWorkflowCommandsRoutesLaunchRunBillingReleaseThroughFacade(t *testing.T) {
	for _, commandType := range []string{
		CommandTypeRuntimeLaunch,
		CommandTypeManagedRun,
		CommandTypeBillingFreeze,
		CommandTypeResourceRelease,
	} {
		t.Run(commandType, func(t *testing.T) {
			router := workflowCommandTestRouter()
			payload := validWorkflowCommandPayload(commandType)
			payload["workflowCommandId"] = "cmd-" + commandType
			payload["idempotencyKey"] = "idem-" + commandType

			rec := postWorkflowCommand(router, payload)

			if rec.Code != http.StatusAccepted {
				t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
			}
			var response WorkflowCommandResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
				t.Fatalf("unmarshal response: %v", err)
			}
			if !response.Ok || response.WorkflowCommandID != payload["workflowCommandId"] || response.CommandType != commandType || response.Status != "pending" {
				t.Fatalf("response = %+v", response)
			}
		})
	}
}

func TestWorkflowCommandsRejectsUnsupportedCommandType(t *testing.T) {
	router := workflowCommandTestRouter()
	payload := validWorkflowCommandPayload("cloud.console.mutate")

	rec := postWorkflowCommand(router, payload)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
	var response WorkflowCommandResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if response.Ok || response.Error != "unsupported_workflow_command_type" {
		t.Fatalf("response = %+v", response)
	}
}

func TestWorkflowActionRoutesUseFixedCommandTypes(t *testing.T) {
	for _, item := range []struct {
		path        string
		commandType string
	}{
		{path: "/runtime/launch", commandType: CommandTypeRuntimeLaunch},
		{path: "/runs", commandType: CommandTypeManagedRun},
		{path: "/billing/freeze", commandType: CommandTypeBillingFreeze},
		{path: "/resources/release", commandType: CommandTypeResourceRelease},
	} {
		t.Run(item.path, func(t *testing.T) {
			gin.SetMode(gin.ReleaseMode)
			router := gin.New()
			facade := workflowservice.NewFacade(memory.NewWorkflowStore())
			router.POST(item.path, WorkflowCommandAction(facade, item.commandType))
			payload := validWorkflowCommandPayload("ignored.by.action.route")

			rec := postJSON(router, item.path, payload)

			if rec.Code != http.StatusAccepted {
				t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
			}
			var response WorkflowCommandResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
				t.Fatalf("unmarshal response: %v", err)
			}
			if response.CommandType != item.commandType || response.Status != "pending" {
				t.Fatalf("response = %+v", response)
			}
		})
	}
}

func workflowCommandTestRouter() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	facade := workflowservice.NewFacade(memory.NewWorkflowStore())
	router.POST("/workflow/commands", WorkflowCommands(facade))
	return router
}

func validWorkflowCommandPayload(commandType string) map[string]string {
	return map[string]string{
		"workflowCommandId": "cmd-v22",
		"commandType":       commandType,
		"tenantId":          "tenant-v22",
		"portalUserId":      "user-v22",
		"workspaceId":       "workspace-v22",
		"requestedBy":       "user-v22",
		"idempotencyKey":    "idem-v22",
		"sourceSurface":     "portal-control-plane",
	}
}

func postWorkflowCommand(router *gin.Engine, payload map[string]string) *httptest.ResponseRecorder {
	return postJSON(router, "/workflow/commands", payload)
}

func postJSON(router *gin.Engine, path string, payload map[string]string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}
