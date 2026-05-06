import { firstNonEmpty } from "./runtime-bridge-scope-primitives.mjs";

export function providerKeyRefFrom(record = {}) {
  return firstNonEmpty([
    record.providerKeyRef,
    record.provider_key_ref,
    record.providerConfigSecretRef,
    record.provider_config_secret_ref,
  ]);
}

export function scopedMessageIdentity(record = {}) {
  return [
    firstNonEmpty([record.launchTokenHash, record.launch_token_hash]),
    firstNonEmpty([record.portalUserId, record.portal_user_id, record.userId, record.user_id]),
    firstNonEmpty([record.workspaceId, record.workspace_id]),
    providerKeyRefFrom(record),
    firstNonEmpty([record.runtimeSessionId, record.runtime_session_id]),
    firstNonEmpty([record.messageId, record.message_id, record.runId, record.run_id]),
  ].join(":");
}
