package workflow

import (
	"errors"
	"time"
)

type Status string

const (
	WorkflowStatusPending   Status = "pending"
	WorkflowStatusRunning   Status = "running"
	WorkflowStatusSucceeded Status = "succeeded"
	WorkflowStatusFailed    Status = "failed"
	WorkflowStatusCancelled Status = "cancelled"
)

type ApprovalStatus string

const (
	ApprovalStatusPending   ApprovalStatus = "pending"
	ApprovalStatusApproved  ApprovalStatus = "approved"
	ApprovalStatusRejected  ApprovalStatus = "rejected"
	ApprovalStatusCancelled ApprovalStatus = "cancelled"
)

var (
	ErrCommandIDRequired      = errors.New("workflow_command_id_required")
	ErrCommandTypeRequired    = errors.New("workflow_command_type_required")
	ErrTenantRequired         = errors.New("tenant_required")
	ErrWorkspaceRequired      = errors.New("workspace_required")
	ErrRequestedByRequired    = errors.New("requested_by_required")
	ErrIdempotencyKeyRequired = errors.New("idempotency_key_required")
	ErrInvalidWorkflowStatus  = errors.New("invalid_workflow_status")
	ErrInvalidTransition      = errors.New("invalid_workflow_transition")
	ErrExecutionIDRequired    = errors.New("workflow_execution_id_required")
	ErrApprovalTaskIDRequired = errors.New("approval_task_id_required")
	ErrApprovalOwnerRequired  = errors.New("approval_owner_required")
	ErrInvalidApprovalStatus  = errors.New("invalid_approval_status")
)

type Command struct {
	CommandID      string
	CommandType    string
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	RequestedBy    string
	IdempotencyKey string
	SourceSurface  string
	CreatedAt      time.Time
}

type Execution struct {
	ExecutionID    string
	CommandID      string
	CommandType    string
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	RequestedBy    string
	IdempotencyKey string
	SourceSurface  string
	Status         Status
	CreatedAt      time.Time
	StartedAt      time.Time
	FinishedAt     time.Time
	Error          string
}

type ApprovalTask struct {
	ApprovalTaskID string
	ExecutionID    string
	CommandID      string
	TenantID       string
	WorkspaceID    string
	Owner          string
	Status         ApprovalStatus
	Reason         string
	CreatedAt      time.Time
	ResolvedAt     time.Time
}

func ValidateCommand(command Command) error {
	if command.CommandID == "" {
		return ErrCommandIDRequired
	}
	if command.CommandType == "" {
		return ErrCommandTypeRequired
	}
	if command.TenantID == "" {
		return ErrTenantRequired
	}
	if command.WorkspaceID == "" {
		return ErrWorkspaceRequired
	}
	if command.RequestedBy == "" {
		return ErrRequestedByRequired
	}
	if command.IdempotencyKey == "" {
		return ErrIdempotencyKeyRequired
	}
	return nil
}

func NewExecution(command Command, now time.Time) (Execution, error) {
	if err := ValidateCommand(command); err != nil {
		return Execution{}, err
	}
	if now.IsZero() {
		now = command.CreatedAt
	}
	if now.IsZero() {
		now = time.Now()
	}
	return Execution{
		ExecutionID:    command.CommandID,
		CommandID:      command.CommandID,
		CommandType:    command.CommandType,
		TenantID:       command.TenantID,
		PortalUserID:   command.PortalUserID,
		WorkspaceID:    command.WorkspaceID,
		RequestedBy:    command.RequestedBy,
		IdempotencyKey: command.IdempotencyKey,
		SourceSurface:  command.SourceSurface,
		Status:         WorkflowStatusPending,
		CreatedAt:      now,
	}, nil
}

func Transition(execution Execution, next Status, at time.Time, reason string) (Execution, error) {
	if !validStatus(next) {
		return Execution{}, ErrInvalidWorkflowStatus
	}
	if !canTransition(execution.Status, next) {
		return Execution{}, ErrInvalidTransition
	}
	if at.IsZero() {
		at = time.Now()
	}
	execution.Status = next
	switch next {
	case WorkflowStatusRunning:
		execution.StartedAt = at
	case WorkflowStatusSucceeded, WorkflowStatusFailed, WorkflowStatusCancelled:
		execution.FinishedAt = at
		execution.Error = reason
	}
	return execution, nil
}

func ValidateApprovalTask(task ApprovalTask) error {
	if task.ApprovalTaskID == "" {
		return ErrApprovalTaskIDRequired
	}
	if task.ExecutionID == "" {
		return ErrExecutionIDRequired
	}
	if task.CommandID == "" {
		return ErrCommandIDRequired
	}
	if task.TenantID == "" {
		return ErrTenantRequired
	}
	if task.WorkspaceID == "" {
		return ErrWorkspaceRequired
	}
	if task.Owner == "" {
		return ErrApprovalOwnerRequired
	}
	if !validApprovalStatus(task.Status) {
		return ErrInvalidApprovalStatus
	}
	return nil
}

func validStatus(status Status) bool {
	switch status {
	case WorkflowStatusPending, WorkflowStatusRunning, WorkflowStatusSucceeded, WorkflowStatusFailed, WorkflowStatusCancelled:
		return true
	default:
		return false
	}
}

func canTransition(current Status, next Status) bool {
	switch current {
	case WorkflowStatusPending:
		return next == WorkflowStatusRunning || next == WorkflowStatusCancelled
	case WorkflowStatusRunning:
		return next == WorkflowStatusSucceeded || next == WorkflowStatusFailed || next == WorkflowStatusCancelled
	default:
		return false
	}
}

func validApprovalStatus(status ApprovalStatus) bool {
	switch status {
	case ApprovalStatusPending, ApprovalStatusApproved, ApprovalStatusRejected, ApprovalStatusCancelled:
		return true
	default:
		return false
	}
}
