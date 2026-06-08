import { addTraceRecord } from "./state-store-artifact-trace-mutations.mjs";
import { addEvent } from "./state-store-events.mjs";
import { readBody, sendJson } from "./runtime-bridge-routes-http.mjs";

export function createRuntimeBridgeEventApi({
  langfusePublisher,
  readState,
  updateState,
}) {
  function recordEvent(state, type, detail = {}) {
    addEvent(state, type, detail);
  }

  async function publishTraceEvent(state, event = {}) {
    const trace = addTraceRecord(state, {
      ...event,
      traceName: event.traceName || event.eventType || event.type || "opl-session",
      status: event.status || "recorded",
    });
    try {
      const published = await langfusePublisher.publishTraceEvent({ ...trace, ...event });
      addEvent(state, published.ok ? "trace_event_published" : "trace_event_publish_skipped", {
        ...trace,
        status: published.ok ? "published" : "skipped",
        reason: published.reason || published.error || "",
      });
    } catch (error) {
      addEvent(state, "trace_event_publish_failed", {
        ...trace,
        error: String(error.message || error),
      });
    }
    return trace;
  }

  async function handleTraceLinks(_req, res) {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.traceLinks, runActions: state.runActions });
  }

  async function handleTraceEvents(req, res) {
    const input = await readBody(req);
    let trace = null;
    await updateState(async (state) => {
      trace = await publishTraceEvent(state, {
        ...input,
        eventType: input.eventType || input.type || "runtime_event",
      });
    });
    sendJson(res, 200, { ok: true, trace });
  }

  return {
    handleTraceEvents,
    handleTraceLinks,
    publishTraceEvent,
    recordEvent,
  };
}
