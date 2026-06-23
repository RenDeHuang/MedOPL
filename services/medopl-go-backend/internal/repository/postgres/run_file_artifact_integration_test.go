package postgres

import (
	"context"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

func TestRunFileArtifactMetadataUsesTypedPostgresBackend(t *testing.T) {
	ctx := context.Background()
	db := newTypedRunFileArtifactTestDB(t)
	first := NewControlPlaneStore(db)
	second := NewControlPlaneStore(db)

	file := cpd.FileRecord{
		FileRef:          "file-typed-postgres-rc",
		LaunchID:         "launch-typed-postgres-rc",
		WorkspaceID:      "workspace-typed-postgres-rc",
		ProviderKeyRef:   "gflab:workspace-typed-postgres-rc:provider-ref",
		StorageBindingID: "storage-typed-postgres-rc",
		ObjectRef:        "workspace-typed-postgres-rc/storage-typed-postgres-rc/inputs/input.csv",
		Name:             "input.csv",
		RelativePath:     "inputs/input.csv",
		SizeBytes:        123,
		ContentType:      "text/csv",
		Status:           "available",
		CreatedAt:        "2026-06-24T01:02:03Z",
	}
	if err := first.SaveFile(ctx, file); err != nil {
		t.Fatalf("SaveFile() error = %v", err)
	}

	run := cpd.RunRecord{
		RunID:            "run-typed-postgres-rc",
		LaunchID:         file.LaunchID,
		WorkspaceID:      file.WorkspaceID,
		ProviderKeyRef:   file.ProviderKeyRef,
		StorageBindingID: file.StorageBindingID,
		RunRef:           "run-typed-postgres-rc",
		Status:           "succeeded",
		ToolName:         "analysis",
		Message:          "analyze uploaded file",
		FileRefs:         []string{file.FileRef},
		InputObjectRefs:  []string{file.ObjectRef},
		CreatedAt:        file.CreatedAt,
	}
	if err := first.SaveRun(ctx, run); err != nil {
		t.Fatalf("SaveRun() error = %v", err)
	}

	artifact := cpd.ArtifactRecord{
		ArtifactRef:      "artifact-typed-postgres-rc",
		RunID:            run.RunID,
		LaunchID:         file.LaunchID,
		WorkspaceID:      file.WorkspaceID,
		ProviderKeyRef:   file.ProviderKeyRef,
		StorageBindingID: file.StorageBindingID,
		ObjectRef:        "workspace-typed-postgres-rc/storage-typed-postgres-rc/outputs/run/result.md",
		SourceFileRefs:   []string{file.FileRef},
		Kind:             "outputs",
		Name:             "result.md",
		RelativePath:     "outputs/run/result.md",
		SizeBytes:        456,
		ContentType:      "text/markdown",
		CreatedAt:        file.CreatedAt,
	}
	if err := first.SaveArtifact(ctx, artifact); err != nil {
		t.Fatalf("SaveArtifact() error = %v", err)
	}

	if db.genericWriteCount != 0 {
		t.Fatalf("typed Postgres metadata must not fall back to generic control_plane_records writes; got %d", db.genericWriteCount)
	}

	gotFile, err := second.FileByRef(ctx, file.FileRef)
	if err != nil {
		t.Fatalf("FileByRef() error = %v", err)
	}
	if gotFile.ObjectRef != file.ObjectRef || gotFile.StorageBindingID != file.StorageBindingID {
		t.Fatalf("file metadata relation did not survive typed Postgres backend: %+v", gotFile)
	}
	gotRun, err := second.RunByID(ctx, run.RunID)
	if err != nil {
		t.Fatalf("RunByID() error = %v", err)
	}
	if len(gotRun.FileRefs) != 1 || gotRun.FileRefs[0] != file.FileRef || len(gotRun.InputObjectRefs) != 1 || gotRun.InputObjectRefs[0] != file.ObjectRef {
		t.Fatalf("run must retain fileRef -> objectRef relation: %+v", gotRun)
	}
	gotArtifact, err := second.ArtifactByRef(ctx, artifact.ArtifactRef)
	if err != nil {
		t.Fatalf("ArtifactByRef() error = %v", err)
	}
	if gotArtifact.RunID != run.RunID || len(gotArtifact.SourceFileRefs) != 1 || gotArtifact.SourceFileRefs[0] != file.FileRef || gotArtifact.ObjectRef != artifact.ObjectRef {
		t.Fatalf("artifact must retain run/file/object relation: %+v", gotArtifact)
	}

	files, err := second.ListFiles(ctx, file.WorkspaceID)
	if err != nil {
		t.Fatalf("ListFiles() error = %v", err)
	}
	runs, err := second.ListRuns(ctx, file.WorkspaceID)
	if err != nil {
		t.Fatalf("ListRuns() error = %v", err)
	}
	artifacts, err := second.ListArtifacts(ctx, file.WorkspaceID)
	if err != nil {
		t.Fatalf("ListArtifacts() error = %v", err)
	}
	if len(files) != 1 || len(runs) != 1 || len(artifacts) != 1 {
		t.Fatalf("typed Postgres lists must expose one file/run/artifact: files=%+v runs=%+v artifacts=%+v", files, runs, artifacts)
	}
}
