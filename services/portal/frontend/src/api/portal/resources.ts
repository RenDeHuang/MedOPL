import { apiClient } from "../client";

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

export interface ManagedEnvironmentResource {
  workspaceId: string;
  status: string;
  bindingAccess: WorkspaceBindingAccess;
  computeResource?: ManagedComputeResource | null;
  fileSpace?: ManagedFileSpaceResource | null;
  protection?: ManagedEnvironmentProtection | null;
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

const PLATFORM_PROVISIONED_RESOURCES_PATH = "/platform-provisioned-resources";

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function fetchMyResources(): Promise<PlatformProvisionedResourcesPayload> {
  const { data } = await apiClient.get<{
    ok: boolean;
    source: string;
    computeResources?: ManagedComputeResource[];
    fileSpaces?: ManagedFileSpaceResource[];
    protections?: ManagedEnvironmentProtection[];
    items?: ManagedEnvironmentResource[];
    summary?: Partial<PlatformProvisionedResourcesSummary>;
  }>(PLATFORM_PROVISIONED_RESOURCES_PATH);
  const computeResources = data.computeResources || [];
  const fileSpaces = data.fileSpaces || [];
  const protections = data.protections || [];
  const items = data.items || [];
  const derivedFrozenAmount = protections.reduce((sum, item) => sum + numberValue(item.frozenAmount), 0);
  const derivedConsumedAmount = protections.reduce((sum, item) => sum + numberValue(item.consumedAmount), 0);
  const derivedRemainingAmount = protections.reduce((sum, item) => sum + numberValue(item.remainingAmount), 0);
  const derivedReleasedAmount = protections.reduce((sum, item) => sum + numberValue(item.releasedAmount), 0);
  return {
    ok: data.ok,
    source: data.source,
    computeResources,
    fileSpaces,
    protections,
    items,
    summary: {
      computeResources: Number(data.summary?.computeResources ?? computeResources.length),
      fileSpaces: Number(data.summary?.fileSpaces ?? fileSpaces.length),
      activeEnvironments: Number(data.summary?.activeEnvironments ?? items.filter((item) => item.status === "active").length),
      inactiveEnvironments: Number(data.summary?.inactiveEnvironments ?? items.filter((item) => item.status !== "active").length),
      activeProtections: Number(data.summary?.activeProtections ?? protections.filter((item) => item.status === "active").length),
      frozenAmount: numberValue(data.summary?.frozenAmount, derivedFrozenAmount),
      consumedAmount: numberValue(data.summary?.consumedAmount, derivedConsumedAmount),
      remainingAmount: numberValue(data.summary?.remainingAmount, derivedRemainingAmount),
      releasedProtectionAmount: numberValue(data.summary?.releasedProtectionAmount, derivedReleasedAmount),
      computeResourceCount: Number(data.summary?.computeResourceCount ?? computeResources.length),
      fileSpaceCount: Number(data.summary?.fileSpaceCount ?? fileSpaces.length),
      environmentCount: Number(data.summary?.environmentCount ?? items.length),
      protectionCount: Number(data.summary?.protectionCount ?? protections.length),
    },
  };
}

export async function fetchOplLaunchStatus(launchId: string) {
  const { data } = await apiClient.get<OplLaunchStatusPayload>(`/opl/launch-status/${encodeURIComponent(launchId)}`);
  return data;
}
