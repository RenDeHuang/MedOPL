import {
  fetchLabEntitlement,
  fetchLabPackages,
  fetchLabSubscription,
  type LabEntitlementPayload,
  type LabSubscriptionPayload,
} from "../../api/portal/lab";
import { fetchCurrentUser } from "../../api/portal/commercial";
import { numberValue, statusText, stringValue } from "./portalFormatters";
import {
  packageConcurrent,
  packageCpu,
  packageDisplayName,
  packageMemory,
  packageStorage,
} from "./portalRuntimeEnvironmentLifecycle";
import { usePortalQuery } from "./portalQuery";

export async function fetchPackageCatalog() {
  const [catalog, user] = await Promise.all([fetchLabPackages(), fetchCurrentUser()]);
  const workspaceId = stringValue(user.currentTaskSlug, "");
  const [subscription, entitlement] = await Promise.all([
    fetchLabSubscription({ workspaceId }),
    fetchLabEntitlement({ workspaceId }),
  ]);
  const plans = catalog.items.map((plan) => ({
    id: plan.id,
    name: packageDisplayName(plan),
    description: plan.headline || plan.planSummary || "",
    cpu: packageCpu(plan),
    memory: packageMemory(plan),
    storage: packageStorage(plan),
    concurrent: packageConcurrent(plan),
    priceLabel: plan.priceLabel || plan.billing?.priceLabel || "正式售价未定价",
    pendingProductApproval: plan.pendingProductApproval || Boolean(plan.billing?.pendingProductApproval),
    recommended: plan.id === "pro_8c16g_100gb",
    purchasable: true,
    openingWindow: "预计开通时间以后端资源队列为准",
  }));
  return {
    workspaceId,
    currentPackageId: subscription.currentPackageId || entitlement.entitlement.packageId || "",
    currentPackageName: subscription.currentPackageName || entitlement.entitlement.packageName || "未开通",
    balance: numberValue(subscription.wallet?.balance, subscription.balance),
    frozenAmount: numberValue(subscription.wallet?.activeFreeze, subscription.frozenAmount),
    subscriptionStatusText: statusText(subscription.status),
    plans,
    subscription: subscription as LabSubscriptionPayload,
    entitlement: entitlement as LabEntitlementPayload,
  } as const;
}

export function usePackagesPurchaseModel() {
  return usePortalQuery(fetchPackageCatalog, []);
}
