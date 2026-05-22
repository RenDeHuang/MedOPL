package runfileartifact

import (
	"context"
	"errors"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/artifact"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/file"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/run"
)

var (
	ErrDuplicateID = errors.New("duplicate_id")
	ErrNotFound    = errors.New("not_found")
)

type CanonicalStore interface {
	SaveRunRequest(ctx context.Context, request run.RunRequest) error
	SaveRunExecution(ctx context.Context, execution run.RunExecution) error
	RunExecution(ctx context.Context, runID string) (run.RunExecution, error)
	SaveFileRef(ctx context.Context, ref file.FileRef) error
	SaveRunArtifact(ctx context.Context, item artifact.RunArtifact) error
	ListRunArtifacts(ctx context.Context, runID string) ([]artifact.RunArtifact, error)
}
