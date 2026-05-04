import { randomUUID } from "node:crypto";

export function createRunCorrelationId(input = {}) {
  const explicit = String(input.correlationId || input.correlation_id || "").trim();
  if (explicit) return explicit;
  const runId = String(input.runId || input.run_id || "").trim();
  if (runId) return `run-${runId}`;
  return `run-${randomUUID()}`;
}

export function createRunTraceId(input = {}) {
  const explicit = String(input.traceId || input.trace_id || "").trim();
  if (explicit) return explicit;
  const runId = String(input.runId || input.run_id || "").trim();
  if (runId) return `trace-${runId}`;
  return `trace-${randomUUID()}`;
}
