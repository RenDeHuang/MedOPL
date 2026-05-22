package workflow

import (
	"context"
	"errors"
	"time"

	workflowdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/workflow"
	workflowrepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/workflow"
)

var (
	ErrDuplicateIdempotencyKey   = errors.New("duplicate_idempotency_key")
	ErrIdempotencyConflict       = errors.New("idempotency_conflict")
	ErrApprovalExecutionMismatch = errors.New("approval_execution_mismatch")
)

type Facade struct {
	store workflowrepo.Store
	now   func() time.Time
}

func NewFacade(store workflowrepo.Store) *Facade {
	return &Facade{store: store, now: time.Now}
}

func (facade *Facade) SubmitCommand(ctx context.Context, command workflowdomain.Command) (workflowdomain.Execution, error) {
	if err := workflowdomain.ValidateCommand(command); err != nil {
		return workflowdomain.Execution{}, err
	}
	if existing, err := facade.store.ExecutionByIdempotencyKey(ctx, command.IdempotencyKey); err == nil {
		if !sameCommandIdentity(existing, command) {
			return workflowdomain.Execution{}, ErrIdempotencyConflict
		}
		return existing, nil
	} else if !errors.Is(err, workflowrepo.ErrNotFound) {
		return workflowdomain.Execution{}, err
	}
	if command.CreatedAt.IsZero() {
		command.CreatedAt = facade.now()
	}
	execution, err := workflowdomain.NewExecution(command, command.CreatedAt)
	if err != nil {
		return workflowdomain.Execution{}, err
	}
	if err := facade.store.CreateExecution(ctx, execution); err != nil {
		if errors.Is(err, workflowrepo.ErrDuplicateIdempotencyKey) {
			existing, findErr := facade.store.ExecutionByIdempotencyKey(ctx, command.IdempotencyKey)
			if findErr != nil {
				return workflowdomain.Execution{}, ErrDuplicateIdempotencyKey
			}
			if !sameCommandIdentity(existing, command) {
				return workflowdomain.Execution{}, ErrIdempotencyConflict
			}
			return existing, nil
		}
		return workflowdomain.Execution{}, err
	}
	return execution, nil
}

func (facade *Facade) StartCommand(ctx context.Context, commandID string) (workflowdomain.Execution, error) {
	return facade.transition(ctx, commandID, workflowdomain.WorkflowStatusRunning, "")
}

func (facade *Facade) SucceedCommand(ctx context.Context, commandID string) (workflowdomain.Execution, error) {
	return facade.transition(ctx, commandID, workflowdomain.WorkflowStatusSucceeded, "")
}

func (facade *Facade) FailCommand(ctx context.Context, commandID string, reason string) (workflowdomain.Execution, error) {
	return facade.transition(ctx, commandID, workflowdomain.WorkflowStatusFailed, reason)
}

func (facade *Facade) CancelCommand(ctx context.Context, commandID string, reason string) (workflowdomain.Execution, error) {
	return facade.transition(ctx, commandID, workflowdomain.WorkflowStatusCancelled, reason)
}

func (facade *Facade) CreateApprovalTask(ctx context.Context, task workflowdomain.ApprovalTask) (workflowdomain.ApprovalTask, error) {
	if task.CreatedAt.IsZero() {
		task.CreatedAt = facade.now()
	}
	if task.Status == "" {
		task.Status = workflowdomain.ApprovalStatusPending
	}
	if err := workflowdomain.ValidateApprovalTask(task); err != nil {
		return workflowdomain.ApprovalTask{}, err
	}
	execution, err := facade.store.ExecutionByCommandID(ctx, task.CommandID)
	if err != nil {
		return workflowdomain.ApprovalTask{}, err
	}
	if task.ExecutionID != execution.ExecutionID {
		return workflowdomain.ApprovalTask{}, ErrApprovalExecutionMismatch
	}
	if err := facade.store.CreateApprovalTask(ctx, task); err != nil {
		return workflowdomain.ApprovalTask{}, err
	}
	return task, nil
}

func (facade *Facade) transition(ctx context.Context, commandID string, status workflowdomain.Status, reason string) (workflowdomain.Execution, error) {
	if commandID == "" {
		return workflowdomain.Execution{}, workflowdomain.ErrCommandIDRequired
	}
	execution, err := facade.store.ExecutionByCommandID(ctx, commandID)
	if err != nil {
		return workflowdomain.Execution{}, err
	}
	if execution.Status == status {
		return execution, nil
	}
	updated, err := workflowdomain.Transition(execution, status, facade.now(), reason)
	if err != nil {
		return workflowdomain.Execution{}, err
	}
	if err := facade.store.UpdateExecution(ctx, updated); err != nil {
		return workflowdomain.Execution{}, err
	}
	return updated, nil
}

func sameCommandIdentity(execution workflowdomain.Execution, command workflowdomain.Command) bool {
	return execution.CommandID == command.CommandID &&
		execution.CommandType == command.CommandType &&
		execution.TenantID == command.TenantID &&
		execution.PortalUserID == command.PortalUserID &&
		execution.WorkspaceID == command.WorkspaceID &&
		execution.RequestedBy == command.RequestedBy &&
		execution.SourceSurface == command.SourceSurface
}
