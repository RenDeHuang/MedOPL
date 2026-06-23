package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

const defaultMigrationPath = "migrations/0001_baseline.sql"

type Record struct {
	Kind        string
	RecordID    string
	WorkspaceID string
	Payload     []byte
}

type SQLBackend struct {
	db *sql.DB
}

func OpenSQLBackend(ctx context.Context, databaseURL string, migrationPath string) (*SQLBackend, error) {
	db, err := sql.Open("postgres", strings.TrimSpace(databaseURL))
	if err != nil {
		return nil, err
	}
	backend := &SQLBackend{db: db}
	if err := backend.db.PingContext(ctx); err != nil {
		_ = backend.Close()
		return nil, err
	}
	if err := backend.ApplyMigration(ctx, firstNonEmpty(migrationPath, defaultMigrationPath)); err != nil {
		_ = backend.Close()
		return nil, err
	}
	return backend, nil
}

func (backend *SQLBackend) Close() error {
	if backend == nil || backend.db == nil {
		return nil
	}
	return backend.db.Close()
}

func (backend *SQLBackend) ApplyMigration(ctx context.Context, migrationPath string) error {
	source, err := os.ReadFile(migrationPath)
	if err != nil {
		return err
	}
	_, err = backend.db.ExecContext(ctx, string(source))
	return err
}

func (backend *SQLBackend) UpsertRecord(ctx context.Context, record Record) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	now := time.Now().UTC()
	_, err := backend.db.ExecContext(ctx, `
INSERT INTO control_plane_records (kind, record_id, workspace_id, payload, created_at, updated_at)
VALUES ($1, $2, $3, $4::jsonb, $5, $5)
ON CONFLICT (kind, record_id)
DO UPDATE SET workspace_id = EXCLUDED.workspace_id, payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
`, record.Kind, record.RecordID, record.WorkspaceID, string(record.Payload), now)
	return err
}

func (backend *SQLBackend) Record(ctx context.Context, kind string, recordID string) (Record, error) {
	if err := ctx.Err(); err != nil {
		return Record{}, err
	}
	row := backend.db.QueryRowContext(ctx, `
SELECT kind, record_id, workspace_id, payload
FROM control_plane_records
WHERE kind = $1 AND record_id = $2
`, kind, recordID)
	var record Record
	if err := row.Scan(&record.Kind, &record.RecordID, &record.WorkspaceID, &record.Payload); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Record{}, cprepo.ErrNotFound
		}
		return Record{}, err
	}
	return record, nil
}

func (backend *SQLBackend) ListRecords(ctx context.Context, kind string, workspaceID string) ([]Record, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	query := `
SELECT kind, record_id, workspace_id, payload
FROM control_plane_records
WHERE kind = $1
`
	args := []any{kind}
	if strings.TrimSpace(workspaceID) != "" {
		query += " AND workspace_id = $2"
		args = append(args, strings.TrimSpace(workspaceID))
	}
	query += " ORDER BY record_id"
	rows, err := backend.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []Record{}
	for rows.Next() {
		var record Record
		if err := rows.Scan(&record.Kind, &record.RecordID, &record.WorkspaceID, &record.Payload); err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return records, nil
}

func (backend *SQLBackend) UpsertBusinessAccount(ctx context.Context, account cpd.BusinessAccount) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(account.Currency) == "" {
		account.Currency = "CNY"
	}
	payload, err := json.Marshal(account)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	createdAt := parseOptionalTime(account.CreatedAt, now)
	_, err = backend.db.ExecContext(ctx, `
INSERT INTO business_accounts (workspace_id, tenant_id, portal_user_id, status, balance, currency, payload, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
ON CONFLICT (workspace_id)
DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  portal_user_id = EXCLUDED.portal_user_id,
  status = EXCLUDED.status,
  balance = CASE WHEN EXCLUDED.balance = 0 THEN business_accounts.balance ELSE EXCLUDED.balance END,
  currency = COALESCE(NULLIF(EXCLUDED.currency, ''), business_accounts.currency),
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at
`, account.WorkspaceID, account.TenantID, account.PortalUserID, account.Status, account.Balance, account.Currency, string(payload), createdAt, now)
	return err
}

func (backend *SQLBackend) BusinessAccountByWorkspace(ctx context.Context, workspaceID string) (cpd.BusinessAccount, error) {
	if err := ctx.Err(); err != nil {
		return cpd.BusinessAccount{}, err
	}
	row := backend.db.QueryRowContext(ctx, `
SELECT payload, balance, currency
FROM business_accounts
WHERE workspace_id = $1
`, workspaceID)
	var payload []byte
	var balance float64
	var currency string
	if err := row.Scan(&payload, &balance, &currency); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return cpd.BusinessAccount{}, cprepo.ErrNotFound
		}
		return cpd.BusinessAccount{}, err
	}
	var account cpd.BusinessAccount
	if err := json.Unmarshal(payload, &account); err != nil {
		return cpd.BusinessAccount{}, err
	}
	account.Balance = balance
	account.Currency = currency
	return account, nil
}

func (backend *SQLBackend) BusinessAccountByUser(ctx context.Context, portalUserID string) (cpd.BusinessAccount, error) {
	if err := ctx.Err(); err != nil {
		return cpd.BusinessAccount{}, err
	}
	row := backend.db.QueryRowContext(ctx, `
SELECT payload, balance, currency
FROM business_accounts
WHERE portal_user_id = $1
ORDER BY workspace_id
LIMIT 1
`, portalUserID)
	var payload []byte
	var balance float64
	var currency string
	if err := row.Scan(&payload, &balance, &currency); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return cpd.BusinessAccount{}, cprepo.ErrNotFound
		}
		return cpd.BusinessAccount{}, err
	}
	var account cpd.BusinessAccount
	if err := json.Unmarshal(payload, &account); err != nil {
		return cpd.BusinessAccount{}, err
	}
	account.Balance = balance
	account.Currency = currency
	return account, nil
}

func (backend *SQLBackend) SaveCreditEvent(ctx context.Context, event cpd.CreditEvent) error {
	_, err := backend.ApplyCreditEvent(ctx, event)
	if errors.Is(err, cprepo.ErrNotFound) {
		payload, marshalErr := json.Marshal(event)
		if marshalErr != nil {
			return marshalErr
		}
		now := time.Now().UTC()
		createdAt := parseOptionalTime(event.CreatedAt, now)
		_, insertErr := backend.db.ExecContext(ctx, `
INSERT INTO credit_events (event_id, tenant_id, portal_user_id, workspace_id, amount, currency, idempotency_key, payload, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
ON CONFLICT (event_id) DO NOTHING
`, event.ID, event.TenantID, event.PortalUserID, event.WorkspaceID, event.Amount, firstNonEmpty(event.Currency, "CNY"), event.IdempotencyKey, string(payload), createdAt, now)
		return insertErr
	}
	return err
}

func (backend *SQLBackend) ApplyCreditEvent(ctx context.Context, event cpd.CreditEvent) (cpd.BusinessAccount, error) {
	if err := ctx.Err(); err != nil {
		return cpd.BusinessAccount{}, err
	}
	tx, err := backend.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return cpd.BusinessAccount{}, err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()
	if _, err := accountForUpdate(ctx, tx, event.WorkspaceID); err != nil {
		return cpd.BusinessAccount{}, err
	}
	payload, err := json.Marshal(event)
	if err != nil {
		return cpd.BusinessAccount{}, err
	}
	now := time.Now().UTC()
	createdAt := parseOptionalTime(event.CreatedAt, now)
	result, err := tx.ExecContext(ctx, `
INSERT INTO credit_events (event_id, tenant_id, portal_user_id, workspace_id, amount, currency, idempotency_key, payload, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
ON CONFLICT (event_id) DO NOTHING
`, event.ID, event.TenantID, event.PortalUserID, event.WorkspaceID, event.Amount, firstNonEmpty(event.Currency, "CNY"), event.IdempotencyKey, string(payload), createdAt, now)
	if err != nil {
		return cpd.BusinessAccount{}, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return cpd.BusinessAccount{}, err
	}
	if rows == 1 {
		if _, err := tx.ExecContext(ctx, `
UPDATE business_accounts
SET balance = balance + $1, currency = $2, updated_at = $3
WHERE workspace_id = $4
`, event.Amount, firstNonEmpty(event.Currency, "CNY"), now, event.WorkspaceID); err != nil {
			return cpd.BusinessAccount{}, err
		}
	}
	account, err := accountForUpdate(ctx, tx, event.WorkspaceID)
	if err != nil {
		return cpd.BusinessAccount{}, err
	}
	if err := tx.Commit(); err != nil {
		return cpd.BusinessAccount{}, err
	}
	committed = true
	return account, nil
}

func (backend *SQLBackend) ListCreditEvents(ctx context.Context, workspaceID string) ([]cpd.CreditEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	query := `
SELECT payload
FROM credit_events
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
	items := []cpd.CreditEvent{}
	for rows.Next() {
		var payload []byte
		if err := rows.Scan(&payload); err != nil {
			return nil, err
		}
		var item cpd.CreditEvent
		if err := json.Unmarshal(payload, &item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func accountForUpdate(ctx context.Context, tx *sql.Tx, workspaceID string) (cpd.BusinessAccount, error) {
	row := tx.QueryRowContext(ctx, `
SELECT payload, balance, currency
FROM business_accounts
WHERE workspace_id = $1
FOR UPDATE
`, workspaceID)
	var payload []byte
	var balance float64
	var currency string
	if err := row.Scan(&payload, &balance, &currency); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return cpd.BusinessAccount{}, cprepo.ErrNotFound
		}
		return cpd.BusinessAccount{}, err
	}
	var account cpd.BusinessAccount
	if err := json.Unmarshal(payload, &account); err != nil {
		return cpd.BusinessAccount{}, err
	}
	account.Balance = balance
	account.Currency = currency
	return account, nil
}

func parseOptionalTime(value string, fallback time.Time) time.Time {
	if parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(value)); err == nil {
		return parsed
	}
	return fallback
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
