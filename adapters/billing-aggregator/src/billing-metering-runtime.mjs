import { createBillingAllocationSummaryRuntime } from "./billing-metering-allocation-summary.mjs";
import { createBillingLocalCostEstimator } from "./billing-metering-local-costs.mjs";
import { createBillingRunReader } from "./billing-metering-run-reader.mjs";

function assertBillingMeteringDeps(deps = {}) {
  const {
    exists,
    isCompletedRun,
    path,
    randomUUID,
    readFile,
    readdir,
    stat,
  } = deps;

  if (typeof exists !== "function") throw new Error("exists is required");
  if (typeof isCompletedRun !== "function") throw new Error("isCompletedRun is required");
  if (!path || typeof path.join !== "function") throw new Error("path is required");
  if (typeof randomUUID !== "function") throw new Error("randomUUID is required");
  if (typeof readFile !== "function") throw new Error("readFile is required");
  if (typeof readdir !== "function") throw new Error("readdir is required");
  if (typeof stat !== "function") throw new Error("stat is required");
}

export function createBillingMeteringRuntime({
  paths = {},
  rates = {},
  deps = {},
} = {}) {
  assertBillingMeteringDeps(deps);

  const runReader = createBillingRunReader({
    paths,
    deps,
  });
  const localCostEstimator = createBillingLocalCostEstimator({
    deps: {
      ...deps,
      completionTimestamp: runReader.completionTimestamp,
      readRuns: runReader.readRuns,
    },
    rates: {
      ...rates,
      medWorkspacesRoot: paths.medWorkspacesRoot || "",
    },
  });
  const allocationSummary = createBillingAllocationSummaryRuntime();

  return {
    asEntries: allocationSummary.asEntries,
    collectWorkspaceBytes: localCostEstimator.collectWorkspaceBytes,
    completionTimestamp: runReader.completionTimestamp,
    estimateRunCosts: localCostEstimator.estimateRunCosts,
    pendingRequestedRunCosts: localCostEstimator.pendingRequestedRunCosts,
    readRuns: runReader.readRuns,
    summaryFromPendingRuns: allocationSummary.summaryFromPendingRuns,
    summaryFromRawAllocations: allocationSummary.summaryFromRawAllocations,
    summarize: allocationSummary.summarize,
  };
}
