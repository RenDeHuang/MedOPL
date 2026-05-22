package workflow

import (
	"context"
	"errors"
	"testing"
	"time"

	workflowdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/workflow"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
	workflowrepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/workflow"
)

func TestFacadeCreatesPendingExecutionWithIdempotency(t *testing.T) {
	facade := NewFacade(memory.NewWorkflowStore())
	facade.now = func() time.Time { return time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC) }

	execution, err := facade.SubmitCommand(context.Background(), validCommand())
	if err != nil {
		t.Fatalf("SubmitCommand() error = %v", err)
	}
	if execution.Status != workflowdomain.WorkflowStatusPending {
		t.Fatalf("status = %q", execution.Status)
	}
	if execution.CommandID != "cmd-v22" || execution.IdempotencyKey != "idem-v22" {
		t.Fatalf("execution = %#v", execution)
	}
	if execution.CreatedAt.IsZero() {
		t.Fatalf("CreatedAt must be set")
	}
}

func TestFacadeReturnsExistingExecutionForIdempotencyKey(t *testing.T) {
	facade := NewFacade(memory.NewWorkflowStore())
	ctx := context.Background()
	command := validCommand()

	first, err := facade.SubmitCommand(ctx, command)
	if err != nil {
		t.Fatalf("SubmitCommand(first) error = %v", err)
	}
	second, err := facade.SubmitCommand(ctx, command)
	if err != nil {
		t.Fatalf("SubmitCommand(second) error = %v", err)
	}
	if second.CommandID != first.CommandID {
		t.Fatalf("second = %#v, first = %#v", second, first)
	}
}

func TestFacadeRejectsIdempotencyKeySemanticConflict(t *testing.T) {
	facade := NewFacade(memory.NewWorkflowStore())
	ctx := context.Background()
	command := validCommand()
	if _, err := facade.SubmitCommand(ctx, command); err != nil {
		t.Fatalf("SubmitCommand(first) error = %v", err)
	}

	command.CommandID = "cmd-v22-conflict"
	command.WorkspaceID = "workspace-v22-conflict"
	if _, err := facade.SubmitCommand(ctx, command); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("SubmitCommand(conflict) error = %v", err)
	}
}

func TestFacadeTreatsDuplicateIdempotencyRaceAsReplay(t *testing.T) {
	ctx := context.Background()
	store := &raceOnceStore{WorkflowStore: memory.NewWorkflowStore()}
	facade := NewFacade(store)
	command := validCommand()

	got, err := facade.SubmitCommand(ctx, command)
	if err != nil {
		t.Fatalf("SubmitCommand() error = %v", err)
	}
	if got.CommandID != command.CommandID {
		t.Fatalf("execution = %#v", got)
	}
}

func TestFacadeTransitionsPendingRunningSucceededFailedCancelled(t *testing.T) {
	t.Run("succeeded", func(t *testing.T) {
		facade := NewFacade(memory.NewWorkflowStore())
		ctx := context.Background()
		if _, err := facade.SubmitCommand(ctx, validCommand()); err != nil {
			t.Fatalf("SubmitCommand() error = %v", err)
		}
		running, err := facade.StartCommand(ctx, "cmd-v22")
		if err != nil {
			t.Fatalf("StartCommand() error = %v", err)
		}
		if running.Status != workflowdomain.WorkflowStatusRunning {
			t.Fatalf("running = %#v", running)
		}
		succeeded, err := facade.SucceedCommand(ctx, "cmd-v22")
		if err != nil {
			t.Fatalf("SucceedCommand() error = %v", err)
		}
		if succeeded.Status != workflowdomain.WorkflowStatusSucceeded {
			t.Fatalf("succeeded = %#v", succeeded)
		}
	})

	t.Run("failed", func(t *testing.T) {
		facade := NewFacade(memory.NewWorkflowStore())
		ctx := context.Background()
		if _, err := facade.SubmitCommand(ctx, validCommand()); err != nil {
			t.Fatalf("SubmitCommand() error = %v", err)
		}
		if _, err := facade.StartCommand(ctx, "cmd-v22"); err != nil {
			t.Fatalf("StartCommand() error = %v", err)
		}
		failed, err := facade.FailCommand(ctx, "cmd-v22", "runtime_failed")
		if err != nil {
			t.Fatalf("FailCommand() error = %v", err)
		}
		if failed.Status != workflowdomain.WorkflowStatusFailed || failed.Error != "runtime_failed" {
			t.Fatalf("failed = %#v", failed)
		}
	})

	t.Run("cancelled", func(t *testing.T) {
		facade := NewFacade(memory.NewWorkflowStore())
		ctx := context.Background()
		if _, err := facade.SubmitCommand(ctx, validCommand()); err != nil {
			t.Fatalf("SubmitCommand() error = %v", err)
		}
		cancelled, err := facade.CancelCommand(ctx, "cmd-v22", "user_cancelled")
		if err != nil {
			t.Fatalf("CancelCommand() error = %v", err)
		}
		if cancelled.Status != workflowdomain.WorkflowStatusCancelled || cancelled.Error != "user_cancelled" {
			t.Fatalf("cancelled = %#v", cancelled)
		}
	})
}

func TestFacadeReplaysSameStatusTransition(t *testing.T) {
	facade := NewFacade(memory.NewWorkflowStore())
	ctx := context.Background()
	if _, err := facade.SubmitCommand(ctx, validCommand()); err != nil {
		t.Fatalf("SubmitCommand() error = %v", err)
	}
	firstRunning, err := facade.StartCommand(ctx, "cmd-v22")
	if err != nil {
		t.Fatalf("StartCommand(first) error = %v", err)
	}
	secondRunning, err := facade.StartCommand(ctx, "cmd-v22")
	if err != nil {
		t.Fatalf("StartCommand(second) error = %v", err)
	}
	if secondRunning.Status != firstRunning.Status {
		t.Fatalf("second running = %#v, first running = %#v", secondRunning, firstRunning)
	}
	if _, err := facade.SucceedCommand(ctx, "cmd-v22"); err != nil {
		t.Fatalf("SucceedCommand(first) error = %v", err)
	}
	if replay, err := facade.SucceedCommand(ctx, "cmd-v22"); err != nil || replay.Status != workflowdomain.WorkflowStatusSucceeded {
		t.Fatalf("SucceedCommand(second) = %#v, %v", replay, err)
	}
}

func TestFacadeCreatesApprovalTask(t *testing.T) {
	facade := NewFacade(memory.NewWorkflowStore())
	ctx := context.Background()
	if _, err := facade.SubmitCommand(ctx, validCommand()); err != nil {
		t.Fatalf("SubmitCommand() error = %v", err)
	}

	task, err := facade.CreateApprovalTask(ctx, workflowdomain.ApprovalTask{
		ApprovalTaskID: "approval-v22",
		ExecutionID:    "cmd-v22",
		CommandID:      "cmd-v22",
		TenantID:       "tenant-v22",
		WorkspaceID:    "workspace-v22",
		Owner:          "ops-v22",
	})
	if err != nil {
		t.Fatalf("CreateApprovalTask() error = %v", err)
	}
	if task.Status != workflowdomain.ApprovalStatusPending {
		t.Fatalf("approval task = %#v", task)
	}
}

func TestFacadeRejectsApprovalTaskExecutionMismatch(t *testing.T) {
	facade := NewFacade(memory.NewWorkflowStore())
	ctx := context.Background()
	if _, err := facade.SubmitCommand(ctx, validCommand()); err != nil {
		t.Fatalf("SubmitCommand() error = %v", err)
	}

	_, err := facade.CreateApprovalTask(ctx, workflowdomain.ApprovalTask{
		ApprovalTaskID: "approval-v22",
		ExecutionID:    "cmd-v22-forged",
		CommandID:      "cmd-v22",
		TenantID:       "tenant-v22",
		WorkspaceID:    "workspace-v22",
		Owner:          "ops-v22",
	})
	if !errors.Is(err, ErrApprovalExecutionMismatch) {
		t.Fatalf("CreateApprovalTask(forged) error = %v", err)
	}
}

func validCommand() workflowdomain.Command {
	return workflowdomain.Command{
		CommandID:      "cmd-v22",
		CommandType:    "managed_run.submit",
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RequestedBy:    "user-v22",
		IdempotencyKey: "idem-v22",
		SourceSurface:  "portal-control-plane",
	}
}

type raceOnceStore struct {
	*memory.WorkflowStore
	firstRead bool
}

func (store *raceOnceStore) ExecutionByIdempotencyKey(ctx context.Context, key string) (workflowdomain.Execution, error) {
	if key == "idem-v22" && !store.firstRead {
		store.firstRead = true
		return workflowdomain.Execution{}, workflowrepo.ErrNotFound
	}
	return store.WorkflowStore.ExecutionByIdempotencyKey(ctx, key)
}

func (store *raceOnceStore) CreateExecution(ctx context.Context, execution workflowdomain.Execution) error {
	if err := store.WorkflowStore.CreateExecution(ctx, execution); err != nil {
		return err
	}
	return workflowrepo.ErrDuplicateIdempotencyKey
}
