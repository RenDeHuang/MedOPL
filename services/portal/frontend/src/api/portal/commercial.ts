import { apiClient } from "../client";
import type { SelectedServerPlan } from "./server-plans";

export interface CurrentUserPayload {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  accountStatus: string;
  billingStatus: string;
  entitlementStatus: string;
  commercial?: CommercialProfile;
  selectedServerPlan?: SelectedServerPlan | null;
  initials: string;
  currentTaskSlug: string;
  productProfile?: {
    runtimeMode: string;
    opsProfileEnabled: boolean;
    opsSurfaceEnabled: boolean;
  };
}

export interface TrialEntitlement {
  kind: string;
  status: string;
  source: string;
  currency: string;
  totalCredit: number;
  remainingCredit: number;
  createdAt: string;
  expiresAt: string;
  note: string;
}

export interface CommercialProfile {
  accountStatus: string;
  billingStatus: string;
  entitlementStatus: string;
  walletBalance: number;
  balanceFloor: number;
  canEnterWorkbench: boolean;
  canStartChargeableRun: boolean;
  chargeBlockedReasons: string[];
  priceTransparency: string;
  trialEntitlement: TrialEntitlement | null;
  group: null | {
    id: string;
    name: string;
    balanceFloor: number;
    maxConcurrentRuns: number;
  };
}

export interface OnboardingPayload {
  nextStepId: string;
  items: Array<{
    id: string;
    title: string;
    state: string;
    href: string;
    description: string;
  }>;
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get<CurrentUserPayload>("/me");
  return data;
}
