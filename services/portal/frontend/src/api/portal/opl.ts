import { apiClient } from "../client";

export interface OplLaunchInput {
  workspaceId?: string;
  task?: string;
}

export interface OplLaunchPayload {
  ok: boolean;
  launchId: string;
  openUrl: string;
  oplWebUrl: string;
  launchStatus: string;
  workspaceId: string;
  providerBound: boolean;
  providerKeyRef: string;
}

export interface OplBootstrapPayload {
  adapterContractVersion: string;
  capabilities: string[];
  supportedEvents: string[];
  identity: {
    portalUserId: string;
    tenantId: string;
    workspaceId: string;
    workspaceSessionId: string;
    runtimeSessionId: string;
    oplSessionId: string;
  };
}

export interface OplSessionBindInput {
  launchId: string;
  oplSessionId: string;
  clientSessionState?: Record<string, unknown>;
}

export interface OplMessageInput {
  launchId: string;
  message: string;
  waitForCompletion?: boolean;
}

export interface OplFileInput {
  launchId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface OplRunInput {
  launchId: string;
  message: string;
  fileRefs: string[];
  toolName?: string;
}

function launchParams(launchId: string) {
  return { launchId };
}

export async function createOplLaunch(input: OplLaunchInput) {
  const { data } = await apiClient.post<OplLaunchPayload>("/opl/launch", input);
  return data;
}

export async function fetchOplBootstrap(launchId: string) {
  const { data } = await apiClient.get<OplBootstrapPayload>("/opl/bootstrap", {
    params: launchParams(launchId),
  });
  return data;
}

export async function bindOplSession(input: OplSessionBindInput) {
  const { launchId, ...body } = input;
  const { data } = await apiClient.post("/opl/sessions/bind", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function sendOplMessage(input: OplMessageInput) {
  const { launchId, ...body } = input;
  const { data } = await apiClient.post("/opl/messages", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function fetchOplMessageStatus(launchId: string, messageId: string) {
  const { data } = await apiClient.get(`/opl/messages/${encodeURIComponent(messageId)}/status`, {
    params: launchParams(launchId),
  });
  return data;
}

export async function createOplFileRef(input: OplFileInput) {
  const { launchId, ...body } = input;
  const { data } = await apiClient.post("/opl/files", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function startOplRun(input: OplRunInput) {
  const { launchId, ...body } = input;
  const { data } = await apiClient.post("/opl/runs", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function fetchOplRunStatus(launchId: string, runId: string) {
  const { data } = await apiClient.get(`/opl/runs/${encodeURIComponent(runId)}/status`, {
    params: launchParams(launchId),
  });
  return data;
}

export async function fetchOplRunArtifacts(launchId: string, runId: string) {
  const { data } = await apiClient.get(`/opl/runs/${encodeURIComponent(runId)}/artifacts`, {
    params: launchParams(launchId),
  });
  return data;
}

export async function fetchOplArtifact(launchId: string, artifactRef: string) {
  const { data } = await apiClient.get(`/opl/artifacts/${encodeURIComponent(artifactRef)}`, {
    params: launchParams(launchId),
  });
  return data;
}
