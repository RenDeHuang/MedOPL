function normalizeMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    throw new Error("portal_accounting_invalid_amount");
  }
  return Math.round(amount * 100) / 100;
}

function nonEmptyString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeLedgerContext(input = {}) {
  const userId = nonEmptyString(input.userId, input.user_id);
  return {
    userId,
    tenantId: nonEmptyString(input.tenantId, input.tenant_id, userId),
    runId: nonEmptyString(input.runId, input.run_id),
    workspaceId: nonEmptyString(input.workspaceId, input.workspace_id),
    resourceBindingId: nonEmptyString(input.resourceBindingId, input.resource_binding_id),
    sourceId: nonEmptyString(input.sourceId, input.source_id, input.resourceBindingId, input.runId),
    currency: nonEmptyString(input.currency, "CNY") || "CNY",
  };
}

export function createPortalAccountingStore({
  pool,
  pgTableName,
  randomUUID,
}) {
  async function applyWalletLedgerAuditTransaction({
    userId,
    tenantId,
    workspaceId = "",
    runId = "",
    resourceBindingId = "",
    amount,
    operatorId,
    idempotencyKey,
    reason,
    ledgerType,
    sourceType,
    sourceId = "",
    auditType,
    direction,
    currency = "CNY",
    auditDetails = {},
  }) {
    const normalizedAmount = normalizeMoney(amount);
    if (!userId || !operatorId || !idempotencyKey || normalizedAmount <= 0 || !ledgerType || !sourceType || !auditType) {
      throw new Error("portal_accounting_invalid_transaction_request");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        `SELECT id FROM ${pgTableName("ledger_entries")} WHERE idempotency_key = $1 LIMIT 1`,
        [idempotencyKey],
      );
      if (existing.rows.length) {
        await client.query("ROLLBACK");
        return {
          ok: true,
          idempotent: true,
          ledgerId: String(existing.rows[0].id || ""),
        };
      }

      const walletSql = direction === "debit"
        ? `UPDATE ${pgTableName("wallets")}
          SET balance = balance - $1,
              updated_at = NOW()
          WHERE user_id = $2
          RETURNING balance`
        : `UPDATE ${pgTableName("wallets")}
          SET balance = balance + $1,
              updated_at = NOW()
          WHERE user_id = $2
          RETURNING balance`;
      const walletUpdate = await client.query(
        walletSql,
        [normalizedAmount, userId],
      );
      if (!walletUpdate.rowCount) {
        throw new Error(`portal_wallet_not_found:${userId}`);
      }

      const ledgerId = randomUUID();
      await client.query(
        `INSERT INTO ${pgTableName("ledger_entries")} (
          id, tenant_id, user_id, run_id, workspace_id, resource_binding_id, type, amount, currency, source_type, source_id, idempotency_key, reason, operator_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
        [
          ledgerId,
          tenantId,
          userId,
          runId,
          workspaceId,
          resourceBindingId,
          ledgerType,
          normalizedAmount,
          currency,
          sourceType,
          sourceId,
          idempotencyKey,
          reason,
          operatorId,
        ],
      );

      const auditEventId = randomUUID();
      await client.query(
        `INSERT INTO ${pgTableName("audit_events")} (
          id, type, user_id, operator_id, workspace_id, run_id, detail_json, occurred_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          auditEventId,
          auditType,
          userId,
          operatorId,
          workspaceId,
          runId,
          JSON.stringify({
            amount: normalizedAmount,
            ledgerId,
            idempotencyKey,
            reason,
            sourceType,
            sourceId,
            resourceBindingId,
            ...auditDetails,
          }),
        ],
      );
      await client.query("COMMIT");
      return {
        ok: true,
        idempotent: false,
        ledgerId,
        auditEventId,
        balance: Number(walletUpdate.rows[0]?.balance || 0),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function topupWallet(input = {}) {
    const context = normalizeLedgerContext(input);
    return applyWalletLedgerAuditTransaction({
      ...context,
      amount: input.amount,
      operatorId: input.operatorId,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason || "admin_recharge",
      ledgerType: "topup",
      sourceType: "admin_topup",
      sourceId: context.sourceId || input.operatorId || "admin_topup",
      auditType: "wallet_topped_up",
      direction: "credit",
      auditDetails: { operatorId: input.operatorId },
    });
  }

  async function chargeWallet(input = {}) {
    const context = normalizeLedgerContext(input);
    return applyWalletLedgerAuditTransaction({
      ...context,
      amount: input.amount,
      operatorId: input.operatorId || "billing-aggregator",
      idempotencyKey: input.idempotencyKey,
      reason: input.reason || "wallet_charge",
      ledgerType: input.ledgerType || "exact_resource_charge",
      sourceType: input.sourceType || "billing_charge",
      sourceId: context.sourceId || "billing_charge",
      auditType: input.auditType || "wallet_charged",
      direction: "debit",
      auditDetails: input.auditDetails || {},
    });
  }

  async function refundWallet(input = {}) {
    const context = normalizeLedgerContext(input);
    return applyWalletLedgerAuditTransaction({
      ...context,
      amount: input.amount,
      operatorId: input.operatorId || "billing-aggregator",
      idempotencyKey: input.idempotencyKey,
      reason: input.reason || "wallet_refund",
      ledgerType: "refund",
      sourceType: input.sourceType || "auto_reconcile",
      sourceId: context.sourceId || "refund",
      auditType: input.auditType || "wallet_refunded",
      direction: "credit",
      auditDetails: input.auditDetails || {},
    });
  }

  async function makeupChargeWallet(input = {}) {
    const context = normalizeLedgerContext(input);
    return applyWalletLedgerAuditTransaction({
      ...context,
      amount: input.amount,
      operatorId: input.operatorId || "billing-aggregator",
      idempotencyKey: input.idempotencyKey,
      reason: input.reason || "wallet_makeup_charge",
      ledgerType: "makeup_charge",
      sourceType: input.sourceType || "auto_reconcile",
      sourceId: context.sourceId || "makeup_charge",
      auditType: input.auditType || "wallet_makeup_charged",
      direction: "debit",
      auditDetails: input.auditDetails || {},
    });
  }

  async function scanOrphanAccountingAudit({ limit = 200 } = {}) {
    const normalizedLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
    const result = await pool.query(
      `SELECT
        ae.id AS audit_event_id,
        ae.type AS audit_type,
        ae.user_id,
        ae.operator_id,
        ae.occurred_at,
        ae.detail_json,
        ae.detail_json->>'ledgerId' AS ledger_id
      FROM ${pgTableName("audit_events")} ae
      LEFT JOIN ${pgTableName("ledger_entries")} le
        ON le.id = ae.detail_json->>'ledgerId'
      WHERE ae.detail_json ? 'ledgerId'
        AND COALESCE(ae.detail_json->>'ledgerId', '') <> ''
        AND le.id IS NULL
      ORDER BY ae.occurred_at DESC
      LIMIT $1`,
      [normalizedLimit],
    );
    const items = result.rows.map((row) => ({
      auditEventId: String(row.audit_event_id || ""),
      auditType: String(row.audit_type || ""),
      userId: String(row.user_id || ""),
      operatorId: String(row.operator_id || ""),
      occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at || ""),
      ledgerId: String(row.ledger_id || row.detail_json?.ledgerId || ""),
      detail: row.detail_json && typeof row.detail_json === "object" ? row.detail_json : {},
    }));
    return {
      count: items.length,
      items,
    };
  }

  return {
    chargeWallet,
    makeupChargeWallet,
    refundWallet,
    scanOrphanAccountingAudit,
    topupWallet,
  };
}
