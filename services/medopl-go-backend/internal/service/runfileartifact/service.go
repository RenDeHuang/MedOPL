package runfileartifact

import (
	"context"
	"errors"
	"time"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/artifact"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/file"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/run"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/runfileartifact"
)

var ErrDuplicateID = errors.New("duplicate_id")

type Service struct {
	store runfileartifact.CanonicalStore
	now   func() time.Time
}

func NewService(store runfileartifact.CanonicalStore) *Service {
	return &Service{store: store, now: time.Now}
}

func (service *Service) CreateRunRequest(ctx context.Context, request run.RunRequest) (run.RunExecution, error) {
	if err := run.ValidateRunRequest(request); err != nil {
		return run.RunExecution{}, err
	}
	if request.CreatedAt.IsZero() {
		request.CreatedAt = service.now()
	}
	if err := service.store.SaveRunRequest(ctx, request); err != nil {
		return run.RunExecution{}, mapDuplicate(err)
	}
	execution := run.RunExecution{
		RunID:                request.RequestID,
		RequestID:            request.RequestID,
		TenantID:             request.TenantID,
		PortalUserID:         request.PortalUserID,
		WorkspaceID:          request.WorkspaceID,
		WorkspaceSessionID:   request.WorkspaceSessionID,
		RuntimeSessionID:     request.RuntimeSessionID,
		TraceID:              request.TraceID,
		Kind:                 request.Kind,
		ToolName:             request.ToolName,
		Mode:                 request.Mode,
		ResourceBindingID:    request.ResourceBindingID,
		ComputeInstanceID:    request.ComputeInstanceID,
		StorageBucketID:      request.StorageBucketID,
		RuntimeAgentID:       request.RuntimeAgentID,
		RuntimeAgentEndpoint: request.RuntimeAgentEndpoint,
		Status:               run.RunStatusPending,
		CreatedAt:            request.CreatedAt,
		Model:                request.Model,
		ProviderKeyRef:       request.ProviderKeyRef,
	}
	if err := service.store.SaveRunExecution(ctx, execution); err != nil {
		return run.RunExecution{}, mapDuplicate(err)
	}
	return execution, nil
}

func (service *Service) RecordFileRef(ctx context.Context, ref file.FileRef) error {
	if err := file.ValidateFileRef(ref); err != nil {
		return err
	}
	return mapDuplicate(service.store.SaveFileRef(ctx, ref))
}

func (service *Service) RecordRunArtifact(ctx context.Context, item artifact.RunArtifact) error {
	if err := artifact.ValidateRunArtifact(item); err != nil {
		return err
	}
	return mapDuplicate(service.store.SaveRunArtifact(ctx, item))
}

func (service *Service) RecordRuntimeResult(ctx context.Context, runID string, result run.RuntimeResult) (run.RunExecution, error) {
	execution, err := service.store.RunExecution(ctx, runID)
	if err != nil {
		return run.RunExecution{}, err
	}
	if result.Status == run.RunStatusSucceeded {
		items, err := service.store.ListRunArtifacts(ctx, runID)
		if err != nil {
			return run.RunExecution{}, err
		}
		result.Artifacts = items
	}
	updated, err := run.ApplyRuntimeResult(execution, result)
	if err != nil {
		return run.RunExecution{}, err
	}
	if err := service.store.SaveRunExecution(ctx, updated); err != nil {
		return run.RunExecution{}, mapDuplicate(err)
	}
	return updated, nil
}

func mapDuplicate(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, runfileartifact.ErrDuplicateID) {
		return ErrDuplicateID
	}
	return err
}
