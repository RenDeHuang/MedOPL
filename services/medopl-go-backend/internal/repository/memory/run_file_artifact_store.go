package memory

import (
	"context"
	"sort"
	"sync"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/artifact"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/file"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/run"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/runfileartifact"
)

type RunFileArtifactStore struct {
	mu            sync.Mutex
	runRequests   map[string]run.RunRequest
	runExecutions map[string]run.RunExecution
	fileRefs      map[string]file.FileRef
	artifacts     map[string]artifact.RunArtifact
}

func NewRunFileArtifactStore() *RunFileArtifactStore {
	return &RunFileArtifactStore{
		runRequests:   make(map[string]run.RunRequest),
		runExecutions: make(map[string]run.RunExecution),
		fileRefs:      make(map[string]file.FileRef),
		artifacts:     make(map[string]artifact.RunArtifact),
	}
}

func (store *RunFileArtifactStore) SaveRunRequest(ctx context.Context, request run.RunRequest) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, ok := store.runRequests[request.RequestID]; ok {
		return runfileartifact.ErrDuplicateID
	}
	store.runRequests[request.RequestID] = request
	return nil
}

func (store *RunFileArtifactStore) SaveRunExecution(ctx context.Context, execution run.RunExecution) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.runExecutions[execution.RunID] = execution
	return nil
}

func (store *RunFileArtifactStore) RunExecution(ctx context.Context, runID string) (run.RunExecution, error) {
	if err := ctx.Err(); err != nil {
		return run.RunExecution{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	execution, ok := store.runExecutions[runID]
	if !ok {
		return run.RunExecution{}, runfileartifact.ErrNotFound
	}
	return execution, nil
}

func (store *RunFileArtifactStore) SaveFileRef(ctx context.Context, ref file.FileRef) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, ok := store.fileRefs[ref.FileRef]; ok {
		return runfileartifact.ErrDuplicateID
	}
	store.fileRefs[ref.FileRef] = ref
	return nil
}

func (store *RunFileArtifactStore) SaveRunArtifact(ctx context.Context, item artifact.RunArtifact) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, ok := store.artifacts[item.ArtifactID]; ok {
		return runfileartifact.ErrDuplicateID
	}
	store.artifacts[item.ArtifactID] = item
	return nil
}

func (store *RunFileArtifactStore) ListRunArtifacts(ctx context.Context, runID string) ([]artifact.RunArtifact, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	items := make([]artifact.RunArtifact, 0)
	for _, item := range store.artifacts {
		if item.RunID == runID {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ArtifactID < items[j].ArtifactID
	})
	return items, nil
}
