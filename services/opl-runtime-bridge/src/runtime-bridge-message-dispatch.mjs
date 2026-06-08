import { createHash } from "node:crypto";
import { upsertMessageRequestRecord } from "./state-store-message-requests.mjs";

function messagePromptPreview(input = {}) {
  const source = String(input.message || input.text || input.prompt || input.input?.message || "");
  if (!source) return "";
  const digest = createHash("sha256").update(source).digest("hex").slice(0, 16);
  return `len:${source.length};sha256:${digest}`;
}

export function waitForMessageCompletion(input = {}) {
  return input.waitForCompletion === true || input.wait_for_completion === true;
}

function messageRequestRecord({ runtimeSession, input, messageId, tokenHash, status, req, extra = {} }) {
  return {
    ...runtimeSession,
    ...input,
    messageId,
    runId: messageId,
    launchTokenHash: tokenHash,
    promptPreview: messagePromptPreview(input),
    status,
    userAgent: req?.headers?.["user-agent"] || "",
    ...extra,
  };
}

export function upsertRuntimeMessage(state, { runtimeSession, input, messageId, tokenHash, status, req, extra = {} }) {
  return upsertMessageRequestRecord(state, messageRequestRecord({
    runtimeSession,
    input,
    messageId,
    tokenHash,
    status,
    req,
    extra,
  }));
}

function messageRecordMatchesLaunch(record = {}, { messageId = "", runtimeSessionId = "", tokenHash = "" } = {}) {
  return record.messageId === messageId &&
    record.runtimeSessionId === runtimeSessionId &&
    record.launchTokenHash === tokenHash;
}

export function messageRecordInState(state = {}, { messageId = "", runtimeSessionId = "", tokenHash = "" } = {}) {
  return (state.messageRequests || []).find((item) =>
    messageRecordMatchesLaunch(item, { messageId, runtimeSessionId, tokenHash })
  );
}

export function messageStatusLookup({ state, tokenHash, match, launch }) {
  const messageId = decodeURIComponent(match[1]);
  return messageRecordInState(state, {
    messageId,
    runtimeSessionId: launch.runtimeSessionId,
    tokenHash,
  });
}

export function statusUrlForMessage({ messageId }) {
  return `/runtime-bridge/api/opl/messages/${encodeURIComponent(messageId)}/status`;
}

function mergeUniqueBy(target = [], source = [], keyFn) {
  const merged = [...target];
  const seen = new Set(merged.map(keyFn).filter(Boolean));
  for (const item of source || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    merged.push(item);
    seen.add(key);
  }
  return merged;
}

function traceLinkMergeKey(item = {}) {
  return [
    item.traceId || "",
    item.runId || "",
    item.traceName || "",
    item.status || "",
  ].join(":");
}

function artifactMergeKey(item = {}) {
  return item.artifactId || [
    item.runId,
    item.kind,
    item.name,
    item.localPath,
  ].join(":");
}

function recentMessageEvents(sourceState = {}, acceptedAt = "") {
  const acceptedTime = Date.parse(acceptedAt || 0);
  return (sourceState.events || []).filter((event) =>
    Date.parse(event.occurredAt || event.createdAt || 0) >= acceptedTime
  );
}

export function mergeMessageSideEffects(targetState, sourceState, acceptedAt) {
  const sourceEvents = recentMessageEvents(sourceState, acceptedAt);
  return {
    ...targetState,
    messageReplies: mergeUniqueBy(targetState.messageReplies, sourceState.messageReplies, (item) => item.messageId),
    artifacts: mergeUniqueBy(targetState.artifacts, sourceState.artifacts, artifactMergeKey),
    traceLinks: mergeUniqueBy(targetState.traceLinks, sourceState.traceLinks, traceLinkMergeKey),
    runActions: mergeUniqueBy(targetState.runActions, sourceState.runActions, (item) => item.actionId),
    events: mergeUniqueBy(targetState.events, sourceEvents, (item) => item.id),
  };
}
