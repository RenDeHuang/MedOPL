import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const runtimePath = path.join(repoRoot, "adapters/billing-aggregator/src/billing-metering-runtime.mjs");
const runReaderPath = path.join(repoRoot, "adapters/billing-aggregator/src/billing-metering-run-reader.mjs");
const localCostsPath = path.join(repoRoot, "adapters/billing-aggregator/src/billing-metering-local-costs.mjs");
const allocationSummaryPath = path.join(repoRoot, "adapters/billing-aggregator/src/billing-metering-allocation-summary.mjs");
const webEntryPath = path.join(repoRoot, "adapters/billing-aggregator/src/billing-web-entry.mjs");
const serverRuntimePath = path.join(repoRoot, "adapters/billing-aggregator/src/billing-server-runtime.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractFunctionBlock(source, functionName) {
  const marker = `export function ${functionName}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`missing_function:${functionName}`);
  const bodyStart = source.indexOf("{", source.indexOf(")", start));
  if (bodyStart < 0) throw new Error(`invalid_function:${functionName}`);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated_function:${functionName}`);
}

function nonEmptyLineCount(text) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).length;
}

async function main() {
  const [runtimeSource, runReaderSource, localCostsSource, allocationSummarySource, webEntrySource, serverRuntimeSource] = await Promise.all([
    readFile(runtimePath, "utf8"),
    readFile(runReaderPath, "utf8"),
    readFile(localCostsPath, "utf8"),
    readFile(allocationSummaryPath, "utf8"),
    readFile(webEntryPath, "utf8"),
    readFile(serverRuntimePath, "utf8"),
  ]);
  const runtimeBlock = extractFunctionBlock(runtimeSource, "createBillingMeteringRuntime");
  const runtimeLines = nonEmptyLineCount(runtimeBlock);

  assert(runtimeSource.includes("createBillingRunReader"), "contract_failed:runtime_missing_run_reader_wiring");
  assert(runtimeSource.includes("createBillingLocalCostEstimator"), "contract_failed:runtime_missing_local_cost_wiring");
  assert(runtimeSource.includes("createBillingAllocationSummaryRuntime"), "contract_failed:runtime_missing_allocation_summary_wiring");
  assert(runtimeLines <= 80, `contract_failed:billing_metering_runtime_too_large:${runtimeLines}`);

  assert(runReaderSource.includes("export function createBillingRunReader"), "contract_failed:missing_run_reader_factory");
  assert(runReaderSource.includes("readRuns"), "contract_failed:run_reader_must_export_read_runs");
  assert(runReaderSource.includes("completionTimestamp"), "contract_failed:run_reader_must_export_completion_timestamp");
  assert(!runReaderSource.includes("catch {}"), "contract_failed:run_reader_must_not_swallow_file_read_errors");
  assert(localCostsSource.includes("export function createBillingLocalCostEstimator"), "contract_failed:missing_local_cost_factory");
  assert(localCostsSource.includes("pendingRequestedRunCosts"), "contract_failed:local_costs_must_own_pending_requested_run_costs");
  assert(localCostsSource.includes("estimateRunCosts"), "contract_failed:local_costs_must_own_estimated_run_costs");
  assert(!localCostsSource.includes("catch {\n        continue;"), "contract_failed:local_costs_must_not_skip_manifest_read_errors");
  assert(allocationSummarySource.includes("export function createBillingAllocationSummaryRuntime"), "contract_failed:missing_allocation_summary_factory");
  assert(allocationSummarySource.includes("summaryFromRawAllocations"), "contract_failed:allocation_summary_must_own_raw_summary");
  assert(allocationSummarySource.includes("summaryFromPendingRuns"), "contract_failed:allocation_summary_must_own_pending_summary");
  assert(allocationSummarySource.includes("unattributed"), "contract_failed:allocation_summary_must_report_unattributed_entries");
  assert(!allocationSummarySource.includes("entry?.name?.includes("), "contract_failed:allocation_summary_must_not_use_name_contains_heuristics");
  assert(!webEntrySource.includes("catch {}"), "contract_failed:billing_web_must_not_swallow_pending_summary_errors");
  assert(!serverRuntimeSource.includes("catch {}"), "contract_failed:billing_server_must_not_swallow_pending_summary_errors");

  for (const forbidden of [
    "async function readRuns",
    "async function collectWorkspaceBytes",
    "function parseCpuCores",
    "function labelValue",
    "function filterEntries",
    "function summaryFromRawAllocations",
  ]) {
    assert(!runtimeBlock.includes(forbidden), `contract_failed:billing_metering_runtime_still_embeds_detail:${forbidden}`);
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "v21_billing_metering_modularity",
    runtimeNonEmptyLines: runtimeLines,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error.message || error) }, null, 2));
  process.exit(1);
});
