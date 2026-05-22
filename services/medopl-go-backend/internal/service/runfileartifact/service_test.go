package runfileartifact

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/artifact"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/file"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/run"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func validRequest() run.RunRequest {
	return run.RunRequest{
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
		ToolName:           "opl-workbench",
		Kind:               "opl-workbench-run",
		FileRefs:           []string{"workspace-file-ref-v22"},
		Mode:               run.ModeFullRuntime,
		RuntimeAgentID:     "runtime-agent-v22",
		IdempotencyKey:     "run-v22-once",
		SourceSurface:      "portal_control_plane",
		CreatedAt:          time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC),
	}
}

func TestServiceCreatesPendingRunWithoutFakeSuccess(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewRunFileArtifactStore())

	execution, err := service.CreateRunRequest(ctx, validRequest())
	if err != nil {
		t.Fatalf("CreateRunRequest() error = %v", err)
	}
	if execution.Status != run.RunStatusPending {
		t.Fatalf("status = %q", execution.Status)
	}
	if execution.RunID != "run-v22" {
		t.Fatalf("run id = %q", execution.RunID)
	}
}

func TestServiceRequiresProviderKeyAndFileRefs(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewRunFileArtifactStore())
	request := validRequest()
	request.ProviderKeyRef = ""

	if _, err := service.CreateRunRequest(ctx, request); !errors.Is(err, run.ErrProviderKeyRequired) {
		t.Fatalf("CreateRunRequest() provider error = %v", err)
	}

	request = validRequest()
	request.FileRefs = nil
	if _, err := service.CreateRunRequest(ctx, request); !errors.Is(err, run.ErrFileRefRequired) {
		t.Fatalf("CreateRunRequest() file ref error = %v", err)
	}
}

func TestServiceRequiresObservedArtifactBeforeSucceededRun(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewRunFileArtifactStore())

	if _, err := service.CreateRunRequest(ctx, validRequest()); err != nil {
		t.Fatalf("CreateRunRequest() error = %v", err)
	}
	if _, err := service.RecordRuntimeResult(ctx, "run-v22", run.RuntimeResult{Status: run.RunStatusSucceeded}); !errors.Is(err, run.ErrArtifactNotObserved) {
		t.Fatalf("RecordRuntimeResult() without artifact error = %v", err)
	}

	item := artifact.RunArtifact{
		ArtifactID:         "artifact-v22",
		ArtifactRef:        "artifact-v22",
		RunID:              "run-v22",
		TenantID:           "tenant-v22",
		PortalUserID:       "user-v22",
		WorkspaceID:        "workspace-v22",
		WorkspaceSessionID: "workspace-session-v22",
		RuntimeSessionID:   "runtime-session-v22",
		ResourceBindingID:  "binding-v22",
		ProviderKeyRef:     "provider-key-ref-v22",
		Kind:               artifact.ArtifactKindOutputs,
		Name:               "result.csv",
		RelativePath:       "outputs/result.csv",
		Status:             artifact.ArtifactStatusAvailable,
	}
	if err := service.RecordRunArtifact(ctx, item); err != nil {
		t.Fatalf("RecordRunArtifact() error = %v", err)
	}
	updated, err := service.RecordRuntimeResult(ctx, "run-v22", run.RuntimeResult{Status: run.RunStatusSucceeded})
	if err != nil {
		t.Fatalf("RecordRuntimeResult() error = %v", err)
	}
	if updated.Status != run.RunStatusSucceeded {
		t.Fatalf("status = %q", updated.Status)
	}
}

func TestServiceRecordsFileRef(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewRunFileArtifactStore())
	ref := file.FileRef{
		FileRef:      "workspace-file-ref-v22",
		WorkspaceID:  "workspace-v22",
		Kind:         file.FileKindInputs,
		Name:         "measurements.csv",
		RelativePath: "inputs/measurements.csv",
		Status:       file.FileStatusAvailable,
	}

	if err := service.RecordFileRef(ctx, ref); err != nil {
		t.Fatalf("RecordFileRef() error = %v", err)
	}
}
