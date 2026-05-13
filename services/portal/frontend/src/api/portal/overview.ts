import { apiClient } from "../client";
import type { PortalPagination, PortalQueryValue } from "./common";
import type { CommercialProfile, OnboardingPayload } from "./commercial";
import type { WorkspaceResourceBinding } from "./resources";
import type { SelectedServerPlan, ServerPlansSummary } from "./server-plans";

export interface OverviewQuery {
  tasks_page?: PortalQueryValue;
  runs_page?: PortalQueryValue;
}

export interface OverviewPayload {
  kpis: {
    accountStatus: string;
    billingStatus: string;
    entitlementStatus: string;
    balance: number;
    todayCost: number;
    historicalCost: number;
    activeTasks: number;
    workspaceCount: number;
    runCount: number;
    frozenAmount?: number;
    availableBalance?: number;
    pendingCostToday?: number;
    exactCostToday?: number;
    pendingCostMonth?: number;
    exactCostMonth?: number;
  };
  commercial: CommercialProfile;
  serverPlansSummary: ServerPlansSummary;
  selectedServerPlan?: SelectedServerPlan | null;
  onboarding: OnboardingPayload;
  latestResourceBindings?: WorkspaceResourceBinding[];
  taskCards: Array<{
    slug: string;
    title: string;
    status: string;
    runCount: number;
    updatedAt: string;
  }>;
  taskPagination: PortalPagination;
  latestRuns: Array<{
    runId: string;
    workspaceId: string;
    workspaceTitle: string;
    status: string;
    createdAt: string;
    displayTime: string;
  }>;
  latestRunsPagination: PortalPagination;
}

export async function fetchOverview(params: OverviewQuery = {}) {
  const { data } = await apiClient.get<OverviewPayload>("/overview", { params });
  return data;
}
