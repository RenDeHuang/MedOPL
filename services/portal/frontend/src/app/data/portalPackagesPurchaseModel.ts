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

type PurchaseActionLink = {
  action: string;
  label: string;
  href: string;
  method: string;
};

type ReturnToOplTaskContract = {
  resumeAction: string;
  resumeMethod: string;
  workspaceId: string;
  sessionId: string;
  taskRef: string;
  taskIntent: string;
  returnToOplDeeplink: string;
  requiredConsumer: string;
  canClaim: string[];
  cannotClaim: string[];
};

export type PurchaseActionProjection = {
  workspaceId: string;
  sessionId: string;
  taskRef: string;
  taskIntent: string;
  requiredPlan: string;
  selectedPlanId: string;
  balance: number;
  availableBalance: number;
  activeFreeze: number;
  minRequiredBalance: number;
  canOpenRuntimeStorage: boolean;
  selectPlanAction: PurchaseActionLink;
  rechargeOrCreditAction: PurchaseActionLink;
  openRuntimeStorageAction: PurchaseActionLink;
  returnToOplAction: PurchaseActionLink;
  returnToOplTaskContract: ReturnToOplTaskContract;
  canClaim: string[];
  cannotClaim: string[];
};

function queryValue(params: URLSearchParams, key: string, fallback = "") {
  return stringValue(params.get(key), fallback);
}

export function buildPurchaseActionProjectionFromSearch(search = window.location.search, account?: {
  balance?: number;
  availableBalance?: number;
  activeFreeze?: number;
}): PurchaseActionProjection {
  const params = new URLSearchParams(search);
  const workspaceId = queryValue(params, "workspaceId", "workspace-local-rc");
  const selectedPlanId = queryValue(params, "runtimePlanId", "starter_2c4g_10gb");
  const storagePlanId = queryValue(params, "storagePlanId", "workspace_10gb");
  const taskIntent = queryValue(params, "taskIntent", "research");
  const sessionId = queryValue(params, "sessionId");
  const taskRef = queryValue(params, "taskRef");
  const balance = numberValue(account?.balance);
  const activeFreeze = numberValue(account?.activeFreeze);
  const availableBalance = numberValue(account?.availableBalance, Math.max(0, balance - activeFreeze));
  const minRequiredBalance = 30;
  const base = `?workspaceId=${workspaceId}&runtimePlanId=${selectedPlanId}&storagePlanId=${storagePlanId}&taskIntent=${taskIntent}&sessionId=${sessionId}&taskRef=${taskRef}`;
  const returnToOplDeeplink = `/opl${base}`;
  const returnToOplTaskContract = {
    resumeAction: "return_to_opl_task",
    resumeMethod: "GET",
    workspaceId,
    sessionId,
    taskRef,
    taskIntent,
    returnToOplDeeplink,
    requiredConsumer: "opl-webui",
    canClaim: ["return_to_opl_task_contract"],
    cannotClaim: ["full_opl_webui_resume_implementation", "opl_domain_quality_verdict"],
  };
  return {
    workspaceId,
    sessionId,
    taskRef,
    taskIntent,
    requiredPlan: selectedPlanId,
    selectedPlanId,
    balance,
    availableBalance,
    activeFreeze,
    minRequiredBalance,
    canOpenRuntimeStorage: availableBalance >= minRequiredBalance,
    selectPlanAction: { action: "select_plan", label: "选择托管套餐", href: `/packages${base}`, method: "POST /api/lab-packages/activate" },
    rechargeOrCreditAction: { action: "recharge_or_credit_required", label: "充值或申请授信", href: `/usage${base}`, method: "POST /api/v22/users/credit" },
    openRuntimeStorageAction: { action: "open_runtime_storage", label: "开通计算资源和存储空间", href: `/compute${base}`, method: "POST /api/v22/managed-environment/open" },
    returnToOplAction: { action: "return_to_opl_task", label: "返回 OPL 继续任务", href: returnToOplDeeplink, method: "GET" },
    returnToOplTaskContract,
    canClaim: ["purchase_action_projection", "internal_credit_or_grant_path", "existing_runtime_storage_open_path", "return_to_opl_task_contract"],
    cannotClaim: ["external_psp_settlement", "full_opl_webui_resume_implementation", "cloud_deployment_proof"],
  };
}

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
    priceLabel: plan.priceLabel || plan.billing?.priceLabel || "按套餐余额和 quota 核对",
    pendingProductApproval: plan.pendingProductApproval || Boolean(plan.billing?.pendingProductApproval),
    recommended: plan.id === "pro_8c16g_100gb",
    purchasable: true,
    openingWindow: "预计开通时间以后端资源队列为准",
    selectActionHref: buildPurchaseActionProjectionFromSearch(window.location.search).selectPlanAction.href.replace(
      /runtimePlanId=[^&]*/u,
      `runtimePlanId=${plan.id}`,
    ),
  }));
  const purchaseProjection = buildPurchaseActionProjectionFromSearch(window.location.search, {
    balance: numberValue(subscription.wallet?.balance, subscription.balance),
    availableBalance: numberValue(subscription.wallet?.availableBalance),
    activeFreeze: numberValue(subscription.wallet?.activeFreeze, subscription.frozenAmount),
  });
  return {
    workspaceId,
    currentPackageId: subscription.currentPackageId || entitlement.entitlement.packageId || "",
    currentPackageName: subscription.currentPackageName || entitlement.entitlement.packageName || "未开通",
    balance: numberValue(subscription.wallet?.balance, subscription.balance),
    frozenAmount: numberValue(subscription.wallet?.activeFreeze, subscription.frozenAmount),
    subscriptionStatusText: statusText(subscription.status),
    purchaseProjection,
    plans,
    subscription: subscription as LabSubscriptionPayload,
    entitlement: entitlement as LabEntitlementPayload,
  } as const;
}

export function usePackagesPurchaseModel() {
  return usePortalQuery(fetchPackageCatalog, []);
}
