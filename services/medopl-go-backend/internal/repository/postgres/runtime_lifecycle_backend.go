package postgres

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

func (backend *SQLBackend) UpsertResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := backend.ensureRuntimeIdentityRows(ctx, ledger.TenantID, ledger.AccountID, ledger.WorkspaceID); err != nil {
		return err
	}
	now := time.Now().UTC()
	createdAt := parseOptionalTime(ledger.CreatedAt, now)
	releasedAt := nullableTime(ledger.ReleasedAt)
	_, err := backend.db.ExecContext(ctx, `
INSERT INTO resource_bindings (
  id, tenant_id, account_id, workspace_id, resource_binding_id, billing_attribution_id,
  server_plan_id, workspace_storage_gb, cloud_provider, region, cluster_id, node_pool_id,
  node_pool_name, status, operation_id, canonical_ownership_source, cloud_tag_support,
  created_at, released_at, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULLIF($12, ''), $13, $14, $15, $16, $17, $18, $19, $20)
ON CONFLICT (resource_binding_id)
DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  account_id = EXCLUDED.account_id,
  workspace_id = EXCLUDED.workspace_id,
  billing_attribution_id = EXCLUDED.billing_attribution_id,
  server_plan_id = EXCLUDED.server_plan_id,
  workspace_storage_gb = EXCLUDED.workspace_storage_gb,
  cloud_provider = EXCLUDED.cloud_provider,
  region = EXCLUDED.region,
  cluster_id = EXCLUDED.cluster_id,
  node_pool_id = EXCLUDED.node_pool_id,
  node_pool_name = EXCLUDED.node_pool_name,
  status = EXCLUDED.status,
  operation_id = EXCLUDED.operation_id,
  canonical_ownership_source = EXCLUDED.canonical_ownership_source,
  cloud_tag_support = EXCLUDED.cloud_tag_support,
  released_at = EXCLUDED.released_at,
  updated_at = EXCLUDED.updated_at
`, ledger.ResourceBindingID, ledger.TenantID, ledger.AccountID, ledger.WorkspaceID, ledger.ResourceBindingID, ledger.BillingAttributionID,
		ledger.ServerPlanID, ledger.WorkspaceStorageGB, ledger.CloudProvider, ledger.Region, ledger.ClusterID, ledger.NodePoolID,
		ledger.NodePoolName, ledger.Status, ledger.OperationID, ledger.CanonicalOwnershipSource, ledger.CloudTagSupport, createdAt, releasedAt, now)
	return err
}

func (backend *SQLBackend) ResourceBindingLedger(ctx context.Context, resourceBindingID string) (cpd.ResourceBindingLedger, error) {
	if err := ctx.Err(); err != nil {
		return cpd.ResourceBindingLedger{}, err
	}
	row := backend.db.QueryRowContext(ctx, `
SELECT tenant_id, account_id, workspace_id, resource_binding_id, billing_attribution_id,
  server_plan_id, workspace_storage_gb, cloud_provider, region, cluster_id, COALESCE(node_pool_id, ''),
  node_pool_name, status, operation_id, canonical_ownership_source, cloud_tag_support,
  created_at, released_at
FROM resource_bindings
WHERE resource_binding_id = $1
`, resourceBindingID)
	return scanResourceBindingLedger(row)
}

func (backend *SQLBackend) ListResourceBindingLedgers(ctx context.Context, workspaceID string) ([]cpd.ResourceBindingLedger, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	query := `
SELECT tenant_id, account_id, workspace_id, resource_binding_id, billing_attribution_id,
  server_plan_id, workspace_storage_gb, cloud_provider, region, cluster_id, COALESCE(node_pool_id, ''),
  node_pool_name, status, operation_id, canonical_ownership_source, cloud_tag_support,
  created_at, released_at
FROM resource_bindings
`
	args := []any{}
	if strings.TrimSpace(workspaceID) != "" {
		query += "WHERE workspace_id = $1\n"
		args = append(args, strings.TrimSpace(workspaceID))
	}
	query += "ORDER BY resource_binding_id"
	rows, err := backend.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []cpd.ResourceBindingLedger{}
	for rows.Next() {
		item, err := scanResourceBindingLedger(rows)
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

func (backend *SQLBackend) UpsertCloudOperation(ctx context.Context, operation cpd.CloudOperation) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := backend.ensureRuntimeIdentityRows(ctx, operation.TenantID, operation.AccountID, operation.WorkspaceID); err != nil {
		return err
	}
	now := time.Now().UTC()
	createdAt := parseOptionalTime(operation.CreatedAt, now)
	completedAt := nullableTime(operation.CompletedAt)
	_, err := backend.db.ExecContext(ctx, `
INSERT INTO cloud_operations (
  id, operation_id, resource_binding_id, tenant_id, account_id, workspace_id,
  billing_attribution_id, operation_type, server_plan_id, workspace_storage_gb,
  status, cloud_provider, region, cluster_id, node_pool_id, node_pool_name,
  cloud_tag_support, canonical_ownership_source, created_at, completed_at, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULLIF($15, ''), $16, $17, $18, $19, $20, $21)
ON CONFLICT (operation_id)
DO UPDATE SET
  resource_binding_id = EXCLUDED.resource_binding_id,
  tenant_id = EXCLUDED.tenant_id,
  account_id = EXCLUDED.account_id,
  workspace_id = EXCLUDED.workspace_id,
  billing_attribution_id = EXCLUDED.billing_attribution_id,
  operation_type = EXCLUDED.operation_type,
  server_plan_id = EXCLUDED.server_plan_id,
  workspace_storage_gb = EXCLUDED.workspace_storage_gb,
  status = EXCLUDED.status,
  cloud_provider = EXCLUDED.cloud_provider,
  region = EXCLUDED.region,
  cluster_id = EXCLUDED.cluster_id,
  node_pool_id = EXCLUDED.node_pool_id,
  node_pool_name = EXCLUDED.node_pool_name,
  cloud_tag_support = EXCLUDED.cloud_tag_support,
  canonical_ownership_source = EXCLUDED.canonical_ownership_source,
  completed_at = EXCLUDED.completed_at,
  updated_at = EXCLUDED.updated_at
`, operation.OperationID, operation.OperationID, operation.ResourceBindingID, operation.TenantID, operation.AccountID, operation.WorkspaceID,
		operation.BillingAttributionID, operation.OperationType, operation.ServerPlanID, operation.WorkspaceStorageGB,
		operation.Status, operation.CloudProvider, operation.Region, operation.ClusterID, operation.NodePoolID, operation.NodePoolName,
		operation.CloudTagSupport, operation.CanonicalOwnershipSource, createdAt, completedAt, now)
	return err
}

func (backend *SQLBackend) CloudOperation(ctx context.Context, operationID string) (cpd.CloudOperation, error) {
	if err := ctx.Err(); err != nil {
		return cpd.CloudOperation{}, err
	}
	row := backend.db.QueryRowContext(ctx, `
SELECT operation_id, resource_binding_id, tenant_id, account_id, workspace_id,
  billing_attribution_id, operation_type, server_plan_id, workspace_storage_gb,
  status, cloud_provider, region, cluster_id, COALESCE(node_pool_id, ''), node_pool_name,
  cloud_tag_support, canonical_ownership_source, created_at, completed_at
FROM cloud_operations
WHERE operation_id = $1
`, operationID)
	return scanCloudOperation(row)
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanResourceBindingLedger(row rowScanner) (cpd.ResourceBindingLedger, error) {
	var ledger cpd.ResourceBindingLedger
	var createdAt time.Time
	var releasedAt sql.NullTime
	err := row.Scan(
		&ledger.TenantID,
		&ledger.AccountID,
		&ledger.WorkspaceID,
		&ledger.ResourceBindingID,
		&ledger.BillingAttributionID,
		&ledger.ServerPlanID,
		&ledger.WorkspaceStorageGB,
		&ledger.CloudProvider,
		&ledger.Region,
		&ledger.ClusterID,
		&ledger.NodePoolID,
		&ledger.NodePoolName,
		&ledger.Status,
		&ledger.OperationID,
		&ledger.CanonicalOwnershipSource,
		&ledger.CloudTagSupport,
		&createdAt,
		&releasedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return cpd.ResourceBindingLedger{}, cprepo.ErrNotFound
		}
		return cpd.ResourceBindingLedger{}, err
	}
	ledger.CreatedAt = formatTime(createdAt)
	if releasedAt.Valid {
		ledger.ReleasedAt = formatTime(releasedAt.Time)
	}
	return ledger, nil
}

func scanCloudOperation(row rowScanner) (cpd.CloudOperation, error) {
	var operation cpd.CloudOperation
	var createdAt time.Time
	var completedAt sql.NullTime
	err := row.Scan(
		&operation.OperationID,
		&operation.ResourceBindingID,
		&operation.TenantID,
		&operation.AccountID,
		&operation.WorkspaceID,
		&operation.BillingAttributionID,
		&operation.OperationType,
		&operation.ServerPlanID,
		&operation.WorkspaceStorageGB,
		&operation.Status,
		&operation.CloudProvider,
		&operation.Region,
		&operation.ClusterID,
		&operation.NodePoolID,
		&operation.NodePoolName,
		&operation.CloudTagSupport,
		&operation.CanonicalOwnershipSource,
		&createdAt,
		&completedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return cpd.CloudOperation{}, cprepo.ErrNotFound
		}
		return cpd.CloudOperation{}, err
	}
	operation.CreatedAt = formatTime(createdAt)
	if completedAt.Valid {
		operation.CompletedAt = formatTime(completedAt.Time)
	}
	return operation, nil
}

func (backend *SQLBackend) ensureRuntimeIdentityRows(ctx context.Context, tenantID string, accountID string, workspaceID string) error {
	now := time.Now().UTC()
	tenantID = strings.TrimSpace(tenantID)
	accountID = strings.TrimSpace(accountID)
	workspaceID = strings.TrimSpace(workspaceID)
	if tenantID == "" || accountID == "" || workspaceID == "" {
		return cpd.ErrWorkspaceRequired
	}
	if _, err := backend.db.ExecContext(ctx, `
INSERT INTO tenants (id, name, status, created_at, updated_at)
VALUES ($1, $2, 'active', $3, $3)
ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at
`, tenantID, tenantID, now); err != nil {
		return err
	}
	if _, err := backend.db.ExecContext(ctx, `
INSERT INTO users (id, tenant_id, email, name, status, created_at, updated_at)
VALUES ($1, $2, $3, $1, 'active', $4, $4)
ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, updated_at = EXCLUDED.updated_at
`, accountID, tenantID, accountID+"@medopl.local", now); err != nil {
		return err
	}
	_, err := backend.db.ExecContext(ctx, `
INSERT INTO workspaces (id, tenant_id, owner_user_id, slug, title, status, created_at, updated_at)
VALUES ($1, $2, $3, $1, $1, 'active', $4, $4)
ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, owner_user_id = EXCLUDED.owner_user_id, updated_at = EXCLUDED.updated_at
`, workspaceID, tenantID, accountID, now)
	return err
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}

func nullableTime(value string) sql.NullTime {
	if parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(value)); err == nil {
		return sql.NullTime{Time: parsed.UTC(), Valid: true}
	}
	return sql.NullTime{}
}
