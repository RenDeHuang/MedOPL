import {
  buildSessionTraceDetailPayload as buildSessionTraceDetailDomainPayload,
  buildSessionTracesApiPayload as buildSessionTracesDomainApiPayload,
} from "../domain/session-traces.mjs";

export function createPortalSessionTracePayloads(deps) {
  async function buildSessionTracesApiPayload(db, user, options = {}) {
    return buildSessionTracesDomainApiPayload(deps, db, user, options);
  }

  async function buildSessionTraceDetailPayload(db, user, sessionId) {
    return buildSessionTraceDetailDomainPayload(deps, db, user, sessionId);
  }

  return {
    buildSessionTraceDetailPayload,
    buildSessionTracesApiPayload,
  };
}
