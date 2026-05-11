export async function writeUsers({ client, pgTableName, db }) {
  for (const row of db.users || []) {
    await client.query(`INSERT INTO ${pgTableName("users")} (id,email,name,role,status,password_hash,current_task_slug,group_id,preferences_json,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET
        email=EXCLUDED.email,
        name=EXCLUDED.name,
        role=EXCLUDED.role,
        status=EXCLUDED.status,
        password_hash=COALESCE(NULLIF(EXCLUDED.password_hash, ''), ${pgTableName("users")}.password_hash),
        current_task_slug=EXCLUDED.current_task_slug,
        group_id=EXCLUDED.group_id,
        preferences_json=EXCLUDED.preferences_json`, [
      row.id, row.email, row.name, row.role, row.status, row.passwordHash || "", row.currentTaskSlug || "default", row.groupId || "", JSON.stringify(row.preferences || { theme: "light" }), row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeWallets({ client, pgTableName, db }) {
  for (const row of db.wallets || []) {
    await client.query(`INSERT INTO ${pgTableName("wallets")} (user_id,balance,updated_at) VALUES ($1,$2,$3)
      ON CONFLICT (user_id) DO UPDATE SET
        balance=EXCLUDED.balance,
        updated_at=EXCLUDED.updated_at`, [row.userId, Number(row.balance || 0), row.updatedAt || new Date().toISOString()]);
  }
}

export async function writeLedgerEntries({ client, pgTableName, db, normalizeLedgerEntries }) {
  for (const row of normalizeLedgerEntries(db.ledger || [])) {
    await client.query(`INSERT INTO ${pgTableName("ledger_entries")} (id,tenant_id,user_id,run_id,workspace_id,order_id,resource_binding_id,type,amount,currency,source_type,source_id,idempotency_key,reason,operator_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        run_id=EXCLUDED.run_id,
        workspace_id=EXCLUDED.workspace_id,
        order_id=EXCLUDED.order_id,
        resource_binding_id=EXCLUDED.resource_binding_id,
        type=EXCLUDED.type,
        amount=EXCLUDED.amount,
        currency=EXCLUDED.currency,
        source_type=EXCLUDED.source_type,
        source_id=EXCLUDED.source_id,
        idempotency_key=EXCLUDED.idempotency_key,
        reason=EXCLUDED.reason,
        operator_id=EXCLUDED.operator_id,
        created_at=EXCLUDED.created_at`, [
      row.id,
      row.tenantId || row.userId || "",
      row.userId || "",
      row.runId || "",
      row.workspaceId || "",
      row.orderId || "",
      row.resourceBindingId || "",
      row.type || "",
      Number(row.amount || 0),
      row.currency || "CNY",
      row.sourceType || "",
      row.sourceId || "",
      row.idempotencyKey || "",
      row.reason || "",
      row.operatorId || "",
      row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeTaskSpaces({ client, pgTableName, db, normalizeServerPlanSelection }) {
  for (const row of db.taskSpaces || []) {
    await client.query(`INSERT INTO ${pgTableName("task_spaces")} (id,user_id,slug,title,path,status,server_plan_id,server_plan_region,server_plan_snapshot_json,created_at,updated_at,archived_at,deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        user_id=EXCLUDED.user_id,
        slug=EXCLUDED.slug,
        title=EXCLUDED.title,
        path=EXCLUDED.path,
        status=EXCLUDED.status,
        server_plan_id=COALESCE(NULLIF(EXCLUDED.server_plan_id, ''), ${pgTableName("task_spaces")}.server_plan_id),
        server_plan_region=COALESCE(NULLIF(EXCLUDED.server_plan_region, ''), ${pgTableName("task_spaces")}.server_plan_region),
        server_plan_snapshot_json=CASE
          WHEN EXCLUDED.server_plan_snapshot_json = '{}'::jsonb THEN ${pgTableName("task_spaces")}.server_plan_snapshot_json
          ELSE EXCLUDED.server_plan_snapshot_json
        END,
        updated_at=EXCLUDED.updated_at,
        archived_at=EXCLUDED.archived_at,
        deleted_at=EXCLUDED.deleted_at`, [
      row.id,
      row.userId,
      row.slug,
      row.title,
      row.path,
      row.status,
      row.serverPlanId || "",
      row.serverPlanRegion || "",
      JSON.stringify(normalizeServerPlanSelection(row.serverPlanSnapshot) || {}),
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
      row.archivedAt || null,
      row.deletedAt || null,
    ]);
  }
}

export async function writeResourceOrders({ client, pgTableName, db }) {
  for (const row of db.resourceOrders || []) {
    await client.query(`INSERT INTO ${pgTableName("resource_orders")} (id,tenant_id,user_id,portal_user_id,workspace_id,workspace_session_id,run_id,status,server_plan_id,region,zone,cpu,memory_gb,gpu_type,gpu_count,storage_plan_id,storage_size_gb,retention_policy,estimated_hours,auto_stop_at,quote_id,freeze_id,provision_request_id,cloud_resource_ids_json,currency,unit_price,min_billable_hours,risk_factor,quote_amount,freeze_amount,exact_cost,pricing_source,price_updated_at,idempotency_key,failed_reason,created_at,updated_at,settled_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        portal_user_id=EXCLUDED.portal_user_id,
        workspace_id=EXCLUDED.workspace_id,
        workspace_session_id=EXCLUDED.workspace_session_id,
        run_id=EXCLUDED.run_id,
        status=EXCLUDED.status,
        server_plan_id=EXCLUDED.server_plan_id,
        region=EXCLUDED.region,
        zone=EXCLUDED.zone,
        cpu=EXCLUDED.cpu,
        memory_gb=EXCLUDED.memory_gb,
        gpu_type=EXCLUDED.gpu_type,
        gpu_count=EXCLUDED.gpu_count,
        storage_plan_id=EXCLUDED.storage_plan_id,
        storage_size_gb=EXCLUDED.storage_size_gb,
        retention_policy=EXCLUDED.retention_policy,
        estimated_hours=EXCLUDED.estimated_hours,
        auto_stop_at=EXCLUDED.auto_stop_at,
        quote_id=EXCLUDED.quote_id,
        freeze_id=EXCLUDED.freeze_id,
        provision_request_id=EXCLUDED.provision_request_id,
        cloud_resource_ids_json=EXCLUDED.cloud_resource_ids_json,
        currency=EXCLUDED.currency,
        unit_price=EXCLUDED.unit_price,
        min_billable_hours=EXCLUDED.min_billable_hours,
        risk_factor=EXCLUDED.risk_factor,
        quote_amount=EXCLUDED.quote_amount,
        freeze_amount=EXCLUDED.freeze_amount,
        exact_cost=EXCLUDED.exact_cost,
        pricing_source=EXCLUDED.pricing_source,
        price_updated_at=EXCLUDED.price_updated_at,
        idempotency_key=EXCLUDED.idempotency_key,
        failed_reason=EXCLUDED.failed_reason,
        updated_at=EXCLUDED.updated_at,
        settled_at=EXCLUDED.settled_at
      WHERE ${pgTableName("resource_orders")}.updated_at <= EXCLUDED.updated_at`, [
      row.id,
      row.tenantId || row.userId || "",
      row.userId || "",
      row.portalUserId || row.userId || "",
      row.workspaceId || "",
      row.workspaceSessionId || "",
      row.runId || "",
      row.status || "quoted",
      row.serverPlanId || "",
      row.region || "",
      row.zone || "",
      Number(row.cpu || 0),
      Number(row.memoryGb || 0),
      row.gpuType || "",
      Number(row.gpuCount || 0),
      row.storagePlanId || "",
      Number(row.storageSizeGb || 0),
      row.retentionPolicy || "",
      Number(row.estimatedHours || 1),
      row.autoStopAt || "",
      row.quoteId || "",
      row.freezeId || "",
      row.provisionRequestId || "",
      JSON.stringify(row.cloudResourceIds || []),
      row.currency || "CNY",
      Number(row.unitPrice || 0),
      Number(row.minBillableHours || 1),
      Number(row.riskFactor || 1),
      Number(row.quoteAmount || 0),
      Number(row.freezeAmount || 0),
      row.exactCost === null || row.exactCost === undefined ? null : Number(row.exactCost || 0),
      row.pricingSource || "",
      row.priceUpdatedAt || "",
      row.idempotencyKey || "",
      row.failedReason || "",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
      row.settledAt || null,
    ]);
  }
}

export async function writeResourceOrderEvents({ client, pgTableName, db }) {
  for (const row of db.resourceOrderEvents || []) {
    await client.query(`INSERT INTO ${pgTableName("resource_order_events")} (id,order_id,event_type,event_payload_json,actor_type,actor_id,idempotency_key,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        order_id=EXCLUDED.order_id,
        event_type=EXCLUDED.event_type,
        event_payload_json=EXCLUDED.event_payload_json,
        actor_type=EXCLUDED.actor_type,
        actor_id=EXCLUDED.actor_id,
        idempotency_key=EXCLUDED.idempotency_key,
        created_at=EXCLUDED.created_at`, [
      row.id,
      row.orderId || "",
      row.eventType || "",
      JSON.stringify(row.eventPayload || {}),
      row.actorType || "system",
      row.actorId || "",
      row.idempotencyKey || "",
      row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeStorageOrders({ client, pgTableName, db }) {
  for (const row of db.storageOrders || []) {
    await client.query(`INSERT INTO ${pgTableName("storage_orders")} (id,tenant_id,user_id,workspace_id,status,storage_plan_id,storage_size_gb,storage_backend,retention_policy,cos_prefix,source_type,created_at,updated_at,deleted_at,retention_cleanup_after_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        workspace_id=EXCLUDED.workspace_id,
        status=EXCLUDED.status,
        storage_plan_id=EXCLUDED.storage_plan_id,
        storage_size_gb=EXCLUDED.storage_size_gb,
        storage_backend=EXCLUDED.storage_backend,
        retention_policy=EXCLUDED.retention_policy,
        cos_prefix=EXCLUDED.cos_prefix,
        source_type=EXCLUDED.source_type,
        updated_at=EXCLUDED.updated_at,
        deleted_at=EXCLUDED.deleted_at,
        retention_cleanup_after_at=EXCLUDED.retention_cleanup_after_at`, [
      row.id,
      row.tenantId || row.userId || "",
      row.userId || "",
      row.workspaceId || "",
      row.status || "active",
      row.storagePlanId || "",
      Number(row.storageSizeGb || 0),
      row.storageBackend || "cos",
      row.retentionPolicy || "order_lifecycle",
      row.cosPrefix || "",
      row.sourceType || "portal_storage_order",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
      row.deletedAt || null,
      row.retentionCleanupAfterAt || "",
    ]);
  }
}

export async function writeUserComputeInstances({ client, pgTableName, db }) {
  for (const row of db.userComputeInstances || []) {
    await client.query(`INSERT INTO ${pgTableName("user_compute_instances")} (id,tenant_id,user_id,provider,region,zone,cvm_instance_id,instance_type,public_endpoint,private_endpoint,runtime_agent_id,runtime_agent_endpoint,runtime_agent_version,provisioning_mode,cloud_resource_id,server_plan_id,provision_evidence_id,provision_evidence_json,release_evidence_id,release_evidence_json,status,health_status,billing_started_at,billing_stopped_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        provider=EXCLUDED.provider,
        region=EXCLUDED.region,
        zone=EXCLUDED.zone,
        cvm_instance_id=EXCLUDED.cvm_instance_id,
        instance_type=EXCLUDED.instance_type,
        public_endpoint=EXCLUDED.public_endpoint,
        private_endpoint=EXCLUDED.private_endpoint,
        runtime_agent_id=EXCLUDED.runtime_agent_id,
        runtime_agent_endpoint=EXCLUDED.runtime_agent_endpoint,
        runtime_agent_version=EXCLUDED.runtime_agent_version,
        provisioning_mode=EXCLUDED.provisioning_mode,
        cloud_resource_id=EXCLUDED.cloud_resource_id,
        server_plan_id=EXCLUDED.server_plan_id,
        provision_evidence_id=EXCLUDED.provision_evidence_id,
        provision_evidence_json=EXCLUDED.provision_evidence_json,
        release_evidence_id=EXCLUDED.release_evidence_id,
        release_evidence_json=EXCLUDED.release_evidence_json,
        status=EXCLUDED.status,
        health_status=EXCLUDED.health_status,
        billing_started_at=EXCLUDED.billing_started_at,
        billing_stopped_at=EXCLUDED.billing_stopped_at,
        updated_at=EXCLUDED.updated_at`, [
      row.id,
      row.ownerTenantId || row.tenantId || row.userId || "",
      row.ownerUserId || row.userId || "",
      row.provider || "tencent-cloud",
      row.region || "",
      row.zone || "",
      row.cvmInstanceId || row.instanceId || "",
      row.instanceType || "",
      row.publicEndpoint || "",
      row.privateEndpoint || "",
      row.runtimeAgentId || "",
      row.runtimeAgentEndpoint || "",
      row.runtimeAgentVersion || "",
      row.provisioningMode || "registered_only",
      row.cloudResourceId || row.cvmInstanceId || row.instanceId || "",
      row.serverPlanId || "",
      row.provisionEvidenceId || "",
      JSON.stringify(row.provisionEvidence || {}),
      row.releaseEvidenceId || "",
      JSON.stringify(row.releaseEvidence || {}),
      row.status || "active",
      row.healthStatus || "unknown",
      row.billingStartedAt || "",
      row.billingStoppedAt || "",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeUserStorageBuckets({ client, pgTableName, db }) {
  for (const row of db.userStorageBuckets || []) {
    await client.query(`INSERT INTO ${pgTableName("user_storage_buckets")} (id,tenant_id,user_id,provider,region,bucket_name,bucket_id,provisioning_mode,cloud_resource_id,storage_plan_id,storage_capacity_gb,endpoint,credentials_secret_ref,root_prefix,provision_evidence_id,provision_evidence_json,release_evidence_id,release_evidence_json,billing_started_at,billing_stopped_at,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        provider=EXCLUDED.provider,
        region=EXCLUDED.region,
        bucket_name=EXCLUDED.bucket_name,
        bucket_id=EXCLUDED.bucket_id,
        provisioning_mode=EXCLUDED.provisioning_mode,
        cloud_resource_id=EXCLUDED.cloud_resource_id,
        storage_plan_id=EXCLUDED.storage_plan_id,
        storage_capacity_gb=EXCLUDED.storage_capacity_gb,
        endpoint=EXCLUDED.endpoint,
        credentials_secret_ref=EXCLUDED.credentials_secret_ref,
        root_prefix=EXCLUDED.root_prefix,
        provision_evidence_id=EXCLUDED.provision_evidence_id,
        provision_evidence_json=EXCLUDED.provision_evidence_json,
        release_evidence_id=EXCLUDED.release_evidence_id,
        release_evidence_json=EXCLUDED.release_evidence_json,
        billing_started_at=EXCLUDED.billing_started_at,
        billing_stopped_at=EXCLUDED.billing_stopped_at,
        status=EXCLUDED.status,
        updated_at=EXCLUDED.updated_at`, [
      row.id,
      row.ownerTenantId || row.tenantId || row.userId || "",
      row.ownerUserId || row.userId || "",
      row.provider || "cos",
      row.region || "",
      row.bucketName || row.bucketId || "",
      row.bucketId || row.bucketName || "",
      row.provisioningMode || "registered_only",
      row.cloudResourceId || row.bucketId || row.bucketName || "",
      row.storagePlanId || "",
      Number(row.storageCapacityGb || 0),
      row.endpoint || "",
      row.credentialsSecretRef || "",
      row.rootPrefix || "",
      row.provisionEvidenceId || "",
      JSON.stringify(row.provisionEvidence || {}),
      row.releaseEvidenceId || "",
      JSON.stringify(row.releaseEvidence || {}),
      row.billingStartedAt || "",
      row.billingStoppedAt || "",
      row.status || "active",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeWorkspaceResourceBindings({ client, pgTableName, db }) {
  for (const row of db.workspaceResourceBindings || []) {
    await client.query(`INSERT INTO ${pgTableName("workspace_resource_bindings")} (id,resource_binding_id,tenant_id,user_id,workspace_id,compute_instance_id,storage_bucket_id,root_prefix,protection_policy_id,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET
        resource_binding_id=EXCLUDED.resource_binding_id,
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        workspace_id=EXCLUDED.workspace_id,
        compute_instance_id=EXCLUDED.compute_instance_id,
        storage_bucket_id=EXCLUDED.storage_bucket_id,
        root_prefix=EXCLUDED.root_prefix,
        protection_policy_id=EXCLUDED.protection_policy_id,
        status=EXCLUDED.status,
        updated_at=EXCLUDED.updated_at`, [
      row.id,
      row.resourceBindingId || row.id,
      row.ownerTenantId || row.tenantId || row.userId || "",
      row.ownerUserId || row.userId || "",
      row.workspaceId || "",
      row.computeInstanceId || "",
      row.storageBucketId || "",
      row.rootPrefix || "",
      row.protectionPolicyId || "",
      row.status || "active",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeWeeklyProtectionFreezes({ client, pgTableName, db }) {
  for (const row of db.weeklyProtectionFreezes || []) {
    await client.query(`INSERT INTO ${pgTableName("weekly_protection_freezes")} (id,resource_binding_id,tenant_id,user_id,workspace_id,compute_instance_id,storage_bucket_id,usage_mode,window_start_at,window_end_at,weekly_amount,frozen_amount,consumed_amount,remaining_amount,reconcile_120_min_status,t_plus_1_audit_status,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (id) DO UPDATE SET
        resource_binding_id=EXCLUDED.resource_binding_id,
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        workspace_id=EXCLUDED.workspace_id,
        compute_instance_id=EXCLUDED.compute_instance_id,
        storage_bucket_id=EXCLUDED.storage_bucket_id,
        usage_mode=EXCLUDED.usage_mode,
        window_start_at=EXCLUDED.window_start_at,
        window_end_at=EXCLUDED.window_end_at,
        weekly_amount=EXCLUDED.weekly_amount,
        frozen_amount=EXCLUDED.frozen_amount,
        consumed_amount=EXCLUDED.consumed_amount,
        remaining_amount=EXCLUDED.remaining_amount,
        reconcile_120_min_status=EXCLUDED.reconcile_120_min_status,
        t_plus_1_audit_status=EXCLUDED.t_plus_1_audit_status,
        status=EXCLUDED.status,
        updated_at=EXCLUDED.updated_at`, [
      row.id,
      row.resourceBindingId || "",
      row.ownerTenantId || row.tenantId || row.userId || "",
      row.ownerUserId || row.userId || "",
      row.workspaceId || "",
      row.computeInstanceId || "",
      row.storageBucketId || "",
      row.usageMode || "full_runtime",
      row.windowStartAt || "",
      row.windowEndAt || "",
      Number(row.weeklyAmount || 0),
      Number(row.frozenAmount || 0),
      Number(row.consumedAmount || 0),
      Number(row.remainingAmount || 0),
      row.reconcile120MinStatus || "pending",
      row.tPlus1AuditStatus || "pending",
      row.status || "active",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeCloudOperations({ client, pgTableName, db }) {
  for (const row of db.cloudOperations || []) {
    await client.query(`INSERT INTO ${pgTableName("cloud_operations")} (id,operation_id,tenant_id,user_id,workspace_id,resource_binding_id,operation_type,status,runner_mode,real_cloud_calls,production_portal_connected,test_only,accepted_dry_run_id,dry_run_report_ref,execution_report_ref,requested_spec_json,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET
        operation_id=EXCLUDED.operation_id,
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        workspace_id=EXCLUDED.workspace_id,
        resource_binding_id=EXCLUDED.resource_binding_id,
        operation_type=EXCLUDED.operation_type,
        status=EXCLUDED.status,
        runner_mode=EXCLUDED.runner_mode,
        real_cloud_calls=EXCLUDED.real_cloud_calls,
        production_portal_connected=EXCLUDED.production_portal_connected,
        test_only=EXCLUDED.test_only,
        accepted_dry_run_id=EXCLUDED.accepted_dry_run_id,
        dry_run_report_ref=EXCLUDED.dry_run_report_ref,
        execution_report_ref=EXCLUDED.execution_report_ref,
        requested_spec_json=EXCLUDED.requested_spec_json,
        updated_at=EXCLUDED.updated_at`, [
      row.id || row.operationId,
      row.operationId || row.id || "",
      row.tenantId || row.userId || "",
      row.userId || "",
      row.workspaceId || "",
      row.resourceBindingId || "",
      row.operationType || "",
      row.status || "",
      row.runnerMode || "",
      Boolean(row.realCloudCalls),
      Boolean(row.productionPortalConnected),
      Boolean(row.testOnly),
      row.acceptedDryRunId || "",
      row.dryRunReportRef || "",
      row.executionReportRef || row.evidenceRef || "",
      JSON.stringify(row.requestedSpec || {}),
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeCloudOperationJobs({ client, pgTableName, db }) {
  for (const row of db.cloudOperationJobs || []) {
    await client.query(`INSERT INTO ${pgTableName("cloud_operation_jobs")} (id,operation_id,tenant_id,user_id,workspace_id,resource_binding_id,queue_mode,status,runner_mode,real_cloud_calls,dry_run_report_ref,execution_report_ref,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET
        operation_id=EXCLUDED.operation_id,
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        workspace_id=EXCLUDED.workspace_id,
        resource_binding_id=EXCLUDED.resource_binding_id,
        queue_mode=EXCLUDED.queue_mode,
        status=EXCLUDED.status,
        runner_mode=EXCLUDED.runner_mode,
        real_cloud_calls=EXCLUDED.real_cloud_calls,
        dry_run_report_ref=EXCLUDED.dry_run_report_ref,
        execution_report_ref=EXCLUDED.execution_report_ref,
        updated_at=EXCLUDED.updated_at`, [
      row.id,
      row.operationId || "",
      row.tenantId || row.userId || "",
      row.userId || "",
      row.workspaceId || "",
      row.resourceBindingId || "",
      row.queueMode || "inline_worker",
      row.status || "",
      row.runnerMode || "",
      Boolean(row.realCloudCalls),
      row.dryRunReportRef || "",
      row.executionReportRef || "",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeComputeAllocations({ client, pgTableName, db }) {
  for (const row of db.computeAllocations || []) {
    await client.query(`INSERT INTO ${pgTableName("compute_allocations")} (id,tenant_id,user_id,workspace_id,resource_binding_id,plan_id,compute_units,status,cluster_ref,namespace_ref,quota_json,workload_class,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        workspace_id=EXCLUDED.workspace_id,
        resource_binding_id=EXCLUDED.resource_binding_id,
        plan_id=EXCLUDED.plan_id,
        compute_units=EXCLUDED.compute_units,
        status=EXCLUDED.status,
        cluster_ref=EXCLUDED.cluster_ref,
        namespace_ref=EXCLUDED.namespace_ref,
        quota_json=EXCLUDED.quota_json,
        workload_class=EXCLUDED.workload_class,
        updated_at=EXCLUDED.updated_at`, [
      row.id,
      row.tenantId || row.userId || "",
      row.userId || "",
      row.workspaceId || "",
      row.resourceBindingId || "",
      row.planId || "",
      Number(row.computeUnits || 0),
      row.status || "",
      row.clusterRef || "",
      row.namespaceRef || "",
      JSON.stringify(row.quota || {}),
      row.workloadClass || "",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeFileSpaceEntitlements({ client, pgTableName, db }) {
  for (const row of db.fileSpaceEntitlements || []) {
    await client.query(`INSERT INTO ${pgTableName("file_space_entitlements")} (id,tenant_id,user_id,workspace_id,resource_binding_id,plan_id,capacity_gb,status,retention_protection_status,retention_cleanup_after_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        workspace_id=EXCLUDED.workspace_id,
        resource_binding_id=EXCLUDED.resource_binding_id,
        plan_id=EXCLUDED.plan_id,
        capacity_gb=EXCLUDED.capacity_gb,
        status=EXCLUDED.status,
        retention_protection_status=EXCLUDED.retention_protection_status,
        retention_cleanup_after_at=EXCLUDED.retention_cleanup_after_at,
        updated_at=EXCLUDED.updated_at`, [
      row.id,
      row.tenantId || row.userId || "",
      row.userId || "",
      row.workspaceId || "",
      row.resourceBindingId || "",
      row.planId || "",
      Number(row.capacityGb || 0),
      row.status || "",
      row.retentionProtectionStatus || "",
      row.retentionCleanupAfterAt || "",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeCloudResourceProjections({ client, pgTableName, db }) {
  for (const row of db.cloudResourceProjections || []) {
    await client.query(`INSERT INTO ${pgTableName("cloud_resource_projections")} (id,tenant_id,user_id,workspace_id,resource_binding_id,status,production_portal_connected,runner_mode,real_cloud_calls,last_operation_id,visible_summary_json,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        workspace_id=EXCLUDED.workspace_id,
        resource_binding_id=EXCLUDED.resource_binding_id,
        status=EXCLUDED.status,
        production_portal_connected=EXCLUDED.production_portal_connected,
        runner_mode=EXCLUDED.runner_mode,
        real_cloud_calls=EXCLUDED.real_cloud_calls,
        last_operation_id=EXCLUDED.last_operation_id,
        visible_summary_json=EXCLUDED.visible_summary_json,
        updated_at=EXCLUDED.updated_at`, [
      row.id,
      row.tenantId || row.userId || "",
      row.userId || "",
      row.workspaceId || "",
      row.resourceBindingId || "",
      row.status || "",
      Boolean(row.productionPortalConnected),
      row.runnerMode || "",
      Boolean(row.realCloudCalls),
      row.lastOperationId || "",
      JSON.stringify(row.visibleSummary || {}),
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeBillingReconciliations({ client, pgTableName, db }) {
  for (const row of db.billingReconciliations || []) {
    await client.query(`INSERT INTO ${pgTableName("billing_reconciliations")} (id,tenant_id,user_id,workspace_id,resource_binding_id,operation_id,status,status_label,source,billing_read_ref,audit_queue_ref,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        workspace_id=EXCLUDED.workspace_id,
        resource_binding_id=EXCLUDED.resource_binding_id,
        operation_id=EXCLUDED.operation_id,
        status=EXCLUDED.status,
        status_label=EXCLUDED.status_label,
        source=EXCLUDED.source,
        billing_read_ref=EXCLUDED.billing_read_ref,
        audit_queue_ref=EXCLUDED.audit_queue_ref,
        updated_at=EXCLUDED.updated_at`, [
      row.id,
      row.tenantId || row.userId || "",
      row.userId || "",
      row.workspaceId || "",
      row.resourceBindingId || "",
      row.operationId || "",
      row.status || "",
      row.statusLabel || "",
      row.source || "",
      row.billingReadRef || "",
      row.auditQueueRef || "",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function writeAuditEvents({ client, pgTableName, db }) {
  for (const row of db.auditEvents || []) {
    const eventType = row.type || row.action || "";
    const occurredAt = row.occurredAt || row.createdAt || new Date().toISOString();
    await client.query(`INSERT INTO ${pgTableName("audit_events")} (id,type,user_id,operator_id,workspace_id,run_id,detail_json,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        type=EXCLUDED.type,
        user_id=EXCLUDED.user_id,
        operator_id=EXCLUDED.operator_id,
        workspace_id=EXCLUDED.workspace_id,
        run_id=EXCLUDED.run_id,
        detail_json=EXCLUDED.detail_json,
        occurred_at=EXCLUDED.occurred_at`, [
      row.id,
      eventType,
      row.userId || "",
      row.operatorId || row.userId || "",
      row.workspaceId || "",
      row.runId || "",
      JSON.stringify(row),
      occurredAt,
    ]);
  }
}

export async function replaceWorkspaceFiles({ client, pgTableName, db }) {
  await client.query(`DELETE FROM ${pgTableName("workspace_files")}`);
  for (const row of db.workspaceFiles || []) {
    await client.query(`INSERT INTO ${pgTableName("workspace_files")} (id,tenant_id,user_id,workspace_id,run_id,opl_session_id,resource_binding_id,storage_mode,storage_root_prefix,kind,name,relative_path,storage_key,local_path,size_bytes,checksum,content_type,status,source,created_at,updated_at,deleted_at,retention_cleanup_after_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`, [
      row.id,
      row.tenantId || row.userId || "",
      row.userId || "",
      row.workspaceId || "",
      row.runId || "",
      row.oplSessionId || row.runId || "",
      row.resourceBindingId || "",
      row.storageMode || (row.oplSessionId ? "full_runtime" : "legacy"),
      row.storageRootPrefix || "",
      row.kind || "inputs",
      row.name || "",
      row.relativePath || "",
      row.storageKey || "",
      row.localPath || "",
      Number(row.sizeBytes || 0),
      row.checksum || "",
      row.contentType || "application/octet-stream",
      row.status || "active",
      row.source || "portal_upload",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || row.createdAt || new Date().toISOString(),
      row.deletedAt || null,
      row.retentionCleanupAfterAt || "",
    ]);
  }
}

export async function replaceUserSandboxes({ client, pgTableName, db }) {
  await client.query(`DELETE FROM ${pgTableName("user_sandboxes")}`);
  for (const row of db.userSandboxes || []) {
    await client.query(`INSERT INTO ${pgTableName("user_sandboxes")} (id,user_id,runtime_type,container_name,namespace,image_tag,status,last_workspace_id,last_run_id,last_error,last_active_at,updated_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
      row.id, row.userId, row.runtimeType || "", row.containerName || "", row.namespace || "", row.imageTag || "", row.status || "", row.lastWorkspaceId || "", row.lastRunId || "", row.lastError || "", row.lastActiveAt || new Date().toISOString(), row.updatedAt || new Date().toISOString(), row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function replaceGroups({ client, pgTableName, db }) {
  await client.query(`DELETE FROM ${pgTableName("groups")}`);
  for (const row of db.groups || []) {
    await client.query(`INSERT INTO ${pgTableName("groups")} (id,name,plan,status,balance_floor,max_workspaces,max_concurrent_runs,cpu_request,cpu_limit,memory_request,memory_limit,gpu_count,storage_request,storage_limit,allow_mas,allow_workspace_create,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [
      row.id, row.name, row.plan || "", row.status || "active", Number(row.balanceFloor || 0), Number(row.maxWorkspaces || 0), Number(row.maxConcurrentRuns || 0), row.cpuRequest || "", row.cpuLimit || "", row.memoryRequest || "", row.memoryLimit || "", Number(row.gpuCount || 0), row.storageRequest || "", row.storageLimit || "", row.allowMas !== false, row.allowWorkspaceCreate !== false, row.createdAt || new Date().toISOString(),
    ]);
  }
}

export async function replacePortalSettings({ client, pgTableName, db }) {
  await client.query(`DELETE FROM ${pgTableName("portal_settings")}`);
  for (const [key, value] of Object.entries(db.settings || {})) {
    await client.query(`INSERT INTO ${pgTableName("portal_settings")} (key,value_json) VALUES ($1,$2)`, [key, JSON.stringify(value)]);
  }
}
