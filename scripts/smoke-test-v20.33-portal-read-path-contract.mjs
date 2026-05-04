import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pagePayloads = await readFile("services/portal/src/app/portal-page-payloads.mjs", "utf8");
const workspaceRuntime = await readFile("services/portal/src/app/portal-workspace-runtime.mjs", "utf8");
const sessionTraces = await readFile("services/portal/src/domain/session-traces.mjs", "utf8");
const adminPayloads = await readFile("services/portal/src/app/portal-admin-api-payloads.mjs", "utf8");

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

mustMatch(pagePayloads, /\bcreatePayloadTimingRecorder\b/, "page_payloads_must_record_builder_timing_breakdown");
for (const name of [
  "buildOverviewPayload",
  "buildBillingPayload",
  "buildBillingSummaryPayload",
  "buildBillingDetailsPayload",
  "buildWorkspacePayload",
]) {
  mustMatch(pagePayloads, new RegExp(`${name}[\\s\\S]{0,220}\\bconst timing = createPayloadTimingRecorder`), `${name}_must_create_timing_recorder`);
  mustMatch(pagePayloads, new RegExp(`${name}[\\s\\S]*?\\bperformance\\s*:`), `${name}_must_return_performance_breakdown`);
}

mustMatch(workspaceRuntime, /async function collectRunsForUser\(userId,\s*\{\s*limit\s*=\s*200,\s*workspaceId\s*=\s*""\s*,\s*runId\s*=\s*""\s*\}\s*=\s*\{\}\)/, "collect_runs_for_user_must_accept_bounded_filters");
mustMatch(workspaceRuntime, /\bboundedRuns\b/, "collect_runs_for_user_must_bound_file_scan_results");
mustMatch(workspaceRuntime, /\blimitReached\b/, "collect_runs_for_user_must_track_limit_reached");
mustNotMatch(
  workspaceRuntime,
  /async function collectRunsForTask\(userId,\s*workspaceId\)\s*\{\s*const runs = await collectRunsForUser\(userId\);\s*return runs\.filter/,
  "collect_runs_for_task_must_not_fetch_all_user_runs_before_filtering_workspace",
);

mustMatch(pagePayloads, /collectRunsForUser\(user\.id,\s*\{\s*limit:\s*50/, "overview_must_bound_user_run_collection");
mustMatch(pagePayloads, /collectRunsForUser\(user\.id,\s*\{\s*limit:\s*200/, "billing_details_must_bound_user_run_collection");
mustMatch(pagePayloads, /collectRunsForUser\(user\.id,\s*\{\s*workspaceId:\s*current\.slug,\s*limit:\s*50/, "workspace_payload_must_filter_runs_by_workspace_at_source");
mustMatch(pagePayloads, /readPortalEvents\(\s*\{\s*limit:\s*200,\s*userId:\s*user\.id,\s*workspaceId:\s*current\.slug/, "workspace_payload_must_read_filtered_portal_events");
mustNotMatch(pagePayloads, /\(await readPortalEvents\(200\)\)\.filter/, "workspace_payload_must_not_filter_events_after_full_read");

mustMatch(sessionTraces, /readPortalEvents\(\s*\{\s*limit:\s*200,\s*userId:\s*user\.id,\s*workspaceId:\s*item\.workspaceId,\s*runId:\s*item\.runId/, "session_trace_detail_must_read_filtered_events");
mustNotMatch(sessionTraces, /\(await deps\.readPortalEvents\(500\)\)\.filter/, "session_trace_detail_must_not_filter_after_full_event_read");

mustMatch(adminPayloads, /collectRunsForUser\(item\.id,\s*\{\s*limit:\s*50/, "admin_overview_must_bound_per_user_runs");
mustMatch(adminPayloads, /readPortalEvents\(\s*\{\s*limit:\s*240/, "admin_overview_must_use_structured_event_read_options");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_portal_read_path",
}, null, 2));
