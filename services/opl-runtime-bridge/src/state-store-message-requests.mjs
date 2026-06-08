import { buildMessageRequestRecord } from "./state-store-message-records.mjs";
import { scopedMessageIdentity } from "./runtime-bridge-scope-identity.mjs";
import { nowIso } from "./state-store-record-time.mjs";
import { addEvent } from "./state-store-events.mjs";

export function upsertMessageRequestRecord(state, input = {}) {
  if (!Array.isArray(state.messageRequests)) state.messageRequests = [];
  const incoming = buildMessageRequestRecord(input);
  const incomingIdentity = scopedMessageIdentity(incoming);
  const existing = state.messageRequests.find((item) => scopedMessageIdentity(item) === incomingIdentity);
  if (!existing) {
    state.messageRequests.push(incoming);
    addEvent(state, "opl_message_request_accepted", incoming);
    return incoming;
  }
  Object.assign(existing, {
    ...incoming,
    createdAt: existing.createdAt || incoming.createdAt,
    startedAt: existing.startedAt || incoming.startedAt,
    updatedAt: nowIso(),
  });
  addEvent(state, "opl_message_request_updated", existing);
  return existing;
}
