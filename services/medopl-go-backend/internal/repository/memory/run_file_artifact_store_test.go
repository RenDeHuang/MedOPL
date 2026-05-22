package memory

import (
	"context"
	"errors"
	"testing"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/artifact"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/file"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/run"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/runfileartifact"
)

func TestRunFileArtifactStorePersistsCanonicalObjects(t *testing.T) {
	ctx := context.Background()
	store := NewRunFileArtifactStore()
	request := run.RunRequest{RequestID: "run-v22"}
	execution := run.RunExecution{RunID: "run-v22", Status: run.RunStatusPending}
	ref := file.FileRef{FileRef: "file-ref-v22", WorkspaceID: "workspace-v22"}
	item := artifact.RunArtifact{ArtifactID: "artifact-v22", RunID: "run-v22"}

	if err := store.SaveRunRequest(ctx, request); err != nil {
		t.Fatalf("SaveRunRequest() error = %v", err)
	}
	if err := store.SaveRunExecution(ctx, execution); err != nil {
		t.Fatalf("SaveRunExecution() error = %v", err)
	}
	if err := store.SaveFileRef(ctx, ref); err != nil {
		t.Fatalf("SaveFileRef() error = %v", err)
	}
	if err := store.SaveRunArtifact(ctx, item); err != nil {
		t.Fatalf("SaveRunArtifact() error = %v", err)
	}

	got, err := store.RunExecution(ctx, "run-v22")
	if err != nil {
		t.Fatalf("RunExecution() error = %v", err)
	}
	if got.Status != run.RunStatusPending {
		t.Fatalf("status = %q", got.Status)
	}
	items, err := store.ListRunArtifacts(ctx, "run-v22")
	if err != nil {
		t.Fatalf("ListRunArtifacts() error = %v", err)
	}
	if len(items) != 1 || items[0].ArtifactID != "artifact-v22" {
		t.Fatalf("artifacts = %#v", items)
	}
}

func TestRunFileArtifactStoreRejectsDuplicateStableIDs(t *testing.T) {
	ctx := context.Background()
	store := NewRunFileArtifactStore()
	request := run.RunRequest{RequestID: "run-v22"}

	if err := store.SaveRunRequest(ctx, request); err != nil {
		t.Fatalf("SaveRunRequest() error = %v", err)
	}
	if err := store.SaveRunRequest(ctx, request); !errors.Is(err, runfileartifact.ErrDuplicateID) {
		t.Fatalf("duplicate SaveRunRequest() error = %v", err)
	}
}
