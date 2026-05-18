import { apiClient } from "../client";
import { normalizePortalBusinessError } from "./common";

export interface LabPackagePlan {
  id: string;
  name: string;
  headline?: string;
  backingServerPlanId?: string;
  computePower: string;
  storageCapacityGb: number;
  basePrice: null;
  pendingProductApproval: boolean;
  priceLabel?: string;
  gracePeriodDays: number;
  currency: string;
  planSummary?: string;
  memoryGb?: number;
}

export interface LabPackagesPayload {
  items: LabPackagePlan[];
  source?: string;
  catalog?: {
    starter?: LabPackagePlan | null;
    pro?: LabPackagePlan | null;
  };
}

export interface LabSubscriptionPayload {
  status: string;
  currentPackageId: string | null;
  currentPackageName: string | null;
  balance: number;
  frozenAmount: number;
  currency: string;
}

export interface LabEntitlementPayload {
  canEnterLab: boolean;
  canUpgrade: boolean;
  canExpandStorage: boolean;
  message?: string;
}

export interface LabPackageMutationInput {
  packageId: string;
  workspaceId?: string;
  subscriptionId?: string;
  idempotencyKey?: string;
}

export async function fetchLabPackages() {
  const { data } = await apiClient.get<LabPackagesPayload>("/lab-packages");
  return data;
}

export async function fetchLabSubscription() {
  const { data } = await apiClient.get<LabSubscriptionPayload>("/lab-subscription");
  return data;
}

export async function fetchLabEntitlement() {
  const { data } = await apiClient.get<LabEntitlementPayload>("/lab-entitlement");
  return data;
}

export async function activateLabPackage(input: LabPackageMutationInput) {
  return postLabMutation("/lab-packages/activate", input, "套餐开通失败，请稍后重试。");
}

export async function upgradeLabPackage(input: LabPackageMutationInput) {
  return postLabMutation("/lab-packages/upgrade", input, "套餐升级失败，请稍后重试。");
}

async function postLabMutation(
  path: string,
  input: LabPackageMutationInput,
  fallback: string,
) {
  try {
    const { data } = await apiClient.post<{ ok: boolean; subscription?: LabSubscriptionPayload }>(path, input);
    return data;
  } catch (error) {
    throw normalizePortalBusinessError(error, fallback);
  }
}
