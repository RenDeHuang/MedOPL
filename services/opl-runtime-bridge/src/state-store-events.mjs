import { randomUUID } from "node:crypto";

import { idChainFrom } from "./state-store-identity.mjs";
import { nowIso } from "./state-store-record-time.mjs";

export function addEvent(state, type, detail = {}) {
  state.events.push({
    id: randomUUID(),
    type,
    occurredAt: nowIso(),
    ...idChainFrom(detail),
    ...detail,
  });
}
