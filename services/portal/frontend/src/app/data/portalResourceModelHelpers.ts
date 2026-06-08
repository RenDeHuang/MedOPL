import type {
  ManagedFileSpaceResource,
  PlatformProvisionedResourcesPayload,
  SelectedServerPlan,
} from "../../api/portal/types";
import { stringValue } from "./portalFormatters";

export function firstFileSpace(resources: PlatformProvisionedResourcesPayload): ManagedFileSpaceResource | null {
  return resources.items.find((item) => item.fileSpace)?.fileSpace || resources.fileSpaces[0] || null;
}

export function planSpec(plan: SelectedServerPlan | null | undefined) {
  if (!plan) return "";
  if (plan.cpu && plan.memoryGb) return `${plan.cpu} 核 ${plan.memoryGb} GB`;
  return plan.instanceType || "";
}

export function activeWorkspaceId(resources: PlatformProvisionedResourcesPayload) {
  const activeBinding = resources.items.find((item) => item.status === "active") || resources.items[0] || null;
  return stringValue(activeBinding?.workspaceId, "");
}
