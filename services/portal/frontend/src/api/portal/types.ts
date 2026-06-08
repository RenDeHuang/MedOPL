export interface PublicSettingsPayload {
  siteName: string;
  siteLogo: string;
  siteSubtitle: string;
  homeContent: string;
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
  basePrice: null;
  pendingProductApproval: boolean;
  priceLabel?: string;
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
  basePrice: null;
  pendingProductApproval: boolean;
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
  basePrice: null;
  pendingProductApproval: boolean;
  priceLabel?: string;
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

export interface LabPackagePlan {
  id: string;
  name: string;
  headline?: string;
  backingServerPlanId?: string;
  compute?: {
    cores?: number;
    memoryGb?: number;
    maxConcurrentRuns?: number;
  };
  storage?: {
    includedGb?: number;
    warningRatio?: number;
  };
  billing?: {
    basePrice: null;
    pendingProductApproval: boolean;
    priceLabel?: string;
    freezeDays?: number;
  };
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

export interface ManagedComputeResource {
  region: string;
  zone?: string;
  instanceType: string;
  healthStatus?: string;
  status: string;
  billingStartedAt?: string;
  billingStoppedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ManagedFileSpaceResource {
  region: string;
  storageCapacityGb?: number;
  status: string;
  billingStartedAt?: string;
  billingStoppedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ManagedEnvironmentProtection {
  workspaceId: string;
  usageMode: string;
  windowStartAt: string;
  windowEndAt: string;
  weeklyAmount: number;
  frozenAmount: number;
  consumedAmount: number;
  remainingAmount: number;
  releasedAmount: number;
  reconcile120MinStatus: string;
  tPlus1AuditStatus: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceBindingAccessGate {
  bindingRequired: boolean;
  allowed: boolean;
  reason: string;
}

export interface WorkspaceBindingAccess {
  oplLite: WorkspaceBindingAccessGate;
  fullRuntime: WorkspaceBindingAccessGate;
  workspaceFiles: WorkspaceBindingAccessGate;
  workspaceTasks: WorkspaceBindingAccessGate;
  workspaceOutputs: WorkspaceBindingAccessGate;
}

export interface ManagedEnvironmentReleasePolicy {
  status: string;
  releasedAt?: string;
  billingStopConfirmBy?: string;
  stopBillingConfirmWithinMinutes: number;
  protection: string;
}

export interface ManagedEnvironmentStopBilling {
  status: string;
  billingStoppedAt?: string;
  billingStopConfirmBy?: string;
  confirmWithinMinutes: number;
}

export interface ManagedEnvironmentAuditStatus {
  status: string;
  auditReadyAt?: string;
  policy: string;
}

export interface ManagedEnvironmentResource {
  workspaceId: string;
  status: string;
  bindingAccess: WorkspaceBindingAccess;
  computeResource?: ManagedComputeResource | null;
  fileSpace?: ManagedFileSpaceResource | null;
  protection?: ManagedEnvironmentProtection | null;
  releasePolicy?: ManagedEnvironmentReleasePolicy | null;
  stopBilling?: ManagedEnvironmentStopBilling | null;
  auditStatus?: ManagedEnvironmentAuditStatus | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformProvisionedResourcesSummary {
  computeResources: number;
  fileSpaces: number;
  activeEnvironments: number;
  inactiveEnvironments: number;
  activeProtections: number;
  frozenAmount: number;
  consumedAmount: number;
  remainingAmount: number;
  releasedProtectionAmount: number;
  computeResourceCount: number;
  fileSpaceCount: number;
  environmentCount: number;
  protectionCount: number;
}

export interface PlatformProvisionedResourcesPayload {
  ok: boolean;
  source: string;
  computeResources: ManagedComputeResource[];
  fileSpaces: ManagedFileSpaceResource[];
  protections: ManagedEnvironmentProtection[];
  items: ManagedEnvironmentResource[];
  summary: PlatformProvisionedResourcesSummary;
}

export interface OplLaunchStatusPayload {
  ok: boolean;
  launchId: string;
  workspaceId: string;
  status: "preparing" | "ready" | "failed" | string;
  currentStage: string;
  userVisibleState: string;
  blockingUser: boolean;
  providerBound: boolean;
  providerKeyRef: string;
  gatewayReady: boolean;
  gatewayState: string;
  oplWebUrl: string;
  error?: string;
  message?: string;
  stages: Array<{
    stage: string;
    ok: boolean;
    blockingUser: boolean;
    userVisibleState: string;
    startedAt: string;
    endedAt: string;
    latencyMs: number;
  }>;
}
