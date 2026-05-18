import { randomUUID } from "node:crypto";

import { recordWorkspaceFile } from "./workspace-storage.mjs";

const UPSTREAM_REPOSITORY = "https://github.com/gaofeng21cn/one-person-lab";

function text(value) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function ensureArrayField(db, key) {
  db[key] = Array.isArray(db[key]) ? db[key] : [];
  return db[key];
}

function userTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function workspaceIdFrom(input = {}) {
  return text(input.workspaceId || input.workspace_id);
}

function sessionIdFrom(input = {}) {
  return text(input.sessionId || input.session_id || input.oplSessionId || input.opl_session_id);
}

function entrypointFrom(input = {}) {
  return text(input.entrypoint || input.entry_point);
}

function publicUpstreamBoundary() {
  return {
    repository: UPSTREAM_REPOSITORY,
    sourceModified: false,
    internalModuleImports: false,
    gatewayBoundary: "opl-web-gateway",
    runtimeBridgeBoundary: "opl-runtime-bridge",
    runtimeBoundary: "runtime-agent-contract",
  };
}

function readinessFailureFromState(state = {}) {
  if (!state.providerBound || !text(state.providerKeyRef)) {
    return {
      ok: false,
      status: 409,
      error: "provider_key_required",
      code: "provider_key_required",
      providerBound: false,
      providerKeyRef: "",
    };
  }
  if (!state.managedEnvironmentEnabled || !text(state.resourceBinding?.resourceBindingId)) {
    return {
      ok: false,
      status: 409,
      error: "managed_environment_required",
      code: "managed_environment_required",
      providerBound: true,
      providerKeyRef: text(state.providerKeyRef),
      managedEnvironmentEnabled: false,
      resourceBinding: null,
    };
  }
  return null;
}

function resourceBindingIdFromState(state = {}) {
  return text(state.resourceBinding?.resourceBindingId || state.resourceBinding?.id);
}

function requireWorkspace(input = {}) {
  const workspaceId = workspaceIdFrom(input);
  if (!workspaceId) return { ok: false, status: 422, error: "workspace_required" };
  return { ok: true, workspaceId };
}

function requireSessionId(input = {}) {
  const sessionId = sessionIdFrom(input);
  if (!sessionId) return { ok: false, status: 422, error: "opl_session_required" };
  return { ok: true, sessionId };
}

function sessionMatches(session = {}, { user, workspaceId, resourceBindingId, sessionId } = {}) {
  return text(session.userId) === text(user.id)
    && text(session.tenantId) === userTenantId(user)
    && text(session.workspaceId) === text(workspaceId)
    && text(session.resourceBindingId) === text(resourceBindingId)
    && text(session.sessionId || session.oplSessionId) === text(sessionId)
    && text(session.status || "active") === "active";
}

function findOplWorkSession(db = {}, user = {}, { workspaceId = "", resourceBindingId = "", sessionId = "" } = {}) {
  return ensureArrayField(db, "oplWorkSessions")
    .find((item) => sessionMatches(item, { user, workspaceId, resourceBindingId, sessionId })) || null;
}

function fileNameFrom(input = {}) {
  return text(input.fileName || input.file_name || input.name || input.relativePath || input.relative_path);
}

function inputRelativePathFrom(input = {}) {
  const relativePath = fileNameFrom(input).replace(/^inputs\//, "");
  return text(relativePath);
}

function basename(relativePath = "") {
  const segments = text(relativePath).split("/").filter(Boolean);
  return segments[segments.length - 1] || text(relativePath);
}

function contentTypeFrom(input = {}) {
  return text(input.contentType || input.content_type);
}

function sizeBytesFrom(input = {}) {
  if (input.sizeBytes === undefined && input.size_bytes === undefined) return null;
  const size = Number(input.sizeBytes ?? input.size_bytes);
  if (!Number.isFinite(size) || size < 0) return null;
  return size;
}

function workspaceFilePublicView(file = {}) {
  return {
    id: text(file.id),
    fileRef: text(file.id),
    workspaceId: text(file.workspaceId),
    sessionId: text(file.oplSessionId || file.runId),
    kind: text(file.kind),
    name: text(file.name),
    relativePath: `${text(file.kind)}/${text(file.relativePath)}`,
    sizeBytes: Number(file.sizeBytes || 0),
    contentType: text(file.contentType),
    status: text(file.status || "active"),
    createdAt: text(file.createdAt),
    updatedAt: text(file.updatedAt),
  };
}

function recordInputFile(db, { user, workspaceId, sessionId, resourceBindingId, input } = {}) {
  const relativePath = inputRelativePathFrom(input);
  if (!relativePath) return { ok: false, status: 422, error: "file_name_required" };
  const contentType = contentTypeFrom(input);
  if (!contentType) return { ok: false, status: 422, error: "file_content_type_required" };
  const sizeBytes = sizeBytesFrom(input);
  if (sizeBytes === null) return { ok: false, status: 422, error: "file_size_required" };
  const recorded = recordWorkspaceFile(db, {
    id: `wf-${randomUUID()}`,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId,
    oplSessionId: sessionId,
    resourceBindingId,
    storageMode: "full_runtime",
    kind: "inputs",
    name: basename(relativePath),
    relativePath,
    sizeBytes,
    contentType,
    status: "active",
    source: "full_runtime_upload",
  });
  if (!recorded.ok) return recorded;
  return { ok: true, file: recorded.file };
}

function fileRefsFrom(input = {}) {
  const refs = Array.isArray(input.fileRefs) ? input.fileRefs : Array.isArray(input.file_refs) ? input.file_refs : [];
  return refs.map(text).filter(Boolean);
}

function messageFrom(input = {}) {
  return text(input.message || input.text || input.prompt);
}

function findInputFiles(db = {}, user = {}, { workspaceId = "", sessionId = "", resourceBindingId = "", fileRefs = [] } = {}) {
  const refs = new Set(fileRefs.map(text).filter(Boolean));
  if (!refs.size) return [];
  return ensureArrayField(db, "workspaceFiles")
    .filter((item) => refs.has(text(item.id)))
    .filter((item) => text(item.userId) === text(user.id))
    .filter((item) => text(item.tenantId) === userTenantId(user))
    .filter((item) => text(item.workspaceId) === workspaceId)
    .filter((item) => text(item.oplSessionId || item.runId) === sessionId)
    .filter((item) => text(item.resourceBindingId) === resourceBindingId)
    .filter((item) => text(item.kind) === "inputs")
    .filter((item) => text(item.status || "active") === "active");
}

function recordOutputArtifact(db, { user, workspaceId, sessionId, resourceBindingId, runId } = {}) {
  const relativePath = `runs/${runId}/output.md`;
  const content = `OPL run ${runId} output artifact reference`;
  const recorded = recordWorkspaceFile(db, {
    id: `artifact-${randomUUID()}`,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId,
    oplSessionId: sessionId,
    resourceBindingId,
    storageMode: "full_runtime",
    kind: "outputs",
    name: "output.md",
    relativePath,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    contentType: "text/markdown",
    status: "active",
    source: "runtime_agent_output",
  });
  if (!recorded.ok) return recorded;
  return { ok: true, artifact: recorded.file };
}

function traceMetadataFor({ sessionId = "", workspaceId = "", resourceBindingId = "", providerKeyRef = "", artifactRefs = [], auditTag = "", status = "succeeded", createdAt = "" } = {}) {
  const now = createdAt || nowIso();
  return {
    sessionId,
    workspaceId,
    resourceBindingId,
    providerKeyRef,
    artifactRefs: artifactRefs.map(text).filter(Boolean),
    status: text(status || "succeeded"),
    auditTag: text(auditTag),
    timestamps: {
      createdAt: now,
      updatedAt: now,
    },
  };
}

function traceMetadataPublicView(metadata = {}) {
  return {
    sessionId: text(metadata.sessionId),
    workspaceId: text(metadata.workspaceId),
    providerKeyRef: text(metadata.providerKeyRef),
    artifactRefs: Array.isArray(metadata.artifactRefs) ? metadata.artifactRefs.map(text).filter(Boolean) : [],
    status: text(metadata.status || "succeeded"),
    timestamps: metadata.timestamps || {},
  };
}

function sessionPublicView(session = {}) {
  return {
    sessionId: text(session.sessionId),
    oplSessionId: text(session.oplSessionId || session.sessionId),
    workspaceId: text(session.workspaceId),
    providerKeyRef: text(session.providerKeyRef),
    status: text(session.status || "active"),
    entrypoint: text(session.entrypoint),
    createdAt: text(session.createdAt),
    updatedAt: text(session.updatedAt),
  };
}

function runPublicView(run = {}) {
  return {
    runRef: text(run.runId),
    messageId: text(run.messageId),
    sessionId: text(run.sessionId),
    workspaceId: text(run.workspaceId),
    providerKeyRef: text(run.providerKeyRef),
    inputFileRefs: Array.isArray(run.inputFileRefs) ? run.inputFileRefs.map(text).filter(Boolean) : [],
    artifactRefs: Array.isArray(run.artifactRefs) ? run.artifactRefs.map(text).filter(Boolean) : [],
    status: text(run.status || "succeeded"),
    createdAt: text(run.createdAt),
    updatedAt: text(run.updatedAt),
  };
}

function messagePublicView(run = {}) {
  return {
    messageId: text(run.messageId),
    sessionId: text(run.sessionId),
    workspaceId: text(run.workspaceId),
    status: "accepted",
  };
}

function userNarrative() {
  return {
    entrypoint: "OPL 科研工作台",
    visibleActions: ["发送信息", "上传文件", "用文件跑任务", "下载输出文件"],
  };
}

function readyContext(input = {}, state = {}) {
  const workspace = requireWorkspace(input);
  if (!workspace.ok) return workspace;
  const readinessFailure = readinessFailureFromState(state);
  if (readinessFailure) return readinessFailure;
  return {
    ok: true,
    workspaceId: workspace.workspaceId,
    resourceBindingId: resourceBindingIdFromState(state),
    providerKeyRef: text(state.providerKeyRef),
  };
}

export function createOplWorkSession(db = {}, user = {}, input = {}, { state = {} } = {}) {
  const ready = readyContext(input, state);
  if (!ready.ok) return ready;
  const entrypoint = entrypointFrom(input);
  if (!entrypoint) return { ok: false, status: 422, error: "opl_entrypoint_required" };
  const now = nowIso();
  const session = {
    id: `opl-session-${randomUUID()}`,
    sessionId: `opl-session-${randomUUID()}`,
    oplSessionId: "",
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: ready.workspaceId,
    resourceBindingId: ready.resourceBindingId,
    providerKeyRef: ready.providerKeyRef,
    status: "active",
    entrypoint,
    upstreamSourceModified: false,
    createdAt: now,
    updatedAt: now,
  };
  session.oplSessionId = session.sessionId;
  ensureArrayField(db, "oplWorkSessions").push(session);
  return {
    ok: true,
    status: 201,
    created: true,
    userNarrative: userNarrative(),
    oplSession: sessionPublicView(session),
    upstream: publicUpstreamBoundary(),
  };
}

export function uploadOplWorkspaceFile(db = {}, user = {}, input = {}, { state = {} } = {}) {
  const ready = readyContext(input, state);
  if (!ready.ok) return ready;
  const session = requireSessionId(input);
  if (!session.ok) return session;
  const existingSession = findOplWorkSession(db, user, {
    workspaceId: ready.workspaceId,
    resourceBindingId: ready.resourceBindingId,
    sessionId: session.sessionId,
  });
  if (!existingSession) return { ok: false, status: 409, error: "opl_session_required" };
  const recorded = recordInputFile(db, {
    user,
    workspaceId: ready.workspaceId,
    sessionId: session.sessionId,
    resourceBindingId: ready.resourceBindingId,
    input,
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    status: 201,
    created: recorded.created,
    fileRef: workspaceFilePublicView(recorded.file),
    upstream: publicUpstreamBoundary(),
  };
}

export function runOplWorkWithFiles(db = {}, user = {}, input = {}, { state = {} } = {}) {
  const ready = readyContext(input, state);
  if (!ready.ok) return ready;
  const session = requireSessionId(input);
  if (!session.ok) return session;
  const existingSession = findOplWorkSession(db, user, {
    workspaceId: ready.workspaceId,
    resourceBindingId: ready.resourceBindingId,
    sessionId: session.sessionId,
  });
  if (!existingSession) return { ok: false, status: 409, error: "opl_session_required" };
  if (!messageFrom(input)) return { ok: false, status: 422, error: "message_required" };
  const fileRefs = fileRefsFrom(input);
  const inputFiles = findInputFiles(db, user, {
    workspaceId: ready.workspaceId,
    sessionId: session.sessionId,
    resourceBindingId: ready.resourceBindingId,
    fileRefs,
  });
  if (!fileRefs.length || inputFiles.length !== fileRefs.length) {
    return { ok: false, status: 422, error: "workspace_file_required" };
  }

  const now = nowIso();
  const runId = `opl-run-${randomUUID()}`;
  const messageId = `opl-message-${randomUUID()}`;
  const output = recordOutputArtifact(db, {
    user,
    workspaceId: ready.workspaceId,
    sessionId: session.sessionId,
    resourceBindingId: ready.resourceBindingId,
    runId,
  });
  if (!output.ok) return output;
  const artifactRef = workspaceFilePublicView(output.artifact);
  const run = {
    id: runId,
    runId,
    messageId,
    sessionId: session.sessionId,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: ready.workspaceId,
    resourceBindingId: ready.resourceBindingId,
    providerKeyRef: ready.providerKeyRef,
    inputFileRefs: fileRefs,
    artifactRefs: [artifactRef.fileRef],
    status: "succeeded",
    createdAt: now,
    updatedAt: now,
  };
  ensureArrayField(db, "oplWorkRuns").push(run);
  const traceMetadata = traceMetadataFor({
    sessionId: session.sessionId,
    workspaceId: ready.workspaceId,
    resourceBindingId: ready.resourceBindingId,
    providerKeyRef: ready.providerKeyRef,
    artifactRefs: run.artifactRefs,
    auditTag: text(state.resourceBinding?.auditTag),
    status: run.status,
    createdAt: now,
  });
  ensureArrayField(db, "oplWorkTraceMetadata").push(traceMetadata);
  return {
    ok: true,
    status: 201,
    created: true,
    message: messagePublicView(run),
    run: runPublicView(run),
    artifacts: [artifactRef],
    traceMetadata: traceMetadataPublicView(traceMetadata),
    upstream: publicUpstreamBoundary(),
  };
}

export function downloadOplOutputArtifact(db = {}, user = {}, input = {}, { state = {} } = {}) {
  const ready = readyContext(input, state);
  if (!ready.ok) return ready;
  const fileRef = text(input.fileRef || input.file_ref || input.artifactRef || input.artifact_ref);
  if (!fileRef) return { ok: false, status: 422, error: "artifact_required" };
  const file = ensureArrayField(db, "workspaceFiles")
    .find((item) => text(item.id) === fileRef
      && text(item.userId) === text(user.id)
      && text(item.tenantId) === userTenantId(user)
      && text(item.workspaceId) === ready.workspaceId
      && text(item.resourceBindingId) === ready.resourceBindingId
      && text(item.kind) === "outputs"
      && text(item.status || "active") === "active");
  if (!file) return { ok: false, status: 404, error: "artifact_not_found" };
  return {
    ok: true,
    download: {
      ...workspaceFilePublicView(file),
      downloadMode: "file_reference_only",
    },
    upstream: publicUpstreamBoundary(),
  };
}
