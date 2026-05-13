import { apiClient } from "../client";
import type { PortalPagination } from "./common";

export interface TraceSummaryPayload {
  available?: boolean;
  mode?: string;
  note?: string;
  traceCount?: number;
  latestTraceAt?: string;
  dataSource?: string;
  businessFactSource?: string;
  canonicalSource?: string;
  observabilityAttachmentSource?: string;
  observabilityAvailable?: boolean;
  billingTruth?: boolean;
}

export interface TraceResourceUsagePayload {
  source: string;
  runId: string;
  sessionId: string;
  workspaceId: string;
  status: string;
  tokenCount: number;
  latencyMs: number;
  inputFileCount: number;
  outputFileCount: number;
  outputBytes: number;
  costItemCount: number;
}

export interface TraceCostEstimatePayload {
  amount: number;
  currency: string;
  source: string;
  pricingSource: string;
  status: string;
  billingTruth: boolean;
  pendingReconciliation: boolean;
  components: {
    compute: number;
    storage: number;
    total: number;
  };
}

export interface TraceBalanceLinkPayload {
  linkedToBalance: boolean;
  chargeApplied: boolean;
  rechargeStatus: string;
  estimateOnly: boolean;
  estimatedAmount: number;
  currency: string;
  balanceCents: number;
  availableBalanceCents: number;
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
    resourceBindingId?: string;
    billingAttributionId?: string;
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
    source?: string;
    customerDefaultTraceSurface?: string;
    customerDefaultLangfuseUi?: boolean;
    resourceUsage?: TraceResourceUsagePayload;
    costEstimate?: TraceCostEstimatePayload;
    balanceLink?: TraceBalanceLinkPayload;
    observability?: {
      source: string;
      label: string;
      traceId: string;
      sessionId: string;
      runId: string;
      status: string;
      latencyMs: number;
      usageSummary: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
      costEstimate: {
        currency: string;
        amount: number;
      };
      traceUrl: string;
      tags: string[];
    };
    linkedOutputFiles?: Array<{
      artifactRef: string;
      fileRef: string;
      name: string;
      workspaceId: string;
      runId: string;
      sessionId: string;
      kind: string;
      sizeBytes: number;
      contentType: string;
      status: string;
      source: string;
    }>;
    outputFiles?: Array<{
      artifactRef: string;
      fileRef: string;
      name: string;
      workspaceId: string;
      runId: string;
      sessionId: string;
      kind: string;
      sizeBytes: number;
      contentType: string;
      status: string;
      source: string;
    }>;
    files?: {
      inputsCount: number;
      outputsCount: number;
      linkedOutputCount?: number;
      linkedOutputFiles?: Array<{
        artifactRef: string;
        fileRef: string;
        name: string;
        workspaceId: string;
        runId: string;
        sessionId: string;
        kind: string;
        sizeBytes: number;
        contentType: string;
        status: string;
        source: string;
      }>;
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
  customerTraceSurface?: string;
  customerDefaultLangfuseUi?: boolean;
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
