import { nowIso } from "./state-store.mjs";
import { randomUUID } from "node:crypto";
import {
  launchIdentityFields,
  launchSessionOwnerFields,
  launchTraceOwnerFields,
  launchUserProfileFields,
  launchWorkspaceFields,
  runtimeSessionResourceFields,
  selectedPlanPortalContextFields,
  selectedPlanResourceFields,
} from "./runtime-bridge-launch-issue-fields.mjs";

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

export function selectServerPlan(input = {}) {
  return asObject(input.selectedServerPlan);
}

export function buildLaunchStatus() {
  return {
    stages: [
      { stage: "workspace_ready", ok: true, userVisibleState: "实验空间已准备", blockingUser: false },
    ],
    currentStage: "workspace_ready",
  };
}

export function buildRuntimeSessionInput({
  input = {},
  traceId,
  workspaceId,
  workspaceSessionId,
  k8sNamespace,
  runnerImage,
  selectedServerPlan = {},
}) {
  return {
    ...input,
    traceId,
    ...launchIdentityFields(input),
    ...launchSessionOwnerFields(input),
    workspaceId,
    workspaceSessionId,
    namespace: k8sNamespace,
    image: runnerImage,
    ...selectedPlanResourceFields(input, selectedServerPlan),
  };
}

export function buildPortalContext({
  input = {},
  traceId,
  workspace,
  workspaceSessionId,
  runtimeSessionId,
  selectedServerPlan = {},
}) {
  return {
    traceId,
    portalUserId: input.portalUserId,
    ...launchUserProfileFields(input),
    ...launchIdentityFields(input),
    ...launchWorkspaceFields({ input, workspace, workspaceSessionId }),
    runtimeSessionId,
    sourceSurface: input.sourceSurface || "portal-control-plane",
    ...selectedPlanPortalContextFields(input, selectedServerPlan),
  };
}

export function markOplSessionCreated(launchStatus, oplSession = {}) {
  launchStatus.stages.push({ stage: "session_created", ok: true, userVisibleState: "OPL 会话已创建", blockingUser: false });
  launchStatus.currentStage = "session_created";
  return oplSession.id || oplSession.sessionId || "";
}

export function buildLaunchRecord({
  input = {},
  traceId,
  workspace,
  workspaceSessionId,
  runtimeSession,
  portalContext = {},
  selectedServerPlan = {},
  launchStatus,
}) {
  return {
    launchId: randomUUID(),
    traceId,
    portalUserId: input.portalUserId,
    ...launchIdentityFields(input),
    ...launchSessionOwnerFields(input),
    ...launchTraceOwnerFields(input),
    ...launchUserProfileFields(input),
    workspaceId: workspace.workspaceId,
    workspaceTitle: workspace.title,
    workspacePath: portalContext.workspacePath || "",
    workspaceSessionId,
    runtimeSessionId: runtimeSession.runtimeSessionId,
    ...runtimeSessionResourceFields(runtimeSession, selectedServerPlan),
    launchStatus,
    source: "portal-control-plane",
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}
