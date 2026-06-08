import { capabilityNotSupportedPayload } from "./runtime-bridge-contract-payloads.mjs";
import {
  launchTokenFrom,
  launchTokenHash,
  messageIdFromInput,
  readBody,
  sendJson,
} from "./runtime-bridge-routes-http.mjs";
import {
  completedMessageExtra,
  failedMessageExtra,
  messageStatusPayload,
  publicCompletedMessagePayload,
  timingPayload,
} from "./runtime-bridge-message-payloads.mjs";
import {
  mergeMessageSideEffects,
  messageRecordInState,
  messageStatusLookup,
  statusUrlForMessage,
  upsertRuntimeMessage,
  waitForMessageCompletion,
} from "./runtime-bridge-message-dispatch.mjs";
import { publicRunArtifact } from "./runtime-bridge-public-artifacts.mjs";
import { addEvent } from "./state-store-events.mjs";

function isCapabilityNotSupported(error) {
  return error?.code === "capability_not_supported";
}

export function createRuntimeBridgeMessageRouteApi({
  config,
  launchApi,
  messageApi,
  readLaunchRuntimeSession,
  readState,
  updateState,
} = {}) {
  async function completeMessageInBackground(messageId, runtimeSession, input, req, acceptedAt) {
    try {
      const workerStartedAt = new Date().toISOString();
      const runningState = await updateState((state) => state);
      const message = await messageApi.submitMessage(runningState, runtimeSession, input, req);
      await updateState((currentState) => {
        const completedState = mergeMessageSideEffects(currentState, runningState, acceptedAt);
        upsertRuntimeMessage(completedState, {
          runtimeSession,
          input,
          messageId,
          tokenHash: input.launchTokenHash,
          status: "succeeded",
          req,
          extra: completedMessageExtra({ input, runtimeSession, message, acceptedAt, workerStartedAt }),
        });
        return completedState;
      });
    } catch (error) {
      await updateState((failedState) => {
        upsertRuntimeMessage(failedState, {
          runtimeSession,
          input,
          messageId,
          tokenHash: input.launchTokenHash,
          status: "failed",
          req,
          extra: failedMessageExtra(error, acceptedAt, new Date().toISOString()),
        });
        addEvent(failedState, "opl_message_reply_failed", { ...runtimeSession, messageId, error: String(error.message || error) });
      });
    }
  }

  async function runMessageToCompletion({ runtimeSession, input, req, messageId, tokenHash, res }) {
    if (process.env.OPL_RUNTIME_MODE === "webui" && config.webuiProviderMessageEnabled !== true) {
      sendJson(res, 409, {
        ok: false,
        error: "provider_authorization_required",
        status: "gated",
        providerKeyRef: runtimeSession.providerKeyRef || "",
        capability: "webui_provider_message",
        message: "Real OPL WebUI provider message canary requires explicit OPL_WEBUI_PROVIDER_MESSAGE_ENABLED=1.",
      });
      return;
    }
    const acceptedAt = new Date().toISOString();
    const workerStartedAt = acceptedAt;
    let status = 200;
    let payload = null;
    await updateState(async (state) => {
      const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
      upsertRuntimeMessage(state, {
        runtimeSession: activeRuntimeSession,
        input,
        messageId,
        tokenHash,
        status: "running",
        req,
        extra: { acceptedAt, workerStartedAt },
      });
      try {
        const message = await messageApi.submitMessage(state, activeRuntimeSession, input, req);
        upsertRuntimeMessage(state, {
          runtimeSession: activeRuntimeSession,
          input,
          messageId,
          tokenHash,
          status: "succeeded",
          req,
          extra: completedMessageExtra({ input, runtimeSession: activeRuntimeSession, message, acceptedAt, workerStartedAt }),
        });
        const record = messageRecordInState(state, { messageId, runtimeSessionId: activeRuntimeSession.runtimeSessionId, tokenHash });
        payload = {
          ok: true,
          ...publicCompletedMessagePayload(message, record || {}, state, activeRuntimeSession),
          traceId: input.traceId || activeRuntimeSession.traceId || "",
          timing: timingPayload(record || {}),
        };
      } catch (error) {
        status = isCapabilityNotSupported(error) ? 409 : 502;
        upsertRuntimeMessage(state, {
          runtimeSession: activeRuntimeSession,
          input,
          messageId,
          tokenHash,
          status: "failed",
          req,
          extra: failedMessageExtra(error, acceptedAt, workerStartedAt),
        });
        addEvent(state, "opl_message_reply_failed", { ...activeRuntimeSession, messageId, error: String(error.message || error) });
        payload = isCapabilityNotSupported(error)
          ? capabilityNotSupportedPayload(error, "message")
          : { ok: false, error: String(error.message || error) };
      }
    });
    sendJson(res, status, payload);
  }

  async function acceptMessageForBackground({ runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res }) {
    let record = null;
    await updateState((state) => {
      const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
      record = upsertRuntimeMessage(state, {
        runtimeSession: activeRuntimeSession,
        input,
        messageId,
        tokenHash,
        status: "running",
        req,
        extra: { acceptedAt },
      });
    });
    setImmediate(() => completeMessageInBackground(messageId, runtimeSession, input, req, acceptedAt));
    sendJson(res, 202, {
      ok: true,
      status: "accepted",
      message: {
        messageId,
        runId: messageId,
        traceId: input.traceId || runtimeSession.traceId || "",
        status: record.status,
        acceptedAt,
      },
      statusUrl: statusUrlForMessage({ messageId }),
    });
  }

  async function dispatchMessageRequest({ state, runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res }) {
    if (waitForMessageCompletion(input)) {
      await runMessageToCompletion({ runtimeSession, input, req, messageId, tokenHash, res });
      return;
    }
    await acceptMessageForBackground({ runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res });
  }

  async function handleMessage(req, res, url) {
    const input = await readBody(req);
    const resolved = await readLaunchRuntimeSession(input, url, req, res);
    if (!resolved) return;
    const { launch, state, runtimeSession } = resolved;
    const messageId = messageIdFromInput(input);
    const launchToken = launchTokenFrom(input, url, req);
    const tokenHash = launchTokenHash(launchToken);
    const acceptedAt = new Date().toISOString();
    Object.assign(input, {
      messageId,
      runId: messageId,
      traceId: input.traceId || input.trace_id || launch.traceId || runtimeSession.traceId || "",
      launchTokenHash: tokenHash,
    });
    await dispatchMessageRequest({ state, runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res });
  }

  async function handleMessageStatus(req, res, url, match) {
    const launchToken = launchTokenFrom({}, url, req);
    const launch = launchApi.verifyLaunchToken(launchToken);
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    const state = await readState();
    const record = messageStatusLookup({ state, tokenHash: launchTokenHash(launchToken), match, launch });
    if (!record) {
      sendJson(res, 404, { ok: false, error: "message_not_found" });
      return;
    }
    sendJson(res, 200, messageStatusPayload(record, state));
  }

  return {
    handleMessage,
    handleMessageStatus,
  };
}
