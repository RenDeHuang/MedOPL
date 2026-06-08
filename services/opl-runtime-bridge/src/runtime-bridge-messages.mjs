import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  addArtifactRecord,
} from "./state-store-artifact-trace-mutations.mjs";
import {
  addMessageReplyRecord,
} from "./state-store-message-reply-mutations.mjs";
import {
  addRunAction,
} from "./state-store-run-action-mutations.mjs";
import { artifactsRoot } from "./state-store-paths.mjs";
import { sendMessage } from "./opl-client.mjs";
import { readProviderSecret } from "./provider-secret-store.mjs";

function trimText(value = "") {
  return String(value || "").trim();
}

function messageTextFrom(input = {}) {
  const text = trimText(input.message || input.text || input.prompt || input.input?.message);
  if (!text) throw new Error("message_text_required");
  return text;
}

function messageIdFrom(input = {}) {
  return trimText(input.messageId || input.message_id || input.runId || input.run_id) || randomUUID();
}

function promptPreviewMetadata(message = "") {
  const content = String(message || "");
  if (!content) return "";
  const digest = createHash("sha256").update(content).digest("hex").slice(0, 16);
  return `len:${content.length};sha256:${digest}`;
}

function buildMessageContext(runtimeSession, input = {}, req = {}) {
  const messageId = messageIdFrom(input);
  const message = messageTextFrom(input);
  return {
    messageId,
    runId: messageId,
    traceId: input.traceId || input.trace_id || runtimeSession.traceId || "",
    tenantId: runtimeSession.tenantId || runtimeSession.portalUserId,
    portalUserId: runtimeSession.portalUserId,
    ownerId: runtimeSession.ownerId || runtimeSession.portalUserId,
    storageOwnerId: runtimeSession.storageOwnerId || runtimeSession.ownerId || runtimeSession.portalUserId,
    workspaceId: runtimeSession.workspaceId,
    workspacePath: runtimeSession.workspacePath || "",
    workspaceSessionId: runtimeSession.workspaceSessionId,
    runtimeSessionId: runtimeSession.runtimeSessionId,
    oplSessionId: runtimeSession.oplSessionId || "",
    message,
    model: input.model || runtimeSession.model || "opl-runtime",
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    providerConfigured: Boolean(runtimeSession.providerConfigured),
    providerConfigStatus: runtimeSession.providerConfigStatus || (runtimeSession.providerConfigured ? "configured" : "missing"),
    providerKeyRef: runtimeSession.providerKeyRef || runtimeSession.providerConfigSecretRef || "",
    providerConfigSecretRef: runtimeSession.providerConfigSecretRef || "",
    providerName: runtimeSession.providerName || "",
    userAgent: req.headers?.["user-agent"] || "",
  };
}

function assertProviderConfigured(context) {
  if (context.providerConfigured && context.providerConfigSecretRef) return;
  throw new Error("provider_config_required");
}

function providerRuntimeEnv(secret) {
  if (!secret?.apiKey) return {};
  return {
    ...(secret.codexHome ? { CODEX_HOME: secret.codexHome } : {}),
    OPL_CODEX_MODEL_PROVIDER: "gflab",
    OPL_CODEX_PROVIDER_NAME: "gflab",
    OPL_CODEX_BASE_URL: "https://gflabtoken.cn/v1",
    OPL_CODEX_MODEL: "gpt-5.5",
    OPL_CODEX_REASONING_EFFORT: "xhigh",
    OPL_CODEX_API_KEY: secret.apiKey,
    OPENAI_API_KEY: secret.apiKey,
    GFLABTOKEN: secret.apiKey,
  };
}

function shouldReadProviderSecretForRuntime() {
  const runtimeMode = String(process.env.OPL_RUNTIME_MODE || "").trim().toLowerCase();
  return runtimeMode === "acp" || Boolean(String(process.env.OPL_ACP_RUNTIME_COMMAND_JSON || "").trim());
}

function artifactName(messageId) {
  return `${messageId}-reply.md`;
}

function markdownReply(context, reply) {
  return [
    "# OPL Message Reply",
    "",
    `- messageId: ${context.messageId}`,
    `- workspaceId: ${context.workspaceId}`,
    `- runtimeSessionId: ${context.runtimeSessionId}`,
    "",
    "## Reply",
    "",
    reply,
    "",
  ].join("\n");
}

async function writeReplyArtifact(context, reply) {
  if (!context.workspaceId) {
    throw new Error("workspace_id_required");
  }
  const workspaceDir = path.join(artifactsRoot, context.portalUserId || "unknown-user", context.workspaceId);
  await mkdir(workspaceDir, { recursive: true });
  const fileName = artifactName(context.messageId);
  const localPath = path.join(workspaceDir, fileName);
  const content = markdownReply(context, reply);
  await writeFile(localPath, content, "utf8");
  return {
    name: fileName,
    localPath,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    contentType: "text/markdown; charset=utf-8",
  };
}

export function createMessageApi({ publishTraceEvent }) {
  async function submitMessage(state, runtimeSession, input = {}, req = {}) {
    const context = buildMessageContext(runtimeSession, input, req);
    assertProviderConfigured(context);
    const acpStartedAt = new Date().toISOString();
    addRunAction(state, {
      ...context,
      actionType: "opl_message_prompt_started",
      summary: "OPL message prompt submitted to runtime.",
      status: "started",
      startedAt: acpStartedAt,
    });
    const providerSecret = shouldReadProviderSecretForRuntime()
      ? await readProviderSecret(context.providerConfigSecretRef)
      : null;
    const response = await sendMessage({
      ...context,
      prompt: context.message,
      sessionId: context.oplSessionId || context.runtimeSessionId,
      runtimeEnv: providerRuntimeEnv(providerSecret),
    });
    const acpEndedAt = new Date().toISOString();
    const reply = trimText(response.reply || response.response || response.text);
    if (!reply) throw new Error("message_reply_empty");

    const file = await writeReplyArtifact(context, reply);
    const persistedAt = new Date().toISOString();
    const message = addMessageReplyRecord(state, {
      ...context,
      replyMessageId: response.replyMessageId || response.reply_message_id || "",
      messageTraceId: response.messageTraceId || response.message_trace_id || "",
      providerInvocationRef: response.providerInvocationRef || response.provider_invocation_ref || "",
      capabilitySource: response.capabilitySource || response.capability_source || response.source || "",
      providerModelRef: response.providerMetadata?.providerModelRef || response.providerModelRef || response.provider_model_ref || "",
      providerAuthorizationStatus: response.providerMetadata?.providerAuthorizationStatus || response.providerAuthorizationStatus || response.provider_authorization_status || "",
      replyMetadata: response.replyMetadata || response.reply_metadata || null,
      reply,
      source: response.source || "opl_runtime",
      promptPreview: promptPreviewMetadata(context.message),
      status: "succeeded",
    });
    const artifact = addArtifactRecord(state, {
      ...context,
      kind: "message_reply",
      name: file.name,
      localPath: file.localPath,
      sizeBytes: file.sizeBytes,
      contentType: file.contentType,
    });
    addRunAction(state, {
      ...context,
      actionType: "opl_message_reply_persisted",
      summary: "OPL message reply persisted as workspace artifact.",
      status: "succeeded",
      startedAt: persistedAt,
      finishedAt: persistedAt,
    });
    const trace = await publishTraceEvent(state, {
      ...context,
      traceId: response.messageTraceId || response.message_trace_id || context.traceId,
      replyMessageId: response.replyMessageId || response.reply_message_id || "",
      providerInvocationRef: response.providerInvocationRef || response.provider_invocation_ref || "",
      capabilitySource: response.capabilitySource || response.capability_source || response.source || "",
      eventType: "message_reply",
      traceName: "OPL message reply",
      status: "succeeded",
      model: context.model,
      tokenCount: context.tokenCount,
      userAgent: context.userAgent,
    });
    const tracePublishedAt = new Date().toISOString();
    return {
      message,
      artifact,
      trace,
      timing: {
        acpStartedAt,
        acpEndedAt,
        persistedAt,
        tracePublishedAt,
      },
    };
  }

  return {
    submitMessage,
  };
}
