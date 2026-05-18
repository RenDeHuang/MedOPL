function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapLabSubscription(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    packageId: row.package_id,
    status: row.status,
    computeTier: row.compute_tier,
    includedStorageGb: Number(row.included_storage_gb || 0),
    dailyPrice: Number(row.daily_price || 0),
    weeklyFreezeAmount: Number(row.weekly_freeze_amount || 0),
    currentFreezeId: row.current_freeze_id || "",
    graceStartedAt: row.grace_started_at || "",
    cleanupAfterAt: row.cleanup_after_at || "",
    backingServerPlanId: row.backing_server_plan_id || "",
    idempotencyKey: row.idempotency_key || "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapLabPackageEvent(row) {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    eventType: row.event_type,
    eventPayload: row.event_payload_json || {},
    actorType: row.actor_type,
    actorId: row.actor_id,
    idempotencyKey: row.idempotency_key || "",
    createdAt: toIso(row.created_at),
  };
}

function mapLabStorageAddon(row) {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    storageGb: Number(row.storage_gb || 0),
    dailyPrice: Number(row.daily_price || 0),
    status: row.status,
    idempotencyKey: row.idempotency_key || "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapLabDailyCharge(row) {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    chargeDate: row.charge_date,
    amount: Number(row.amount || 0),
    ledgerEntryId: row.ledger_entry_id || "",
    idempotencyKey: row.idempotency_key || "",
    createdAt: toIso(row.created_at),
  };
}

export async function readPortalPostgresLabSnapshot({ pool, pgTableName }) {
  const [subscriptionsRes, eventsRes, addonsRes, chargesRes] = await Promise.all([
    pool.query(`SELECT * FROM ${pgTableName("lab_subscriptions")}`),
    pool.query(`SELECT * FROM ${pgTableName("lab_package_events")}`),
    pool.query(`SELECT * FROM ${pgTableName("lab_storage_addons")}`),
    pool.query(`SELECT * FROM ${pgTableName("lab_daily_charges")}`),
  ]);
  return {
    labSubscriptions: subscriptionsRes.rows.map(mapLabSubscription),
    labPackageEvents: eventsRes.rows.map(mapLabPackageEvent),
    labStorageAddons: addonsRes.rows.map(mapLabStorageAddon),
    labDailyCharges: chargesRes.rows.map(mapLabDailyCharge),
  };
}

async function replaceRows(client, tableName, rows, insertSql, valuesForRow) {
  await client.query(`DELETE FROM ${tableName}`);
  for (const row of rows || []) {
    await client.query(insertSql, valuesForRow(row));
  }
}

export async function writePortalPostgresLabSnapshot({ client, pgTableName, db }) {
  await writeLabSubscriptions(client, pgTableName, db.labSubscriptions);
  await writeLabPackageEvents(client, pgTableName, db.labPackageEvents);
  await writeLabStorageAddons(client, pgTableName, db.labStorageAddons);
  await writeLabDailyCharges(client, pgTableName, db.labDailyCharges);
}

async function writeLabSubscriptions(client, pgTableName, rows) {
  await replaceRows(
    client,
    pgTableName("lab_subscriptions"),
    rows,
    `INSERT INTO ${pgTableName("lab_subscriptions")} (id,tenant_id,user_id,workspace_id,package_id,status,compute_tier,included_storage_gb,daily_price,weekly_freeze_amount,current_freeze_id,grace_started_at,cleanup_after_at,backing_server_plan_id,idempotency_key,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    labSubscriptionValues,
  );
}

function labSubscriptionValues(row) {
  return [
    row.id,
    row.tenantId || row.userId || "",
    row.userId || "",
    row.workspaceId || "",
    row.packageId || "",
    row.status || "active",
    row.computeTier || "",
    Number(row.includedStorageGb || 0),
    Number(row.dailyPrice || 0),
    Number(row.weeklyFreezeAmount || 0),
    row.currentFreezeId || "",
    row.graceStartedAt || "",
    row.cleanupAfterAt || "",
    row.backingServerPlanId || "",
    row.idempotencyKey || "",
    row.createdAt || new Date().toISOString(),
    row.updatedAt || row.createdAt || new Date().toISOString(),
  ];
}

async function writeLabPackageEvents(client, pgTableName, rows) {
  await replaceRows(
    client,
    pgTableName("lab_package_events"),
    rows,
    `INSERT INTO ${pgTableName("lab_package_events")} (id,subscription_id,event_type,event_payload_json,actor_type,actor_id,idempotency_key,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    labPackageEventValues,
  );
}

function labPackageEventValues(row) {
  return [
    row.id,
    row.subscriptionId || "",
    row.eventType || "",
    JSON.stringify(row.eventPayload || {}),
    row.actorType || "system",
    row.actorId || "",
    row.idempotencyKey || "",
    row.createdAt || new Date().toISOString(),
  ];
}

async function writeLabStorageAddons(client, pgTableName, rows) {
  await replaceRows(
    client,
    pgTableName("lab_storage_addons"),
    rows,
    `INSERT INTO ${pgTableName("lab_storage_addons")} (id,subscription_id,storage_gb,daily_price,status,idempotency_key,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    labStorageAddonValues,
  );
}

function labStorageAddonValues(row) {
  return [
    row.id,
    row.subscriptionId || "",
    Number(row.storageGb || 0),
    Number(row.dailyPrice || 0),
    row.status || "active",
    row.idempotencyKey || "",
    row.createdAt || new Date().toISOString(),
    row.updatedAt || row.createdAt || new Date().toISOString(),
  ];
}

async function writeLabDailyCharges(client, pgTableName, rows) {
  await replaceRows(
    client,
    pgTableName("lab_daily_charges"),
    rows,
    `INSERT INTO ${pgTableName("lab_daily_charges")} (id,subscription_id,charge_date,amount,ledger_entry_id,idempotency_key,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    labDailyChargeValues,
  );
}

function labDailyChargeValues(row) {
  return [
    row.id,
    row.subscriptionId || "",
    row.chargeDate || "",
    Number(row.amount || 0),
    row.ledgerEntryId || "",
    row.idempotencyKey || "",
    row.createdAt || new Date().toISOString(),
  ];
}
