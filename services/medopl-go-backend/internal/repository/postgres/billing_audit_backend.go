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

func (backend *SQLBackend) UpsertAuditEvent(ctx context.Context, event cpd.AuditEvent) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	createdAt := parseOptionalTime(event.CreatedAt, now)
	_, err = backend.db.ExecContext(ctx, `
INSERT INTO control_plane_audit_events (
  event_id, workspace_id, resource_binding_id, kind, status, idempotency_key, payload, created_at, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
ON CONFLICT (event_id)
DO UPDATE SET
  workspace_id = EXCLUDED.workspace_id,
  resource_binding_id = EXCLUDED.resource_binding_id,
  kind = EXCLUDED.kind,
  status = EXCLUDED.status,
  idempotency_key = EXCLUDED.idempotency_key,
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at
`, event.ID, event.WorkspaceID, event.ResourceBindingID, event.Kind, event.Status, event.IdempotencyKey, string(payload), createdAt, now)
	return err
}

func (backend *SQLBackend) ListAuditEventRecords(ctx context.Context, workspaceID string) ([]cpd.AuditEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	query := `
SELECT payload
FROM control_plane_audit_events
`
	args := []any{}
	if strings.TrimSpace(workspaceID) != "" {
		query += "WHERE workspace_id = $1\n"
		args = append(args, strings.TrimSpace(workspaceID))
	}
	query += "ORDER BY event_id"
	rows, err := backend.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []cpd.AuditEvent{}
	for rows.Next() {
		item, err := scanAuditEvent(rows)
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

func (backend *SQLBackend) UpsertBillingEvent(ctx context.Context, event cpd.BillingEvent) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(event.WorkspaceID) != "" {
		if err := backend.requireExistingWorkspace(ctx, event.WorkspaceID); err != nil {
			return err
		}
	}
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	createdAt := parseOptionalTime(event.CreatedAt, now)
	_, err = backend.db.ExecContext(ctx, `
INSERT INTO billing_events (
  id, tenant_id, workspace_id, event_type, status, idempotency_key, amount, currency, payload, created_at, updated_at
)
VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
ON CONFLICT (id)
DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  workspace_id = EXCLUDED.workspace_id,
  event_type = EXCLUDED.event_type,
  status = EXCLUDED.status,
  idempotency_key = EXCLUDED.idempotency_key,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at
`, event.ID, event.TenantID, event.WorkspaceID, firstNonEmpty(event.Type, "debit"), firstNonEmpty(event.Status, "recorded"), event.IdempotencyKey, event.Amount, firstNonEmpty(event.Currency, "CNY"), string(payload), createdAt, now)
	return err
}

func (backend *SQLBackend) ListBillingEventRecords(ctx context.Context, workspaceID string) ([]cpd.BillingEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	query := `
SELECT payload
FROM billing_events
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
	items := []cpd.BillingEvent{}
	for rows.Next() {
		item, err := scanBillingEvent(rows)
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

func scanAuditEvent(row rowScanner) (cpd.AuditEvent, error) {
	var payload []byte
	if err := row.Scan(&payload); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return cpd.AuditEvent{}, cprepo.ErrNotFound
		}
		return cpd.AuditEvent{}, err
	}
	var event cpd.AuditEvent
	if err := json.Unmarshal(payload, &event); err != nil {
		return cpd.AuditEvent{}, err
	}
	return event, nil
}

func scanBillingEvent(row rowScanner) (cpd.BillingEvent, error) {
	var payload []byte
	if err := row.Scan(&payload); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return cpd.BillingEvent{}, cprepo.ErrNotFound
		}
		return cpd.BillingEvent{}, err
	}
	var event cpd.BillingEvent
	if err := json.Unmarshal(payload, &event); err != nil {
		return cpd.BillingEvent{}, err
	}
	return event, nil
}
