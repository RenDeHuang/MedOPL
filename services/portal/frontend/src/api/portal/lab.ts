import { apiClient } from "../client";
import { normalizePortalBusinessError } from "./common";

export interface LabPackagePlan {
  id: string;
  name: string;
  headline?: string;
  backingServerPlanId?: string;
  computePower: string;
  storageCapacityGb: number;
  dailyDebit: number;
  weeklyFreeze: number;
  gracePeriodDays: number;
  currency: string;
  planSummary?: string;
  memoryGb?: number;
  customSpec?: LabCustomPackageSpec | null;
}

export interface LabCustomPackageSpec {
  computeCores: number;
  memoryGb: number;
  storageIncludedGb: number;
}

export interface LabPackagesPayload {
  items: LabPackagePlan[];
  source?: string;
  catalog?: {
    starter?: LabPackagePlan | null;
    pro?: LabPackagePlan | null;
    customOptions?: {
      computeCores?: number[];
      memoryGb?: number[];
      storageIncludedGb?: number[];
      storageAddonSizesGb?: number[];
      notes?: string[];
      upgradeTargets?: string[];
    };
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
  customSpec?: LabCustomPackageSpec;
  idempotencyKey?: string;
}

export interface LabStorageAddonInput {
  subscriptionId?: string;
  workspaceId?: string;
  storageGb?: number;
  addStorageGb?: number;
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

export async function activateCustomLabPackage(input: { workspaceId?: string; customSpec: LabCustomPackageSpec; idempotencyKey?: string }) {
  return postLabMutation("/lab-packages/custom", input as LabPackageMutationInput, "自定义套餐提交失败，请检查规格后重试。");
}

export async function purchaseLabStorageAddon(input: LabStorageAddonInput) {
  return postLabMutation("/lab-storage/addons", input, "扩容失败，请稍后重试。");
}

async function postLabMutation(path: string, input: LabPackageMutationInput | LabStorageAddonInput, fallback: string) {
  try {
    const { data } = await apiClient.post<{ ok: boolean; subscription?: LabSubscriptionPayload }>(path, input);
    return data;
  } catch (error) {
    throw normalizePortalBusinessError(error, fallback);
  }
}
