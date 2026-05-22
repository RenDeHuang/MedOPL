package workflow

import (
	"errors"
	"testing"
	"time"
)

func TestWorkflowTransitionCoversPendingRunningSucceededFailedCancelled(t *testing.T) {
	now := time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC)
	execution := Execution{ExecutionID: "wf-v22", CommandID: "cmd-v22", Status: WorkflowStatusPending}

	running, err := Transition(execution, WorkflowStatusRunning, now, "")
	if err != nil {
		t.Fatalf("Transition(running) error = %v", err)
	}
	if running.Status != WorkflowStatusRunning || !running.StartedAt.Equal(now) {
		t.Fatalf("running execution = %#v", running)
	}

	succeeded, err := Transition(running, WorkflowStatusSucceeded, now.Add(time.Minute), "")
	if err != nil {
		t.Fatalf("Transition(succeeded) error = %v", err)
	}
	if succeeded.Status != WorkflowStatusSucceeded || succeeded.FinishedAt.IsZero() {
		t.Fatalf("succeeded execution = %#v", succeeded)
	}

	failed, err := Transition(running, WorkflowStatusFailed, now.Add(2*time.Minute), "runtime_failed")
	if err != nil {
		t.Fatalf("Transition(failed) error = %v", err)
	}
	if failed.Status != WorkflowStatusFailed || failed.Error != "runtime_failed" {
		t.Fatalf("failed execution = %#v", failed)
	}

	cancelled, err := Transition(execution, WorkflowStatusCancelled, now.Add(3*time.Minute), "user_cancelled")
	if err != nil {
		t.Fatalf("Transition(cancelled) error = %v", err)
	}
	if cancelled.Status != WorkflowStatusCancelled || cancelled.Error != "user_cancelled" {
		t.Fatalf("cancelled execution = %#v", cancelled)
	}
}

func TestWorkflowRejectsInvalidTransition(t *testing.T) {
	execution := Execution{ExecutionID: "wf-v22", CommandID: "cmd-v22", Status: WorkflowStatusPending}

	_, err := Transition(execution, WorkflowStatusSucceeded, time.Now(), "")
	if !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("Transition(pending->succeeded) error = %v", err)
	}

	terminal := Execution{ExecutionID: "wf-v22", CommandID: "cmd-v22", Status: WorkflowStatusSucceeded}
	_, err = Transition(terminal, WorkflowStatusRunning, time.Now(), "")
	if !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("Transition(succeeded->running) error = %v", err)
	}
}

func TestValidateCommandRequiresStableCommandAndIdempotency(t *testing.T) {
	command := Command{
		CommandID:      "cmd-v22",
		CommandType:    "managed_run.submit",
		TenantID:       "tenant-v22",
		WorkspaceID:    "workspace-v22",
		RequestedBy:    "user-v22",
		IdempotencyKey: "idem-v22",
	}
	if err := ValidateCommand(command); err != nil {
		t.Fatalf("ValidateCommand() error = %v", err)
	}

	command.IdempotencyKey = ""
	if !errors.Is(ValidateCommand(command), ErrIdempotencyKeyRequired) {
		t.Fatalf("ValidateCommand() must reject missing idempotency key")
	}
}
