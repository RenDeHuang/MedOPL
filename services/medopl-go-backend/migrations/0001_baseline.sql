CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  slug TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON workspaces(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_tenant_slug ON workspaces(tenant_id, slug);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  status TEXT NOT NULL DEFAULT 'pending',
  external_ref TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_workspace_id ON runs(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_workspace_idempotency ON runs(workspace_id, idempotency_key);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  kind TEXT NOT NULL DEFAULT 'output',
  status TEXT NOT NULL DEFAULT 'available',
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_workspace_id ON artifacts(workspace_id);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'input',
  status TEXT NOT NULL DEFAULT 'available',
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_workspace_id ON files(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_workspace_name ON files(workspace_id, name);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT REFERENCES workspaces(id),
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CNY',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_events_tenant_id ON billing_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_workspace_id ON billing_events(workspace_id);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  run_id TEXT REFERENCES runs(id),
  command_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE,
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workspace_id ON workflow_executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_run_id ON workflow_executions(run_id);

CREATE TABLE IF NOT EXISTS business_accounts (
  workspace_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  portal_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CNY',
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_accounts_workspace_id ON business_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_accounts_tenant_id ON business_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_accounts_portal_user_id ON business_accounts(portal_user_id);

CREATE TABLE IF NOT EXISTS credit_events (
  event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  portal_user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_events_event_id ON credit_events(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_events_idempotency_key ON credit_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_credit_events_workspace_id ON credit_events(workspace_id);

CREATE TABLE IF NOT EXISTS provider_bindings (
  workspace_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  portal_user_id TEXT NOT NULL,
  provider_key_ref TEXT NOT NULL,
  bound_status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_bindings_workspace_id ON provider_bindings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_provider_bindings_tenant_id ON provider_bindings(tenant_id);

CREATE TABLE IF NOT EXISTS launch_projections (
  launch_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  resource_binding_id TEXT NOT NULL,
  provider_key_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_launch_projections_launch_id ON launch_projections(launch_id);
CREATE INDEX IF NOT EXISTS idx_launch_projections_workspace_id ON launch_projections(workspace_id);

CREATE TABLE IF NOT EXISTS managed_resources (
  resource_binding_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  storage_state TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_managed_resources_resource_binding_id ON managed_resources(resource_binding_id);
CREATE INDEX IF NOT EXISTS idx_managed_resources_workspace_id ON managed_resources(workspace_id);

CREATE TABLE IF NOT EXISTS control_plane_records (
  kind TEXT NOT NULL,
  record_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (kind, record_id)
);
CREATE INDEX IF NOT EXISTS idx_control_plane_records_workspace_id ON control_plane_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_control_plane_records_kind_workspace_id ON control_plane_records(kind, workspace_id);

CREATE TABLE IF NOT EXISTS resource_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  account_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  resource_binding_id TEXT NOT NULL,
  billing_attribution_id TEXT NOT NULL,
  server_plan_id TEXT NOT NULL,
  workspace_storage_gb INTEGER NOT NULL CHECK (workspace_storage_gb > 0),
  cloud_provider TEXT NOT NULL,
  region TEXT NOT NULL,
  cluster_id TEXT NOT NULL,
  node_pool_id TEXT,
  node_pool_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested', 'creating', 'created', 'scaling', 'ready', 'releaseRequested', 'deleting', 'released', 'failed', 'cleanupRequired')),
  operation_id TEXT NOT NULL,
  canonical_ownership_source TEXT NOT NULL DEFAULT 'postgres_resource_binding_ledger',
  cloud_tag_support TEXT NOT NULL DEFAULT 'tke_nodepool_unsupported',
  created_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_bindings_resource_binding_id ON resource_bindings(resource_binding_id);
CREATE INDEX IF NOT EXISTS idx_resource_bindings_tenant_id ON resource_bindings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resource_bindings_workspace_id ON resource_bindings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_resource_bindings_operation_id ON resource_bindings(operation_id);

CREATE TABLE IF NOT EXISTS cloud_operations (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  resource_binding_id TEXT NOT NULL REFERENCES resource_bindings(resource_binding_id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  account_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  billing_attribution_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  server_plan_id TEXT NOT NULL,
  workspace_storage_gb INTEGER NOT NULL CHECK (workspace_storage_gb > 0),
  status TEXT NOT NULL CHECK (status IN ('requested', 'creating', 'created', 'scaling', 'ready', 'releaseRequested', 'deleting', 'released', 'failed', 'cleanupRequired')),
  cloud_provider TEXT NOT NULL,
  region TEXT NOT NULL,
  cluster_id TEXT NOT NULL,
  node_pool_id TEXT,
  node_pool_name TEXT NOT NULL,
  cloud_tag_support TEXT NOT NULL DEFAULT 'tke_nodepool_unsupported',
  canonical_ownership_source TEXT NOT NULL DEFAULT 'postgres_resource_binding_ledger',
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cloud_operations_operation_id ON cloud_operations(operation_id);
CREATE INDEX IF NOT EXISTS idx_cloud_operations_resource_binding_id ON cloud_operations(resource_binding_id);
CREATE INDEX IF NOT EXISTS idx_cloud_operations_workspace_id ON cloud_operations(workspace_id);

CREATE TABLE IF NOT EXISTS control_plane_audit_events (
  event_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  resource_binding_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_control_plane_audit_events_event_id ON control_plane_audit_events(event_id);
CREATE INDEX IF NOT EXISTS idx_control_plane_audit_events_workspace_id ON control_plane_audit_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_control_plane_audit_events_resource_binding_id ON control_plane_audit_events(resource_binding_id);
