import path from "node:path";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { idChainFrom, ownerIdFrom, slugify, storageOwnerIdFrom, tenantIdFrom } from "./state-store-identity.mjs";
import {
  buildArtifactRecord,
  buildCostRecord,
  buildMessageReplyRecord,
  buildMessageRequestRecord,
  buildRunActionRecord,
  buildRunRecord,
  buildRuntimeSessionRecord,
  buildTraceRecord,
  buildWorkspaceRecord,
  buildWorkspaceSessionRecord,
  normalizeCostRecords,
  nowIso,
} from "./state-store-records.mjs";
import { scopedMessageIdentity } from "./runtime-bridge-scope-identity.mjs";

export { nowIso } from "./state-store-records.mjs";
export { slugify } from "./state-store-identity.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
const runtimeRoot = process.env.PORTAL_OPL_ADAPTER_STATE_ROOT
  ? path.resolve(process.env.PORTAL_OPL_ADAPTER_STATE_ROOT)
  : path.join(repoRoot, ".runtime", "portal-opl-adapter");
const stateFile = path.join(runtimeRoot, "state.json");
const artifactsRoot = path.join(runtimeRoot, "artifacts");

const emptyState = {
  version: "v1",
  launchTokens: [],
  workspaces: [],
  workspaceSessions: [],
  runtimeSessions: [],
  runs: [],
  runActions: [],
  artifacts: [],
  messageRequests: [],
  messageReplies: [],
  traceLinks: [],
  costRecords: [],
  sessionLedgerEntries: [],
  events: [],
};

export { runtimeRoot, stateFile, artifactsRoot, emptyState };

export async function ensureRuntime() {
  await mkdir(runtimeRoot, { recursive: true });
  await mkdir(artifactsRoot, { recursive: true });
  if (!existsSync(stateFile)) {
    await writeState(emptyState);
  }
}

export async function readState() {
  await ensureRuntime();
  const parsed = JSON.parse(await readFile(stateFile, "utf8"));
  return sanitizeState({ ...emptyState, ...parsed });
}

export async function writeState(state) {
  await mkdir(runtimeRoot, { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(sanitizeState({ ...emptyState, ...state }), null, 2)}\n`, "utf8");
}

function sanitizeState(state) {
  return {
    ...state,
    messageReplies: Array.isArray(state.messageReplies) ? state.messageReplies : [],
    sessionLedgerEntries: Array.isArray(state.sessionLedgerEntries) ? state.sessionLedgerEntries : [],
    costRecords: normalizeCostRecords(state.costRecords),
  };
}

export function addEvent(state, type, detail = {}) {
  state.events.push({
    id: randomUUID(),
    type,
    occurredAt: nowIso(),
    ...idChainFrom(detail),
    ...detail,
  });
}

export function upsertWorkspace(state, input = {}) {
  const portalUserId = input.portalUserId || input.portal_user_id || "";
  const workspaceId = slugify(input.workspaceId || input.workspace_id || "default");
  const existing = state.workspaces.find((item) =>
    item.portalUserId === portalUserId &&
    item.workspaceId === workspaceId
  );
  const workspace = buildWorkspaceRecord(input, existing);
  if (!existing) {
    state.workspaces.push(workspace);
    addEvent(state, "workspace_registered", { portalUserId, workspaceId });
    return workspace;
  }
  Object.assign(existing, workspace);
  return existing;
}

export function createWorkspaceSession(state, input = {}) {
  const workspace = upsertWorkspace(state, input);
  const session = buildWorkspaceSessionRecord(input, workspace);
  state.workspaceSessions.push(session);
  addEvent(state, "workspace_session_created", session);
  return session;
}

export function createRuntimeSession(state, input = {}) {
  const runtimeSession = buildRuntimeSessionRecord(input);
  state.runtimeSessions.push(runtimeSession);
  addEvent(state, "runtime_session_warmed", runtimeSession);
  return runtimeSession;
}

export function createRunRecord(state, input = {}) {
  const run = buildRunRecord(input);
  state.runs.push(run);
  addEvent(state, "runner_run_submitted", run);
  return run;
}

export function updateRunStatus(state, runId, patch = {}) {
  const run = state.runs.find((item) => item.runId === runId);
  if (!run) return null;
  Object.assign(run, {
    ...patch,
    updatedAt: nowIso(),
  });
  addEvent(state, "runner_run_status_synced", run);
  return run;
}

export function addRunAction(state, input = {}) {
  const action = buildRunActionRecord(input);
  state.runActions.push(action);
  return action;
}

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

export function addArtifactRecord(state, input = {}) {
  const artifact = buildArtifactRecord(input);
  const exists = state.artifacts.find((item) =>
    item.runId === artifact.runId &&
    item.objectKey === artifact.objectKey &&
    item.localPath === artifact.localPath &&
    item.name === artifact.name
  );
  if (exists) return exists;
  state.artifacts.push(artifact);
  addEvent(state, "runner_artifact_synced", artifact);
  return artifact;
}

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

function rawLedgerPayload(input = {}) {
  return input.rawPayload && typeof input.rawPayload === "object" ? input.rawPayload : {};
}

function rawLedgerPayloadHash(rawPayload) {
  return createHash("sha256").update(JSON.stringify(rawPayload)).digest("hex");
}

function buildSessionLedgerEntry(state, input = {}) {
  const scope = sessionLedgerScope(input);
  const rawPayload = rawLedgerPayload(input);
  return {
    id: input.id || randomUUID(),
    tenantId: input.tenantId || input.tenant_id || "",
    portalUserId: input.portalUserId || input.portal_user_id || "",
    workspaceId: input.workspaceId || input.workspace_id || "",
    resourceBindingId: input.resourceBindingId || input.resource_binding_id || "",
    workspaceSessionId: scope.workspaceSessionId,
    runtimeSessionId: scope.runtimeSessionId,
    oplSessionId: input.oplSessionId || input.opl_session_id || "",
    messageId: input.messageId || input.message_id || "",
    runId: input.runId || input.run_id || "",
    traceId: input.traceId || input.trace_id || "",
    sequence: sessionLedgerSequence(state, scope, input),
    eventType: String(input.eventType || input.event_type || "runtime_event"),
    rawPayload,
    payloadHash: rawLedgerPayloadHash(rawPayload),
    artifactRefs: Array.isArray(input.artifactRefs) ? input.artifactRefs : [],
    createdAt: input.createdAt || input.created_at || nowIso(),
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

export function addTraceRecord(state, input = {}) {
  const trace = buildTraceRecord(input);
  state.traceLinks.push(trace);
  return trace;
}

export function addCostRecord(state, input = {}) {
  const cost = buildCostRecord(input);
  state.costRecords.push(cost);
  addEvent(state, cost.status === "exact" ? "runner_cost_reconciled" : "runner_cost_pending", cost);
  return cost;
}

export { ownerIdFrom, storageOwnerIdFrom, tenantIdFrom };
