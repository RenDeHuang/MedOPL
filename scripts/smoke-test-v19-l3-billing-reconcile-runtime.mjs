import assert from "node:assert/strict";

const {
  createReconcileService,
  exactSettlementSourceId,
} = await import("../adapters/billing-aggregator/src/reconcile-service.mjs");

{
  const sourceId = exactSettlementSourceId({ resourceOrderId: "order-1", runId: "run-1" });
  assert.equal(sourceId, "tencent_l3_bill:order-1", "l3_source_id_prefix_must_be_tencent_l3_bill");
}

{
  const db = {
    wallets: [{ userId: "tenant-1", balance: 100 }],
    ledger: [],
    resourceOrders: [{
      id: "order-1",
      userId: "tenant-1",
      tenantId: "tenant-1",
      workspaceId: "ws-1",
      runId: "run-1",
      billingAccountId: "tenant-1",
      serverPlanId: "plan-1",
      currency: "CNY",
      createdAt: "2026-05-02T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
    }],
  };

  const reconcile = createReconcileService({
    buildUnattributedSummary: (items = [], customerId = "", workspaceId = "") => ({
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      itemCount: items.length,
      items,
    }),
    fetchExactSummary: async () => ({
      runs: [{
        runId: "run-1",
        resourceOrderId: "order-1",
        workspaceId: "ws-1",
        customerId: "tenant-1",
        serverPlanId: "plan-1",
        pricingSource: "tencent_cloud_bill",
        totalCost: 9.9,
      }],
      unattributed: { itemCount: 0, items: [] },
    }),
    logRuntimeEvent: async () => {},
    readPortalDb: async () => db,
    readRuns: async () => [{
      runId: "run-1",
      status: "completed",
      workspaceId: "ws-1",
      customerId: "tenant-1",
      billingStartedAt: "2026-05-02T00:00:00.000Z",
      billingStoppedAt: "2026-05-02T01:00:00.000Z",
    }],
    writePortalDb: async () => {},
    now: () => "2026-05-02T02:30:00.000Z",
  });

  const { result } = await reconcile("tenant-1", "ws-1", "24h", {
    runId: "run-1",
    billingStartedAt: "2026-05-02T00:00:00.000Z",
    billingStoppedAt: "2026-05-02T01:00:00.000Z",
  });

  assert.equal(result.results[0].action, "pending_l3_settlement_window", "must_gate_by_l3_wait_window");
  assert.equal(db.ledger.length, 0, "must_not_write_ledger_before_l3_wait_window");
}

{
  const db = {
    wallets: [{ userId: "tenant-2", balance: 100 }],
    ledger: [],
    resourceOrders: [{
      id: "order-2",
      userId: "tenant-2",
      tenantId: "tenant-2",
      workspaceId: "ws-2",
      runId: "run-2",
      billingAccountId: "tenant-2",
      serverPlanId: "plan-2",
      currency: "CNY",
      createdAt: "2026-05-02T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
    }],
  };
  const l3Targets = [];

  const reconcile = createReconcileService({
    buildUnattributedSummary: (items = [], customerId = "", workspaceId = "") => ({
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      itemCount: items.length,
      items,
    }),
    fetchExactSummary: async (customerId, workspaceId, windowValue, target) => {
      l3Targets.push({ customerId, workspaceId, windowValue, target });
      assert.equal(target.runId, "run-2", "l3_query_target_must_keep_run_id");
      assert.equal(target.resourceOrderId, "order-2", "l3_query_target_must_keep_resource_order_id");
      assert.equal(target.queryBeginTime, "2026-05-02 08:00:00", "l3_query_must_start_at_billing_started_at_in_tencent_bill_time");
      assert.equal(target.queryEndTime, "2026-05-02 11:00:00", "l3_query_must_end_at_billing_stopped_plus_wait_in_tencent_bill_time");
      return {
        runs: [{
          runId: "run-2",
          resourceOrderId: "order-2",
          workspaceId: "ws-2",
          customerId: "tenant-2",
          serverPlanId: "plan-2",
          pricingSource: "tencent_cloud_bill",
          totalCost: 12.5,
        }],
        unattributed: { itemCount: 0, items: [] },
      };
    },
    logRuntimeEvent: async () => {},
    readPortalDb: async () => db,
    readRuns: async () => [{
      runId: "run-2",
      resourceOrderId: "order-2",
      status: "completed",
      workspaceId: "ws-2",
      customerId: "tenant-2",
      billingStartedAt: "2026-05-02T00:00:00.000Z",
      billingStoppedAt: "2026-05-02T01:00:00.000Z",
    }],
    writePortalDb: async () => {},
    now: () => "2026-05-02T03:30:00.000Z",
  });

  const { result } = await reconcile("tenant-2", "ws-2", "24h");

  assert.equal(l3Targets.length, 1, "must_query_l3_once_for_the_target_run");
  assert.equal(result.results[0].action, "charged", "must_charge_after_l3_wait_window");
  assert.equal(db.ledger.length, 1, "must_write_one_exact_ledger_after_l3_wait_window");
  assert.equal(db.ledger[0].sourceId, "tencent_l3_bill:order-2", "exact_ledger_must_use_l3_source_id");
}

{
  const db = {
    wallets: [{ userId: "tenant-3", balance: 100 }],
    ledger: [],
    resourceOrders: [{
      id: "order-3",
      userId: "tenant-3",
      tenantId: "tenant-3",
      workspaceId: "ws-3",
      runId: "run-3",
      billingAccountId: "tenant-3",
      serverPlanId: "plan-3",
      currency: "CNY",
    }],
  };
  const reconcile = createReconcileService({
    l3ExactWaitMinutes: 150,
    buildUnattributedSummary: (items = []) => ({ itemCount: items.length, items }),
    fetchExactSummary: async () => {
      throw new Error("must_not_query_l3_before_configured_wait_window");
    },
    logRuntimeEvent: async () => {},
    readPortalDb: async () => db,
    readRuns: async () => [{
      runId: "run-3",
      resourceOrderId: "order-3",
      status: "completed",
      workspaceId: "ws-3",
      customerId: "tenant-3",
      billingStartedAt: "2026-05-02T00:00:00.000Z",
      billingStoppedAt: "2026-05-02T01:00:00.000Z",
    }],
    writePortalDb: async () => {},
    now: () => "2026-05-02T03:10:00.000Z",
  });

  const { result } = await reconcile("tenant-3", "ws-3", "24h");
  assert.equal(result.results[0].action, "pending_l3_settlement_window", "must_honor_configured_l3_wait_minutes");
  assert.equal(result.results[0].earliestExactWriteAt, "2026-05-02T03:30:00.000Z");
  assert.equal(db.ledger.length, 0, "configured_l3_wait_must_prevent_early_ledger_write");
}

{
  const db = {
    wallets: [{ userId: "tenant-zero", balance: 100 }],
    ledger: [],
    resourceOrders: [{
      id: "order-zero",
      userId: "tenant-zero",
      tenantId: "tenant-zero",
      workspaceId: "ws-zero",
      runId: "run-zero",
      billingAccountId: "tenant-zero",
      serverPlanId: "plan-zero",
      currency: "CNY",
    }],
  };
  const reconcile = createReconcileService({
    buildUnattributedSummary: (items = []) => ({ itemCount: items.length, items }),
    fetchExactSummary: async () => ({
      runs: [{
        runId: "run-zero",
        resourceOrderId: "order-zero",
        workspaceId: "ws-zero",
        customerId: "tenant-zero",
        serverPlanId: "plan-zero",
        pricingSource: "tencent_cloud_bill",
        totalCost: 0,
        sources: ["ins-zero"],
        properties: {
          resource_mapping_id: "mapping-zero",
          matched_resource_id: "ins-zero",
        },
      }],
      unattributed: { itemCount: 0, items: [] },
    }),
    logRuntimeEvent: async () => {},
    readPortalDb: async () => db,
    readRuns: async () => [{
      runId: "run-zero",
      resourceOrderId: "order-zero",
      status: "completed",
      workspaceId: "ws-zero",
      customerId: "tenant-zero",
      billingStartedAt: "2026-05-02T00:00:00.000Z",
      billingStoppedAt: "2026-05-02T01:00:00.000Z",
    }],
    writePortalDb: async () => {},
    now: () => "2026-05-02T03:30:00.000Z",
  });

  const { result } = await reconcile("tenant-zero", "ws-zero", "24h");

  assert.equal(result.results[0].action, "unattributed", "zero_cost_exact_bill_must_return_auditable_result");
  assert.equal(result.results[0].reason, "exact_bill_zero_cost", "zero_cost_exact_bill_must_explain_no_charge");
  assert.equal(result.results[0].targetTotalCost, 0, "zero_cost_exact_bill_must_report_zero_cost");
  assert.equal(db.ledger.length, 0, "zero_cost_exact_bill_must_not_write_charge_ledger");
}

console.log(JSON.stringify({ ok: true, contract: "v19_l3_billing_reconcile_runtime" }, null, 2));
