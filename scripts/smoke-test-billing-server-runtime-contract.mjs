import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverSource = await readFile("adapters/billing-aggregator/src/server.mjs", "utf8");
const runtimeSource = await readFile("adapters/billing-aggregator/src/billing-server-runtime.mjs", "utf8");

assert.match(serverSource, /from "\.\/billing-server-runtime\.mjs"/, "server_must_import_billing_server_runtime");
assert.match(serverSource, /createBillingServerRuntime\(/, "server_must_create_billing_server_runtime");
assert.doesNotMatch(serverSource, /let reconcileState\b/, "server_must_not_own_reconcile_state");
assert.doesNotMatch(serverSource, /let reconcileLoopRunning\b/, "server_must_not_own_reconcile_loop_state");
assert.doesNotMatch(serverSource, /async function listPendingRuns\b/, "server_must_not_inline_pending_risk_runtime");
assert.doesNotMatch(serverSource, /async function reconcileCharges\b/, "server_must_not_inline_reconcile_wrapper");
assert.doesNotMatch(serverSource, /async function runAutoReconcileLoop\b/, "server_must_not_inline_auto_reconcile_loop");

assert.match(runtimeSource, /export function createBillingServerRuntime\(/, "runtime_must_export_factory");
assert.match(runtimeSource, /async function listPendingRuns\b/, "runtime_must_own_pending_risk_runtime");
assert.match(runtimeSource, /async function reconcileCharges\b/, "runtime_must_own_reconcile_wrapper");
assert.match(runtimeSource, /async function runAutoReconcileLoop\b/, "runtime_must_own_auto_reconcile_loop");
assert.match(runtimeSource, /function scheduleAutoReconcileLoop\b/, "runtime_must_own_auto_reconcile_scheduler");

const { createBillingServerRuntime } = await import("../adapters/billing-aggregator/src/billing-server-runtime.mjs");

const events = [];
let reconcileCalls = 0;
const runtime = createBillingServerRuntime({
  env: {
    AUTO_RECONCILE_ENABLED: true,
    AUTO_RECONCILE_INTERVAL_MS: 600000,
    AUTO_RECONCILE_WINDOW: "24h",
  },
  deps: {
    buildUnavailableSummary: (customerId, workspaceId, source, cloudSource) => ({ customerId, workspaceId, source, cloudSource, runs: [], totals: {} }),
    buildUnattributedSummary: () => ({ itemCount: 0, items: [] }),
    completionTimestamp: (run) => run.updatedAt || run.createdAt,
    fetchExactSummary: async () => ({ runs: [], unattributed: { itemCount: 0 } }),
    fetchPendingSummary: async () => ({ runs: [{ runId: "pending-run" }] }),
    isCompletedRun: (run) => run.status === "completed",
    logRuntimeEvent: async (event) => events.push(event),
    readPortalDb: async () => ({ ledger: [] }),
    readRuns: async () => ([{
      runId: "run-1",
      customerId: "tenant-1",
      workspaceId: "ws-1",
      status: "completed",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T01:00:00.000Z",
    }]),
    runReconcileCharges: async () => {
      reconcileCalls += 1;
      return {
        state: { lastRunAt: "2026-05-01T01:00:00.000Z", lastError: "" },
        result: { ok: true },
      };
    },
    systemLedgerEntriesForRun: () => [],
  },
});

assert.deepEqual(runtime.getReconcileState().lastScope, "all", "runtime_must_start_with_default_state");
const pending = await runtime.listPendingRuns("tenant-1", "ws-1", "7d");
assert.equal(pending.pendingCount, 1, "runtime_must_build_pending_risk_list");
await runtime.runSingleReconcile({ customerId: "tenant-1", workspaceId: "ws-1", windowValue: "24h" });
assert.equal(reconcileCalls, 1, "runtime_must_call_reconcile_service");
assert.equal(runtime.getReconcileState().lastError, "", "runtime_must_expose_reconcile_state");
let timeoutScheduled = 0;
let intervalScheduled = 0;
runtime.scheduleAutoReconcileLoop({
  setTimeoutFn: () => { timeoutScheduled += 1; },
  setIntervalFn: () => { intervalScheduled += 1; },
});
assert.equal(timeoutScheduled, 1, "runtime_must_schedule_initial_auto_reconcile");
assert.equal(intervalScheduled, 1, "runtime_must_schedule_interval_auto_reconcile");
assert.equal(events.length, 0, "runtime_must_not_log_failure_on_success");

console.log(JSON.stringify({
  ok: true,
  contract: "billing_server_runtime",
}, null, 2));
