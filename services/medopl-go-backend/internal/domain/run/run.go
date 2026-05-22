package run

import (
	"errors"
	"time"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/artifact"
)

type Status string

const (
	RunStatusPending   Status = "pending"
	RunStatusSubmitted Status = "submitted"
	RunStatusRunning   Status = "running"
	RunStatusSucceeded Status = "succeeded"
	RunStatusFailed    Status = "failed"
	RunStatusCancelled Status = "cancelled"
	RunStatusGated     Status = "gated"
)

const ModeFullRuntime = "full_runtime"

var (
	ErrRunIDRequired           = errors.New("run_id_required")
	ErrTenantRequired          = errors.New("tenant_required")
	ErrWorkspaceRequired       = errors.New("workspace_required")
	ErrRuntimeSessionRequired  = errors.New("runtime_session_required")
	ErrResourceBindingRequired = errors.New("resource_binding_required")
	ErrComputeInstanceRequired = errors.New("compute_instance_required")
	ErrStorageBucketRequired   = errors.New("storage_bucket_required")
	ErrRuntimeAgentRequired    = errors.New("runtime_agent_required")
	ErrProviderKeyRequired     = errors.New("provider_key_required")
	ErrFileRefRequired         = errors.New("file_ref_required")
	ErrIdempotencyKeyRequired  = errors.New("idempotency_key_required")
	ErrInvalidRunMode          = errors.New("invalid_run_mode")
	ErrInvalidRunStatus        = errors.New("invalid_run_status")
	ErrArtifactNotObserved     = errors.New("artifact_not_observed")
)

type RunRequest struct {
	RequestID            string
	TenantID             string
	PortalUserID         string
	WorkspaceID          string
	WorkspaceSessionID   string
	RuntimeSessionID     string
	ResourceBindingID    string
	ComputeInstanceID    string
	StorageBucketID      string
	ProviderKeyRef       string
	TraceID              string
	Message              string
	ToolName             string
	Kind                 string
	Model                string
	FileRefs             []string
	Mode                 string
	RuntimeAgentID       string
	RuntimeAgentEndpoint string
	IdempotencyKey       string
	SourceSurface        string
	CreatedAt            time.Time
}

type RunExecution struct {
	RunID                string
	RequestID            string
	TenantID             string
	PortalUserID         string
	OwnerID              string
	WorkspaceID          string
	WorkspaceSessionID   string
	RuntimeSessionID     string
	TraceID              string
	Kind                 string
	AgentID              string
	ToolName             string
	Mode                 string
	ResourceBindingID    string
	ComputeInstanceID    string
	StorageBucketID      string
	RuntimeAgentID       string
	RuntimeAgentEndpoint string
	BillingMetadataRef   string
	UsageMetadataRef     string
	Status               Status
	CreatedAt            time.Time
	StartedAt            time.Time
	FinishedAt           time.Time
	LatencyMS            int64
	TokenCount           int64
	Model                string
	UserAgent            string
	Error                string
	ProviderKeyRef       string
}

type RuntimeResult struct {
	Status             Status
	TraceID            string
	BillingMetadataRef string
	UsageMetadataRef   string
	StartedAt          time.Time
	FinishedAt         time.Time
	LatencyMS          int64
	TokenCount         int64
	Model              string
	Error              string
	Artifacts          []artifact.RunArtifact
}

func ValidateRunRequest(request RunRequest) error {
	if request.RequestID == "" {
		return ErrRunIDRequired
	}
	if request.TenantID == "" {
		return ErrTenantRequired
	}
	if request.WorkspaceID == "" {
		return ErrWorkspaceRequired
	}
	if request.RuntimeSessionID == "" {
		return ErrRuntimeSessionRequired
	}
	if request.ResourceBindingID == "" {
		return ErrResourceBindingRequired
	}
	if request.ComputeInstanceID == "" {
		return ErrComputeInstanceRequired
	}
	if request.StorageBucketID == "" {
		return ErrStorageBucketRequired
	}
	if request.RuntimeAgentID == "" {
		return ErrRuntimeAgentRequired
	}
	if request.RuntimeAgentEndpoint == "" {
		return ErrRuntimeAgentRequired
	}
	if request.ProviderKeyRef == "" {
		return ErrProviderKeyRequired
	}
	if len(request.FileRefs) == 0 {
		return ErrFileRefRequired
	}
	if request.IdempotencyKey == "" {
		return ErrIdempotencyKeyRequired
	}
	if request.Mode != ModeFullRuntime {
		return ErrInvalidRunMode
	}
	return nil
}

func ApplyRuntimeResult(execution RunExecution, result RuntimeResult) (RunExecution, error) {
	if !validStatus(result.Status) {
		return RunExecution{}, ErrInvalidRunStatus
	}
	if result.Status == RunStatusSucceeded && len(result.Artifacts) == 0 {
		return RunExecution{}, ErrArtifactNotObserved
	}
	execution.Status = result.Status
	if result.TraceID != "" {
		execution.TraceID = result.TraceID
	}
	execution.BillingMetadataRef = result.BillingMetadataRef
	execution.UsageMetadataRef = result.UsageMetadataRef
	execution.StartedAt = result.StartedAt
	execution.FinishedAt = result.FinishedAt
	execution.LatencyMS = result.LatencyMS
	execution.TokenCount = result.TokenCount
	execution.Model = result.Model
	execution.Error = result.Error
	return execution, nil
}

func validStatus(status Status) bool {
	switch status {
	case RunStatusPending, RunStatusSubmitted, RunStatusRunning, RunStatusSucceeded, RunStatusFailed, RunStatusCancelled, RunStatusGated:
		return true
	default:
		return false
	}
}
