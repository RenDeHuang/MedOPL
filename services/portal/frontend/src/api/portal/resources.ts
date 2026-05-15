import { apiClient } from "../client";

export interface CustomerComputeResource {
  id: string;
  provider?: string;
  region: string;
  zone?: string;
  provisioningMode?: string;
  cloudResourceId?: string;
  serverPlanId?: string;
  instanceType: string;
  instanceId: string;
  cvmInstanceId?: string;
  publicEndpoint?: string;
  privateEndpoint?: string;
  runtimeAgentId?: string;
  runtimeAgentVersion?: string;
  healthStatus?: string;
  status: string;
  billingStartedAt?: string;
  billingStoppedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerStorageResource {
  id: string;
  provider?: string;
  provisioningMode?: string;
  cloudResourceId?: string;
  region: string;
  bucketName: string;
  bucketId: string;
  storagePlanId?: string;
  storageCapacityGb?: number;
  endpoint?: string;
  credentialsSecretRef?: string;
  status: string;
  rootPrefix?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WeeklyProtectionFreeze {
  id: string;
  resourceBindingId: string;
  workspaceId: string;
  computeInstanceId: string;
  storageBucketId: string;
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
  protectionPolicyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceResourceProtection extends WeeklyProtectionFreeze {}

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

export interface WorkspaceResourceBinding {
  id: string;
  workspaceId: string;
  resourceBindingId: string;
  billingAttributionId?: string;
  accountId?: string;
  serverPlanId?: string;
  computeInstanceId: string;
  storageBucketId: string;
  rootPrefix?: string;
  protectionPolicyId?: string;
  status: string;
  bindingAccess: WorkspaceBindingAccess;
  computeInstance?: CustomerComputeResource | null;
  storageBucket?: CustomerStorageResource | null;
  computeInstances: CustomerComputeResource[];
  storageBuckets: CustomerStorageResource[];
  protection?: WorkspaceResourceProtection | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformProvisionedResourcesSummary {
  computeInstances: number;
  storageBuckets: number;
  activeBindings: number;
  inactiveBindings: number;
  activeProtectionFreezes: number;
  frozenAmount: number;
  consumedAmount: number;
  remainingAmount: number;
  releasedProtectionAmount: number;
  computeInstanceCount: number;
  storageBucketCount: number;
  bindingCount: number;
  protectionFreezeCount: number;
}

export interface PlatformProvisionedResourcesPayload {
  ok: boolean;
  source: string;
  computeInstances: CustomerComputeResource[];
  storageBuckets: CustomerStorageResource[];
  protectionFreezes: WeeklyProtectionFreeze[];
  bindings: WorkspaceResourceBinding[];
  items: WorkspaceResourceBinding[];
  summary: PlatformProvisionedResourcesSummary;
}

export interface CreateComputeInstanceInput {
  serverPlanId?: string;
  region?: string;
  zone?: string;
  instanceType: string;
  cvmInstanceId?: string;
  publicEndpoint?: string;
  privateEndpoint?: string;
  runtimeAgentId?: string;
  runtimeAgentVersion?: string;
  resourceLifecycleMode?: "platform_provisioned";
}

export interface CreateStorageBucketInput {
  region?: string;
  bucketId?: string;
  endpoint?: string;
  rootPrefix?: string;
  storagePlanId?: string;
  storageCapacityGb?: number;
  resourceLifecycleMode?: "platform_provisioned";
}

export interface BindWorkspaceResourceInput {
  workspaceId: string;
  computeInstanceId: string;
  storageBucketId: string;
  rootPrefix?: string;
}

export interface EnsureProtectionFreezeInput {
  bindingId: string;
  weeklyAmount: number;
  windowStartAt: string;
  windowEndAt: string;
  usageMode?: string;
  consumedAmount?: number;
  consumedDeltaAmount?: number;
}

export interface PlatformProvisionedResourceMutationResult<T> {
  ok: boolean;
  item?: T;
  binding?: WorkspaceResourceBinding | null;
  freeze?: WeeklyProtectionFreeze | null;
  created?: boolean;
  skipped?: boolean;
  reason?: string;
  deltaFrozenAmount?: number;
  affectedBindings?: WorkspaceResourceBinding[];
  releasedProtection?: WeeklyProtectionFreeze | null;
}

export interface OplLaunchStatusPayload {
  ok: boolean;
  launchId: string;
  status: "preparing" | "ready" | "failed" | string;
  currentStage: string;
  userVisibleState: string;
  blockingUser: boolean;
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

export interface ResourceBindingQuoteInput {
  workspaceId?: string;
  workspaceSessionId?: string;
  serverPlanId: string;
  estimatedHours?: number;
}

export interface ResourceBindingFreezeInput {
  quoteId?: string;
  resourceBindingId?: string;
  workspaceId?: string;
  workspaceSessionId?: string;
  serverPlanId?: string;
  estimatedHours?: number;
}

export interface ResourceBindingMutationResult {
  ok: boolean;
  resourceBindingId?: string;
  quoteId?: string;
  binding?: WorkspaceResourceBinding | null;
}

type RawBinding = Omit<WorkspaceResourceBinding, "computeInstances" | "storageBuckets">;

const PLATFORM_PROVISIONED_RESOURCES_PATH = "/platform-provisioned-resources";

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function fetchMyResources(): Promise<PlatformProvisionedResourcesPayload> {
  const { data } = await apiClient.get<{
    ok: boolean;
    source: string;
    computeInstances?: CustomerComputeResource[];
    storageBuckets?: CustomerStorageResource[];
    protectionFreezes?: WeeklyProtectionFreeze[];
    bindings?: RawBinding[];
    summary?: Partial<PlatformProvisionedResourcesSummary>;
  }>(PLATFORM_PROVISIONED_RESOURCES_PATH);
  const computeInstances = data.computeInstances || [];
  const storageBuckets = data.storageBuckets || [];
  const protectionFreezes = data.protectionFreezes || [];
  const items = (data.bindings || []).map<WorkspaceResourceBinding>((binding) => {
    const computeInstance = binding.computeInstance || computeInstances.find((item) => item.id === binding.computeInstanceId) || null;
    const storageBucket = binding.storageBucket || storageBuckets.find((item) => item.id === binding.storageBucketId) || null;
    return {
      ...binding,
      resourceBindingId: binding.resourceBindingId || binding.id,
      computeInstance,
      storageBucket,
      computeInstances: computeInstance ? [computeInstance] : [],
      storageBuckets: storageBucket ? [storageBucket] : [],
      protection: binding.protection || null,
    };
  });
  const derivedFrozenAmount = protectionFreezes.reduce((sum, item) => sum + numberValue(item.frozenAmount), 0);
  const derivedConsumedAmount = protectionFreezes.reduce((sum, item) => sum + numberValue(item.consumedAmount), 0);
  const derivedRemainingAmount = protectionFreezes.reduce((sum, item) => sum + numberValue(item.remainingAmount), 0);
  const derivedReleasedAmount = protectionFreezes.reduce((sum, item) => sum + numberValue(item.releasedAmount), 0);
  return {
    ok: data.ok,
    source: data.source,
    computeInstances,
    storageBuckets,
    protectionFreezes,
    bindings: items,
    items,
    summary: {
      computeInstances: Number(data.summary?.computeInstances ?? computeInstances.length),
      storageBuckets: Number(data.summary?.storageBuckets ?? storageBuckets.length),
      activeBindings: Number(data.summary?.activeBindings ?? items.filter((item) => item.status === "active").length),
      inactiveBindings: Number(data.summary?.inactiveBindings ?? items.filter((item) => item.status !== "active").length),
      activeProtectionFreezes: Number(data.summary?.activeProtectionFreezes ?? protectionFreezes.filter((item) => item.status === "active").length),
      frozenAmount: numberValue(data.summary?.frozenAmount, derivedFrozenAmount),
      consumedAmount: numberValue(data.summary?.consumedAmount, derivedConsumedAmount),
      remainingAmount: numberValue(data.summary?.remainingAmount, derivedRemainingAmount),
      releasedProtectionAmount: numberValue(data.summary?.releasedProtectionAmount, derivedReleasedAmount),
      computeInstanceCount: Number(data.summary?.computeInstanceCount ?? computeInstances.length),
      storageBucketCount: Number(data.summary?.storageBucketCount ?? storageBuckets.length),
      bindingCount: Number(data.summary?.bindingCount ?? items.length),
      protectionFreezeCount: Number(data.summary?.protectionFreezeCount ?? protectionFreezes.length),
    },
  };
}

export async function createComputeInstance(input: CreateComputeInstanceInput): Promise<PlatformProvisionedResourceMutationResult<CustomerComputeResource>> {
  const { data } = await apiClient.post<PlatformProvisionedResourceMutationResult<CustomerComputeResource>>(
    `${PLATFORM_PROVISIONED_RESOURCES_PATH}/compute-instances`,
    {
      resourceLifecycleMode: "platform_provisioned",
      ...input,
    },
  );
  return data;
}

export async function createStorageBucket(input: CreateStorageBucketInput): Promise<PlatformProvisionedResourceMutationResult<CustomerStorageResource>> {
  const { data } = await apiClient.post<PlatformProvisionedResourceMutationResult<CustomerStorageResource>>(
    `${PLATFORM_PROVISIONED_RESOURCES_PATH}/storage-buckets`,
    {
      resourceLifecycleMode: "platform_provisioned",
      ...input,
    },
  );
  return data;
}

export async function bindWorkspaceResource(input: BindWorkspaceResourceInput): Promise<PlatformProvisionedResourceMutationResult<never>> {
  const { data } = await apiClient.post<PlatformProvisionedResourceMutationResult<never>>(`${PLATFORM_PROVISIONED_RESOURCES_PATH}/bind`, input);
  return data;
}

export async function unbindWorkspaceResource(bindingId: string): Promise<PlatformProvisionedResourceMutationResult<never>> {
  const { data } = await apiClient.post<PlatformProvisionedResourceMutationResult<never>>(`${PLATFORM_PROVISIONED_RESOURCES_PATH}/unbind`, { bindingId });
  return data;
}

export async function deleteComputeInstance(computeInstanceId: string): Promise<PlatformProvisionedResourceMutationResult<CustomerComputeResource>> {
  const { data } = await apiClient.post<PlatformProvisionedResourceMutationResult<CustomerComputeResource>>(
    `${PLATFORM_PROVISIONED_RESOURCES_PATH}/compute-instances/delete`,
    { computeInstanceId },
  );
  return data;
}

export async function deleteStorageBucket(storageBucketId: string): Promise<PlatformProvisionedResourceMutationResult<CustomerStorageResource>> {
  const { data } = await apiClient.post<PlatformProvisionedResourceMutationResult<CustomerStorageResource>>(
    `${PLATFORM_PROVISIONED_RESOURCES_PATH}/storage-buckets/delete`,
    { storageBucketId },
  );
  return data;
}

export async function ensureProtectionFreeze(input: EnsureProtectionFreezeInput): Promise<PlatformProvisionedResourceMutationResult<never>> {
  const { data } = await apiClient.post<PlatformProvisionedResourceMutationResult<never>>(
    `${PLATFORM_PROVISIONED_RESOURCES_PATH}/protection-freezes/ensure`,
    input,
  );
  return data;
}

export async function fetchOplLaunchStatus(launchId: string) {
  const { data } = await apiClient.get<OplLaunchStatusPayload>(`/opl/launch-status/${encodeURIComponent(launchId)}`);
  return data;
}

// Legacy type aliases for old imports. New code should use Customer* and PlatformProvisioned* names.
export type UserComputeInstance = CustomerComputeResource;
export type UserStorageBucket = CustomerStorageResource;
export type UserOwnedResourcesSummary = PlatformProvisionedResourcesSummary;
export type UserOwnedResourcesPayload = PlatformProvisionedResourcesPayload;
export type UserOwnedResourceMutationResult<T> = PlatformProvisionedResourceMutationResult<T>;
