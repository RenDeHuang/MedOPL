import http from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  addArtifactRecord,
  addCostRecord,
  addEvent,
  addRunAction,
  addTraceRecord,
  artifactsRoot,
  createRunRecord,
  createRuntimeSession,
  createWorkspaceSession,
  ensureRuntime,
  nowIso,
  readState,
  slugify,
  updateRunStatus,
  upsertWorkspace,
  writeState,
} from "./state-store.mjs";
import {
  bindWorkspace,
  createSession as createOplSession,
  getOplWebUrl,
  getBootstrap as getOplBootstrap,
} from "./opl-client.mjs";
import {
  createWorkspace as createRunnerWorkspace,
  getRunStatus,
  listOutputs,
  submitRun,
} from "./runner-client.mjs";

const PORT = Number(process.env.PORT || 8788);
const BASE_URL = String(process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const LAUNCH_SECRET = process.env.OPL_LAUNCH_SECRET || "dev-opl-launch-secret-change-me";
const RUNNER_IMAGE = process.env.MED_AUTOSCIENCE_RUNNER_IMAGE || "";
const K8S_NAMESPACE = process.env.K8S_NAMESPACE || "med-agent-demo";
const NODE_ENV = String(process.env.NODE_ENV || "development").toLowerCase();

function signLaunchPayload(payload) {
  return createHmac("sha256", LAUNCH_SECRET).update(payload).digest("hex");
}

function makeLaunchToken(record) {
  const body = Buffer.from(JSON.stringify(record), "utf8").toString("base64url");
  return `${body}.${signLaunchPayload(body)}`;
}

function verifyLaunchToken(token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) return null;
  const expected = signLaunchPayload(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (parsed.expiresAt && Date.parse(parsed.expiresAt) <= Date.now()) return null;
  return parsed;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function isTerminal(status = "") {
  return ["succeeded", "failed", "cancelled", "timed_out"].includes(String(status || "").toLowerCase());
}

function buildOplWebUrl(launchToken) {
  const oplWebUrl = getOplWebUrl();
  if (oplWebUrl) {
    const url = new URL(oplWebUrl);
    url.searchParams.set("launch_token", launchToken);
    url.searchParams.set("portal_adapter_url", BASE_URL);
    return url.toString();
  }
  if (NODE_ENV === "production") {
    throw new Error("OPL_WEB_URL is required in production");
  }
  throw new Error("OPL_WEB_URL is required; adapter /workbench projection has been retired");
}

function buildCallbacks() {
  return {
    bootstrap: `${BASE_URL}/api/opl-launch/bootstrap`,
    sessionBind: `${BASE_URL}/api/opl-launch/sessions/bind`,
    startRun: `${BASE_URL}/api/opl-launch/runs`,
    runStatus: `${BASE_URL}/api/opl-launch/runs/{runId}/status`,
    artifacts: `${BASE_URL}/api/opl-launch/runs/{runId}/artifacts`,
  };
}

function localResources(state, launch) {
  const workspaces = state.workspaces.filter((item) =>
    item.portalUserId === launch.portalUserId &&
    (!launch.workspaceId || item.workspaceId === launch.workspaceId)
  );
  const sessions = state.workspaceSessions.filter((item) =>
    item.portalUserId === launch.portalUserId &&
    (!launch.workspaceId || item.workspaceId === launch.workspaceId)
  );
  return {
    system: { id: "local-opl-fixture-required", status: "fixture-only" },
    engines: [],
    modules: [],
    agents: [],
    workspaces,
    sessions,
    progress: state.events.filter((item) => item.portalUserId === launch.portalUserId).slice(-20),
    artifacts: [],
  };
}

function resolveTenantId(detail = {}, fallback = "") {
  return detail.tenantId || detail.tenant_id || detail.portalUserId || detail.portal_user_id || fallback || "";
}

function resolveOwnerId(detail = {}, fallback = "") {
  return detail.ownerId || detail.owner_id || detail.portalUserId || detail.portal_user_id || fallback || "";
}

function resolveStorageOwnerId(detail = {}, fallback = "") {
  return detail.storageOwnerId || detail.storage_owner_id || detail.storageOwner || detail.storage_owner || resolveOwnerId(detail, fallback);
}

function buildScope(launch = {}, runtimeSession = {}) {
  const portalUserId = launch.portalUserId || runtimeSession.portalUserId || "";
  const ownerId = resolveOwnerId(runtimeSession, resolveOwnerId(launch, portalUserId));
  const storageOwnerId = resolveStorageOwnerId(runtimeSession, resolveStorageOwnerId(launch, ownerId));
  return {
    portalUserId,
    tenantId: resolveTenantId(runtimeSession, resolveTenantId(launch, portalUserId)),
    ownerId,
    storageOwnerId,
    workspaceId: runtimeSession.workspaceId || launch.workspaceId || "",
    workspaceTitle: launch.workspaceTitle || runtimeSession.workspaceTitle || runtimeSession.workspaceId || launch.workspaceId || "",
    workspacePath: runtimeSession.workspacePath || launch.workspacePath || "",
    workspaceSessionId: runtimeSession.workspaceSessionId || launch.workspaceSessionId || "",
    runtimeSessionId: runtimeSession.runtimeSessionId || launch.runtimeSessionId || "",
    oplSessionId: runtimeSession.oplSessionId || launch.oplSessionId || "",
  };
}

function itemMatchesScope(item, scope) {
  if (!item || typeof item !== "object") return false;
  const ownerCandidates = [
    item.portalUserId,
    item.userId,
    item.ownerId,
    item.sessionOwnerId,
    item.traceOwnerId,
    item.artifactOwnerId,
    item.storageOwnerId,
    item.storageOwner,
  ].filter(Boolean);
  if (scope.portalUserId && ownerCandidates.length && !ownerCandidates.includes(scope.portalUserId)) {
    return false;
  }
  if (scope.workspaceId && item.workspaceId && item.workspaceId !== scope.workspaceId) {
    return false;
  }
  if (scope.workspaceSessionId && item.workspaceSessionId && item.workspaceSessionId !== scope.workspaceSessionId) {
    return false;
  }
  if (scope.runtimeSessionId && item.runtimeSessionId && item.runtimeSessionId !== scope.runtimeSessionId) {
    return false;
  }
  return true;
}

function withScope(item = {}, scope, overrides = {}) {
  const ownerId = resolveOwnerId(item, scope.ownerId);
  const storageOwnerId = resolveStorageOwnerId(item, scope.storageOwnerId || ownerId);
  return {
    ...item,
    portalUserId: item.portalUserId || scope.portalUserId,
    tenantId: resolveTenantId(item, scope.tenantId),
    ownerId,
    workspaceId: item.workspaceId || scope.workspaceId,
    workspaceSessionId: item.workspaceSessionId || scope.workspaceSessionId,
    runtimeSessionId: item.runtimeSessionId || scope.runtimeSessionId,
    inputOwner: item.inputOwner || ownerId,
    outputOwner: item.outputOwner || ownerId,
    sessionOwnerId: item.sessionOwnerId || ownerId,
    traceOwnerId: item.traceOwnerId || ownerId,
    artifactOwnerId: item.artifactOwnerId || ownerId,
    storageOwner: item.storageOwner || storageOwnerId,
    storageOwnerId,
    ...overrides,
  };
}

function scopedCollection(items, scope, overrides = {}) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => itemMatchesScope(item, scope))
    .map((item) => withScope(item, scope, overrides));
}

async function buildBootstrap(state, launch) {
  const runtimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === launch.runtimeSessionId);
  const context = runtimeSession || launch;
  const scope = buildScope(launch, runtimeSession || {});
  let oplResources;
  try {
    oplResources = await getOplBootstrap(context);
    addEvent(state, "opl_bootstrap_loaded", context);
  } catch (error) {
    if (NODE_ENV === "production") throw error;
    oplResources = localResources(state, launch);
    addEvent(state, "opl_bootstrap_load_failed", { ...context, error: String(error.message || error) });
  }

  const adapterRuns = scopedCollection(state.runs, scope);
  const adapterArtifacts = scopedCollection(state.artifacts, scope);
  const adapterProgress = scopedCollection(state.events.slice(-200), scope, {
    sessionId: scope.runtimeSessionId || scope.workspaceSessionId,
  }).slice(-50);
  const runs = adapterRuns;
  const runActions = scopedCollection(state.runActions, scope);
  const traces = scopedCollection(state.traceLinks, scope);
  const costs = scopedCollection(state.costRecords, scope);
  const workspaces = scopedCollection(
    oplResources.workspaces?.length ? oplResources.workspaces : state.workspaces,
    scope,
    { workspacePath: scope.workspacePath || undefined }
  );
  const sessions = scopedCollection(
    oplResources.sessions?.length ? oplResources.sessions : state.workspaceSessions,
    scope,
    { oplSessionId: scope.oplSessionId || undefined }
  );
  const progress = scopedCollection([...(oplResources.progress || []), ...adapterProgress], scope, {
    sessionId: scope.runtimeSessionId || scope.workspaceSessionId,
  });
  const artifacts = scopedCollection([...(oplResources.artifacts || []), ...adapterArtifacts], scope, {
    workspacePath: scope.workspacePath || undefined,
  });
  const runtimeSessionView = runtimeSession ? withScope(runtimeSession, scope) : null;

  return {
    version: "v1",
    launch,
    identity: {
      portalUserId: scope.portalUserId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      workspaceSessionId: scope.workspaceSessionId,
      runtimeSessionId: scope.runtimeSessionId,
      oplSessionId: scope.oplSessionId,
    },
    ownership: {
      workspaceOwnerId: scope.ownerId,
      sessionOwnerId: scope.ownerId,
      traceOwnerId: scope.ownerId,
      artifactOwnerId: scope.ownerId,
      storageOwnerId: scope.storageOwnerId,
      inputOwner: scope.ownerId,
      outputOwner: scope.ownerId,
    },
    portal: {
      portalUserId: scope.portalUserId,
      userId: scope.portalUserId,
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      portalUserEmail: launch.portalUserEmail || "",
      userEmail: launch.portalUserEmail || "",
      portalUserName: launch.portalUserName || "",
      userName: launch.portalUserName || "",
      workspaceId: scope.workspaceId,
      workspaceSessionId: scope.workspaceSessionId,
      runtimeSessionId: scope.runtimeSessionId,
    },
    entitlements: {
      agents: ["mas", "mag", "rca"],
      canStartRun: true,
    },
    workspace: {
      workspaceId: scope.workspaceId,
      workspaceTitle: scope.workspaceTitle,
      workspacePath: scope.workspacePath,
      ownerId: scope.ownerId,
      inputOwner: scope.ownerId,
      outputOwner: scope.ownerId,
      storageOwner: scope.storageOwnerId,
      storageOwnerId: scope.storageOwnerId,
    },
    session: {
      workspaceSessionId: scope.workspaceSessionId,
      runtimeSessionId: scope.runtimeSessionId,
      oplSessionId: scope.oplSessionId,
      ownerId: scope.ownerId,
      tenantId: scope.tenantId,
      traceOwnerId: scope.ownerId,
    },
    storage: {
      workspaceId: scope.workspaceId,
      workspacePath: scope.workspacePath,
      ownerId: scope.storageOwnerId,
      tenantId: scope.tenantId,
    },
    callbacks: buildCallbacks(),
    system: oplResources.system,
    engines: oplResources.engines || [],
    modules: oplResources.modules || [],
    agents: oplResources.agents || [],
    runtimeSession: runtimeSessionView,
    opl: {
      health: oplResources.health || null,
    },
    resources: {
      system: oplResources.system,
      engines: oplResources.engines || [],
      modules: oplResources.modules || [],
      agents: oplResources.agents || [],
      workspaces,
      sessions,
      progress,
      artifacts,
    },
    runs,
    runActions,
    traces,
    costs,
  };
}

function runContextFromRuntime(runtimeSession, input, req) {
  const runId = input.runId || input.run_id || randomUUID();
  return {
    portalUserId: runtimeSession.portalUserId,
    tenantId: input.tenantId || input.tenant_id || runtimeSession.tenantId || runtimeSession.portalUserId,
    customerId: runtimeSession.portalUserId,
    userId: runtimeSession.portalUserId,
    workspaceId: runtimeSession.workspaceId,
    workspaceSessionId: runtimeSession.workspaceSessionId,
    runtimeSessionId: runtimeSession.runtimeSessionId,
    runId,
    agentId: input.agentId || input.agent_id || "mas",
    toolName: input.toolName || input.tool_name || "med-autoscience",
    billingScope: input.billingScope || input.billing_scope || "run",
    costCenter: input.costCenter || input.cost_center || "research-foundry",
    serverPlanId: input.serverPlanId || input.server_plan_id || runtimeSession.serverPlanId || "default",
    region: input.region || runtimeSession.region || "",
    model: input.model || "opl-runtime",
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    userAgent: req.headers["user-agent"] || "",
    runnerImage: input.runnerImage || input.runner_image || RUNNER_IMAGE,
    namespace: input.namespace || K8S_NAMESPACE,
  };
}

async function submitRuntimeRun(state, runtimeSession, input, req) {
  const context = runContextFromRuntime(runtimeSession, input, req);
  const startedAt = Date.now();
  await createRunnerWorkspace(context);
  addRunAction(state, { ...context, actionType: "runner_workspace_created", summary: "Runner workspace created.", status: "succeeded" });
  const submitted = await submitRun(context);
  const run = createRunRecord(state, {
    ...context,
    ...submitted,
    status: submitted.status || "submitted",
    latencyMs: Date.now() - startedAt,
    userAgent: context.userAgent,
    tokenCount: context.tokenCount,
    model: context.model,
  });
  addRunAction(state, { ...run, actionType: "runner_run_submitted", summary: "med-autoscience runner accepted run.", status: run.status });
  addTraceRecord(state, {
    ...run,
    status: run.status,
    latencyMs: run.latencyMs,
    model: context.model,
    tokenCount: context.tokenCount,
    userAgent: context.userAgent,
  });
  addCostRecord(state, {
    ...run,
    status: "pending",
    pricingSource: "opencost-pending",
    totalCost: null,
  });
  return run;
}

async function syncRunnerRun(state, run, runStatus = null) {
  const latest = runStatus || await getRunStatus(run.runId);
  const patched = updateRunStatus(state, run.runId, {
    status: latest.status || run.status,
    jobName: latest.jobName || run.jobName,
    namespace: latest.namespace || run.namespace,
    manifestPath: latest.manifestPath || run.manifestPath,
    finishedAt: latest.finishedAt || run.finishedAt,
    error: latest.error || run.error || "",
  });
  if (!patched) return null;

  if (isTerminal(patched.status)) {
    const outputs = await listOutputs(patched);
    for (const output of outputs) {
      addArtifactRecord(state, {
        ...patched,
        name: output.name || "",
        objectKey: output.objectKey || output.object_key || "",
        localPath: output.path || output.localPath || "",
        sizeBytes: output.sizeBytes || output.size_bytes || 0,
        contentType: output.contentType || output.content_type || "application/octet-stream",
      });
    }
  }
  return patched;
}

function sendRetired(res, message, replacement = "") {
  sendJson(res, 410, {
    ok: false,
    error: "legacy_endpoint_retired",
    message,
    replacement,
  });
}

function bindOplSession(state, launch, input = {}) {
  const runtimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === launch.runtimeSessionId);
  if (!runtimeSession) return null;
  const oplSessionId = input.oplSessionId || input.opl_session_id || input.sessionId || input.session_id || "";
  if (oplSessionId) runtimeSession.oplSessionId = oplSessionId;
  runtimeSession.status = input.status || runtimeSession.status || "ready";
  runtimeSession.lastActiveAt = nowIso();
  addEvent(state, "opl_session_bound", {
    ...runtimeSession,
    oplSessionId: runtimeSession.oplSessionId || "",
    source: "opl-web",
  });
  return runtimeSession;
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", BASE_URL);
  if (req.method === "GET" && url.pathname === "/healthz") {
    sendJson(res, 200, { ok: true, service: "portal-opl-adapter", runtimeRoot: artifactsRoot });
    return;
  }

  if (req.method === "GET" && url.pathname === "/workbench") {
    sendRetired(res, "adapter /workbench dev projection 已退场；请打开 OPL_WEB_URL，并由 OPL Web 使用 launch token 拉 bootstrap。", "OPL_WEB_URL");
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/launch-tokens") {
    sendRetired(res, "旧 /api/launch-tokens 已退场；Portal 现在通过 /api/opl-launch/tokens 签发 OPL Web launch。", "/api/opl-launch/tokens");
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/opl-launch/tokens") {
    const input = await readBody(req);
    const state = await readState();
    const workspace = upsertWorkspace(state, input);
    const workspaceSession = createWorkspaceSession(state, { ...input, workspaceId: workspace.workspaceId });
  const runtimeSession = createRuntimeSession(state, {
      ...input,
      tenantId: input.tenantId || input.tenant_id || input.portalUserId,
      ownerId: input.ownerId || input.owner_id || input.portalUserId,
      sessionOwnerId: input.sessionOwnerId || input.session_owner_id || input.portalUserId,
      storageOwnerId: input.storageOwnerId || input.storage_owner_id || input.portalUserId,
      workspaceId: workspace.workspaceId,
      workspaceSessionId: workspaceSession.workspaceSessionId,
      namespace: K8S_NAMESPACE,
      image: RUNNER_IMAGE,
    });
    const portalContext = {
      portalUserId: input.portalUserId,
      portalUserEmail: input.portalUserEmail || "",
      portalUserName: input.portalUserName || "",
      tenantId: input.tenantId || input.tenant_id || input.portalUserId,
      ownerId: input.ownerId || input.owner_id || input.portalUserId,
      workspaceId: workspace.workspaceId,
      workspaceTitle: workspace.title,
      workspacePath: input.workspacePath || input.workspace_path || workspace.workspacePath || "",
      projectId: input.projectId || input.project_id || input.moduleId || input.module_id || workspace.projectId || "",
      workspaceSessionId: workspaceSession.workspaceSessionId,
      runtimeSessionId: runtimeSession.runtimeSessionId,
      sourceSurface: input.sourceSurface || "portal-control-plane",
    };
    try {
      await bindWorkspace(portalContext);
      const oplSession = await createOplSession(portalContext);
      runtimeSession.oplSessionId = oplSession.id || oplSession.sessionId || "";
      if (oplSession.status === "deferred") {
        addEvent(state, "opl_session_create_deferred", { ...portalContext, reason: oplSession.reason || "" });
      }
    } catch (error) {
      if (NODE_ENV === "production") throw error;
      addEvent(state, "opl_launch_bind_failed", { ...portalContext, error: String(error.message || error) });
    }

    const launchRecord = {
      launchId: randomUUID(),
      portalUserId: input.portalUserId,
      tenantId: input.tenantId || input.tenant_id || input.portalUserId,
      ownerId: input.ownerId || input.owner_id || input.portalUserId,
      sessionOwnerId: input.sessionOwnerId || input.session_owner_id || input.portalUserId,
      traceOwnerId: input.traceOwnerId || input.trace_owner_id || input.portalUserId,
      artifactOwnerId: input.artifactOwnerId || input.artifact_owner_id || input.portalUserId,
      storageOwnerId: input.storageOwnerId || input.storage_owner_id || input.portalUserId,
      portalUserEmail: input.portalUserEmail || "",
      portalUserName: input.portalUserName || "",
      workspaceId: workspace.workspaceId,
      workspaceTitle: workspace.title,
      workspacePath: portalContext.workspacePath || "",
      workspaceSessionId: workspaceSession.workspaceSessionId,
      runtimeSessionId: runtimeSession.runtimeSessionId,
      source: "portal-control-plane",
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    const launchToken = makeLaunchToken(launchRecord);
    const oplWebUrl = buildOplWebUrl(launchToken);
    const bootstrapUrl = `${BASE_URL}/api/opl-launch/bootstrap?launch_token=${encodeURIComponent(launchToken)}`;
    state.launchTokens.push({ ...launchRecord, launchToken, oplWebUrl, bootstrapUrl });
    addEvent(state, "opl_launch_created", launchRecord);
    await writeState(state);
    sendJson(res, 200, {
      ok: true,
      ...launchRecord,
      launchToken,
      oplWebUrl,
      bootstrapUrl,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/workbench/bootstrap") {
    sendRetired(res, "旧 /api/workbench/bootstrap 已退场；OPL Web 必须使用 /api/opl-launch/bootstrap。", "/api/opl-launch/bootstrap");
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/opl-launch/bootstrap") {
    const launch = verifyLaunchToken(url.searchParams.get("launch_token") || "");
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    const state = await readState();
    const bootstrap = await buildBootstrap(state, launch);
    await writeState(state);
    sendJson(res, 200, bootstrap);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/opl-launch/runs") {
    const input = await readBody(req);
    const launch = verifyLaunchToken(input.launchToken || input.launch_token || url.searchParams.get("launch_token") || "");
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    const state = await readState();
    const runtimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === launch.runtimeSessionId);
    if (!runtimeSession) {
      sendJson(res, 404, { ok: false, error: "runtime_session_not_found" });
      return;
    }
    try {
      const run = await submitRuntimeRun(state, runtimeSession, input, req);
      await writeState(state);
      sendJson(res, 200, { ok: true, run });
    } catch (error) {
      addEvent(state, "runner_run_failed", { ...runtimeSession, error: String(error.message || error) });
      await writeState(state);
      sendJson(res, 502, { ok: false, error: String(error.message || error) });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/opl-launch/sessions/bind") {
    const input = await readBody(req);
    const launch = verifyLaunchToken(input.launchToken || input.launch_token || url.searchParams.get("launch_token") || "");
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    const state = await readState();
    const runtimeSession = bindOplSession(state, launch, input);
    if (!runtimeSession) {
      sendJson(res, 404, { ok: false, error: "runtime_session_not_found" });
      return;
    }
    await writeState(state);
    sendJson(res, 200, { ok: true, runtimeSession });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/runtime-sessions") {
    sendRetired(res, "旧 /api/runtime-sessions 已退场；runtime/session 由 OPL Web 与 OPL runtime 管理，Portal 只通过 launch/bootstrap 绑定。", "/api/opl-launch/sessions/bind");
    return;
  }

  const runMatch = url.pathname.match(/^\/api\/runtime-sessions\/([^/]+)\/runs$/);
  if (req.method === "POST" && runMatch) {
    sendRetired(res, "旧 /api/runtime-sessions/:id/runs 已退场；run 必须由 OPL Web 携带 launch token 调 /api/opl-launch/runs。", "/api/opl-launch/runs");
    return;
  }

  const statusMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/status$/) || url.pathname.match(/^\/api\/opl-launch\/runs\/([^/]+)\/status$/);
  if (req.method === "GET" && statusMatch) {
    const state = await readState();
    const run = state.runs.find((item) => item.runId === statusMatch[1]);
    if (!run) {
      sendJson(res, 404, { ok: false, error: "run_not_found" });
      return;
    }
    const synced = await syncRunnerRun(state, run);
    await writeState(state);
    sendJson(res, 200, { ok: true, run: synced || run });
    return;
  }

  const artifactsMatch = url.pathname.match(/^\/api\/opl-launch\/runs\/([^/]+)\/artifacts$/);
  if (req.method === "GET" && artifactsMatch) {
    const state = await readState();
    const run = state.runs.find((item) => item.runId === artifactsMatch[1]);
    if (!run) {
      sendJson(res, 404, { ok: false, error: "run_not_found" });
      return;
    }
    await syncRunnerRun(state, run).catch((error) => {
      addEvent(state, "runner_artifact_sync_failed", { ...run, error: String(error.message || error) });
      return null;
    });
    await writeState(state);
    sendJson(res, 200, { ok: true, items: state.artifacts.filter((item) => item.runId === artifactsMatch[1]) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/runs") {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.runs });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/artifacts") {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.artifacts });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/trace-links") {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.traceLinks, runActions: state.runActions });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/cost-records") {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.costRecords });
    return;
  }

  sendJson(res, 404, { ok: false, error: "not_found", path: url.pathname });
}

await ensureRuntime();
http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { ok: false, error: String(error.message || error) });
  });
}).listen(PORT, () => {
  console.log(JSON.stringify({ ok: true, service: "portal-opl-adapter", port: PORT, baseUrl: BASE_URL }, null, 2));
});
