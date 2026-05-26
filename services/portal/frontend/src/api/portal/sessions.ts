import { goControlPlaneClient } from "../client";
import type { PortalPagination } from "./common";

export interface AnnouncementPayload {
  items: Array<{
    id: string;
    title: string;
    content: string;
    scope: string;
    status: string;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
    operatorId: string;
  }>;
  source: string;
  type: string;
}

export interface SessionsPayload {
  user: {
    id: string;
    name: string;
    email: string;
  };
  sessions: Array<{
    sessionId: string;
    sessionType: "ordinary" | "mas" | string;
    userId: string;
    userName: string;
    userEmail: string;
    workspaceId: string;
    workspaceSessionId: string;
    lastUsedAt: string;
    status: string;
    source: string;
  }>;
  pagination: PortalPagination;
  sources: Record<string, { source: string; type: string }>;
}

export interface RunsPayload {
  runs: Array<{
    taskRef: string;
    workspaceId: string;
    workspaceSessionId: string;
    userId: string;
    userName: string;
    userEmail?: string;
    status: string;
    startedAt: string;
    endedAt: string;
    source: string;
    type: string;
  }>;
  source: string;
  type: string;
  note?: string;
}

export async function fetchAnnouncements(params?: Record<string, string | number | undefined>) {
  const { data } = await goControlPlaneClient.get<AnnouncementPayload>("/announcements", { params });
  return data;
}

export async function fetchSessions(params?: Record<string, string | number | undefined>) {
  const { data } = await goControlPlaneClient.get<SessionsPayload>("/sessions", { params });
  return data;
}

export async function fetchRuns(params?: Record<string, string | number | undefined>) {
  const { data } = await goControlPlaneClient.get<RunsPayload>("/runs", { params });
  return data;
}
