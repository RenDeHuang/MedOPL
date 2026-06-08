import { buildMessageReplyRecord } from "./state-store-message-records.mjs";
import { scopedMessageIdentity } from "./runtime-bridge-scope-identity.mjs";
import { addEvent } from "./state-store-events.mjs";

export function addMessageReplyRecord(state, input = {}) {
  const message = buildMessageReplyRecord(input);
  if (!Array.isArray(state.messageReplies)) state.messageReplies = [];
  const incomingIdentity = scopedMessageIdentity(message);
  const exists = state.messageReplies.find((item) => scopedMessageIdentity(item) === incomingIdentity);
  if (exists) return exists;
  state.messageReplies.push(message);
  addEvent(state, "opl_message_reply_recorded", message);
  return message;
}
