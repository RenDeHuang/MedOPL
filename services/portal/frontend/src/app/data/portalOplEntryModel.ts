import {
  bindOplSession,
  bindProviderKeyForOplEntry,
  createOplLaunch,
  fetchOplBootstrap,
  fetchOplEntryPreflight,
  fetchOplRuntimeGate,
  type OplRuntimeGateCommercialAction,
} from "../../api/portal/opl";
import { fetchOplLaunchStatus } from "../../api/portal/resources";
import { OPL_GATEWAY_UNAVAILABLE_MESSAGE, PortalDisplayError } from "./portalDisplayErrors";
import { usePortalQuery } from "./portalQuery";

export type OplEntryPageState =
  | "preparing"
  | "ready"
  | "failed"
  | "blocked_by_provider_key"
  | "blocked_by_runtime"
  | "workspace_required"
  | "balance_insufficient"
  | "service_unavailable"
  | "capability_not_supported"
  | "opl_upstream_url_required"
  | "retrying";

export type OplEntryLaunchStep = {
  id: string;
  label: string;
  status: "completed" | "in_progress" | "waiting" | "failed";
  detail?: string;
};

export type OplEntryViewState = {
  pageState: OplEntryPageState;
  steps: OplEntryLaunchStep[];
  failurePanel: null | {
    message: string;
    suggestions: string[];
  };
  providerStepDetail: string;
  providerStepStatus: OplEntryLaunchStep["status"];
  gatewayStepDetail: string;
  gatewayStepStatus: OplEntryLaunchStep["status"];
};

export type OplEntryRuntimeConsumerProjection = {
  chatSurface: string;
  runSurface: string;
  uploadEnabled: boolean;
  runEnabled: boolean;
  artifactEnabled: boolean;
  releaseAction: string;
  storageAction: string;
};

export type OplEntryCommercialActionView = {
  commercialAction: string;
  reason: string;
  workspaceId: string;
  sessionId: string;
  taskRef: string;
  taskIntent: string;
  requiredPlan: string;
  planRequirement: OplRuntimeGateCommercialAction["planRequirement"];
  balanceRequirement: OplRuntimeGateCommercialAction["balanceRequirement"];
  medoplDeeplink: string;
  returnToOplDeeplink: string;
  primaryLabel: string;
  canClaim: string[];
  cannotClaim: string[];
};

function commercialActionLabel(action: string) {
  if (action === "open_medopl_purchase") return "打开 MedOPL 购买入口";
  if (action === "select_plan") return "选择托管套餐";
  if (action === "recharge_or_credit_required") return "充值或申请授信";
  if (action === "open_runtime_storage") return "开通计算资源和存储空间";
  if (action === "return_to_opl_task") return "返回 OPL 继续任务";
  return "查看 MedOPL 资源状态";
}

export function buildOplEntryCommercialActionView(action?: OplRuntimeGateCommercialAction | null): OplEntryCommercialActionView | null {
  if (!action) return null;
  return {
    commercialAction: action.action,
    reason: action.reason,
    workspaceId: action.workspaceId,
    sessionId: action.sessionId,
    taskRef: action.taskRef,
    taskIntent: action.taskIntent,
    requiredPlan: action.requiredPlan,
    planRequirement: action.planRequirement,
    balanceRequirement: action.balanceRequirement,
    medoplDeeplink: action.medoplDeeplink,
    returnToOplDeeplink: action.returnToOplDeeplink,
    primaryLabel: commercialActionLabel(action.action),
    canClaim: action.canClaim,
    cannotClaim: action.cannotClaim,
  };
}

function blockedByProviderKey(input: {
  workspaceId?: string;
  userVisibleState?: string;
  currentStage?: string;
}) {
  return {
    launchId: "",
    pageState: "blocked_by_provider_key",
    userVisibleState: input.userVisibleState || "provider_key_required",
    oplWebUrl: "",
    currentStage: input.currentStage || "provider_key_required",
    blockingUser: true,
    providerBound: false,
    providerKeyRef: "",
    gatewayReady: false,
    gatewayState: "等待模型调用密钥绑定",
    runtimeSessionId: "",
    oplSessionId: "",
    commercialAction: null,
    commercialActions: [],
    stages: [],
    workspaceId: input.workspaceId || "workspace-local-rc",
  } as const;
}

function providerStep(input: {
  providerBound?: boolean;
  providerKeyRef?: string;
  blockingUser?: boolean;
  pageState?: string;
  currentStage?: string;
}) {
  const providerStepDetail = input.providerBound
    ? `已绑定${input.providerKeyRef ? `：${input.providerKeyRef}` : ""}`
    : "未绑定";
  const providerStepStatus = input.providerBound
    ? "completed"
    : input.blockingUser || input.pageState === "blocked_by_provider_key"
      ? "failed"
      : input.currentStage === "provider_key_bound"
        ? "in_progress"
        : "waiting";
  return { providerStepDetail, providerStepStatus: providerStepStatus as OplEntryLaunchStep["status"] };
}

function gatewayStep(input: {
  gatewayReady?: boolean;
  gatewayState?: string;
  blockingUser?: boolean;
  pageState?: string;
  currentStage?: string;
}) {
  const gatewayStepDetail = input.gatewayState || (input.gatewayReady ? "OPL 网关已准备" : "等待后端网关投影");
  const gatewayCompleted = input.gatewayReady || input.currentStage === "opl_opening";
  const gatewayStepStatus = gatewayCompleted
    ? "completed"
    : input.blockingUser || ["service_unavailable", "capability_not_supported", "opl_upstream_url_required", "failed"].includes(input.pageState || "")
      ? "failed"
      : input.currentStage === "gateway_ready" || input.pageState === "retrying"
        ? "in_progress"
        : "waiting";
  return { gatewayStepDetail, gatewayStepStatus: gatewayStepStatus as OplEntryLaunchStep["status"] };
}

export function buildOplEntryLaunchSteps(input: {
  pageState: OplEntryPageState;
  providerStepStatus: OplEntryLaunchStep["status"];
  providerStepDetail: string;
  gatewayStepStatus: OplEntryLaunchStep["status"];
  gatewayStepDetail: string;
  currentStage?: string;
}): OplEntryLaunchStep[] {
  const { pageState, providerStepStatus, providerStepDetail, gatewayStepStatus, gatewayStepDetail, currentStage = "" } = input;
  if (pageState === "ready") {
    return [
      { id: "workspace", label: "准备存储空间", status: "completed" },
      { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
      { id: "session", label: "创建 OPL 会话", status: currentStage === "provider_key_bound" ? "in_progress" : "completed" },
      { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
      { id: "open", label: "打开 OPL", status: "in_progress" },
    ];
  }
  if (pageState === "preparing") {
    return [
      { id: "workspace", label: "准备存储空间", status: "completed" },
      { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
      { id: "session", label: "创建 OPL 会话", status: "in_progress" },
      { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
      { id: "open", label: "打开 OPL", status: "waiting" },
    ];
  }
  if (pageState === "retrying") {
    return [
      { id: "workspace", label: "准备存储空间", status: "completed" },
      { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
      { id: "session", label: "创建 OPL 会话", status: "completed" },
      { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
      { id: "open", label: "打开 OPL", status: "waiting" },
    ];
  }
  if (pageState === "blocked_by_provider_key") {
    return [
      { id: "workspace", label: "准备存储空间", status: "completed" },
      { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
      { id: "session", label: "创建 OPL 会话", status: "waiting" },
      { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
      { id: "open", label: "打开 OPL", status: "waiting" },
    ];
  }
  if (pageState === "blocked_by_runtime") {
    return blockedLaunchSteps("计算资源未就绪");
  }
  if (pageState === "workspace_required") {
    return blockedLaunchSteps("存储空间不可用");
  }
  if (pageState === "balance_insufficient") {
    return blockedLaunchSteps("余额不足或冻结金额不够");
  }
  if (["service_unavailable", "capability_not_supported", "opl_upstream_url_required"].includes(pageState)) {
    return [
      { id: "workspace", label: "准备存储空间", status: "completed" },
      { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
      { id: "session", label: "创建 OPL 会话", status: "completed" },
      { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
      { id: "open", label: "打开 OPL", status: "waiting" },
    ];
  }
  return [
    { id: "workspace", label: "准备存储空间", status: "completed" },
    { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
    { id: "session", label: "创建 OPL 会话", status: "failed", detail: "会话创建失败" },
    { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
    { id: "open", label: "打开 OPL", status: "waiting" },
  ];
}

function blockedLaunchSteps(workspaceDetail: string): OplEntryLaunchStep[] {
  return [
    { id: "workspace", label: "准备存储空间", status: "failed", detail: workspaceDetail },
    { id: "key", label: "确认密钥绑定状态", status: "waiting" },
    { id: "session", label: "创建 OPL 会话", status: "waiting" },
    { id: "gateway", label: "确认 OPL 网关", status: "waiting" },
    { id: "open", label: "打开 OPL", status: "waiting" },
  ];
}

export function buildOplEntryFailurePanel(pageState: OplEntryPageState): OplEntryViewState["failurePanel"] {
  if (["ready", "preparing", "retrying"].includes(pageState)) return null;
  if (pageState === "blocked_by_provider_key") {
    return {
      message: "当前模型调用密钥状态未满足进入条件。gflabtoken 模型调用密钥需要处于已绑定状态才能进入 OPL。",
      suggestions: ["请先在 OPL 入口确认或完成绑定", "或返回总览页面查看服务状态"],
    };
  }
  if (pageState === "blocked_by_runtime") {
    return {
      message: "当前计算资源尚未准备好。请前往计算资源页面确认资源已正常开通。",
      suggestions: ["检查套餐是否已选择", "确认计算资源是否已激活", "查看是否有余额或冻结金额不足的问题"],
    };
  }
  if (pageState === "workspace_required") {
    return {
      message: "存储空间当前不可用。请前往存储空间页面确认存储空间状态和工作空间配置。",
      suggestions: ["检查存储空间是否可用", "确认工作空间是否已正确配置", "查看存储空间是否处于保护期或受限状态"],
    };
  }
  if (pageState === "balance_insufficient") {
    return {
      message: "当前余额不足或冻结金额不够。进入 OPL 需要足够的可用余额和冻结金额来支持OPL 使用。",
      suggestions: ["前往账单页面查看余额和冻结金额状态", "如需充值，请联系管理员或使用充值功能", "确认是否有未处理的账单问题"],
    };
  }
  if (pageState === "service_unavailable") {
    return {
      message: "OPL 网关暂时不可用。这可能是临时性问题，建议稍后重试。",
      suggestions: ["等待 1-2 分钟后重试", "如问题持续，请检查计算资源状态", "或联系技术支持获取帮助"],
    };
  }
  if (pageState === "capability_not_supported") {
    return {
      message: "当前能力暂不可用。请稍后重试或返回上一步。",
      suggestions: ["稍后重试进入 OPL", "返回存储空间检查配置", "或前往计算资源页面查看状态"],
    };
  }
  if (pageState === "opl_upstream_url_required") {
    return {
      message: "当前 OPL 服务入口暂不可用。请稍后重试或联系平台。",
      suggestions: ["等待几分钟后重试", "返回存储空间", "或联系技术支持"],
    };
  }
  return {
    message: "启动过程遇到未预期的问题。建议先重试，如果问题持续，请检查相关配置或联系支持。",
    suggestions: ["尝试重新进入 OPL", "检查计算资源和存储空间状态", "查看账单和余额是否正常"],
  };
}

export function buildOplEntryViewState(input: {
  pageState?: string;
  providerBound?: boolean;
  providerKeyRef?: string;
  gatewayReady?: boolean;
  gatewayState?: string;
  currentStage?: string;
  blockingUser?: boolean;
}): OplEntryViewState {
  const pageState = (input.pageState || "preparing") as OplEntryPageState;
  const provider = providerStep({ ...input, pageState });
  const gateway = gatewayStep({ ...input, pageState });
  return {
    pageState,
    ...provider,
    ...gateway,
    steps: buildOplEntryLaunchSteps({
      pageState,
      providerStepStatus: provider.providerStepStatus,
      providerStepDetail: provider.providerStepDetail,
      gatewayStepStatus: gateway.gatewayStepStatus,
      gatewayStepDetail: gateway.gatewayStepDetail,
      currentStage: input.currentStage,
    }),
    failurePanel: buildOplEntryFailurePanel(pageState),
  };
}

export async function loadOplEntryModel() {
  try {
    const params = new URLSearchParams(window.location.search);
    const existingLaunchId = params.get("launchId");
    const preflight = existingLaunchId ? null : await fetchOplEntryPreflight({ workspaceId: "workspace-local-rc" });
    if (preflight && !preflight.providerBound) {
      return blockedByProviderKey({
        workspaceId: preflight.workspaceId,
        userVisibleState: preflight.reason || preflight.error,
        currentStage: preflight.launchStatus,
      });
    }
    const launch = existingLaunchId
      ? { launchId: existingLaunchId, openUrl: "", oplWebUrl: "", launchStatus: "preparing", ok: true, workspaceId: "" }
      : await createOplLaunch({});
    const [status, bootstrap] = await Promise.all([
      fetchOplLaunchStatus(launch.launchId),
      fetchOplBootstrap(launch.launchId),
    ]);
    const runtimeGate = await fetchOplRuntimeGate({
      workspaceId: status.workspaceId || launch.workspaceId || "workspace-local-rc",
      invocationMode: "runtime_required",
      sessionId: bootstrap.identity.runtimeSessionId,
      taskRef: existingLaunchId || launch.launchId,
      taskIntent: "research",
    });
    await bindOplSession({
      launchId: launch.launchId,
      oplSessionId: bootstrap.identity.oplSessionId,
      clientSessionState: { source: "figma_make_zip_portal_ui" },
    });
    return {
      launchId: launch.launchId,
      pageState: status.status === "ready" ? "ready" : status.status === "failed" ? "failed" : "preparing",
      userVisibleState: status.userVisibleState,
      oplWebUrl: status.oplWebUrl || launch.oplWebUrl || launch.openUrl,
      currentStage: status.currentStage,
      blockingUser: status.blockingUser,
      providerBound: status.providerBound,
      providerKeyRef: status.providerKeyRef,
      gatewayReady: status.gatewayReady,
      gatewayState: status.gatewayState,
      runtimeSessionId: bootstrap.identity.runtimeSessionId,
      oplSessionId: bootstrap.identity.oplSessionId,
      runtimeGate: {
        runtimeState: runtimeGate.runtimeState,
        storageState: runtimeGate.storageState,
        nodePoolProjection: runtimeGate.nodePoolProjection,
        billing: runtimeGate.billing,
        release: runtimeGate.release,
        consumerProjection: runtimeGate.consumerProjection,
      },
      commercialAction: buildOplEntryCommercialActionView(runtimeGate.actionContract?.primaryAction),
      commercialActions: runtimeGate.actionContract?.availableActions.map((action) => buildOplEntryCommercialActionView(action)).filter(Boolean),
      stages: status.stages,
      workspaceId: status.workspaceId || launch.workspaceId || "workspace-local-rc",
    } as const;
  } catch (error: unknown) {
    const response = (error as { response?: { status?: number; data?: { error?: string } } })?.response;
    if (response?.status === 428 && response.data?.error === "provider_key_required") {
      return blockedByProviderKey({});
    }
    throw new PortalDisplayError(OPL_GATEWAY_UNAVAILABLE_MESSAGE);
  }
}

export async function bindOplEntryProviderKey(input: { workspaceId?: string; apiKey: string }) {
  return bindProviderKeyForOplEntry(input);
}

export function useOplEntryModel() {
  return usePortalQuery(loadOplEntryModel, []);
}
