package artifact

import (
	"errors"
	"time"
)

type Kind string

const (
	ArtifactKindOutputs Kind = "outputs"
)

type Status string

const (
	ArtifactStatusAvailable Status = "available"
)

var (
	ErrArtifactIDRequired      = errors.New("artifact_id_required")
	ErrRunIDRequired           = errors.New("run_id_required")
	ErrWorkspaceRequired       = errors.New("workspace_required")
	ErrResourceBindingRequired = errors.New("resource_binding_required")
	ErrProviderKeyRequired     = errors.New("provider_key_required")
	ErrArtifactNameRequired    = errors.New("artifact_name_required")
	ErrRelativePathRequired    = errors.New("artifact_relative_path_required")
	ErrInvalidArtifactKind     = errors.New("invalid_artifact_kind")
	ErrInvalidArtifactStatus   = errors.New("invalid_artifact_status")
)

type RunArtifact struct {
	ArtifactID         string
	ArtifactRef        string
	RunID              string
	TenantID           string
	PortalUserID       string
	OwnerID            string
	ArtifactOwnerID    string
	WorkspaceID        string
	WorkspaceSessionID string
	RuntimeSessionID   string
	ResourceBindingID  string
	ProviderKeyRef     string
	Kind               Kind
	Name               string
	RelativePath       string
	SizeBytes          int64
	ContentType        string
	Status             Status
	CreatedAt          time.Time
}

func ValidateRunArtifact(artifact RunArtifact) error {
	if artifact.ArtifactID == "" {
		return ErrArtifactIDRequired
	}
	if artifact.RunID == "" {
		return ErrRunIDRequired
	}
	if artifact.WorkspaceID == "" {
		return ErrWorkspaceRequired
	}
	if artifact.ResourceBindingID == "" {
		return ErrResourceBindingRequired
	}
	if artifact.ProviderKeyRef == "" {
		return ErrProviderKeyRequired
	}
	if artifact.Name == "" {
		return ErrArtifactNameRequired
	}
	if artifact.RelativePath == "" {
		return ErrRelativePathRequired
	}
	if artifact.Kind != ArtifactKindOutputs {
		return ErrInvalidArtifactKind
	}
	if artifact.Status != ArtifactStatusAvailable {
		return ErrInvalidArtifactStatus
	}
	return nil
}
