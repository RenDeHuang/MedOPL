import { goControlPlaneClient } from "../client";
import type {
  ManagedComputeResource,
  ManagedEnvironmentProtection,
  ManagedEnvironmentResource,
  OplLaunchStatusPayload,
  PlatformProvisionedResourcesPayload,
  PlatformProvisionedResourcesSummary,
  ManagedFileSpaceResource,
} from "./types";

export type {
  ManagedComputeResource,
  ManagedEnvironmentProtection,
  ManagedEnvironmentResource,
  ManagedFileSpaceResource,
  OplLaunchStatusPayload,
  PlatformProvisionedResourcesPayload,
  PlatformProvisionedResourcesSummary,
  WorkspaceBindingAccess,
  WorkspaceBindingAccessGate,
  ManagedEnvironmentAuditStatus,
  ManagedEnvironmentReleasePolicy,
  ManagedEnvironmentStopBilling,
} from "./types";

const PLATFORM_PROVISIONED_RESOURCES_PATH = "/platform-provisioned-resources";

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function fetchMyResources(): Promise<PlatformProvisionedResourcesPayload> {
  const { data } = await goControlPlaneClient.get<{
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
  const { data } = await goControlPlaneClient.get<OplLaunchStatusPayload>(`/opl/launch-status/${encodeURIComponent(launchId)}`);
  return data;
}
