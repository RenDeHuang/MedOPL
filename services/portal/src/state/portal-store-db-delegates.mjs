export function createPortalStoreDbDelegates({
  appendLedgerEntry,
  ensureStorageInfra,
  ensureWallet,
  getAccountingStore,
  getLabBillingStore,
  getWorkspaceStore,
  mutateJsonDb,
  randomUUID,
  storageMode,
}) {
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

  async function applyJsonWalletLedgerTransaction({
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
    direction,
    currency = "CNY",
  }) {
    const normalizedAmount = normalizeMoney(amount);
    const targetUserId = nonEmptyString(userId);
    const actorId = nonEmptyString(operatorId);
    const key = nonEmptyString(idempotencyKey);
    if (!targetUserId || !actorId || !key || normalizedAmount <= 0 || !ledgerType || !sourceType) {
      throw new Error("portal_accounting_invalid_transaction_request");
    }

    return mutateJsonDb(async (db) => {
      db.ledger = Array.isArray(db.ledger) ? db.ledger : [];
      const existing = db.ledger.find((entry) => String(entry.idempotencyKey || entry.idempotency_key || "").trim() === key);
      if (existing) {
        const wallet = ensureWallet(db, targetUserId);
        return {
          ok: true,
          idempotent: true,
          ledgerId: String(existing.id || ""),
          balance: Number(wallet.balance || 0),
        };
      }

      const wallet = ensureWallet(db, targetUserId);
      const signedAmount = direction === "debit" ? -normalizedAmount : normalizedAmount;
      wallet.balance = normalizeMoney(Number(wallet.balance || 0) + signedAmount);
      wallet.updatedAt = new Date().toISOString();
      const ledger = appendLedgerEntry(db, {
        id: randomUUID(),
        tenantId: nonEmptyString(tenantId, targetUserId),
        userId: targetUserId,
        workspaceId: nonEmptyString(workspaceId),
        runId: nonEmptyString(runId),
        resourceBindingId: nonEmptyString(resourceBindingId),
        type: ledgerType,
        amount: normalizedAmount,
        currency: nonEmptyString(currency, "CNY") || "CNY",
        sourceType,
        sourceId: nonEmptyString(sourceId, resourceBindingId, runId, actorId, sourceType),
        idempotencyKey: key,
        reason: nonEmptyString(reason),
        operatorId: actorId,
        createdAt: new Date().toISOString(),
      });
      return {
        ok: true,
        idempotent: false,
        ledgerId: ledger.entry.id,
        balance: Number(wallet.balance || 0),
      };
    });
  }

  async function topupWallet(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      return applyJsonWalletLedgerTransaction({
        ...params,
        tenantId: params?.tenantId || params?.userId,
        ledgerType: "topup",
        sourceType: "admin_topup",
        sourceId: params?.sourceId || params?.operatorId || "admin_topup",
        reason: params?.reason || "admin_recharge",
        direction: "credit",
      });
    }
    return getAccountingStore().topupWallet(params);
  }

  async function refundWallet(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      return applyJsonWalletLedgerTransaction({
        ...params,
        tenantId: params?.tenantId || params?.userId,
        ledgerType: "refund",
        sourceType: params?.sourceType || "auto_reconcile",
        sourceId: params?.sourceId || params?.resourceBindingId || params?.runId || "refund",
        reason: params?.reason || "wallet_refund",
        direction: "credit",
      });
    }
    return getAccountingStore().refundWallet(params);
  }

  async function makeupChargeWallet(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      return applyJsonWalletLedgerTransaction({
        ...params,
        tenantId: params?.tenantId || params?.userId,
        ledgerType: "makeup_charge",
        sourceType: params?.sourceType || "auto_reconcile",
        sourceId: params?.sourceId || params?.resourceBindingId || params?.runId || "makeup_charge",
        reason: params?.reason || "wallet_makeup_charge",
        direction: "debit",
      });
    }
    return getAccountingStore().makeupChargeWallet(params);
  }

  async function upsertWorkspaceFile(params) {
    await ensureStorageInfra();
    return getWorkspaceStore().upsertWorkspaceFile(params);
  }

  async function upsertStorageOrder(params) {
    await ensureStorageInfra();
    return getWorkspaceStore().upsertStorageOrder(params);
  }

  async function upsertTaskSpace(params) {
    await ensureStorageInfra();
    return getWorkspaceStore().upsertTaskSpace(params);
  }

  async function persistLabBillingState(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      throw new Error("portal_lab_billing_store_unavailable_for_storage_mode");
    }
    return getLabBillingStore().persistLabBillingState(params);
  }

  return {
    makeupChargeWallet,
    persistLabBillingState,
    refundWallet,
    topupWallet,
    upsertStorageOrder,
    upsertTaskSpace,
    upsertWorkspaceFile,
  };
}
