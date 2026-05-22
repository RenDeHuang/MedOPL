package run

import (
	"errors"
	"testing"
	"time"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/artifact"
)

func validRunRequest() RunRequest {
	return RunRequest{
		RequestID:          "run-v22",
		TenantID:           "tenant-v22",
		PortalUserID:       "user-v22",
		WorkspaceID:        "workspace-v22",
		WorkspaceSessionID: "workspace-session-v22",
		RuntimeSessionID:   "runtime-session-v22",
		ResourceBindingID:  "binding-v22",
		ComputeInstanceID:  "compute-v22",
		StorageBucketID:    "storage-v22",
		ProviderKeyRef:     "provider-key-ref-v22",
		TraceID:            "trace-v22",
		Message:            "summarize file",
		ToolName:           "opl-workbench",
		Kind:               "opl-workbench-run",
		Model:              "gflabtoken-user-model",
		FileRefs:           []string{"workspace-file-ref-v22"},
		Mode:               ModeFullRuntime,
		RuntimeAgentID:     "runtime-agent-v22",
		IdempotencyKey:     "run-v22-once",
		SourceSurface:      "portal_control_plane",
		CreatedAt:          time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC),
	}
}

func TestValidateRunRequestRequiresManagedRunScope(t *testing.T) {
	request := validRunRequest()

	if err := ValidateRunRequest(request); err != nil {
		t.Fatalf("ValidateRunRequest() error = %v", err)
	}
}

func TestValidateRunRequestFailsClosedWithoutProviderKeyRef(t *testing.T) {
	request := validRunRequest()
	request.ProviderKeyRef = ""

	if err := ValidateRunRequest(request); !errors.Is(err, ErrProviderKeyRequired) {
		t.Fatalf("ValidateRunRequest() error = %v", err)
	}
}

func TestValidateRunRequestRejectsApiOnlyRun(t *testing.T) {
	request := validRunRequest()
	request.Mode = "api_only"

	if err := ValidateRunRequest(request); !errors.Is(err, ErrInvalidRunMode) {
		t.Fatalf("ValidateRunRequest() error = %v", err)
	}
}

func TestApplyRuntimeResultRejectsSucceededRunWithoutObservedArtifact(t *testing.T) {
	execution := RunExecution{RunID: "run-v22", Status: RunStatusRunning}
	_, err := ApplyRuntimeResult(execution, RuntimeResult{Status: RunStatusSucceeded})

	if !errors.Is(err, ErrArtifactNotObserved) {
		t.Fatalf("ApplyRuntimeResult() error = %v", err)
	}
}

func TestApplyRuntimeResultAllowsGatedWithoutFakeSuccess(t *testing.T) {
	execution := RunExecution{RunID: "run-v22", Status: RunStatusRunning}
	updated, err := ApplyRuntimeResult(execution, RuntimeResult{
		Status: RunStatusGated,
		Error:  "requires_runtime_agent",
	})
	if err != nil {
		t.Fatalf("ApplyRuntimeResult() error = %v", err)
	}
	if updated.Status != RunStatusGated {
		t.Fatalf("status = %q", updated.Status)
	}
	if updated.Error != "requires_runtime_agent" {
		t.Fatalf("error = %q", updated.Error)
	}
}

func TestApplyRuntimeResultAcceptsSucceededRunWithObservedArtifact(t *testing.T) {
	execution := RunExecution{RunID: "run-v22", Status: RunStatusRunning}
	updated, err := ApplyRuntimeResult(execution, RuntimeResult{
		Status:  RunStatusSucceeded,
		TraceID: "trace-v22",
		Artifacts: []artifact.RunArtifact{{
			ArtifactID:        "artifact-v22",
			RunID:             "run-v22",
			WorkspaceID:       "workspace-v22",
			ResourceBindingID: "binding-v22",
			ProviderKeyRef:    "provider-key-ref-v22",
			Kind:              artifact.ArtifactKindOutputs,
			Name:              "result.csv",
			RelativePath:      "outputs/result.csv",
			Status:            artifact.ArtifactStatusAvailable,
		}},
	})
	if err != nil {
		t.Fatalf("ApplyRuntimeResult() error = %v", err)
	}
	if updated.Status != RunStatusSucceeded {
		t.Fatalf("status = %q", updated.Status)
	}
	if updated.TraceID != "trace-v22" {
		t.Fatalf("trace = %q", updated.TraceID)
	}
}
