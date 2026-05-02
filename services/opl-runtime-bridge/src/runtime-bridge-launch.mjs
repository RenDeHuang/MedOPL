import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  addEvent,
  artifactsRoot,
  createRuntimeSession,
  createWorkspaceSession,
  nowIso,
  readState,
  runtimeRoot,
  writeState,
  upsertWorkspace,
} from "./state-store.mjs";
import {
  bindWorkspace,
  createSession as createOplSession,
  getBootstrap as getOplBootstrap,
  getOplWebUrl,
} from "./opl-client.mjs";

function firstNonEmpty(values = []) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function resolveTenantId(detail = {}, fallback = "") {
  return firstNonEmpty([detail.tenantId, detail.tenant_id, detail.portalUserId, detail.portal_user_id, fallback]);
}

function resolveOwnerId(detail = {}, fallback = "") {
  return firstNonEmpty([detail.ownerId, detail.owner_id, detail.portalUserId, detail.portal_user_id, fallback]);
}

function resolveStorageOwnerId(detail = {}, fallback = "") {
  return firstNonEmpty([detail.storageOwnerId, detail.storage_owner_id, detail.storageOwner, detail.storage_owner]) || resolveOwnerId(detail, fallback);
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

export function createLaunchApi({
  baseUrl,
  launchSecret,
  buildSha,
  buildTime,
  runtimeMode,
  oplWebUrl,
  runnerUrl,
  portalInternalBaseUrl,
  k8sNamespace,
  runnerImage,
  nodeEnv,
  langfusePublisher,
  publishTraceEvent,
}) {
  function buildStatusPayload() {
    return {
      ok: true,
      service: "portal-opl-adapter",
      build: {
        sha: buildSha,
        time: buildTime,
      },
      identity: {
        launchMode: "portal-launch-token",
        runtimeMode,
      },
      storage: {
        stateRoot: runtimeRoot,
        artifactsRoot,
      },
      runtime: {
        adapterPublicUrl: baseUrl,
        oplWebUrl: oplWebUrl || null,
        runnerUrl: runnerUrl || null,
        portalInternalBaseUrl: portalInternalBaseUrl || null,
        namespace: k8sNamespace,
        runnerImage: runnerImage || null,
      },
      trace: {
        publisherConfigured: langfusePublisher.configured(),
        provider: "langfuse_api",
      },
    };
  }

  function signLaunchPayload(payload) {
    return createHmac("sha256", launchSecret).update(payload).digest("hex");
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

  function buildOplLaunchUrl(launchToken) {
    const resolvedOplWebUrl = getOplWebUrl();
    if (resolvedOplWebUrl) {
      const url = new URL(resolvedOplWebUrl);
      url.searchParams.set("launch_token", launchToken);
      url.searchParams.set("portal_adapter_url", baseUrl);
      return url.toString();
    }
    if (nodeEnv === "production") {
      throw new Error("OPL_WEB_URL is required in production");
    }
    throw new Error("OPL_WEB_URL is required; adapter /workbench projection has been retired");
  }

  function buildCallbacks() {
    return {
      bootstrap: `${baseUrl}/api/opl-launch/bootstrap`,
      sessionBind: `${baseUrl}/api/opl-launch/sessions/bind`,
      startRun: `${baseUrl}/api/opl-launch/runs`,
      runStatus: `${baseUrl}/api/opl-launch/runs/{runId}/status`,
      artifacts: `${baseUrl}/api/opl-launch/runs/{runId}/artifacts`,
    };
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
      if (nodeEnv === "production") throw error;
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
    const traces = scopedCollection(
      state.traceLinks.filter((item) => String(item?.runId || "").trim()),
      scope
    );
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
      provider: {
        providerConfigured: Boolean(runtimeSession?.providerConfigured),
        providerConfigStatus: runtimeSession?.providerConfigStatus || (runtimeSession?.providerConfigured ? "configured" : "missing"),
        providerName: runtimeSession?.providerName || "",
        providerBaseUrl: runtimeSession?.providerBaseUrl || "",
        modelProvider: runtimeSession?.modelProvider || "",
        model: runtimeSession?.model || "",
        modelReasoningEffort: runtimeSession?.modelReasoningEffort || "",
        serviceTier: runtimeSession?.serviceTier || "",
        sandboxMode: runtimeSession?.sandboxMode || "",
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

  async function issueLaunchToken(input = {}) {
    const selectedServerPlan = input.selectedServerPlan && typeof input.selectedServerPlan === "object" ? input.selectedServerPlan : {};
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
      namespace: k8sNamespace,
      image: runnerImage,
      serverPlanId: input.serverPlanId || input.server_plan_id || selectedServerPlan.id || "default",
      instanceType: input.instanceType || input.instance_type || input.InstanceType || selectedServerPlan.instanceType || selectedServerPlan.InstanceType || "",
      region: input.region || selectedServerPlan.region || "",
      zone: input.zone || selectedServerPlan.zone || "",
      nodePool: input.nodePool || input.node_pool || selectedServerPlan.nodePool || "",
      runtimeClass: input.runtimeClass || input.runtime_class || selectedServerPlan.runtimeClass || "",
      nodeSelector: input.nodeSelector || selectedServerPlan.nodeSelector || {},
      tolerations: input.tolerations || selectedServerPlan.tolerations || [],
      cpuRequest: input.cpuRequest || input.cpu_request || selectedServerPlan.cpuRequest || "",
      cpuLimit: input.cpuLimit || input.cpu_limit || selectedServerPlan.cpuLimit || "",
      memoryRequest: input.memoryRequest || input.memory_request || selectedServerPlan.memoryRequest || "",
      memoryLimit: input.memoryLimit || input.memory_limit || selectedServerPlan.memoryLimit || "",
      gpuCount: Number(input.gpuCount ?? input.gpu_count ?? selectedServerPlan.gpuCount ?? selectedServerPlan.gpu ?? 0),
      storageRequest: input.storageRequest || input.storage_request || selectedServerPlan.storageRequest || "",
      storageLimit: input.storageLimit || input.storage_limit || selectedServerPlan.storageLimit || "",
      provisioningMode: input.provisioningMode || input.provisioning_mode || selectedServerPlan.provisioningMode || "schedule_to_node_pool",
      tkeClusterId: input.tkeClusterId || input.tke_cluster_id || selectedServerPlan.tkeClusterId || "",
      nodePoolId: input.nodePoolId || input.node_pool_id || selectedServerPlan.nodePoolId || "",
      nodePoolCreatePayload: input.nodePoolCreatePayload || input.node_pool_create_payload || selectedServerPlan.nodePoolCreatePayload || null,
      nodePoolScalePayload: input.nodePoolScalePayload || input.node_pool_scale_payload || selectedServerPlan.nodePoolScalePayload || null,
      provisionerPayload: input.provisionerPayload || input.provisioner_payload || selectedServerPlan.provisionerPayload || null,
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
      serverPlanId: input.serverPlanId || input.server_plan_id || selectedServerPlan.id || "default",
      instanceType: input.instanceType || input.instance_type || input.InstanceType || selectedServerPlan.instanceType || selectedServerPlan.InstanceType || "",
      region: input.region || selectedServerPlan.region || "",
    };
    try {
      await bindWorkspace(portalContext);
      const oplSession = await createOplSession(portalContext);
      runtimeSession.oplSessionId = oplSession.id || oplSession.sessionId || "";
      if (oplSession.status === "deferred") {
        addEvent(state, "opl_session_create_deferred", { ...portalContext, reason: oplSession.reason || "" });
      }
    } catch (error) {
      if (nodeEnv === "production") throw error;
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
      serverPlanId: runtimeSession.serverPlanId || selectedServerPlan.id || "default",
      instanceType: runtimeSession.instanceType || selectedServerPlan.instanceType || selectedServerPlan.InstanceType || "",
      region: runtimeSession.region || selectedServerPlan.region || "",
      zone: runtimeSession.zone || selectedServerPlan.zone || "",
      nodePool: runtimeSession.nodePool || selectedServerPlan.nodePool || "",
      runtimeClass: runtimeSession.runtimeClass || selectedServerPlan.runtimeClass || "",
      nodeSelector: runtimeSession.nodeSelector || selectedServerPlan.nodeSelector || {},
      tolerations: runtimeSession.tolerations || selectedServerPlan.tolerations || [],
      cpuRequest: runtimeSession.cpuRequest || selectedServerPlan.cpuRequest || "",
      cpuLimit: runtimeSession.cpuLimit || selectedServerPlan.cpuLimit || "",
      memoryRequest: runtimeSession.memoryRequest || selectedServerPlan.memoryRequest || "",
      memoryLimit: runtimeSession.memoryLimit || selectedServerPlan.memoryLimit || "",
      gpuCount: Number(runtimeSession.gpuCount ?? selectedServerPlan.gpuCount ?? selectedServerPlan.gpu ?? 0),
      storageRequest: runtimeSession.storageRequest || selectedServerPlan.storageRequest || "",
      storageLimit: runtimeSession.storageLimit || selectedServerPlan.storageLimit || "",
      provisioningMode: runtimeSession.provisioningMode || selectedServerPlan.provisioningMode || "schedule_to_node_pool",
      tkeClusterId: runtimeSession.tkeClusterId || selectedServerPlan.tkeClusterId || "",
      nodePoolId: runtimeSession.nodePoolId || selectedServerPlan.nodePoolId || "",
      nodePoolCreatePayload: runtimeSession.nodePoolCreatePayload || selectedServerPlan.nodePoolCreatePayload || null,
      nodePoolScalePayload: runtimeSession.nodePoolScalePayload || selectedServerPlan.nodePoolScalePayload || null,
      provisionerPayload: runtimeSession.provisionerPayload || selectedServerPlan.provisionerPayload || null,
      source: "portal-control-plane",
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    const launchToken = makeLaunchToken(launchRecord);
    const resolvedOplWebUrl = buildOplLaunchUrl(launchToken);
    const bootstrapUrl = `${baseUrl}/api/opl-launch/bootstrap?launch_token=${encodeURIComponent(launchToken)}`;
    state.launchTokens.push({ ...launchRecord, launchToken, oplWebUrl: resolvedOplWebUrl, bootstrapUrl });
    addEvent(state, "opl_launch_created", launchRecord);
    await publishTraceEvent(state, {
      ...launchRecord,
      eventType: "launch",
      traceName: "OPL launch",
      status: "active",
    });
    await writeState(state);
    return {
      ok: true,
      ...launchRecord,
      launchToken,
      oplWebUrl: resolvedOplWebUrl,
      bootstrapUrl,
    };
  }

  return {
    bindOplSession,
    buildBootstrap,
    buildStatusPayload,
    issueLaunchToken,
    verifyLaunchToken,
  };
}
