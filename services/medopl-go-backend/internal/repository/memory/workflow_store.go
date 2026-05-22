package memory

import (
	"context"
	"sync"

	workflowdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/workflow"
	workflowrepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/workflow"
)

type WorkflowStore struct {
	mu                sync.Mutex
	executionsByID    map[string]workflowdomain.Execution
	commandIndex      map[string]string
	idempotencyKey    map[string]string
	approvalTasksByID map[string]workflowdomain.ApprovalTask
}

func NewWorkflowStore() *WorkflowStore {
	return &WorkflowStore{
		executionsByID:    make(map[string]workflowdomain.Execution),
		commandIndex:      make(map[string]string),
		idempotencyKey:    make(map[string]string),
		approvalTasksByID: make(map[string]workflowdomain.ApprovalTask),
	}
}

func (store *WorkflowStore) CreateExecution(ctx context.Context, execution workflowdomain.Execution) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, ok := store.executionsByID[execution.ExecutionID]; ok {
		return workflowrepo.ErrDuplicateID
	}
	if _, ok := store.commandIndex[execution.CommandID]; ok {
		return workflowrepo.ErrDuplicateID
	}
	if _, ok := store.idempotencyKey[execution.IdempotencyKey]; ok {
		return workflowrepo.ErrDuplicateIdempotencyKey
	}
	store.executionsByID[execution.ExecutionID] = execution
	store.commandIndex[execution.CommandID] = execution.ExecutionID
	store.idempotencyKey[execution.IdempotencyKey] = execution.ExecutionID
	return nil
}

func (store *WorkflowStore) ExecutionByCommandID(ctx context.Context, commandID string) (workflowdomain.Execution, error) {
	if err := ctx.Err(); err != nil {
		return workflowdomain.Execution{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	executionID, ok := store.commandIndex[commandID]
	if !ok {
		return workflowdomain.Execution{}, workflowrepo.ErrNotFound
	}
	return store.executionsByID[executionID], nil
}

func (store *WorkflowStore) ExecutionByIdempotencyKey(ctx context.Context, key string) (workflowdomain.Execution, error) {
	if err := ctx.Err(); err != nil {
		return workflowdomain.Execution{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	executionID, ok := store.idempotencyKey[key]
	if !ok {
		return workflowdomain.Execution{}, workflowrepo.ErrNotFound
	}
	return store.executionsByID[executionID], nil
}

func (store *WorkflowStore) UpdateExecution(ctx context.Context, execution workflowdomain.Execution) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	current, ok := store.executionsByID[execution.ExecutionID]
	if !ok {
		return workflowrepo.ErrNotFound
	}
	if current.CommandID != execution.CommandID || current.IdempotencyKey != execution.IdempotencyKey {
		return workflowrepo.ErrImmutableIdentity
	}
	store.executionsByID[execution.ExecutionID] = execution
	return nil
}

func (store *WorkflowStore) CreateApprovalTask(ctx context.Context, task workflowdomain.ApprovalTask) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, ok := store.approvalTasksByID[task.ApprovalTaskID]; ok {
		return workflowrepo.ErrDuplicateID
	}
	store.approvalTasksByID[task.ApprovalTaskID] = task
	return nil
}

func (store *WorkflowStore) ApprovalTask(ctx context.Context, approvalTaskID string) (workflowdomain.ApprovalTask, error) {
	if err := ctx.Err(); err != nil {
		return workflowdomain.ApprovalTask{}, err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	task, ok := store.approvalTasksByID[approvalTaskID]
	if !ok {
		return workflowdomain.ApprovalTask{}, workflowrepo.ErrNotFound
	}
	return task, nil
}
