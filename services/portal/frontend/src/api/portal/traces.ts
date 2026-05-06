import { apiClient } from "../client";
import type { PortalPagination } from "./common";

export interface TraceSummaryPayload {
  available?: boolean;
  mode?: string;
  note?: string;
  traceCount?: number;
  latestTraceAt?: string;
  dataSource?: string;
}

export interface TracesPayload {
  filters: {
    userId: string;
    workspaceId: string;
    runId: string;
    sessionId?: string;
    status?: string;
  };
  summary: TraceSummaryPayload;
  items: Array<{
    traceId: string;
    traceName: string;
    title?: string;
    userId: string;
    tenantId?: string;
    workspaceId: string;
    workspaceSessionId: string;
    runtimeSessionId?: string;
    runId: string;
    resourceOrderId?: string;
    serverPlanId?: string;
    model: string;
    sessionId: string;
    tokenCount: number;
    userAgent: string;
    latencyMs: number;
    inputPreview: string;
    startedAt: string;
    updatedAt?: string;
    status: string;
    businessStatus?: string;
    url: string;
    files?: {
      inputsCount: number;
      outputsCount: number;
      latestOutputs?: Array<{ name: string; size: number; downloadUrl: string }>;
    };
    billing?: {
      pendingCost: number;
      exactCost: number;
      source: string;
    };
  }>;
  pagination: PortalPagination;
  dataSource: string;
  note?: string;
}

export type SessionTracesPayload = TracesPayload;

export async function fetchTraceSummary() {
  const { data } = await apiClient.get<TraceSummaryPayload>("/traces/summary");
  return data;
}

export async function fetchTraces(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<TracesPayload>("/traces", { params });
  return data;
}

export async function fetchSessionTraces(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<SessionTracesPayload>("/session-traces", { params });
  return data;
}
