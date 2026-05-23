import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Server,
  CreditCard,
  RotateCw,
  FolderOpen
} from "lucide-react";
import { loadOplEntryModel, usePortalQuery } from "../data/portalAdapters";

const OPL_GATEWAY_UNAVAILABLE_MESSAGE = "OPL 网关暂不可用，请稍后重试；如持续失败，请联系管理员。";

// 页面状态类型
type PageState =
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

// 启动阶段类型
type LaunchStep = {
  id: string;
  label: string;
  status: "completed" | "in_progress" | "waiting" | "failed";
  detail?: string;
};

export function OPLEntry() {
  const query = usePortalQuery(loadOplEntryModel, []);
  const [countdown, setCountdown] = useState(3);
  const pageState = query.status === "ready" ? query.data.pageState as PageState : "preparing";
  const providerBound = query.status === "ready" ? query.data.providerBound : false;
  const providerKeyRef = query.status === "ready" ? query.data.providerKeyRef : "";
  const gatewayReady = query.status === "ready" ? query.data.gatewayReady : false;
  const gatewayState = query.status === "ready" ? query.data.gatewayState : "";
  const providerStepDetail = providerBound
    ? `已绑定${providerKeyRef ? `：${providerKeyRef}` : ""}`
    : "未绑定";
  const providerStepStatus = providerBound ? "completed" : pageState === "blocked_by_provider_key" ? "failed" : "waiting";
  const gatewayStepDetail = gatewayState || (gatewayReady ? "OPL 网关已准备" : "等待后端网关投影");
  const gatewayCompleted = gatewayReady || pageState === "ready";
  const gatewayStepStatus = gatewayCompleted
    ? "completed"
    : ["service_unavailable", "capability_not_supported", "opl_upstream_url_required", "failed"].includes(pageState)
    ? "failed"
    : pageState === "retrying"
    ? "in_progress"
    : "waiting";

  // Ready 状态自动倒计时跳转
  useEffect(() => {
    if (pageState === "ready" && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (pageState === "ready" && countdown === 0) {
      const url = query.status === "ready" ? query.data.oplWebUrl : "";
      if (url) window.location.assign(url);
    }
  }, [pageState, countdown, query]);

  // 根据状态获取启动阶段
  const getSteps = (): LaunchStep[] => {
    switch (pageState) {
      case "ready":
        return [
          { id: "workspace", label: "准备工作空间", status: "completed" },
          { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
          { id: "session", label: "创建 OPL 会话", status: "completed" },
          { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
          { id: "open", label: "打开 OPL", status: "in_progress" },
        ];

      case "preparing":
        return [
          { id: "workspace", label: "准备工作空间", status: "completed" },
          { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
          { id: "session", label: "创建 OPL 会话", status: "in_progress" },
          { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
          { id: "open", label: "打开 OPL", status: "waiting" },
        ];

      case "retrying":
        return [
          { id: "workspace", label: "准备工作空间", status: "completed" },
          { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
          { id: "session", label: "创建 OPL 会话", status: "completed" },
          { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
          { id: "open", label: "打开 OPL", status: "waiting" },
        ];

      case "blocked_by_provider_key":
        return [
          { id: "workspace", label: "准备工作空间", status: "completed" },
          { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
          { id: "session", label: "创建 OPL 会话", status: "waiting" },
          { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
          { id: "open", label: "打开 OPL", status: "waiting" },
        ];

      case "blocked_by_runtime":
        return [
          { id: "workspace", label: "准备工作空间", status: "failed", detail: "运行环境未就绪" },
          { id: "key", label: "确认密钥绑定状态", status: "waiting" },
          { id: "session", label: "创建 OPL 会话", status: "waiting" },
          { id: "gateway", label: "确认 OPL 网关", status: "waiting" },
          { id: "open", label: "打开 OPL", status: "waiting" },
        ];

      case "workspace_required":
        return [
          { id: "workspace", label: "准备工作空间", status: "failed", detail: "工作空间不可用" },
          { id: "key", label: "确认密钥绑定状态", status: "waiting" },
          { id: "session", label: "创建 OPL 会话", status: "waiting" },
          { id: "gateway", label: "确认 OPL 网关", status: "waiting" },
          { id: "open", label: "打开 OPL", status: "waiting" },
        ];

      case "balance_insufficient":
        return [
          { id: "workspace", label: "准备工作空间", status: "failed", detail: "余额不足或冻结金额不够" },
          { id: "key", label: "确认密钥绑定状态", status: "waiting" },
          { id: "session", label: "创建 OPL 会话", status: "waiting" },
          { id: "gateway", label: "确认 OPL 网关", status: "waiting" },
          { id: "open", label: "打开 OPL", status: "waiting" },
        ];

      case "service_unavailable":
        return [
          { id: "workspace", label: "准备工作空间", status: "completed" },
          { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
          { id: "session", label: "创建 OPL 会话", status: "completed" },
          { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
          { id: "open", label: "打开 OPL", status: "waiting" },
        ];

      case "capability_not_supported":
        return [
          { id: "workspace", label: "准备工作空间", status: "completed" },
          { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
          { id: "session", label: "创建 OPL 会话", status: "completed" },
          { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
          { id: "open", label: "打开 OPL", status: "waiting" },
        ];

      case "opl_upstream_url_required":
        return [
          { id: "workspace", label: "准备工作空间", status: "completed" },
          { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
          { id: "session", label: "创建 OPL 会话", status: "completed" },
          { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
          { id: "open", label: "打开 OPL", status: "waiting" },
        ];

      case "failed":
      default:
        return [
          { id: "workspace", label: "准备工作空间", status: "completed" },
          { id: "key", label: "确认密钥绑定状态", status: providerStepStatus, detail: providerStepDetail },
          { id: "session", label: "创建 OPL 会话", status: "failed", detail: "会话创建失败" },
          { id: "gateway", label: "确认 OPL 网关", status: gatewayStepStatus, detail: gatewayStepDetail },
          { id: "open", label: "打开 OPL", status: "waiting" },
        ];
    }
  };

  const steps = getSteps();

  // 区块 1: 启动状态摘要区
  const renderStatusHero = () => {
    if (query.status === "loading") {
      return (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-blue-50 text-blue-700 border-blue-200">准备中</Badge>
            <h1 className="text-2xl font-semibold text-neutral-900">进入 OPL</h1>
          </div>
          <p className="text-neutral-600 mb-4">正在读取 OPL 启动状态和 Portal bootstrap。</p>
        </div>
      );
    }

    if (query.status === "error") {
      return (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-red-50 text-red-700 border-red-200">启动失败</Badge>
            <h1 className="text-2xl font-semibold text-neutral-900">进入 OPL</h1>
          </div>
          <p className="text-neutral-600 mb-4">{query.error || OPL_GATEWAY_UNAVAILABLE_MESSAGE}</p>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/opl-launch" reloadDocument>
                <RotateCw className="w-4 h-4" />
                重试进入 OPL
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "ready") {
      return (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-green-50 text-green-700 border-green-200">
              即将进入
            </Badge>
            <h1 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h1>
          </div>
          <p className="text-neutral-600 mb-4">
            准备完成，{countdown} 秒后自动进入 OPL 工作台
          </p>
          <div className="flex gap-3">
            <Button asChild className="gap-2">
              <a href={query.data.oplWebUrl}>
                立即进入 OPL
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/workspace">
                <ArrowLeft className="w-4 h-4" />
                返回工作空间
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "preparing") {
      return (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
              准备中
            </Badge>
            <h1 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h1>
          </div>
          <p className="text-neutral-600 mb-4">
            {query.data.userVisibleState || "正在准备工作空间和 OPL 会话，准备完成后将自动进入"}
          </p>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/workspace">
              <ArrowLeft className="w-4 h-4" />
              返回工作空间
            </Link>
          </Button>
        </div>
      );
    }

    if (pageState === "retrying") {
      return (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
              重试中
            </Badge>
            <h1 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h1>
          </div>
          <p className="text-neutral-600 mb-4">
            正在重新尝试连接 OPL 网关，请稍候
          </p>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/workspace">
              <ArrowLeft className="w-4 h-4" />
              返回工作空间
            </Link>
          </Button>
        </div>
      );
    }

    if (pageState === "blocked_by_provider_key") {
      return (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-orange-50 text-orange-700 border-orange-200">
              启动受限
            </Badge>
            <h1 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h1>
          </div>
          <p className="text-neutral-600 mb-4">
            当前模型调用密钥状态未满足进入条件
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "blocked_by_runtime") {
      return (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-orange-50 text-orange-700 border-orange-200">
              启动受限
            </Badge>
            <h1 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h1>
          </div>
          <p className="text-neutral-600 mb-4">
            运行环境尚未准备好，请先开通或启动运行环境
          </p>
          <div className="flex gap-3">
            <Button asChild className="gap-2">
              <Link to="/resources">
                <Server className="w-4 h-4" />
                去运行环境页
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "workspace_required") {
      return (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-orange-50 text-orange-700 border-orange-200">
              启动受限
            </Badge>
            <h1 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h1>
          </div>
          <p className="text-neutral-600 mb-4">
            工作空间不可用，请先检查工作空间和文件空间状态
          </p>
          <div className="flex gap-3">
            <Button asChild className="gap-2">
              <Link to="/workspace">
                <FolderOpen className="w-4 h-4" />
                去工作空间页
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "balance_insufficient") {
      return (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-orange-50 text-orange-700 border-orange-200">
              启动受限
            </Badge>
            <h1 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h1>
          </div>
          <p className="text-neutral-600 mb-4">
            当前余额不足或冻结金额不够，请先处理账单状态
          </p>
          <div className="flex gap-3">
            <Button asChild className="gap-2">
              <Link to="/billing">
                <CreditCard className="w-4 h-4" />
                去账单页
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "service_unavailable") {
      return (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-red-50 text-red-700 border-red-200">
              启动失败
            </Badge>
            <h1 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h1>
          </div>
          <p className="text-neutral-600 mb-4">
            {OPL_GATEWAY_UNAVAILABLE_MESSAGE}
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/opl-launch" reloadDocument>
                <RotateCw className="w-4 h-4" />
                重试进入 OPL
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    // failed 和其他失败状态
    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Badge className="bg-red-50 text-red-700 border-red-200">
            启动失败
          </Badge>
          <h1 className="text-2xl font-semibold text-neutral-900">
            进入 OPL
          </h1>
        </div>
        <p className="text-neutral-600 mb-4">
          启动过程遇到问题，请重试或检查相关配置
        </p>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/opl-launch" reloadDocument>
              <RotateCw className="w-4 h-4" />
              重试进入 OPL
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/overview">
              <ArrowLeft className="w-4 h-4" />
              返回总览
            </Link>
          </Button>
        </div>
      </div>
    );
  };

  // 区块 2: 阶段进度区
  const renderLaunchSteps = () => {
    return (
      <Card className="border border-neutral-200 mb-6">
        <div className="p-5 border-b border-neutral-200">
          <h2 className="font-semibold text-neutral-900">启动阶段</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-4 relative">
                {/* Step Icon */}
                <div className="flex-shrink-0 mt-0.5 relative z-10">
                  {step.status === "completed" && (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  )}
                  {step.status === "in_progress" && (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  )}
                  {step.status === "failed" && (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  {step.status === "waiting" && (
                    <div className="w-5 h-5 rounded-full border-2 border-neutral-300" />
                  )}
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className="absolute left-[10px] top-[28px] w-0.5 h-8 bg-neutral-200"
                  />
                )}

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`font-medium ${
                        step.status === "completed"
                          ? "text-neutral-900"
                          : step.status === "in_progress"
                          ? "text-blue-700"
                          : step.status === "failed"
                          ? "text-red-700"
                          : "text-neutral-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    {step.status === "completed" && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                        已完成
                      </Badge>
                    )}
                    {step.status === "in_progress" && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                        进行中
                      </Badge>
                    )}
                    {step.status === "failed" && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                        失败
                      </Badge>
                    )}
                  </div>

                  {/* Additional detail */}
                  {step.detail && (
                    <div
                      className={`text-xs mt-1 ${
                        step.status === "failed" ? "text-red-600" : "text-neutral-500"
                      }`}
                    >
                      {step.id === "key" && step.status !== "failed" && "gflabtoken 模型调用密钥："}
                      {step.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  };

  // 区块 3: 失败原因与回流操作区（仅在失败或受限时显示）
  const renderFailurePanel = () => {
    if (
      query.status === "loading" ||
      query.status === "error" ||
      pageState === "ready" ||
      pageState === "preparing" ||
      pageState === "retrying"
    ) {
      return null;
    }

    let message = "";
    let suggestions: string[] = [];

    switch (pageState) {
      case "blocked_by_provider_key":
        message = "当前模型调用密钥状态未满足进入条件。gflabtoken 模型调用密钥需要处于已绑定状态才能进入 OPL。";
        suggestions = [
          "请先在 OPL 入口确认或完成绑定",
          "或返回总览页面查看服务状态",
        ];
        break;

      case "blocked_by_runtime":
        message = "当前运行环境尚未准备好。请前往运行环境页面确认计算资源已正常开通并启动。";
        suggestions = [
          "检查套餐是否已选择",
          "确认计算资源是否已激活",
          "查看是否有余额或冻结金额不足的问题",
        ];
        break;

      case "workspace_required":
        message = "工作空间当前不可用。请前往工作空间页面确认文件空间状态和工作空间配置。";
        suggestions = [
          "检查文件空间是否可用",
          "确认工作空间是否已正确配置",
          "查看文件空间是否处于保护期或受限状态",
        ];
        break;

      case "balance_insufficient":
        message = "当前余额不足或冻结金额不够。进入 OPL 需要足够的可用余额和冻结金额来支持工作台运行。";
        suggestions = [
          "前往账单页面查看余额和冻结金额状态",
          "如需充值，请联系管理员或使用充值功能",
          "确认是否有未处理的账单问题",
        ];
        break;

      case "service_unavailable":
        message = "OPL 网关暂时不可用。这可能是临时性问题，建议稍后重试。";
        suggestions = [
          "等待 1-2 分钟后重试",
          "如问题持续，请检查运行环境状态",
          "或联系技术支持获取帮助",
        ];
        break;

      case "capability_not_supported":
        message = "当前能力暂不可用。请稍后重试或返回上一步。";
        suggestions = [
          "稍后重试进入 OPL",
          "返回工作空间检查配置",
          "或前往运行环境页面查看状态",
        ];
        break;

      case "opl_upstream_url_required":
        message = "当前 OPL 服务入口暂不可用。请稍后重试或联系平台。";
        suggestions = [
          "等待几分钟后重试",
          "返回工作空间",
          "或联系技术支持",
        ];
        break;

      case "failed":
      default:
        message = "启动过程遇到未预期的问题。建议先重试，如果问题持续，请检查相关配置或联系支持。";
        suggestions = [
          "尝试重新进入 OPL",
          "检查运行环境和工作空间状态",
          "查看账单和余额是否正常",
        ];
        break;
    }

    return (
      <Card className="border border-amber-200 bg-amber-50">
        <div className="p-5 border-b border-amber-200 bg-amber-100/50">
          <h2 className="font-semibold text-amber-900">处理建议</h2>
        </div>
        <div className="p-5">
          <p className="text-amber-900 text-sm mb-3">{message}</p>
          {suggestions.length > 0 && (
            <ul className="text-amber-800 text-sm space-y-1.5 list-disc list-inside">
              {suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* 区块 1: 启动状态摘要区 */}
      {renderStatusHero()}

      {/* 区块 2: 阶段进度区 */}
      {renderLaunchSteps()}

      {/* 区块 3: 失败原因与回流操作区 */}
      {renderFailurePanel()}

      {/* Ready 状态下的自动跳转提示 */}
      {pageState === "ready" && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900 text-sm">
            准备完成后将自动进入 OPL。您也可以点击上方按钮立即进入。
          </AlertDescription>
        </Alert>
      )}

      {/* Preparing 状态下的轻提示 */}
      {pageState === "preparing" && (
        <Alert className="border-blue-200 bg-blue-50">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          <AlertDescription className="text-blue-900 text-sm">
            {query.status === "ready" ? query.data.userVisibleState : "正在准备中，预计需要 1-2 分钟。准备完成后将自动跳转。"}
          </AlertDescription>
        </Alert>
      )}

      {/* Retrying 状态下的提示 */}
      {pageState === "retrying" && (
        <Alert className="border-blue-200 bg-blue-50">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          <AlertDescription className="text-blue-900 text-sm">
            正在重新尝试连接，请稍候。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
