import { goControlPlaneClient } from "../client";
import type { CatalogRuntimeStatus, CommercialProfile, PricingSourceStatus, SelectedServerPlan, ServerPlanItem, ServerPlansSummary } from "./types";

export type { CatalogRuntimeStatus, PricingSourceStatus, SelectedServerPlan, ServerPlanItem, ServerPlansSummary } from "./types";

export interface CloudStatusPayload {
  ok: boolean;
  catalogRuntimeStatus?: CatalogRuntimeStatus;
  pricingSourceStatus?: PricingSourceStatus;
}

export interface ServerPlansPayload {
  ok: boolean;
  catalogSource: string;
  configured: boolean;
  priceEnabled: boolean;
  availabilitySyncEnabled?: boolean;
  availabilitySnapshotCount?: number;
  catalogCount: number;
  items: ServerPlanItem[];
  selectedServerPlan?: SelectedServerPlan | null;
  workspaceId?: string;
  note?: string;
  catalogRuntimeStatus?: CatalogRuntimeStatus | null;
  pricingSourceStatus?: PricingSourceStatus | null;
  summary: ServerPlansSummary;
  commercial: CommercialProfile;
  freezePolicy: {
    catalogSource?: string;
    basis: string;
    finalBilling: string;
    minBillableHoursDefault: number;
    pendingCostIntervalSeconds: number;
    pendingSource: string;
  };
}

export async function fetchServerPlans() {
  const { data } = await goControlPlaneClient.get<ServerPlansPayload>("/server-plans");
  return data;
}
