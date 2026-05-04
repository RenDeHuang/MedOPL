function isoTime(value) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function firstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeCloudResourceIds(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

export function createPortalResourceOrderStore({ pool, pgTableName }) {
  async function upsertResourceOrder(order) {
    return upsertResourceOrderWith(pool, order);
  }

  async function upsertResourceOrderWith(queryable, order) {
    const idempotencyKey = String(order.idempotencyKey || "").trim();
    const existing = await findExistingByIdempotencyKey(queryable, "resource_orders", idempotencyKey);
    if (existing && existing.id !== String(order.id || "")) {
      return { ok: true, idempotent: true, id: existing.id };
    }
    const createdAt = isoTime(order.createdAt);
    const updatedAt = isoTime(order.updatedAt || createdAt);
    await queryable.query(
      `INSERT INTO ${pgTableName("resource_orders")} (
        id,tenant_id,user_id,portal_user_id,workspace_id,workspace_session_id,run_id,status,server_plan_id,region,zone,cpu,memory_gb,gpu_type,gpu_count,storage_plan_id,storage_size_gb,retention_policy,estimated_hours,auto_stop_at,quote_id,freeze_id,provision_request_id,cloud_resource_ids_json,currency,unit_price,min_billable_hours,risk_factor,quote_amount,freeze_amount,exact_cost,pricing_source,price_updated_at,idempotency_key,failed_reason,created_at,updated_at,settled_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38
      )
      ON CONFLICT (id) DO UPDATE SET
        status=EXCLUDED.status,
        workspace_session_id=EXCLUDED.workspace_session_id,
        run_id=EXCLUDED.run_id,
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
        settled_at=EXCLUDED.settled_at`,
      resourceOrderValues(order, { createdAt, idempotencyKey, updatedAt }),
    );
    return { ok: true, idempotent: false, id: String(order.id || "") };
  }

  async function findExistingByIdempotencyKey(queryable, table, idempotencyKey) {
    if (!idempotencyKey) return null;
    const existing = await queryable.query(
      `SELECT id FROM ${pgTableName(table)} WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    );
    return existing.rows.length ? { id: String(existing.rows[0]?.id || "") } : null;
  }

  function resourceOrderValues(order, { createdAt, idempotencyKey, updatedAt }) {
    return [
      String(order.id || ""),
      String(order.tenantId || ""),
      String(order.userId || ""),
      firstString(order.portalUserId, order.userId),
      String(order.workspaceId || ""),
      String(order.workspaceSessionId || ""),
      String(order.runId || ""),
      String(order.status || "pending"),
      String(order.serverPlanId || ""),
      String(order.region || ""),
      String(order.zone || ""),
      normalizeNumber(order.cpu, 0),
      normalizeNumber(order.memoryGb, 0),
      String(order.gpuType || ""),
      normalizeNumber(order.gpuCount, 0),
      String(order.storagePlanId || ""),
      normalizeNumber(order.storageSizeGb, 0),
      String(order.retentionPolicy || ""),
      normalizeNumber(order.estimatedHours, 0),
      String(order.autoStopAt || ""),
      String(order.quoteId || ""),
      String(order.freezeId || ""),
      String(order.provisionRequestId || ""),
      normalizeCloudResourceIds(order.cloudResourceIds),
      String(order.currency || "CNY"),
      normalizeNumber(order.unitPrice, 0),
      normalizeNumber(order.minBillableHours, 0),
      normalizeNumber(order.riskFactor, 1),
      normalizeNumber(order.quoteAmount, 0),
      normalizeNumber(order.freezeAmount, 0),
      normalizeNumber(order.exactCost, 0),
      String(order.pricingSource || ""),
      String(order.priceUpdatedAt || ""),
      idempotencyKey,
      String(order.failedReason || ""),
      createdAt,
      updatedAt,
      order.settledAt ? isoTime(order.settledAt) : null,
    ];
  }

  async function appendResourceOrderEvent(event) {
    return appendResourceOrderEventWith(pool, event);
  }

  async function appendResourceOrderEventWith(queryable, event) {
    const idempotencyKey = String(event.idempotencyKey || "").trim();
    const existing = await findExistingByIdempotencyKey(queryable, "resource_order_events", idempotencyKey);
    if (existing) {
      return { ok: true, idempotent: true, id: existing.id };
    }
    await queryable.query(
      `INSERT INTO ${pgTableName("resource_order_events")} (
        id,order_id,event_type,event_payload_json,actor_type,actor_id,idempotency_key,created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      ON CONFLICT (id) DO UPDATE SET
        order_id=EXCLUDED.order_id,
        event_type=EXCLUDED.event_type,
        event_payload_json=EXCLUDED.event_payload_json,
        actor_type=EXCLUDED.actor_type,
        actor_id=EXCLUDED.actor_id,
        idempotency_key=EXCLUDED.idempotency_key,
        created_at=EXCLUDED.created_at`,
      [
        String(event.id || ""),
        String(event.orderId || ""),
        String(event.eventType || event.status || ""),
        JSON.stringify(event.eventPayload || event.payload || {}),
        String(event.actorType || ""),
        String(event.actorId || ""),
        idempotencyKey,
        isoTime(event.createdAt),
      ],
    );
    return { ok: true, idempotent: false, id: String(event.id || "") };
  }

  async function upsertLedgerEntryWith(queryable, entry) {
    const idempotencyKey = String(entry.idempotencyKey || entry.idempotency_key || "").trim();
    const existing = await findExistingByIdempotencyKey(queryable, "ledger_entries", idempotencyKey);
    if (existing) {
      return { ok: true, idempotent: true, id: existing.id };
    }
    await queryable.query(
      `INSERT INTO ${pgTableName("ledger_entries")} (
        id,tenant_id,user_id,run_id,workspace_id,order_id,type,amount,currency,source_type,source_id,idempotency_key,reason,operator_id,created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id=EXCLUDED.tenant_id,
        user_id=EXCLUDED.user_id,
        run_id=EXCLUDED.run_id,
        workspace_id=EXCLUDED.workspace_id,
        order_id=EXCLUDED.order_id,
        type=EXCLUDED.type,
        amount=EXCLUDED.amount,
        currency=EXCLUDED.currency,
        source_type=EXCLUDED.source_type,
        source_id=EXCLUDED.source_id,
        idempotency_key=EXCLUDED.idempotency_key,
        reason=EXCLUDED.reason,
        operator_id=EXCLUDED.operator_id,
        created_at=EXCLUDED.created_at`,
      ledgerEntryValues(entry, idempotencyKey),
    );
    return { ok: true, idempotent: false, id: String(entry.id || "") };
  }

  function ledgerEntryValues(entry, idempotencyKey) {
    return [
      String(entry.id || ""),
      firstString(entry.tenantId, entry.tenant_id, entry.userId, entry.user_id),
      firstString(entry.userId, entry.user_id, entry.tenantId, entry.tenant_id),
      firstString(entry.runId, entry.run_id),
      firstString(entry.workspaceId, entry.workspace_id),
      firstString(entry.orderId, entry.resourceOrderId, entry.order_id, entry.resource_order_id),
      String(entry.type || ""),
      normalizeNumber(entry.amount, 0),
      String(entry.currency || "CNY"),
      firstString(entry.sourceType, entry.source_type),
      firstString(entry.sourceId, entry.source_id),
      idempotencyKey,
      String(entry.reason || ""),
      firstString(entry.operatorId, entry.operator_id),
      isoTime(entry.createdAt || entry.created_at),
    ];
  }

  async function persistResourceOrderState({ db = {}, order, orderId = "" } = {}) {
    const targetOrderId = String(order?.id || orderId || "").trim();
    if (!targetOrderId) {
      throw new Error("portal_resource_order_state_requires_order_id");
    }
    const targetOrder = order || (db.resourceOrders || []).find((item) => item.id === targetOrderId);
    if (!targetOrder) {
      throw new Error(`portal_resource_order_not_found:${targetOrderId}`);
    }
    const events = (db.resourceOrderEvents || []).filter((event) => String(event.orderId || event.order_id || "") === targetOrderId);
    const ledgerEntries = (db.ledger || []).filter((entry) =>
      String(entry.resourceOrderId || entry.resource_order_id || entry.orderId || entry.order_id || "") === targetOrderId
    );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await upsertResourceOrderWith(client, targetOrder);
      for (const entry of ledgerEntries) {
        await upsertLedgerEntryWith(client, entry);
      }
      for (const event of events) {
        await appendResourceOrderEventWith(client, event);
      }
      await client.query("COMMIT");
      return {
        ok: true,
        resourceOrderId: targetOrderId,
        eventCount: events.length,
        ledgerEntryCount: ledgerEntries.length,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    appendResourceOrderEvent,
    persistResourceOrderState,
    upsertResourceOrder,
  };
}
