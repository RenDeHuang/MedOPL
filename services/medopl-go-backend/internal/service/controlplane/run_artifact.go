package controlplane

import (
	"context"
	"errors"
	"strings"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

type StartRunInput struct {
	LaunchID  string
	Message   string
	FileRefs  []string
	ToolName  string
	RequestID string
}

type PublicRun struct {
	TraceID string `json:"traceId"`
	Status  string `json:"status"`
}

type PublicArtifact struct {
	ArtifactRef    string `json:"artifactRef"`
	WorkspaceID    string `json:"workspaceId,omitempty"`
	ProviderKeyRef string `json:"providerKeyRef,omitempty"`
	Kind           string `json:"kind,omitempty"`
	Name           string `json:"name"`
	RelativePath   string `json:"relativePath"`
	SizeBytes      int64  `json:"sizeBytes"`
	ContentType    string `json:"contentType"`
}

type PublicRunResult struct {
	Ok        bool             `json:"ok"`
	Status    string           `json:"status"`
	StatusURL string           `json:"statusUrl,omitempty"`
	Run       PublicRun        `json:"run"`
	Artifacts []PublicArtifact `json:"artifacts"`
}

func (service *Service) StartRun(ctx context.Context, input StartRunInput) (PublicRunResult, error) {
	launch, err := service.LaunchStatus(ctx, LaunchLookupInput{LaunchID: input.LaunchID})
	if err != nil {
		return PublicRunResult{}, err
	}
	if len(input.FileRefs) == 0 {
		return PublicRunResult{}, cpd.ErrFileRefRequired
	}
	for _, fileRef := range input.FileRefs {
		file, err := service.store.FileByRef(ctx, strings.TrimSpace(fileRef))
		if errors.Is(err, cprepo.ErrNotFound) {
			return PublicRunResult{}, cpd.ErrFileRefRequired
		}
		if err != nil {
			return PublicRunResult{}, err
		}
		if file.LaunchID != launch.LaunchID || file.WorkspaceID != launch.WorkspaceID {
			return PublicRunResult{}, cpd.ErrFileRefRequired
		}
	}
	runID := strings.TrimSpace(input.RequestID)
	if runID == "" {
		runID = "run-" + shortID(launch.LaunchID+":"+strings.Join(input.FileRefs, ","))
	}
	artifactRef := "artifact-" + shortID(runID+":result")
	started := service.now().UTC()
	result := PublicRunResult{
		Ok:        true,
		Status:    "succeeded",
		StatusURL: "/api/opl/runs/" + runID + "/status",
		Run:       PublicRun{TraceID: "trace-" + shortID(runID), Status: "succeeded"},
		Artifacts: []PublicArtifact{{
			ArtifactRef:    artifactRef,
			WorkspaceID:    launch.WorkspaceID,
			ProviderKeyRef: launch.ProviderKeyRef,
			Kind:           "outputs",
			Name:           "result.md",
			RelativePath:   "outputs/result.md",
			SizeBytes:      256,
			ContentType:    "text/markdown",
		}},
	}
	if err := service.store.SaveRun(ctx, cpd.RunRecord{
		RunID:          runID,
		LaunchID:       launch.LaunchID,
		WorkspaceID:    launch.WorkspaceID,
		ProviderKeyRef: launch.ProviderKeyRef,
		TraceID:        result.Run.TraceID,
		Status:         result.Run.Status,
		ToolName:       strings.TrimSpace(input.ToolName),
		Message:        strings.TrimSpace(input.Message),
		FileRefs:       input.FileRefs,
		CreatedAt:      started.Format(time.RFC3339),
	}); err != nil {
		return PublicRunResult{}, err
	}
	artifact := result.Artifacts[0]
	if err := service.store.SaveArtifact(ctx, cpd.ArtifactRecord{
		ArtifactRef:    artifact.ArtifactRef,
		RunID:          runID,
		LaunchID:       launch.LaunchID,
		WorkspaceID:    artifact.WorkspaceID,
		ProviderKeyRef: artifact.ProviderKeyRef,
		Kind:           artifact.Kind,
		Name:           artifact.Name,
		RelativePath:   artifact.RelativePath,
		SizeBytes:      artifact.SizeBytes,
		ContentType:    artifact.ContentType,
		CreatedAt:      started.Format(time.RFC3339),
	}); err != nil {
		return PublicRunResult{}, err
	}
	for _, event := range []cpd.AuditEvent{
		{
			ID:                "audit-" + shortID(runID+":run"),
			Kind:              cpd.AuditKindRunSucceeded,
			WorkspaceID:       launch.WorkspaceID,
			ResourceBindingID: launch.ResourceBindingID,
			Status:            "recorded",
			IdempotencyKey:    runID,
			CreatedAt:         started.Format(time.RFC3339),
		},
		{
			ID:                "audit-" + shortID(artifactRef+":artifact"),
			Kind:              cpd.AuditKindArtifactAvailable,
			WorkspaceID:       launch.WorkspaceID,
			ResourceBindingID: launch.ResourceBindingID,
			Status:            "recorded",
			IdempotencyKey:    artifactRef,
			CreatedAt:         started.Format(time.RFC3339),
		},
	} {
		if err := service.store.SaveAuditEvent(ctx, event); err != nil {
			return PublicRunResult{}, err
		}
	}
	return result, nil
}

func (service *Service) Artifact(ctx context.Context, launchID string, artifactRef string) (map[string]any, error) {
	launch, err := service.LaunchStatus(ctx, LaunchLookupInput{LaunchID: launchID})
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(artifactRef) == "" {
		return nil, cpd.ErrArtifactRefRequired
	}
	record, err := service.store.ArtifactByRef(ctx, strings.TrimSpace(artifactRef))
	if errors.Is(err, cprepo.ErrNotFound) {
		return nil, cpd.ErrArtifactRefRequired
	}
	if err != nil {
		return nil, err
	}
	if record.LaunchID != launch.LaunchID || record.WorkspaceID != launch.WorkspaceID {
		return nil, cpd.ErrArtifactRefRequired
	}
	if _, err := service.store.RunByID(ctx, record.RunID); errors.Is(err, cprepo.ErrNotFound) {
		return nil, cpd.ErrArtifactRefRequired
	} else if err != nil {
		return nil, err
	}
	artifact := PublicArtifact{
		ArtifactRef:    record.ArtifactRef,
		WorkspaceID:    record.WorkspaceID,
		ProviderKeyRef: record.ProviderKeyRef,
		Kind:           record.Kind,
		Name:           record.Name,
		RelativePath:   record.RelativePath,
		SizeBytes:      record.SizeBytes,
		ContentType:    record.ContentType,
	}
	return map[string]any{"ok": true, "artifactRef": artifact.ArtifactRef, "artifact": artifact}, nil
}
