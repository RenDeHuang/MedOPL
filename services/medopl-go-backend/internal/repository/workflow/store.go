package workflow

import (
	"context"
	"errors"

	workflowdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/workflow"
)

var (
	ErrDuplicateID             = errors.New("duplicate_id")
	ErrDuplicateIdempotencyKey = errors.New("duplicate_idempotency_key")
	ErrImmutableIdentity       = errors.New("immutable_workflow_identity")
	ErrNotFound                = errors.New("not_found")
)

type Store interface {
	CreateExecution(ctx context.Context, execution workflowdomain.Execution) error
	ExecutionByCommandID(ctx context.Context, commandID string) (workflowdomain.Execution, error)
	ExecutionByIdempotencyKey(ctx context.Context, idempotencyKey string) (workflowdomain.Execution, error)
	UpdateExecution(ctx context.Context, execution workflowdomain.Execution) error
	CreateApprovalTask(ctx context.Context, task workflowdomain.ApprovalTask) error
	ApprovalTask(ctx context.Context, approvalTaskID string) (workflowdomain.ApprovalTask, error)
}
