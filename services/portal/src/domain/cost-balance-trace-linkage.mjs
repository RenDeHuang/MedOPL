function text(value = "") {
  return String(value ?? "").trim();
}

function numberValue(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundedMoney(value = 0) {
  return Number(numberValue(value).toFixed(5));
}

function properties(item = {}) {
  return item.properties && typeof item.properties === "object" ? item.properties : {};
}

function itemRunId(item = {}) {
  const props = properties(item);
  return text(item.runId || item.run_id || props["label:run_id"] || props.run_id || props.runId);
}

function itemWorkspaceId(item = {}) {
  const props = properties(item);
  return text(item.workspaceId || item.workspace_id || props["label:workspace_id"] || props.workspace_id || props.workspaceId);
}

function itemPricingSource(item = {}) {
  const props = properties(item);
  return text(item.pricingSource || item.pricing_source || props["label:pricing_source"] || props.pricing_source || props.pricingSource);
}

function itemStatus(item = {}) {
  return text(item.status || item.reconciliationStatus || itemPricingSource(item)).toLowerCase();
}

function sumBy(items = [], key) {
  return roundedMoney(items.reduce((sum, item) => sum + numberValue(item?.[key]), 0));
}

export function billingItemsForRun(items = [], { runId = "", workspaceId = "" } = {}) {
  const targetRunId = text(runId);
  const targetWorkspaceId = text(workspaceId);
  if (!targetRunId) return [];
  return items.filter((item) => {
    if (itemRunId(item) !== targetRunId) return false;
    const billingWorkspaceId = itemWorkspaceId(item);
    return !targetWorkspaceId || !billingWorkspaceId || billingWorkspaceId === targetWorkspaceId;
  });
}

export function billingItemsForWorkspace(items = [], workspaceId = "") {
  const targetWorkspaceId = text(workspaceId);
  if (!targetWorkspaceId) return [];
  return items.filter((item) => itemWorkspaceId(item) === targetWorkspaceId);
}

export function publicCostEstimate(billing = {}, relatedCosts = []) {
  const total = sumBy(relatedCosts, "totalCost");
  const statuses = relatedCosts.map(itemStatus).filter(Boolean);
  const hasPending = statuses.some((status) => status.includes("pending") || status.includes("estimate"));
  return {
    amount: total,
    currency: text(billing?.currency || "CNY"),
    source: text(billing?.source || "contract_snapshot"),
    pricingSource: itemPricingSource(relatedCosts[0]) || "contract_snapshot",
    status: relatedCosts.length ? (hasPending ? "pending_reconciliation" : "estimated") : "none",
    billingTruth: false,
    pendingReconciliation: hasPending,
    components: {
      compute: roundedMoney(sumBy(relatedCosts, "cpuCost") + sumBy(relatedCosts, "gpuCost")),
      storage: sumBy(relatedCosts, "pvCost"),
      total,
    },
  };
}

export function publicBalanceLink(costEstimate = {}, balance = {}) {
  const amount = roundedMoney(costEstimate.amount);
  return {
    linkedToBalance: amount > 0,
    chargeApplied: false,
    rechargeStatus: "display_only",
    estimateOnly: true,
    estimatedAmount: amount,
    currency: text(costEstimate.currency || "CNY"),
    balanceCents: numberValue(balance.balanceCents),
    availableBalanceCents: numberValue(balance.availableBalanceCents),
  };
}

export function publicResourceUsage({
  run = {},
  row = {},
  outputFiles = [],
  inputFiles = [],
  relatedCosts = [],
} = {}) {
  return {
    source: "runtime_bridge_canonical_metadata",
    runId: text(row.runId || run.runId),
    sessionId: text(row.sessionId || row.runtimeSessionId || run.sessionId || run.runtimeSessionId),
    workspaceId: text(row.workspaceId || run.workspaceId),
    status: text(row.status || run.status || "recorded"),
    tokenCount: numberValue(row.tokenCount || run.tokenCount),
    latencyMs: numberValue(row.latencyMs || run.latencyMs),
    inputFileCount: inputFiles.length,
    outputFileCount: outputFiles.length,
    outputBytes: outputFiles.reduce((sum, file) => sum + numberValue(file.sizeBytes || file.size), 0),
    costItemCount: relatedCosts.length,
  };
}
