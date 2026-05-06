import { apiClient } from "../client";
import type { CommercialProfile } from "./commercial";

export interface SelectedServerPlan {
  id: string;
  name: string;
  provider: string;
  region: string;
  zone: string;
  instanceType: string;
  cpu?: number;
  memoryGb?: number;
  gpu?: number;
  currency: string;
  priceStatus: string;
  availabilityStatus?: string;
  statusCategory?: string;
  soldOutReason?: string;
  originalPrice?: number;
  discountPrice: number;
  unitPrice: number;
  hourlyPrice?: number;
  minBillableHours: number;
  riskFactor: number;
  reservationFloor: number;
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  gpuCount: number;
  storageRequest: string;
  storageLimit: string;
  isPurchasable?: boolean;
  isSelectable?: boolean;
  selectedAt: string;
  selectionNote: string;
  priceOrigin?: string;
}

export interface ServerPlansSummary {
  catalogSource: string;
  configured: boolean;
  priceEnabled: boolean;
  availabilitySyncEnabled?: boolean;
  availabilitySnapshotCount?: number;
  catalogCount: number;
  quotedCount: number;
  purchasableCount: number;
  selectableCount?: number;
  priceStatus: string;
  lowestHourlyPrice: number;
  note: string;
  catalogRuntimeStatus?: CatalogRuntimeStatus | null;
  pricingSourceStatus?: PricingSourceStatus | null;
}

export interface ServerPlanItem {
  id: string;
  name: string;
  provider: string;
  region: string;
  zone: string;
  instanceType: string;
  cpu: number;
  memoryGb: number;
  gpu: number;
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
  gpuCount?: number;
  storageRequest?: string;
  storageLimit?: string;
  minBillableHours: number;
  riskFactor: number;
  reservationFloor: number;
  priceStatus: string;
  availabilityStatus?: string;
  statusCategory?: string;
  soldOutReason?: string;
  isPurchasable: boolean;
  isSelectable?: boolean;
  reason?: string;
  currency?: string;
  originalPrice?: number;
  discountPrice?: number;
  unitPrice?: number;
  hourlyPrice?: number;
  selectionNote?: string;
  catalogSource?: string;
  priceOrigin?: string;
}

export interface CatalogRuntimeStatus {
  status?: string;
  configured?: boolean;
  catalogSource?: string;
  catalogCount?: number;
  candidateCount?: number;
  platformProvisionedRuntimeCount?: number;
}

export interface PricingSourceStatus {
  enabled?: boolean;
  status?: string;
  priceOrigin?: string;
  quotedCount?: number;
  lastPricingSyncAt?: string;
  pendingSource?: string;
}

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
  const { data } = await apiClient.get<ServerPlansPayload>("/server-plans");
  return data;
}

export async function selectServerPlan(input: { planId: string; task?: string }) {
  const { data } = await apiClient.post("/server-plans/select", input);
  return data as { ok: boolean; workspaceId: string; selectedServerPlan: SelectedServerPlan | null };
}
