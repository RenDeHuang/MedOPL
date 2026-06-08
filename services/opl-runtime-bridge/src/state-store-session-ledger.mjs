import { randomUUID } from "node:crypto";

import { nowIso } from "./state-store-record-time.mjs";

const LEDGER_EVENT_TYPES = new Set([
  "runtime_event",
  "runtime_run_submitted",
  "runtime_run_succeeded",
  "runtime_run_failed",
  "runtime_run_canceled",
  "runtime_artifact_recorded",
  "runtime_usage_recorded",
]);

const LEDGER_STATUSES = new Set([
  "accepted",
  "submitted",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "cancel_requested",
  "recorded",
  "skipped",
]);

function sessionLedgerScope(input = {}) {
  const runtimeSessionId = String(input.runtimeSessionId || input.runtime_session_id || "");
  const workspaceSessionId = String(input.workspaceSessionId || input.workspace_session_id || "");
  return { runtimeSessionId, workspaceSessionId };
}

function sessionLedgerSequence(state, scope, input = {}) {
  const scopedEntries = state.sessionLedgerEntries.filter((item) =>
    (scope.runtimeSessionId && item.runtimeSessionId === scope.runtimeSessionId) ||
    (!scope.runtimeSessionId && scope.workspaceSessionId && item.workspaceSessionId === scope.workspaceSessionId)
  );
  const lastSequence = scopedEntries.reduce((max, item) => Math.max(max, Number(item.sequence || 0)), 0);
  return Number(input.sequence || 0) > 0 ? Number(input.sequence) : lastSequence + 1;
}

function safeLedgerEventType(value = "") {
  const eventType = String(value || "runtime_event").trim();
  return LEDGER_EVENT_TYPES.has(eventType) ? eventType : "runtime_event";
}

function safeLedgerStatus(value = "") {
  const status = String(value || "recorded").trim();
  return LEDGER_STATUSES.has(status) ? status : "recorded";
}

function optionalIsoTimestamp(value = "") {
  const timestamp = String(value || "").trim();
  return timestamp && Number.isFinite(Date.parse(timestamp)) ? timestamp : "";
}

function safeNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function safeUsageSummary(input = {}) {
  const usage = input.usage && typeof input.usage === "object" ? input.usage : {};
  return {
    inputTokens: safeNonNegativeNumber(usage.inputTokens ?? usage.input_tokens),
    outputTokens: safeNonNegativeNumber(usage.outputTokens ?? usage.output_tokens),
    totalTokens: safeNonNegativeNumber(usage.totalTokens ?? usage.total_tokens),
  };
}

function safeCostSummary(input = {}) {
  const costSummary = input.costSummary && typeof input.costSummary === "object" ? input.costSummary : {};
  const currency = String(costSummary.currency || "").trim().toUpperCase();
  return {
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "",
    estimatedCost: safeNonNegativeNumber(costSummary.estimatedCost ?? costSummary.estimated_cost),
    billedCost: safeNonNegativeNumber(costSummary.billedCost ?? costSummary.billed_cost),
    billingMetadataRef: safePublicRef(costSummary.billingMetadataRef ?? costSummary.billing_metadata_ref),
    usageMetadataRef: safePublicRef(costSummary.usageMetadataRef ?? costSummary.usage_metadata_ref),
  };
}

function safePublicRef(value = "") {
  const ref = String(value || "").trim();
  if (!ref || ref.length > 128) return "";
  if (/[\\/]/.test(ref) || /^https?:/i.test(ref)) return "";
  return /^[a-zA-Z0-9._:-]+$/.test(ref) ? ref : "";
}

function safeArtifactRefs(input = {}) {
  return (Array.isArray(input.artifactRefs) ? input.artifactRefs : [])
    .map((item) => safePublicRef(item))
    .filter(Boolean);
}

function safeLedgerMetadata(input = {}) {
  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const publicStatus = safeLedgerStatus(metadata.publicStatus || metadata.public_status || metadata.status || input.status);
  return publicStatus ? { publicStatus } : {};
}

function buildSessionLedgerEntry(state, input = {}) {
  const scope = sessionLedgerScope(input);
  const ledgerEntryId = randomUUID();
  const createdAt = optionalIsoTimestamp(input.createdAt || input.created_at) || nowIso();
  const updatedAt = optionalIsoTimestamp(input.updatedAt || input.updated_at) || createdAt;
  return {
    id: ledgerEntryId,
    ledgerEntryId,
    tenantId: input.tenantId || input.tenant_id || "",
    portalUserId: input.portalUserId || input.portal_user_id || "",
    workspaceId: input.workspaceId || input.workspace_id || "",
    resourceBindingId: input.resourceBindingId || input.resource_binding_id || "",
    providerKeyRef: input.providerKeyRef || input.provider_key_ref || input.providerConfigSecretRef || input.provider_config_secret_ref || "",
    sessionId: input.sessionId || input.session_id || input.oplSessionId || input.opl_session_id || scope.runtimeSessionId || scope.workspaceSessionId,
    workspaceSessionId: scope.workspaceSessionId,
    runtimeSessionId: scope.runtimeSessionId,
    oplSessionId: input.oplSessionId || input.opl_session_id || "",
    messageId: input.messageId || input.message_id || "",
    runId: input.runId || input.run_id || "",
    traceId: input.traceId || input.trace_id || "",
    sequence: sessionLedgerSequence(state, scope, input),
    eventType: safeLedgerEventType(input.eventType || input.event_type),
    status: safeLedgerStatus(input.status),
    artifactRefs: safeArtifactRefs(input),
    usage: safeUsageSummary(input),
    costSummary: safeCostSummary(input),
    metadata: safeLedgerMetadata(input),
    createdAt,
    updatedAt,
  };
}

export function addSessionLedgerEntry(state, input = {}) {
  if (!Array.isArray(state.sessionLedgerEntries)) state.sessionLedgerEntries = [];
  const entry = buildSessionLedgerEntry(state, input);
  state.sessionLedgerEntries.push(entry);
  return entry;
}

export function listSessionLedgerEntries(state, scope = {}) {
  const runtimeSessionId = String(scope.runtimeSessionId || scope.runtime_session_id || "");
  const workspaceSessionId = String(scope.workspaceSessionId || scope.workspace_session_id || "");
  return (state.sessionLedgerEntries || [])
    .filter((item) =>
      (!runtimeSessionId || item.runtimeSessionId === runtimeSessionId) &&
      (!workspaceSessionId || item.workspaceSessionId === workspaceSessionId)
    )
    .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0));
}
