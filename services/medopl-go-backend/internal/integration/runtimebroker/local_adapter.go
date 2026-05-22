package runtimebroker

import (
	"context"
	"sort"
	"sync"
	"time"
)

type LocalAdapter struct {
	mu        sync.Mutex
	bindings  map[string]SessionBinding
	runs      map[string]RunResponse
	artifacts map[string]PublicRunArtifact
	now       func() time.Time
}

func NewLocalAdapter() *LocalAdapter {
	return &LocalAdapter{
		bindings:  make(map[string]SessionBinding),
		runs:      make(map[string]RunResponse),
		artifacts: make(map[string]PublicRunArtifact),
		now:       time.Now,
	}
}

func (adapter *LocalAdapter) BindSession(ctx context.Context, request SessionBindRequest) (SessionBinding, error) {
	if err := ctx.Err(); err != nil {
		return SessionBinding{}, err
	}
	if request.ProviderKeyRef == "" {
		return SessionBinding{}, ErrProviderKeyRequired
	}
	if request.ResourceBindingID == "" {
		return SessionBinding{}, ErrResourceBindingRequired
	}
	binding := SessionBinding{
		RuntimeSessionID:     request.RuntimeSessionID,
		OPLSessionID:         request.OPLSessionID,
		PortalUserID:         request.PortalUserID,
		TenantID:             request.TenantID,
		WorkspaceID:          request.WorkspaceID,
		WorkspaceSessionID:   request.WorkspaceSessionID,
		ResourceBindingID:    request.ResourceBindingID,
		ProviderKeyRef:       request.ProviderKeyRef,
		ProviderConfigured:   true,
		ProviderConfigStatus: "configured",
		ProviderBound:        true,
		Status:               "ready",
	}
	adapter.mu.Lock()
	defer adapter.mu.Unlock()
	adapter.bindings[binding.RuntimeSessionID] = binding
	return binding, nil
}

func (adapter *LocalAdapter) SubmitRun(ctx context.Context, request RunSubmitRequest) (RunResponse, error) {
	if err := ctx.Err(); err != nil {
		return RunResponse{}, err
	}
	if request.ProviderKeyRef == "" {
		return RunResponse{}, ErrProviderKeyRequired
	}
	if request.ResourceBindingID == "" || request.ComputeInstanceID == "" || request.StorageBucketID == "" {
		return RunResponse{}, ErrResourceBindingRequired
	}
	if request.Mode != "full_runtime" {
		return RunResponse{}, ErrInvalidRunMode
	}
	status := RunStatusRunning
	if request.RuntimeAgentID == "" || request.RuntimeAgentEndpoint == "" {
		status = RunStatusGated
	}
	response := RunResponse{
		RunID:              request.RunID,
		TraceID:            request.TraceID,
		Status:             status,
		WorkspaceID:        request.WorkspaceID,
		WorkspaceSessionID: request.WorkspaceSessionID,
		RuntimeSessionID:   request.RuntimeSessionID,
		ResourceBindingID:  request.ResourceBindingID,
		ProviderKeyRef:     request.ProviderKeyRef,
		Mode:               request.Mode,
		ToolName:           request.ToolName,
		CreatedAt:          adapter.now(),
		RuntimeClaims: RuntimeClaims{
			RuntimeSessionID: request.RuntimeSessionID,
			WorkspaceID:      request.WorkspaceID,
			ProviderKeyRef:   request.ProviderKeyRef,
		},
	}
	adapter.mu.Lock()
	defer adapter.mu.Unlock()
	adapter.runs[response.RunID] = response
	if status == RunStatusGated {
		return response, ErrRuntimeAgentRequired
	}
	return response, nil
}

func (adapter *LocalAdapter) RunStatus(ctx context.Context, runID string) (RunResponse, error) {
	if err := ctx.Err(); err != nil {
		return RunResponse{}, err
	}
	adapter.mu.Lock()
	defer adapter.mu.Unlock()
	response, ok := adapter.runs[runID]
	if !ok {
		return RunResponse{}, ErrRunNotFound
	}
	return response, nil
}

func (adapter *LocalAdapter) ListArtifacts(ctx context.Context, runID string) ([]PublicRunArtifact, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	adapter.mu.Lock()
	defer adapter.mu.Unlock()
	items := make([]PublicRunArtifact, 0)
	for _, item := range adapter.artifacts {
		if item.RunID == runID {
			items = append(items, item)
		}
	}
	if len(items) == 0 {
		return nil, ErrArtifactNotObserved
	}
	sortArtifacts(items)
	return items, nil
}

func (adapter *LocalAdapter) Artifact(ctx context.Context, artifactRef string) (PublicRunArtifact, error) {
	if err := ctx.Err(); err != nil {
		return PublicRunArtifact{}, err
	}
	adapter.mu.Lock()
	defer adapter.mu.Unlock()
	item, ok := adapter.artifacts[artifactRef]
	if !ok {
		return PublicRunArtifact{}, ErrArtifactNotFound
	}
	return item, nil
}

func (adapter *LocalAdapter) RecordArtifact(record ArtifactRecord) error {
	item, err := SanitizeArtifact(record)
	if err != nil {
		return err
	}
	adapter.mu.Lock()
	defer adapter.mu.Unlock()
	adapter.artifacts[item.ArtifactRef] = item
	return nil
}

func (adapter *LocalAdapter) MarkSucceeded(ctx context.Context, runID string) (RunResponse, error) {
	if err := ctx.Err(); err != nil {
		return RunResponse{}, err
	}
	adapter.mu.Lock()
	defer adapter.mu.Unlock()
	response, ok := adapter.runs[runID]
	if !ok {
		return RunResponse{}, ErrRunNotFound
	}
	items := make([]PublicRunArtifact, 0)
	for _, item := range adapter.artifacts {
		if item.RunID == runID {
			items = append(items, item)
		}
	}
	if len(items) == 0 {
		return RunResponse{}, ErrArtifactNotObserved
	}
	sortArtifacts(items)
	response.Status = RunStatusSucceeded
	response.FinishedAt = adapter.now()
	response.Artifacts = items
	adapter.runs[runID] = response
	return response, nil
}

func sortArtifacts(items []PublicRunArtifact) {
	sort.Slice(items, func(i, j int) bool {
		return items[i].ArtifactRef < items[j].ArtifactRef
	})
}
