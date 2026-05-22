package memory

import (
	"context"
	"errors"
	"testing"

	workflowdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/workflow"
	workflowrepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/workflow"
)

func TestWorkflowStorePersistsExecutionIndexesAndApprovalTask(t *testing.T) {
	ctx := context.Background()
	store := NewWorkflowStore()
	execution := workflowdomain.Execution{
		ExecutionID:    "cmd-v22",
		CommandID:      "cmd-v22",
		IdempotencyKey: "idem-v22",
		Status:         workflowdomain.WorkflowStatusPending,
	}
	task := workflowdomain.ApprovalTask{
		ApprovalTaskID: "approval-v22",
		ExecutionID:    "cmd-v22",
		CommandID:      "cmd-v22",
		TenantID:       "tenant-v22",
		WorkspaceID:    "workspace-v22",
		Owner:          "ops-v22",
		Status:         workflowdomain.ApprovalStatusPending,
	}

	if err := store.CreateExecution(ctx, execution); err != nil {
		t.Fatalf("CreateExecution() error = %v", err)
	}
	byCommand, err := store.ExecutionByCommandID(ctx, "cmd-v22")
	if err != nil {
		t.Fatalf("ExecutionByCommandID() error = %v", err)
	}
	if byCommand.ExecutionID != "cmd-v22" {
		t.Fatalf("ExecutionByCommandID() = %#v", byCommand)
	}
	byIdempotency, err := store.ExecutionByIdempotencyKey(ctx, "idem-v22")
	if err != nil {
		t.Fatalf("ExecutionByIdempotencyKey() error = %v", err)
	}
	if byIdempotency.ExecutionID != "cmd-v22" {
		t.Fatalf("ExecutionByIdempotencyKey() = %#v", byIdempotency)
	}
	if err := store.CreateApprovalTask(ctx, task); err != nil {
		t.Fatalf("CreateApprovalTask() error = %v", err)
	}
	gotTask, err := store.ApprovalTask(ctx, "approval-v22")
	if err != nil {
		t.Fatalf("ApprovalTask() error = %v", err)
	}
	if gotTask.CommandID != "cmd-v22" {
		t.Fatalf("ApprovalTask() = %#v", gotTask)
	}
}

func TestWorkflowStoreRejectsDuplicateIdempotencyKey(t *testing.T) {
	ctx := context.Background()
	store := NewWorkflowStore()
	first := workflowdomain.Execution{ExecutionID: "cmd-1", CommandID: "cmd-1", IdempotencyKey: "idem-v22"}
	second := workflowdomain.Execution{ExecutionID: "cmd-2", CommandID: "cmd-2", IdempotencyKey: "idem-v22"}

	if err := store.CreateExecution(ctx, first); err != nil {
		t.Fatalf("CreateExecution(first) error = %v", err)
	}
	if err := store.CreateExecution(ctx, second); !errors.Is(err, workflowrepo.ErrDuplicateIdempotencyKey) {
		t.Fatalf("CreateExecution(second) error = %v", err)
	}
}

func TestWorkflowStoreRejectsMutableExecutionIndexes(t *testing.T) {
	ctx := context.Background()
	store := NewWorkflowStore()
	execution := workflowdomain.Execution{
		ExecutionID:    "cmd-v22",
		CommandID:      "cmd-v22",
		IdempotencyKey: "idem-v22",
		Status:         workflowdomain.WorkflowStatusPending,
	}
	if err := store.CreateExecution(ctx, execution); err != nil {
		t.Fatalf("CreateExecution() error = %v", err)
	}

	execution.CommandID = "cmd-v22-mutated"
	if err := store.UpdateExecution(ctx, execution); !errors.Is(err, workflowrepo.ErrImmutableIdentity) {
		t.Fatalf("UpdateExecution(mutated command) error = %v", err)
	}

	execution.CommandID = "cmd-v22"
	execution.IdempotencyKey = "idem-v22-mutated"
	if err := store.UpdateExecution(ctx, execution); !errors.Is(err, workflowrepo.ErrImmutableIdentity) {
		t.Fatalf("UpdateExecution(mutated idempotency) error = %v", err)
	}
}
