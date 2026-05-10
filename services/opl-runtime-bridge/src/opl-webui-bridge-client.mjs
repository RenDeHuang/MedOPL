import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

const WEBUI_BRIDGE_URL = String(process.env.OPL_WEBUI_BRIDGE_URL || process.env.OPL_WEB_URL || "").replace(/\/$/, "");
const WEBUI_BRIDGE_TIMEOUT_MS = Number(process.env.OPL_WEBUI_BRIDGE_TIMEOUT_MS || 15000);
const WEBUI_BRIDGE_REPLY_TIMEOUT_MS = Number(process.env.OPL_WEBUI_BRIDGE_REPLY_TIMEOUT_MS || 120000);
const WEBUI_BRIDGE_REPLY_POLL_MS = Number(process.env.OPL_WEBUI_BRIDGE_REPLY_POLL_MS || 1000);

export class OplWebuiCapabilityError extends Error {
  constructor(capability, message, details = {}) {
    super(message || `opl_webui_capability_not_supported:${capability}`);
    this.name = "OplWebuiCapabilityError";
    this.code = "capability_not_supported";
    this.capability = capability;
    this.details = details;
    this.status = 409;
  }
}

export function hasOplWebuiBridge() {
  return String(process.env.OPL_RUNTIME_MODE || "").trim().toLowerCase() === "webui";
}

function requireBridgeUrl() {
  if (!WEBUI_BRIDGE_URL) throw new Error("OPL_WEBUI_BRIDGE_URL or OPL_WEB_URL is required for OPL WebUI bridge mode");
  return WEBUI_BRIDGE_URL;
}

function bridgeWsUrl() {
  const parsed = new URL(requireBridgeUrl());
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function bridgeConversationId(context = {}) {
  return String(
    context.oplSessionId ||
    context.opl_session_id ||
    context.runtimeSessionId ||
    context.runtime_session_id ||
    `portal-webui-${Date.now()}`,
  ).trim();
}

function text(value = "") {
  return String(value ?? "").trim();
}

function firstText(...values) {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return "";
}

function stableRef(prefix, parts = []) {
  const hash = createHash("sha256")
    .update(parts.map((part) => text(part)).join(":"))
    .digest("hex")
    .slice(0, 24);
  return `${prefix}-${hash}`;
}

function safeHashPrefix(value = "") {
  const normalized = text(value);
  if (!normalized) return "";
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function record(value = {}) {
  return value && typeof value === "object" ? value : {};
}

function messageCreatedAt(message = {}) {
  message = record(message);
  return Number(
    message.createdAt ||
    message.created_at ||
    message.timestamp ||
    message.time ||
    message.updatedAt ||
    message.updated_at ||
    0
  ) || 0;
}

function messageRole(message = {}) {
  message = record(message);
  return text(
    message.role ||
    message.position ||
    message.sender ||
    message.type ||
    (message.content && typeof message.content === "object" ? message.content.role : "")
  ).toLowerCase();
}

function messageText(message = {}) {
  message = record(message);
  if (typeof message.content === "string") return text(message.content);
  if (message.content && typeof message.content === "object") {
    return firstText(
      message.content.content,
      message.content.text,
      message.content.data,
      message.content.message,
      message.content.value,
    );
  }
  return firstText(message.text, message.reply, message.response, message.data, message.message);
}

function messageId(message = {}) {
  message = record(message);
  return firstText(message.msg_id, message.messageId, message.message_id, message.id);
}

function isAssistantReply(message = {}, clientMessageId = "") {
  const role = messageRole(message);
  if (role === "right" || role === "user" || role === "user_content") return false;
  const id = messageId(message);
  if (clientMessageId && id === clientMessageId) return false;
  const content = messageText(message);
  if (!content) return false;
  return role === "left" ||
    role === "assistant" ||
    role === "content" ||
    role === "text" ||
    role === "agent_status" ||
    role === "" ||
    message.position === "left";
}

function latestAssistantReply(messages = [], clientMessageId = "", sentAt = 0) {
  return [...messages]
    .filter((message) => message && typeof message === "object")
    .filter((message) => isAssistantReply(message, clientMessageId))
    .filter((message) => !sentAt || !messageCreatedAt(message) || messageCreatedAt(message) >= sentAt)
    .sort((left, right) => messageCreatedAt(right) - messageCreatedAt(left))[0] || null;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function observeAssistantReply(bridge, {
  conversationId = "",
  clientMessageId = "",
  startedAt = 0,
  explicitReply = "",
} = {}) {
  const deadline = Date.now() + Math.max(1, WEBUI_BRIDGE_REPLY_TIMEOUT_MS);
  let messages = [];
  let replyMessage = null;
  while (Date.now() <= deadline) {
    messages = await bridge.invoke("database.get-conversation-messages", { conversation_id: conversationId }, 5000)
      .then((items) => Array.isArray(items) ? items : [])
      .catch(() => []);
    replyMessage = latestAssistantReply(messages, clientMessageId, startedAt);
    const reply = explicitReply || messageText(replyMessage);
    if (reply) return { reply, replyMessage, messages, timedOut: false };
    await sleep(Math.max(100, WEBUI_BRIDGE_REPLY_POLL_MS));
  }
  return { reply: "", replyMessage, messages, timedOut: true };
}

function providerInvocationRefFrom({ conversationId = "", messageId = "", replyMessageId = "", streamEvents = [] } = {}) {
  const eventNames = streamEvents.map((event) => event?.name || "").filter(Boolean).join(",");
  return stableRef("opl-provider-invocation", [conversationId, messageId, replyMessageId, eventNames]);
}

function normalizedReplyMetadata({ reply = "", replyMessage = {}, streamEvents = [], startedAt = 0, finishedAt = 0 } = {}) {
  return {
    role: "assistant",
    replyLength: reply.length,
    replyHashPrefix: safeHashPrefix(reply),
    finishStatus: "observed",
    latencyMs: startedAt && finishedAt ? Math.max(0, finishedAt - startedAt) : 0,
    streamEventCount: streamEvents.length,
    createdAt: messageCreatedAt(replyMessage) || finishedAt || Date.now(),
  };
}

function bridgeWorkspacePath(context = {}) {
  return String(context.workspacePath || context.workspace_path || "").trim();
}

function normalizeConversation(item = {}) {
  return {
    sessionId: String(item.id || item.sessionId || "").trim(),
    oplSessionId: String(item.id || item.oplSessionId || item.sessionId || "").trim(),
    workspaceSessionId: String(item.workspaceSessionId || item.workspace_session_id || "").trim(),
    runtimeSessionId: String(item.runtimeSessionId || item.runtime_session_id || "").trim(),
    portalUserId: String(item.portalUserId || item.portal_user_id || item.userId || "").trim(),
    tenantId: String(item.tenantId || item.tenant_id || "").trim(),
    workspaceId: String(item.workspaceId || item.workspace_id || "").trim(),
    status: String(item.status || "active").trim(),
    source: String(item.source || "aionui").trim(),
    createdAt: String(item.createdAt || item.created_at || "").trim(),
    updatedAt: String(item.updatedAt || item.updated_at || "").trim(),
  };
}

function withContext(item = {}, context = {}) {
  return {
    ...item,
    portalUserId: item.portalUserId || context.portalUserId || context.portal_user_id || "",
    tenantId: item.tenantId || context.tenantId || context.tenant_id || "",
    workspaceId: item.workspaceId || context.workspaceId || context.workspace_id || "",
    workspaceSessionId: item.workspaceSessionId || context.workspaceSessionId || context.workspace_session_id || "",
    runtimeSessionId: item.runtimeSessionId || context.runtimeSessionId || context.runtime_session_id || "",
  };
}

async function connectBridge() {
  const ws = new WebSocket(bridgeWsUrl());
  const pending = new Map();
  const streamEvents = [];

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.name === "ping") {
      ws.send(JSON.stringify({ name: "pong", data: { timestamp: Date.now() } }));
      return;
    }
    if (message.name === "chat.response.stream" || message.name === "conversation.turn.completed") {
      streamEvents.push({ name: message.name });
    }
    const entry = pending.get(message.name);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(message.name);
    entry.resolve(message.data);
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const invoke = (key, data, timeoutMs = WEBUI_BRIDGE_TIMEOUT_MS) => {
    const id = `portal_adapter_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const callbackEventName = `subscribe.callback-${key}${id}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(callbackEventName);
        reject(new Error(`timeout:${key}`));
      }, timeoutMs);
      pending.set(callbackEventName, { resolve, reject, timer });
      ws.send(JSON.stringify({
        name: `subscribe-${key}`,
        data: { id, data },
      }));
    });
  };

  return {
    invoke,
    streamEvents,
    close() {
      ws.close();
    },
  };
}

async function withBridge(callback) {
  const bridge = await connectBridge();
  try {
    return await callback(bridge);
  } finally {
    bridge.close();
  }
}

async function probeHttpCatchAll(endpoint) {
  const response = await fetch(new URL(endpoint, `${requireBridgeUrl()}/`), {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  const payload = await response.json().catch(() => ({}));
  return {
    endpoint,
    status: response.status,
    classification: payload.message === "API endpoint - bridge integration working"
      ? "catch_all_placeholder_not_product_api"
      : "unknown_http_shape",
  };
}

export async function getWebuiBootstrap(context = {}) {
  const httpProductApi = {};
  for (const endpoint of ["/api/opl/system", "/api/opl/sessions", "/api/opl/messages"]) {
    httpProductApi[endpoint] = await probeHttpCatchAll(endpoint);
  }
  const currentConversationId = bridgeConversationId(context);
  const conversations = await withBridge(async (bridge) =>
    bridge.invoke("database.get-user-conversations", { page: 0, pageSize: 50 }, WEBUI_BRIDGE_TIMEOUT_MS)
  );
  const sessions = (Array.isArray(conversations) ? conversations : [])
    .filter((item) => item?.id === currentConversationId)
    .map((item) => withContext(normalizeConversation(item), context));

  return {
    health: {
      ok: true,
      source: "opl_webui_bridge",
    },
    system: {
      id: "opl-webui-bridge",
      status: "ready",
      source: "opl_webui_bridge",
    },
    engines: [],
    modules: [],
    agents: [],
    workspaces: context.workspaceId || context.workspace_id ? [{
      workspaceId: context.workspaceId || context.workspace_id || "",
      workspaceTitle: context.workspaceTitle || context.workspace_title || "",
      workspacePath: bridgeWorkspacePath(context),
      source: "portal_context",
    }] : [],
    sessions,
    progress: [],
    artifacts: [],
    capabilityClassification: {
      browserWebui: "real_webui_process_available",
      httpProductApi: "capability_not_supported",
      httpProductApiDetails: httpProductApi,
      websocketBridgeSession: "real_webui_bridge_roundtrip",
      websocketBridgeMessage: "capability_not_supported",
    },
  };
}

export async function bindWebuiWorkspace(context = {}) {
  return {
    id: context.workspaceId || context.workspace_id || "",
    workspaceId: context.workspaceId || context.workspace_id || "",
    workspaceTitle: context.workspaceTitle || context.workspace_title || "",
    workspacePath: bridgeWorkspacePath(context),
    workspaceSessionId: context.workspaceSessionId || context.workspace_session_id || "",
    runtimeSessionId: context.runtimeSessionId || context.runtime_session_id || "",
    source: "opl_webui_bridge",
    status: "bound",
  };
}

export async function createWebuiSession(context = {}) {
  return withBridge(async (bridge) => {
    const conversationId = bridgeConversationId(context);
    const created = await bridge.invoke("create-conversation", {
      id: conversationId,
      type: "acp",
      name: context.workspaceTitle || context.workspace_title || "Portal OPL Session",
      extra: {
        workspace: bridgeWorkspacePath(context) || path.join(process.cwd(), ".runtime", "opl-webui-workspace"),
        backend: "codex",
        customWorkspace: true,
        presetContext: "Portal OPL adapter context. Do not read secrets.",
      },
    }, WEBUI_BRIDGE_TIMEOUT_MS * 2);
    const sessions = await bridge.invoke("database.get-user-conversations", { page: 0, pageSize: 50 }, WEBUI_BRIDGE_TIMEOUT_MS);
    if (!Array.isArray(sessions) || !sessions.some((item) => item?.id === conversationId)) {
      throw new Error("opl_webui_session_database_roundtrip_missing");
    }
    return {
      id: created?.id || conversationId,
      sessionId: created?.id || conversationId,
      status: "ready",
      source: created?.source || "aionui",
      databaseConversationRoundtrip: true,
    };
  });
}

export async function sendWebuiMessage(input = {}) {
  const conversationId = bridgeConversationId(input);
  const prompt = String(input.prompt || input.message || input.text || "").trim();
  if (!prompt) throw new Error("opl_message_prompt_required");
  return withBridge(async (bridge) => {
    const clientMessageId = input.messageId || input.message_id || `message-${Date.now()}`;
    const startedAt = Date.now();
    const result = await bridge.invoke("chat.send.message", {
      conversation_id: conversationId,
      msg_id: clientMessageId,
      input: prompt,
      files: [],
    }, WEBUI_BRIDGE_TIMEOUT_MS).then(
      (payload) => ({ ok: true, payload }),
      (error) => ({ ok: false, error: String(error.message || error) }),
    );
    const explicitReply = String(result.payload?.reply || result.payload?.response || result.payload?.text || "").trim();
    const { reply, replyMessage, messages } = await observeAssistantReply(bridge, {
      conversationId,
      clientMessageId,
      startedAt,
      explicitReply,
    });
    if (reply) {
      const finishedAt = Date.now();
      const replyMessageId = messageId(replyMessage) || stableRef("opl-reply", [conversationId, clientMessageId, safeHashPrefix(reply)]);
      const messageTraceId = text(input.messageTraceId || input.message_trace_id) ||
        stableRef("opl-message-trace", [input.traceId || input.trace_id, conversationId, clientMessageId, replyMessageId]);
      const providerInvocationRef = providerInvocationRefFrom({
        conversationId,
        messageId: clientMessageId,
        replyMessageId,
        streamEvents: bridge.streamEvents,
      });
      return {
        messageId: clientMessageId,
        clientMessageId: input.clientMessageId || input.client_message_id || clientMessageId,
        replyMessageId,
        messageTraceId,
        providerInvocationRef,
        capabilitySource: "mapped_to_webui_bridge",
        oplConversationId: conversationId,
        oplSessionId: conversationId,
        sessionId: conversationId,
        runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
        reply,
        replyMetadata: normalizedReplyMetadata({
          reply,
          replyMessage,
          streamEvents: bridge.streamEvents,
          startedAt,
          finishedAt,
        }),
        providerMetadata: {
          providerInvocationRef,
          providerModelRef: input.model || input.providerModelRef || input.provider_model_ref || "codex",
          providerAuthorizationStatus: "authorized",
        },
        source: "opl_webui_bridge",
        stopReason: "end_turn",
      };
    }
    throw new OplWebuiCapabilityError("websocket_bridge_message", "OPL WebUI bridge message reply is not supported in this canary environment", {
      sendReturned: result.ok,
      reason: result.ok ? "message_send_did_not_persist_reply" : result.error,
      persistedMessageCount: messages.length,
      streamEventCount: bridge.streamEvents.length,
      promptHashPrefix: safeHashPrefix(prompt),
      messageId: clientMessageId,
      oplConversationId: conversationId,
    });
  });
}
