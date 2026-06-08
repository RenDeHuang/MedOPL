import { fetchCurrentUser } from "../../api/portal/commercial";
import {
  activateLabPackage,
  fetchLabEntitlement,
  fetchLabPackages,
  fetchLabSubscription,
  type LabEntitlementPayload,
  type LabSubscriptionPayload,
  upgradeLabPackage,
} from "../../api/portal/lab";
import { fetchMyResources } from "../../api/portal/resources";
import { gb, numberValue, stringValue } from "./portalFormatters";
import {
  packageConcurrent,
  packageCpu,
  packageDisplayName,
  packageMemory,
  packageStorage,
  runtimeReleaseLifecycle,
} from "./portalRuntimeEnvironmentLifecycle";
import { activeWorkspaceId, firstFileSpace } from "./portalResourceModelHelpers";
import {
  PORTAL_DATA_UNAVAILABLE_MESSAGE,
  PortalDisplayError,
} from "./portalDisplayErrors";
import { usePortalQuery } from "./portalQuery";

export async function loadRuntimeEnvironmentModel() {
  const [resources, user] = await Promise.all([fetchMyResources(), fetchCurrentUser()]);
  const activeBinding = resources.items.find((item) => item.status === "active") || null;
  const fileSpace = firstFileSpace(resources);
  const storageCapacityGb = numberValue(fileSpace?.storageCapacityGb);
  const protection = activeBinding?.protection || resources.protections[0] || null;
  const workspaceId = activeWorkspaceId(resources) || stringValue(user.currentTaskSlug, "");
  const releaseLifecycle = runtimeReleaseLifecycle(resources);
  const [packageCatalog, subscription, entitlement] = await Promise.all([
    fetchLabPackages(),
    fetchLabSubscription({ workspaceId }),
    fetchLabEntitlement({ workspaceId }),
  ]);
  const plans = packageCatalog.items.map((plan) => ({
    id: plan.id,
    name: packageDisplayName(plan),
    description: plan.headline || plan.planSummary || "",
    cpu: packageCpu(plan),
    memory: packageMemory(plan),
    storage: packageStorage(plan),
    concurrent: packageConcurrent(plan),
    recommended: plan.id === "pro_8c16g_100gb",
    priceLabel: plan.priceLabel || plan.billing?.priceLabel || "正式售价未定价",
    pendingProductApproval: plan.pendingProductApproval || Boolean(plan.billing?.pendingProductApproval),
  }));
  if (plans.length === 0) throw new PortalDisplayError(PORTAL_DATA_UNAVAILABLE_MESSAGE);
  return {
    serviceStatus: activeBinding ? "active" : "not_activated",
    workspaceId,
    currentPlanName: subscription.currentPackageName || entitlement.entitlement.packageName || "已开通托管套餐",
    computeSpec: activeBinding?.computeResource?.instanceType || "未返回",
    storageTotal: gb(storageCapacityGb),
    storageUsed: gb(Math.min(storageCapacityGb, numberValue(protection?.consumedAmount))),
    storageAvailable: gb(Math.max(0, storageCapacityGb - numberValue(protection?.consumedAmount))),
    storagePercent: storageCapacityGb > 0 ? Math.min(100, Math.round((numberValue(protection?.consumedAmount) / storageCapacityGb) * 100)) : 0,
    frozenAmount: `¥ ${numberValue(protection?.frozenAmount).toFixed(2)}`,
    billingStatus: protection?.status || activeBinding?.status || "未返回",
    releaseLifecycle,
    plans,
    subscription: subscription as LabSubscriptionPayload,
    entitlement: entitlement as LabEntitlementPayload,
  } as const;
}

export async function activateRuntimeEnvironmentPlan(input: {
  packageId: string;
  workspaceId?: string;
  idempotencyKey: string;
  subscriptionId?: string;
}) {
  if (input.subscriptionId) {
    return upgradeLabPackage(input);
  }
  return activateLabPackage(input);
}

export function useRuntimeEnvironmentModel(refreshVersion: number) {
  return usePortalQuery(loadRuntimeEnvironmentModel, [refreshVersion]);
}
