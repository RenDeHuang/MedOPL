package runtimebroker

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

func bindRequest() SessionBindRequest {
	return SessionBindRequest{
		TenantID:           "tenant-v22",
		PortalUserID:       "user-v22",
		WorkspaceID:        "workspace-v22",
		WorkspaceSessionID: "workspace-session-v22",
		RuntimeSessionID:   "runtime-session-v22",
		OPLSessionID:       "opl-session-v22",
		ResourceBindingID:  "binding-v22",
		ProviderKeyRef:     "provider-key-ref-v22",
		Provider:           "gflabtoken",
		Source:             "portal_control_plane",
	}
}

func runRequest() RunSubmitRequest {
	return RunSubmitRequest{
		RunID:                "run-v22",
		TraceID:              "trace-v22",
		ToolName:             "opl-workbench",
		Kind:                 "opl-workbench-run",
		Message:              "summarize file",
		Model:                "gflabtoken-user-model",
		FileRefs:             []string{"workspace-file-ref-v22"},
		Mode:                 "full_runtime",
		WorkspaceID:          "workspace-v22",
		WorkspaceSessionID:   "workspace-session-v22",
		RuntimeSessionID:     "runtime-session-v22",
		ResourceBindingID:    "binding-v22",
		ComputeInstanceID:    "compute-v22",
		StorageBucketID:      "storage-v22",
		RuntimeAgentID:       "runtime-agent-v22",
		RuntimeAgentEndpoint: "http://runtime-agent.local",
		ProviderKeyRef:       "provider-key-ref-v22",
		IdempotencyKey:       "run-v22-once",
	}
}

func TestLocalAdapterBindsSessionWithoutRawSecret(t *testing.T) {
	ctx := context.Background()
	adapter := NewLocalAdapter()
	binding, err := adapter.BindSession(ctx, bindRequest())
	if err != nil {
		t.Fatalf("BindSession() error = %v", err)
	}
	if !binding.ProviderBound {
		t.Fatal("expected provider bound")
	}
	if binding.ProviderKeyRef != "provider-key-ref-v22" {
		t.Fatalf("provider key ref = %q", binding.ProviderKeyRef)
	}
}

func TestLocalAdapterFailsClosedWithoutProviderKey(t *testing.T) {
	ctx := context.Background()
	adapter := NewLocalAdapter()
	request := bindRequest()
	request.ProviderKeyRef = ""

	if _, err := adapter.BindSession(ctx, request); !errors.Is(err, ErrProviderKeyRequired) {
		t.Fatalf("BindSession() error = %v", err)
	}

	run := runRequest()
	run.ProviderKeyRef = ""
	if _, err := adapter.SubmitRun(ctx, run); !errors.Is(err, ErrProviderKeyRequired) {
		t.Fatalf("SubmitRun() error = %v", err)
	}
}

func TestLocalAdapterSubmitsGatedRunWithoutFakeSuccess(t *testing.T) {
	ctx := context.Background()
	adapter := NewLocalAdapter()
	request := runRequest()
	request.RuntimeAgentID = ""

	response, err := adapter.SubmitRun(ctx, request)
	if !errors.Is(err, ErrRuntimeAgentRequired) {
		t.Fatalf("SubmitRun() error = %v", err)
	}
	if response.Status != RunStatusGated {
		t.Fatalf("status = %q", response.Status)
	}
	if len(response.Artifacts) != 0 {
		t.Fatalf("gated response artifacts = %#v", response.Artifacts)
	}

	request = runRequest()
	request.RuntimeAgentEndpoint = ""
	response, err = adapter.SubmitRun(ctx, request)
	if !errors.Is(err, ErrRuntimeAgentRequired) {
		t.Fatalf("SubmitRun() endpoint error = %v", err)
	}
	if response.Status != RunStatusGated {
		t.Fatalf("endpoint missing status = %q", response.Status)
	}
}

func TestLocalAdapterRejectsNonFullRuntimeMode(t *testing.T) {
	ctx := context.Background()
	adapter := NewLocalAdapter()
	request := runRequest()
	request.Mode = "api_only"

	if _, err := adapter.SubmitRun(ctx, request); !errors.Is(err, ErrInvalidRunMode) {
		t.Fatalf("SubmitRun() error = %v", err)
	}
}

func TestSanitizeArtifactExposesPublicWhitelist(t *testing.T) {
	item, err := SanitizeArtifact(ArtifactRecord{
		ArtifactID:        "artifact-v22",
		ArtifactRef:       "artifact-v22",
		RunID:             "run-v22",
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: "binding-v22",
		ProviderKeyRef:    "provider-key-ref-v22",
		Kind:              "outputs",
		Name:              "result.csv",
		RelativePath:      "outputs/result.csv",
		SizeBytes:         128,
		ContentType:       "text/csv",
	})
	if err != nil {
		t.Fatalf("SanitizeArtifact() error = %v", err)
	}
	keys := publicArtifactKeys(item)
	want := []string{
		"ArtifactID",
		"ArtifactRef",
		"RunID",
		"WorkspaceID",
		"ResourceBindingID",
		"ProviderKeyRef",
		"Kind",
		"Name",
		"RelativePath",
		"SizeBytes",
		"ContentType",
	}
	if !reflect.DeepEqual(keys, want) {
		t.Fatalf("public keys = %#v", keys)
	}
}

func TestLocalAdapterRequiresObservedArtifactForSucceededRun(t *testing.T) {
	ctx := context.Background()
	adapter := NewLocalAdapter()
	now := time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC)
	adapter.now = func() time.Time { return now }

	if _, err := adapter.SubmitRun(ctx, runRequest()); err != nil {
		t.Fatalf("SubmitRun() error = %v", err)
	}
	if _, err := adapter.MarkSucceeded(ctx, "run-v22"); !errors.Is(err, ErrArtifactNotObserved) {
		t.Fatalf("MarkSucceeded() without artifact error = %v", err)
	}

	if err := adapter.RecordArtifact(ArtifactRecord{
		ArtifactID:        "artifact-v22",
		ArtifactRef:       "artifact-v22",
		RunID:             "run-v22",
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: "binding-v22",
		ProviderKeyRef:    "provider-key-ref-v22",
		Kind:              "outputs",
		Name:              "result.csv",
		RelativePath:      "outputs/result.csv",
	}); err != nil {
		t.Fatalf("RecordArtifact() error = %v", err)
	}
	response, err := adapter.MarkSucceeded(ctx, "run-v22")
	if err != nil {
		t.Fatalf("MarkSucceeded() error = %v", err)
	}
	if response.Status != RunStatusSucceeded {
		t.Fatalf("status = %q", response.Status)
	}
	if len(response.Artifacts) != 1 {
		t.Fatalf("artifacts = %#v", response.Artifacts)
	}
}

func publicArtifactKeys(item PublicRunArtifact) []string {
	value := reflect.TypeOf(item)
	keys := make([]string, 0, value.NumField())
	for i := 0; i < value.NumField(); i++ {
		keys = append(keys, value.Field(i).Name)
	}
	return keys
}
