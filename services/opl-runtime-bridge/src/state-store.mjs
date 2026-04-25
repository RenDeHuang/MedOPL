import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  traceLinks: [],
  costRecords: [],
  events: [],
};

export { runtimeRoot, stateFile, artifactsRoot, emptyState };

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}

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
    costRecords: Array.isArray(state.costRecords)
      ? state.costRecords.map((item) => {
          if (item?.pricingSource !== "contract-zero-cost") return item;
          return {
            ...item,
            pricingSource: "legacy-contract-fixture",
            status: item.status === "exact" ? "legacy_fixture" : item.status,
          };
        })
      : [],
  };
}

function idChainFrom(detail = {}) {
  return {
    portalUserId: detail.portalUserId || detail.portal_user_id || "",
    workspaceId: detail.workspaceId || detail.workspace_id || "",
    workspaceSessionId: detail.workspaceSessionId || detail.workspace_session_id || "",
    runtimeSessionId: detail.runtimeSessionId || detail.runtime_session_id || "",
    runId: detail.runId || detail.run_id || "",
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
  let workspace = state.workspaces.find((item) =>
    item.portalUserId === portalUserId &&
    item.workspaceId === workspaceId
  );
  if (!workspace) {
    workspace = {
      workspaceId,
      portalUserId,
      title: input.workspaceTitle || input.workspace_title || workspaceId,
      workspacePath: input.workspacePath || input.workspace_path || "",
      projectId: input.projectId || input.project_id || input.moduleId || input.module_id || "",
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.workspaces.push(workspace);
    addEvent(state, "workspace_registered", { portalUserId, workspaceId });
  } else {
    workspace.title = input.workspaceTitle || input.workspace_title || workspace.title;
    workspace.workspacePath = input.workspacePath || input.workspace_path || workspace.workspacePath || "";
    workspace.projectId = input.projectId || input.project_id || input.moduleId || input.module_id || workspace.projectId || "";
    workspace.updatedAt = nowIso();
  }
  return workspace;
}

export function createWorkspaceSession(state, input = {}) {
  const workspace = upsertWorkspace(state, input);
  const session = {
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || randomUUID(),
    portalUserId: input.portalUserId || input.portal_user_id || "",
    workspaceId: workspace.workspaceId,
    workspacePath: input.workspacePath || input.workspace_path || workspace.workspacePath || "",
    projectId: input.projectId || input.project_id || workspace.projectId || "",
    sourceSurface: input.sourceSurface || input.source_surface || "portal-control-plane",
    status: "active",
    createdAt: nowIso(),
    lastActiveAt: nowIso(),
  };
  state.workspaceSessions.push(session);
  addEvent(state, "workspace_session_created", session);
  return session;
}

export function createRuntimeSession(state, input = {}) {
  const runtimeSession = {
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || randomUUID(),
    portalUserId: input.portalUserId || input.portal_user_id || "",
    workspaceId: input.workspaceId || input.workspace_id || "default",
    workspacePath: input.workspacePath || input.workspace_path || "",
    projectId: input.projectId || input.project_id || input.moduleId || input.module_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    oplSessionId: input.oplSessionId || input.opl_session_id || "",
    engine: input.engine || "opl-codex-default",
    status: input.status || "ready",
    namespace: input.namespace || "",
    image: input.image || "",
    createdAt: nowIso(),
    warmedAt: nowIso(),
  };
  state.runtimeSessions.push(runtimeSession);
  addEvent(state, "runtime_session_warmed", runtimeSession);
  return runtimeSession;
}

export function createRunRecord(state, input = {}) {
  const run = {
    runId: input.runId || input.run_id || randomUUID(),
    portalUserId: input.portalUserId || input.portal_user_id || "",
    workspaceId: input.workspaceId || input.workspace_id || "default",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    kind: input.kind || "med-autoscience",
    agentId: input.agentId || input.agent_id || "mas",
    toolName: input.toolName || input.tool_name || "med-autoscience",
    status: input.status || "submitted",
    runnerImage: input.runnerImage || input.runner_image || "",
    namespace: input.namespace || "",
    jobName: input.jobName || input.job_name || "",
    manifestPath: input.manifestPath || input.manifest_path || "",
    createdAt: input.createdAt || input.created_at || nowIso(),
    startedAt: input.startedAt || input.started_at || "",
    finishedAt: input.finishedAt || input.finished_at || "",
    latencyMs: Number(input.latencyMs || input.latency_ms || 0),
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    model: input.model || "opl-runtime",
    userAgent: input.userAgent || input.user_agent || "",
    error: input.error || "",
  };
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
  const action = {
    actionId: input.actionId || input.action_id || randomUUID(),
    runId: input.runId || input.run_id || "",
    portalUserId: input.portalUserId || input.portal_user_id || "",
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    actionType: input.actionType || input.action_type || "runtime_action",
    summary: input.summary || "",
    status: input.status || "recorded",
    startedAt: input.startedAt || input.started_at || nowIso(),
    finishedAt: input.finishedAt || input.finished_at || "",
    createdAt: nowIso(),
  };
  state.runActions.push(action);
  return action;
}

export function addArtifactRecord(state, input = {}) {
  const artifact = {
    artifactId: input.artifactId || input.artifact_id || randomUUID(),
    runId: input.runId || input.run_id || "",
    portalUserId: input.portalUserId || input.portal_user_id || "",
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    kind: input.kind || "output",
    name: input.name || "",
    objectKey: input.objectKey || input.object_key || "",
    localPath: input.localPath || input.local_path || input.path || "",
    sizeBytes: Number(input.sizeBytes || input.size_bytes || 0),
    contentType: input.contentType || input.content_type || "application/octet-stream",
    createdAt: input.createdAt || input.created_at || nowIso(),
  };
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

export function addTraceRecord(state, input = {}) {
  const trace = {
    traceId: input.traceId || input.trace_id || randomUUID(),
    runId: input.runId || input.run_id || "",
    portalUserId: input.portalUserId || input.portal_user_id || "",
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    traceProvider: input.traceProvider || input.trace_provider || "portal-opl-adapter",
    traceName: input.traceName || input.trace_name || "med-autoscience-run",
    status: input.status || "submitted",
    latencyMs: Number(input.latencyMs || input.latency_ms || 0),
    model: input.model || "opl-runtime",
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    userAgent: input.userAgent || input.user_agent || "",
    error: input.error || "",
    createdAt: input.createdAt || input.created_at || nowIso(),
  };
  state.traceLinks.push(trace);
  return trace;
}

export function addCostRecord(state, input = {}) {
  const cost = {
    costRecordId: input.costRecordId || input.cost_record_id || randomUUID(),
    runId: input.runId || input.run_id || "",
    portalUserId: input.portalUserId || input.portal_user_id || "",
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    cpuCost: input.cpuCost ?? null,
    gpuCost: input.gpuCost ?? null,
    storageCost: input.storageCost ?? null,
    vpnCost: input.vpnCost ?? null,
    trafficCost: input.trafficCost ?? null,
    totalCost: input.totalCost ?? null,
    pricingSource: input.pricingSource || "opencost-pending",
    status: input.status || "pending",
    createdAt: input.createdAt || input.created_at || nowIso(),
  };
  state.costRecords.push(cost);
  addEvent(state, cost.status === "exact" ? "runner_cost_reconciled" : "runner_cost_pending", cost);
  return cost;
}
