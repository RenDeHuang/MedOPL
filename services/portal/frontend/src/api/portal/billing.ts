import { apiClient } from "../client";
import type { PortalPagination, PortalQueryValue } from "./common";

export interface BillingQuery {
  from?: PortalQueryValue;
  to?: PortalQueryValue;
  page_size?: PortalQueryValue;
  tasks_page?: PortalQueryValue;
  ledger_page?: PortalQueryValue;
  runs_page?: PortalQueryValue;
}

export interface BillingPayload {
  wallet: {
    balance: number;
    activeFreeze?: number;
    frozen?: number;
    availableBalance?: number;
    trialRemaining?: number;
  };
  totals: {
    cpuCost: number;
    gpuCost: number;
    pvCost: number;
    totalCost: number;
  };
  breakdown: {
    cpuCost: number;
    gpuCost: number;
    storageCost: number;
    vpnCost: number;
    trafficCost: number;
    otherCloudCost: number;
    cloudSource: string;
    pricingSource?: string;
  };
  summary: {
    selectedCost: number;
    runCount: number;
    workspaceCount: number;
    pendingCost?: number;
    exactCost?: number;
  };
  supportBoundary?: {
    supportStatus: string;
    fundingStatus: string;
    graceStatus: string;
    fileRetentionStatus: string;
    failedRunBillingStatus: string;
    canStartPaidRun: boolean;
    canDownloadExistingOutput: boolean;
    billingCopy: string;
    userCopy: string;
    actionRequired: string[];
    amounts: {
      walletBalance: number;
      activeFreeze: number;
      availableBalance: number;
      minRequiredBalance: number;
    };
  };
  taskCosts: Array<{
    slug: string;
    title: string;
    totalCost: number;
    cpuCost: number;
    gpuCost: number;
    storageCost: number;
    runCount: number;
  }>;
  taskPagination: PortalPagination;
  runCosts: Array<{
    runId: string;
    workspaceId: string;
    cpuCost: number;
    gpuCost: number;
    storageCost: number;
    totalCost: number;
    startedAt: string;
    endedAt: string;
    pricingSource: string;
    runStatus: string;
  }>;
  runPagination: PortalPagination;
  ledger: Array<{
    id?: string;
    type: string;
    amount: number;
    reason?: string;
    createdAt: string;
  }>;
  ledgerPagination: PortalPagination;
  filter: {
    range: string;
    from: string;
    to: string;
  };
  trend: {
    labels: string[];
    total: number[];
    cpu: number[];
    gpu: number[];
    storage: number[];
  };
  todayCost: number;
}

export interface BillingSummaryPayload {
  wallet: BillingPayload["wallet"];
  totals: BillingPayload["totals"];
  breakdown: BillingPayload["breakdown"];
  summary: BillingPayload["summary"];
  supportBoundary?: BillingPayload["supportBoundary"];
  filter: BillingPayload["filter"];
  todayCost: number;
}

export interface BillingDetailsPayload {
  taskCosts: BillingPayload["taskCosts"];
  taskPagination: BillingPayload["taskPagination"];
  runCosts: BillingPayload["runCosts"];
  runPagination: BillingPayload["runPagination"];
  ledger: BillingPayload["ledger"];
  ledgerPagination: BillingPayload["ledgerPagination"];
  trend: BillingPayload["trend"];
}

export interface CostsSummaryPayload {
  source: string;
  type: string;
  note?: string;
  totals: {
    cpuCost: number;
    gpuCost: number;
    pvCost: number;
    totalCost: number;
  };
  items: any[];
}

export interface RunCostPayload {
  source: string;
  type: string;
  note?: string;
  runId: string;
  cost: null | {
    cpuCost: number;
    gpuCost: number;
    storageCost: number;
    totalCost: number;
    pricingSource: string;
  };
}

export async function fetchBilling(params: BillingQuery = {}) {
  const { data } = await apiClient.get<BillingPayload>("/billing", { params });
  return data;
}

export async function fetchBillingSummary(params: BillingQuery = {}) {
  const { data } = await apiClient.get<BillingSummaryPayload>("/billing/summary", { params });
  return data;
}

export async function fetchBillingDetails(params: BillingQuery = {}) {
  const { data } = await apiClient.get<BillingDetailsPayload>("/billing/details", { params });
  return data;
}

export async function fetchCostsSummary(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<CostsSummaryPayload>("/costs/summary", { params });
  return data;
}

export async function fetchWorkspaceCosts(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<CostsSummaryPayload>("/costs/workspace", { params });
  return data;
}

export async function fetchRunCosts(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<RunCostPayload>("/costs/run", { params });
  return data;
}
