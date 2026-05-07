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
