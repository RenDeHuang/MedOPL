package controlplane

import (
	"context"
	"errors"
	"strings"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

type RecordFileInput struct {
	LaunchID     string
	FileName     string
	RelativePath string
	ContentType  string
	SizeBytes    int64
}

type PublicFileRef struct {
	Ok               bool   `json:"ok"`
	FileRef          string `json:"fileRef"`
	WorkspaceID      string `json:"workspaceId"`
	ProviderKeyRef   string `json:"providerKeyRef"`
	StorageBindingID string `json:"storageBindingId"`
	ObjectRef        string `json:"objectRef"`
	File             struct {
		FileRef          string `json:"fileRef"`
		StorageBindingID string `json:"storageBindingId"`
		ObjectRef        string `json:"objectRef"`
		Name             string `json:"name"`
		RelativePath     string `json:"relativePath"`
		SizeBytes        int64  `json:"sizeBytes"`
		ContentType      string `json:"contentType"`
		Status           string `json:"status"`
	} `json:"file"`
}

type RecordFileDiagnostic struct {
	Stage             string
	LaunchID          string
	WorkspaceID       string
	ResourceBindingID string
	StorageBindingID  string
	ProviderKeyRef    string
	RuntimeState      string
	StorageState      string
	FileName          string
	RelativePath      string
	FileRef           string
	ObjectRef         string
}

type RecordFileDiagnosticError struct {
	Diagnostic RecordFileDiagnostic
	Err        error
}

func (err RecordFileDiagnosticError) Error() string {
	if err.Err == nil {
		return "record_file_failed"
	}
	return err.Err.Error()
}

func (err RecordFileDiagnosticError) Unwrap() error {
	return err.Err
}

func RecordFileDiagnosticFromError(err error) (RecordFileDiagnostic, bool) {
	var diagnosticErr RecordFileDiagnosticError
	if errors.As(err, &diagnosticErr) {
		return diagnosticErr.Diagnostic, true
	}
	return RecordFileDiagnostic{}, false
}

func (service *Service) RecordFile(ctx context.Context, input RecordFileInput) (PublicFileRef, error) {
	launch, err := service.LaunchStatus(ctx, LaunchLookupInput{LaunchID: input.LaunchID})
	if err != nil {
		return PublicFileRef{}, recordFileDiagnosticError(input, cpd.LaunchProjection{}, "launch_lookup", err)
	}
	if strings.TrimSpace(input.FileName) == "" {
		return PublicFileRef{}, recordFileDiagnosticError(input, launch, "validate_payload", cpd.ErrFileNameRequired)
	}
	relativePath := strings.TrimSpace(input.RelativePath)
	if relativePath == "" {
		relativePath = "inputs/" + strings.TrimSpace(input.FileName)
	}
	refID := "file-" + shortID(launch.LaunchID+":"+relativePath)
	storageBindingID := storageBindingIDForLaunch(launch)
	objectRef := objectRefForWorkspacePath(launch.WorkspaceID, storageBindingID, relativePath)
	result := PublicFileRef{
		Ok:               true,
		FileRef:          refID,
		WorkspaceID:      launch.WorkspaceID,
		ProviderKeyRef:   launch.ProviderKeyRef,
		StorageBindingID: storageBindingID,
		ObjectRef:        objectRef,
	}
	result.File.FileRef = refID
	result.File.StorageBindingID = storageBindingID
	result.File.ObjectRef = objectRef
	result.File.Name = strings.TrimSpace(input.FileName)
	result.File.RelativePath = relativePath
	result.File.SizeBytes = input.SizeBytes
	result.File.ContentType = strings.TrimSpace(input.ContentType)
	if result.File.ContentType == "" {
		result.File.ContentType = "application/octet-stream"
	}
	result.File.Status = "available"
	recordedAt := service.now().UTC().Format(time.RFC3339)
	if err := service.store.SaveFile(ctx, cpd.FileRecord{
		FileRef:          refID,
		LaunchID:         launch.LaunchID,
		WorkspaceID:      launch.WorkspaceID,
		ProviderKeyRef:   launch.ProviderKeyRef,
		StorageBindingID: storageBindingID,
		ObjectRef:        objectRef,
		Name:             result.File.Name,
		RelativePath:     result.File.RelativePath,
		SizeBytes:        result.File.SizeBytes,
		ContentType:      result.File.ContentType,
		Status:           result.File.Status,
		CreatedAt:        recordedAt,
	}); err != nil {
		return PublicFileRef{}, recordFileDiagnosticError(input, launch, "save_file", err)
	}
	audit := cpd.AuditEvent{
		ID:                "audit-" + shortID(refID+":file-upload"),
		Kind:              cpd.AuditKindFileUpload,
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		Status:            "recorded",
		IdempotencyKey:    refID,
		CreatedAt:         recordedAt,
	}
	if err := service.store.SaveAuditEvent(ctx, audit); err != nil {
		return PublicFileRef{}, recordFileDiagnosticError(input, launch, "save_audit_event", err)
	}
	if err := service.saveBillingEventForAudit(ctx, audit, billingEventRefs{FileRef: refID}); err != nil {
		return PublicFileRef{}, recordFileDiagnosticError(input, launch, "save_billing_event", err)
	}
	return result, nil
}

func recordFileDiagnosticError(input RecordFileInput, launch cpd.LaunchProjection, stage string, err error) error {
	relativePath := strings.TrimSpace(input.RelativePath)
	if relativePath == "" && strings.TrimSpace(input.FileName) != "" {
		relativePath = "inputs/" + strings.TrimSpace(input.FileName)
	}
	storageBindingID := ""
	objectRef := ""
	fileRef := ""
	if strings.TrimSpace(launch.WorkspaceID) != "" || strings.TrimSpace(launch.ResourceBindingID) != "" {
		storageBindingID = storageBindingIDForLaunch(launch)
	}
	if strings.TrimSpace(launch.LaunchID) != "" && relativePath != "" {
		fileRef = "file-" + shortID(launch.LaunchID+":"+relativePath)
	}
	if strings.TrimSpace(launch.WorkspaceID) != "" && storageBindingID != "" && relativePath != "" {
		objectRef = objectRefForWorkspacePath(launch.WorkspaceID, storageBindingID, relativePath)
	}
	return RecordFileDiagnosticError{
		Diagnostic: RecordFileDiagnostic{
			Stage:             stage,
			LaunchID:          input.LaunchID,
			WorkspaceID:       launch.WorkspaceID,
			ResourceBindingID: launch.ResourceBindingID,
			StorageBindingID:  storageBindingID,
			ProviderKeyRef:    launch.ProviderKeyRef,
			RuntimeState:      firstNonEmpty(launch.Status, launch.LaunchStatus),
			StorageState:      recordFileStorageState(storageBindingID),
			FileName:          input.FileName,
			RelativePath:      relativePath,
			FileRef:           fileRef,
			ObjectRef:         objectRef,
		},
		Err: err,
	}
}

func recordFileStorageState(storageBindingID string) string {
	if strings.TrimSpace(storageBindingID) == "" {
		return "unknown"
	}
	return "ready"
}

func storageBindingIDForLaunch(launch cpd.LaunchProjection) string {
	return "storage-" + shortID(launch.WorkspaceID+":"+launch.ResourceBindingID)
}

func objectRefForWorkspacePath(workspaceID string, storageBindingID string, relativePath string) string {
	return "object://" + strings.TrimSpace(storageBindingID) + "/" + strings.TrimSpace(workspaceID) + "/" + strings.TrimLeft(strings.TrimSpace(relativePath), "/")
}
