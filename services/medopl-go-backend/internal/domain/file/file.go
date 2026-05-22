package file

import (
	"errors"
	"time"
)

type Kind string

const (
	FileKindInputs       Kind = "inputs"
	FileKindOutputs      Kind = "outputs"
	FileKindMessageReply Kind = "message_reply"
)

type Status string

const (
	FileStatusAvailable Status = "available"
	FileStatusDeleted   Status = "deleted"
)

var (
	ErrFileRefRequired      = errors.New("file_ref_required")
	ErrWorkspaceRequired    = errors.New("workspace_required")
	ErrFileNameRequired     = errors.New("file_name_required")
	ErrRelativePathRequired = errors.New("file_relative_path_required")
	ErrInvalidFileKind      = errors.New("invalid_file_kind")
	ErrInvalidFileStatus    = errors.New("invalid_file_status")
)

type FileRef struct {
	FileRef            string
	ArtifactRef        string
	WorkspaceID        string
	WorkspaceSessionID string
	RunID              string
	Kind               Kind
	Name               string
	RelativePath       string
	SizeBytes          int64
	ContentType        string
	Status             Status
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

func ValidateFileRef(ref FileRef) error {
	if ref.FileRef == "" {
		return ErrFileRefRequired
	}
	if ref.WorkspaceID == "" {
		return ErrWorkspaceRequired
	}
	if ref.Name == "" {
		return ErrFileNameRequired
	}
	if ref.RelativePath == "" {
		return ErrRelativePathRequired
	}
	if !validKind(ref.Kind) {
		return ErrInvalidFileKind
	}
	if !validStatus(ref.Status) {
		return ErrInvalidFileStatus
	}
	return nil
}

func validKind(kind Kind) bool {
	switch kind {
	case FileKindInputs, FileKindOutputs, FileKindMessageReply:
		return true
	default:
		return false
	}
}

func validStatus(status Status) bool {
	switch status {
	case FileStatusAvailable, FileStatusDeleted:
		return true
	default:
		return false
	}
}
