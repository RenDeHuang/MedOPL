package artifact

import (
	"errors"
	"testing"
	"time"
)

func TestValidateRunArtifactAcceptsPublicOutputShape(t *testing.T) {
	item := RunArtifact{
		ArtifactID:         "artifact-v22",
		ArtifactRef:        "artifact-v22",
		RunID:              "run-v22",
		TenantID:           "tenant-v22",
		PortalUserID:       "user-v22",
		WorkspaceID:        "workspace-v22",
		WorkspaceSessionID: "workspace-session-v22",
		RuntimeSessionID:   "runtime-session-v22",
		ResourceBindingID:  "binding-v22",
		ProviderKeyRef:     "provider-key-ref-v22",
		Kind:               ArtifactKindOutputs,
		Name:               "result.csv",
		RelativePath:       "outputs/result.csv",
		SizeBytes:          128,
		ContentType:        "text/csv",
		Status:             ArtifactStatusAvailable,
		CreatedAt:          time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC),
	}

	if err := ValidateRunArtifact(item); err != nil {
		t.Fatalf("ValidateRunArtifact() error = %v", err)
	}
}

func TestValidateRunArtifactRequiresObservedRunAndProvider(t *testing.T) {
	item := RunArtifact{
		ArtifactID:        "artifact-v22",
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: "binding-v22",
		ProviderKeyRef:    "provider-key-ref-v22",
		Kind:              ArtifactKindOutputs,
		Name:              "result.csv",
		RelativePath:      "outputs/result.csv",
		Status:            ArtifactStatusAvailable,
	}
	if err := ValidateRunArtifact(item); !errors.Is(err, ErrRunIDRequired) {
		t.Fatalf("ValidateRunArtifact() run error = %v", err)
	}

	item.RunID = "run-v22"
	item.ProviderKeyRef = ""
	if err := ValidateRunArtifact(item); !errors.Is(err, ErrProviderKeyRequired) {
		t.Fatalf("ValidateRunArtifact() provider error = %v", err)
	}
}
