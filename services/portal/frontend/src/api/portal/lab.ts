import { goControlPlaneClient } from "../client";
import { normalizePortalBusinessError } from "./common";
import type { PortalQueryValue } from "./common";
import type { LabPackagePlan } from "./types";

export type { LabPackagePlan } from "./types";

export interface LabPackagesPayload {
  items: LabPackagePlan[];
  source?: string;
  catalog?: {
    starter?: LabPackagePlan | null;
    pro?: LabPackagePlan | null;
  };
}

export interface LabSubscriptionPayload {
  ok?: boolean;
  status: string;
  currentPackageId: string | null;
  currentPackageName: string | null;
  balance: number;
  frozenAmount: number;
  currency: string;
  subscription?: {
    id: string;
    status: string;
    packageId: string;
    workspaceId: string;
  } | null;
  wallet?: {
    balance: number;
    activeFreeze: number;
    availableBalance: number;
    currency: string;
  };
  entitlement?: LabEntitlementDetails;
}

export interface LabEntitlementDetails {
  enabled: boolean;
  status: string;
  subscriptionId?: string;
  packageId?: string;
  packageName?: string;
  sourceType?: string;
  compute?: {
    tier?: string;
    cores?: number;
    maxConcurrentRuns?: number;
    backingServerPlanId?: string;
  };
  storage?: {
    includedGb?: number;
    addonGb?: number;
    totalGb?: number;
    usedGb?: number;
    availableGb?: number;
    retentionDays?: number;
    warningRatio?: number;
    warning?: boolean;
    blocked?: boolean;
  };
  gates?: {
    canUpload?: boolean;
    canRun?: boolean;
    canDownload?: boolean;
  };
  actions?: {
    canCreateWorkspace?: boolean;
    canUploadFile?: boolean;
    canStartPaidRun?: boolean;
    canDownloadExistingOutputs?: boolean;
  };
  nextStepCopy?: string;
  message?: string;
}

export interface LabEntitlementPayload {
  ok?: boolean;
  workspaceId: string;
  entitlement: LabEntitlementDetails;
}

export interface LabPackageMutationInput {
  packageId: string;
  workspaceId?: string;
  subscriptionId?: string;
  idempotencyKey?: string;
}

export interface LabWorkspaceQuery {
  workspaceId: PortalQueryValue;
}

export async function fetchLabPackages() {
  const { data } = await goControlPlaneClient.get<LabPackagesPayload>("/lab-packages");
  return data;
}

export async function fetchLabSubscription(params: LabWorkspaceQuery) {
  const { data } = await goControlPlaneClient.get<LabSubscriptionPayload>("/lab-subscription", { params });
  return data;
}

export async function fetchLabEntitlement(params: LabWorkspaceQuery) {
  const { data } = await goControlPlaneClient.get<LabEntitlementPayload>("/lab-entitlement", { params });
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
    const { data } = await goControlPlaneClient.post<{ ok: boolean; subscription?: LabSubscriptionPayload }>(path, input);
    return data;
  } catch (error) {
    throw normalizePortalBusinessError(error, fallback);
  }
}
