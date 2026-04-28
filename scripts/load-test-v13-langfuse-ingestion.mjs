import assert from "node:assert/strict";

const { createLangfusePublisher } = await import(new URL("../services/opl-runtime-bridge/src/langfuse-publisher.mjs", import.meta.url).href);

const events = Math.max(1, Number(process.env.V13_LANGFUSE_LOAD_EVENTS || 100));
const publisher = createLangfusePublisher();
const startedAt = Date.now();
let skipped = 0;
let failed = 0;

for (let index = 0; index < events; index += 1) {
  const result = await publisher.publishTraceEvent({
    portalUserId: "load-user",
    tenantId: "load-tenant",
    workspaceId: "load-workspace",
    runId: `load-run-${index}`,
    eventType: "load_test",
    status: "recorded",
  });
  if (result.skipped) skipped += 1;
  if (!result.ok && !result.skipped) failed += 1;
}

const durationMs = Date.now() - startedAt;
const perSecond = Number((events / Math.max(1, durationMs / 1000)).toFixed(2));

assert.equal(failed, 0, "Langfuse ingestion load test must not produce hard failures");
console.log(JSON.stringify({
  ok: true,
  events,
  skipped,
  failed,
  durationMs,
  perSecond,
  configured: publisher.configured(),
}, null, 2));
