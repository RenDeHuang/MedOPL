import { goControlPlaneClient } from "../client";

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
  runtimeBridgeContractVersion: string;
  capabilities: string[];
  supportedEvents: string[];
  identity: {
    portalUserId: string;
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
  relativePath?: string;
  contentType: string;
  sizeBytes: number;
}

export interface OplRunInput {
  launchId: string;
  message: string;
  fileRefs: string[];
  toolName?: string;
  mode?: "full_runtime";
}

export interface OplFileRefPayload {
  ok: boolean;
  fileRef?: string;
  error?: string;
  gate?: string;
  status?: string;
  capability?: string;
  file?: {
    fileRef?: string;
    name?: string;
    relativePath?: string;
    sizeBytes?: number;
    contentType?: string;
    status?: string;
  };
}

export interface OplRunStatusPayload {
  traceId?: string;
  status: string;
  error?: string;
}

export interface OplRunPayload {
  ok: boolean;
  error?: string;
  gate?: string;
  status?: string;
  statusUrl?: string;
  run?: OplRunStatusPayload;
  artifacts?: Array<{
    artifactRef: string;
    name: string;
    relativePath: string;
    sizeBytes: number;
    contentType: string;
  }>;
}

export interface OplArtifactPayload {
  ok: boolean;
  error?: string;
  gate?: string;
  status?: string;
  artifactRef?: string;
  artifact?: {
    artifactRef: string;
    workspaceId: string;
    providerKeyRef: string;
    kind: string;
    name: string;
    relativePath: string;
    sizeBytes: number;
    contentType: string;
  };
}

function launchParams(launchId: string) {
  return { launchId };
}

export async function createOplLaunch(input: OplLaunchInput) {
  const { data } = await goControlPlaneClient.post<OplLaunchPayload>("/opl/launch", input);
  return data;
}

export async function fetchOplBootstrap(launchId: string) {
  const { data } = await goControlPlaneClient.get<OplBootstrapPayload>("/opl/bootstrap", {
    params: launchParams(launchId),
  });
  return data;
}

export async function bindOplSession(input: OplSessionBindInput) {
  const { launchId, ...body } = input;
  const { data } = await goControlPlaneClient.post("/opl/sessions/bind", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function sendOplMessage(input: OplMessageInput) {
  const { launchId, ...body } = input;
  const { data } = await goControlPlaneClient.post("/opl/messages", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function fetchOplMessageStatus(launchId: string, messageId: string) {
  const { data } = await goControlPlaneClient.get(`/opl/messages/${encodeURIComponent(messageId)}/status`, {
    params: launchParams(launchId),
  });
  return data;
}

export async function createOplFileRef(input: OplFileInput) {
  const { launchId, ...body } = input;
  const { data } = await goControlPlaneClient.post<OplFileRefPayload>("/opl/files", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function startOplRun(input: OplRunInput) {
  const { launchId, ...body } = input;
  const { data } = await goControlPlaneClient.post<OplRunPayload>("/opl/runs", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function fetchOplArtifact(launchId: string, artifactRef: string) {
  const { data } = await goControlPlaneClient.get<OplArtifactPayload>(`/opl/artifacts/${encodeURIComponent(artifactRef)}`, {
    params: launchParams(launchId),
  });
  return data;
}
