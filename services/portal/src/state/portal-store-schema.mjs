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
        resource_binding_id text NOT NULL DEFAULT '',
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
      CREATE TABLE IF NOT EXISTS ${pgTableName("user_compute_instances")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        provider text NOT NULL,
        region text NOT NULL,
        zone text NOT NULL,
        cvm_instance_id text NOT NULL,
        instance_type text NOT NULL,
        public_endpoint text NOT NULL,
        private_endpoint text NOT NULL,
        runtime_agent_id text NOT NULL,
        runtime_agent_endpoint text NOT NULL DEFAULT '',
        runtime_agent_version text NOT NULL,
        provisioning_mode text NOT NULL DEFAULT 'registered_only',
        cloud_resource_id text NOT NULL DEFAULT '',
        server_plan_id text NOT NULL DEFAULT '',
        provision_evidence_id text NOT NULL DEFAULT '',
        provision_evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        release_evidence_id text NOT NULL DEFAULT '',
        release_evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        status text NOT NULL,
        health_status text NOT NULL,
        billing_started_at text NOT NULL,
        billing_stopped_at text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("user_storage_buckets")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        provider text NOT NULL,
        region text NOT NULL,
        bucket_name text NOT NULL,
        bucket_id text NOT NULL,
        provisioning_mode text NOT NULL DEFAULT 'registered_only',
        cloud_resource_id text NOT NULL DEFAULT '',
        storage_plan_id text NOT NULL DEFAULT '',
        storage_capacity_gb numeric NOT NULL DEFAULT 0,
        endpoint text NOT NULL,
        credentials_secret_ref text NOT NULL,
        root_prefix text NOT NULL,
        provision_evidence_id text NOT NULL DEFAULT '',
        provision_evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        release_evidence_id text NOT NULL DEFAULT '',
        release_evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        billing_started_at text NOT NULL DEFAULT '',
        billing_stopped_at text NOT NULL DEFAULT '',
        status text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("workspace_resource_bindings")} (
        id text PRIMARY KEY,
        resource_binding_id text NOT NULL,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        compute_instance_id text NOT NULL,
        storage_bucket_id text NOT NULL,
        root_prefix text NOT NULL,
        protection_policy_id text NOT NULL,
        status text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("weekly_protection_freezes")} (
        id text PRIMARY KEY,
        resource_binding_id text NOT NULL,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        compute_instance_id text NOT NULL,
        storage_bucket_id text NOT NULL,
        usage_mode text NOT NULL,
        window_start_at text NOT NULL,
        window_end_at text NOT NULL,
        weekly_amount numeric NOT NULL,
        frozen_amount numeric NOT NULL,
        consumed_amount numeric NOT NULL,
        remaining_amount numeric NOT NULL,
        reconcile_120_min_status text NOT NULL,
        t_plus_1_audit_status text NOT NULL,
        status text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        UNIQUE (resource_binding_id, window_start_at, window_end_at)
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("workspace_files")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        run_id text NOT NULL,
        opl_session_id text NOT NULL DEFAULT '',
        resource_binding_id text NOT NULL DEFAULT '',
        storage_mode text NOT NULL DEFAULT 'legacy',
        storage_root_prefix text NOT NULL DEFAULT '',
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
      CREATE TABLE IF NOT EXISTS ${pgTableName("lab_subscriptions")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        package_id text NOT NULL,
        status text NOT NULL,
        compute_tier text NOT NULL,
        included_storage_gb numeric NOT NULL,
        daily_price numeric NOT NULL,
        weekly_freeze_amount numeric NOT NULL,
        current_freeze_id text NOT NULL,
        grace_started_at text NOT NULL,
        cleanup_after_at text NOT NULL,
        backing_server_plan_id text NOT NULL,
        idempotency_key text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("lab_package_events")} (
        id text PRIMARY KEY,
        subscription_id text NOT NULL,
        event_type text NOT NULL,
        event_payload_json jsonb NOT NULL,
        actor_type text NOT NULL,
        actor_id text NOT NULL,
        idempotency_key text NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("lab_storage_addons")} (
        id text PRIMARY KEY,
        subscription_id text NOT NULL,
        storage_gb numeric NOT NULL,
        daily_price numeric NOT NULL,
        status text NOT NULL,
        idempotency_key text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("lab_daily_charges")} (
        id text PRIMARY KEY,
        subscription_id text NOT NULL,
        charge_date text NOT NULL,
        amount numeric NOT NULL,
        ledger_entry_id text NOT NULL,
        idempotency_key text NOT NULL,
        created_at timestamptz NOT NULL
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
      CREATE TABLE IF NOT EXISTS ${pgTableName("cloud_operations")} (
        id text PRIMARY KEY,
        operation_id text NOT NULL,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        resource_binding_id text NOT NULL,
        operation_type text NOT NULL,
        status text NOT NULL,
        runner_mode text NOT NULL,
        real_cloud_calls boolean NOT NULL,
        production_portal_connected boolean NOT NULL,
        test_only boolean NOT NULL DEFAULT false,
        accepted_dry_run_id text NOT NULL,
        dry_run_report_ref text NOT NULL,
        execution_report_ref text NOT NULL,
        requested_spec_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("cloud_operation_jobs")} (
        id text PRIMARY KEY,
        operation_id text NOT NULL,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        resource_binding_id text NOT NULL,
        queue_mode text NOT NULL,
        status text NOT NULL,
        runner_mode text NOT NULL,
        real_cloud_calls boolean NOT NULL,
        dry_run_report_ref text NOT NULL,
        execution_report_ref text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("compute_allocations")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        resource_binding_id text NOT NULL,
        plan_id text NOT NULL,
        compute_units numeric NOT NULL,
        status text NOT NULL,
        cluster_ref text NOT NULL DEFAULT '',
        namespace_ref text NOT NULL DEFAULT '',
        quota_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        workload_class text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("file_space_entitlements")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        resource_binding_id text NOT NULL,
        plan_id text NOT NULL,
        capacity_gb numeric NOT NULL,
        status text NOT NULL,
        retention_protection_status text NOT NULL DEFAULT '',
        retention_cleanup_after_at text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("cloud_resource_projections")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        resource_binding_id text NOT NULL,
        status text NOT NULL,
        production_portal_connected boolean NOT NULL,
        runner_mode text NOT NULL,
        real_cloud_calls boolean NOT NULL,
        last_operation_id text NOT NULL,
        visible_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("billing_reconciliations")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        resource_binding_id text NOT NULL,
        operation_id text NOT NULL,
        status text NOT NULL,
        status_label text NOT NULL,
        source text NOT NULL,
        billing_read_ref text NOT NULL DEFAULT '',
        audit_queue_ref text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
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
      ALTER TABLE ${pgTableName("user_compute_instances")} ADD COLUMN IF NOT EXISTS runtime_agent_endpoint text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("user_compute_instances")} ADD COLUMN IF NOT EXISTS provisioning_mode text NOT NULL DEFAULT 'registered_only';
      ALTER TABLE ${pgTableName("user_compute_instances")} ADD COLUMN IF NOT EXISTS cloud_resource_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("user_compute_instances")} ADD COLUMN IF NOT EXISTS server_plan_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("user_compute_instances")} ADD COLUMN IF NOT EXISTS provision_evidence_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("user_compute_instances")} ADD COLUMN IF NOT EXISTS provision_evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE ${pgTableName("user_compute_instances")} ADD COLUMN IF NOT EXISTS release_evidence_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("user_compute_instances")} ADD COLUMN IF NOT EXISTS release_evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE ${pgTableName("user_storage_buckets")} ADD COLUMN IF NOT EXISTS provisioning_mode text NOT NULL DEFAULT 'registered_only';
      ALTER TABLE ${pgTableName("user_storage_buckets")} ADD COLUMN IF NOT EXISTS cloud_resource_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("user_storage_buckets")} ADD COLUMN IF NOT EXISTS storage_plan_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("user_storage_buckets")} ADD COLUMN IF NOT EXISTS storage_capacity_gb numeric NOT NULL DEFAULT 0;
      ALTER TABLE ${pgTableName("user_storage_buckets")} ADD COLUMN IF NOT EXISTS provision_evidence_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("user_storage_buckets")} ADD COLUMN IF NOT EXISTS provision_evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE ${pgTableName("user_storage_buckets")} ADD COLUMN IF NOT EXISTS release_evidence_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("user_storage_buckets")} ADD COLUMN IF NOT EXISTS release_evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE ${pgTableName("user_storage_buckets")} ADD COLUMN IF NOT EXISTS billing_started_at text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("user_storage_buckets")} ADD COLUMN IF NOT EXISTS billing_stopped_at text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("workspace_files")} ADD COLUMN IF NOT EXISTS opl_session_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("workspace_files")} ADD COLUMN IF NOT EXISTS resource_binding_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("workspace_files")} ADD COLUMN IF NOT EXISTS storage_mode text NOT NULL DEFAULT 'legacy';
      ALTER TABLE ${pgTableName("workspace_files")} ADD COLUMN IF NOT EXISTS storage_root_prefix text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("workspace_files")} ADD COLUMN IF NOT EXISTS retention_cleanup_after_at text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS order_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS resource_binding_id text NOT NULL DEFAULT '';
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
