package file

import (
	"errors"
	"testing"
	"time"
)

func TestValidateFileRefAcceptsPublicReferenceShape(t *testing.T) {
	ref := FileRef{
		FileRef:            "workspace-file-ref-v22",
		WorkspaceID:        "workspace-v22",
		WorkspaceSessionID: "workspace-session-v22",
		Kind:               FileKindInputs,
		Name:               "measurements.csv",
		RelativePath:       "inputs/measurements.csv",
		SizeBytes:          128,
		ContentType:        "text/csv",
		Status:             FileStatusAvailable,
		CreatedAt:          time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC),
		UpdatedAt:          time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC),
	}

	if err := ValidateFileRef(ref); err != nil {
		t.Fatalf("ValidateFileRef() error = %v", err)
	}
}

func TestValidateFileRefFailsClosedOnMissingIdentity(t *testing.T) {
	ref := FileRef{
		WorkspaceID:  "workspace-v22",
		Kind:         FileKindInputs,
		Name:         "measurements.csv",
		RelativePath: "inputs/measurements.csv",
		Status:       FileStatusAvailable,
	}

	if err := ValidateFileRef(ref); !errors.Is(err, ErrFileRefRequired) {
		t.Fatalf("ValidateFileRef() error = %v", err)
	}
}

func TestValidateFileRefRejectsUnknownKindAndStatus(t *testing.T) {
	ref := FileRef{
		FileRef:      "workspace-file-ref-v22",
		WorkspaceID:  "workspace-v22",
		Kind:         Kind("unknown"),
		Name:         "measurements.csv",
		RelativePath: "inputs/measurements.csv",
		Status:       FileStatusAvailable,
	}
	if err := ValidateFileRef(ref); !errors.Is(err, ErrInvalidFileKind) {
		t.Fatalf("ValidateFileRef() kind error = %v", err)
	}

	ref.Kind = FileKindInputs
	ref.Status = Status("unknown")
	if err := ValidateFileRef(ref); !errors.Is(err, ErrInvalidFileStatus) {
		t.Fatalf("ValidateFileRef() status error = %v", err)
	}
}
