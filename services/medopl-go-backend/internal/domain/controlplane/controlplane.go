package controlplane

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	ProviderBoundStatusActive = "bound"
	LaunchStatusReady         = "ready"
	LaunchStatusBlocked       = "blocked_by_provider_key"
	ResourceStatusActive      = "active"
	ResourceStatusReleased    = "released"
	BillingStatusActive       = "active"
	BillingStatusStopped      = "stopped"
	AuditKindResourceRelease  = "resource.release"
)

var (
	ErrTenantRequired          = errors.New("tenant_required")
	ErrPortalUserRequired      = errors.New("portal_user_required")
	ErrWorkspaceRequired       = errors.New("workspace_required")
	ErrProviderKeyRequired     = errors.New("provider_key_required")
	ErrIdempotencyKeyRequired  = errors.New("idempotency_key_required")
	ErrLaunchRequired          = errors.New("launch_required")
	ErrLaunchNotFound          = errors.New("launch_not_found")
	ErrResourceNotFound        = errors.New("resource_not_found")
	ErrResourceBindingRequired = errors.New("resource_binding_required")
	ErrFileNameRequired        = errors.New("file_name_required")
	ErrFileRefRequired         = errors.New("file_ref_required")
)

type BindProviderKeyInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	RawProviderKey string
	IdempotencyKey string
	CreatedAt      time.Time
}

type ProviderBinding struct {
	TenantID       string `json:"tenantId"`
	PortalUserID   string `json:"portalUserId"`
	WorkspaceID    string `json:"workspaceId"`
	ProviderBound  bool   `json:"providerBound"`
	ProviderKeyRef string `json:"providerKeyRef"`
	BoundStatus    string `json:"boundStatus"`
	IdempotencyKey string `json:"idempotencyKey"`
	CreatedAt      string `json:"createdAt,omitempty"`
}

type PreflightInput struct {
	WorkspaceID string
	Binding     ProviderBinding
}

type PreflightResult struct {
	Ok                         bool   `json:"ok"`
	Error                      string `json:"error,omitempty"`
	WorkspaceID                string `json:"workspaceId"`
	ProviderBound              bool   `json:"providerBound"`
	ProviderKeyRef             string `json:"providerKeyRef"`
	BoundStatus                string `json:"boundStatus"`
	LaunchStatus               string `json:"launchStatus"`
	ReadyForManagedEnvironment bool   `json:"readyForManagedEnvironment"`
	NextAction                 string `json:"nextAction"`
	Reason                     string `json:"reason,omitempty"`
}

type LaunchInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	Binding        ProviderBinding
	IdempotencyKey string
	CreatedAt      time.Time
}

type LaunchStage struct {
	Stage            string `json:"stage"`
	Ok               bool   `json:"ok"`
	BlockingUser     bool   `json:"blockingUser"`
	UserVisibleState string `json:"userVisibleState"`
	StartedAt        string `json:"startedAt"`
	EndedAt          string `json:"endedAt"`
	LatencyMS        int    `json:"latencyMs"`
}

type LaunchProjection struct {
	Ok                   bool          `json:"ok"`
	LaunchID             string        `json:"launchId"`
	OpenURL              string        `json:"openUrl"`
	OPLWebURL            string        `json:"oplWebUrl"`
	RuntimeURL           string        `json:"runtimeUrl"`
	LaunchStatus         string        `json:"launchStatus"`
	Status               string        `json:"status"`
	WorkspaceID          string        `json:"workspaceId"`
	WorkspaceSessionID   string        `json:"workspaceSessionId"`
	RuntimeSessionID     string        `json:"runtimeSessionId"`
	OPLSessionID         string        `json:"oplSessionId"`
	ResourceBindingID    string        `json:"resourceBindingId"`
	ComputeInstanceID    string        `json:"computeInstanceId"`
	StorageBucketID      string        `json:"storageBucketId"`
	RuntimeAgentID       string        `json:"runtimeAgentId"`
	RuntimeAgentEndpoint string        `json:"runtimeAgentEndpoint"`
	ProviderBound        bool          `json:"providerBound"`
	ProviderKeyRef       string        `json:"providerKeyRef"`
	GatewayReady         bool          `json:"gatewayReady"`
	GatewayState         string        `json:"gatewayState"`
	CurrentStage         string        `json:"currentStage"`
	UserVisibleState     string        `json:"userVisibleState"`
	BlockingUser         bool          `json:"blockingUser"`
	Stages               []LaunchStage `json:"stages"`
}

type BootstrapProjection struct {
	RuntimeBridgeContractVersion string            `json:"runtimeBridgeContractVersion"`
	Capabilities                 []string          `json:"capabilities"`
	SupportedEvents              []string          `json:"supportedEvents"`
	Identity                     BootstrapIdentity `json:"identity"`
}

type BootstrapIdentity struct {
	PortalUserID       string `json:"portalUserId"`
	WorkspaceID        string `json:"workspaceId"`
	WorkspaceSessionID string `json:"workspaceSessionId"`
	RuntimeSessionID   string `json:"runtimeSessionId"`
	OPLSessionID       string `json:"oplSessionId"`
}

type ResourceInput struct {
	TenantID          string
	PortalUserID      string
	WorkspaceID       string
	ResourceBindingID string
}

type BillingState struct {
	Status                          string `json:"status"`
	BillingStoppedAt                string `json:"billingStoppedAt,omitempty"`
	BillingStopConfirmBy            string `json:"billingStopConfirmBy,omitempty"`
	ConfirmWithinMinutes            int    `json:"confirmWithinMinutes"`
	StopBillingConfirmWithinMinutes int    `json:"stopBillingConfirmWithinMinutes,omitempty"`
}

type ManagedResource struct {
	TenantID          string       `json:"tenantId"`
	PortalUserID      string       `json:"portalUserId"`
	WorkspaceID       string       `json:"workspaceId"`
	ResourceBindingID string       `json:"resourceBindingId"`
	Status            string       `json:"status"`
	StopBilling       BillingState `json:"stopBilling"`
	ReleasePolicy     BillingState `json:"releasePolicy"`
}

type ReleaseInput struct {
	WorkspaceID       string
	ResourceBindingID string
	StopBilling       bool
	IdempotencyKey    string
	ReleasedAt        time.Time
}

type AuditEvent struct {
	ID                string `json:"id"`
	Kind              string `json:"kind"`
	WorkspaceID       string `json:"workspaceId"`
	ResourceBindingID string `json:"resourceBindingId"`
	Status            string `json:"status"`
	IdempotencyKey    string `json:"idempotencyKey"`
	CreatedAt         string `json:"createdAt,omitempty"`
}

func NewProviderBinding(input BindProviderKeyInput) (ProviderBinding, error) {
	if err := requireCore(input.TenantID, input.PortalUserID, input.WorkspaceID); err != nil {
		return ProviderBinding{}, err
	}
	if strings.TrimSpace(input.RawProviderKey) == "" {
		return ProviderBinding{}, ErrProviderKeyRequired
	}
	if strings.TrimSpace(input.IdempotencyKey) == "" {
		return ProviderBinding{}, ErrIdempotencyKeyRequired
	}
	createdAt := input.CreatedAt.UTC()
	return ProviderBinding{
		TenantID:       clean(input.TenantID),
		PortalUserID:   clean(input.PortalUserID),
		WorkspaceID:    clean(input.WorkspaceID),
		ProviderBound:  true,
		ProviderKeyRef: fmt.Sprintf("gflab:%s:%s", clean(input.WorkspaceID), digest(clean(input.RawProviderKey))[:12]),
		BoundStatus:    ProviderBoundStatusActive,
		IdempotencyKey: clean(input.IdempotencyKey),
		CreatedAt:      optionalTime(createdAt),
	}, nil
}

func Preflight(input PreflightInput) PreflightResult {
	workspaceID := clean(input.WorkspaceID)
	if workspaceID == "" {
		workspaceID = input.Binding.WorkspaceID
	}
	if workspaceID == "" {
		return PreflightResult{Ok: false, Error: "workspace_required", LaunchStatus: "workspace_required", NextAction: "select_workspace"}
	}
	if !input.Binding.ProviderBound || input.Binding.ProviderKeyRef == "" {
		return PreflightResult{
			Ok:           false,
			Error:        "provider_key_required",
			WorkspaceID:  workspaceID,
			LaunchStatus: LaunchStatusBlocked,
			NextAction:   "bind_provider_key",
			Reason:       "provider_key_required",
		}
	}
	return PreflightResult{
		Ok:                         true,
		WorkspaceID:                workspaceID,
		ProviderBound:              true,
		ProviderKeyRef:             input.Binding.ProviderKeyRef,
		BoundStatus:                input.Binding.BoundStatus,
		LaunchStatus:               "ready_for_launch",
		ReadyForManagedEnvironment: true,
		NextAction:                 "open_managed_environment",
	}
}

func NewLaunch(input LaunchInput) (LaunchProjection, error) {
	if err := requireCore(input.TenantID, input.PortalUserID, input.WorkspaceID); err != nil {
		return LaunchProjection{}, err
	}
	if clean(input.IdempotencyKey) == "" {
		return LaunchProjection{}, ErrIdempotencyKeyRequired
	}
	preflight := Preflight(PreflightInput{WorkspaceID: input.WorkspaceID, Binding: input.Binding})
	if !preflight.Ok {
		return LaunchProjection{}, ErrProviderKeyRequired
	}
	workspaceID := clean(input.WorkspaceID)
	seed := fmt.Sprintf("%s:%s", workspaceID, clean(input.IdempotencyKey))
	timestamp := optionalTime(input.CreatedAt.UTC())
	stages := []LaunchStage{
		stage("workspace_ready", "工作空间已准备", timestamp),
		stage("provider_key_bound", "providerKeyRef 已绑定", timestamp),
		stage("gateway_ready", "OPL 网关已准备", timestamp),
		stage("opl_opening", "OPL 本地入口已准备", timestamp),
	}
	return LaunchProjection{
		Ok:                   true,
		LaunchID:             "launch-" + digest(seed)[:12],
		OpenURL:              "/opl?launchId=launch-" + digest(seed)[:12],
		OPLWebURL:            "/opl?launchId=launch-" + digest(seed)[:12],
		RuntimeURL:           "local-runtime://" + workspaceID,
		LaunchStatus:         LaunchStatusReady,
		Status:               LaunchStatusReady,
		WorkspaceID:          workspaceID,
		WorkspaceSessionID:   "workspace-session-" + digest(workspaceID)[:10],
		RuntimeSessionID:     "runtime-session-" + digest(seed + ":runtime")[:10],
		OPLSessionID:         "opl-session-" + digest(seed + ":opl")[:10],
		ResourceBindingID:    "binding-" + digest(workspaceID)[:10],
		ComputeInstanceID:    "compute-" + digest(workspaceID)[:10],
		StorageBucketID:      "storage-" + digest(workspaceID)[:10],
		RuntimeAgentID:       "runtime-agent-local",
		RuntimeAgentEndpoint: "local-runtime://agent",
		ProviderBound:        true,
		ProviderKeyRef:       input.Binding.ProviderKeyRef,
		GatewayReady:         true,
		GatewayState:         "OPL 网关已准备",
		CurrentStage:         "opl_opening",
		UserVisibleState:     LaunchStatusReady,
		BlockingUser:         false,
		Stages:               stages,
	}, nil
}

func NewManagedResource(input ResourceInput) ManagedResource {
	resourceBindingID := clean(input.ResourceBindingID)
	if resourceBindingID == "" {
		resourceBindingID = "binding-" + digest(input.WorkspaceID)[:10]
	}
	return ManagedResource{
		TenantID:          clean(input.TenantID),
		PortalUserID:      clean(input.PortalUserID),
		WorkspaceID:       clean(input.WorkspaceID),
		ResourceBindingID: resourceBindingID,
		Status:            ResourceStatusActive,
		StopBilling:       BillingState{Status: BillingStatusActive, ConfirmWithinMinutes: 120},
		ReleasePolicy:     BillingState{Status: ResourceStatusActive, ConfirmWithinMinutes: 120, StopBillingConfirmWithinMinutes: 120},
	}
}

func ReleaseManagedResource(resource ManagedResource, input ReleaseInput) (ManagedResource, AuditEvent, error) {
	if clean(input.IdempotencyKey) == "" {
		return ManagedResource{}, AuditEvent{}, ErrIdempotencyKeyRequired
	}
	if clean(resource.WorkspaceID) == "" {
		return ManagedResource{}, AuditEvent{}, ErrWorkspaceRequired
	}
	if clean(resource.ResourceBindingID) == "" {
		return ManagedResource{}, AuditEvent{}, ErrResourceBindingRequired
	}
	releasedAt := input.ReleasedAt.UTC()
	released := resource
	released.Status = ResourceStatusReleased
	released.ReleasePolicy.Status = ResourceStatusReleased
	released.ReleasePolicy.BillingStopConfirmBy = optionalTime(releasedAt.Add(120 * time.Minute))
	if input.StopBilling {
		released.StopBilling.Status = BillingStatusStopped
		released.StopBilling.BillingStoppedAt = optionalTime(releasedAt)
		released.StopBilling.BillingStopConfirmBy = optionalTime(releasedAt.Add(120 * time.Minute))
	}
	audit := AuditEvent{
		ID:                "audit-" + digest(resource.ResourceBindingID + ":" + input.IdempotencyKey)[:12],
		Kind:              AuditKindResourceRelease,
		WorkspaceID:       resource.WorkspaceID,
		ResourceBindingID: resource.ResourceBindingID,
		Status:            "recorded",
		IdempotencyKey:    clean(input.IdempotencyKey),
		CreatedAt:         optionalTime(releasedAt),
	}
	return released, audit, nil
}

func NewBootstrap(launch LaunchProjection) BootstrapProjection {
	return BootstrapProjection{
		RuntimeBridgeContractVersion: "v22-local-rc",
		Capabilities:                 []string{"bootstrap", "session_bind", "message", "file_ref", "run", "artifact_projection"},
		SupportedEvents:              []string{"session.bound", "message.accepted", "file.available", "run.succeeded", "artifact.available"},
		Identity: BootstrapIdentity{
			PortalUserID:       "",
			WorkspaceID:        launch.WorkspaceID,
			WorkspaceSessionID: launch.WorkspaceSessionID,
			RuntimeSessionID:   launch.RuntimeSessionID,
			OPLSessionID:       launch.OPLSessionID,
		},
	}
}

func requireCore(tenantID string, portalUserID string, workspaceID string) error {
	if clean(tenantID) == "" {
		return ErrTenantRequired
	}
	if clean(portalUserID) == "" {
		return ErrPortalUserRequired
	}
	if clean(workspaceID) == "" {
		return ErrWorkspaceRequired
	}
	return nil
}

func stage(name string, visible string, timestamp string) LaunchStage {
	return LaunchStage{Stage: name, Ok: true, BlockingUser: false, UserVisibleState: visible, StartedAt: timestamp, EndedAt: timestamp, LatencyMS: 0}
}

func clean(value string) string {
	return strings.TrimSpace(value)
}

func digest(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func optionalTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format(time.RFC3339)
}
