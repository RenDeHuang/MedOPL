export function createPortalStoreSchema({
  namespace = "portal",
} = {}) {
  function pgTableName(name) {
    const ns = String(namespace || "portal").replace(/[^a-zA-Z0-9_]+/g, "_");
    return `"${ns}_${name}"`;
  }

  async function initializePostgresSchema(pool) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${pgTableName("users")} (
        id text PRIMARY KEY,
        email text NOT NULL,
        name text NOT NULL,
        role text NOT NULL,
        status text NOT NULL,
        password_hash text NOT NULL,
        current_task_slug text NOT NULL,
        group_id text NOT NULL,
        preferences_json jsonb NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("wallets")} (
        user_id text PRIMARY KEY,
        balance numeric NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("ledger_entries")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL DEFAULT '',
        user_id text NOT NULL,
        run_id text NOT NULL,
        workspace_id text NOT NULL,
        order_id text NOT NULL DEFAULT '',
        type text NOT NULL,
        amount numeric NOT NULL,
        currency text NOT NULL DEFAULT 'CNY',
        source_type text NOT NULL DEFAULT '',
        source_id text NOT NULL DEFAULT '',
        idempotency_key text NOT NULL DEFAULT '',
        reason text NOT NULL,
        operator_id text NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("resource_orders")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        portal_user_id text NOT NULL,
        workspace_id text NOT NULL,
        workspace_session_id text NOT NULL,
        run_id text NOT NULL,
        status text NOT NULL,
        server_plan_id text NOT NULL,
        region text NOT NULL,
        zone text NOT NULL,
        cpu numeric NOT NULL,
        memory_gb numeric NOT NULL,
        gpu_type text NOT NULL,
        gpu_count numeric NOT NULL,
        storage_plan_id text NOT NULL,
        storage_size_gb numeric NOT NULL,
        retention_policy text NOT NULL,
        estimated_hours numeric NOT NULL,
        auto_stop_at text NOT NULL,
        quote_id text NOT NULL,
        freeze_id text NOT NULL,
        provision_request_id text NOT NULL,
        cloud_resource_ids_json jsonb NOT NULL,
        currency text NOT NULL,
        unit_price numeric NOT NULL,
        min_billable_hours numeric NOT NULL,
        risk_factor numeric NOT NULL,
        quote_amount numeric NOT NULL,
        freeze_amount numeric NOT NULL,
        exact_cost numeric NULL,
        pricing_source text NOT NULL,
        price_updated_at text NOT NULL,
        idempotency_key text NOT NULL,
        failed_reason text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        settled_at timestamptz NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("resource_order_events")} (
        id text PRIMARY KEY,
        order_id text NOT NULL,
        event_type text NOT NULL,
        event_payload_json jsonb NOT NULL,
        actor_type text NOT NULL,
        actor_id text NOT NULL,
        idempotency_key text NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("storage_orders")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        status text NOT NULL,
        storage_plan_id text NOT NULL,
        storage_size_gb numeric NOT NULL,
        storage_backend text NOT NULL,
        retention_policy text NOT NULL,
        cos_prefix text NOT NULL,
        source_type text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz NULL,
        retention_cleanup_after_at text NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("workspace_files")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        run_id text NOT NULL,
        kind text NOT NULL,
        name text NOT NULL,
        relative_path text NOT NULL,
        storage_key text NOT NULL,
        local_path text NOT NULL,
        size_bytes numeric NOT NULL,
        checksum text NOT NULL,
        content_type text NOT NULL,
        status text NOT NULL,
        source text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz NULL,
        retention_cleanup_after_at text NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("task_spaces")} (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        slug text NOT NULL,
        title text NOT NULL,
        path text NOT NULL,
        status text NOT NULL,
        server_plan_id text NOT NULL DEFAULT '',
        server_plan_region text NOT NULL DEFAULT '',
        server_plan_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        archived_at timestamptz NULL,
        deleted_at timestamptz NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("user_sandboxes")} (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        runtime_type text NOT NULL,
        container_name text NOT NULL,
        namespace text NOT NULL,
        image_tag text NOT NULL,
        status text NOT NULL,
        last_workspace_id text NOT NULL,
        last_run_id text NOT NULL,
        last_error text NOT NULL,
        last_active_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("groups")} (
        id text PRIMARY KEY,
        name text NOT NULL,
        plan text NOT NULL,
        status text NOT NULL,
        balance_floor numeric NOT NULL,
        max_workspaces integer NOT NULL,
        max_concurrent_runs integer NOT NULL,
        cpu_request text NOT NULL,
        cpu_limit text NOT NULL,
        memory_request text NOT NULL,
        memory_limit text NOT NULL,
        gpu_count integer NOT NULL,
        storage_request text NOT NULL,
        storage_limit text NOT NULL,
        allow_mas boolean NOT NULL,
        allow_workspace_create boolean NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("portal_settings")} (
        key text PRIMARY KEY,
        value_json jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("audit_events")} (
        id text PRIMARY KEY,
        type text NOT NULL,
        user_id text NOT NULL,
        operator_id text NOT NULL,
        workspace_id text NOT NULL,
        run_id text NOT NULL,
        detail_json jsonb NOT NULL,
        occurred_at timestamptz NOT NULL
      );
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS cpu_request text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS cpu_limit text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS memory_request text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS memory_limit text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS gpu_count integer NOT NULL DEFAULT 0;
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS storage_request text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS storage_limit text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("task_spaces")} ADD COLUMN IF NOT EXISTS server_plan_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("task_spaces")} ADD COLUMN IF NOT EXISTS server_plan_region text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("task_spaces")} ADD COLUMN IF NOT EXISTS server_plan_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE ${pgTableName("storage_orders")} ADD COLUMN IF NOT EXISTS retention_cleanup_after_at text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("workspace_files")} ADD COLUMN IF NOT EXISTS retention_cleanup_after_at text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS order_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CNY';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS source_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS idempotency_key text NOT NULL DEFAULT '';
    `);
  }

  return {
    initializePostgresSchema,
    pgTableName,
  };
}
