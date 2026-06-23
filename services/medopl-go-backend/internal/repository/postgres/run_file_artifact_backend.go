package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

func (backend *SQLBackend) UpsertFileRecord(ctx context.Context, file cpd.FileRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := backend.requireExistingWorkspace(ctx, file.WorkspaceID); err != nil {
		return err
	}
	payload, err := json.Marshal(file)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	createdAt := parseOptionalTime(file.CreatedAt, now)
	_, err = backend.db.ExecContext(ctx, `
INSERT INTO files (id, workspace_id, name, kind, status, external_ref, payload, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7::jsonb, $8, $9)
ON CONFLICT (id)
DO UPDATE SET
  workspace_id = EXCLUDED.workspace_id,
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  status = EXCLUDED.status,
  external_ref = EXCLUDED.external_ref,
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at
`, file.FileRef, file.WorkspaceID, firstNonEmpty(file.Name, file.FileRef), firstNonEmpty("input"), firstNonEmpty(file.Status, "available"), file.ObjectRef, string(payload), createdAt, now)
	return err
}

func (backend *SQLBackend) FileRecord(ctx context.Context, fileRef string) (cpd.FileRecord, error) {
	if err := ctx.Err(); err != nil {
		return cpd.FileRecord{}, err
	}
	row := backend.db.QueryRowContext(ctx, `
SELECT payload
FROM files
WHERE id = $1
`, strings.TrimSpace(fileRef))
	return scanFileRecord(row)
}

func (backend *SQLBackend) ListFileRecords(ctx context.Context, workspaceID string) ([]cpd.FileRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	query := `
SELECT payload
FROM files
`
	args := []any{}
	if strings.TrimSpace(workspaceID) != "" {
		query += "WHERE workspace_id = $1\n"
		args = append(args, strings.TrimSpace(workspaceID))
	}
	query += "ORDER BY id"
	rows, err := backend.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []cpd.FileRecord{}
	for rows.Next() {
		item, err := scanFileRecord(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (backend *SQLBackend) UpsertRunRecord(ctx context.Context, run cpd.RunRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := backend.requireExistingWorkspace(ctx, run.WorkspaceID); err != nil {
		return err
	}
	run.FileRefs = append([]string(nil), run.FileRefs...)
	run.InputObjectRefs = append([]string(nil), run.InputObjectRefs...)
	payload, err := json.Marshal(run)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	createdAt := parseOptionalTime(run.CreatedAt, now)
	_, err = backend.db.ExecContext(ctx, `
INSERT INTO runs (id, workspace_id, status, external_ref, idempotency_key, payload, created_at, updated_at)
VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6::jsonb, $7, $8)
ON CONFLICT (id)
DO UPDATE SET
  workspace_id = EXCLUDED.workspace_id,
  status = EXCLUDED.status,
  external_ref = EXCLUDED.external_ref,
  idempotency_key = EXCLUDED.idempotency_key,
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at
`, run.RunID, run.WorkspaceID, firstNonEmpty(run.Status, "pending"), run.RunRef, firstNonEmpty(run.RunID), string(payload), createdAt, now)
	return err
}

func (backend *SQLBackend) RunRecord(ctx context.Context, runID string) (cpd.RunRecord, error) {
	if err := ctx.Err(); err != nil {
		return cpd.RunRecord{}, err
	}
	row := backend.db.QueryRowContext(ctx, `
SELECT payload
FROM runs
WHERE id = $1
`, strings.TrimSpace(runID))
	return scanRunRecord(row)
}

func (backend *SQLBackend) ListRunRecords(ctx context.Context, workspaceID string) ([]cpd.RunRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	query := `
SELECT payload
FROM runs
`
	args := []any{}
	if strings.TrimSpace(workspaceID) != "" {
		query += "WHERE workspace_id = $1\n"
		args = append(args, strings.TrimSpace(workspaceID))
	}
	query += "ORDER BY id"
	rows, err := backend.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []cpd.RunRecord{}
	for rows.Next() {
		item, err := scanRunRecord(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (backend *SQLBackend) UpsertArtifactRecord(ctx context.Context, artifact cpd.ArtifactRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := backend.requireExistingWorkspace(ctx, artifact.WorkspaceID); err != nil {
		return err
	}
	artifact.SourceFileRefs = append([]string(nil), artifact.SourceFileRefs...)
	payload, err := json.Marshal(artifact)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	createdAt := parseOptionalTime(artifact.CreatedAt, now)
	_, err = backend.db.ExecContext(ctx, `
INSERT INTO artifacts (id, run_id, workspace_id, kind, status, external_ref, payload, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7::jsonb, $8, $9)
ON CONFLICT (id)
DO UPDATE SET
  run_id = EXCLUDED.run_id,
  workspace_id = EXCLUDED.workspace_id,
  kind = EXCLUDED.kind,
  status = EXCLUDED.status,
  external_ref = EXCLUDED.external_ref,
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at
`, artifact.ArtifactRef, artifact.RunID, artifact.WorkspaceID, firstNonEmpty(artifact.Kind, "output"), "available", artifact.ObjectRef, string(payload), createdAt, now)
	return err
}

func (backend *SQLBackend) ArtifactRecord(ctx context.Context, artifactRef string) (cpd.ArtifactRecord, error) {
	if err := ctx.Err(); err != nil {
		return cpd.ArtifactRecord{}, err
	}
	row := backend.db.QueryRowContext(ctx, `
SELECT payload
FROM artifacts
WHERE id = $1
`, strings.TrimSpace(artifactRef))
	return scanArtifactRecord(row)
}

func (backend *SQLBackend) ListArtifactRecords(ctx context.Context, workspaceID string) ([]cpd.ArtifactRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	query := `
SELECT payload
FROM artifacts
`
	args := []any{}
	if strings.TrimSpace(workspaceID) != "" {
		query += "WHERE workspace_id = $1\n"
		args = append(args, strings.TrimSpace(workspaceID))
	}
	query += "ORDER BY id"
	rows, err := backend.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []cpd.ArtifactRecord{}
	for rows.Next() {
		item, err := scanArtifactRecord(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func scanFileRecord(row rowScanner) (cpd.FileRecord, error) {
	var payload []byte
	if err := row.Scan(&payload); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return cpd.FileRecord{}, cprepo.ErrNotFound
		}
		return cpd.FileRecord{}, err
	}
	var file cpd.FileRecord
	if err := json.Unmarshal(payload, &file); err != nil {
		return cpd.FileRecord{}, err
	}
	return file, nil
}

func scanRunRecord(row rowScanner) (cpd.RunRecord, error) {
	var payload []byte
	if err := row.Scan(&payload); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return cpd.RunRecord{}, cprepo.ErrNotFound
		}
		return cpd.RunRecord{}, err
	}
	var run cpd.RunRecord
	if err := json.Unmarshal(payload, &run); err != nil {
		return cpd.RunRecord{}, err
	}
	run.FileRefs = append([]string(nil), run.FileRefs...)
	run.InputObjectRefs = append([]string(nil), run.InputObjectRefs...)
	return run, nil
}

func scanArtifactRecord(row rowScanner) (cpd.ArtifactRecord, error) {
	var payload []byte
	if err := row.Scan(&payload); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return cpd.ArtifactRecord{}, cprepo.ErrNotFound
		}
		return cpd.ArtifactRecord{}, err
	}
	var artifact cpd.ArtifactRecord
	if err := json.Unmarshal(payload, &artifact); err != nil {
		return cpd.ArtifactRecord{}, err
	}
	artifact.SourceFileRefs = append([]string(nil), artifact.SourceFileRefs...)
	return artifact, nil
}

func (backend *SQLBackend) requireExistingWorkspace(ctx context.Context, workspaceID string) error {
	workspaceID = strings.TrimSpace(workspaceID)
	if workspaceID == "" {
		return cpd.ErrWorkspaceRequired
	}
	var id string
	err := backend.db.QueryRowContext(ctx, `
SELECT id
FROM workspaces
WHERE id = $1
`, workspaceID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return cprepo.ErrNotFound
	}
	return err
}
