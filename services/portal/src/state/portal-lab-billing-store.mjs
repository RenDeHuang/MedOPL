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

async function findExistingId(queryable, pgTableName, table, idempotencyKey) {
  if (!idempotencyKey) return "";
  const existing = await queryable.query(
    `SELECT id FROM ${pgTableName(table)} WHERE idempotency_key = $1 LIMIT 1`,
    [idempotencyKey],
  );
  return String(existing.rows[0]?.id || "");
}

function sameTargetId(existingId, targetId) {
  return !existingId || existingId === String(targetId || "");
}

function textValue(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function subscriptionTenantId(subscription) {
  return textValue(subscription.tenantId, subscription.userId);
}

function subscriptionValues(subscription, { createdAt, updatedAt, idempotencyKey }) {
  return [
    textValue(subscription.id),
    subscriptionTenantId(subscription),
    textValue(subscription.userId),
    textValue(subscription.workspaceId),
    textValue(subscription.packageId),
    textValue(subscription.status, "active"),
    textValue(subscription.computeTier),
    normalizeNumber(subscription.includedStorageGb, 0),
    normalizeNumber(subscription.dailyPrice, 0),
    normalizeNumber(subscription.weeklyFreezeAmount, 0),
    textValue(subscription.currentFreezeId),
    textValue(subscription.graceStartedAt),
    textValue(subscription.cleanupAfterAt),
    textValue(subscription.backingServerPlanId),
    idempotencyKey,
    createdAt,
    updatedAt,
  ];
}

function packageEventValues(event, idempotencyKey) {
  return [
    textValue(event.id),
    textValue(event.subscriptionId),
    textValue(event.eventType, event.type),
    JSON.stringify(event.eventPayload ?? event.detail ?? {}),
    textValue(event.actorType, "system"),
    textValue(event.actorId),
    idempotencyKey,
    isoTime(event.createdAt),
  ];
}

function storageAddonValues(addon, { createdAt, updatedAt, idempotencyKey }) {
  return [
    textValue(addon.id),
    textValue(addon.subscriptionId),
    normalizeNumber(addon.storageGb, 0),
    normalizeNumber(addon.dailyPrice, 0),
    textValue(addon.status, "active"),
    idempotencyKey,
    createdAt,
    updatedAt,
  ];
}

function dailyChargeValues(charge, idempotencyKey) {
  return [
    textValue(charge.id),
    textValue(charge.subscriptionId),
    textValue(charge.chargeDate),
    normalizeNumber(charge.amount, 0),
    textValue(charge.ledgerEntryId),
    idempotencyKey,
    isoTime(charge.createdAt),
  ];
}

async function upsertLabSubscriptionWith({ queryable, pgTableName, subscription }) {
  const idempotencyKey = String(subscription.idempotencyKey || "").trim();
  const existingId = await findExistingId(queryable, pgTableName, "lab_subscriptions", idempotencyKey);
  if (!sameTargetId(existingId, subscription.id)) {
    return { ok: true, idempotent: true, id: existingId };
  }
  const createdAt = isoTime(subscription.createdAt);
  const updatedAt = isoTime(subscription.updatedAt || createdAt);
  await queryable.query(
    `INSERT INTO ${pgTableName("lab_subscriptions")} (
      id,tenant_id,user_id,workspace_id,package_id,status,compute_tier,included_storage_gb,daily_price,weekly_freeze_amount,current_freeze_id,grace_started_at,cleanup_after_at,backing_server_plan_id,idempotency_key,created_at,updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
    )
    ON CONFLICT (id) DO UPDATE SET
      tenant_id=EXCLUDED.tenant_id,
      user_id=EXCLUDED.user_id,
      workspace_id=EXCLUDED.workspace_id,
      package_id=EXCLUDED.package_id,
      status=EXCLUDED.status,
      compute_tier=EXCLUDED.compute_tier,
      included_storage_gb=EXCLUDED.included_storage_gb,
      daily_price=EXCLUDED.daily_price,
      weekly_freeze_amount=EXCLUDED.weekly_freeze_amount,
      current_freeze_id=EXCLUDED.current_freeze_id,
      grace_started_at=EXCLUDED.grace_started_at,
      cleanup_after_at=EXCLUDED.cleanup_after_at,
      backing_server_plan_id=EXCLUDED.backing_server_plan_id,
      idempotency_key=EXCLUDED.idempotency_key,
      updated_at=EXCLUDED.updated_at`,
    subscriptionValues(subscription, { createdAt, updatedAt, idempotencyKey }),
  );
  return { ok: true, idempotent: false, id: String(subscription.id || "") };
}

async function appendLabPackageEventWith({ queryable, pgTableName, event }) {
  const idempotencyKey = String(event.idempotencyKey || "").trim();
  const existingId = await findExistingId(queryable, pgTableName, "lab_package_events", idempotencyKey);
  if (existingId) return { ok: true, idempotent: true, id: existingId };
  await queryable.query(
    `INSERT INTO ${pgTableName("lab_package_events")} (
      id,subscription_id,event_type,event_payload_json,actor_type,actor_id,idempotency_key,created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8
    )
    ON CONFLICT (id) DO UPDATE SET
      subscription_id=EXCLUDED.subscription_id,
      event_type=EXCLUDED.event_type,
      event_payload_json=EXCLUDED.event_payload_json,
      actor_type=EXCLUDED.actor_type,
      actor_id=EXCLUDED.actor_id,
      idempotency_key=EXCLUDED.idempotency_key,
      created_at=EXCLUDED.created_at`,
    packageEventValues(event, idempotencyKey),
  );
  return { ok: true, idempotent: false, id: String(event.id || "") };
}

async function upsertLabStorageAddonWith({ queryable, pgTableName, addon }) {
  const idempotencyKey = String(addon.idempotencyKey || "").trim();
  const existingId = await findExistingId(queryable, pgTableName, "lab_storage_addons", idempotencyKey);
  if (!sameTargetId(existingId, addon.id)) {
    return { ok: true, idempotent: true, id: existingId };
  }
  const createdAt = isoTime(addon.createdAt);
  const updatedAt = isoTime(addon.updatedAt || createdAt);
  await queryable.query(
    `INSERT INTO ${pgTableName("lab_storage_addons")} (
      id,subscription_id,storage_gb,daily_price,status,idempotency_key,created_at,updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8
    )
    ON CONFLICT (id) DO UPDATE SET
      storage_gb=EXCLUDED.storage_gb,
      daily_price=EXCLUDED.daily_price,
      status=EXCLUDED.status,
      idempotency_key=EXCLUDED.idempotency_key,
      updated_at=EXCLUDED.updated_at`,
    storageAddonValues(addon, { createdAt, updatedAt, idempotencyKey }),
  );
  return { ok: true, idempotent: false, id: String(addon.id || "") };
}

async function appendLabDailyChargeWith({ queryable, pgTableName, charge }) {
  const idempotencyKey = String(charge.idempotencyKey || "").trim();
  const existingId = await findExistingId(queryable, pgTableName, "lab_daily_charges", idempotencyKey);
  if (!sameTargetId(existingId, charge.id)) {
    return { ok: true, idempotent: true, id: existingId };
  }
  await queryable.query(
    `INSERT INTO ${pgTableName("lab_daily_charges")} (
      id,subscription_id,charge_date,amount,ledger_entry_id,idempotency_key,created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7
    )
    ON CONFLICT (id) DO UPDATE SET
      amount=EXCLUDED.amount,
      ledger_entry_id=EXCLUDED.ledger_entry_id,
      idempotency_key=EXCLUDED.idempotency_key`,
    dailyChargeValues(charge, idempotencyKey),
  );
  return { ok: true, idempotent: false, id: String(charge.id || "") };
}

function targetSubscriptionIdFrom({ subscription, subscriptionId, addon, charge }) {
  return String(subscription?.id || subscriptionId || addon?.subscriptionId || charge?.subscriptionId || "").trim();
}

function subscriptionFromState(db, subscription, targetSubscriptionId) {
  if (subscription) return subscription;
  return (db.labSubscriptions || []).find((item) => item.id === targetSubscriptionId);
}

function labItemsForSubscription(items, targetSubscriptionId, explicitItem = null) {
  if (explicitItem) return [explicitItem];
  return (items || []).filter((item) => String(item.subscriptionId || item.subscription_id || "") === targetSubscriptionId);
}

async function persistLabBillingTransaction({ client, pgTableName, subscription, events, addons, charges }) {
  await upsertLabSubscriptionWith({ queryable: client, pgTableName, subscription });
  for (const event of events) {
    await appendLabPackageEventWith({ queryable: client, pgTableName, event });
  }
  for (const addon of addons) {
    await upsertLabStorageAddonWith({ queryable: client, pgTableName, addon });
  }
  for (const charge of charges) {
    await appendLabDailyChargeWith({ queryable: client, pgTableName, charge });
  }
}

function labBillingStatePayload({ db, subscription, subscriptionId, addon, charge }) {
  const targetSubscriptionId = targetSubscriptionIdFrom({ subscription, subscriptionId, addon, charge });
  const targetSubscription = subscriptionFromState(db, subscription, targetSubscriptionId);
  return {
    targetSubscriptionId,
    targetSubscription,
    events: labItemsForSubscription(db.labPackageEvents, targetSubscriptionId),
    addons: labItemsForSubscription(db.labStorageAddons, targetSubscriptionId, addon),
    charges: labItemsForSubscription(db.labDailyCharges, targetSubscriptionId, charge),
  };
}

function labBillingStateResult(targetSubscriptionId, { events, addons, charges }) {
  return {
    ok: true,
    subscriptionId: targetSubscriptionId,
    eventCount: events.length,
    addonCount: addons.length,
    chargeCount: charges.length,
  };
}

export function createPortalLabBillingStore({ pool, pgTableName }) {
  async function upsertLabSubscription(subscription) {
    return upsertLabSubscriptionWith({ queryable: pool, pgTableName, subscription });
  }

  async function appendLabPackageEvent(event) {
    return appendLabPackageEventWith({ queryable: pool, pgTableName, event });
  }

  async function upsertLabStorageAddon(addon) {
    return upsertLabStorageAddonWith({ queryable: pool, pgTableName, addon });
  }

  async function appendLabDailyCharge(charge) {
    return appendLabDailyChargeWith({ queryable: pool, pgTableName, charge });
  }

  async function persistLabBillingState({ db = {}, subscription, subscriptionId = "", addon = null, charge = null } = {}) {
    const payload = labBillingStatePayload({ db, subscription, subscriptionId, addon, charge });
    if (!payload.targetSubscriptionId) {
      throw new Error("portal_lab_billing_state_requires_subscription_id");
    }
    if (!payload.targetSubscription) {
      throw new Error(`portal_lab_subscription_not_found:${payload.targetSubscriptionId}`);
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await persistLabBillingTransaction({
        client,
        pgTableName,
        subscription: payload.targetSubscription,
        events: payload.events,
        addons: payload.addons,
        charges: payload.charges,
      });
      await client.query("COMMIT");
      return labBillingStateResult(payload.targetSubscriptionId, payload);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    appendLabDailyCharge,
    appendLabPackageEvent,
    persistLabBillingState,
    upsertLabStorageAddon,
    upsertLabSubscription,
  };
}
