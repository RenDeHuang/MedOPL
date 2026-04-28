import assert from "node:assert/strict";

const { createLangfuseTraceClient } = await import(new URL("../services/portal/src/integrations/langfuse-trace-client.mjs", import.meta.url).href);
const { createLangfusePublisher } = await import(new URL("../services/opl-runtime-bridge/src/langfuse-publisher.mjs", import.meta.url).href);

function formatDateTime(value) {
  return String(value || "");
}

const client = createLangfuseTraceClient({
  langfuseUrl: "",
  publicKey: "",
  secretKey: "",
  formatDateTime,
});
const summary = await client.fetchSummary();
assert.equal(summary.available, false, "unconfigured Langfuse client must not claim live traces");

const rows = await client.fetchTraceRows({ userId: "user-a", workspaceId: "workspace-a" });
assert.equal(rows.type, "status_only", "unconfigured Langfuse trace rows must be status_only");
assert.deepEqual(rows.rows, [], "unconfigured Langfuse trace rows must be empty");

const publisher = createLangfusePublisher({ baseUrl: "", publicKey: "", secretKey: "" });
const published = await publisher.publishTraceEvent({
  portalUserId: "user-a",
  tenantId: "tenant-a",
  workspaceId: "workspace-a",
  runId: "run-a",
  eventType: "message",
});
assert.equal(published.ok, false, "unconfigured publisher must not report success");
assert.equal(published.skipped, true, "unconfigured publisher must explicitly skip");

console.log("v13 Langfuse trace contract smoke passed");
