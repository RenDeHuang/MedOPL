package runtimebroker

import (
	"context"
	"errors"
	"time"
)

type RunStatus string

const (
	RunStatusPending   RunStatus = "pending"
	RunStatusRunning   RunStatus = "running"
	RunStatusSucceeded RunStatus = "succeeded"
	RunStatusFailed    RunStatus = "failed"
	RunStatusCancelled RunStatus = "cancelled"
	RunStatusGated     RunStatus = "gated"
)

var (
	ErrProviderKeyRequired     = errors.New("provider_key_required")
	ErrResourceBindingRequired = errors.New("resource_binding_required")
	ErrRuntimeAgentRequired    = errors.New("runtime_agent_required")
	ErrArtifactNotObserved     = errors.New("artifact_not_observed")
	ErrInvalidRunMode          = errors.New("invalid_run_mode")
	ErrRunNotFound             = errors.New("run_not_found")
	ErrArtifactNotFound        = errors.New("artifact_not_found")
)

type Broker interface {
	BindSession(ctx context.Context, request SessionBindRequest) (SessionBinding, error)
	SubmitRun(ctx context.Context, request RunSubmitRequest) (RunResponse, error)
	RunStatus(ctx context.Context, runID string) (RunResponse, error)
	ListArtifacts(ctx context.Context, runID string) ([]PublicRunArtifact, error)
	Artifact(ctx context.Context, artifactRef string) (PublicRunArtifact, error)
}

type SessionBindRequest struct {
	TenantID           string
	PortalUserID       string
	WorkspaceID        string
	WorkspaceSessionID string
	RuntimeSessionID   string
	OPLSessionID       string
	ResourceBindingID  string
	ProviderKeyRef     string
	Provider           string
	Source             string
}

type SessionBinding struct {
	RuntimeSessionID     string
	OPLSessionID         string
	PortalUserID         string
	TenantID             string
	WorkspaceID          string
	WorkspaceSessionID   string
	ResourceBindingID    string
	ProviderKeyRef       string
	ProviderConfigured   bool
	ProviderConfigStatus string
	ProviderBound        bool
	Status               string
}

type RunSubmitRequest struct {
	RunID                string
	TraceID              string
	ToolName             string
	Kind                 string
	Message              string
	Model                string
	FileRefs             []string
	Mode                 string
	WorkspaceID          string
	WorkspaceSessionID   string
	RuntimeSessionID     string
	ResourceBindingID    string
	ComputeInstanceID    string
	StorageBucketID      string
	RuntimeAgentID       string
	RuntimeAgentEndpoint string
	ProviderKeyRef       string
	IdempotencyKey       string
}

type RunResponse struct {
	RunID              string
	TraceID            string
	Status             RunStatus
	WorkspaceID        string
	WorkspaceSessionID string
	RuntimeSessionID   string
	ResourceBindingID  string
	ProviderKeyRef     string
	Mode               string
	ToolName           string
	CreatedAt          time.Time
	FinishedAt         time.Time
	BillingMetadataRef string
	UsageMetadataRef   string
	Artifacts          []PublicRunArtifact
	RuntimeClaims      RuntimeClaims
}

type RuntimeClaims struct {
	RuntimeSessionID string
	WorkspaceID      string
	ProviderKeyRef   string
}

type ArtifactRecord struct {
	ArtifactID        string
	ArtifactRef       string
	RunID             string
	WorkspaceID       string
	ResourceBindingID string
	ProviderKeyRef    string
	Kind              string
	Name              string
	RelativePath      string
	SizeBytes         int64
	ContentType       string
}

type PublicRunArtifact struct {
	ArtifactID        string
	ArtifactRef       string
	RunID             string
	WorkspaceID       string
	ResourceBindingID string
	ProviderKeyRef    string
	Kind              string
	Name              string
	RelativePath      string
	SizeBytes         int64
	ContentType       string
}

func SanitizeArtifact(record ArtifactRecord) (PublicRunArtifact, error) {
	if record.ArtifactID == "" || record.ArtifactRef == "" {
		return PublicRunArtifact{}, ErrArtifactNotObserved
	}
	if record.RunID == "" {
		return PublicRunArtifact{}, ErrRunNotFound
	}
	if record.WorkspaceID == "" || record.ResourceBindingID == "" {
		return PublicRunArtifact{}, ErrResourceBindingRequired
	}
	if record.ProviderKeyRef == "" {
		return PublicRunArtifact{}, ErrProviderKeyRequired
	}
	return PublicRunArtifact{
		ArtifactID:        record.ArtifactID,
		ArtifactRef:       record.ArtifactRef,
		RunID:             record.RunID,
		WorkspaceID:       record.WorkspaceID,
		ResourceBindingID: record.ResourceBindingID,
		ProviderKeyRef:    record.ProviderKeyRef,
		Kind:              valueOrDefault(record.Kind, "outputs"),
		Name:              record.Name,
		RelativePath:      record.RelativePath,
		SizeBytes:         record.SizeBytes,
		ContentType:       valueOrDefault(record.ContentType, "application/octet-stream"),
	}, nil
}

func valueOrDefault(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
