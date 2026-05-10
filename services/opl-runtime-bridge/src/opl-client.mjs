import {
  bindAcpWorkspace,
  createAcpSession,
  getAcpBootstrap,
  hasOplAcpRuntime,
  initializeAcpRuntime,
  promptAcpRuntime,
} from "./opl-acp-runtime-client.mjs";
import {
  bindWebuiWorkspace,
  createWebuiSession,
  getWebuiBootstrap,
  hasOplWebuiBridge,
  sendWebuiMessage,
} from "./opl-webui-bridge-client.mjs";

const PRODUCT_API_URL = String(process.env.OPL_PRODUCT_API_URL || "").replace(/\/$/, "");
const PRODUCT_API_TOKEN = String(process.env.OPL_PRODUCT_API_TOKEN || "");
const OPL_WEB_URL = String(process.env.OPL_WEB_URL || "").replace(/\/$/, "");
const DEFAULT_PROJECT_ID = String(process.env.OPL_DEFAULT_PROJECT_ID || process.env.OPL_WORKSPACE_PROJECT_ID || "medautoscience").trim();
const DEFAULT_WORKSPACE_PATH = String(process.env.OPL_DEFAULT_WORKSPACE_PATH || process.env.OPL_WORKSPACE_PATH || "").trim();
const DEFAULT_WORKSPACE_ROOT = String(process.env.OPL_WORKSPACE_ROOT || "").trim();
const DEFAULT_ENTRY_COMMAND = String(process.env.OPL_WORKSPACE_ENTRY_COMMAND || "").trim();
const DEFAULT_MANIFEST_COMMAND = String(process.env.OPL_WORKSPACE_MANIFEST_COMMAND || "").trim();
const DEFAULT_ENTRY_URL = String(process.env.OPL_WORKSPACE_ENTRY_URL || "").trim();
const DEFAULT_PROFILE_REF = String(process.env.OPL_WORKSPACE_PROFILE_REF || "").trim();
const DEFAULT_INPUT_PATH = String(process.env.OPL_WORKSPACE_INPUT_PATH || "").trim();

class OplProductApiError extends Error {
  constructor(path, status, payload) {
    super(extractErrorMessage(payload) || `opl_product_api_failed:${status}:${path}`);
    this.name = "OplProductApiError";
    this.path = path;
    this.status = status;
    this.payload = payload;
  }
}

function requireProductApiUrl() {
  if (!PRODUCT_API_URL) {
    throw new Error("OPL_PRODUCT_API_URL is required for OPL bootstrap");
  }
  return PRODUCT_API_URL;
}

function authHeaders() {
  return PRODUCT_API_TOKEN ? { authorization: `Bearer ${PRODUCT_API_TOKEN}` } : {};
}

function productApiUrl(path) {
  const base = requireProductApiUrl();
  const relativePath = String(path || "").replace(/^\/+/, "");
  return new URL(relativePath, `${base}/`);
}

function extractErrorMessage(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.message === "string") return payload.message;
  if (payload.error && typeof payload.error === "object") {
    return payload.error.message || payload.error.code || JSON.stringify(payload.error);
  }
  return "";
}

async function requestJson(path, options = {}) {
  const response = await fetch(productApiUrl(path), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new OplProductApiError(path, response.status, payload);
  }
  return payload;
}

async function requestFirstAvailable(paths, options = {}, retryStatuses = [404, 405]) {
  let lastError = null;
  for (const path of paths) {
    try {
      return await requestJson(path, options);
    } catch (error) {
      lastError = error;
      if (!retryStatuses.includes(Number(error.status || 0))) {
        throw error;
      }
    }
  }
  throw lastError || new Error(`opl_product_api_paths_unavailable:${paths.join(",")}`);
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function candidateRecords(payload, key) {
  const records = [];
  const visit = (value) => {
    if (!isRecord(value)) return;
    records.push(value);
    for (const nestedKey of ["data", "result", "payload", "resources"]) {
      if (isRecord(value[nestedKey])) records.push(value[nestedKey]);
    }
    if (key && isRecord(value[key])) records.push(value[key]);
  };
  visit(payload);
  if (isRecord(payload)) {
    for (const nestedKey of ["data", "result", "payload", "resources"]) {
      visit(payload[nestedKey]);
    }
  }
  return records;
}

function collectionFromRecord(record, collectionKeys) {
  for (const collectionKey of collectionKeys) {
    if (Array.isArray(record[collectionKey])) return record[collectionKey];
  }
  return null;
}

function itemsFrom(payload, key, collectionKeys = ["items", key]) {
  if (Array.isArray(payload)) return payload;
  for (const record of candidateRecords(payload, key)) {
    const collection = collectionFromRecord(record, collectionKeys);
    if (collection) return collection;
  }
  for (const record of candidateRecords(payload, key)) {
    if (isRecord(record[key])) return [record[key]];
  }
  return [];
}

function artifactItemsFrom(payload) {
  const combined = [];
  for (const record of candidateRecords(payload, "artifacts")) {
    for (const key of ["items", "deliverable_files", "supporting_files", "artifacts"]) {
      if (Array.isArray(record[key])) combined.push(...record[key]);
    }
    if (combined.length) return combined;
  }
  return itemsFrom(payload, "artifacts");
}

function firstFrom(payload, key, preferredKeys = []) {
  for (const record of candidateRecords(payload, key)) {
    for (const preferredKey of preferredKeys) {
      if (isRecord(record[preferredKey])) return record[preferredKey];
    }
  }
  for (const record of candidateRecords(payload, key)) {
    if (isRecord(record[key])) return record[key];
  }
  return payload;
}

function maybeSet(target, key, value) {
  if (value !== undefined && value !== null && String(value).trim() !== "") {
    target[key] = value;
  }
}

function buildWorkspaceBindPayload(portalContext = {}) {
  const projectId =
    portalContext.projectId ||
    portalContext.project_id ||
    portalContext.moduleId ||
    portalContext.module_id ||
    DEFAULT_PROJECT_ID;
  const workspacePath =
    portalContext.workspacePath ||
    portalContext.workspace_path ||
    DEFAULT_WORKSPACE_PATH;
  const workspaceRoot =
    portalContext.workspaceRoot ||
    portalContext.workspace_root ||
    DEFAULT_WORKSPACE_ROOT;
  const payload = {
    ...portalContext,
    projectId,
    project_id: projectId,
    label: portalContext.label || portalContext.workspaceTitle || portalContext.workspace_title || portalContext.workspaceId || portalContext.workspace_id,
    portal_context: {
      portalUserId: portalContext.portalUserId || portalContext.portal_user_id || "",
      portalUserEmail: portalContext.portalUserEmail || portalContext.portal_user_email || "",
      workspaceId: portalContext.workspaceId || portalContext.workspace_id || "",
      workspaceSessionId: portalContext.workspaceSessionId || portalContext.workspace_session_id || "",
      runtimeSessionId: portalContext.runtimeSessionId || portalContext.runtime_session_id || "",
      sourceSurface: portalContext.sourceSurface || portalContext.source_surface || "portal-control-plane",
    },
  };
  maybeSet(payload, "workspacePath", workspacePath);
  maybeSet(payload, "workspace_path", workspacePath);
  maybeSet(payload, "workspaceRoot", workspaceRoot);
  maybeSet(payload, "workspace_root", workspaceRoot);
  maybeSet(payload, "entryCommand", portalContext.entryCommand || portalContext.entry_command || DEFAULT_ENTRY_COMMAND);
  maybeSet(payload, "entry_command", portalContext.entryCommand || portalContext.entry_command || DEFAULT_ENTRY_COMMAND);
  maybeSet(payload, "manifestCommand", portalContext.manifestCommand || portalContext.manifest_command || DEFAULT_MANIFEST_COMMAND);
  maybeSet(payload, "manifest_command", portalContext.manifestCommand || portalContext.manifest_command || DEFAULT_MANIFEST_COMMAND);
  maybeSet(payload, "entryUrl", portalContext.entryUrl || portalContext.entry_url || DEFAULT_ENTRY_URL);
  maybeSet(payload, "entry_url", portalContext.entryUrl || portalContext.entry_url || DEFAULT_ENTRY_URL);
  maybeSet(payload, "profileRef", portalContext.profileRef || portalContext.profile_ref || DEFAULT_PROFILE_REF);
  maybeSet(payload, "profile_ref", portalContext.profileRef || portalContext.profile_ref || DEFAULT_PROFILE_REF);
  maybeSet(payload, "inputPath", portalContext.inputPath || portalContext.input_path || DEFAULT_INPUT_PATH);
  maybeSet(payload, "input_path", portalContext.inputPath || portalContext.input_path || DEFAULT_INPUT_PATH);
  return payload;
}

function sessionCreateRequiresGoal(error) {
  const text = `${error?.message || ""} ${JSON.stringify(error?.payload || {})}`.toLowerCase();
  return Number(error?.status || 0) === 400 && text.includes("goal");
}

export function hasOplProductApi() {
  return Boolean(PRODUCT_API_URL);
}

function useAcpRuntime() {
  return hasOplAcpRuntime() && !PRODUCT_API_URL;
}

function useWebuiBridge() {
  return hasOplWebuiBridge() && !PRODUCT_API_URL && !useAcpRuntime();
}

export function getOplWebUrl() {
  return OPL_WEB_URL;
}

export async function getSystem() {
  if (useWebuiBridge()) return (await getWebuiBootstrap()).system;
  if (useAcpRuntime()) return (await getAcpBootstrap()).system;
  return firstFrom(await requestJson("/api/opl/system"), "system");
}

export async function getHealth() {
  if (useWebuiBridge()) return (await getWebuiBootstrap()).health;
  if (useAcpRuntime()) {
    const initialized = await initializeAcpRuntime();
    return {
      ok: true,
      source: "opl_acp_runtime",
      surfaceId: initialized.surface_id || "",
      version: initialized.version || "",
      commands: initialized.commands || [],
    };
  }
  return requestFirstAvailable(["/api/health", "/healthz"]);
}

export async function getRuntimeStatus() {
  return requestJson("/api/status/runtime");
}

export async function getWorkspaceStatus(context = {}) {
  const params = new URLSearchParams();
  if (context.workspacePath || context.workspace_path) {
    params.set("path", context.workspacePath || context.workspace_path);
  }
  const suffix = params.toString() ? `?${params}` : "";
  return requestJson(`/api/status/workspace${suffix}`);
}

export async function getSessionLedger(context = {}) {
  const params = new URLSearchParams();
  if (context.limit) params.set("limit", String(context.limit));
  const suffix = params.toString() ? `?${params}` : "";
  return requestJson(`/api/session/ledger${suffix}`);
}

export async function listEngines() {
  return itemsFrom(await requestJson("/api/opl/engines"), "engines");
}

export async function listModules() {
  return itemsFrom(await requestJson("/api/opl/modules"), "modules");
}

export async function listAgents() {
  return itemsFrom(await requestJson("/api/opl/agents"), "agents");
}

export async function bindWorkspace(portalContext) {
  if (useWebuiBridge()) return bindWebuiWorkspace(portalContext);
  if (useAcpRuntime()) return bindAcpWorkspace(portalContext);
  const payload = await requestFirstAvailable(["/api/opl/workspaces/bind", "/api/opl/workspaces"], {
    method: "POST",
    body: JSON.stringify(buildWorkspaceBindPayload(portalContext)),
  });
  return firstFrom(payload, "workspaces", ["binding", "workspace"]);
}

export async function listWorkspaces(context = {}) {
  const params = new URLSearchParams();
  for (const key of ["portalUserId", "workspaceId"]) {
    if (context[key]) params.set(key, context[key]);
  }
  const suffix = params.toString() ? `?${params}` : "";
  return itemsFrom(await requestJson(`/api/opl/workspaces${suffix}`), "workspaces", ["items", "projects", "bindings", "workspaces"]);
}

export async function createSession(portalContext) {
  if (useWebuiBridge()) return createWebuiSession(portalContext);
  if (useAcpRuntime()) return createAcpSession(portalContext);
  try {
    return firstFrom(await requestJson("/api/opl/sessions", {
      method: "POST",
      body: JSON.stringify(portalContext),
    }), "session_create", ["session", "task"]);
  } catch (error) {
    if (!sessionCreateRequiresGoal(error)) throw error;
    return {
      id: "",
      sessionId: "",
      status: "deferred",
      reason: "opl_session_create_requires_goal",
      message: "真实 OPL 的 /api/opl/sessions 是 domain ask/session 创建入口；Portal launch 阶段不伪造 goal，因此延后到实际 run/ask 时创建。",
    };
  }
}

function readPromptText(input = {}) {
  const prompt = input.prompt || input.message || input.text || input.content || input.input?.message || "";
  const normalized = String(prompt || "").trim();
  if (!normalized) {
    throw new Error("opl_message_prompt_required");
  }
  return normalized;
}

function inputSessionId(input = {}) {
  return input.oplSessionId || input.opl_session_id || input.sessionId || input.session_id || input.runtimeSessionId || input.runtime_session_id || "";
}

function inputMessageId(input = {}) {
  return input.messageId || input.message_id || "";
}

async function sendMessageViaAcp(input, prompt) {
  const result = await promptAcpRuntime({
    sessionId: inputSessionId(input),
    prompt,
    cwd: input.workspacePath || input.workspace_path || "",
    runtimeEnv: input.runtimeEnv || input.runtime_env || {},
  });
  return {
    messageId: inputMessageId(input),
    sessionId: result.session_id || "",
    runtimeSessionId: result.runtime_session_id || "",
    reply: result.response,
    source: "opl_acp_runtime",
    stopReason: result.stop_reason || "end_turn",
  };
}

function normalizeProductMessage(record = {}, payload = {}) {
  const reply = String(record.reply || record.response || record.text || record.content || "").trim();
  if (!reply) {
    throw new Error("opl_message_empty_reply");
  }
  return {
    ...record,
    messageId: record.messageId || record.message_id || payload.messageId || payload.message_id || "",
    sessionId: record.sessionId || record.session_id || payload.oplSessionId || payload.opl_session_id || "",
    runtimeSessionId: record.runtimeSessionId || record.runtime_session_id || payload.runtimeSessionId || payload.runtime_session_id || "",
    reply,
    source: record.source || "opl_product_api",
    stopReason: record.stopReason || record.stop_reason || "end_turn",
  };
}

async function sendMessageViaProductApi(input, prompt) {
  const payload = sanitizedProductApiMessagePayload(input, prompt);
  const result = await requestFirstAvailable([
    "/api/opl/messages",
    "/api/opl/sessions/messages",
    "/api/opl/chat/messages",
  ], {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const record = firstFrom(result, "message", ["message", "reply", "response"]);
  return normalizeProductMessage(record, payload);
}

const PRODUCT_API_FORBIDDEN_MESSAGE_FIELDS = new Set([
  "apikey",
  "api_key",
  "providerapikey",
  "provider_api_key",
  "rawproviderkey",
  "raw_provider_key",
  "providerconfigsecretref",
  "provider_config_secret_ref",
  "providersecret",
  "provider_secret",
  "secretfingerprint",
  "secret_fingerprint",
  "launchtoken",
  "launch_token",
  "launchtokenhash",
  "launch_token_hash",
  "runtimetoken",
  "runtime_token",
  "bearertoken",
  "bearer_token",
  "runtimeenv",
  "runtime_env",
]);

function sanitizedProductApiMessagePayload(input = {}, prompt = "") {
  const payload = {};
  for (const [key, value] of Object.entries(input || {})) {
    const normalized = key.replace(/[^a-z0-9_]/gi, "").toLowerCase();
    if (PRODUCT_API_FORBIDDEN_MESSAGE_FIELDS.has(normalized)) continue;
    payload[key] = value;
  }
  payload.providerKeyRef = input.providerKeyRef || input.provider_key_ref || input.providerConfigSecretRef || input.provider_config_secret_ref || "";
  payload.providerConfigured = input.providerConfigured === true || input.provider_configured === true;
  payload.providerConfigStatus = input.providerConfigStatus || input.provider_config_status || (payload.providerConfigured ? "configured" : "missing");
  payload.message = prompt;
  return payload;
}

export async function sendMessage(input = {}) {
  const prompt = readPromptText(input);
  if (useWebuiBridge()) return sendWebuiMessage({ ...input, prompt });
  return useAcpRuntime()
    ? sendMessageViaAcp(input, prompt)
    : sendMessageViaProductApi(input, prompt);
}

export async function listSessions(context = {}) {
  const params = new URLSearchParams();
  for (const key of ["portalUserId", "workspaceId", "workspaceSessionId", "runtimeSessionId"]) {
    if (context[key]) params.set(key, context[key]);
  }
  if (context.limit) params.set("limit", String(context.limit));
  if (context.source) params.set("source", String(context.source));
  const suffix = params.toString() ? `?${params}` : "";
  return itemsFrom(await requestJson(`/api/opl/sessions${suffix}`), "sessions");
}

export async function listProgress(context = {}) {
  const params = new URLSearchParams();
  for (const key of ["portalUserId", "workspaceId", "workspaceSessionId", "runtimeSessionId"]) {
    if (context[key]) params.set(key, context[key]);
  }
  if (context.workspacePath || context.workspace_path) params.set("workspace_path", context.workspacePath || context.workspace_path);
  if (context.oplSessionId || context.opl_session_id || context.sessionId || context.session_id) {
    params.set("session_id", context.oplSessionId || context.opl_session_id || context.sessionId || context.session_id);
  }
  if (context.taskId || context.task_id) params.set("task_id", context.taskId || context.task_id);
  const suffix = params.toString() ? `?${params}` : "";
  return itemsFrom(await requestJson(`/api/opl/progress${suffix}`), "progress", ["items", "progress"]);
}

export async function listArtifacts(context = {}) {
  const params = new URLSearchParams();
  for (const key of ["portalUserId", "workspaceId", "workspaceSessionId", "runtimeSessionId"]) {
    if (context[key]) params.set(key, context[key]);
  }
  if (context.workspacePath || context.workspace_path) params.set("workspace_path", context.workspacePath || context.workspace_path);
  if (context.oplSessionId || context.opl_session_id || context.sessionId || context.session_id) {
    params.set("session_id", context.oplSessionId || context.opl_session_id || context.sessionId || context.session_id);
  }
  const suffix = params.toString() ? `?${params}` : "";
  return artifactItemsFrom(await requestJson(`/api/opl/artifacts${suffix}`));
}

export async function getBootstrap(runtimeSession = {}) {
  if (useWebuiBridge()) return getWebuiBootstrap(runtimeSession);
  if (useAcpRuntime()) return getAcpBootstrap(runtimeSession);
  const [health, system, engines, modules, agents, workspaces, sessions, progress, artifacts] = await Promise.all([
    getHealth(),
    getSystem(),
    listEngines(),
    listModules(),
    listAgents(),
    listWorkspaces(runtimeSession),
    listSessions(runtimeSession),
    listProgress(runtimeSession),
    listArtifacts(runtimeSession),
  ]);
  return {
    health,
    system,
    engines,
    modules,
    agents,
    workspaces,
    sessions,
    progress,
    artifacts,
  };
}
